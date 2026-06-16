import { getBot } from "../ctx.js";
import { itemMatchesWord } from "../inventory/match.js";
import { FIND_SCAN_RADIUS, CONTAINER_NAMES, FURNACE_NAMES, USABLE_NAMES } from "./config.js";

export function blockName(block) {
  if (!block) return "";
  return (block.name || "").toLowerCase();
}

export function lookingAtBlock(maxDistance = 5) {
  const bot = getBot();
  if (!bot) return null;
  try {
    const b = bot.blockAtCursor ? bot.blockAtCursor(maxDistance) : null;
    if (b && b.name && b.name !== "air") return b;
  } catch {}
  return null;
}

export function blockInFront() {
  const bot = getBot();
  if (!bot || !bot.entity) return null;
  try {
    const Vec = bot.entity.position.constructor;
    const yaw = bot.entity.yaw;
    const dx = -Math.sin(yaw);
    const dz = -Math.cos(yaw);
    const base = bot.entity.position;
    const fx = Math.floor(base.x + dx);
    const fz = Math.floor(base.z + dz);
    const fy = Math.floor(base.y);
    const b = bot.blockAt(new Vec(fx, fy, fz));
    if (b && b.name && b.name !== "air") return b;
  } catch {}
  return null;
}

export function findBlockByName(word, maxDistance = FIND_SCAN_RADIUS) {
  const bot = getBot();
  if (!bot || !bot.entity || !word) return null;
  try {
    if (bot.findBlock) {
      const block = bot.findBlock({
        point: bot.entity.position,
        maxDistance,
        matching: (b) => b && b.name && itemMatchesWord(b.name, word),
      });
      if (block) return block;
    }
  } catch {}
  return null;
}

export function findContainer(maxDistance = FIND_SCAN_RADIUS, kindWord) {
  const bot = getBot();
  if (!bot || !bot.entity) return null;
  try {
    if (bot.findBlock) {
      return bot.findBlock({
        point: bot.entity.position,
        maxDistance,
        matching: (b) => {
          if (!b || !b.name) return false;
          const n = b.name.toLowerCase();
          if (kindWord && !n.includes(kindWord.toLowerCase())) return false;
          return CONTAINER_NAMES.has(n) || n.endsWith("shulker_box");
        },
      });
    }
  } catch {}
  return null;
}

export function findFurnace(maxDistance = FIND_SCAN_RADIUS, kindWord) {
  const bot = getBot();
  if (!bot || !bot.entity) return null;
  try {
    if (bot.findBlock) {
      return bot.findBlock({
        point: bot.entity.position,
        maxDistance,
        matching: (b) => {
          if (!b || !b.name) return false;
          const n = b.name.toLowerCase();
          if (kindWord && !n.includes(kindWord.toLowerCase())) return false;
          return FURNACE_NAMES.has(n);
        },
      });
    }
  } catch {}
  return null;
}

export function findUsable(word, maxDistance = FIND_SCAN_RADIUS) {
  const bot = getBot();
  if (!bot || !bot.entity) return null;
  try {
    if (bot.findBlock) {
      return bot.findBlock({
        point: bot.entity.position,
        maxDistance,
        matching: (b) => {
          if (!b || !b.name) return false;
          const n = b.name.toLowerCase();
          if (word && !n.includes(word.toLowerCase()) && !itemMatchesWord(n, word)) return false;
          return USABLE_NAMES.some(u => n.includes(u));
        },
      });
    }
  } catch {}
  return null;
}

export function resolveTargetBlock(word) {
  if (word) {
    const named = findBlockByName(word);
    if (named) return named;
  }
  const looking = lookingAtBlock();
  if (looking) return looking;
  return blockInFront();
}
