import { getBot } from "../ctx.js";
import { itemMatchesWord } from "../inventory/match.js";

export function mcData() {
  const bot = getBot();
  if (!bot) return null;
  try {
    if (bot.registry) return bot.registry;
    if (bot.mcData) return bot.mcData;
  } catch {}
  return null;
}

export function resolveItem(word) {
  const data = mcData();
  if (!data || !word) return null;
  const w = word.toLowerCase().trim().replace(/\s+/g, "_");

  const items = data.itemsByName || {};
  if (items[w]) return items[w];

  for (const name in items) {
    if (name === w) return items[name];
  }
  for (const name in items) {
    if (itemMatchesWord(name, word)) return items[name];
  }
  return null;
}

export function itemDisplayName(item) {
  if (!item) return "that";
  return (item.displayName || item.name || "that").toString();
}

export function getRecipes(item, hasTable) {
  const bot = getBot();
  if (!bot || !item) return [];
  try {
    const withTable = hasTable ? true : null;
    const recipes = bot.recipesFor(item.id, null, 1, withTable);
    if (recipes && recipes.length) return recipes;
  } catch {}
  return [];
}

export function recipeNeedsTable(item) {
  const bot = getBot();
  if (!bot || !item) return true;
  try {
    const noTable = bot.recipesFor(item.id, null, 1, null);
    if (noTable && noTable.length) return false;
    const withTable = bot.recipesFor(item.id, null, 1, true);
    if (withTable && withTable.length) return true;
  } catch {}
  return true;
}

export function recipeAvailable(item, hasTable) {
  const bot = getBot();
  if (!bot || !item) return false;
  try {
    const r = bot.recipesFor(item.id, null, 1, hasTable ? true : null);
    return !!(r && r.length);
  } catch {
    return false;
  }
}

export function howManyCanMake(item, hasTable) {
  const bot = getBot();
  if (!bot || !item) return 0;
  try {
    const recipes = bot.recipesFor(item.id, null, 1, hasTable ? true : null);
    if (!recipes || !recipes.length) return 0;
    let best = 0;
    for (const r of recipes) {
      const per = r.result && r.result.count ? r.result.count : 1;
      const times = recipeCraftableTimes(r);
      if (times * per > best) best = times * per;
    }
    return best;
  } catch {
    return 0;
  }
}

function recipeCraftableTimes(recipe) {
  const bot = getBot();
  if (!bot || !recipe) return 0;
  try {
    const need = {};
    const delta = recipe.delta || [];
    for (const d of delta) {
      if (d.count < 0) need[d.id] = (need[d.id] || 0) + (-d.count);
    }
    if (!Object.keys(need).length && recipe.ingredients) {
      for (const ing of recipe.ingredients) {
        if (ing && ing.id != null && ing.count) need[ing.id] = (need[ing.id] || 0) + Math.abs(ing.count);
      }
    }
    let times = Infinity;
    for (const id in need) {
      const have = bot.inventory.count(parseInt(id), null);
      times = Math.min(times, Math.floor(have / need[id]));
    }
    return times === Infinity ? 0 : times;
  } catch {
    return 0;
  }
}

export function pickRecipe(item, hasTable) {
  const bot = getBot();
  if (!bot || !item) return null;
  try {
    const recipes = bot.recipesFor(item.id, null, 1, hasTable ? true : null);
    if (!recipes || !recipes.length) return null;
    for (const r of recipes) {
      if (recipeCraftableTimes(r) > 0) return r;
    }
    return recipes[0];
  } catch {
    return null;
  }
}
