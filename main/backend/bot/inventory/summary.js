import { groupedCounts, heldItem, freeSlots, armorItems, countOf, findItems } from "./read.js";
import { FOOD_NAMES } from "./config.js";

function nice(name) {
  return (name || "").replace(/_/g, " ");
}

export function carrySummary() {
  const counts = groupedCounts();
  const names = Object.keys(counts);
  if (!names.length) return { ok: true, reason: "my inventory's empty", text: "nothing" };

  const sorted = names.sort((a, b) => counts[b] - counts[a]);
  const parts = sorted.slice(0, 12).map(n => `${counts[n]}x ${nice(n)}`);
  const extra = sorted.length > 12 ? `, and ${sorted.length - 12} other things` : "";
  const held = heldItem();
  const holding = held ? `, holding ${nice(held.name)}` : "";
  const text = `${parts.join(", ")}${extra}${holding}`;
  return { ok: true, reason: text, text };
}

export function foodReport() {
  const counts = groupedCounts();
  const foods = Object.keys(counts).filter(n => {
    const base = n.toLowerCase();
    if (FOOD_NAMES.has(base)) return true;
    for (const f of FOOD_NAMES) { if (base.includes(f)) return true; }
    return false;
  });
  if (!foods.length) return { ok: true, reason: "i don't have any food", text: "none", total: 0 };
  const total = foods.reduce((s, n) => s + counts[n], 0);
  const text = foods.map(n => `${counts[n]}x ${nice(n)}`).join(", ");
  return { ok: true, reason: text, text, total };
}

export function spaceReport() {
  const free = freeSlots();
  return { ok: true, reason: `${free} free slots`, free };
}

export function armorReport() {
  const worn = armorItems();
  if (!worn.length) return { ok: true, reason: "not wearing any armor", text: "none" };
  const text = worn.map(it => nice(it.name)).join(", ");
  return { ok: true, reason: `wearing ${text}`, text };
}

export function countItem(word) {
  if (!word) return { ok: false, reason: "count what?", count: 0 };
  const n = countOf(word);
  if (n <= 0) return { ok: true, reason: `i don't have any ${word}`, count: 0 };
  const matches = findItems(word);
  const realName = matches.length ? nice(matches[0].name) : word;
  return { ok: true, reason: `i've got ${n}x ${realName}`, count: n };
}
