import { TOOL_TIERS, TOOL_KINDS, ARMOR_TIERS, ARMOR_KINDS, FULL_SET_TOOLS } from "./config.js";
import { resolveItem } from "./recipes.js";
import { planCraft } from "./tree.js";

function detectKind(word) {
  const w = (word || "").toLowerCase();
  for (const k of TOOL_KINDS) if (w.includes(k)) return { family: "tool", kind: k };
  for (const k of ARMOR_KINDS) if (w.includes(k)) return { family: "armor", kind: k };
  return null;
}

function tierWord(word) {
  const w = (word || "").toLowerCase();
  for (const t of TOOL_TIERS) if (w.includes(t)) return t;
  for (const t of ARMOR_TIERS) if (w.includes(t)) return t;
  return null;
}

export function bestTierItemName(word, hasTable) {
  const info = detectKind(word);
  if (!info) return null;

  const explicit = tierWord(word);
  const tiers = info.family === "armor" ? ARMOR_TIERS : TOOL_TIERS;
  const order = explicit ? [explicit] : tiers;

  for (const tier of order) {
    const name = `${tier}_${info.kind}`;
    const item = resolveItem(name);
    if (!item) continue;
    const plan = planCraft(item, 1, hasTable);
    if (plan.ok) return name;
  }
  return null;
}

export function toolFamilyNames(tier) {
  const out = [];
  for (const k of FULL_SET_TOOLS) out.push(`${tier}_${k}`);
  return out;
}

export function armorSetNames(tier) {
  const out = [];
  for (const k of ARMOR_KINDS) out.push(`${tier}_${k}`);
  return out;
}

export function resolveSet(word, hasTable) {
  const w = (word || "").toLowerCase();
  const tier = tierWord(w) || "iron";
  if (w.includes("armor") || w.includes("armour")) {
    return { kind: "armor", tier, names: armorSetNames(tier) };
  }
  if (w.includes("tool")) {
    return { kind: "tools", tier, names: toolFamilyNames(tier) };
  }
  return null;
}
