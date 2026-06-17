import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { BED_SCAN_RADIUS, BED_REACH, SLEEP_NIGHT_MIN, SLEEP_NIGHT_MAX } from "./config.js";

function findBed() {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.findBlock) return null;
  try {
    return bot.findBlock({
      point: bot.entity.position,
      maxDistance: BED_SCAN_RADIUS,
      matching: (b) => b && b.name && b.name.includes("bed") && !b.name.includes("bedrock"),
    });
  } catch {
    return null;
  }
}

function isNight() {
  const bot = getBot();
  if (!bot || !bot.time) return false;
  const t = bot.time.timeOfDay;
  if (t == null) return false;
  return t >= SLEEP_NIGHT_MIN && t <= SLEEP_NIGHT_MAX;
}

export async function goSleep() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };

  const bed = findBed();
  if (!bed) return { ok: false, reason: "no bed nearby to sleep in" };

  if (bot.entity.position.distanceTo(bed.position.offset(0.5, 0.5, 0.5)) > BED_REACH) {
    try {
      const { movement } = await import("../movement/index.js");
      await Promise.race([
        movement.gotoCoords(bed.position.x + 0.5, bed.position.y, bed.position.z + 0.5, { tolerance: 2, label: "the bed", mode: "goto" }),
        delay(10000),
      ]);
    } catch {}
  }

  const fresh = findBed();
  if (!fresh) return { ok: false, reason: "lost track of the bed" };

  try {
    await bot.sleep(fresh);
    return { ok: true, reason: "tucked in for the night" };
  } catch (e) {
    const msg = (e && e.message ? e.message : "").toLowerCase();
    if (msg.includes("not night") || msg.includes("can only sleep")) {
      return { ok: false, reason: "i can only sleep at night or during a thunderstorm" };
    }
    if (msg.includes("monster") || msg.includes("too far")) {
      return { ok: false, reason: "can't sleep, monsters are nearby" };
    }
    if (msg.includes("occupied")) {
      return { ok: false, reason: "that bed's taken" };
    }
    log.warn(`sleep failed: ${e.message}`);
    return { ok: false, reason: "couldn't get into the bed" };
  }
}

export async function wakeUp() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  if (!bot.isSleeping) return { ok: true, reason: "i'm already up" };
  try {
    await bot.wake();
    return { ok: true, reason: "up and about" };
  } catch (e) {
    log.warn(`wake failed: ${e.message}`);
    return { ok: false, reason: "couldn't wake up properly" };
  }
}
