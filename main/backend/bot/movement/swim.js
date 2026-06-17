import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import { SWIM_CHECK_MS, SWIM_OXYGEN_LOW, SWIM_SURFACE_PROBE } from "./config.js";

let swimTimer = null;
let narrateHook = null;
let drowningWarned = false;
let diveUntil = 0;

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

function holdSneak(on) {
  const bot = getBot();
  if (!bot) return;
  try { bot.setControlState("sneak", !!on); } catch {}
}

export async function dive(seconds) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  if (!inWater()) return { ok: false, reason: "i'm not in water to dive" };
  const dur = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 12) : 5;
  diveUntil = Date.now() + dur * 1000;
  return { ok: true, reason: "diving down" };
}

export function stopDive() {
  diveUntil = 0;
  holdSneak(false);
}

function tick() {
  const bot = getBot();
  if (!bot || !bot.entity) { return; }

  if (!inWater()) {
    if (state.swimming) {
      state.swimming = false;
      drowningWarned = false;
      diveUntil = 0;
      releaseJump();
      holdSneak(false);
    }
    return;
  }

  state.swimming = true;

  const oxygen = typeof bot.oxygenLevel === "number" ? bot.oxygenLevel : 20;
  const submerged = headUnderWater();
  const diving = Date.now() < diveUntil;

  if (oxygen <= SWIM_OXYGEN_LOW) {
    diveUntil = 0;
    holdSneak(false);
    holdJump();
    if (!drowningWarned && narrateHook) {
      drowningWarned = true;
      try { narrateHook("running low on air underwater, surfacing", "drowning"); } catch {}
    }
    return;
  }

  drowningWarned = false;

  if (diving) {
    releaseJump();
    holdSneak(true);
    return;
  }

  holdSneak(false);
  if (submerged) {
    holdJump();
  } else {
    releaseJump();
  }
}

export function isSwimming() {
  return !!state.swimming;
}
