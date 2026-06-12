import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { SPEED } from "./config.js";

const CONTROLS = ["forward", "back", "left", "right", "jump", "sprint", "sneak"];

export function clearControls() {
  const bot = getBot();
  if (!bot) return;
  for (const c of CONTROLS) {
    try { bot.setControlState(c, false); } catch {}
  }
}

export function setControl(name, value) {
  const bot = getBot();
  if (!bot) return;
  try { bot.setControlState(name, !!value); } catch {}
}

export async function jumpOnce() {
  const bot = getBot();
  if (!bot) return;
  try {
    bot.setControlState("jump", true);
    await delay(250);
    bot.setControlState("jump", false);
  } catch {}
}

export async function jumpTimes(count = 1, gap = 350) {
  for (let i = 0; i < count; i++) {
    await jumpOnce();
    if (i < count - 1) await delay(gap);
  }
}

export function startSprint() {
  setControl("sprint", true);
}

export function stopSprint() {
  setControl("sprint", false);
}

export async function sneakFor(ms = 1000) {
  const bot = getBot();
  if (!bot) return;
  try {
    bot.setControlState("sneak", true);
    await delay(ms);
    bot.setControlState("sneak", false);
  } catch {}
}

export function setSneak(value) {
  setControl("sneak", value);
}

export async function lookAtPosition(pos, force = true) {
  const bot = getBot();
  if (!bot || !pos) return;
  try {
    await bot.lookAt(pos, force);
  } catch {}
}

export async function lookAtEntity(entity, force = true) {
  if (!entity || !entity.position) return;
  const offset = entity.height ? entity.height * 0.9 : 1.6;
  await lookAtPosition(entity.position.offset(0, offset, 0), force);
}

export async function faceYaw(yaw, pitch = 0) {
  const bot = getBot();
  if (!bot) return;
  try { await bot.look(yaw, pitch, true); } catch {}
}

export async function swimUp(ms = 600) {
  const bot = getBot();
  if (!bot) return;
  try {
    bot.setControlState("jump", true);
    await delay(ms);
    bot.setControlState("jump", false);
  } catch {}
}

export function isInLiquid() {
  const bot = getBot();
  if (!bot || !bot.entity) return false;
  return !!(bot.entity.isInWater || bot.entity.isInLava);
}

export function isOnGround() {
  const bot = getBot();
  return !!(bot && bot.entity && bot.entity.onGround);
}

export async function stopAllActions() {
  const bot = getBot();
  if (bot && bot.pathfinder) {
    try { bot.pathfinder.setGoal(null); } catch {}
  }
  clearControls();
}

export function distanceTo(pos) {
  const bot = getBot();
  if (!bot || !bot.entity || !pos) return Infinity;
  return bot.entity.position.distanceTo(pos);
}

export function botPosition() {
  const bot = getBot();
  return bot && bot.entity ? bot.entity.position : null;
}

export async function unstuckNudge() {
  const bot = getBot();
  if (!bot) return;
  log.info("movement: nudging to break stuck state");
  try {
    const yaw = Math.random() * Math.PI * 2;
    await faceYaw(yaw, 0);
    bot.setControlState("forward", true);
    bot.setControlState("jump", true);
    await delay(500);
    bot.setControlState("jump", false);
    await delay(300);
    bot.setControlState("forward", false);
  } catch {}
}

export function applySpeed(speed) {
  void speed;
}

export function applyPathfinderSpeed(speed) {
  const bot = getBot();
  if (!bot || !bot.pathfinder || !bot.pathfinder.movements) return;
  const m = bot.pathfinder.movements;
  try {
    m.allowSprinting = speed === SPEED.SPRINT;
  } catch {}
}

export function needsAir() {
  const bot = getBot();
  if (!bot || bot.oxygenLevel == null) return false;
  return bot.entity && bot.entity.isInWater && bot.oxygenLevel <= 6;
}

export async function surfaceForAir(ms = 800) {
  const bot = getBot();
  if (!bot) return;
  try {
    bot.setControlState("jump", true);
    await delay(ms);
    bot.setControlState("jump", false);
  } catch {}
}

export async function lookAround(sweeps = 3) {
  const bot = getBot();
  if (!bot) return;
  try {
    const startYaw = bot.entity ? bot.entity.yaw : 0;
    for (let i = 0; i < sweeps; i++) {
      const yaw = startYaw + (i + 1) * (Math.PI * 2 / (sweeps + 1));
      const pitch = (Math.random() - 0.5) * 0.4;
      await faceYaw(yaw, pitch);
      await delay(400 + Math.random() * 400);
    }
  } catch {}
}
