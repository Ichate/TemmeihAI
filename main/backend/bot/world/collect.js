import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { movement } from "../movement/index.js";
import { COLLECT_RADIUS, COLLECT_PER_BLOCK_MS } from "./config.js";

function isDrop(entity) {
  if (!entity || !entity.position) return false;
  if (entity.type === "object" || entity.type === "other") {
    const dn = (entity.objectType || entity.displayName || entity.name || "").toLowerCase();
    if (dn === "item" || dn === "item stack" || dn === "item_stack") return true;
  }
  const n = (entity.name || "").toLowerCase();
  if (n === "item" || n === "item_stack") return true;
  if (entity.entityType != null && entity.getDroppedItem) {
    try { if (entity.getDroppedItem()) return true; } catch {}
  }
  return false;
}

export function nearbyDrops(radius = COLLECT_RADIUS) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return [];
  const out = [];
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!isDrop(e)) continue;
    const d = bot.entity.position.distanceTo(e.position);
    if (d <= radius) out.push({ entity: e, dist: d });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out;
}

export async function collectNearbyDrops(radius = COLLECT_RADIUS) {
  const bot = getBot();
  if (!bot || !bot.entity) return 0;
  let grabbed = 0;
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const drops = nearbyDrops(radius);
    if (!drops.length) break;
    const target = drops[0];
    const p = target.entity.position;
    if (target.dist <= 1.2) {
      await delay(COLLECT_PER_BLOCK_MS);
      grabbed += 1;
      continue;
    }
    try {
      await Promise.race([
        movement.gotoCoords(p.x, p.y, p.z, { tolerance: 1, label: "grabbing drops", mode: "goto" }),
        delay(3000),
      ]);
    } catch {}
    await delay(300);
    if (!getBot()) break;
  }
  return grabbed;
}
