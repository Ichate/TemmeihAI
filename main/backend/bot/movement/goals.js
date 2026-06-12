import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import {
  loadPathfinder, buildMovements, makeGoalNear, makeGoalBlock,
  makeGoalFollow, makeGoalInvert, getMovements, gotoGoal, setDynamicGoal, clearGoal,
} from "./pathfinder.js";
import { move, enterMode, resetToIdle, setSpeed, narrate, rememberPosition, getLastPosition } from "./controller.js";
import { applyPathfinderSpeed } from "./actions.js";
import {
  MODE, SPEED, FOLLOW_DISTANCE, FOLLOW_LOST_TIMEOUT_MS, FOLLOW_MAX_RANGE,
  COME_DISTANCE, ESCORT_DISTANCE, TAIL_DISTANCE,
  GOTO_TOLERANCE, FLEE_DISTANCE, FLEE_SAMPLE_POINTS,
  FLEE_DURATION_MS, WANDER_GOAL_TOLERANCE, MODE_STOP_DISTANCE,
  CLIMB_SCAN_RADIUS, CLIMB_MIN_GAIN, DESCEND_SCAN_RADIUS, DESCEND_MIN_DROP,
  LIGHT_SCAN_RADIUS, NIGHT_LIGHT_THRESHOLD, DOOR_SCAN_RADIUS,
} from "./config.js";

export function ensureReady(bot) {
  if (!bot) return false;
  if (!bot.pathfinder) {
    if (!loadPathfinder(bot)) return false;
  }
  if (!getMovements()) buildMovements(bot);
  return !!bot.pathfinder;
}

export function findPlayerEntity(name) {
  const bot = getBot();
  if (!bot) return null;
  if (name) {
    const p = bot.players[name];
    if (p && p.entity) return p.entity;
    const lower = name.toLowerCase();
    for (const key in bot.players) {
      if (key.toLowerCase() === lower && bot.players[key].entity) return bot.players[key].entity;
    }
    return null;
  }
  return null;
}

export function nearestPlayerEntity() {
  const bot = getBot();
  if (!bot || !bot.entity) return null;
  const pos = bot.entity.position;
  let best = null;
  let bestDist = Infinity;
  for (const name in bot.players) {
    const p = bot.players[name];
    if (name === bot.username || !p.entity) continue;
    const d = pos.distanceTo(p.entity.position);
    if (d < bestDist) { bestDist = d; best = p.entity; }
  }
  return best;
}

export function allPlayerEntities() {
  const bot = getBot();
  const out = [];
  if (!bot) return out;
  for (const name in bot.players) {
    const p = bot.players[name];
    if (name === bot.username || !p.entity) continue;
    out.push(p.entity);
  }
  return out;
}

function applySpeedForMode(mode) {
  let speed = SPEED.WALK;
  if (mode === MODE.FLEE || mode === MODE.COME) speed = SPEED.SPRINT;
  setSpeed(speed);
  applyPathfinderSpeed(speed);
}

async function walkTo(goal, mode, label, opts = {}) {
  const bot = getBot();
  if (!ensureReady(bot)) return { ok: false, reason: "pathfinder unavailable" };
  if (!goal) return { ok: false, reason: "no valid destination" };

  if (bot.entity && !opts.skipRemember) rememberPosition(bot.entity.position);

  const entered = await enterMode(mode, { label, targetName: opts.targetName || null });
  if (!entered) return { ok: false, reason: "blocked by higher priority action" };

  clearGoal(bot);

  applySpeedForMode(mode);
  const myStart = Date.now();
  move.goalToken = myStart;

  let promise;
  try {
    promise = gotoGoal(bot, goal);
  } catch (e) {
    await resetToIdle("goto threw");
    return { ok: false, reason: (e && e.message) || "could not start" };
  }
  if (!promise || typeof promise.then !== "function") {
    await resetToIdle("no promise");
    return { ok: false, reason: "pathfinder did not start" };
  }

  promise.then(() => {
    if (move.goalToken !== myStart) return;
    log.info(`movement: arrived (${label})`);
    narrate(`reached ${label}`, "arrived");
    resetToIdle(`arrived ${label}`);
  }).catch((e) => {
    if (move.goalToken !== myStart) return;
    const msg = (e && e.message) || "no path";
    if (/goalchanged|goal.?updated|goal was changed|path was stopped/i.test(msg)) {
      log.info(`movement: ${label} interrupted (${msg})`);
      return;
    }
    log.warn(`movement: ${label} failed - ${msg}`);
    narrate(`couldn't get to ${label} (${msg})`, "nopath");
    resetToIdle(`failed ${label}`);
  });

  return { ok: true, reason: `heading to ${label}` };
}

function finite(n) {
  return typeof n === "number" && Number.isFinite(n);
}

