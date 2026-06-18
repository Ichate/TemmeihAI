import { getBot, state } from "../ctx.js";
import { log } from "../log.js";
import {
  ELYTRA_FOLLOW_TICK_MS, ELYTRA_FOLLOW_MIN_GAP, ELYTRA_FOLLOW_MAX_GAP,
  ELYTRA_BOOST_GAP_MS, ELYTRA_LOST_MS,
} from "../activities/config.js";

let flyTimer = null;
let targetName = null;
let lastBoost = 0;
let lastSeen = 0;
let narrateHook = null;
let busy = false;

export function setElytraNarrator(fn) { narrateHook = fn; }

function narrate(text, tag) {
  if (typeof narrateHook === "function") {
    try { narrateHook(text, tag); } catch {}
  }
}

function hasElytraEquipped() {
  const bot = getBot();
  if (!bot) return false;
  try {
    const torso = bot.inventory && bot.inventory.slots ? bot.inventory.slots[6] : null;
    if (torso && /elytra/.test(torso.name)) return true;
    if (bot.entity && bot.entity.equipment) {
      for (const e of bot.entity.equipment) {
        if (e && /elytra/.test(e.name || "")) return true;
      }
    }
  } catch {}
  return false;
}

function hasElytraItem() {
  const bot = getBot();
  if (!bot || !bot.inventory) return false;
  try { return bot.inventory.items().some(it => /elytra/.test(it.name)); } catch { return false; }
}

async function ensureElytraOn() {
  const bot = getBot();
  if (hasElytraEquipped()) return true;
  if (!hasElytraItem()) return false;
  try {
    const ely = bot.inventory.items().find(it => /elytra/.test(it.name));
    if (ely) { await bot.equip(ely, "torso"); return hasElytraEquipped(); }
  } catch (e) {
    log.warn(`elytra equip failed: ${e.message}`);
  }
  return false;
}

function targetEntity() {
  const bot = getBot();
  if (!bot || !targetName) return null;
  const p = bot.players[targetName];
  return p && p.entity ? p.entity : null;
}

function targetIsFlying(ent) {
  if (!ent) return false;
  if (ent.elytraFlying === true) return true;
  if (ent.metadata) {
    for (const m of ent.metadata) {
      if (m && typeof m === "number" && (m & 0x80)) return true;
    }
  }
  const v = ent.velocity;
  const airborne = ent.onGround === false;
  const fast = v && (Math.abs(v.y) > 0.12 || Math.sqrt(v.x * v.x + v.z * v.z) > 0.25);
  return airborne && !!fast;
}

function hasFirework() {
  const bot = getBot();
  if (!bot || !bot.inventory) return false;
  try { return bot.inventory.items().some(it => /firework_rocket/.test(it.name)); } catch { return false; }
}

async function boost() {
  const bot = getBot();
  if (Date.now() - lastBoost < ELYTRA_BOOST_GAP_MS) return;
  if (!hasFirework()) return;
  try {
    const fw = bot.inventory.items().find(it => /firework_rocket/.test(it.name));
    if (fw) {
      await bot.equip(fw, "hand");
      await bot.activateItem();
      lastBoost = Date.now();
    }
  } catch (e) {
    log.warn(`firework boost failed: ${e.message}`);
  }
}

function nearestFlyingPlayer() {
  const bot = getBot();
  if (!bot || !bot.entity) return null;
  let best = null;
  let bestDist = Infinity;
  for (const nm in bot.players) {
    const p = bot.players[nm];
    if (!p || !p.entity || p.username === bot.username) continue;
    if (!targetIsFlying(p.entity)) continue;
    const d = bot.entity.position.distanceTo(p.entity.position);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

export async function startElytraFollow(name) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };

  let p = name ? bot.players[name] : null;
  if (!p) p = nearestFlyingPlayer();
  if (!p || !p.entity) return { ok: false, reason: name ? `i can't see ${name}` : "i don't see anyone flying to follow" };

  if (!hasElytraItem() && !hasElytraEquipped()) {
    return { ok: false, reason: "i don't have an elytra" };
  }
  if (!targetIsFlying(p.entity)) {
    return { ok: false, reason: `${name} isn't flying, i only fly-follow when you're gliding too` };
  }

  targetName = p.username;
  lastSeen = Date.now();
  state.elytraFollow = targetName;

  if (!flyTimer) {
    flyTimer = setInterval(() => { tick().catch(e => log.warn(`elytra tick failed: ${e.message}`)); }, ELYTRA_FOLLOW_TICK_MS);
    if (flyTimer.unref) flyTimer.unref();
  }
  return { ok: true, reason: `taking off after ${targetName}` };
}

export function stopElytraFollow(reason) {
  targetName = null;
  state.elytraFollow = null;
  if (flyTimer) { clearInterval(flyTimer); flyTimer = null; }
  const bot = getBot();
  if (bot) {
    try { bot.setControlState("jump", false); } catch {}
  }
  if (reason) log.info(`elytra follow stopped (${reason})`);
}

export function isElytraFollowing() { return !!targetName; }

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const bot = getBot();
    if (!bot || !bot.entity || !targetName) return;

    const ent = targetEntity();
    if (!ent) {
      if (Date.now() - lastSeen > ELYTRA_LOST_MS) {
        narrate("lost sight of them in the air, landing", "elytra-lost");
        stopElytraFollow("target gone");
      }
      return;
    }
    lastSeen = Date.now();

    if (!targetIsFlying(ent)) {
      narrate("they stopped flying, so i'm coming down", "elytra-land");
      stopElytraFollow("target landed");
      return;
    }

    if (!hasElytraEquipped()) {
      const on = await ensureElytraOn();
      if (!on) { stopElytraFollow("no elytra"); return; }
    }

    if (bot.entity.onGround && !bot.elytraFlying) {
      try { bot.setControlState("jump", true); } catch {}
      await new Promise(r => setTimeout(r, 120));
      try { bot.setControlState("jump", false); } catch {}
      try { if (typeof bot.elytraFly === "function") await bot.elytraFly(); } catch {}
      await boost();
    }

    const dist = bot.entity.position.distanceTo(ent.position);
    try { await bot.lookAt(ent.position.offset(0, ent.height ? ent.height * 0.5 : 0.9, 0), true); } catch {}

    if (dist > ELYTRA_FOLLOW_MAX_GAP) {
      narrate("they're getting too far ahead", "elytra-behind");
    }
    if (dist > ELYTRA_FOLLOW_MIN_GAP) {
      await boost();
    }
  } finally {
    busy = false;
  }
}
