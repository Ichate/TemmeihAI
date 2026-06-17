import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { FISH_CAST_SETTLE_MS, FISH_REEL_GAP_MS, FISH_WATER_SCAN } from "./config.js";
import { findItems } from "../inventory/read.js";

let fishing = false;
let stopRequested = false;

export function isFishing() { return fishing; }

function hasRod() {
  return findItems("fishing_rod").length > 0;
}

function waterInFront() {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.findBlock) return false;
  try {
    const w = bot.findBlock({
      point: bot.entity.position,
      maxDistance: FISH_WATER_SCAN,
      matching: (b) => b && b.name === "water",
    });
    return !!w;
  } catch {
    return false;
  }
}

async function equipRod() {
  const bot = getBot();
  const rod = findItems("fishing_rod")[0];
  if (!rod) return false;
  try {
    if (!bot.heldItem || bot.heldItem.name !== rod.name) await bot.equip(rod, "hand");
    return true;
  } catch (e) {
    log.warn(`rod equip failed: ${e.message}`);
    return false;
  }
}

export async function startFishing(times) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  if (fishing) return { ok: false, reason: "i'm already fishing" };
  if (!hasRod()) return { ok: false, reason: "i don't have a fishing rod" };
  if (!waterInFront()) return { ok: false, reason: "there's no water near me to fish in" };
  if (typeof bot.fish !== "function") return { ok: false, reason: "i can't fish on this setup" };

  const want = Number.isFinite(times) && times > 0 ? times : 0;
  fishing = true;
  stopRequested = false;

  (async () => {
    let caught = 0;
    try {
      while (fishing && !stopRequested && getBot()) {
        if (state.combatMode && state.combatMode !== "idle") break;
        if (!await equipRod()) break;
        try {
          const w = getBot().findBlock({
            point: getBot().entity.position,
            maxDistance: FISH_WATER_SCAN,
            matching: (b) => b && b.name === "water",
          });
          if (w) await getBot().lookAt(w.position.offset(0.5, 1, 0.5), true);
        } catch {}
        await delay(FISH_CAST_SETTLE_MS);
        try {
          await getBot().fish();
          caught += 1;
        } catch (e) {
          log.warn(`fish failed: ${e.message}`);
          try { getBot().activateItem(); getBot().deactivateItem(); } catch {}
        }
        if (want && caught >= want) break;
        await delay(FISH_REEL_GAP_MS);
      }
    } catch (e) {
      log.warn(`fishing loop error: ${e.message}`);
    } finally {
      fishing = false;
      try { getBot() && getBot().deactivateItem(); } catch {}
    }
  })();

  return { ok: true, reason: want ? `fishing for ${want} catches` : "fishing, tell me to stop when you want" };
}

export function stopFishing() {
  if (!fishing) return { ok: true, reason: "i wasn't fishing" };
  stopRequested = true;
  fishing = false;
  const bot = getBot();
  try { if (bot) bot.deactivateItem(); } catch {}
  return { ok: true, reason: "stopped fishing" };
}
