import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { findItems, allItems, heldItem } from "./read.js";
import { bestByTier, itemMatchesWord, materialTier } from "./match.js";
import { ARMOR_SLOTS, ARMOR_SLOT_ORDER, TOOL_KINDS } from "./config.js";

const ARMOR_DEST = { head: "head", torso: "torso", legs: "legs", feet: "feet" };

export async function equipNamed(word) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const matches = findItems(word);
  if (!matches.length) return { ok: false, reason: `i don't have any ${word}` };
  const best = bestByTier(matches);
  const dest = armorDestFor(best.name) || "hand";
  try {
    await bot.equip(best, dest);
    return { ok: true, reason: `holding ${best.name.replace(/_/g, " ")}` };
  } catch (e) {
    log.error(`equip failed: ${e.message}`);
    return { ok: false, reason: `couldn't equip ${word}` };
  }
}

export async function equipBestWeapon() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const swords = allItems().filter(it => /_sword$/.test(it.name));
  const axes = allItems().filter(it => /_axe$/.test(it.name));
  const pool = swords.length ? swords : axes;
  if (!pool.length) return { ok: false, reason: "no weapon to hold" };
  const best = bestByTier(pool);
  try {
    await bot.equip(best, "hand");
    return { ok: true, reason: `holding ${best.name.replace(/_/g, " ")}` };
  } catch (e) {
    log.error(`equip weapon failed: ${e.message}`);
    return { ok: false, reason: "couldn't grab a weapon" };
  }
}

export async function equipBestTool(kind) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const k = (kind || "").toLowerCase();
  if (!TOOL_KINDS.includes(k)) return { ok: false, reason: `not a tool i know: ${kind}` };
  const pool = allItems().filter(it => it.name.endsWith(`_${k}`));
  if (!pool.length) return { ok: false, reason: `i don't have a ${k}` };
  const best = bestByTier(pool);
  try {
    await bot.equip(best, "hand");
    return { ok: true, reason: `holding ${best.name.replace(/_/g, " ")}` };
  } catch (e) {
    log.error(`equip tool failed: ${e.message}`);
    return { ok: false, reason: `couldn't grab the ${k}` };
  }
}

function armorDestFor(itemName) {
  const name = (itemName || "").toLowerCase();
  for (const slot of ARMOR_SLOT_ORDER) {
    for (const kw of ARMOR_SLOTS[slot]) {
      if (name.includes(kw)) return ARMOR_DEST[slot];
    }
  }
  return null;
}

export async function equipArmorSet() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const worn = [];
  for (const slot of ARMOR_SLOT_ORDER) {
    const candidates = allItems().filter(it => {
      const dest = armorDestFor(it.name);
      return dest === ARMOR_DEST[slot];
    });
    if (!candidates.length) continue;
    const best = bestByTier(candidates);
    try {
      await bot.equip(best, ARMOR_DEST[slot]);
      worn.push(best.name.replace(/_/g, " "));
    } catch (e) {
      log.warn(`armor equip ${slot} failed: ${e.message}`);
    }
  }
  if (!worn.length) return { ok: false, reason: "i don't have any armor to wear" };
  return { ok: true, reason: `put on ${worn.join(", ")}` };
}

export async function unequipHand() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const held = heldItem();
  if (!held) return { ok: false, reason: "my hands are already empty" };
  try {
    await bot.unequip("hand");
    return { ok: true, reason: `put away the ${held.name.replace(/_/g, " ")}` };
  } catch (e) {
    log.error(`unequip failed: ${e.message}`);
    return { ok: false, reason: "couldn't put it away" };
  }
}
