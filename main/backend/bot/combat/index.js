import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import {
  startCombat, stopCombat, inCombat, combatContext, combatState, setCombatNarrator,
} from "./controller.js";
import {
  findByUsername, findNearestMobByName, findNearestHostile, findMostDangerous,
  isAlive, isPlayer, entityName, isHostileMob,
} from "./targeting.js";
import {
  startPvp, endPvp, isPvpAllowed, handleDeath, clearPvp, anyPvp, pvpList,
} from "./pvp.js";
import {
  startProtectPlayer, startGuardArea, stopProtect, isProtecting, protectContext, setProtectHooks,
} from "./protect.js";
import { addAlly, removeAlly, isAlly, clearAllies, allyList, nearestAllyEntity, shouldRegroup } from "./allies.js";
import { setCalloutHook, calloutTaunt } from "./callouts.js";
import { recordAttacker } from "./threat.js";
import { startThreatWatch, stopThreatWatch, setThreatWatch } from "./watch.js";
import { movement } from "../movement/index.js";

let defendAuto = true;

export function initCombat(opts = {}) {
  if (opts.onNarrate) setCombatNarrator(opts.onNarrate);
  if (opts.onCallout) setCalloutHook(opts.onCallout);
  setProtectHooks({
    inCombat,
    onEngage: (entity) => {
      if (!inCombat() && entity) {
        startCombat(entity, isPlayer(entity) ? "pvp" : "fight");
      }
    },
  });
  startThreatWatch({
    inCombat: () => inCombat() || isProtecting(),
    onThreat: (entity) => {
      if (!defendAuto) return;
      if (!entity || !isAlive(entity)) return;
      if (isPlayer(entity)) return;
      startCombat(entity, "fight");
    },
  });
}

export function teardownCombat() {
  stopThreatWatch();
  stopCombat("teardown");
  stopProtect("teardown");
  clearPvp();
  clearAllies();
}

export async function attackNearestHostile() {
  const target = findMostDangerous() || findNearestHostile();
  if (!target) return { ok: false, reason: "nothing hostile nearby to fight" };
  return startCombat(target, "fight");
}

export async function attackMobByName(word) {
  if (!word) return attackNearestHostile();
  const target = findNearestMobByName(word);
  if (!target) return { ok: false, reason: `i don't see a ${word} nearby` };
  return startCombat(target, "hunt");
}

export async function attackPlayer(name) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  if (!name) return { ok: false, reason: "who am i fighting?" };
  const entity = findByUsername(name);
  if (!entity) return { ok: false, reason: `i can't see ${name} nearby` };
  startPvp(entity.username);
  removeAlly(entity.username);
  calloutTaunt(entity.username);
  return startCombat(entity, "pvp");
}

export async function huntMob(word) {
  return attackMobByName(word);
}

export function stopFighting() {
  const wasActive = inCombat() || isProtecting();
  stopCombat("told to stop");
  stopProtect("told to stop");
  clearPvp();
  return { ok: true, reason: wasActive ? "stood down" : "wasn't fighting anyway" };
}

export function setAutoDefend(on) {
  defendAuto = !!on;
  setThreatWatch(defendAuto);
  return { ok: true, reason: defendAuto ? "i'll defend myself" : "i won't fight back on my own" };
}

export function isAutoDefend() { return defendAuto; }

export function protectPlayer(name) {
  if (!name) return { ok: false, reason: "protect who?" };
  return startProtectPlayer(name);
}

export function guardArea() {
  return startGuardArea();
}

export function addFightAlly(name) {
  if (!name) return { ok: false, reason: "who?" };
  addAlly(name);
  return { ok: true, reason: `got your back, ${name}` };
}

export async function regroup() {
  const ally = nearestAllyEntity();
  if (!ally || !ally.position) return { ok: false, reason: "no one to regroup with" };
  return movement.gotoCoords(ally.position.x, ally.position.y, ally.position.z, { tolerance: 3, label: "regrouping", mode: "goto" });
}

export function combatContextFull() {
  return combatContext() || protectContext();
}

export function onAttacked(attacker) {
  if (!defendAuto) return;
  const bot = getBot();
  if (!bot || !bot.entity) return;
  if (!attacker || !isAlive(attacker)) return;

  recordAttacker(attacker, 2);

  if (isPlayer(attacker)) {
    if (isAlly(attacker.username)) return;
    if (!isPvpAllowed(attacker.username)) return;
  } else if (!isHostileMob(attacker)) {
    return;
  }

  if (inCombat()) {
    const cur = combatState().target;
    if (cur && entityName(cur) === "creeper") return;
    return;
  }

  startCombat(attacker, isPlayer(attacker) ? "pvp" : "fight");
}

export function onEntityDead(name) {
  removeAlly(name);
  const stopped = handleDeath(name);
  const cur = combatState();
  if (cur && cur.targetName && name && cur.targetName.toLowerCase() === name.toLowerCase()) {
    stopCombat("target died");
  }
  if (!stopped) return;
  if (!anyPvp() && cur && cur.mode === "pvp") {
    stopCombat("pvp over");
  }
}

export const combat = {
  initCombat,
  teardownCombat,
  attackNearestHostile,
  attackMobByName,
  attackPlayer,
  huntMob,
  stopFighting,
  setAutoDefend,
  isAutoDefend,
  protectPlayer,
  guardArea,
  addFightAlly,
  regroup,
  onAttacked,
  onEntityDead,
  inCombat,
  isProtecting,
  combatContext: combatContextFull,
  startPvp,
  endPvp,
  isPvpAllowed,
  anyPvp,
  pvpList,
  isAlly,
  allyList,
};
