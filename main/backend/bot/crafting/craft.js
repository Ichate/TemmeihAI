import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { CRAFT_TIMEOUT_MS, POST_CRAFT_WAIT_MS, INTERMEDIATES } from "./config.js";
import {
  resolveItem, itemDisplayName, recipeNeedsTable, recipeAvailable,
  pickRecipe, howManyCanMake,
} from "./recipes.js";
import { ensureTable } from "./table.js";
import { countOf } from "../inventory/read.js";

function countById(itemId) {
  const bot = getBot();
  if (!bot || !bot.inventory) return 0;
  try { return bot.inventory.count(itemId, null); } catch { return 0; }
}

async function makeIntermediate(word, needCount) {
  const bot = getBot();
  const item = resolveItem(word);
  if (!item) return false;
  if (countById(item.id) >= needCount) return true;

  const recipe = pickRecipe(item, false);
  if (!recipe) return false;
  const per = recipe.result && recipe.result.count ? recipe.result.count : 1;
  const times = Math.max(1, Math.ceil((needCount - countById(item.id)) / per));
  try {
    await Promise.race([
      bot.craft(recipe, times, null),
      delay(CRAFT_TIMEOUT_MS).then(() => { throw new Error("timed out"); }),
    ]);
    await delay(POST_CRAFT_WAIT_MS);
    return countById(item.id) >= needCount;
  } catch (e) {
    log.warn(`intermediate craft (${word}) failed: ${e.message}`);
    return false;
  }
}

async function tryAutoIntermediates() {
  for (const step of INTERMEDIATES) {
    const haveMaterial = countOf(step.from);
    if (haveMaterial > 0) {
      await makeIntermediate(step.make, haveMaterial * 4);
    }
  }
}

export async function craftItem(word, count) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  if (!word) return { ok: false, reason: "what should i make?" };

  const item = resolveItem(word);
  if (!item) return { ok: false, reason: `i don't know how to make ${word}` };
  const name = itemDisplayName(item);
  const want = Number.isFinite(count) && count > 0 ? count : 1;

  let needsTable = recipeNeedsTable(item);
  let canNow = recipeAvailable(item, needsTable);

  if (!canNow) {
    await tryAutoIntermediates();
    needsTable = recipeNeedsTable(item);
    canNow = recipeAvailable(item, needsTable);
  }

  let tableBlock = null;
  if (needsTable) {
    const t = await ensureTable();
    if (!t.ok) {
      if (!recipeAvailable(item, false)) return { ok: false, reason: t.reason };
      needsTable = false;
    } else {
      tableBlock = t.block;
    }
  }

  if (!recipeAvailable(item, needsTable)) {
    await tryAutoIntermediates();
  }

  const recipe = pickRecipe(item, needsTable);
  if (!recipe) return { ok: false, reason: `i don't have the materials to make ${name}` };

  const per = recipe.result && recipe.result.count ? recipe.result.count : 1;
  const maxMakeable = howManyCanMake(item, needsTable);
  if (maxMakeable <= 0) return { ok: false, reason: `i don't have the materials to make ${name}` };

  const targetUnits = Math.min(want, maxMakeable);
  const times = Math.max(1, Math.ceil(targetUnits / per));

  const before = countById(item.id);
  try {
    await Promise.race([
      bot.craft(recipe, times, tableBlock || null),
      delay(CRAFT_TIMEOUT_MS).then(() => { throw new Error("craft timed out"); }),
    ]);
    await delay(POST_CRAFT_WAIT_MS);
  } catch (e) {
    log.warn(`craft ${name} failed: ${e.message}`);
    const made = countById(item.id) - before;
    if (made > 0) return { ok: true, reason: `made ${made}x ${name}` };
    return { ok: false, reason: `couldn't craft ${name} (${e.message})` };
  }

  const made = countById(item.id) - before;
  if (made <= 0) return { ok: false, reason: `tried to craft ${name} but nothing came out` };
  const short = made < want ? ` (could only make ${made})` : "";
  return { ok: true, reason: `crafted ${made}x ${name}${short}` };
}
