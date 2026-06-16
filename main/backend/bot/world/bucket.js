import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { FIND_SCAN_RADIUS } from "./config.js";
import { findItems } from "../inventory/read.js";
import { reachBlock, faceBlock } from "./reach.js";

async function equipItem(namePart) {
  const bot = getBot();
  const item = findItems(namePart)[0];
  if (!item) return null;
  try {
    if (!bot.heldItem || bot.heldItem.name !== item.name) await bot.equip(item, "hand");
    return item;
  } catch (e) {
    log.warn(`bucket equip failed: ${e.message}`);
    return null;
  }
}

function findLiquid(kind) {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.findBlock) return null;
  try {
    return bot.findBlock({
      point: bot.entity.position,
      maxDistance: FIND_SCAN_RADIUS,
      matching: (b) => b && b.name && b.name.toLowerCase() === kind,
    });
  } catch { return null; }
}

export async function fillBucket(kind) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const liquid = (kind || "water").toLowerCase().includes("lava") ? "lava" : "water";

  const empty = await equipItem("bucket");
  if (!empty) return { ok: false, reason: "i don't have a bucket" };
  if (!/^bucket$/.test(empty.name) && empty.name !== "bucket") {
    const plain = findItems("bucket").find(it => it.name === "bucket");
    if (!plain) return { ok: false, reason: "i need an empty bucket" };
    try { await bot.equip(plain, "hand"); } catch {}
  }

  const block = findLiquid(liquid);
  if (!block) return { ok: false, reason: `no ${liquid} source nearby` };
  const reached = await reachBlock(block);
  if (!reached.ok) return { ok: false, reason: `couldn't get to the ${liquid}` };
  await faceBlock(block);
  try {
    await bot.activateItem();
    await delay(400);
    bot.deactivateItem();
    return { ok: true, reason: `filled a bucket with ${liquid}` };
  } catch (e) {
    try { bot.deactivateItem(); } catch {}
    return { ok: false, reason: `couldn't scoop the ${liquid}` };
  }
}

export async function emptyBucket() {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game" };
  const full = findItems("bucket").find(it => /water_bucket|lava_bucket/.test(it.name));
  if (!full) return { ok: false, reason: "i don't have a full bucket" };
  const what = full.name.includes("lava") ? "lava" : "water";
  try {
    await bot.equip(full, "hand");
    const Vec = bot.entity.position.constructor;
    const yaw = bot.entity.yaw;
    const dx = Math.round(-Math.sin(yaw));
    const dz = Math.round(-Math.cos(yaw));
    const ref = bot.blockAt(new Vec(Math.floor(bot.entity.position.x) + dx, Math.floor(bot.entity.position.y) - 1, Math.floor(bot.entity.position.z) + dz));
    if (ref) await bot.lookAt(ref.position.offset(0.5, 1, 0.5), true);
    await bot.activateItem();
    await delay(300);
    bot.deactivateItem();
    return { ok: true, reason: `poured out the ${what}` };
  } catch (e) {
    try { bot.deactivateItem(); } catch {}
    return { ok: false, reason: `couldn't empty the bucket` };
  }
}

export async function milkCow() {
  const bot = getBot();
  if (!bot || !bot.entity || !bot.entities) return { ok: false, reason: "not in game" };
  const empty = findItems("bucket").find(it => it.name === "bucket");
  if (!empty) return { ok: false, reason: "i need an empty bucket to milk" };

  let cow = null;
  let best = Infinity;
  for (const id in bot.entities) {
    const e = bot.entities[id];
    if (!e || !e.position) continue;
    const n = (e.name || "").toLowerCase();
    if (n !== "cow" && n !== "mooshroom") continue;
    const d = bot.entity.position.distanceTo(e.position);
    if (d < best) { best = d; cow = e; }
  }
  if (!cow) return { ok: false, reason: "no cow nearby to milk" };

  try {
    const p = cow.position;
    const r = await Promise.race([
      (await import("../movement/index.js")).movement.gotoCoords(p.x, p.y, p.z, { tolerance: 2, label: "the cow", mode: "goto" }),
      delay(8000),
    ]);
    await bot.equip(empty, "hand");
    await bot.lookAt(cow.position.offset(0, cow.height ? cow.height * 0.5 : 0.7, 0), true);
    await bot.activateEntity(cow);
    await delay(300);
    return { ok: true, reason: "milked the cow" };
  } catch (e) {
    return { ok: false, reason: "couldn't milk the cow" };
  }
}
