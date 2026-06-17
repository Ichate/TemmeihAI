import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { CRAFT_TIMEOUT_MS, POST_CRAFT_WAIT_MS } from "./config.js";
import {
  resolveItem, itemDisplayName, recipeNeedsTable, recipeAvailable,
  pickRecipe, howManyCanMake, mcData,
} from "./recipes.js";
import { ensureTable } from "./table.js";
import { planCraft } from "./tree.js";
import { smeltInto } from "./smelt-step.js";

function countById(itemId) {
  const bot = getBot();
  if (!bot || !bot.inventory || itemId == null) return 0;
  try { return bot.inventory.count(itemId, null); } catch { return 0; }
}

function itemById(id) {
  const data = mcData();
  if (!data || id == null) return null;
  try {
    if (data.items && data.items[id]) return data.items[id];
    if (data.itemsArray) return data.itemsArray.find(it => it.id === id) || null;
  } catch {}
  return null;
}

async function craftRecipeRaw(item, times, tableBlock) {
  const bot = getBot();
  const recipe = pickRecipe(item, !!tableBlock);
  if (!recipe) return 0;
  const per = recipe.result && recipe.result.count ? recipe.result.count : 1;
  const before = countById(item.id);
  try {
    await Promise.race([
      bot.craft(recipe, times, tableBlock || null),
      delay(CRAFT_TIMEOUT_MS).then(() => { throw new Error("timed out"); }),
    ]);
    await delay(POST_CRAFT_WAIT_MS);
  } catch (e) {
    log.warn(`craft step failed: ${e.message}`);
  }
  return countById(item.id) - before;
}

async function runPlan(plan, tableBlock) {
  if (!plan || !plan.steps) return true;
  for (const step of plan.steps) {
    if (!getBot()) return false;
    if (step.kind === "smelt") {
      const r = await smeltInto(step.name, step.count);
      if (!r.ok || r.made < step.count) {
        if (countById(step.id) < step.count) return false;
      }
    } else if (step.kind === "craft") {
      const subItem = itemById(step.id);
      if (!subItem) return false;
      const need = step.times * step.per;
      const have = countById(step.id);
      if (have >= need) continue;
      const made = await craftRecipeRaw(subItem, step.times, tableBlock);
      if (made <= 0 && countById(step.id) < need) return false;
    }
  }
  return true;
}

export async function craftItem(word, count, opts = {}) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  if (!word) return { ok: false, reason: "what should i make?" };

  const item = resolveItem(word);
  if (!item) return { ok: false, reason: `i don't know how to make ${word}` };
  const name = itemDisplayName(item);
  const want = Number.isFinite(count) && count > 0 ? count : 1;

  let needsTable = recipeNeedsTable(item);
  let tableBlock = null;

  if (needsTable) {
    const t = await ensureTable();
    if (t.ok) {
      tableBlock = t.block;
    } else if (!recipeAvailable(item, false)) {
      const plan = planCraft(item, want, true);
      if (!plan.ok) return { ok: false, reason: t.reason };
    } else {
      needsTable = false;
    }
  }

  if (!recipeAvailable(item, needsTable) || howManyCanMake(item, needsTable) < want) {
    const plan = planCraft(item, want, needsTable);
    if (!plan.ok) {
      return { ok: false, reason: `i can't make ${name}: ${plan.reason}` };
    }
    const ran = await runPlan(plan, tableBlock);
    if (!ran && !recipeAvailable(item, needsTable)) {
      return { ok: false, reason: `i couldn't get all the materials for ${name}` };
    }
    if (needsTable && !tableBlock) {
      const t2 = await ensureTable();
      if (t2.ok) tableBlock = t2.block;
    }
  }

  const recipe = pickRecipe(item, needsTable);
  if (!recipe) return { ok: false, reason: `i don't have the materials to make ${name}` };

  const per = recipe.result && recipe.result.count ? recipe.result.count : 1;
  const maxMakeable = howManyCanMake(item, needsTable);
  if (maxMakeable <= 0) return { ok: false, reason: `i don't have the materials to make ${name}` };

  const targetUnits = Math.min(want, maxMakeable);
  const times = Math.max(1, Math.ceil(targetUnits / per));

  const before = countById(item.id);
  const made = await craftRecipeRaw(item, times, tableBlock);

  if (made <= 0 && countById(item.id) <= before) {
    return { ok: false, reason: `tried to craft ${name} but nothing came out` };
  }
  const total = countById(item.id) - before;
  const short = total < want ? ` (could only make ${total})` : "";
  return { ok: true, reason: `crafted ${total}x ${name}${short}` };
}
