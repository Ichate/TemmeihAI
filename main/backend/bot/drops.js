import { getBot, args } from "./ctx.js";

const recentDrops = new Map();
const RECENT_MS = 8000;
const MAX_DIST = 6;

function entityNameOf(e) {
  if (!e) return null;
  return e.username || e.name || e.displayName || null;
}

function isItemEntity(entity) {
  if (!entity) return false;
  const name = (entity.name || "").toLowerCase();
  if (name === "item" || name === "item_stack") return true;
  if (entity.entityType != null && typeof entity.getDroppedItem === "function") {
    try { return !!entity.getDroppedItem(); } catch { return false; }
  }
  return false;
}

export function attachDropTracker(bot) {
  bot.on("entitySpawn", (entity) => {
    if (!isItemEntity(entity)) return;
    if (!entity.position) return;

    const bp = bot.entity?.position;
    if (!bp) return;
    if (bp.distanceTo(entity.position) > MAX_DIST) return;

    let closestPlayer = null;
    let closestDist = Infinity;
    if (bot.entities) {
      for (const id in bot.entities) {
        const p = bot.entities[id];
        if (!p || p.type !== "player" || !p.username || p.username === args.botName) continue;
        if (!p.position) continue;
        const d = p.position.distanceTo(entity.position);
        if (d < closestDist && d <= 4) {
          closestDist = d;
          closestPlayer = p.username;
        }
      }
    }
    if (!closestPlayer) return;

    recentDrops.set(entity.id, { username: closestPlayer, time: Date.now() });

    setTimeout(() => recentDrops.delete(entity.id), RECENT_MS + 4000);
  });
}

export function consumeDropAttribution(collectedEntity) {
  if (!collectedEntity) return null;
  const entry = recentDrops.get(collectedEntity.id);
  if (!entry) return null;
  if (Date.now() - entry.time > RECENT_MS) {
    recentDrops.delete(collectedEntity.id);
    return null;
  }
  recentDrops.delete(collectedEntity.id);
  return entry.username;
}
