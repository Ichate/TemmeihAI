import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { resolveItem, mcData } from "./recipes.js";
import { planCraft } from "./tree.js";
import { countOf } from "../inventory/read.js";

function baseIngredientsFor(item, hasTable) {
  const plan = planCraft(item, 1, hasTable);
  const wanted = new Set();
  const data = mcData();
  if (!data) return wanted;
  try {
    const bot = getBot();
    const recipes = bot.recipesFor(item.id, null, 1, hasTable ? true : null);
    if (recipes && recipes.length) {
      const r = recipes[0];
      const delta = r.delta || [];
      for (const d of delta) {
        if (d.count < 0 && d.id != null) {
          const nm = itemName(d.id);
          if (nm) wanted.add(nm);
        }
      }
    }
  } catch {}
  if (plan && plan.steps) {
    for (const s of plan.steps) {
      if (s.name) wanted.add(s.name);
    }
  }
  return wanted;
}

function itemName(id) {
  const data = mcData();
  if (!data || id == null) return null;
  try {
    if (data.items && data.items[id]) return data.items[id].name;
    if (data.itemsArray) {
      const f = data.itemsArray.find(it => it.id === id);
      if (f) return f.name;
    }
  } catch {}
  return null;
}

export async function pullMaterialsFor(word, hasTable, kindWord) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game", pulled: 0 };
  const item = resolveItem(word);
  if (!item) return { ok: false, reason: `i don't know what ${word} is`, pulled: 0 };

  const wanted = baseIngredientsFor(item, hasTable);
  const rawNames = [
    "log", "planks", "stick", "cobblestone", "iron_ingot", "gold_ingot",
    "diamond", "raw_iron", "raw_gold", "coal", "string", "leather", "flint",
    "iron_nugget", "redstone", "feather",
  ];
  for (const r of rawNames) wanted.add(r);

  const { world } = await import("../world/index.js");
  let pulled = 0;
  for (const name of wanted) {
    try {
      const r = await world.withdrawItems(name, null, kindWord || null);
      if (r && r.ok) pulled += 1;
    } catch (e) {
      log.warn(`pull ${name} failed: ${e.message}`);
    }
  }

  if (pulled <= 0) return { ok: false, reason: "couldn't pull anything useful from the chest", pulled: 0 };
  return { ok: true, reason: `grabbed materials from the chest`, pulled };
}
