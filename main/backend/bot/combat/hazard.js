import { getBot } from "../ctx.js";
import { CLIFF_DROP_DANGER } from "./config.js";

function blockNameAt(bot, x, y, z) {
  try {
    const Vec = bot.entity.position.constructor;
    const b = bot.blockAt(new Vec(Math.floor(x), Math.floor(y), Math.floor(z)));
    return b && b.name ? b.name.toLowerCase() : "air";
  } catch {
    return "air";
  }
}

export function positionSafe(pos) {
  const bot = getBot();
  if (!bot || !bot.entity || !pos) return true;

  const feet = blockNameAt(bot, pos.x, pos.y, pos.z);
  const below = blockNameAt(bot, pos.x, pos.y - 1, pos.z);

  if (/lava/.test(feet) || /lava/.test(below)) return false;
  if (/fire|magma_block/.test(below)) return false;
  if (/cactus/.test(feet)) return false;

  let drop = 0;
  for (let dy = 1; dy <= CLIFF_DROP_DANGER + 1; dy++) {
    const n = blockNameAt(bot, pos.x, pos.y - dy, pos.z);
    if (n === "air" || n === "water" || n === "cave_air" || n === "void_air") drop++;
    else break;
  }
  if (drop >= CLIFF_DROP_DANGER) {
    const landing = blockNameAt(bot, pos.x, pos.y - drop - 1, pos.z);
    if (/lava/.test(landing)) return false;
    if (drop > 6) return false;
  }
  return true;
}

export function stepToward(target, fromPos) {
  if (!target || !target.position || !fromPos) return null;
  const dx = target.position.x - fromPos.x;
  const dz = target.position.z - fromPos.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  return {
    x: fromPos.x + (dx / len),
    y: fromPos.y,
    z: fromPos.z + (dz / len),
  };
}

export function chaseSafe(target) {
  const bot = getBot();
  if (!bot || !bot.entity || !target || !target.position) return true;
  const next = stepToward(target, bot.entity.position);
  if (!next) return true;
  return positionSafe(next);
}
