import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { TOOL_FOR_MATERIAL, MINE_TIMEOUT_MS, COLLECT_WAIT_MS, FIND_SCAN_RADIUS, VEIN_MAX, AREA_MAX } from "./config.js";
import { blockName, resolveTargetBlock, findBlockByName } from "./blocks.js";
import { reachBlock } from "./reach.js";
import { safeToMine } from "./safety.js";
import { bestByTier } from "../inventory/match.js";
import { inventory } from "../inventory/index.js";
import { collectNearbyDrops } from "./collect.js";
import { workTick, waitOutCombat } from "./workguard.js";

function toolKindFor(name) {
  for (const rule of TOOL_FOR_MATERIAL) {
    if (rule.match.test(name)) return rule.tool;
  }
  return null;
}

async function equipToolFor(block) {
  const bot = getBot();
  if (!bot || !bot.inventory) return;
  const kind = toolKindFor(blockName(block));
  if (!kind) return;
  const pool = bot.inventory.items().filter(it => it.name.endsWith(`_${kind}`) || it.name === kind);
  if (!pool.length) return;
  const best = bestByTier(pool);
  try {
    if (!bot.heldItem || bot.heldItem.name !== best.name) {
      await bot.equip(best, "hand");
    }
  } catch (e) {
    log.warn(`tool equip failed: ${e.message}`);
  }
}

export async function mineBlock(block) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  if (!block || !block.position) return { ok: false, reason: "no block to mine" };

  const name = blockName(block);
  const safe = safeToMine(block);
  if (!safe.ok) return safe;

  const reached = await reachBlock(block);
  if (!reached.ok) return reached;

  const current = bot.blockAt(block.position);
  if (!current || current.name !== block.name) {
    return { ok: false, reason: "the block's not there anymore" };
  }

  await equipToolFor(current);

  if (!bot.canDigBlock || !bot.canDigBlock(current)) {
    const stillThere = bot.blockAt(block.position);
    if (stillThere && stillThere.name === "air") return { ok: true, reason: `broke the ${name.replace(/_/g, " ")}` };
  }

  try {
    await Promise.race([
      bot.dig(current),
      delay(MINE_TIMEOUT_MS).then(() => { throw new Error("dig timed out"); }),
    ]);
  } catch (e) {
    try { bot.stopDigging(); } catch {}
    const after = bot.blockAt(block.position);
    if (after && after.name === "air") return { ok: true, reason: `broke the ${name.replace(/_/g, " ")}` };
    return { ok: false, reason: `couldn't break the ${name.replace(/_/g, " ")} (${e.message})` };
  }

  await delay(COLLECT_WAIT_MS);
  return { ok: true, reason: `broke the ${name.replace(/_/g, " ")}` };
}

export async function mineLookingAt() {
  const block = resolveTargetBlock(null);
  if (!block) return { ok: false, reason: "i'm not looking at anything to break" };
  return mineBlock(block);
}

export async function mineNamed(word, count) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  if (!word) return mineLookingAt();

  const want = Number.isFinite(count) && count > 0 ? count : 1;
  let broken = 0;
  let lastName = word;

  for (let i = 0; i < want; i++) {
    const block = findBlockByName(word, FIND_SCAN_RADIUS);
    if (!block) {
      if (broken === 0) return { ok: false, reason: `i don't see any ${word} nearby` };
      break;
    }
    lastName = blockName(block);
    const r = await mineBlock(block);
    if (!r.ok) {
      if (broken === 0) return r;
      break;
    }
    broken += 1;
    await delay(150);
    if (!getBot()) return { ok: false, reason: "not in game" };
  }

  if (broken === 0) return { ok: false, reason: `couldn't mine any ${word}` };
  return { ok: true, reason: `mined ${broken}x ${lastName.replace(/_/g, " ")}` };
}

