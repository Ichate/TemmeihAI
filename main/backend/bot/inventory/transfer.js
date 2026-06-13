import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { findItems, heldItem } from "./read.js";
import { movement } from "../movement/index.js";
import { GIVE_REACH, TOSS_GAP_MS } from "./config.js";

async function tossItem(item, count) {
  const bot = getBot();
  if (!bot) return 0;
  const want = count == null ? item.count : Math.min(count, item.count);
  try {
    await bot.toss(item.type, item.metadata == null ? null : item.metadata, want);
    return want;
  } catch (e) {
    log.warn(`toss failed: ${e.message}`);
    return 0;
  }
}

async function tossMatching(word, count) {
  const matches = findItems(word);
  if (!matches.length) return { tossed: 0, name: word };
  let remaining = count == null ? Infinity : count;
  let tossed = 0;
  const name = matches[0].name;
  for (const it of matches) {
    if (remaining <= 0) break;
    const take = count == null ? it.count : Math.min(remaining, it.count);
    const did = await tossItem(it, take);
    tossed += did;
    remaining -= did;
    await delay(TOSS_GAP_MS);
  }
  return { tossed, name };
}

export async function dropHeld() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const held = heldItem();
  if (!held) return { ok: false, reason: "i'm not holding anything" };
  const name = held.name.replace(/_/g, " ");
  const did = await tossItem(held, null);
  if (did <= 0) return { ok: false, reason: `couldn't drop the ${name}` };
  return { ok: true, reason: `dropped ${did}x ${name}` };
}

export async function dropItem(word, count) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  if (!word) return dropHeld();
  const { tossed, name } = await tossMatching(word, count);
  if (tossed <= 0) return { ok: false, reason: `i don't have any ${word}` };
  return { ok: true, reason: `dropped ${tossed}x ${name.replace(/_/g, " ")}` };
}

export async function dropAll(word) {
  return dropItem(word, null);
}

export async function dropEverything() {
  const bot = getBot();
  if (!bot || !bot.inventory) return { ok: false, reason: "not in game" };
  const items = bot.inventory.items();
  if (!items.length) return { ok: true, reason: "my inventory's already empty" };
  let dropped = 0;
  for (const it of items) {
    const did = await tossItem(it, null);
    dropped += did;
    await delay(TOSS_GAP_MS);
  }
  if (dropped <= 0) return { ok: false, reason: "couldn't drop anything" };
  return { ok: true, reason: `dropped everything (${dropped} items)` };
}

export async function giveToPlayer(name, word, count) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };

  if (!word) {
    const held = heldItem();
    if (!held) return { ok: false, reason: "i'm not holding anything to give" };
    word = held.name;
  }

  const have = findItems(word).reduce((s, it) => s + it.count, 0);
  if (have <= 0) return { ok: false, reason: `i don't have any ${word}` };

  const entity = movement.findPlayerEntity(name) || movement.nearestPlayerEntity();
  if (!entity || !entity.position) return { ok: false, reason: "i can't see who to give it to" };
  const who = entity.username || name || "you";

  const result = await movement.comeToPlayer(who);
  if (!result.ok) {
    return { ok: false, reason: `couldn't get to ${who} to hand it over` };
  }

  await delay(800);
  const target = movement.findPlayerEntity(who);
  if (target && target.position) {
    try { await bot.lookAt(target.position.offset(0, target.height ? target.height * 0.9 : 1.6, 0), true); } catch {}
  }

  const give = count == null ? have : Math.min(count, have);
  const { tossed, name: itemName } = await tossMatching(word, give);
  if (tossed <= 0) return { ok: false, reason: `tried to give ${who} some ${word} but couldn't` };

  const short = (count != null && tossed < count) ? ` (only had ${tossed})` : "";
  return { ok: true, reason: `gave ${who} ${tossed}x ${itemName.replace(/_/g, " ")}${short}` };
}
