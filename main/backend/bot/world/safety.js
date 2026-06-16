import { getBot } from "../ctx.js";
import { UNBREAKABLE } from "./config.js";
import { blockName } from "./blocks.js";

function nameAt(bot, x, y, z) {
  try {
    const Vec = bot.entity.position.constructor;
    const b = bot.blockAt(new Vec(x, y, z));
    return b && b.name ? b.name.toLowerCase() : "air";
  } catch {
    return "air";
  }
}

export function isUnbreakable(block) {
  const n = blockName(block);
  if (!n) return true;
  if (UNBREAKABLE.has(n)) return true;
  return false;
}

export function safeToMine(block) {
  const bot = getBot();
  if (!bot || !bot.entity || !block || !block.position) {
    return { ok: false, reason: "no block to mine" };
  }
  const n = blockName(block);
  if (isUnbreakable(block)) return { ok: false, reason: `can't break ${n || "that"}` };

  const p = block.position;
  const self = bot.entity.position;

  const below = Math.floor(self.y) - 1;
  if (Math.floor(p.x) === Math.floor(self.x) && Math.floor(p.z) === Math.floor(self.z) && Math.floor(p.y) === below) {
    const under = nameAt(bot, Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z));
    if (/lava/.test(under) || under === "air" || under === "cave_air") {
      return { ok: false, reason: "not digging the block under myself over a drop or lava" };
    }
  }

  const neighbors = [
    [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0],
  ];
  for (const [dx, dy, dz] of neighbors) {
    const nb = nameAt(bot, Math.floor(p.x) + dx, Math.floor(p.y) + dy, Math.floor(p.z) + dz);
    if (/lava/.test(nb)) {
      return { ok: false, reason: "there's lava right next to that, not touching it" };
    }
  }

  return { ok: true, reason: "safe" };
}

export function safeToStandAfter(block) {
  const bot = getBot();
  if (!bot || !block || !block.position) return true;
  const p = block.position;
  const below = nameAt(bot, Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z));
  if (/lava/.test(below)) return false;
  return true;
}
