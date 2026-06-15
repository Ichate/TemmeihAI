import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { versionInfo } from "./version.js";
import { shouldHeal, shouldEat, critical } from "./threat.js";
import { inventory } from "../inventory/index.js";
import { movement } from "../movement/index.js";

let lastHealAttempt = 0;
let blocking = false;

export function hasShield() {
  const bot = getBot();
  if (!bot || !bot.inventory) return false;
  return bot.inventory.items().some(it => /shield/.test(it.name));
}

export async function readyShield() {
  const bot = getBot();
  if (!bot || !versionInfo().supportsShieldBlock) return false;
  if (!hasShield()) return false;
  const shield = bot.inventory.items().find(it => /shield/.test(it.name));
  if (!shield) return false;
  try {
    const off = bot.inventory.slots ? bot.inventory.slots[45] : null;
    if (!off || !/shield/.test(off.name)) {
      await bot.equip(shield, "off-hand");
    }
    return true;
  } catch (e) {
    log.warn(`shield ready failed: ${e.message}`);
    return false;
  }
}

export function startBlock() {
  const bot = getBot();
  if (!bot || !versionInfo().supportsShieldBlock) return;
  try { bot.activateItem(true); blocking = true; } catch {}
}

export function stopBlock() {
  const bot = getBot();
  if (!bot || !blocking) return;
  try { bot.deactivateItem(); } catch {}
  blocking = false;
}

export async function tryTotem() {
  if (!critical()) return false;
  const bot = getBot();
  if (!bot || !versionInfo().supportsOffhand) return false;
  const r = await inventory.holdTotem();
  return !!(r && r.ok);
}

export async function tryHealOrEat() {
  const now = Date.now();
  if (now - lastHealAttempt < 2500) return false;

  if (critical()) {
    await tryTotem();
  }

  if (shouldHeal()) {
    lastHealAttempt = now;
    const bot = getBot();
    const hasGap = bot && bot.inventory && bot.inventory.items().some(it => /golden_apple/.test(it.name));
    if (hasGap) {
      const r = await inventory.useNamed("golden_apple");
      if (r && r.ok) return true;
    }
    const pot = bot && bot.inventory && bot.inventory.items().some(it => /potion/.test(it.name));
    if (pot) {
      const r = await inventory.useNamed("potion");
      if (r && r.ok) return true;
    }
  }

  if (shouldEat() && !state.eating) {
    lastHealAttempt = now;
    const r = await inventory.eatBestFood();
    return !!(r && r.ok);
  }

  return false;
}

export async function fleeFromTarget(target) {
  const pos = target && target.position ? target.position : null;
  return movement.fleeFrom(pos, { retreat: true, label: "losing the fight" });
}

export function shouldRaiseShield(target) {
  const bot = getBot();
  if (!bot || !bot.entity || !versionInfo().supportsShieldBlock || !hasShield()) return false;
  if (!target || !target.position) return false;
  const name = (target.name || target.displayName || "").toLowerCase();
  const dist = bot.entity.position.distanceTo(target.position);
  if (/skeleton|stray|bogged|pillager/.test(name) && dist > 3 && dist < 18) return true;
  if (/blaze|ghast|witch/.test(name) && dist < 18) return true;
  return false;
}

export async function reactiveBlock(target) {
  if (shouldRaiseShield(target)) {
    await readyShield();
    startBlock();
    return true;
  }
  stopBlock();
  return false;
}

let lastCreeperStrike = 0;

export function creeperHissing(creeper) {
  if (!creeper) return false;
  if (typeof creeper.metadata === "object" && creeper.metadata) {
    for (const m of creeper.metadata) {
      if (m && (m === 1 || m === true)) return true;
    }
  }
  return false;
}

export function creeperStrikeReady() {
  return Date.now() - lastCreeperStrike >= 1600;
}

export function markCreeperStrike() {
  lastCreeperStrike = Date.now();
}

export function resetDefense() {
  stopBlock();
  lastHealAttempt = 0;
  lastCreeperStrike = 0;
}
