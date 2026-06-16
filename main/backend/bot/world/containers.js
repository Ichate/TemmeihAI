import { getBot } from "../ctx.js";
import { log } from "../log.js";
import { delay } from "../cooldowns.js";
import { CONTAINER_OPEN_TIMEOUT_MS } from "./config.js";
import { findContainer, blockName } from "./blocks.js";
import { reachBlock } from "./reach.js";
import { itemMatchesWord } from "../inventory/match.js";
import { KEEP_CATEGORIES } from "./config.js";

async function openWindow(block) {
  const bot = getBot();
  try {
    const win = await Promise.race([
      bot.openContainer ? bot.openContainer(block) : bot.openChest(block),
      delay(CONTAINER_OPEN_TIMEOUT_MS).then(() => { throw new Error("open timed out"); }),
    ]);
    await delay(400);
    return win;
  } catch (e) {
    log.warn(`container open failed: ${e.message}`);
    return null;
  }
}

function readContainerItems(win) {
  if (!win) return [];
  try {
    if (typeof win.containerItems === "function") {
      const items = win.containerItems();
      if (items && items.length) return items;
    }
  } catch {}
  try {
    const slots = win.slots || [];
    const count = typeof win.inventoryStart === "number" ? win.inventoryStart : slots.length;
    const out = [];
    for (let i = 0; i < count; i++) {
      if (slots[i]) out.push(slots[i]);
    }
    return out;
  } catch {
    return [];
  }
}

function closeWindow(win) {
  try { if (win) win.close(); } catch {}
}

export async function openContainerNear(kindWord) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game", win: null, block: null };
  const block = findContainer(undefined, kindWord);
  if (!block) return { ok: false, reason: kindWord ? `i don't see a ${kindWord} nearby` : "no chest or container nearby", win: null, block: null };
  const reached = await reachBlock(block);
  if (!reached.ok) return { ok: false, reason: "couldn't get to the container", win: null, block: null };
  const win = await openWindow(block);
  if (!win) return { ok: false, reason: "couldn't open it", win: null, block };
  return { ok: true, reason: "opened", win, block };
}

export async function depositItems(itemWord, count, kindWord) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const opened = await openContainerNear(kindWord);
  if (!opened.ok) return { ok: false, reason: opened.reason };
  const win = opened.win;
  const containerName = blockName(opened.block).replace(/_/g, " ");

  try {
    let items = bot.inventory.items();
    if (itemWord) items = items.filter(it => itemMatchesWord(it.name, itemWord));
    if (!items.length) { closeWindow(win); return { ok: false, reason: itemWord ? `i'm not carrying any ${itemWord}` : "i've got nothing to put in" }; }

    let remaining = Number.isFinite(count) && count > 0 ? count : Infinity;
    let moved = 0;
    let lastName = itemWord || "stuff";
    for (const it of items) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, it.count);
      try {
        await win.deposit(it.type, it.metadata == null ? null : it.metadata, take);
        moved += take;
        remaining -= take;
        lastName = it.name;
      } catch (e) {
        log.warn(`deposit failed: ${e.message}`);
      }
      await delay(120);
    }
    closeWindow(win);
    if (moved <= 0) return { ok: false, reason: `couldn't fit anything in the ${containerName}` };
    return { ok: true, reason: `put ${moved}x ${lastName.replace(/_/g, " ")} in the ${containerName}` };
  } catch (e) {
    closeWindow(win);
    return { ok: false, reason: `something went wrong with the ${containerName}` };
  }
}

export async function withdrawItems(itemWord, count, kindWord) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const opened = await openContainerNear(kindWord);
  if (!opened.ok) return { ok: false, reason: opened.reason };
  const win = opened.win;
  const containerName = blockName(opened.block).replace(/_/g, " ");

  try {
    let items = readContainerItems(win);
    if (itemWord) items = items.filter(it => itemMatchesWord(it.name, itemWord));
    if (!items.length) { closeWindow(win); return { ok: false, reason: itemWord ? `no ${itemWord} in the ${containerName}` : `the ${containerName} is empty` }; }

    let remaining = Number.isFinite(count) && count > 0 ? count : Infinity;
    let moved = 0;
    let lastName = itemWord || "stuff";
    for (const it of items) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, it.count);
      try {
        await win.withdraw(it.type, it.metadata == null ? null : it.metadata, take);
        moved += take;
        remaining -= take;
        lastName = it.name;
      } catch (e) {
        log.warn(`withdraw failed: ${e.message}`);
      }
      await delay(120);
    }
    closeWindow(win);
    if (moved <= 0) return { ok: false, reason: `couldn't take anything from the ${containerName}` };
    return { ok: true, reason: `took ${moved}x ${lastName.replace(/_/g, " ")} from the ${containerName}` };
  } catch (e) {
    closeWindow(win);
    return { ok: false, reason: `something went wrong with the ${containerName}` };
  }
}

export async function depositAllExcept(keepWords, kindWord) {
  const bot = getBot();
  if (!bot) return { ok: false, reason: "not in game" };
  const opened = await openContainerNear(kindWord);
  if (!opened.ok) return { ok: false, reason: opened.reason };
  const win = opened.win;
  const containerName = blockName(opened.block).replace(/_/g, " ");

  const keepCats = Array.isArray(keepWords) && keepWords.length ? keepWords : ["tools", "food", "armor"];

  function shouldKeep(name) {
    const n = name.toLowerCase();
    for (const k of keepCats) {
      const cat = KEEP_CATEGORIES[k.toLowerCase()];
      if (cat && cat.test(n)) return true;
      if (!cat && n.includes(k.toLowerCase())) return true;
    }
    return false;
  }

  try {
    const items = bot.inventory.items().filter(it => !shouldKeep(it.name));
    if (!items.length) { closeWindow(win); return { ok: true, reason: "nothing to stash, kept what matters" }; }
    let moved = 0;
    for (const it of items) {
      try { await win.deposit(it.type, it.metadata == null ? null : it.metadata, it.count); moved += it.count; }
      catch (e) { log.warn(`stash deposit failed: ${e.message}`); }
      await delay(120);
    }
    closeWindow(win);
    if (moved <= 0) return { ok: false, reason: `couldn't stash anything in the ${containerName}` };
    return { ok: true, reason: `stashed ${moved} items in the ${containerName}, kept my gear` };
  } catch (e) {
    closeWindow(win);
    return { ok: false, reason: `something went wrong with the ${containerName}` };
  }
}

export async function listContainer(kindWord) {
  const opened = await openContainerNear(kindWord);
  if (!opened.ok) return { ok: false, reason: opened.reason };
  const win = opened.win;
  const containerName = blockName(opened.block).replace(/_/g, " ");
  try {
    const items = readContainerItems(win);
    if (!items.length) { closeWindow(win); return { ok: true, reason: `the ${containerName} is empty` }; }
    const counts = {};
    for (const it of items) counts[it.name] = (counts[it.name] || 0) + it.count;
    const text = Object.keys(counts).map(n => `${counts[n]}x ${n.replace(/_/g, " ")}`).join(", ");
    closeWindow(win);
    return { ok: true, reason: `the ${containerName} has ${text}` };
  } catch (e) {
    closeWindow(win);
    return { ok: false, reason: `couldn't read the ${containerName}` };
  }
}
