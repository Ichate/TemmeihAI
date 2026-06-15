import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import { findNearestHostile, findMostDangerous, nearestCreeper, isAlive, distanceTo } from "./targeting.js";

let watchTimer = null;
let engageHook = null;
let activeCheck = null;
let enabled = true;
const WATCH_MS = 250;
const ENGAGE_RANGE = 12;
const CREEPER_RANGE = 7;

export function startThreatWatch(opts = {}) {
  engageHook = opts.onThreat || null;
  activeCheck = opts.inCombat || null;
  if (watchTimer) clearInterval(watchTimer);
  watchTimer = setInterval(() => {
    try { tick(); } catch (e) { log.warn(`threat watch failed: ${e.message}`); }
  }, WATCH_MS);
  if (watchTimer.unref) watchTimer.unref();
}

export function stopThreatWatch() {
  if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
}

export function setThreatWatch(on) {
  enabled = !!on;
}

function tick() {
  if (!enabled) return;
  const bot = getBot();
  if (!bot || !bot.entity) return;
  if (activeCheck && activeCheck()) return;
  if (!engageHook) return;

  const creeper = nearestCreeper(CREEPER_RANGE);
  if (creeper && isAlive(creeper)) {
    engageHook(creeper);
    return;
  }

  const danger = findMostDangerous(ENGAGE_RANGE) || findNearestHostile(ENGAGE_RANGE);
  if (danger && isAlive(danger) && distanceTo(danger) <= ENGAGE_RANGE) {
    engageHook(danger);
  }
}
