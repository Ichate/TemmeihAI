import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { makeGoalNear, gotoGoal, clearGoal } from "./pathfinder.js";
import { move, enterMode, resetToIdle } from "./controller.js";
import { ensureReady } from "./goals.js";
import { MODE, RIDE_SCAN_RADIUS, RIDE_MOUNT_REACH, RIDEABLE } from "./config.js";

function rideableName(entity) {
  if (!entity) return null;
  const n = (entity.name || entity.displayName || "").toLowerCase();
  if (!n) return null;
  if (RIDEABLE.has(n)) return n;
  if (n.includes("boat")) return "boat";
  if (n.includes("minecart")) return "minecart";
  return null;
}

export function findNearestVehicle() {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return null;
  const pos = bot.entity.position;
  let best = null;
  let bestDist = Infinity;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || !e.position || e === bot.entity) continue;
    if (!rideableName(e)) continue;
    const d = pos.distanceTo(e.position);
    if (d <= RIDE_SCAN_RADIUS && d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

export function isRiding() {
  const bot = getBot();
  return !!(bot && bot.vehicle);
}

export async function mountNearest() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  if (bot.vehicle) return { ok: false, reason: "already riding something" };

  const vehicle = findNearestVehicle();
  if (!vehicle) return { ok: false, reason: "no boat, minecart or rideable animal nearby" };

  const what = rideableName(vehicle) || "it";

  if (ensureReady(bot)) {
    const p = vehicle.position;
    const goal = makeGoalNear(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), RIDE_MOUNT_REACH);
    if (goal) {
      const entered = await enterMode(MODE.GOTO, { label: `the ${what}`, targetName: what });
      if (entered) {
        clearGoal(bot);
        try {
          await gotoGoal(bot, goal);
        } catch (e) {
          const msg = (e && e.message) || "";
          if (!/goalchanged|goal.?updated|changed|stopped/i.test(msg)) {
            await resetToIdle("could not reach vehicle");
            return { ok: false, reason: `couldn't get to the ${what}` };
          }
        }
        await resetToIdle("at vehicle");
      }
    }
  }

  const fresh = findNearestVehicle();
  const target = fresh || vehicle;
  try {
    bot.mount(target);
    await delay(500);
    if (bot.vehicle) return { ok: true, reason: `hopped on the ${what}` };
    return { ok: false, reason: `tried to get on the ${what} but couldn't` };
  } catch (e) {
    log.error(`mount failed: ${e.message}`);
    return { ok: false, reason: `couldn't get on the ${what}` };
  }
}

export async function dismount() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  if (!bot.vehicle) return { ok: false, reason: "not riding anything" };
  try {
    bot.dismount();
    await delay(400);
    return { ok: true, reason: "got off" };
  } catch (e) {
    log.error(`dismount failed: ${e.message}`);
    return { ok: false, reason: "couldn't get off" };
  }
}
