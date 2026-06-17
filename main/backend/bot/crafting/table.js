import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { CRAFTING_TABLE, TABLE_REACH, TABLE_SCAN_RADIUS } from "./config.js";
import { resolveItem, pickRecipe } from "./recipes.js";
import { findItems } from "../inventory/read.js";

let selfPlaced = null;

export function findTable() {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.findBlock) return null;
  try {
    return bot.findBlock({
      point: bot.entity.position,
      maxDistance: TABLE_SCAN_RADIUS,
      matching: (b) => b && b.name === CRAFTING_TABLE,
    });
  } catch {
    return null;
  }
}

export async function reclaimSelfTable() {
  const bot = getBot();
  if (!bot || !selfPlaced) return;
  const pos = selfPlaced;
  selfPlaced = null;
  try {
    const block = bot.blockAt(pos);
    if (block && block.name === CRAFTING_TABLE) {
      const { world } = await import("../world/index.js");
      await world.mineBlock(block);
    }
  } catch {}
}

export function haveTableItem() {
  return findItems(CRAFTING_TABLE).length > 0;
}

export async function reachTable(block) {
  const bot = getBot();
  if (!bot || !bot.entity || !block || !block.position) return false;
  const p = block.position;
  if (bot.entity.position.distanceTo(p.offset(0.5, 0.5, 0.5)) <= TABLE_REACH) return true;
  try {
    const { movement } = await import("../movement/index.js");
    await Promise.race([
      movement.gotoCoords(p.x + 0.5, p.y, p.z + 0.5, { tolerance: 2, label: "the crafting table", mode: "goto" }),
      delay(10000),
    ]);
  } catch {}
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (!getBot()) return false;
    if (bot.entity.position.distanceTo(p.offset(0.5, 0.5, 0.5)) <= TABLE_REACH) return true;
    await delay(200);
  }
  return bot.entity.position.distanceTo(p.offset(0.5, 0.5, 0.5)) <= TABLE_REACH;
}

async function craftTableItem() {
  const bot = getBot();
  if (!bot) return false;
  if (haveTableItem()) return true;
  const item = resolveItem(CRAFTING_TABLE);
  if (!item) return false;
  const recipe = pickRecipe(item, false);
  if (!recipe) return false;
  try {
    await bot.craft(recipe, 1, null);
    await delay(200);
    return haveTableItem();
  } catch (e) {
    log.warn(`craft table item failed: ${e.message}`);
    return false;
  }
}

export async function ensureTable() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game", block: null };

  const existing = findTable();
  if (existing) {
    const reached = await reachTable(existing);
    if (reached) return { ok: true, reason: "at a table", block: existing };
  }

  if (!haveTableItem()) {
    const made = await craftTableItem();
    if (!made) return { ok: false, reason: "no crafting table and i can't make one (need planks)", block: null };
  }

  const { world } = await import("../world/index.js");
  const placed = await world.placeBlock(CRAFTING_TABLE, null);
  if (!placed.ok) return { ok: false, reason: "couldn't place a crafting table", block: null };

  await delay(300);
  const fresh = findTable();
  if (!fresh) return { ok: false, reason: "placed a table but lost track of it", block: null };
  const reached = await reachTable(fresh);
  if (!reached) return { ok: false, reason: "couldn't get to the table i placed", block: null };
  selfPlaced = fresh.position;
  return { ok: true, reason: "made and placed a table", block: fresh, placed: true };
}
