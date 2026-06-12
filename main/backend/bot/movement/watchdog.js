import { getBot } from "../ctx.js";
import { log } from "../log.js";
import {
  MODE, STUCK_CHECK_MS, FOLLOW_LOST_TIMEOUT_MS, FOLLOW_MAX_RANGE, GUARD_RETURN_RADIUS,
} from "./config.js";
import { move, resetToIdle } from "./controller.js";
import { findPlayerEntity } from "./goals.js";
import { makeGoalNear } from "./pathfinder.js";

let watchTimer = null;
let onLostCb = null;

export function startWatchdog(opts = {}) {
  onLostCb = opts.onLost || null;
  if (watchTimer) clearInterval(watchTimer);
  watchTimer = setInterval(() => {
    check().catch((e) => log.warn(`watchdog tick failed: ${e.message}`));
  }, STUCK_CHECK_MS);
}

export function stopWatchdog() {
  if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
}

async function check() {
  const bot = getBot();
  if (!bot || !bot.entity) return;
  if (move.mode === MODE.IDLE || !move.active) return;

  if (move.mode === MODE.FLEE && move.fleeUntil && Date.now() > move.fleeUntil) {
    await resetToIdle("flee duration elapsed");
    return;
  }

  if (move.mode === MODE.GUARD) {
    checkGuard(bot);
    return;
  }

  if (move.mode === MODE.FOLLOW || move.mode === MODE.ESCORT || move.mode === MODE.TAIL) {
    await checkFollow(bot);
  }
}

function checkGuard(bot) {
  if (!move.guardPos) return;
  const pos = bot.entity.position;
  const drift = Math.sqrt((pos.x - move.guardPos.x) ** 2 + (pos.z - move.guardPos.z) ** 2);
  if (drift > GUARD_RETURN_RADIUS && bot.pathfinder && !bot.pathfinder.isMoving()) {
    try {
      bot.pathfinder.setGoal(makeGoalNear(
        Math.floor(move.guardPos.x), Math.floor(move.guardPos.y), Math.floor(move.guardPos.z), 1
      ));
      log.info("guard: drifted, returning to post");
    } catch {}
  }
}

async function checkFollow(bot) {
  const entity = move.followName ? findPlayerEntity(move.followName) : null;

  if (entity && entity.position) {
    move.followLostSince = 0;
    const dist = bot.entity.position.distanceTo(entity.position);
    if (dist > FOLLOW_MAX_RANGE) {
      log.info(`follow: ${move.followName} too far (${Math.round(dist)}m), giving up`);
      if (onLostCb) onLostCb(move.followName, "too far");
      await resetToIdle("follow target out of range");
    }
    return;
  }

  if (!move.followLostSince) { move.followLostSince = Date.now(); return; }
  if (Date.now() - move.followLostSince > FOLLOW_LOST_TIMEOUT_MS) {
    const who = move.followName;
    log.info(`follow: lost ${who}, stopping`);
    if (onLostCb) onLostCb(who, "lost");
    await resetToIdle("follow target lost");
  }
}
