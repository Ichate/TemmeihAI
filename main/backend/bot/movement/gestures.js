import { getBot } from "../ctx.js";
import { delay } from "../cooldowns.js";
import { faceYaw, jumpOnce, setSneak } from "./actions.js";
import { GESTURE_GAP_MS } from "./config.js";

function currentYaw() {
  const bot = getBot();
  return bot && bot.entity ? bot.entity.yaw : 0;
}

function currentPitch() {
  const bot = getBot();
  return bot && bot.entity ? bot.entity.pitch : 0;
}

export async function turnAround() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  await faceYaw(currentYaw() + Math.PI, currentPitch());
  return { ok: true, reason: "turned around" };
}

export async function lookBehind() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  const startYaw = currentYaw();
  const startPitch = currentPitch();
  await faceYaw(startYaw + Math.PI, 0);
  await delay(700);
  await faceYaw(startYaw, startPitch);
  return { ok: true, reason: "looked behind" };
}

export async function wave() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  const yaw = currentYaw();
  for (let i = 0; i < 3; i++) {
    await faceYaw(yaw - 0.4, -0.3);
    await delay(GESTURE_GAP_MS);
    await faceYaw(yaw + 0.4, -0.3);
    await delay(GESTURE_GAP_MS);
  }
  await faceYaw(yaw, 0);
  return { ok: true, reason: "waved" };
}

export async function nod() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  const yaw = currentYaw();
  for (let i = 0; i < 2; i++) {
    await faceYaw(yaw, 0.6);
    await delay(GESTURE_GAP_MS);
    await faceYaw(yaw, -0.2);
    await delay(GESTURE_GAP_MS);
  }
  await faceYaw(yaw, 0);
  return { ok: true, reason: "nodded" };
}

export async function shakeHead() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  const yaw = currentYaw();
  for (let i = 0; i < 2; i++) {
    await faceYaw(yaw - 0.5, 0);
    await delay(GESTURE_GAP_MS);
    await faceYaw(yaw + 0.5, 0);
    await delay(GESTURE_GAP_MS);
  }
  await faceYaw(yaw, 0);
  return { ok: true, reason: "shook my head" };
}

export async function bow() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  const yaw = currentYaw();
  setSneak(true);
  await faceYaw(yaw, 0.9);
  await delay(800);
  await faceYaw(yaw, 0);
  setSneak(false);
  return { ok: true, reason: "bowed" };
}

export async function celebrate() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  for (let i = 0; i < 3; i++) {
    await jumpOnce();
    await delay(200);
  }
  return { ok: true, reason: "celebrated" };
}
