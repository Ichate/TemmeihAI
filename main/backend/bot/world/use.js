import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { findUsable, resolveTargetBlock, blockName } from "./blocks.js";
import { reachBlock } from "./reach.js";
import { USABLE_NAMES } from "./config.js";

function isUsable(block) {
  const n = blockName(block);
  if (!n) return false;
  return USABLE_NAMES.some(u => n.includes(u));
}

export async function useBlock(word) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };

  let block = null;
  if (word) {
    block = findUsable(word);
    if (!block) return { ok: false, reason: `i don't see a ${word} to use nearby` };
  } else {
    const looked = resolveTargetBlock(null);
    if (looked && isUsable(looked)) block = looked;
    if (!block) block = findUsable("");
    if (!block) return { ok: false, reason: "nothing nearby i can press or flip" };
  }

  const name = blockName(block).replace(/_/g, " ");
  const reached = await reachBlock(block);
  if (!reached.ok) return { ok: false, reason: `couldn't get to the ${name}` };

  const fresh = bot.blockAt(block.position);
  if (!fresh || !isUsable(fresh)) return { ok: false, reason: `the ${name} isn't there anymore` };

  try {
    await bot.activateBlock(fresh);
    await delay(150);
    return { ok: true, reason: `used the ${name}` };
  } catch (e) {
    log.warn(`activateBlock failed: ${e.message}`);
    return { ok: false, reason: `couldn't use the ${name}` };
  }
}
