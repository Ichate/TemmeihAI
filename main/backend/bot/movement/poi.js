import { getBot, args } from "../ctx.js";
import { POI_SCAN_RADIUS, POI_MAX_CANDIDATES } from "./config.js";

const INTERESTING_BLOCKS = {
  chest: 9,
  trapped_chest: 9,
  ender_chest: 8,
  barrel: 7,
  furnace: 5,
  blast_furnace: 5,
  smoker: 5,
  crafting_table: 5,
  enchanting_table: 9,
  anvil: 6,
  bell: 7,
  beacon: 10,
  jukebox: 6,
  lectern: 5,
  bookshelf: 4,
  flower_pot: 3,
  campfire: 6,
  soul_campfire: 6,
  lantern: 3,
  spawner: 9,
  bed: 5,
};

const NATURE_HINTS = [
  { match: /_log$|_wood$/, score: 4, label: "a tree" },
  { match: /water/, score: 5, label: "water" },
  { match: /_leaves$/, score: 2, label: "foliage" },
  { match: /_flower$|tulip|poppy|dandelion|orchid|allium/, score: 3, label: "flowers" },
  { match: /pumpkin|melon/, score: 4, label: "crops" },
  { match: /ore$/, score: 7, label: "ore" },
];

export function scanPointsOfInterest() {
  const bot = getBot();
  if (!bot || !bot.entity) return [];
  const origin = bot.entity.position;
  const found = [];

  try {
    const blocks = bot.findBlocks
      ? bot.findBlocks({
          point: origin,
          maxDistance: POI_SCAN_RADIUS,
          count: POI_MAX_CANDIDATES,
          matching: (block) => block && isInteresting(block.name),
        })
      : [];

    for (const pos of blocks) {
      const block = bot.blockAt(pos);
      if (!block) continue;
      const score = scoreBlock(block.name);
      if (score <= 0) continue;
      found.push({
        x: pos.x + 0.5,
        y: pos.y + 1,
        z: pos.z + 0.5,
        score: score - distancePenalty(origin, pos),
        label: labelFor(block.name),
      });
    }
  } catch {
    return found;
  }

  found.sort((a, b) => b.score - a.score);
  return found;
}

function isInteresting(name) {
  if (!name) return false;
  if (INTERESTING_BLOCKS[name] != null) return true;
  for (const h of NATURE_HINTS) {
    if (h.match.test(name)) return true;
  }
  return false;
}

function scoreBlock(name) {
  if (!name) return 0;
  if (INTERESTING_BLOCKS[name] != null) return INTERESTING_BLOCKS[name];
  for (const h of NATURE_HINTS) {
    if (h.match.test(name)) return h.score;
  }
  return 0;
}

function labelFor(name) {
  if (!name) return "something";
  if (INTERESTING_BLOCKS[name] != null) return name.replace(/_/g, " ");
  for (const h of NATURE_HINTS) {
    if (h.match.test(name)) return h.label;
  }
  return name.replace(/_/g, " ");
}

function distancePenalty(origin, pos) {
  const d = origin.distanceTo(pos.offset ? pos.offset(0, 0, 0) : pos);
  return Math.min(5, d / 6);
}

export function pickPointOfInterest() {
  const list = scanPointsOfInterest();
  if (!list.length) return null;
  const topN = list.slice(0, 5);
  const choice = topN[Math.floor(Math.random() * topN.length)];
  return choice || null;
}

export function nearestInterestingLabel() {
  const list = scanPointsOfInterest();
  return list.length ? list[0].label : null;
}
