import { getBot } from "../ctx.js";
import { log } from "../log.js";
import {
  RANGED_KEEP_DISTANCE, MELEE_CLOSE_DISTANCE, CREEPER_DODGE_RANGE,
} from "./config.js";
import { gotoCoords, fleeFrom } from "./goals.js";
import { faceYaw } from "./actions.js";

const RANGED_MOBS = new Set(["skeleton", "stray", "blaze", "ghast", "pillager", "witch", "wither_skeleton"]);
const MELEE_MOBS = new Set(["zombie", "husk", "drowned", "spider", "cave_spider", "zombie_villager", "zombified_piglin", "piglin", "vindicator", "ravager", "hoglin", "zoglin"]);

export function classifyThreat(name) {
  const n = (name || "").toLowerCase();
  if (n === "creeper") return "creeper";
  if (RANGED_MOBS.has(n)) return "ranged";
  if (MELEE_MOBS.has(n)) return "melee";
  return "other";
}

export function findThreats(range = 20) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return [];
  const pos = bot.entity.position;
  const out = [];
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || !e.position || e === bot.entity) continue;
    if (e.type !== "mob" && e.type !== "hostile" && !e.kind) continue;
    const name = (e.name || e.displayName || "").toLowerCase();
    const kind = classifyThreat(name);
    if (kind === "other") continue;
    const dist = pos.distanceTo(e.position);
    if (dist <= range) out.push({ entity: e, name, kind, dist });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

export async function dodgeCreeper(creeperEntity) {
  const bot = getBot();
  if (!bot || !bot.entity || !creeperEntity?.position) return { ok: false, reason: "no creeper" };
  const self = bot.entity.position;
  const c = creeperEntity.position;
  const dx = self.x - c.x;
  const dz = self.z - c.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  const dest = {
    x: self.x + (dx / len) * (CREEPER_DODGE_RANGE + 2),
    y: self.y,
    z: self.z + (dz / len) * (CREEPER_DODGE_RANGE + 2),
  };
  log.info("combat-move: dodging creeper");
  return gotoCoords(dest.x, dest.y, dest.z, { tolerance: 1, label: "dodging a creeper", mode: "flee" });
}

export async function keepRangedDistance(threat) {
  const bot = getBot();
  if (!bot || !bot.entity || !threat?.entity?.position) return { ok: false, reason: "no threat" };
  const self = bot.entity.position;
  const t = threat.entity.position;
  const dist = self.distanceTo(t);

  if (dist < RANGED_KEEP_DISTANCE - 2) {
    const dx = self.x - t.x;
    const dz = self.z - t.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const dest = {
      x: t.x + (dx / len) * RANGED_KEEP_DISTANCE,
      y: self.y,
      z: t.z + (dz / len) * RANGED_KEEP_DISTANCE,
    };
    return gotoCoords(dest.x, dest.y, dest.z, { tolerance: 1, label: "backing off a shooter", mode: "flee" });
  }
  return { ok: true, reason: "already at safe range" };
}

export async function closeMelee(threat) {
  const bot = getBot();
  if (!bot || !threat?.entity?.position) return { ok: false, reason: "no threat" };
  const t = threat.entity.position;
  return gotoCoords(t.x, t.y, t.z, { tolerance: MELEE_CLOSE_DISTANCE, label: "closing in", mode: "goto" });
}

export async function reactToThreats() {
  const threats = findThreats();
  if (!threats.length) return { ok: false, reason: "no threats" };

  const creeper = threats.find(t => t.kind === "creeper" && t.dist <= CREEPER_DODGE_RANGE);
  if (creeper) return dodgeCreeper(creeper.entity);

  const ranged = threats.find(t => t.kind === "ranged");
  if (ranged) return keepRangedDistance(ranged);

  const nearest = threats[0];
  if (nearest.kind === "creeper") {
    return fleeFrom(nearest.entity.position, { label: "creeper", retreat: true });
  }
  return { ok: false, reason: "threats noted, no reposition needed" };
}

export async function retreatToDefensible(threatPos) {
  return fleeFrom(threatPos, { retreat: true, label: "danger" });
}