export async function gotoCoords(x, y, z, opts = {}) {
  if (!finite(x) || !finite(z)) return { ok: false, reason: "invalid coordinates" };
  if (!finite(y)) {
    const bot = getBot();
    y = bot && bot.entity ? bot.entity.position.y : 64;
  }
  const tol = opts.tolerance ?? GOTO_TOLERANCE;
  const label = opts.label || `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
  const mode = opts.mode || MODE.GOTO;
  const goal = tol <= 0
    ? makeGoalBlock(Math.floor(x), Math.floor(y), Math.floor(z))
    : makeGoalNear(Math.floor(x), Math.floor(y), Math.floor(z), tol);
  return walkTo(goal, mode, label, { targetName: opts.targetName });
}

export async function comeToPlayer(name) {
  const entity = findPlayerEntity(name) || nearestPlayerEntity();
  if (!entity || !entity.position) return { ok: false, reason: "cannot see that player anywhere nearby" };
  const who = entity.username || name || "you";
  const p = entity.position;
  const goal = makeGoalNear(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), MODE_STOP_DISTANCE[MODE.COME] ?? COME_DISTANCE);
  return walkTo(goal, MODE.COME, `${who}`, { targetName: who });
}

export async function gotoPlayer(name) {
  const entity = findPlayerEntity(name) || nearestPlayerEntity();
  if (!entity || !entity.position) return { ok: false, reason: "cannot see that player" };
  const who = entity.username || name;
  const p = entity.position;
  const goal = makeGoalNear(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), COME_DISTANCE);
  return walkTo(goal, MODE.GOTO, `${who}`, { targetName: who });
}

export async function followPlayer(name, opts = {}) {
  const bot = getBot();
  if (!ensureReady(bot)) return { ok: false, reason: "pathfinder unavailable" };

  const entity = findPlayerEntity(name) || nearestPlayerEntity();
  if (!entity) return { ok: false, reason: "cannot see that player anywhere nearby" };

  const who = entity.username || name || "you";
  const mode = opts.mode || MODE.FOLLOW;
  const range = opts.distance ?? MODE_STOP_DISTANCE[mode] ?? FOLLOW_DISTANCE;

  const entered = await enterMode(mode, { label: `${who}`, target: entity, targetName: who });
  if (!entered) return { ok: false, reason: "blocked by higher priority action" };

  applySpeedForMode(mode);
  move.followName = who;
  move.followLostSince = 0;

  if (!setDynamicGoal(bot, makeGoalFollow(entity, range))) {
    await resetToIdle("follow setGoal failed");
    return { ok: false, reason: "could not start following" };
  }
  return { ok: true, reason: mode === MODE.TAIL ? `tailing ${who}` : `following ${who}` };
}

export async function tailPlayer(name) {
  return followPlayer(name, { mode: MODE.TAIL, distance: TAIL_DISTANCE });
}

export async function escortPlayer(name) {
  return followPlayer(name, { mode: MODE.ESCORT, distance: ESCORT_DISTANCE });
}

export async function guardSpot(x, y, z, opts = {}) {
  const bot = getBot();
  if (!ensureReady(bot)) return { ok: false, reason: "pathfinder unavailable" };

  let gx = x, gy = y, gz = z;
  if (gx == null || !Number.isFinite(gx)) {
    if (!bot.entity) return { ok: false, reason: "not in game yet" };
    const p = bot.entity.position; gx = p.x; gy = p.y; gz = p.z;
  }

  const entered = await enterMode(MODE.GUARD, {
    label: `guard ${Math.round(gx)},${Math.round(gz)}`,
    targetName: opts.label || "this spot",
  });
  if (!entered) return { ok: false, reason: "blocked by higher priority action" };

  move.guardPos = { x: gx, y: gy, z: gz };
  applySpeedForMode(MODE.GUARD);
  clearGoal(bot);
  return { ok: true, reason: "staying put here" };
}

export async function gatherToGroup() {
  const players = allPlayerEntities().filter(p => p && p.position);
  if (!players.length) return { ok: false, reason: "no players around to gather to" };
  let sx = 0, sy = 0, sz = 0;
  for (const p of players) { sx += p.position.x; sy += p.position.y; sz += p.position.z; }
  const n = players.length;
  const goal = makeGoalNear(Math.floor(sx / n), Math.floor(sy / n), Math.floor(sz / n), MODE_STOP_DISTANCE[MODE.GATHER] ?? COME_DISTANCE);
  return walkTo(goal, MODE.GATHER, "the group", { targetName: "everyone" });
}

export async function fleeFrom(threatPos, opts = {}) {
  const bot = getBot();
  if (!ensureReady(bot) || !bot.entity) return { ok: false, reason: "pathfinder unavailable" };

  const from = threatPos || nearestThreatPosition();
  if (!from) return { ok: false, reason: "nothing to flee from" };

  const dest = opts.retreat ? pickRetreatPoint(bot.entity.position, from) : pickFleePoint(bot.entity.position, from);
  const goal = dest
    ? makeGoalNear(Math.floor(dest.x), Math.floor(dest.y), Math.floor(dest.z), WANDER_GOAL_TOLERANCE)
    : makeGoalInvert(makeGoalNear(Math.floor(from.x), Math.floor(from.y), Math.floor(from.z), FLEE_DISTANCE));

  const r = await walkTo(goal, MODE.FLEE, "safety", { targetName: opts.label || "threat" });
  move.fleeUntil = Date.now() + (opts.duration ?? FLEE_DURATION_MS);
  return r.ok ? { ok: true, reason: "running from danger" } : r;
}

function pickFleePoint(self, threat) {
  const dx = self.x - threat.x;
  const dz = self.z - threat.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  return { x: self.x + (dx / len) * FLEE_DISTANCE, y: self.y, z: self.z + (dz / len) * FLEE_DISTANCE };
}

function pickRetreatPoint(self, threat) {
  const bot = getBot();
  const base = pickFleePoint(self, threat);
  if (!bot) return base;
  let best = base;
  let bestY = self.y;
  for (let i = 0; i < FLEE_SAMPLE_POINTS; i++) {
    const angle = Math.atan2(self.z - threat.z, self.x - threat.x) + (i % 2 === 0 ? 1 : -1) * (Math.floor(i / 2) * (Math.PI / 6));
    const tx = self.x + Math.cos(angle) * FLEE_DISTANCE;
    const tz = self.z + Math.sin(angle) * FLEE_DISTANCE;
    try {
      const Vec = self.constructor;
      const top = bot.blockAt(new Vec(Math.floor(tx), Math.floor(self.y + 3), Math.floor(tz)));
      if (top && top.name && top.name !== "air" && self.y + 3 > bestY) {
        bestY = self.y + 3; best = { x: tx, y: self.y + 3, z: tz };
      }
    } catch {}
  }
  return best;
}

function nearestThreatPosition() {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return null;
  const pos = bot.entity.position;
  let best = null;
  let bestDist = Infinity;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || !e.position || e === bot.entity) continue;
    if (e.type !== "mob" && e.type !== "hostile" && !e.kind) continue;
    const d = pos.distanceTo(e.position);
    if (d < bestDist) { bestDist = d; best = e.position; }
  }
  return best;
}

export async function stop(reason = "told to stop") {
  const bot = getBot();
  clearGoal(bot);
  await resetToIdle(reason);
  return { ok: true, reason: "stopped" };
}

export async function returnToPrevious() {
  const prev = getLastPosition();
  if (!prev) return { ok: false, reason: "i don't remember where i was" };
  const goal = makeGoalNear(Math.floor(prev.x), Math.floor(prev.y), Math.floor(prev.z), GOTO_TOLERANCE);
  return walkTo(goal, MODE.GOTO, "back where i was", { targetName: "previous spot", skipRemember: true });
}

function blockName(bot, x, y, z) {
  try {
    const Vec = bot.entity.position.constructor;
    const b = bot.blockAt(new Vec(Math.floor(x), Math.floor(y), Math.floor(z)));
    return b && b.name ? b.name.toLowerCase() : "air";
  } catch {
    return "air";
  }
}

function isStandable(bot, x, y, z) {
  const feet = blockName(bot, x, y, z);
  const head = blockName(bot, x, y + 1, z);
  const ground = blockName(bot, x, y - 1, z);
  if (feet !== "air" && feet !== "water" && !feet.includes("grass") && !feet.includes("flower")) return false;
  if (head !== "air" && head !== "water" && !head.includes("grass")) return false;
  if (ground === "air" || ground.includes("lava")) return false;
  return true;
}

export async function climbHighGround() {
  const bot = getBot();
  if (!ensureReady(bot) || !bot.entity) return { ok: false, reason: "pathfinder unavailable" };
  const origin = bot.entity.position;
  let best = null;
  let bestY = origin.y + CLIMB_MIN_GAIN - 1;
  for (let dx = -CLIMB_SCAN_RADIUS; dx <= CLIMB_SCAN_RADIUS; dx += 2) {
    for (let dz = -CLIMB_SCAN_RADIUS; dz <= CLIMB_SCAN_RADIUS; dz += 2) {
      for (let dy = CLIMB_SCAN_RADIUS; dy >= CLIMB_MIN_GAIN; dy--) {
        const x = origin.x + dx, y = origin.y + dy, z = origin.z + dz;
        if (isStandable(bot, x, y, z)) {
          if (y > bestY) { bestY = y; best = { x, y, z }; }
          break;
        }
      }
    }
  }
  if (!best) return { ok: false, reason: "no higher ground i can reach nearby" };
  const goal = makeGoalNear(Math.floor(best.x), Math.floor(best.y), Math.floor(best.z), 1);
  return walkTo(goal, MODE.GOTO, "high ground", { targetName: "high ground" });
}

export async function descendSafely() {
  const bot = getBot();
  if (!ensureReady(bot) || !bot.entity) return { ok: false, reason: "pathfinder unavailable" };
  const origin = bot.entity.position;
  let best = null;
  let bestY = origin.y - DESCEND_MIN_DROP + 1;
  for (let dx = -DESCEND_SCAN_RADIUS; dx <= DESCEND_SCAN_RADIUS; dx += 2) {
    for (let dz = -DESCEND_SCAN_RADIUS; dz <= DESCEND_SCAN_RADIUS; dz += 2) {
      for (let dy = -DESCEND_MIN_DROP; dy >= -DESCEND_SCAN_RADIUS; dy--) {
        const x = origin.x + dx, y = origin.y + dy, z = origin.z + dz;
        if (isStandable(bot, x, y, z)) {
          if (y < bestY) { bestY = y; best = { x, y, z }; }
          break;
        }
      }
    }
  }
  if (!best) return { ok: false, reason: "no safe way down nearby" };
  const goal = makeGoalNear(Math.floor(best.x), Math.floor(best.y), Math.floor(best.z), 1);
  return walkTo(goal, MODE.GOTO, "lower ground", { targetName: "lower ground" });
}

export async function jumpToPlayer(name) {
  const entity = findPlayerEntity(name) || nearestPlayerEntity();
  if (!entity || !entity.position) return { ok: false, reason: "cannot see that player" };
  const who = entity.username || name || "you";
  const p = entity.position;
  const goal = makeGoalNear(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), 1);
  return walkTo(goal, MODE.GOTO, `up to ${who}`, { targetName: who });
}

export async function comeToHurtPlayer() {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  let target = null;
  let lowest = Infinity;
  for (const nm in bot.players) {
    const p = bot.players[nm];
    if (nm === bot.username || !p.entity || !p.entity.position) continue;
    const hp = p.entity.health;
    if (typeof hp === "number" && hp < lowest && hp < 20) { lowest = hp; target = p.entity; }
  }
  if (!target) {
    const near = nearestPlayerEntity();
    if (!near) return { ok: false, reason: "nobody around to check on" };
    target = near;
  }
  const who = target.username || "them";
  const p = target.position;
  const goal = makeGoalNear(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), COME_DISTANCE);
  return walkTo(goal, MODE.COME, `${who}`, { targetName: who });
}

export async function seekLight() {
  const bot = getBot();
  if (!ensureReady(bot) || !bot.entity) return { ok: false, reason: "pathfinder unavailable" };
  const origin = bot.entity.position;
  const lightBlocks = ["torch", "wall_torch", "lantern", "glowstone", "sea_lantern", "shroomlight", "campfire", "soul_lantern", "jack_o_lantern", "redstone_lamp", "beacon", "end_rod", "lava"];
  let target = null;
  try {
    if (bot.findBlock) {
      const block = bot.findBlock({
        point: origin,
        maxDistance: LIGHT_SCAN_RADIUS,
        matching: (b) => b && b.name && lightBlocks.includes(b.name.toLowerCase()) && b.name.toLowerCase() !== "lava",
      });
      if (block) target = { x: block.position.x, y: block.position.y, z: block.position.z };
    }
  } catch {}
  if (!target) return { ok: false, reason: "no light source nearby, staying alert" };
  const goal = makeGoalNear(Math.floor(target.x), Math.floor(target.y) + 1, Math.floor(target.z), 2);
  return walkTo(goal, MODE.SEEKLIGHT, "the light", { targetName: "light" });
}

export async function goToDoor(opts = {}) {
  const bot = getBot();
  if (!ensureReady(bot) || !bot.entity) return { ok: false, reason: "pathfinder unavailable" };
  const origin = bot.entity.position;
  let target = null;
  try {
    if (bot.findBlock) {
      const block = bot.findBlock({
        point: origin,
        maxDistance: DOOR_SCAN_RADIUS,
        matching: (b) => b && b.name && (b.name.toLowerCase().includes("_door") || b.name.toLowerCase().includes("fence_gate")),
      });
      if (block) target = block.position;
    }
  } catch {}
  if (!target) return { ok: false, reason: "no door nearby" };
  const label = opts.leave ? "out the door" : "through the door";
  const goal = makeGoalNear(Math.floor(target.x), Math.floor(target.y), Math.floor(target.z), 1);
  return walkTo(goal, MODE.GOTO, label, { targetName: "door" });
}

export { FOLLOW_LOST_TIMEOUT_MS, FOLLOW_MAX_RANGE };
