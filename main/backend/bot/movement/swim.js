import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import { SWIM_CHECK_MS, SWIM_OXYGEN_LOW, SWIM_SURFACE_PROBE } from "./config.js";

let swimTimer = null;
let narrateHook = null;
let drowningWarned = false;

export function startSwimWatcher(opts = {}) {
  narrateHook = opts.onNarrate || null;
  if (swimTimer) clearInterval(swimTimer);
  swimTimer = setInterval(() => {
    try { tick(); } catch (e) { log.warn(`swim tick failed: ${e.message}`); }
  }, SWIM_CHECK_MS);
  if (swimTimer.unref) swimTimer.unref();
}

export function stopSwimWatcher() {
  if (swimTimer) { clearInterval(swimTimer); swimTimer = null; }
  releaseJump();
}

function inWater() {
  const bot = getBot();
  return !!(bot && bot.entity && (bot.entity.isInWater || bot.entity.isInLava));
}

function headUnderWater() {
  const bot = getBot();
  if (!bot || !bot.entity) return false;
  try {
    const Vec = bot.entity.position.constructor;
    const head = bot.entity.position.offset(0, 1.6, 0);
    const block = bot.blockAt(new Vec(Math.floor(head.x), Math.floor(head.y), Math.floor(head.z)));
    return !!(block && /water/.test((block.name || "").toLowerCase()));
  } catch {
    return false;
  }
}

function holdJump() {
  const bot = getBot();
  if (!bot) return;
  try { bot.setControlState("jump", true); } catch {}
}

function releaseJump() {
  const bot = getBot();
  if (!bot) return;
  try { bot.setControlState("jump", false); } catch {}
}

function tick() {
  const bot = getBot();
  if (!bot || !bot.entity) { return; }

  if (!inWater()) {
    if (state.swimming) {
      state.swimming = false;
      drowningWarned = false;
      releaseJump();
    }
    return;
  }

  state.swimming = true;

  const oxygen = typeof bot.oxygenLevel === "number" ? bot.oxygenLevel : 20;
  const submerged = headUnderWater();

  if (submerged) {
    holdJump();
  } else {
    releaseJump();
  }

  if (submerged && oxygen <= SWIM_OXYGEN_LOW) {
    holdJump();
    if (!drowningWarned && narrateHook) {
      drowningWarned = true;
      try { narrateHook("running low on air underwater, surfacing", "drowning"); } catch {}
    }
  }

  if (!submerged) {
    drowningWarned = false;
  }
}

export function isSwimming() {
  return !!state.swimming;
}
