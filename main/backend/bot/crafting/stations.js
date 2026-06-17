import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { STATION_NAMES, STATION_REACH, STATION_SCAN_RADIUS, STATION_TIMEOUT_MS } from "./config.js";
import { resolveItem, itemDisplayName } from "./recipes.js";
import { findItems, countOf } from "../inventory/read.js";

function stationMatch(kind) {
  const names = STATION_NAMES[kind];
  if (Array.isArray(names)) return (n) => names.includes(n);
  return (n) => n === names;
}

function findStation(kind) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.findBlock) return null;
  const match = stationMatch(kind);
  try {
    return bot.findBlock({
      point: bot.entity.position,
      maxDistance: STATION_SCAN_RADIUS,
      matching: (b) => b && b.name && match(b.name),
    });
  } catch { return null; }
}

async function reachStation(block) {
  const bot = getBot();
  if (!bot || !bot.entity || !block || !block.position) return false;
  const p = block.position;
  if (bot.entity.position.distanceTo(p.offset(0.5, 0.5, 0.5)) <= STATION_REACH) return true;
  try {
    const { movement } = await import("../movement/index.js");
    await Promise.race([
      movement.gotoCoords(p.x + 0.5, p.y, p.z + 0.5, { tolerance: 2, label: "the station", mode: "goto" }),
      delay(10000),
    ]);
  } catch {}
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (!getBot()) return false;
    if (bot.entity.position.distanceTo(p.offset(0.5, 0.5, 0.5)) <= STATION_REACH) return true;
    await delay(200);
  }
  return bot.entity.position.distanceTo(p.offset(0.5, 0.5, 0.5)) <= STATION_REACH;
}

async function reachAny(kind, label) {
  const block = findStation(kind);
  if (!block) return { ok: false, reason: `no ${label} nearby`, block: null };
  const reached = await reachStation(block);
  if (!reached) return { ok: false, reason: `couldn't get to the ${label}`, block: null };
  return { ok: true, block };
}

export async function smithingUpgrade(itemWord) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const at = await reachAny("smithing", "smithing table");
  if (!at.ok) return { ok: false, reason: at.reason };

  const gear = itemWord ? findItems(itemWord)[0] : null;
  if (itemWord && !gear) return { ok: false, reason: `i don't have ${itemWord} to upgrade` };
  if (countOf("netherite_ingot") <= 0) return { ok: false, reason: "i need a netherite ingot to upgrade" };

  const target = gear ? gear.name.replace("diamond", "netherite") : null;
  const item = target ? resolveItem(target) : null;
  if (!item) return { ok: false, reason: "i can't work out the netherite version of that" };

  try {
    const recipes = bot.recipesFor(item.id, null, 1, true);
    if (recipes && recipes.length) {
      await Promise.race([
        bot.craft(recipes[0], 1, at.block),
        delay(STATION_TIMEOUT_MS).then(() => { throw new Error("timed out"); }),
      ]);
      await delay(250);
      return { ok: true, reason: `upgraded to ${itemDisplayName(item)}` };
    }
  } catch (e) {
    log.warn(`smithing failed: ${e.message}`);
  }
  return { ok: false, reason: "couldn't do the netherite upgrade" };
}

export async function stonecut(itemWord, count) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  if (!itemWord) return { ok: false, reason: "cut what?" };
  const at = await reachAny("stonecutter", "stonecutter");
  if (!at.ok) return { ok: false, reason: at.reason };

  const item = resolveItem(itemWord);
  if (!item) return { ok: false, reason: `i don't know how to cut ${itemWord}` };
  const want = Number.isFinite(count) && count > 0 ? count : 1;

  try {
    const recipes = bot.recipesFor(item.id, null, 1, at.block);
    if (recipes && recipes.length) {
      const before = countOf(item.name);
      await Promise.race([
        bot.craft(recipes[0], want, at.block),
        delay(STATION_TIMEOUT_MS).then(() => { throw new Error("timed out"); }),
      ]);
      await delay(250);
      const made = countOf(item.name) - before;
      if (made > 0) return { ok: true, reason: `cut ${made}x ${itemDisplayName(item)}` };
    }
  } catch (e) {
    log.warn(`stonecut failed: ${e.message}`);
  }
  return { ok: false, reason: `couldn't cut ${itemWord} (need the base block)` };
}

