import { VALUE_RANK, DEFAULT_VALUE } from "./config.js";
import { materialTier } from "./match.js";

export function itemValue(itemName) {
  const name = (itemName || "").toLowerCase();
  if (!name) return 0;
  for (const rule of VALUE_RANK) {
    if (rule.match.test(name)) {
      let score = rule.score;
      const tier = materialTier(name);
      if (tier > 0) score += tier;
      return score;
    }
  }
  return DEFAULT_VALUE;
}

export function isValuable(itemName, threshold = DEFAULT_VALUE) {
  return itemValue(itemName) >= threshold;
}

export function compareValue(a, b) {
  return itemValue(b.name) - itemValue(a.name);
}
