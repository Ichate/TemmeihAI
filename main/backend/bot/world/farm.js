import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { CROP_REPLANT, MATURE_AGE, FIND_SCAN_RADIUS } from "./config.js";
import { blockName } from "./blocks.js";
import { reachBlock } from "./reach.js";
import { mineBlock } from "./mine.js";
import { collectNearbyDrops } from "./collect.js";
import { workTick, waitOutCombat } from "./workguard.js";
import { findItems } from "../inventory/read.js";

function cropAge(block) {
  if (!block) return null;
  try {
    if (block.getProperties) {
      const props = block.getProperties();
      if (props && props.age != null) return parseInt(props.age);
    }
    if (block.metadata != null) return block.metadata;
  } catch {}
  return null;
}

function isMatureCrop(block) {
  const n = blockName(block);
  if (!n) return false;
  const base = Object.keys(MATURE_AGE).find(c => n === c || n.includes(c));
  if (!base) return false;
  const age = cropAge(block);
  const need = MATURE_AGE[base];
  if (age == null) return false;
  return age >= need;
}

function cropBase(name) {
  return Object.keys(CROP_REPLANT).find(c => name === c || name.includes(c)) || null;
}

async function replant(pos, base) {
  const bot = getBot();
  if (!bot) return false;
  const seedName = CROP_REPLANT[base];
  if (!seedName) return false;
  const seed = findItems(seedName)[0];
  if (!seed) return false;
  try {
    const Vec = bot.entity.position.constructor;
    const soil = bot.blockAt(new Vec(Math.floor(pos.x), Math.floor(pos.y) - 1, Math.floor(pos.z)));
    if (!soil) return false;
    await bot.equip(seed, "hand");
    await bot.placeBlock(soil, new Vec(0, 1, 0));
    return true;
  } catch (e) {
    log.warn(`replant failed: ${e.message}`);
    return false;
  }
}

export async function harvestCrops(word) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };

  const Vec = bot.entity.position.constructor;
  const origin = bot.entity.position;
  const radius = 8;
  const targets = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        targets.push(new Vec(Math.floor(origin.x) + dx, Math.floor(origin.y) + dy, Math.floor(origin.z) + dz));
      }
    }
  }
  targets.sort((a, b) => origin.distanceTo(a) - origin.distanceTo(b));

  let harvested = 0;
  let replanted = 0;
  for (const pos of targets) {
    const block = bot.blockAt(pos);
    if (!isMatureCrop(block)) continue;
    const n = blockName(block);
    if (word && !n.includes(word.toLowerCase())) continue;

    const guard = await workTick();
    if (guard.stop) break;
    if (guard.pause) { await waitOutCombat(); }

    const base = cropBase(n);
    const reached = await reachBlock(block);
    if (!reached.ok) continue;
    const r = await mineBlock(block);
    if (!r.ok) continue;
    harvested += 1;
    await delay(200);
    if (base) {
      const did = await replant(pos, base);
      if (did) replanted += 1;
    }
    if (!getBot()) return { ok: false, reason: "not in game" };
  }

  await collectNearbyDrops();
  if (harvested === 0) return { ok: false, reason: word ? `no ripe ${word} around here` : "no ripe crops nearby" };
  return { ok: true, reason: `harvested ${harvested} crops${replanted ? ` and replanted ${replanted}` : ""}` };
}
