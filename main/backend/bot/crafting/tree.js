import { getBot } from "../ctx.js";
import { RECURSE_MAX_DEPTH, RECURSE_MAX_STEPS } from "./config.js";
import { resolveItem, mcData } from "./recipes.js";
import { smeltSourceFor, canSmeltInto } from "./smelt-step.js";

function haveCount(itemId) {
  const bot = getBot();
  if (!bot || !bot.inventory || itemId == null) return 0;
  try { return bot.inventory.count(itemId, null); } catch { return 0; }
}

function itemNameById(id) {
  const data = mcData();
  if (!data || id == null) return null;
  try {
    const arr = data.items || {};
    if (arr[id]) return arr[id].name;
    if (data.itemsArray) {
      const f = data.itemsArray.find(it => it.id === id);
      if (f) return f.name;
    }
  } catch {}
  return null;
}

function recipeNeeds(recipe) {
  const need = {};
  if (!recipe) return need;
  try {
    const delta = recipe.delta || [];
    for (const d of delta) {
      if (d.count < 0 && d.id != null) need[d.id] = (need[d.id] || 0) + (-d.count);
    }
    if (!Object.keys(need).length && recipe.ingredients) {
      for (const ing of recipe.ingredients) {
        if (ing && ing.id != null && ing.count) need[ing.id] = (need[ing.id] || 0) + Math.abs(ing.count);
      }
    }
    if (!Object.keys(need).length && recipe.inShape) {
      for (const row of recipe.inShape) {
        for (const cell of row) {
          if (cell && cell.id != null) need[cell.id] = (need[cell.id] || 0) + (cell.count || 1);
        }
      }
    }
  } catch {}
  return need;
}

function recipeYield(recipe) {
  if (recipe && recipe.result && recipe.result.count) return recipe.result.count;
  return 1;
}

function recipesForId(id, hasTable) {
  const bot = getBot();
  if (!bot || id == null) return [];
  try {
    const r = bot.recipesFor(id, null, 1, hasTable ? true : null);
    return r || [];
  } catch {
    return [];
  }
}

export function planCraft(item, count, hasTable) {
  const steps = [];
  const state = { steps: 0, virtual: {} };

  function virtualHave(id) {
    return haveCount(id) + (state.virtual[id] || 0);
  }
  function addVirtual(id, n) {
    state.virtual[id] = (state.virtual[id] || 0) + n;
  }
  function takeVirtual(id, n) {
    state.virtual[id] = (state.virtual[id] || 0) - n;
  }

  function resolve(id, need, depth) {
    if (state.steps > RECURSE_MAX_STEPS) return { ok: false, reason: "this is too complicated to work out" };
    if (depth > RECURSE_MAX_DEPTH) return { ok: false, reason: "needs too many crafting steps" };

    const already = virtualHave(id);
    if (already >= need) return { ok: true };

    let shortfall = need - already;

    const name = itemNameById(id) || "";
    const smeltSources = smeltSourceFor(name);
    const craftRecipes = recipesForId(id, true);

    if (craftRecipes.length) {
      const recipe = craftRecipes[0];
      const per = recipeYield(recipe);
      const times = Math.ceil(shortfall / per);
      const needs = recipeNeeds(recipe);

      for (const subId in needs) {
        const subNeed = needs[subId] * times;
        const r = resolve(parseInt(subId), subNeed, depth + 1);
        if (!r.ok) {
          if (smeltSources) break;
          return r;
        }
      }

      let canProceed = true;
      for (const subId in needs) {
        if (virtualHave(parseInt(subId)) < needs[subId] * times) { canProceed = false; break; }
      }

      if (canProceed) {
        for (const subId in needs) takeVirtual(parseInt(subId), needs[subId] * times);
        steps.push({ kind: "craft", id, name, times, per });
        addVirtual(id, times * per);
        state.steps += 1;
        return { ok: true };
      }
    }

    if (smeltSources) {
      const haveRaw = canSmeltInto(name);
      if (haveRaw >= shortfall) {
        steps.push({ kind: "smelt", id, name, count: shortfall });
        addVirtual(id, shortfall);
        state.steps += 1;
        return { ok: true };
      }
    }

    return { ok: false, reason: `not enough ${name.replace(/_/g, " ") || "materials"}` };
  }

  const recipes = recipesForId(item.id, hasTable);
  if (!recipes.length) return { ok: false, reason: "no recipe for that", steps: [] };

  const recipe = recipes[0];
  const per = recipeYield(recipe);
  const times = Math.ceil(count / per);
  const needs = recipeNeeds(recipe);

  for (const subId in needs) {
    const r = resolve(parseInt(subId), needs[subId] * times, 1);
    if (!r.ok) return { ok: false, reason: r.reason, steps: [] };
  }

  return { ok: true, steps, finalTimes: times };
}

export function describeMissing(item, count, hasTable) {
  const plan = planCraft(item, count, hasTable);
  if (plan.ok) {
    const subs = plan.steps.filter(s => s.kind !== "final");
    if (!subs.length) return "you've got everything for it";
    const parts = subs.map(s => s.kind === "smelt" ? `smelt ${s.count} ${s.name.replace(/_/g, " ")}` : `make ${s.times * s.per} ${s.name.replace(/_/g, " ")}`);
    return `i'd need to ${parts.join(", then ")}`;
  }
  return plan.reason || "i can't work out how to make that";
}
