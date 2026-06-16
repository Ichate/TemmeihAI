import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { movement } from "../movement/index.js";
import { REACH_DISTANCE, REACH_GOAL_TOLERANCE, REACH_TIMEOUT_MS } from "./config.js";

export function blockCenter(block) {
  if (!block || !block.position) return null;
  const p = block.position;
  return { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 };
}

export function distanceToBlock(block) {
  const bot = getBot();
  if (!bot || !bot.entity || !block || !block.position) return Infinity;
  const c = blockCenter(block);
  return bot.entity.position.distanceTo(bot.entity.position.constructor
    ? new bot.entity.position.constructor(c.x, c.y, c.z)
    : c);
}

export function inReach(block) {
  return distanceToBlock(block) <= REACH_DISTANCE;
}

export async function faceBlock(block) {
  const bot = getBot();
  if (!bot || !block || !block.position) return false;
  const c = blockCenter(block);
  try {
    await bot.lookAt(new bot.entity.position.constructor(c.x, c.y, c.z), true);
    return true;
  } catch (e) {
    log.warn(`faceBlock failed: ${e.message}`);
    return false;
  }
}

export async function reachBlock(block) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  if (!block || !block.position) return { ok: false, reason: "no block there" };

  if (inReach(block)) {
    await faceBlock(block);
    return { ok: true, reason: "in reach" };
  }

  const c = blockCenter(block);
  let arrived = false;
  try {
    const r = await Promise.race([
      movement.gotoCoords(c.x, c.y, c.z, { tolerance: REACH_GOAL_TOLERANCE, label: "the block", mode: "goto" }),
      delay(REACH_TIMEOUT_MS).then(() => ({ ok: false, timeout: true })),
    ]);
    arrived = !!(r && r.ok);
  } catch {
    arrived = false;
  }

  const deadline = Date.now() + REACH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (inReach(block)) { arrived = true; break; }
    await delay(200);
    if (!getBot()) return { ok: false, reason: "not in game" };
  }

  if (!inReach(block)) {
    return { ok: false, reason: "couldn't get close enough to it" };
  }
  await faceBlock(block);
  return { ok: true, reason: "in reach" };
}
