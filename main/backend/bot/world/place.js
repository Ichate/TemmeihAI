import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { PLACE_TIMEOUT_MS } from "./config.js";
import { findItems } from "../inventory/read.js";
import { reachBlock, faceBlock } from "./reach.js";

const FACES = [
  [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
];

function vec(bot, x, y, z) {
  const Vec = bot.entity.position.constructor;
  return new Vec(x, y, z);
}

function isSolid(block) {
  if (!block || !block.name) return false;
  const n = block.name.toLowerCase();
  if (n === "air" || n === "cave_air" || n === "void_air") return false;
  if (n === "water" || n === "lava") return false;
  return true;
}

async function equipPlaceable(word) {
  const bot = getBot();
  if (!bot) return { item: null, reason: "not in game" };
  let item = null;
  if (word) {
    const matches = findItems(word).filter(it => !/_sword|_pickaxe|_axe|_shovel|_hoe|bow|shield|_bucket$|^bucket$/.test(it.name));
    item = matches[0] || null;
    if (!item) return { item: null, reason: `i don't have ${word} to place` };
  } else {
    item = (bot.inventory ? bot.inventory.items() : []).find(it => /(_block$|planks$|log$|dirt|cobblestone|stone$|torch|fence|slab|stairs|wool|glass|brick|plank)/.test(it.name)) || null;
    if (!item) return { item: null, reason: "i don't have a block to place" };
  }
  try {
    if (!bot.heldItem || bot.heldItem.name !== item.name) await bot.equip(item, "hand");
    return { item, reason: null };
  } catch (e) {
    log.warn(`place equip failed: ${e.message}`);
    return { item: null, reason: `couldn't get the ${item.name.replace(/_/g, " ")} out` };
  }
}

export async function placeBlock(word, target) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };

  if (word && /^(water|lava)$/i.test(word.trim())) {
    const { emptyBucket } = await import("./bucket.js");
    return emptyBucket();
  }

  const equipped = await equipPlaceable(word);
  const item = equipped.item;
  if (!item) return { ok: false, reason: equipped.reason };

  let spot = target;
  if (!spot) {
    const Vec = bot.entity.position.constructor;
    const yaw = bot.entity.yaw;
    const dx = Math.round(-Math.sin(yaw));
    const dz = Math.round(-Math.cos(yaw));
    spot = vec(bot, Math.floor(bot.entity.position.x) + dx, Math.floor(bot.entity.position.y), Math.floor(bot.entity.position.z) + dz);
  }

  const existing = bot.blockAt(spot);
  if (isSolid(existing)) return { ok: false, reason: "there's already a block there" };

  let reference = null;
  let faceVec = null;
  for (const [dx, dy, dz] of FACES) {
    const refPos = vec(bot, spot.x + dx, spot.y + dy, spot.z + dz);
    const refBlock = bot.blockAt(refPos);
    if (isSolid(refBlock)) {
      reference = refBlock;
      faceVec = vec(bot, -dx, -dy, -dz);
      break;
    }
  }

  if (!reference) return { ok: false, reason: "nothing solid to place it against there" };

  const reached = await reachBlock(reference);
  if (!reached.ok) return { ok: false, reason: "couldn't get close enough to place it" };

  const itemName = item.name.replace(/_/g, " ");
  try {
    await Promise.race([
      bot.placeBlock(reference, faceVec),
      delay(PLACE_TIMEOUT_MS).then(() => { throw new Error("place timed out"); }),
    ]);
  } catch (e) {
    const after = bot.blockAt(spot);
    if (isSolid(after)) return { ok: true, reason: `placed the ${itemName}` };
    return { ok: false, reason: `couldn't place the ${itemName} (${e.message})` };
  }

  await delay(200);
  return { ok: true, reason: `placed the ${itemName}` };
}
