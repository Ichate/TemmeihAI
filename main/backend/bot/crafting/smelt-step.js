import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { SMELTABLES } from "./config.js";
import { countOf } from "../inventory/read.js";

export function smeltSourceFor(wantName) {
  const n = (wantName || "").toLowerCase();
  if (SMELTABLES[n]) return SMELTABLES[n];
  for (const out in SMELTABLES) {
    if (n.includes(out)) return SMELTABLES[out];
  }
  return null;
}

export function canSmeltInto(wantName) {
  const sources = smeltSourceFor(wantName);
  if (!sources) return 0;
  let total = 0;
  for (const s of sources) total += countOf(s);
  return total;
}

export async function smeltInto(wantName, count) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game", made: 0 };
  const sources = smeltSourceFor(wantName);
  if (!sources) return { ok: false, reason: `can't smelt anything into ${wantName}`, made: 0 };

  let source = null;
  for (const s of sources) {
    if (countOf(s) > 0) { source = s; break; }
  }
  if (!source) return { ok: false, reason: `i don't have anything to smelt into ${wantName}`, made: 0 };

  const want = Number.isFinite(count) && count > 0 ? count : countOf(source);
  const before = countOf(wantName);

  const { world } = await import("../world/index.js");
  const r = await world.smelt(source, want);
  if (!r.ok) return { ok: false, reason: r.reason, made: 0 };

  const deadline = Date.now() + Math.min(60000, 9000 + want * 9000);
  let collected = 0;
  while (Date.now() < deadline) {
    await delay(2500);
    if (!getBot()) break;
    const got = await world.collectSmelted();
    if (got && got.ok) {
      collected = countOf(wantName) - before;
      if (collected >= want) break;
    }
  }

  collected = countOf(wantName) - before;
  if (collected <= 0) return { ok: false, reason: `started smelting but nothing's ready yet`, made: 0 };
  return { ok: true, reason: `smelted ${collected}x ${wantName.replace(/_/g, " ")}`, made: collected };
}
