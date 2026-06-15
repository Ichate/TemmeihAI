import { state, getBot } from "../ctx.js";
import { log } from "../log.js";

export function startPvp(name) {
  if (!name) return;
  state.pvpOptIn.add(name.toLowerCase());
  log.info(`pvp: now allowed against ${name}`);
}

export function isPvpAllowed(name) {
  if (!name) return false;
  return state.pvpOptIn.has(name.toLowerCase());
}

export function endPvp(name) {
  if (!name) return;
  const k = name.toLowerCase();
  if (state.pvpOptIn.delete(k)) {
    log.info(`pvp: ended against ${name}`);
  }
}

export function clearPvp() {
  state.pvpOptIn.clear();
}

export function anyPvp() {
  return state.pvpOptIn.size > 0;
}

export function pvpList() {
  return Array.from(state.pvpOptIn);
}

export function handleDeath(deadName) {
  if (!deadName) return false;
  const k = deadName.toLowerCase();
  const bot = getBot();
  const selfName = bot && bot.username ? bot.username.toLowerCase() : null;

  if (selfName && k === selfName) {
    if (state.pvpOptIn.size) {
      log.info("pvp: i died, clearing all pvp");
      state.pvpOptIn.clear();
    }
    return true;
  }

  if (state.pvpOptIn.has(k)) {
    state.pvpOptIn.delete(k);
    log.info(`pvp: ${deadName} died, stopping pvp with them`);
    return true;
  }
  return false;
}
