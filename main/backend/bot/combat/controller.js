import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import {
  COMBAT_TICK_MS, MELEE_RANGE, RANGED_KEEP, RANGED_MIN, TARGET_LOST_MS,
  KITE_TRIGGER_RANGE, GAP_CLOSE_RANGE, CHASE_GIVEUP_MS, CHASE_GIVEUP_RANGE,
  CREEPER_SAFE_RANGE,
} from "./config.js";
import {
  isAlive, distanceTo, attackKind, entityName, isPlayer,
  pickPriorityTarget, nearestCreeper, lowestHealthHostile, threatsTo,
} from "./targeting.js";
import { canFight, shouldFlee, isFalling, hardestAttacker, clearAttackers } from "./threat.js";
import {
  swingAt, faceTarget, strafeStep, inMeleeRange, resetMeleeState,
  targetFleeing, gapClose, stopGapClose,
} from "./melee.js";
import { shootAt, canShoot, stopDrawing, kiteBack, stopKite } from "./ranged.js";
import {
  readyShield, startBlock, stopBlock, tryHealOrEat, tryTotem, fleeFromTarget, resetDefense,
  reactiveBlock, creeperHissing, creeperStrikeReady, markCreeperStrike,
} from "./defense.js";
import { isPvpAllowed } from "./pvp.js";
import { isAlly } from "./allies.js";
import { chaseSafe } from "./hazard.js";
import {
  calloutEngage, calloutCreeper, calloutLowHealth, calloutVictory,
  calloutDefeatSurvived, resetCallouts,
} from "./callouts.js";
import { makeGoalFollow, makeGoalInvert, makeGoalNear } from "../movement/pathfinder.js";
import { inventory } from "../inventory/index.js";

let loopTimer = null;
let narrateHook = null;
let busy = false;

const combat = {
  active: false,
  mode: "idle",
  target: null,
  targetName: null,
  lastSeen: 0,
  useBow: false,
  chasing: false,
  chaseStart: 0,
  lastTargetHp: null,
  resumeFollow: null,
};

export function setCombatNarrator(fn) { narrateHook = fn; }

function narrate(text, tag) {
  if (typeof narrateHook === "function") {
    try { narrateHook(text, tag); } catch {}
  }
}

export function combatState() { return combat; }
export function inCombat() { return combat.active; }

export function combatContext() {
  if (!combat.active) return null;
  if (combat.mode === "flee") return "fighting but backing off, low health";
  if (combat.targetName) return `fighting ${combat.targetName}`;
  return "fighting";
}

async function equipForFight() {
  try { await inventory.equipBestWeapon(); } catch {}
}

function setSprint(on) {
  const bot = getBot();
  if (!bot) return;
  try { bot.setControlState("sprint", !!on); } catch {}
  try { if (movement.setSpeed) movement.setSpeed(on ? "sprint" : "walk"); } catch {}
}

function clearTarget() {
  combat.target = null;
  combat.targetName = null;
  state.combatTarget = null;
  state.combatTargetName = null;
}

function setTarget(entity) {
  combat.target = entity;
  combat.targetName = entity ? (entity.username || entityName(entity)) : null;
  combat.lastSeen = Date.now();
  combat.chaseStart = Date.now();
  combat.lastTargetHp = entity && typeof entity.health === "number" ? entity.health : null;
  state.combatTarget = entity;
  state.combatTargetName = combat.targetName;
}

export async function startCombat(entity, mode) {
  const bot = getBot();
  if (!bot || !entity) return { ok: false, reason: "no target" };

  if (!combat.active) {
    try {
      const mm = movement.currentMode ? movement.currentMode() : null;
      if ((mm === "follow" || mm === "tail" || mm === "escort") && state.combatTargetName == null) {
        const fn = movement.followName ? movement.followName() : null;
        if (fn) combat.resumeFollow = { name: fn };
      }
    } catch {}
  }

  setTarget(entity);
  combat.active = true;
  combat.mode = mode || "fight";
  state.combatMode = combat.mode;

  combat.useBow = attackKind(entity) === "ranged" && canShoot() && !inMeleeRange(entity);

  await equipForFight();
  await readyShield();
  setSprint(true);
  calloutEngage(combat.targetName);

  if (!loopTimer) {
    loopTimer = setInterval(() => { tick().catch(e => log.warn(`combat tick failed: ${e.message}`)); }, COMBAT_TICK_MS);
    if (loopTimer.unref) loopTimer.unref();
  }
  const who = combat.targetName || "it";
  return { ok: true, reason: `going after ${who}` };
}

