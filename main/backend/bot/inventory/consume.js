import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { findItems, heldItem } from "./read.js";
import { bestByTier } from "./match.js";
import { FOOD_NAMES } from "./config.js";

function isFood(name) {
  const n = (name || "").toLowerCase();
  if (FOOD_NAMES.has(n)) return true;
  for (const f of FOOD_NAMES) { if (n.includes(f)) return true; }
  return false;
}

function isConsumable(name) {
  const n = (name || "").toLowerCase();
  if (isFood(n)) return true;
  if (n.includes("potion")) return true;
  if (n.includes("milk_bucket")) return true;
  if (n.includes("honey_bottle")) return true;
  return false;
}

async function consumeItem(item) {
  const bot = getBot();
  if (!bot || !item) return { ok: false, reason: "nothing to use" };
  const nice = item.name.replace(/_/g, " ");
  const prev = heldItem();
  try {
    state.eating = true;
    await bot.equip(item, "hand");
    await bot.consume();
    await delay(200);
    if (prev && prev.type !== item.type) {
      try { await bot.equip(prev, "hand"); } catch {}
    }
    return { ok: true, reason: `had the ${nice}` };
  } catch (e) {
    log.warn(`consume failed: ${e.message}`);
    return { ok: false, reason: `couldn't use the ${nice}` };
  } finally {
    state.eating = false;
  }
}

export async function useHeld() {
  const held = heldItem();
  if (!held) return { ok: false, reason: "i'm not holding anything" };
  if (!isConsumable(held.name)) return { ok: false, reason: `can't really use the ${held.name.replace(/_/g, " ")}` };
  return consumeItem(held);
}

export async function useNamed(word) {
  if (!word) return useHeld();
  const matches = findItems(word);
  if (!matches.length) return { ok: false, reason: `i don't have any ${word}` };
  const usable = matches.filter(it => isConsumable(it.name));
  if (!usable.length) return { ok: false, reason: `can't use ${word}` };
  return consumeItem(usable[0]);
}

export async function eatBestFood() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const foods = (bot.inventory ? bot.inventory.items() : []).filter(it => isFood(it.name) && !/rotten_flesh|poisonous|pufferfish|spider_eye|chorus/.test(it.name));
  if (!foods.length) return { ok: false, reason: "i don't have anything good to eat" };
  const pick = foods[0];
  return consumeItem(pick);
}

export function holdingTotem() {
  const bot = getBot();
  if (!bot) return false;
  try {
    const off = bot.inventory && bot.inventory.slots ? bot.inventory.slots[45] : null;
    if (off && /totem/.test(off.name)) return true;
  } catch {}
  const held = heldItem();
  return !!(held && /totem/.test(held.name));
}

export async function holdTotem() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const totems = findItems("totem");
  if (!totems.length) return { ok: false, reason: "i don't have a totem" };
  try {
    await bot.equip(totems[0], "off-hand");
    return { ok: true, reason: "holding a totem in my off-hand" };
  } catch (e) {
    try {
      await bot.equip(totems[0], "hand");
      return { ok: true, reason: "holding a totem" };
    } catch (e2) {
      log.warn(`totem equip failed: ${e2.message}`);
      return { ok: false, reason: "couldn't get the totem out" };
    }
  }
}
