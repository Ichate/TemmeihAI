import { ALIASES, MATERIAL_TIER } from "./config.js";

export function normalizeWord(word) {
  return String(word || "").toLowerCase().trim().replace(/\s+/g, "_");
}

export function expandAliases(word) {
  const w = normalizeWord(word);
  if (!w) return [];
  if (ALIASES[w]) return ALIASES[w].slice();
  const singular = w.endsWith("s") ? w.slice(0, -1) : null;
  if (singular && ALIASES[singular]) return ALIASES[singular].slice();
  return [w];
}

export function itemMatchesWord(itemName, word) {
  const name = (itemName || "").toLowerCase();
  if (!name) return false;
  const patterns = expandAliases(word);
  for (const p of patterns) {
    if (!p) continue;
    if (name === p) return true;
    if (name.includes(p)) return true;
  }
  return false;
}

export function materialTier(itemName) {
  const name = (itemName || "").toLowerCase();
  for (const mat in MATERIAL_TIER) {
    if (name.startsWith(mat + "_") || name.includes(mat)) return MATERIAL_TIER[mat];
  }
  return 0;
}

export function bestByTier(items) {
  if (!items || !items.length) return null;
  let best = items[0];
  let bestTier = materialTier(best.name);
  for (const it of items) {
    const t = materialTier(it.name);
    if (t > bestTier) { bestTier = t; best = it; }
  }
  return best;
}
