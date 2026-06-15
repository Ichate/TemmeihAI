import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { loadPathfinder, buildMovements } from "./pathfinder.js";
import { move, resetToIdle, describeStatus, describeForContext, currentMode, isBusy, isMoving, setSpeed, getSpeed, setNarrator } from "./controller.js";
import {
  gotoCoords, comeToPlayer, gotoPlayer, followPlayer, tailPlayer, escortPlayer,
  guardSpot, gatherToGroup, fleeFrom, stop, nearestPlayerEntity, findPlayerEntity,
  returnToPrevious, climbHighGround, descendSafely, jumpToPlayer, comeToHurtPlayer,
  seekLight, goToDoor,
} from "./goals.js";
import { startWander, stopWander, isWanderEnabled, setHomePoint, resetHomePoint } from "./wander.js";
import { startWatchdog, stopWatchdog } from "./watchdog.js";
import { jumpTimes, sneakFor, lookAtEntity, lookAtPosition, lookAround, applyPathfinderSpeed } from "./actions.js";
import { reactToThreats, retreatToDefensible, findThreats } from "./combat-move.js";
import { startMirror, stopMirror, isMirroring, startPersonalSpace, stopPersonalSpace } from "./social.js";
import {
  saveCurrentAs, saveWaypoint, gotoWaypoint, listWaypoints, getWaypoint,
  clearWaypoints, runQueue, startPatrol, cancelRoutes,
} from "./waypoints.js";
import { turnAround, lookBehind, wave, nod, shakeHead, bow, celebrate } from "./gestures.js";
import { mountNearest, dismount, isRiding, findNearestVehicle } from "./riding.js";
import { startSwimWatcher, stopSwimWatcher, isSwimming } from "./swim.js";
import { MODE, SPEED } from "./config.js";

let speakHook = null;

export function initMovement(bot, opts = {}) {
  if (!bot) return false;
  speakHook = opts.onNarrate || null;
  setNarrator(narrate);

  if (!loadPathfinder(bot)) {
    log.warn("movement: pathfinder unavailable, bot will stay stationary");
    return false;
  }

  bot.once("spawn", () => {
    buildMovements(bot);
    if (bot.entity) setHomePoint(bot.entity.position);
  });
  buildMovements(bot);

  resetToIdle("init");

  startWatchdog({
    onLost: (who) => narrate(`lost track of ${who}, not following anymore`, "lost"),
  });

  if (opts.wander !== false) startWander();
  startPersonalSpace();
  startSwimWatcher({ onNarrate: narrate });

  log.info("movement: initialized");
  return true;
}

function narrate(text, tag) {
  if (typeof speakHook === "function") {
    try { speakHook(text, tag); } catch {}
  }
}

export function teardownMovement() {
  stopWander();
  stopWatchdog();
  stopPersonalSpace();
  stopMirror();
  stopSwimWatcher();
  cancelRoutes();
  resetToIdle("teardown");
}

export function resetMovementForRespawn() {
  cancelRoutes();
  resetToIdle("respawn");
  resetHomePoint();
  stopMirror();
  const bot = getBot();
  if (bot) {
    buildMovements(bot);
    if (bot.entity) setHomePoint(bot.entity.position);
  }
}

export function movementContext() {
  return describeForContext();
}

export const movement = {
  gotoCoords,
  comeToPlayer,
  gotoPlayer,
  followPlayer,
  tailPlayer,
  escortPlayer,
  guardSpot,
  gatherToGroup,
  fleeFrom,
  retreatToDefensible,
  reactToThreats,
  findThreats,
  stop,
  jumpTimes,
  sneakFor,
  lookAtEntity,
  lookAtPosition,
  lookAround,
  startWander,
  stopWander,
  isWanderEnabled,
  startMirror,
  stopMirror,
  isMirroring,
  setSpeed: (s) => { setSpeed(s); applyPathfinderSpeed(s); },
  getSpeed,
  returnToPrevious,
  climbHighGround,
  descendSafely,
  jumpToPlayer,
  comeToHurtPlayer,
  seekLight,
  goToDoor,
  saveCurrentAs,
  saveWaypoint,
  gotoWaypoint,
  listWaypoints,
  getWaypoint,
  clearWaypoints,
  runQueue,
  startPatrol,
  cancelRoutes,
  turnAround,
  lookBehind,
  wave,
  nod,
  shakeHead,
  bow,
  celebrate,
  mountNearest,
  dismount,
  isRiding,
  findNearestVehicle,
  isSwimming,
  status: describeStatus,
  context: describeForContext,
  currentMode,
  followName: () => move.followName || null,
  isBusy,
  isMoving,
  nearestPlayerEntity,
  findPlayerEntity,
};

export { MODE, SPEED };
