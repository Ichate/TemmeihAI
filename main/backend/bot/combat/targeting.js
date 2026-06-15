import { getBot } from "../ctx.js";
import {
  RANGED_MOBS, MELEE_MOBS, DANGER, DEFAULT_DANGER, PASSIVE_MOBS,
  ACQUIRE_RANGE, HUNT_RANGE,
} from "./config.js";

export function entityName(e) {
  if (!e) return "";
  return (e.name || e.displayName || "").toLowerCase();
}

export function isPlayer(e) {
  return !!(e && e.type === "player" && e.username);
}

export function isHostileMob(e) {
  if (!e) return false;
  const n = entityName(e);
  if (RANGED_MOBS.has(n) || MELEE_MOBS.has(n)) return true;
  if (n === "creeper") return true;
  if (e.kind && /hostile|monster/i.test(e.kind)) return true;
  return false;
}

export function isPassiveMob(e) {
  return PASSIVE_MOBS.has(entityName(e));
}

export function dangerOf(e) {
  const n = entityName(e);
  if (isPlayer(e)) return 45;
  return DANGER[n] != null ? DANGER[n] : DEFAULT_DANGER;
}

export function attackKind(e) {
  const n = entityName(e);
  if (n === "creeper") return "creeper";
  if (RANGED_MOBS.has(n)) return "ranged";
  return "melee";
}

export function isAlive(e) {
  if (!e || !e.position) return false;
  if (e.health != null && e.health <= 0) return false;
  if (e.isValid === false) return false;
  return true;
}

export function distanceTo(e) {
  const bot = getBot();
  if (!bot || !bot.entity || !e || !e.position) return Infinity;
  return bot.entity.position.distanceTo(e.position);
}

export function findByUsername(name) {
  const bot = getBot();
  if (!bot || !name) return null;
  const p = bot.players[name];
  if (p && p.entity) return p.entity;
  const lower = name.toLowerCase();
  for (const k in bot.players) {
    if (k.toLowerCase() === lower && bot.players[k].entity) return bot.players[k].entity;
  }
  return null;
}

export function findNearestHostile(range = ACQUIRE_RANGE) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return null;
  let best = null;
  let bestDist = Infinity;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || e === bot.entity || !isAlive(e)) continue;
    if (!isHostileMob(e)) continue;
    const d = distanceTo(e);
    if (d <= range && d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

export function findMostDangerous(range = ACQUIRE_RANGE) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || e === bot.entity || !isAlive(e)) continue;
    if (!isHostileMob(e)) continue;
    const d = distanceTo(e);
    if (d > range) continue;
    const score = dangerOf(e) - d;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

export function findNearestMobByName(word, range = HUNT_RANGE) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities || !word) return null;
  const w = word.toLowerCase();
  let best = null;
  let bestDist = Infinity;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || e === bot.entity || !isAlive(e)) continue;
    if (isPlayer(e)) continue;
    const n = entityName(e);
    if (!n.includes(w)) continue;
    const d = distanceTo(e);
    if (d <= range && d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

export function pickPriorityTarget(current, attackerEntity, range = ACQUIRE_RANGE) {
  const bot = getBot();
  if (!bot || !bot.entity) return current;

  const creeper = nearestCreeper(5);
  if (creeper) return creeper;

  if (attackerEntity && isAlive(attackerEntity) && distanceTo(attackerEntity) <= range) {
    return attackerEntity;
  }

  if (current && isAlive(current) && distanceTo(current) <= range) {
    return current;
  }

  return findMostDangerous(range);
}

export function lowestHealthHostile(range = 10) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return null;
  let best = null;
  let bestHp = Infinity;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || e === bot.entity || !isAlive(e)) continue;
    if (!isHostileMob(e)) continue;
    if (distanceTo(e) > range) continue;
    const hp = typeof e.health === "number" ? e.health : 20;
    if (hp < bestHp) { bestHp = hp; best = e; }
  }
  return best;
}

export function threatsTo(centerPos, range, excludeNames) {
  const bot = getBot();
  if (!bot || !bot.entities || !centerPos) return [];
  const out = [];
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || !e.position || e === bot.entity || !isAlive(e)) continue;
    let hostile = isHostileMob(e);
    if (isPlayer(e)) {
      if (excludeNames && excludeNames.has((e.username || "").toLowerCase())) continue;
      hostile = false;
    }
    if (!hostile) continue;
    const d = centerPos.distanceTo(e.position);
    if (d <= range) out.push({ entity: e, dist: d });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

export function nearestCreeper(range = 6) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return null;
  let best = null;
  let bestDist = Infinity;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || !isAlive(e)) continue;
    if (entityName(e) !== "creeper") continue;
    const d = distanceTo(e);
    if (d <= range && d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}
