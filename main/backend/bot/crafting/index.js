import { getBot } from "../ctx.js";
import { craftItem } from "./craft.js";
import { ensureTable, findTable } from "./table.js";
import {
  resolveItem, itemDisplayName, recipeNeedsTable, recipeAvailable, howManyCanMake,
} from "./recipes.js";
import { planCraft, describeMissing } from "./tree.js";
import { bestTierItemName, resolveSet } from "./tiers.js";
import { pullMaterialsFor } from "./chest-source.js";
import {
  smithingUpgrade, stonecut, anvilCombine, enchantItem, brewPotion,
} from "./stations.js";
import { countOf } from "../inventory/read.js";
import { CRAFTING_TABLE } from "./config.js";

export async function craft(word, count) {
  return craftItem(word, count);
}

export async function craftBest(word, count) {
  const hasTable = !!findTable() || true;
  const best = bestTierItemName(word, hasTable);
  if (!best) {
    return craftItem(word, count);
  }
  return craftItem(best, count);
}

export async function craftUntil(word, target) {
  const item = resolveItem(word);
  if (!item) return { ok: false, reason: `i don't know what ${word} is` };
  const name = itemDisplayName(item);
  const want = Number.isFinite(target) && target > 0 ? target : 1;
  const have = countOf(item.name);
  if (have >= want) return { ok: true, reason: `already have ${have} ${name}` };
  const need = want - have;
  const r = await craftItem(word, need);
  if (!r.ok) return r;
  const now = countOf(item.name);
  return { ok: true, reason: `now have ${now} ${name}` };
}

export async function craftFromChest(word, count, container) {
  const hasTable = !!findTable();
  const pulled = await pullMaterialsFor(word, hasTable, container || null);
  const r = await craftItem(word, count);
  if (!r.ok && pulled.ok) {
    return { ok: false, reason: `${r.reason} (pulled materials from the chest but still couldn't)` };
  }
  return r;
}

export async function craftSet(word) {
  const set = resolveSet(word, true);
  if (!set) return { ok: false, reason: "tell me a set like 'iron tools' or 'diamond armor'" };
  const made = [];
  const failed = [];
  for (const piece of set.names) {
    const r = await craftItem(piece, 1);
    if (r && r.ok) made.push(piece.replace(/_/g, " "));
    else failed.push(piece.replace(/_/g, " "));
    if (!getBot()) break;
  }
  if (!made.length) return { ok: false, reason: `couldn't make any of the ${set.tier} ${set.kind}` };
  const note = failed.length ? `, couldn't do ${failed.join(", ")}` : "";
  return { ok: true, reason: `made ${made.join(", ")}${note}` };
}

export async function makeTable() {
  const t = await ensureTable();
  return { ok: t.ok, reason: t.ok ? "got a crafting table set up" : t.reason };
}

export function canCraft(word) {
  const item = resolveItem(word);
  if (!item) return { ok: false, reason: `i don't know what ${word} is` };
  const name = itemDisplayName(item);
  const needsTable = recipeNeedsTable(item);

  if (recipeAvailable(item, needsTable) && howManyCanMake(item, needsTable) > 0) {
    const n = howManyCanMake(item, needsTable);
    const tableNote = needsTable && !findTable() ? " (need a crafting table)" : "";
    return { ok: true, reason: `yeah, i can make ${n}x ${name}${tableNote}` };
  }
  const plan = planCraft(item, 1, needsTable);
  if (plan.ok) {
    return { ok: true, reason: `i can make ${name} if i ${describeMissing(item, 1, needsTable)}` };
  }
  return { ok: true, reason: `can't make ${name}: ${plan.reason}` };
}

export function recipeInfo(word) {
  const item = resolveItem(word);
  if (!item) return { ok: false, reason: `i don't know what ${word} is` };
  const name = itemDisplayName(item);
  const bot = getBot();
  const needsTable = recipeNeedsTable(item);
  try {
    const recipes = bot.recipesFor(item.id, null, 1, true);
    if (!recipes || !recipes.length) return { ok: true, reason: `i don't have a recipe for ${name}` };
    const r = recipes[0];
    const need = {};
    const delta = r.delta || [];
    for (const d of delta) {
      if (d.count < 0 && d.id != null) {
        const data = bot.registry || bot.mcData;
        const nm = data && data.items && data.items[d.id] ? data.items[d.id].name : `item ${d.id}`;
        need[nm] = (need[nm] || 0) + (-d.count);
      }
    }
    const parts = Object.keys(need).map(n => `${need[n]}x ${n.replace(/_/g, " ")}`);
    const tableNote = needsTable ? " (needs a crafting table)" : "";
    if (!parts.length) return { ok: true, reason: `not sure what ${name} needs` };
    return { ok: true, reason: `${name} needs ${parts.join(", ")}${tableNote}` };
  } catch {
    return { ok: false, reason: `couldn't read the recipe for ${name}` };
  }
}

export function whatCanICraft() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const hasTable = !!findTable();
  const made = new Set();
  const out = [];
  try {
    const data = bot.registry || bot.mcData;
    if (!data) return { ok: true, reason: "not sure what i can make right now" };
    const candidates = data.itemsArray || Object.values(data.itemsByName || {});
    for (const it of candidates) {
      if (out.length >= 12) break;
      if (!it || made.has(it.name)) continue;
      try {
        const r = bot.recipesFor(it.id, null, 1, hasTable ? true : null);
        if (r && r.length && r.find(rr => craftableNow(rr))) {
          made.add(it.name);
          out.push(it.displayName || it.name);
        }
      } catch {}
    }
  } catch {}
  if (!out.length) return { ok: true, reason: hasTable ? "nothing i can make with what i've got" : "not much without a crafting table" };
  return { ok: true, reason: `i can make: ${out.join(", ")}` };
}

function craftableNow(recipe) {
  const bot = getBot();
  if (!bot || !recipe) return false;
  try {
    const need = {};
    const delta = recipe.delta || [];
    for (const d of delta) if (d.count < 0) need[d.id] = (need[d.id] || 0) + (-d.count);
    for (const id in need) {
      if (bot.inventory.count(parseInt(id), null) < need[id]) return false;
    }
    return Object.keys(need).length > 0;
  } catch {
    return false;
  }
}

export async function smith(word) { return smithingUpgrade(word); }
export async function cut(word, count) { return stonecut(word, count); }
export async function anvil(opts) { return anvilCombine(opts || {}); }
export async function enchant(word, level) { return enchantItem(word, level); }
export async function brew(word) { return brewPotion(word); }

export const crafting = {
  craft,
  craftBest,
  craftUntil,
  craftFromChest,
  craftSet,
  makeTable,
  canCraft,
  recipeInfo,
  whatCanICraft,
  smith,
  cut,
  anvil,
  enchant,
  brew,
};
