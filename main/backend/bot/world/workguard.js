import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { WORK_EAT_HUNGER, WORK_FLEE_HEALTH } from "./config.js";
import { inventory } from "../inventory/index.js";
import { combat } from "../combat/index.js";

export function inventoryFull() {
  const bot = getBot();
  if (!bot || !bot.inventory) return false;
  try {
    const empty = bot.inventory.emptySlotCount;
    return typeof empty === "number" && empty <= 0;
  } catch {
    return false;
  }
}

export async function workTick() {
  const bot = getBot();
  if (!bot || !bot.entity) return { stop: true, reason: "not in game" };

  if (bot.health != null && bot.health <= WORK_FLEE_HEALTH) {
    return { stop: true, reason: "too hurt to keep working" };
  }

  if (combat.inCombat && combat.inCombat()) {
    return { pause: true, reason: "fighting first" };
  }

  if (bot.food != null && bot.food <= WORK_EAT_HUNGER) {
    try { await inventory.eatBestFood(); } catch {}
  }

  if (inventoryFull()) {
    return { stop: true, reason: "my inventory's full" };
  }

  return { stop: false };
}

export async function waitOutCombat(maxMs = 8000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (!combat.inCombat || !combat.inCombat()) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}
