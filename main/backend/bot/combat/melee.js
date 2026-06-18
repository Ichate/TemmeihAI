import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { isSpamStyle } from "./version.js";
import { distanceTo } from "./targeting.js";
import {
  MELEE_RANGE, ATTACK_COOLDOWN_MS, SPAM_ATTACK_MS, CRIT_JUMP_GAP_MS,
} from "./config.js";

let lastAttack = 0;
let lastCritJump = 0;
let strafeDir = 1;
let lastStrafeFlip = 0;

export function inMeleeRange(target) {
  return distanceTo(target) <= MELEE_RANGE;
}

export async function faceTarget(target) {
  const bot = getBot();
  if (!bot || !target || !target.position) return;
  const off = target.height ? target.height * 0.9 : 1.6;
  try { await bot.lookAt(target.position.offset(0, off, 0), true); } catch {}
}

function attackReady() {
  const gap = isSpamStyle() ? SPAM_ATTACK_MS : ATTACK_COOLDOWN_MS;
  return Date.now() - lastAttack >= gap;
}

function cooldownProgress() {
  const bot = getBot();
  if (isSpamStyle()) return 1;
  try {
    if (typeof bot.getEquipmentDestSlot === "function" && bot.entity && typeof bot.attackCooldown === "number") {
      return bot.attackCooldown;
    }
  } catch {}
  return Date.now() - lastAttack >= ATTACK_COOLDOWN_MS ? 1 : 0;
}

export function wantsCrit() {
  const bot = getBot();
  if (!bot || !bot.entity) return false;
  if (bot.entity.isInWater || bot.entity.onGround === false) return false;
  return Date.now() - lastCritJump >= CRIT_JUMP_GAP_MS;
}

async function critJump() {
  const bot = getBot();
  if (!bot) return;
  lastCritJump = Date.now();
  try {
    bot.setControlState("jump", true);
    setTimeout(() => { try { bot.setControlState("jump", false); } catch {} }, 120);
  } catch {}
}

function holdingMace() {
  const bot = getBot();
  try { return !!(bot && bot.heldItem && /mace/.test(bot.heldItem.name)); } catch { return false; }
}

async function maceSmash() {
  const bot = getBot();
  if (!bot) return;
  lastCritJump = Date.now();
  try {
    bot.setControlState("jump", true);
    setTimeout(() => { try { bot.setControlState("jump", false); } catch {} }, 220);
  } catch {}
}

export async function swingAt(target) {
  const bot = getBot();
  if (!bot || !target) return false;
  if (!attackReady()) return false;
  if (!inMeleeRange(target)) return false;

  await faceTarget(target);

  const mace = holdingMace();
  if (mace && bot.entity.onGround && Date.now() - lastCritJump >= CRIT_JUMP_GAP_MS) {
    await maceSmash();
    await new Promise(r => setTimeout(r, 320));
    await faceTarget(target);
  } else if (!isSpamStyle() && wantsCrit() && bot.entity.onGround) {
    await critJump();
    await new Promise(r => setTimeout(r, 250));
    await faceTarget(target);
  }

  try {
    bot.attack(target);
    lastAttack = Date.now();
    return true;
  } catch (e) {
    log.warn(`attack failed: ${e.message}`);
    return false;
  }
}

export function strafeStep(target) {
  const bot = getBot();
  if (!bot || !bot.entity || !target || !target.position) return;

  const now = Date.now();
  if (now - lastStrafeFlip > 1400) {
    strafeDir = Math.random() < 0.5 ? 1 : -1;
    lastStrafeFlip = now;
  }

  try {
    bot.setControlState("left", strafeDir === 1);
    bot.setControlState("right", strafeDir === -1);
    setTimeout(() => {
      try {
        bot.setControlState("left", false);
        bot.setControlState("right", false);
      } catch {}
    }, 250);
  } catch {}
}

export function targetFleeing(target) {
  if (!target || !target.velocity) return false;
  const v = target.velocity;
  const speed = Math.sqrt(v.x * v.x + v.z * v.z);
  return speed > 0.08;
}

export function gapClose(target) {
  const bot = getBot();
  if (!bot || !bot.entity || !target || !target.position) return;
  try {
    bot.setControlState("sprint", true);
    if (bot.entity.onGround) {
      bot.setControlState("jump", true);
      setTimeout(() => { try { bot.setControlState("jump", false); } catch {} }, 120);
    }
  } catch {}
}

export function stopGapClose() {
  const bot = getBot();
  if (!bot) return;
  try { bot.setControlState("sprint", false); } catch {}
}

export function resetMeleeState() {
  lastAttack = 0;
  lastCritJump = 0;
  lastStrafeFlip = 0;
  const bot = getBot();
  if (bot) {
    try {
      bot.setControlState("left", false);
      bot.setControlState("right", false);
      bot.setControlState("jump", false);
    } catch {}
  }
}
