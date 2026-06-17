import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { TRADE_SCAN_RADIUS, TRADE_REACH, TRADE_OPEN_TIMEOUT_MS } from "./config.js";
import { itemMatchesWord } from "../inventory/match.js";

function findVillager() {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return null;
  let best = null;
  let bestDist = TRADE_SCAN_RADIUS;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || !e.position) continue;
    const n = (e.name || "").toLowerCase();
    if (n !== "villager" && n !== "wandering_trader") continue;
    const d = bot.entity.position.distanceTo(e.position);
    if (d <= bestDist) { bestDist = d; best = e; }
  }
  return best;
}

async function reachVillager(entity) {
  const bot = getBot();
  if (!bot || !entity || !entity.position) return false;
  if (bot.entity.position.distanceTo(entity.position) <= TRADE_REACH) return true;
  try {
    const { movement } = await import("../movement/index.js");
    const p = entity.position;
    await Promise.race([
      movement.gotoCoords(p.x, p.y, p.z, { tolerance: 2, label: "the villager", mode: "goto" }),
      delay(10000),
    ]);
  } catch {}
  return bot.entity.position.distanceTo(entity.position) <= TRADE_REACH + 1;
}

async function openVillager(entity) {
  const bot = getBot();
  if (typeof bot.openVillager !== "function") return null;
  try {
    return await Promise.race([
      bot.openVillager(entity),
      delay(TRADE_OPEN_TIMEOUT_MS).then(() => { throw new Error("open timed out"); }),
    ]);
  } catch (e) {
    log.warn(`villager open failed: ${e.message}`);
    return null;
  }
}

function tradeDesc(trade) {
  try {
    const ins = (trade.inputs || (trade.inputItem ? [trade.inputItem, trade.inputItem2].filter(Boolean) : []))
      .map(i => `${i.count || 1} ${(i.displayName || i.name || "item").toString().replace(/_/g, " ")}`);
    const out = trade.outputItem ? `${trade.outputItem.count || 1} ${(trade.outputItem.displayName || trade.outputItem.name || "item").toString().replace(/_/g, " ")}` : "something";
    return `${ins.join(" + ")} -> ${out}`;
  } catch {
    return "a trade";
  }
}

export async function listTrades() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const villager = findVillager();
  if (!villager) return { ok: false, reason: "no villager or trader nearby" };
  if (!await reachVillager(villager)) return { ok: false, reason: "couldn't get to the villager" };
  const win = await openVillager(villager);
  if (!win) return { ok: false, reason: "couldn't open the villager's trades" };
  try {
    const trades = win.trades || [];
    if (!trades.length) { try { win.close(); } catch {} return { ok: true, reason: "this villager has no trades" }; }
    const lines = trades.slice(0, 8).map(tradeDesc);
    try { win.close(); } catch {}
    return { ok: true, reason: `trades: ${lines.join("; ")}` };
  } catch (e) {
    try { win.close(); } catch {}
    return { ok: false, reason: "couldn't read the trades" };
  }
}

export async function doTrade(wantWord, count) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const villager = findVillager();
  if (!villager) return { ok: false, reason: "no villager or trader nearby" };
  if (!await reachVillager(villager)) return { ok: false, reason: "couldn't get to the villager" };
  const win = await openVillager(villager);
  if (!win) return { ok: false, reason: "couldn't open the villager's trades" };

  try {
    const trades = win.trades || [];
    if (!trades.length) { try { win.close(); } catch {} return { ok: false, reason: "this villager has nothing to trade" }; }

    let index = -1;
    if (wantWord) {
      index = trades.findIndex(t => t.outputItem && itemMatchesWord(t.outputItem.name, wantWord));
    } else {
      index = 0;
    }
    if (index < 0) { try { win.close(); } catch {} return { ok: false, reason: `this villager doesn't sell ${wantWord}` }; }

    const trade = trades[index];
    if (trade.tradeDisabled) { try { win.close(); } catch {} return { ok: false, reason: "that trade's locked right now" }; }

    const times = Number.isFinite(count) && count > 0 ? count : 1;
    const outName = (trade.outputItem.displayName || trade.outputItem.name || "item").toString().replace(/_/g, " ");
    try {
      await bot.trade(win, index, times);
      try { win.close(); } catch {}
      return { ok: true, reason: `traded for ${times}x ${outName}` };
    } catch (e) {
      try { win.close(); } catch {}
      const msg = (e && e.message ? e.message : "").toLowerCase();
      if (msg.includes("enough")) return { ok: false, reason: `i don't have enough to trade for ${outName}` };
      return { ok: false, reason: `couldn't complete the trade for ${outName}` };
    }
  } catch (e) {
    try { win.close(); } catch {}
    return { ok: false, reason: "something went wrong trading" };
  }
}
