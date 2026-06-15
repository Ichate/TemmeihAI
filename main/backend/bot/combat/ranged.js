import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { distanceTo } from "./targeting.js";
import { BOW_CHARGE_MS, BOW_MAX_RANGE } from "./config.js";

export function hasBow() {
  const bot = getBot();
  if (!bot || !bot.inventory) return false;
  return bot.inventory.items().some(it => /^bow$|crossbow/.test(it.name));
}

export function hasArrows() {
  const bot = getBot();
  if (!bot || !bot.inventory) return false;
  return bot.inventory.items().some(it => /arrow/.test(it.name));
}

export function canShoot() {
  return hasBow() && hasArrows();
}

async function equipBow() {
  const bot = getBot();
  if (!bot || !bot.inventory) return false;
  const bow = bot.inventory.items().find(it => /^bow$/.test(it.name))
    || bot.inventory.items().find(it => /crossbow/.test(it.name));
  if (!bow) return false;
  try {
    if (bot.heldItem && bot.heldItem.name === bow.name) return true;
    await bot.equip(bow, "hand");
    return true;
  } catch (e) {
    log.warn(`bow equip failed: ${e.message}`);
    return false;
  }
}

function aimPoint(target) {
  if (!target || !target.position) return null;
  const headOff = target.height ? target.height * 0.9 : 1.6;
  const base = target.position.offset(0, headOff, 0);
  const bot = getBot();
  if (!bot || !bot.entity) return base;

  const dist = bot.entity.position.distanceTo(base);
  const drop = Math.min(3, dist * 0.05);

  let lead = base;
  if (target.velocity) {
    const t = dist / 30;
    lead = base.offset(target.velocity.x * t * 20, target.velocity.y * t * 20, target.velocity.z * t * 20);
  }
  return lead.offset(0, drop, 0);
}

export async function shootAt(target) {
  const bot = getBot();
  if (!bot || !target || !target.position) return { ok: false, reason: "no target" };
  if (distanceTo(target) > BOW_MAX_RANGE) return { ok: false, reason: "too far for a bow shot" };
  if (!canShoot()) return { ok: false, reason: "no bow or arrows" };

  if (!await equipBow()) return { ok: false, reason: "couldn't ready the bow" };

  const aim = aimPoint(target);
  if (aim) {
    try { await bot.lookAt(aim, true); } catch {}
  }

  try {
    bot.activateItem();
    await delay(BOW_CHARGE_MS);
    const aim2 = aimPoint(target);
    if (aim2) { try { await bot.lookAt(aim2, true); } catch {} }
    bot.deactivateItem();
    return { ok: true, reason: "loosed an arrow" };
  } catch (e) {
    log.warn(`shoot failed: ${e.message}`);
    try { bot.deactivateItem(); } catch {}
    return { ok: false, reason: "bow shot failed" };
  }
}

export function stopDrawing() {
  const bot = getBot();
  if (!bot) return;
  try { bot.deactivateItem(); } catch {}
}

export async function kiteBack(target) {
  const bot = getBot();
  if (!bot || !bot.entity || !target || !target.position) return;
  try {
    const off = target.height ? target.height * 0.9 : 1.6;
    await bot.lookAt(target.position.offset(0, off, 0), true);
    bot.setControlState("forward", false);
    bot.setControlState("back", true);
    setTimeout(() => { try { bot.setControlState("back", false); } catch {} }, 400);
  } catch {}
}

export function stopKite() {
  const bot = getBot();
  if (!bot) return;
  try { bot.setControlState("back", false); } catch {}
}
