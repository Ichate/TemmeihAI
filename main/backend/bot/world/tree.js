import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { TREE_MAX, TREE_PILLAR_BLOCK, LOG_NAMES, FIND_SCAN_RADIUS } from "./config.js";
import { blockName, resolveTargetBlock, findBlockByName } from "./blocks.js";
import { mineBlock } from "./mine.js";
import { reachBlock } from "./reach.js";
import { collectNearbyDrops } from "./collect.js";
import { workTick, waitOutCombat } from "./workguard.js";
import { findItems } from "../inventory/read.js";

function isLog(block) {
  return !!(block && block.name && LOG_NAMES.test(block.name.toLowerCase()));
}

function keyOf(pos) {
  return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
}

async function pillarUp() {
  const bot = getBot();
  if (!bot || !bot.entity) return false;
  let block = null;
  for (const name of TREE_PILLAR_BLOCK) {
    const m = findItems(name)[0];
    if (m) { block = m; break; }
  }
  if (!block) return false;
  try {
    await bot.equip(block, "hand");
    const ref = bot.blockAt(bot.entity.position.offset(0, -1, 0));
    if (!ref) return false;
    bot.setControlState("jump", true);
    await delay(120);
    try { await bot.placeBlock(ref, bot.entity.position.constructor ? new bot.entity.position.constructor(0, 1, 0) : { x: 0, y: 1, z: 0 }); } catch {}
    bot.setControlState("jump", false);
    await delay(200);
    return true;
  } catch (e) {
    try { bot.setControlState("jump", false); } catch {}
    log.warn(`pillar up failed: ${e.message}`);
    return false;
  }
}

export async function chopTree(word) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };

  let start = word ? findBlockByName(word, FIND_SCAN_RADIUS) : resolveTargetBlock(null);
  if (!start || !isLog(start)) {
    const anyLog = findBlockByName("log", FIND_SCAN_RADIUS);
    if (anyLog) start = anyLog;
  }
  if (!start || !isLog(start)) return { ok: false, reason: "i don't see a tree nearby" };

  const Vec = bot.entity.position.constructor;
  const queue = [start.position];
  const seen = new Set([keyOf(start.position)]);
  let chopped = 0;

  while (queue.length && chopped < TREE_MAX) {
    const guard = await workTick();
    if (guard.stop) {
      await collectNearbyDrops();
      return chopped > 0 ? { ok: true, reason: `chopped ${chopped} logs, ${guard.reason}` } : { ok: false, reason: guard.reason };
    }
    if (guard.pause) { await waitOutCombat(); continue; }

    const pos = queue.shift();
    const block = bot.blockAt(pos);
    if (!isLog(block)) continue;

    const reached = await reachBlock(block);
    if (!reached.ok) {
      const dy = Math.floor(pos.y) - Math.floor(bot.entity.position.y);
      if (dy >= 2) {
        const pillared = await pillarUp();
        if (!pillared) continue;
      } else {
        continue;
      }
    }

    const r = await mineBlock(block);
    if (!r.ok) continue;
    chopped += 1;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const np = new Vec(Math.floor(pos.x) + dx, Math.floor(pos.y) + dy, Math.floor(pos.z) + dz);
          const k = keyOf(np);
          if (seen.has(k)) continue;
          seen.add(k);
          const nb = bot.blockAt(np);
          if (isLog(nb)) queue.push(np);
        }
      }
    }
    if (!getBot()) return { ok: false, reason: "not in game" };
  }

  await collectNearbyDrops();
  if (chopped === 0) return { ok: false, reason: "couldn't chop the tree" };
  return { ok: true, reason: `chopped the whole tree, ${chopped} logs` };
}
