import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import {
  MODE, WANDER_MIN_RADIUS, WANDER_MAX_RADIUS, WANDER_VERTICAL_RANGE,
  WANDER_INTERVAL_MIN_MS, WANDER_INTERVAL_MAX_MS, WANDER_GOAL_TOLERANCE,
  WANDER_POI_CHANCE, WANDER_PAUSE_CHANCE, WANDER_PAUSE_MS, WANDER_NIGHT_SLOWDOWN,
  WANDER_RETREAD_MEMORY, WANDER_RETREAD_MIN_DIST, WANDER_IDLE_GRACE_MS,
  HOME_DRIFT_MAX,
} from "./config.js";
import { move, currentMode } from "./controller.js";
import { gotoCoords, nearestPlayerEntity } from "./goals.js";
import { pickPointOfInterest } from "./poi.js";
import { lookAround } from "./actions.js";

let wanderTimer = null;
let enabled = false;
let homePoint = null;
const recent = [];

export function startWander() {
  enabled = true;
  scheduleNext();
}

export function stopWander() {
  enabled = false;
  if (wanderTimer) {
    clearTimeout(wanderTimer);
    wanderTimer = null;
  }
}

export function isWanderEnabled() {
  return enabled;
}

export function setHomePoint(pos) {
  if (pos) homePoint = { x: pos.x, y: pos.y, z: pos.z };
}

export function resetHomePoint() {
  homePoint = null;
  recent.length = 0;
}

function scheduleNext() {
  if (wanderTimer) clearTimeout(wanderTimer);
  let wait = WANDER_INTERVAL_MIN_MS + Math.random() * (WANDER_INTERVAL_MAX_MS - WANDER_INTERVAL_MIN_MS);
  if (isNight()) wait *= WANDER_NIGHT_SLOWDOWN;
  wanderTimer = setTimeout(() => {
    tick().catch((e) => { log.warn(`wander tick failed: ${e.message}`); scheduleNext(); });
  }, wait);
}

function isNight() {
  const bot = getBot();
  const tod = bot?.time?.timeOfDay;
  if (tod == null) return false;
  return tod >= 13000 && tod < 23000;
}

async function tick() {
  if (!enabled) { return; }
  const bot = getBot();
  if (!bot || !bot.entity) { scheduleNext(); return; }
  if (currentMode() !== MODE.IDLE || state.responding) { scheduleNext(); return; }
  if (Date.now() - (state.lastActivity || 0) < WANDER_IDLE_GRACE_MS) { scheduleNext(); return; }

  if (!homePoint) setHomePoint(bot.entity.position);

  if (Math.random() < WANDER_PAUSE_CHANCE) {
    await lookAround(2 + Math.floor(Math.random() * 2));
    await new Promise(r => setTimeout(r, WANDER_PAUSE_MS));
    scheduleNext();
    return;
  }

  const target = pickWanderTarget(bot);
  if (target) {
    rememberSpot(target);
    const r = await gotoCoords(target.x, target.y, target.z, {
      tolerance: WANDER_GOAL_TOLERANCE,
      label: target.label || "wandering",
      mode: MODE.WANDER,
    });
    if (r.ok) {
      log.info(`wander: ${target.label || "roaming"} at ${Math.round(target.x)},${Math.round(target.z)}`);
    }
  }
  scheduleNext();
}

function pickWanderTarget(bot) {
  const origin = bot.entity.position;

  if (homePoint) {
    const drift = Math.sqrt(
      (origin.x - homePoint.x) ** 2 + (origin.z - homePoint.z) ** 2
    );
    if (drift > HOME_DRIFT_MAX) {
      return { x: homePoint.x, y: homePoint.y, z: homePoint.z, label: "heading back home" };
    }
  }

  if (isNight() && homePoint && Math.random() < 0.6) {
    return { x: homePoint.x, y: homePoint.y, z: homePoint.z, label: "staying near home for the night" };
  }

  if (Math.random() < WANDER_POI_CHANCE) {
    const poi = pickPointOfInterest();
    if (poi && !tooRecent(poi)) {
      return { x: poi.x, y: poi.y, z: poi.z, label: `checking out ${poi.label}` };
    }
  }

  if (Math.random() < 0.3) {
    const player = nearestPlayerEntity();
    if (player && player.position) {
      const d = origin.distanceTo(player.position);
      if (d > 6 && d < 48) {
        const j = jitterAround(player.position, 2, 5);
        if (!tooRecent(j)) return { ...j, label: "drifting toward a player" };
      }
    }
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = WANDER_MIN_RADIUS + Math.random() * (WANDER_MAX_RADIUS - WANDER_MIN_RADIUS);
    const x = origin.x + Math.cos(angle) * radius;
    const z = origin.z + Math.sin(angle) * radius;
    const yOffset = Math.floor((Math.random() - 0.5) * 2 * WANDER_VERTICAL_RANGE);
    const candidate = { x, y: origin.y + yOffset, z };
    if (isPlausible(bot, candidate) && !tooRecent(candidate)) return candidate;
  }
  return null;
}

function jitterAround(pos, min, max) {
  const angle = Math.random() * Math.PI * 2;
  const radius = min + Math.random() * (max - min);
  return { x: pos.x + Math.cos(angle) * radius, y: pos.y, z: pos.z + Math.sin(angle) * radius };
}

function rememberSpot(p) {
  recent.push({ x: p.x, z: p.z });
  while (recent.length > WANDER_RETREAD_MEMORY) recent.shift();
}

function tooRecent(p) {
  for (const r of recent) {
    const d = Math.sqrt((p.x - r.x) ** 2 + (p.z - r.z) ** 2);
    if (d < WANDER_RETREAD_MIN_DIST) return true;
  }
  return false;
}

function isPlausible(bot, candidate) {
  try {
    const Vec = bot.entity.position.constructor;
    const feet = new Vec(Math.floor(candidate.x), Math.floor(candidate.y), Math.floor(candidate.z));
    const block = bot.blockAt(feet);
    if (!block) return true;
    const name = (block.name || "").toLowerCase();
    if (name.includes("lava")) return false;
    return true;
  } catch {
    return true;
  }
}
