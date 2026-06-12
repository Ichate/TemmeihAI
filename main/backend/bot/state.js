import { args, getBot, state } from "./ctx.js";
import { HOSTILE_MOBS, NEARBY_RANGE, THREAT_RANGE } from "./config.js";

function movementPhrase() {
  const mode = state.movementMode || "idle";
  const tgt = state.movementTarget;
  switch (mode) {
    case "idle": return null;
    case "wander": return "wandering on your own";
    case "goto": return `walking to ${tgt || "a spot"}`;
    case "come": return `walking over to ${tgt || "someone"}`;
    case "follow": return `following ${tgt || "someone"}`;
    case "tail": return `tailing ${tgt || "someone"}`;
    case "escort": return `leading ${tgt || "someone"}`;
    case "guard": return "staying put, guarding a spot";
    case "gather": return "heading to the group";
    case "mirror": return `copying ${tgt || "someone"}`;
    case "flee": return "running from danger";
    default: return mode;
  }
}

export function fmtTimeOfDay(timeOfDay) {
  if (timeOfDay == null) return "unknown";
  if (timeOfDay < 1000) return "sunrise";
  if (timeOfDay < 6000) return "morning";
  if (timeOfDay < 9000) return "midday";
  if (timeOfDay < 12000) return "afternoon";
  if (timeOfDay < 13000) return "sunset";
  if (timeOfDay < 18000) return "night";
  if (timeOfDay < 22000) return "midnight";
  return "late night";
}

export function isHostile(e) {
  if (e.kind && /hostile/i.test(e.kind)) return true;
  const n = (e.name || "").toLowerCase();
  return HOSTILE_MOBS.has(n);
}

export function findClosest() {
  const bot = getBot();
  if (!bot || !bot.entity) return null;
  const pos = bot.entity.position;
  let closest = null, minDist = Infinity;
  for (const name in bot.players) {
    const p = bot.players[name];
    if (name === bot.username || !p.entity) continue;
    const d = pos.distanceTo(p.entity.position);
    if (d < minDist) { minDist = d; closest = p; }
  }
  return closest;
}

export function findNearestHostile(maxDist = 6) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return null;
  const bp = bot.entity.position;
  let closest = null, minDist = Infinity;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || e === bot.entity || !e.position) continue;
    if (!isHostile(e)) continue;
    const d = bp.distanceTo(e.position);
    if (d <= maxDist && d < minDist) { minDist = d; closest = e; }
  }
  return closest ? { entity: closest, dist: Math.round(minDist) } : null;
}

export function findNearbyPlayer(maxDist = 5) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return null;
  const bp = bot.entity.position;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || e === bot.entity || !e.position) continue;
    if (e.type !== "player" || !e.username || e.username === args.botName) continue;
    const d = bp.distanceTo(e.position);
    if (d <= maxDist) return { entity: e, dist: Math.round(d) };
  }
  return null;
}

export function getCurrentBiome() {
  const bot = getBot();
  if (!bot || !bot.entity) return null;
  try {
    const block = bot.blockAt(bot.entity.position);
    if (block?.biome?.name) return block.biome.name.replace("minecraft:", "");
  } catch {}
  return null;
}

export function getWorldState(full) {
  const bot = getBot();
  if (!bot || !bot.entity) return null;
  const parts = [];

  const hp = bot.health != null ? Math.round(bot.health) : null;
  const food = bot.food != null ? Math.round(bot.food) : null;
  if (hp != null) parts.push(`health ${hp}/20`);
  if (food != null) parts.push(`hunger ${food}/20`);

  const tod = bot.time?.timeOfDay;
  if (tod != null) parts.push(`time ${fmtTimeOfDay(tod)}`);
  if (bot.thunderState && bot.thunderState > 0) parts.push("thunderstorm");
  else if (bot.isRaining) parts.push("raining");

  const held = bot.heldItem;
  parts.push(`holding ${held ? `${held.count}x ${held.name}` : "nothing"}`);

  const movePhrase = movementPhrase();
  if (movePhrase) parts.push(`currently ${movePhrase}`);

  const bp = bot.entity.position;
  const players = [];
  const threats = [];
  const allMobs = [];
  const items = [];
  if (bot.entities) {
    for (const id in bot.entities) {
      const e = bot.entities[id];
      if (!e || e === bot.entity || !e.position) continue;
      const dist = Math.round(bp.distanceTo(e.position));
      if (dist > NEARBY_RANGE) continue;
      const ename = (e.name || "").toLowerCase();
      if (e.type === "player" && e.username && e.username !== args.botName) {
        players.push(`${e.username} (${dist}m)`);
      } else if (ename === "item" || ename === "item_stack") {
        let label = "item";
        try {
          const d = e.getDroppedItem && e.getDroppedItem();
          if (d && d.name) label = `${d.count}x ${d.name}`;
        } catch {}
        items.push(`${label} (${dist}m)`);
      } else if (e.type === "mob" || e.type === "hostile" || e.type === "animal" || e.kind) {
        const name = e.name || e.displayName || "mob";
        allMobs.push(`${name} (${dist}m)`);
        if (isHostile(e) && dist <= THREAT_RANGE) threats.push(`${name} (${dist}m)`);
      }
    }
  }

  if (full) {
    parts.push(`position x${Math.round(bp.x)} y${Math.round(bp.y)} z${Math.round(bp.z)}`);
    if (bot.game?.dimension) parts.push(`dimension ${bot.game.dimension.replace("minecraft:", "")}`);
    const biome = getCurrentBiome();
    if (biome) parts.push(`biome ${biome}`);
    if (bot.experience?.level != null) parts.push(`xp level ${bot.experience.level}`);
    if (bot.inventory) {
      const items = bot.inventory.items();
      if (items.length) {
        const summary = {};
        for (const it of items) summary[it.name] = (summary[it.name] || 0) + it.count;
        const top = Object.entries(summary).sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([n, c]) => `${c}x ${n}`).join(", ");
        parts.push(`inventory ${top}`);
      } else {
        parts.push("inventory empty");
      }
    }
    parts.push(`nearby players: ${players.length ? players.slice(0, 5).join(", ") : "none"}`);
    parts.push(`nearby mobs: ${allMobs.length ? allMobs.slice(0, 5).join(", ") : "none"}`);
    parts.push(`nearby dropped items: ${items.length ? items.slice(0, 5).join(", ") : "none"}`);
  } else {
    parts.push(`nearby players: ${players.length}`);
    if (threats.length) parts.push(`threats: ${threats.slice(0, 3).join(", ")}`);
  }

  return parts.join(" | ");
}
