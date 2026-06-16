import { mineBlock, mineLookingAt, mineNamed, digDown, veinMine, mineArea } from "./mine.js";
import { placeBlock } from "./place.js";
import { depositItems, withdrawItems, listContainer, openContainerNear, depositAllExcept } from "./containers.js";
import { smelt, collectSmelted, smeltStatus } from "./furnace.js";
import { useBlock } from "./use.js";
import { chopTree } from "./tree.js";
import { harvestCrops } from "./farm.js";
import { fillBucket, emptyBucket, milkCow } from "./bucket.js";
import { ignite } from "./ignite.js";
import { collectNearbyDrops } from "./collect.js";
import { resolveTargetBlock, findBlockByName, findContainer, findFurnace } from "./blocks.js";

export const world = {
  mineBlock,
  mineLookingAt,
  mineNamed,
  digDown,
  veinMine,
  mineArea,
  placeBlock,
  depositItems,
  withdrawItems,
  listContainer,
  openContainerNear,
  depositAllExcept,
  smelt,
  collectSmelted,
  smeltStatus,
  useBlock,
  chopTree,
  harvestCrops,
  fillBucket,
  emptyBucket,
  milkCow,
  ignite,
  collectNearbyDrops,
  resolveTargetBlock,
  findBlockByName,
  findContainer,
  findFurnace,
};
