import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { PERSONAL_SPACE, PERSONAL_SPACE_CHECK_MS, MODE } from "./config.js";
import { move, enterMode, resetToIdle } from "./controller.js";
import { findPlayerEntity, nearestPlayerEntity } from "./goals.js";
import { setControl, jumpOnce, setSneak, faceYaw } from "./actions.js";

let spaceTimer = null;
let mirrorTimer = null;
let mirrorName = null;
let lastMirrorState = {};

export function startPersonalSpace() {
  if (spaceTimer) clearInterval(spaceTimer);
  spaceTimer = setInterval(() => {
    try { checkPersonalSpace(); } catch (e) { log.warn(`personal space tick failed: ${e.message}`); }
  }, PERSONAL_SPACE_CHECK_MS);
}

export function stopPersonalSpace() {
  if (spaceTimer) { clearInterval(spaceTimer); spaceTimer = null; }
}

function checkPersonalSpace() {
  const bot = getBot();
  if (!bot || !bot.entity) return;
  if (move.mode !== MODE.IDLE) return;

  const player = nearestPlayerEntity();
  if (!player || !player.position) return;
  const dist = bot.entity.position.distanceTo(player.position);
  if (dist >= PERSONAL_SPACE) return;

  const self = bot.entity.position;
  const dx = self.x - player.position.x;
  const dz = self.z - player.position.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;

  const yaw = Math.atan2(-(dx / len), dz / len);
  faceYaw(yaw, 0).then(() => {
    setControl("forward", true);
    setTimeout(() => setControl("forward", false), 350);
  }).catch(() => {});
}

export function startMirror(name) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const entity = findPlayerEntity(name) || nearestPlayerEntity();
  if (!entity) return { ok: false, reason: "cannot see that player" };

  mirrorName = entity.username || name;
  enterMode(MODE.MIRROR, { label: `mirror ${mirrorName}`, target: entity, targetName: mirrorName });
  move.followName = mirrorName;
  lastMirrorState = {};

  if (mirrorTimer) clearInterval(mirrorTimer);
  mirrorTimer = setInterval(() => {
    try { tickMirror(); } catch (e) { log.warn(`mirror tick failed: ${e.message}`); stopMirror(); }
  }, 250);
  return { ok: true, reason: `copying ${mirrorName}` };
}

export function stopMirror() {
  if (mirrorTimer) { clearInterval(mirrorTimer); mirrorTimer = null; }
  const bot = getBot();
  if (bot) {
    setControl("jump", false);
    setSneak(false);
    setControl("sprint", false);
  }
  mirrorName = null;
  if (move.mode === MODE.MIRROR) resetToIdle("mirror stopped");
}

function tickMirror() {
  const bot = getBot();
  if (!bot || !mirrorName) { stopMirror(); return; }
  const entity = findPlayerEntity(mirrorName);
  if (!entity) { stopMirror(); return; }

  const sneaking = !!(entity.metadata && entity.crouching);
  if (sneaking !== lastMirrorState.sneak) {
    setSneak(sneaking);
    lastMirrorState.sneak = sneaking;
  }

  const onGround = entity.onGround;
  if (lastMirrorState.onGround === true && onGround === false) {
    jumpOnce().catch(() => {});
  }
  lastMirrorState.onGround = onGround;

  try {
    faceYaw(entity.yaw, entity.pitch || 0);
  } catch {}
}

export function isMirroring() {
  return !!mirrorName;
}
