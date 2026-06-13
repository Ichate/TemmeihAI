import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";

function stackSize(item) {
  if (!item) return 64;
  if (typeof item.stackSize === "number" && item.stackSize > 0) return item.stackSize;
  return 64;
}

export async function organizeInventory() {
  const bot = getBot();
  if (!bot || !bot.inventory) return { ok: false, reason: "not in game" };

  let items;
  try { items = bot.inventory.items(); }
  catch { return { ok: false, reason: "couldn't read inventory" }; }
  if (!items || items.length < 2) return { ok: true, reason: "nothing to tidy up" };

  const byType = {};
  for (const it of items) {
    const key = `${it.type}:${it.metadata == null ? 0 : it.metadata}`;
    if (!byType[key]) byType[key] = [];
    byType[key].push(it);
  }

  let merges = 0;
  for (const key in byType) {
    const group = byType[key];
    if (group.length < 2) continue;
    const max = stackSize(group[0]);
    const partials = group.filter(it => it.count < max).sort((a, b) => a.count - b.count);
    if (partials.length < 2) continue;

    for (let i = 0; i < partials.length - 1; i++) {
      const src = partials[i];
      if (!src || src.count <= 0) continue;
      const dest = partials.find((p, idx) => idx > i && p.count < max && p.count > 0);
      if (!dest) continue;
      try {
        await bot.moveSlotItem(src.slot, dest.slot);
        merges += 1;
        await delay(120);
      } catch (e) {
        log.warn(`stack merge failed: ${e.message}`);
      }
    }
  }

  if (merges <= 0) return { ok: true, reason: "already tidy" };
  return { ok: true, reason: `tidied up, merged ${merges} stack(s)` };
}