export function stopCombat(reason) {
  const wasActive = combat.active;
  const resume = combat.resumeFollow;
  combat.active = false;
  combat.mode = "idle";
  combat.chasing = false;
  combat.resumeFollow = null;
  clearTarget();
  state.combatMode = "idle";
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
  resetMeleeState();
  resetDefense();
  resetCallouts();
  stopDrawing();
  stopKite();
  stopGapClose();
  clearAttackers();
  setSprint(false);
  const bot = getBot();
  if (bot && bot.pathfinder) {
    try { bot.pathfinder.setGoal(null); } catch {}
  }
  if (reason) log.info(`combat: stopped (${reason})`);
  if (wasActive && resume && resume.name) {
    try { movement.followPlayer(resume.name); } catch {}
  }
}

function validTarget(t) {
  if (!t || !isAlive(t)) return false;
  if (isPlayer(t)) {
    if (isAlly(t.username)) return false;
    if (!isPvpAllowed(t.username)) return false;
  }
  return true;
}

async function reacquire() {
  const creeper = nearestCreeper(6);
  if (creeper && validTarget(creeper)) return creeper;

  const hardest = hardestAttacker();
  if (hardest && validTarget(hardest) && distanceTo(hardest) <= 20) return hardest;

  if (combat.mode === "hunt") return null;

  if (state.pvpOptIn && state.pvpOptIn.size) {
    const bot = getBot();
    for (const id in bot.entities) {
      const e = bot.entities[id];
      if (e && isPlayer(e) && isAlive(e) && isPvpAllowed(e.username) && !isAlly(e.username) && distanceTo(e) <= 24) return e;
    }
  }

  const focus = lowestHealthHostile(10);
  if (focus && validTarget(focus)) return focus;

  const next = pickPriorityTarget(null, null, 16);
  if (next && validTarget(next) && !isPlayer(next)) return next;
  return null;
}

function detectVictory(target) {
  if (!target) return false;
  const hp = typeof target.health === "number" ? target.health : null;
  if (combat.lastTargetHp != null && hp != null && hp <= 0 && combat.lastTargetHp > 0) return true;
  return false;
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    if (!combat.active) return;
    const bot = getBot();
    if (!bot || !bot.entity) return;

    state.falling = isFalling();

    if (!canFight()) {
      if (bot.pathfinder) { try { bot.pathfinder.setGoal(null); } catch {} }
      return;
    }

    let target = combat.target;

    if (target && detectVictory(target)) {
      calloutVictory(combat.targetName);
    }

    if (!validTarget(target)) {
      const replaced = await reacquire();
      if (replaced) {
        setTarget(replaced);
        target = replaced;
        combat.useBow = attackKind(replaced) === "ranged" && canShoot() && !inMeleeRange(replaced);
        await equipForFight();
      } else {
        if (Date.now() - combat.lastSeen > TARGET_LOST_MS) {
          if (shouldFlee()) calloutDefeatSurvived();
          narrate("nothing left to fight", "cleared");
          stopCombat("no targets");
        }
        return;
      }
    }

    const dist = distanceTo(target);
    if (dist <= 64) combat.lastSeen = Date.now();
    if (typeof target.health === "number") combat.lastTargetHp = target.health;

    if (dist > CHASE_GIVEUP_RANGE && Date.now() - combat.chaseStart > CHASE_GIVEUP_MS) {
      const fresh = await reacquire();
      if (fresh && fresh !== target) {
        setTarget(fresh);
        target = fresh;
      } else {
        narrate("not chasing that any further", "giveup");
        stopCombat("hopeless chase");
        return;
      }
    }

    const priority = pickPriorityTarget(target, hardestAttacker(), 18);
    if (priority && priority !== target) {
      const pn = entityName(priority);
      if (pn === "creeper" || (validTarget(priority) && priority === hardestAttacker())) {
        if (pn === "creeper") calloutCreeper();
        setTarget(priority);
        target = priority;
        combat.useBow = attackKind(priority) === "ranged" && canShoot() && !inMeleeRange(priority);
      }
    }

    await tryHealOrEat();

    if (shouldFlee()) {
      if (combat.mode !== "flee") {
        combat.mode = "flee";
        calloutLowHealth();
        narrate("getting low, backing off", "flee");
      }
      await tryTotem();
      stopBlock();
      await fleeFromTarget(target);
      return;
    } else if (combat.mode === "flee") {
      combat.mode = "fight";
      await equipForFight();
    }

    if (entityName(target) === "creeper") {
      await creeperTick(target, dist);
    } else if (combat.useBow && canShoot()) {
      await rangedTick(target, dist);
    } else {
      await meleeTick(target, dist);
    }
  } finally {
    busy = false;
  }
}

