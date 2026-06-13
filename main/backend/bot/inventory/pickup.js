import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { allItems, isFull, freeSlots } from "./read.js";
import { itemValue } from "./value.js";
import { movement } from "../movement/index.js";
import { PICKUP_SCAN_RADIUS, PICKUP_REACH, SMART_SWAP_MIN_GAP, TOSS_GAP_MS } from "./config.js";

function droppedItemName(entity) {
  if (!entity) return null;
  try {
    const d = entity.getDroppedItem && entity.getDroppedItem();
    if (d && d.name) return d.name;
  } catch {}
  const n = (entity.name || "").toLowerCase();
  if (n === "item" || n === "item_stack") return "item";
  return null;
}

export function nearbyDroppedItems() {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return [];
  const pos = bot.entity.position;
  const out = [];
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || !e.position) continue;
    const name = droppedItemName(e);
    if (!name) continue;
    const dist = pos.distanceTo(e.position);
    if (dist > PICKUP_SCAN_RADIUS) continue;
    out.push({ entity: e, name, dist, value: itemValue(name) });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

function lowestValueStack() {
  const items = allItems();
  if (!items.length) return null;
  let worst = items[0];
  let worstVal = itemValue(worst.name);
  for (const it of items) {
    const v = itemValue(it.name);
    if (v < worstVal) { worstVal = v; worst = it; }
  }
  return { item: worst, value: worstVal };
}

async function walkToItem(entity) {
  if (!entity || !entity.position) return false;
  const p = entity.position;
  const r = await movement.gotoCoords(p.x, p.y, p.z, { tolerance: PICKUP_REACH, label: "the item", mode: "goto" });
  return !!(r && r.ok);
}

export async function pickUpNearest(opts = {}) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };

  const items = nearbyDroppedItems();
  if (!items.length) return { ok: false, reason: "no items on the ground nearby" };

  const target = opts.preferValuable
    ? items.slice().sort((a, b) => b.value - a.value || a.dist - b.dist)[0]
    : items[0];

  const niceName = target.name.replace(/_/g, " ");

  if (isFull()) {
    const swap = await makeRoomFor(target.value);
    if (!swap.ok) {
      return { ok: false, reason: `my inventory's full and nothing's worth dropping for ${niceName}` };
    }
  }

  const reached = await walkToItem(target.entity);
  if (!reached) return { ok: false, reason: `couldn't get to the ${niceName}` };
  await delay(600);
  return { ok: true, reason: `grabbed the ${niceName}` };
}

export async function makeRoomFor(incomingValue) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  if (freeSlots() > 0) return { ok: true, reason: "already had room" };

  const worst = lowestValueStack();
  if (!worst) return { ok: false, reason: "nothing to drop" };

  if (worst.value + SMART_SWAP_MIN_GAP > incomingValue) {
    return { ok: false, reason: "what i'm carrying is worth more than that" };
  }

  const name = worst.item.name.replace(/_/g, " ");
  try {
    await bot.toss(worst.item.type, worst.item.metadata == null ? null : worst.item.metadata, worst.item.count);
    await delay(TOSS_GAP_MS);
    return { ok: true, reason: `dropped ${name} to make room` };
  } catch (e) {
    log.warn(`smart swap toss failed: ${e.message}`);
    return { ok: false, reason: "couldn't drop the junk" };
  }
}

export async function pickUpValuableIfWorthIt() {
  const items = nearbyDroppedItems();
  if (!items.length) return { ok: false, reason: "nothing nearby" };
  const best = items.slice().sort((a, b) => b.value - a.value)[0];

  if (!isFull()) {
    return pickUpNearest({ preferValuable: true });
  }

  const worst = lowestValueStack();
  if (!worst) return { ok: false, reason: "nothing to compare" };
  if (best.value <= worst.value + SMART_SWAP_MIN_GAP) {
    return { ok: false, reason: "nothing on the ground worth swapping for" };
  }
  return pickUpNearest({ preferValuable: true });
}
