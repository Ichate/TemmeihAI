import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import { PROTECT_RADIUS, PROTECT_THREAT_RANGE, GUARD_AREA_RADIUS, COMBAT_TICK_MS } from "./config.js";
import { threatsTo, findByUsername, isAlive, distanceTo } from "./targeting.js";
import { isAlly } from "./allies.js";
import { movement } from "../movement/index.js";

let protectTimer = null;
let mode = "idle";
let wardName = null;
let anchor = null;
let engageHook = null;
let inCombatCheck = null;
let busy = false;

export function setProtectHooks(opts = {}) {
  engageHook = opts.onEngage || null;
  inCombatCheck = opts.inCombat || null;
}

function wardEntity() {
  if (!wardName) return null;
  return findByUsername(wardName);
}

function centerPos() {
  if (mode === "player") {
    const w = wardEntity();
    return w && w.position ? w.position : anchor;
  }
  return anchor;
}

export function startProtectPlayer(name) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const ent = findByUsername(name);
  if (!ent) return { ok: false, reason: `i can't see ${name} to protect them` };
  wardName = ent.username;
  mode = "player";
  anchor = null;
  state.protectName = wardName;
  startLoop();
  return { ok: true, reason: `watching ${wardName}'s back` };
}

export function startGuardArea() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  const p = bot.entity.position;
  anchor = { x: p.x, y: p.y, z: p.z };
  mode = "area";
  wardName = null;
  state.guardAnchor = anchor;
  startLoop();
  return { ok: true, reason: "guarding this spot, anything hostile gets dealt with" };
}

export function stopProtect(reason) {
  mode = "idle";
  wardName = null;
  anchor = null;
  state.protectName = null;
  state.guardAnchor = null;
  if (protectTimer) { clearInterval(protectTimer); protectTimer = null; }
  if (reason) log.info(`protect: stopped (${reason})`);
}

export function isProtecting() {
  return mode !== "idle";
}

export function protectContext() {
  if (mode === "player") return `guarding ${wardName || "someone"}`;
  if (mode === "area") return "guarding this area";
  return null;
}

function startLoop() {
  if (protectTimer) return;
  protectTimer = setInterval(() => { tick().catch(e => log.warn(`protect tick failed: ${e.message}`)); }, COMBAT_TICK_MS * 2);
  if (protectTimer.unref) protectTimer.unref();
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    if (mode === "idle") return;
    const bot = getBot();
    if (!bot || !bot.entity) return;

    if (inCombatCheck && inCombatCheck()) return;

    const center = centerPos();
    if (!center) {
      if (mode === "player") stopProtect("lost ward");
      return;
    }

    if (mode === "player") {
      const w = wardEntity();
      if (!w || !isAlive(w)) { stopProtect("ward gone"); return; }
    }

    const exclude = new Set(state.allies);
    if (wardName) exclude.add(wardName.toLowerCase());

    const range = mode === "area" ? GUARD_AREA_RADIUS : PROTECT_THREAT_RANGE;
    const threats = threatsTo(center, range, exclude);

    if (threats.length && engageHook) {
      engageHook(threats[0].entity);
      return;
    }

    const distToCenter = bot.entity.position.distanceTo(
      bot.entity.position.constructor ? new bot.entity.position.constructor(center.x, center.y, center.z) : center
    );
    const leash = mode === "area" ? GUARD_AREA_RADIUS - 2 : PROTECT_RADIUS;
    if (distToCenter > leash) {
      await movement.gotoCoords(center.x, center.y, center.z, { tolerance: Math.max(1, leash - 2), label: "back to my post", mode: "goto" });
    }
  } finally {
    busy = false;
  }
}
