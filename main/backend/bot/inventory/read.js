import { getBot } from "../ctx.js";
import { itemMatchesWord } from "./match.js";

export function allItems() {
  const bot = getBot();
  if (!bot || !bot.inventory) return [];
  try { return bot.inventory.items() || []; }
  catch { return []; }
}

export function heldItem() {
  const bot = getBot();
  if (!bot) return null;
  try { return bot.heldItem || null; }
  catch { return null; }
}

export function hotbarItems() {
  const bot = getBot();
  if (!bot || !bot.inventory) return [];
  return allItems().filter(it => it.slot >= 36 && it.slot <= 44);
}

export function armorItems() {
  const bot = getBot();
  if (!bot || !bot.inventory) return [];
  try {
    const slots = bot.inventory.slots || [];
    return [slots[5], slots[6], slots[7], slots[8]].filter(Boolean);
  } catch { return []; }
}

export function findItems(word) {
  return allItems().filter(it => itemMatchesWord(it.name, word));
}

export function findItem(word) {
  const list = findItems(word);
  return list.length ? list[0] : null;
}

export function countOf(word) {
  return findItems(word).reduce((sum, it) => sum + (it.count || 0), 0);
}

export function hasItem(word, atLeast = 1) {
  return countOf(word) >= atLeast;
}

export function freeSlots() {
  const bot = getBot();
  if (!bot || !bot.inventory) return 0;
  try {
    const empty = bot.inventory.emptySlotCount;
    return typeof empty === "number" ? empty : 0;
  } catch { return 0; }
}

export function isFull() {
  return freeSlots() <= 0;
}

export function groupedCounts() {
  const map = {};
  for (const it of allItems()) {
    map[it.name] = (map[it.name] || 0) + (it.count || 0);
  }
  return map;
}