export async function anvilCombine(opts = {}) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const at = await reachAny("anvil", "anvil");
  if (!at.ok) return { ok: false, reason: at.reason };
  if (typeof bot.openAnvil !== "function") return { ok: false, reason: "i can't use anvils on this setup" };

  let anvil;
  try {
    anvil = await Promise.race([
      bot.openAnvil(at.block),
      delay(STATION_TIMEOUT_MS).then(() => { throw new Error("open timed out"); }),
    ]);
  } catch (e) {
    return { ok: false, reason: "couldn't open the anvil" };
  }

  try {
    const first = opts.first ? findItems(opts.first)[0] : null;
    const second = opts.second ? findItems(opts.second)[0] : null;
    if (!first) { anvil.close(); return { ok: false, reason: "i don't have that item to work on" }; }
    await anvil.combine(first, second || null, opts.name || null);
    await delay(250);
    anvil.close();
    if (opts.name) return { ok: true, reason: `renamed it to "${opts.name}"` };
    return { ok: true, reason: "combined them on the anvil" };
  } catch (e) {
    try { anvil.close(); } catch {}
    return { ok: false, reason: "couldn't do that on the anvil" };
  }
}

export async function enchantItem(itemWord, level) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const at = await reachAny("enchanting", "enchanting table");
  if (!at.ok) return { ok: false, reason: at.reason };
  if (typeof bot.openEnchantmentTable !== "function") return { ok: false, reason: "i can't use enchant tables on this setup" };

  const gear = itemWord ? findItems(itemWord)[0] : (bot.heldItem || null);
  if (!gear) return { ok: false, reason: itemWord ? `i don't have ${itemWord} to enchant` : "i'm not holding anything to enchant" };

  let table;
  try {
    table = await Promise.race([
      bot.openEnchantmentTable(at.block),
      delay(STATION_TIMEOUT_MS).then(() => { throw new Error("open timed out"); }),
    ]);
  } catch (e) {
    return { ok: false, reason: "couldn't open the enchanting table" };
  }

  try {
    await table.putTargetItem(gear);
    await delay(300);
    const choices = table.enchantments || [];
    let pick = -1;
    const wantLevel = Number.isFinite(level) ? level : 3;
    for (let i = choices.length - 1; i >= 0; i--) {
      if (choices[i] && choices[i].level > 0) { pick = i; if (i + 1 <= wantLevel) break; }
    }
    if (pick < 0) { try { table.close(); } catch {} return { ok: false, reason: "can't enchant that right now (need levels and lapis)" }; }
    await table.enchant(pick);
    await delay(300);
    try { await table.takeTargetItem(); } catch {}
    try { table.close(); } catch {}
    return { ok: true, reason: `enchanted the ${gear.name.replace(/_/g, " ")}` };
  } catch (e) {
    try { table.close(); } catch {}
    return { ok: false, reason: "couldn't enchant it (need enough xp and lapis)" };
  }
}

export async function brewPotion(ingredientWord) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const at = await reachAny("brewing", "brewing stand");
  if (!at.ok) return { ok: false, reason: at.reason };
  if (typeof bot.openBrewingStand !== "function") return { ok: false, reason: "i can't use brewing stands on this setup" };

  const bottles = findItems("potion").filter(it => /water_bottle|potion/.test(it.name))[0] || findItems("glass_bottle")[0];
  if (!bottles) return { ok: false, reason: "i need water bottles to brew" };
  const ingredient = ingredientWord ? findItems(ingredientWord)[0] : null;
  if (ingredientWord && !ingredient) return { ok: false, reason: `i don't have ${ingredientWord} to brew with` };

  let stand;
  try {
    stand = await Promise.race([
      bot.openBrewingStand(at.block),
      delay(STATION_TIMEOUT_MS).then(() => { throw new Error("open timed out"); }),
    ]);
  } catch (e) {
    return { ok: false, reason: "couldn't open the brewing stand" };
  }

  try {
    if (typeof stand.putIngredient === "function" && ingredient) {
      await stand.putIngredient(ingredient.type, ingredient.metadata == null ? null : ingredient.metadata, 1);
    }
    await delay(250);
    try { stand.close(); } catch {}
    return { ok: true, reason: ingredientWord ? `brewing with ${ingredientWord}` : "loaded the brewing stand" };
  } catch (e) {
    try { stand.close(); } catch {}
    return { ok: false, reason: "couldn't set up the brew" };
  }
}
