import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { makeGoalNear, gotoGoal, clearGoal } from "./pathfinder.js";
import { move, enterMode, resetToIdle, narrate } from "./controller.js";
import { ensureReady } from "./goals.js";
import { MODE, WAYPOINT_REACH, PATROL_REACH, PATROL_PAUSE_MS, QUEUE_REACH } from "./config.js";

const waypoints = new Map();
let routeToken = 0;

export function saveWaypoint(name, pos) {
  if (!name || !pos) return { ok: false, reason: "need a name and a spot" };
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return { ok: false, reason: "bad position" };
  const key = String(name).toLowerCase().trim();
  if (!key) return { ok: false, reason: "need a name" };
  waypoints.set(key, { x: pos.x, y: pos.y, z: pos.z, label: name });
  return { ok: true, reason: `saved this spot as "${name}"` };
}

export function saveCurrentAs(name) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  return saveWaypoint(name, bot.entity.position);
}

export function listWaypoints() {
  return Array.from(waypoints.values()).map(w => w.label);
}

export function getWaypoint(name) {
  if (!name) return null;
  return waypoints.get(String(name).toLowerCase().trim()) || null;
}

export function clearWaypoints() {
  waypoints.clear();
}

async function arriveAt(bot, x, y, z, reach) {
  const goal = makeGoalNear(Math.floor(x), Math.floor(y), Math.floor(z), reach);
  if (!goal) throw new Error("bad goal");
  await gotoGoal(bot, goal);
}

export async function gotoWaypoint(name) {
  const bot = getBot();
  if (!ensureReady(bot)) return { ok: false, reason: "pathfinder unavailable" };
  const wp = getWaypoint(name);
  if (!wp) return { ok: false, reason: `i don't have a spot called "${name}"` };

  const entered = await enterMode(MODE.GOTO, { label: wp.label, targetName: wp.label });
  if (!entered) return { ok: false, reason: "blocked by higher priority action" };

  const myStart = Date.now();
  move.goalToken = myStart;
  clearGoal(bot);

  arriveAt(bot, wp.x, wp.y, wp.z, WAYPOINT_REACH).then(() => {
    if (move.goalToken !== myStart) return;
    narrate(`got to ${wp.label}`, "arrived");
    resetToIdle(`reached ${wp.label}`);
  }).catch((e) => {
    if (move.goalToken !== myStart) return;
    const msg = (e && e.message) || "no path";
    if (/goalchanged|goal.?updated|changed|stopped/i.test(msg)) return;
    narrate(`couldn't get to ${wp.label}`, "nopath");
    resetToIdle(`failed ${wp.label}`);
  });
  return { ok: true, reason: `heading to ${wp.label}` };
}

function resolveStops(names) {
  const stops = [];
  for (const n of names) {
    const wp = getWaypoint(n);
    if (wp) stops.push(wp);
  }
  return stops;
}

export async function runQueue(names, opts = {}) {
  const bot = getBot();
  if (!ensureReady(bot)) return { ok: false, reason: "pathfinder unavailable" };
  if (!Array.isArray(names) || !names.length) return { ok: false, reason: "give me a list of spots to visit" };

  const stops = resolveStops(names);
  if (!stops.length) return { ok: false, reason: "i don't know any of those spots" };

  const entered = await enterMode(MODE.QUEUE, { label: stops.map(s => s.label).join(" -> "), targetName: "route" });
  if (!entered) return { ok: false, reason: "blocked by higher priority action" };

  routeToken += 1;
  const myToken = routeToken;
  move.goalToken = Date.now();

  (async () => {
    const sequence = opts.returnToStart && bot.entity
      ? [...stops, { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z, label: "start" }]
      : stops;
    for (const stop of sequence) {
      if (myToken !== routeToken || move.mode !== MODE.QUEUE) return;
      try {
        await arriveAt(bot, stop.x, stop.y, stop.z, QUEUE_REACH);
      } catch (e) {
        if (myToken !== routeToken) return;
        narrate(`couldn't reach ${stop.label} on the route`, "nopath");
        await resetToIdle("queue failed");
        return;
      }
    }
    if (myToken !== routeToken) return;
    narrate("finished the route", "arrived");
    await resetToIdle("queue done");
  })();

  return { ok: true, reason: `running the route: ${stops.map(s => s.label).join(", ")}` };
}

export async function startPatrol(names) {
  const bot = getBot();
  if (!ensureReady(bot)) return { ok: false, reason: "pathfinder unavailable" };

  let stops = resolveStops(names || []);
  if (stops.length < 2) return { ok: false, reason: "i need at least two saved spots to patrol between" };

  const entered = await enterMode(MODE.PATROL, { label: stops.map(s => s.label).join(" <-> "), targetName: "patrol" });
  if (!entered) return { ok: false, reason: "blocked by higher priority action" };

  routeToken += 1;
  const myToken = routeToken;
  move.goalToken = Date.now();

  (async () => {
    let i = 0;
    while (myToken === routeToken && move.mode === MODE.PATROL) {
      const stop = stops[i % stops.length];
      i += 1;
      try {
        await arriveAt(bot, stop.x, stop.y, stop.z, PATROL_REACH);
      } catch (e) {
        if (myToken !== routeToken) return;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      if (myToken !== routeToken || move.mode !== MODE.PATROL) return;
      await new Promise(r => setTimeout(r, PATROL_PAUSE_MS));
    }
  })();

  return { ok: true, reason: `patrolling between ${stops.map(s => s.label).join(" and ")}` };
}

export function cancelRoutes() {
  routeToken += 1;
}
