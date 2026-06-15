import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import { REGROUP_DISTANCE } from "./config.js";

export function addAlly(name) {
  if (!name) return;
  state.allies.add(name.toLowerCase());
  log.info(`combat: fighting alongside ${name}`);
}

export function removeAlly(name) {
  if (!name) return;
  state.allies.delete(name.toLowerCase());
}

export function isAlly(name) {
  if (!name) return false;
  return state.allies.has(name.toLowerCase());
}

export function clearAllies() {
  state.allies.clear();
}

export function allyList() {
  return Array.from(state.allies);
}

export function nearestAllyEntity() {
  const bot = getBot();
  if (!bot || !bot.entity || !state.allies.size) return null;
  let best = null;
  let bestDist = Infinity;
  for (const name of state.allies) {
    const p = bot.players[name] || Object.values(bot.players).find(pl => pl.username && pl.username.toLowerCase() === name);
    if (p && p.entity && p.entity.position) {
      const d = bot.entity.position.distanceTo(p.entity.position);
      if (d < bestDist) { bestDist = d; best = p.entity; }
    }
  }
  return best;
}

export function shouldRegroup() {
  const bot = getBot();
  const ally = nearestAllyEntity();
  if (!bot || !bot.entity || !ally) return false;
  return bot.entity.position.distanceTo(ally.position) > REGROUP_DISTANCE * 2.5;
}
