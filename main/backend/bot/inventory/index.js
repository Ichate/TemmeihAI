import {
  allItems, heldItem, hotbarItems, armorItems, findItems, findItem,
  countOf, hasItem, freeSlots, isFull, groupedCounts,
} from "./read.js";
import { itemValue, isValuable } from "./value.js";
import {
  equipNamed, equipBestWeapon, equipBestTool, equipArmorSet, unequipHand,
} from "./equip.js";
import { dropHeld, dropItem, dropAll, dropEverything, giveToPlayer } from "./transfer.js";
import {
  pickUpNearest, pickUpValuableIfWorthIt, makeRoomFor, nearbyDroppedItems,
} from "./pickup.js";
import { carrySummary, foodReport, spaceReport, armorReport, countItem } from "./summary.js";
import { useHeld, useNamed, eatBestFood, holdTotem, holdingTotem } from "./consume.js";
import { organizeInventory } from "./organize.js";

export const inventory = {
  allItems,
  heldItem,
  hotbarItems,
  armorItems,
  findItems,
  findItem,
  countOf,
  hasItem,
  freeSlots,
  isFull,
  groupedCounts,
  itemValue,
  isValuable,
  equipNamed,
  equipBestWeapon,
  equipBestTool,
  equipArmorSet,
  unequipHand,
  dropHeld,
  dropItem,
  dropAll,
  dropEverything,
  giveToPlayer,
  pickUpNearest,
  pickUpValuableIfWorthIt,
  makeRoomFor,
  nearbyDroppedItems,
  carrySummary,
  foodReport,
  spaceReport,
  armorReport,
  countItem,
  useHeld,
  useNamed,
  eatBestFood,
  holdTotem,
  holdingTotem,
  organizeInventory,
};
