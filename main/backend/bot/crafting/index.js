import { getBot } from "../ctx.js";
import { craftItem } from "./craft.js";
import { ensureTable, findTable } from "./table.js";
import {
  resolveItem, itemDisplayName, recipeNeedsTable, recipeAvailable, howManyCanMake,
} from "./recipes.js";
import { CRAFTING_TABLE } from "./config.js";

export async function craft(word, count) {
  return craftItem(word, count);
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
  const hasTableAccess = !needsTable || !!findTable();

  if (recipeAvailable(item, needsTable)) {
    const n = howManyCanMake(item, needsTable);
    if (n > 0) {
      const tableNote = needsTable && !findTable() ? " (need a crafting table though)" : "";
      return { ok: true, reason: `yeah, i can make ${n}x ${name}${tableNote}` };
    }
  }
  if (needsTable && !hasTableAccess) {
    return { ok: true, reason: `i'd need a crafting table to make ${name}` };
  }
  return { ok: true, reason: `i can't make ${name} right now, missing materials` };
}

export function whatCanICraft() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const hasTable = !!findTable();
  const made = new Set();
  const out = [];
  try {
    const items = bot.inventory.items();
    const data = bot.registry || bot.mcData;
    if (!data) return { ok: true, reason: "not sure what i can make right now" };
    const candidates = data.itemsArray || Object.values(data.itemsByName || {});
    for (const it of candidates) {
      if (made.size >= 12) break;
      if (!it || made.has(it.name)) continue;
      try {
        const r = bot.recipesFor(it.id, null, 1, hasTable ? true : null);
        if (r && r.length) {
          const recipe = r.find(rr => craftableNow(rr));
          if (recipe) { made.add(it.name); out.push(it.displayName || it.name); }
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

export const crafting = {
  craft,
  makeTable,
  canCraft,
  whatCanICraft,
};
