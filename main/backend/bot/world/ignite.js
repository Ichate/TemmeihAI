import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { findItems } from "../inventory/read.js";
import { resolveTargetBlock, findBlockByName, blockName } from "./blocks.js";
import { reachBlock, faceBlock } from "./reach.js";

export async function ignite(word) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };

  const flint = findItems("flint_and_steel")[0] || findItems("fire_charge")[0];
  if (!flint) return { ok: false, reason: "i don't have flint and steel" };

  let block = null;
  if (word) {
    block = findBlockByName(word) || null;
    if (!block) return { ok: false, reason: `i don't see a ${word} to light` };
  } else {
    block = resolveTargetBlock(null);
    if (!block) return { ok: false, reason: "i'm not looking at anything to light" };
  }

  const name = blockName(block).replace(/_/g, " ");
  const reached = await reachBlock(block);
  if (!reached.ok) return { ok: false, reason: `couldn't get to the ${name}` };

  try {
    if (!bot.heldItem || bot.heldItem.name !== flint.name) await bot.equip(flint, "hand");
    await faceBlock(block);
    const Vec = bot.entity.position.constructor;
    await bot.activateBlock(block, new Vec(0, 1, 0));
    await delay(200);
    return { ok: true, reason: `lit the ${name}` };
  } catch (e) {
    log.warn(`ignite failed: ${e.message}`);
    try {
      await bot.activateItem();
      await delay(150);
      bot.deactivateItem();
      return { ok: true, reason: `used the flint and steel` };
    } catch {
      return { ok: false, reason: `couldn't light the ${name}` };
    }
  }
}
