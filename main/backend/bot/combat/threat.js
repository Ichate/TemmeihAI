import { getBot, state } from "../ctx.js";
import { FLEE_HEALTH, HEAL_HEALTH, EAT_HUNGER, TOTEM_HEALTH, ATTACKER_MEMORY_MS } from "./config.js";

export function recordAttacker(entity, amount) {
  if (!entity) return;
  const id = entity.id != null ? entity.id : (entity.username || entity.name);
  if (id == null) return;
  const now = Date.now();
  const prev = state.attackerHits.get(id);
  if (prev && now - prev.time < ATTACKER_MEMORY_MS) {
    prev.hits += 1;
    prev.damage += amount || 1;
    prev.time = now;
    prev.entity = entity;
  } else {
    state.attackerHits.set(id, { hits: 1, damage: amount || 1, time: now, entity });
  }
}

export function hardestAttacker() {
  const now = Date.now();
  let best = null;
  let bestScore = 0;
  for (const [id, rec] of state.attackerHits) {
    if (now - rec.time > ATTACKER_MEMORY_MS) { state.attackerHits.delete(id); continue; }
    if (!rec.entity) continue;
    const score = rec.damage + rec.hits;
    if (score > bestScore) { bestScore = score; best = rec.entity; }
  }
  return best;
}

export function clearAttackers() {
  state.attackerHits.clear();
}

export function health() {
  const bot = getBot();
  return bot && bot.health != null ? bot.health : 20;
}

export function hunger() {
  const bot = getBot();
  return bot && bot.food != null ? bot.food : 20;
}

export function shouldFlee() {
  return health() <= FLEE_HEALTH;
}

export function shouldHeal() {
  return health() <= HEAL_HEALTH;
}

export function shouldEat() {
  return hunger() <= EAT_HUNGER;
}

export function critical() {
  return health() <= TOTEM_HEALTH;
}

export function canFight() {
  const bot = getBot();
  if (!bot || !bot.entity) return false;
  if (state.falling) return false;
  if (bot.entity.isInLava) return false;
  const oxygen = typeof bot.oxygenLevel === "number" ? bot.oxygenLevel : 20;
  if (bot.entity.isInWater && oxygen <= 3) return false;
  return true;
}

export function isFalling() {
  const bot = getBot();
  if (!bot || !bot.entity) return false;
  if (bot.entity.onGround) return false;
  if (bot.entity.isInWater) return false;
  const vy = bot.entity.velocity ? bot.entity.velocity.y : 0;
  return vy < -0.35;
}
