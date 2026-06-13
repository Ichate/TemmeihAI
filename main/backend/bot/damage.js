import { state, getBot } from "./ctx.js";
import { findNearestHostile, findNearbyPlayer } from "./state.js";

export function describeDamageSource() {
  const bot = getBot();
  if (bot?.entity) {
    const oxygen = typeof bot.oxygenLevel === "number" ? bot.oxygenLevel : 20;
    if (bot.entity.isInWater && oxygen <= 2) return "drowning (out of air)";
    if (bot.entity.isInLava) return "lava";
    try {
      const Vec = bot.entity.position.constructor;
      const feet = bot.blockAt(new Vec(Math.floor(bot.entity.position.x), Math.floor(bot.entity.position.y), Math.floor(bot.entity.position.z)));
      const fname = (feet && feet.name ? feet.name : "").toLowerCase();
      if (/fire|magma|campfire/.test(fname)) return "standing in fire";
      if (/cactus|sweet_berry/.test(fname)) return "a spiky plant";
    } catch {}
  }
  if (state.lastDamageSource && Date.now() - state.lastDamageSource.time < 1500) {
    const src = state.lastDamageSource;
    state.lastDamageSource = null;
    return src.isPlayer ? `${src.name} (a player)` : src.name;
  }
  if (state.fallStartY != null && bot?.entity && (state.fallStartY - bot.entity.position.y) > 3) {
    return "fall damage";
  }
  const hostile = findNearestHostile(6);
  if (hostile) return `a ${hostile.entity.name || hostile.entity.displayName || "mob"} (${hostile.dist}m away)`;
  const player = findNearbyPlayer(5);
  if (player) return `${player.entity.username} (a player)`;
  return "something (unsure what)";
}

export function attachDamageTrackers(bot) {
  try {
    bot._client.on("damage_event", (packet) => {
      if (!bot || packet.entityId !== bot.entity?.id) return;
      const causeId = packet.sourceCauseId || packet.sourceDirectId;
      if (!causeId) return;
      const src = bot.entities[causeId - 1] || bot.entities[causeId];
      if (src) {
        state.lastDamageSource = {
          name: src.username || src.name || src.displayName || "something",
          isPlayer: !!src.username,
          time: Date.now(),
        };
      }
    });
  } catch {}

  bot.on("move", () => {
    if (!bot.entity) return;
    const y = bot.entity.position.y;
    if (state.lastY != null && y < state.lastY - 0.1) {
      if (state.fallStartY == null) state.fallStartY = state.lastY;
    } else if (bot.entity.onGround) {
      state.fallStartY = null;
    }
    state.lastY = y;
  });
}
