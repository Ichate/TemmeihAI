import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { CONTAINER_OPEN_TIMEOUT_MS, SMELT_WAIT_MS, FUEL_PRIORITY } from "./config.js";
import { findFurnace, blockName } from "./blocks.js";
import { reachBlock } from "./reach.js";
import { findItems } from "../inventory/read.js";
import { itemMatchesWord } from "../inventory/match.js";

async function openFurnace(block) {
  const bot = getBot();
  try {
    const f = await Promise.race([
      bot.openFurnace(block),
      delay(CONTAINER_OPEN_TIMEOUT_MS).then(() => { throw new Error("furnace open timed out"); }),
    ]);
    await delay(400);
    return f;
  } catch (e) {
    log.warn(`furnace open failed: ${e.message}`);
    return null;
  }
}

function pickFuel() {
  const bot = getBot();
  if (!bot || !bot.inventory) return null;
  const items = bot.inventory.items();
  for (const pref of FUEL_PRIORITY) {
    const f = items.find(it => it.name.includes(pref));
    if (f) return f;
  }
  return null;
}

export async function smelt(itemWord, count) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };

  const block = findFurnace();
  if (!block) return { ok: false, reason: "no furnace nearby" };
  const fname = blockName(block).replace(/_/g, " ");

  const reached = await reachBlock(block);
  if (!reached.ok) return { ok: false, reason: `couldn't get to the ${fname}` };

  let input = null;
  if (itemWord) {
    input = findItems(itemWord).filter(it => /(_ore$|raw_|^iron|^gold|^copper|sand$|cobblestone|log$|wood$|beef|porkchop|chicken|mutton|rabbit|cod|salmon|potato|kelp|clay|netherrack|cactus)/.test(it.name))[0]
      || findItems(itemWord)[0];
  }
  if (!input) return { ok: false, reason: itemWord ? `i don't have ${itemWord} to smelt` : "tell me what to smelt" };

  const fuel = pickFuel();
  if (!fuel) return { ok: false, reason: "i don't have any fuel (coal, wood, etc)" };

  const furnace = await openFurnace(block);
  if (!furnace) return { ok: false, reason: `couldn't open the ${fname}` };

  const want = Number.isFinite(count) && count > 0 ? Math.min(count, input.count) : input.count;
  const inputName = input.name.replace(/_/g, " ");

  try {
    try { await furnace.putFuel(fuel.type, fuel.metadata == null ? null : fuel.metadata, Math.max(1, Math.ceil(want / 8))); }
    catch (e) { log.warn(`putFuel failed: ${e.message}`); }

    await furnace.putInput(input.type, input.metadata == null ? null : input.metadata, want);
    try { furnace.close(); } catch {}
    return { ok: true, reason: `smelting ${want}x ${inputName} in the ${fname}` };
  } catch (e) {
    try { furnace.close(); } catch {}
    return { ok: false, reason: `couldn't load the ${fname} (${e.message})` };
  }
}

export async function smeltStatus() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const block = findFurnace();
  if (!block) return { ok: false, reason: "no furnace nearby" };
  const fname = blockName(block).replace(/_/g, " ");

  const reached = await reachBlock(block);
  if (!reached.ok) return { ok: false, reason: `couldn't get to the ${fname}` };

  const furnace = await openFurnace(block);
  if (!furnace) return { ok: false, reason: `couldn't open the ${fname}` };

  try {
    const input = furnace.inputItem ? furnace.inputItem() : null;
    const fuel = furnace.fuelItem ? furnace.fuelItem() : null;
    const output = furnace.outputItem ? furnace.outputItem() : null;
    const progress = typeof furnace.progress === "number" ? Math.round(furnace.progress * 100) : null;
    try { furnace.close(); } catch {}

    if (!input && !output) return { ok: true, reason: `the ${fname} is empty` };
    const parts = [];
    if (input) parts.push(`${input.count}x ${input.name.replace(/_/g, " ")} cooking`);
    if (progress != null) parts.push(`${progress}% done`);
    if (output) parts.push(`${output.count}x ${output.name.replace(/_/g, " ")} ready to grab`);
    if (!fuel) parts.push("out of fuel");
    return { ok: true, reason: `${fname}: ${parts.join(", ")}` };
  } catch (e) {
    try { furnace.close(); } catch {}
    return { ok: false, reason: `couldn't read the ${fname}` };
  }
}

export async function collectSmelted() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const block = findFurnace();
  if (!block) return { ok: false, reason: "no furnace nearby" };
  const fname = blockName(block).replace(/_/g, " ");

  const reached = await reachBlock(block);
  if (!reached.ok) return { ok: false, reason: `couldn't get to the ${fname}` };

  const furnace = await openFurnace(block);
  if (!furnace) return { ok: false, reason: `couldn't open the ${fname}` };

  try {
    const output = furnace.outputItem ? furnace.outputItem() : null;
    if (!output) { try { furnace.close(); } catch {} return { ok: false, reason: `nothing's finished in the ${fname} yet` }; }
    const name = output.name.replace(/_/g, " ");
    const n = output.count;
    await furnace.takeOutput();
    try { furnace.close(); } catch {}
    return { ok: true, reason: `took ${n}x ${name} out of the ${fname}` };
  } catch (e) {
    try { furnace.close(); } catch {}
    return { ok: false, reason: `couldn't grab from the ${fname}` };
  }
}
