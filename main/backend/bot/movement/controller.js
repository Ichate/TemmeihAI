import { state } from "../ctx.js";
import { log } from "../log.js";
import { MODE, PRIORITY, SPEED } from "./config.js";
import { stopAllActions } from "./actions.js";

let narrator = null;
export function setNarrator(fn) { narrator = fn; }
export function narrate(text, tag) {
  if (typeof narrator === "function") {
    try { narrator(text, tag); } catch {}
  }
}

export const move = {
  mode: MODE.IDLE,
  priority: PRIORITY.idle,
  target: null,
  goalLabel: null,
  startedAt: 0,
  lastSample: null,
  lastSampleAt: 0,
  stuckTicks: 0,
  onArrive: null,
  active: false,
  speed: SPEED.WALK,
  followName: null,
  followLostSince: 0,
  guardPos: null,
  goalToken: 0,
  fleeUntil: 0,
  lastPosition: null,
};

export function setSpeed(speed) {
  move.speed = speed;
}

export function getSpeed() {
  return move.speed;
}

export function describeForContext() {
  switch (move.mode) {
    case MODE.IDLE: return "standing around";
    case MODE.WANDER: return "wandering around on your own";
    case MODE.GOTO: return `walking to ${move.goalLabel || "a spot"}`;
    case MODE.COME: return `walking over to ${move.target || "someone"}`;
    case MODE.FOLLOW: return `following ${move.followName || "someone"}`;
    case MODE.TAIL: return `tailing ${move.followName || "someone"} from a distance`;
    case MODE.ESCORT: return `leading ${move.followName || "someone"} somewhere`;
    case MODE.GUARD: return "guarding a spot, staying put";
    case MODE.GATHER: return "heading to the group";
    case MODE.MIRROR: return `copying ${move.followName || "someone"}`;
    case MODE.FLEE: return "running from danger";
    case MODE.PATROL: return "patrolling between spots";
    case MODE.QUEUE: return `running through a route (${move.goalLabel || "stops"})`;
    case MODE.SEEKLIGHT: return "heading for light";
    default: return move.mode;
  }
}

export function rememberPosition(pos) {
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.z)) {
    move.lastPosition = { x: pos.x, y: pos.y, z: pos.z };
  }
}

export function getLastPosition() {
  return move.lastPosition || null;
}

export function currentMode() {
  return move.mode;
}

export function isBusy() {
  return move.mode !== MODE.IDLE;
}

export function isMoving() {
  return move.active && move.mode !== MODE.IDLE;
}

export function canInterrupt(newMode) {
  const incoming = PRIORITY[newMode] ?? 0;
  return incoming >= move.priority;
}

export function describeStatus() {
  if (move.mode === MODE.IDLE) return "idle";
  if (move.goalLabel) return `${move.mode} (${move.goalLabel})`;
  return move.mode;
}

export async function enterMode(mode, opts = {}) {
  const incoming = PRIORITY[mode] ?? 0;
  if (mode !== MODE.IDLE && incoming < move.priority && move.active) {
    log.info(`movement: ${mode} blocked by active ${move.mode} (priority ${move.priority})`);
    return false;
  }

  if (move.active) {
    await clearActive();
  }

  move.mode = mode;
  move.priority = incoming;
  move.target = opts.target || null;
  move.goalLabel = opts.label || null;
  move.startedAt = Date.now();
  move.lastSample = null;
  move.lastSampleAt = 0;
  move.stuckTicks = 0;
  move.hasMovedYet = false;
  move.onArrive = opts.onArrive || null;
  move.active = mode !== MODE.IDLE;

  state.movementMode = mode;
  state.movementTarget = opts.targetName || null;

  if (mode !== MODE.IDLE) {
    log.info(`movement: entering ${describeStatus()}`);
  }
  return true;
}

async function clearActive() {
  try {
    await stopAllActions();
  } catch (e) {
    void e;
  }
}

export async function resetToIdle(reason) {
  if (move.mode === MODE.IDLE && !move.active) return;
  if (reason) log.info(`movement: back to idle (${reason})`);
  await clearActive();
  move.mode = MODE.IDLE;
  move.priority = PRIORITY.idle;
  move.target = null;
  move.goalLabel = null;
  move.startedAt = 0;
  move.lastSample = null;
  move.lastSampleAt = 0;
  move.stuckTicks = 0;
  move.onArrive = null;
  move.active = false;
  move.followName = null;
  move.followLostSince = 0;
  move.guardPos = null;
  move.fleeUntil = 0;
  move.goalToken = 0;
  state.movementMode = MODE.IDLE;
  state.movementTarget = null;
}

export function markArrived() {
  const cb = move.onArrive;
  move.onArrive = null;
  if (typeof cb === "function") {
    try { cb(); } catch (e) { log.warn(`onArrive failed: ${e.message}`); }
  }
}