async function creeperTick(target, dist) {
  const bot = getBot();
  if (canShoot()) {
    await rangedTick(target, dist);
    return;
  }
  if (creeperHissing(target) || dist < CREEPER_SAFE_RANGE) {
    try {
      const inv = makeGoalInvert(makeGoalNear(
        Math.floor(target.position.x), Math.floor(target.position.y), Math.floor(target.position.z), CREEPER_SAFE_RANGE + 2
      ));
      if (inv && bot.pathfinder) bot.pathfinder.setGoal(inv, true);
    } catch {}
    if (dist <= MELEE_RANGE && creeperStrikeReady() && !creeperHissing(target)) {
      markCreeperStrike();
      await swingAt(target);
    }
    return;
  }
  await meleeTick(target, dist);
}

async function meleeTick(target, dist) {
  const bot = getBot();
  if (dist > MELEE_RANGE) {
    if (!chaseSafe(target)) {
      if (bot.pathfinder) { try { bot.pathfinder.setGoal(null); } catch {} }
      combat.chasing = false;
      combat.chaseGoalId = null;
      narrate("not following it into that", "hazard");
      await faceTarget(target);
      return;
    }
    setSprint(true);
    const tid = target.id != null ? target.id : combat.targetName;
    if (combat.chaseGoalId !== tid || !bot.pathfinder || !bot.pathfinder.isMoving()) {
      try {
        const goal = makeGoalFollow(target, MELEE_RANGE - 1);
        if (goal && bot.pathfinder) bot.pathfinder.setGoal(goal, true);
        combat.chaseGoalId = tid;
      } catch {}
    }
    combat.chasing = true;
    if (dist <= GAP_CLOSE_RANGE && targetFleeing(target)) {
      gapClose(target);
    } else {
      stopGapClose();
    }
    await faceTarget(target);
  } else {
    combat.chasing = false;
    combat.chaseGoalId = null;
    stopGapClose();
    if (bot.pathfinder && bot.pathfinder.isMoving()) {
      try { bot.pathfinder.setGoal(null); } catch {}
    }
    await reactiveBlock(target);
    strafeStep(target);
    await swingAt(target);
  }
}

async function rangedTick(target, dist) {
  const bot = getBot();
  if (dist < KITE_TRIGGER_RANGE) {
    await kiteBack(target);
    await shootAt(target);
    return;
  }
  stopKite();
  if (dist < RANGED_MIN) {
    try {
      const inv = makeGoalInvert(makeGoalNear(
        Math.floor(target.position.x), Math.floor(target.position.y), Math.floor(target.position.z), RANGED_KEEP
      ));
      if (inv && bot.pathfinder) bot.pathfinder.setGoal(inv, true);
    } catch {}
    return;
  }
  if (dist > RANGED_KEEP + 6) {
    if (!chaseSafe(target)) { await shootAt(target); return; }
    try {
      const goal = makeGoalFollow(target, RANGED_KEEP);
      if (goal && bot.pathfinder) bot.pathfinder.setGoal(goal, true);
    } catch {}
    return;
  }
  if (bot.pathfinder && bot.pathfinder.isMoving()) {
    try { bot.pathfinder.setGoal(null); } catch {}
  }
  await shootAt(target);
}