export async function digDown(depth) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  const want = Number.isFinite(depth) && depth > 0 ? Math.min(depth, 16) : 3;
  let dug = 0;
  for (let i = 0; i < want; i++) {
    const Vec = bot.entity.position.constructor;
    const below = new Vec(Math.floor(bot.entity.position.x), Math.floor(bot.entity.position.y) - 1, Math.floor(bot.entity.position.z));
    const block = bot.blockAt(below);
    if (!block || block.name === "air") break;
    const safe = safeToMine(block);
    if (!safe.ok) return dug > 0 ? { ok: true, reason: `dug down ${dug}, stopping: ${safe.reason}` } : safe;
    const r = await mineBlock(block);
    if (!r.ok) break;
    dug += 1;
    await delay(300);
  }
  if (dug === 0) return { ok: false, reason: "nothing safe to dig below me" };
  return { ok: true, reason: `dug down ${dug} block(s)` };
}

function keyOf(pos) {
  return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
}

export async function veinMine(word) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };

  let start = word ? findBlockByName(word, FIND_SCAN_RADIUS) : resolveTargetBlock(null);
  if (!start) return { ok: false, reason: word ? `i don't see any ${word} nearby` : "i'm not looking at anything to mine" };

  const targetName = blockName(start);
  const Vec = bot.entity.position.constructor;
  const queue = [start.position];
  const seen = new Set([keyOf(start.position)]);
  let broken = 0;

  while (queue.length && broken < VEIN_MAX) {
    const guard = await workTick();
    if (guard.stop) return broken > 0 ? { ok: true, reason: `mined ${broken}x ${targetName.replace(/_/g, " ")}, ${guard.reason}` } : { ok: false, reason: guard.reason };
    if (guard.pause) { await waitOutCombat(); continue; }

    const pos = queue.shift();
    const block = bot.blockAt(pos);
    if (!block || blockName(block) !== targetName) continue;

    const r = await mineBlock(block);
    if (!r.ok) continue;
    broken += 1;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const np = new Vec(Math.floor(pos.x) + dx, Math.floor(pos.y) + dy, Math.floor(pos.z) + dz);
          const k = keyOf(np);
          if (seen.has(k)) continue;
          seen.add(k);
          const nb = bot.blockAt(np);
          if (nb && blockName(nb) === targetName) queue.push(np);
        }
      }
    }
    if (!getBot()) return { ok: false, reason: "not in game" };
  }

  await collectNearbyDrops();
  if (broken === 0) return { ok: false, reason: `couldn't mine the ${targetName.replace(/_/g, " ")}` };
  return { ok: true, reason: `mined the whole vein, ${broken}x ${targetName.replace(/_/g, " ")}` };
}

export async function mineArea(word, radius) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  const r = Number.isFinite(radius) && radius > 0 ? Math.min(radius, 5) : 2;
  const Vec = bot.entity.position.constructor;
  const origin = bot.entity.position;
  let broken = 0;
  let attempts = 0;

  const targets = [];
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -1; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        targets.push(new Vec(Math.floor(origin.x) + dx, Math.floor(origin.y) + dy, Math.floor(origin.z) + dz));
      }
    }
  }
  targets.sort((a, b) => origin.distanceTo(a) - origin.distanceTo(b));

  for (const pos of targets) {
    if (attempts >= AREA_MAX) break;
    attempts += 1;
    const block = bot.blockAt(pos);
    if (!block) continue;
    const n = blockName(block);
    if (n === "air" || n === "water" || n === "lava") continue;
    if (word && n !== word.toLowerCase() && !n.includes(word.toLowerCase())) continue;

    const guard = await workTick();
    if (guard.stop) return broken > 0 ? { ok: true, reason: `cleared ${broken} blocks, ${guard.reason}` } : { ok: false, reason: guard.reason };
    if (guard.pause) { await waitOutCombat(); }

    const safe = safeToMine(block);
    if (!safe.ok) continue;
    const res = await mineBlock(block);
    if (res.ok) broken += 1;
    if (!getBot()) return { ok: false, reason: "not in game" };
  }

  await collectNearbyDrops();
  if (broken === 0) return { ok: false, reason: word ? `no ${word} to clear around here` : "nothing to clear here" };
  return { ok: true, reason: `cleared ${broken} blocks` };
}
