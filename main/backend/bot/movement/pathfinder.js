import pathfinderPkg from "mineflayer-pathfinder";
import { log } from "../log.js";

const { pathfinder, Movements, goals } = pathfinderPkg;

let loaded = false;
let movements = null;

export function loadPathfinder(bot) {
  if (!bot) return false;
  try {
    if (!bot.pathfinder) {
      bot.loadPlugin(pathfinder);
    }
    try {
      bot.pathfinder.thinkTimeout = 5000;
      bot.pathfinder.tickTimeout = 20;
      if (bot.pathfinder.searchRadius != null) bot.pathfinder.searchRadius = 200;
    } catch {}
    loaded = true;
    return true;
  } catch (e) {
    log.error(`pathfinder load failed: ${e.message}`);
    loaded = false;
    return false;
  }
}

export function buildMovements(bot) {
  if (!bot || !bot.pathfinder) return null;
  try {
    const mcData = bot.registry || getMcData(bot);
    const m = new Movements(bot);

    m.allowParkour = true;
    m.allowSprinting = true;
    m.allow1by1towers = true;
    m.canDig = false;
    m.allowFreeMotion = false;
    m.dontCreateFlow = true;
    m.maxDropDown = 4;
    m.infiniteLiquidDropdownDistance = false;
    m.canOpenDoors = true;
    m.allowEntityDetection = true;

    if (mcData && mcData.blocksByName) {
      const water = mcData.blocksByName.water;
      const lava = mcData.blocksByName.lava;
      if (lava) m.blocksToAvoid.add(lava.id);
      if (water) m.liquids.add(water.id);

      const hazards = ["cactus", "fire", "magma_block", "sweet_berry_bush", "wither_rose", "campfire", "soul_campfire", "powder_snow"];
      for (const h of hazards) {
        const b = mcData.blocksByName[h];
        if (b) m.blocksToAvoid.add(b.id);
      }

      const climbables = ["ladder", "vine", "scaffolding", "twisting_vines", "twisting_vines_plant", "weeping_vines", "weeping_vines_plant"];
      if (m.climbables && typeof m.climbables.add === "function") {
        for (const c of climbables) {
          const b = mcData.blocksByName[c];
          if (b) m.climbables.add(b.id);
        }
      }

      const openable = ["oak_door", "spruce_door", "birch_door", "jungle_door", "acacia_door", "dark_oak_door", "mangrove_door", "cherry_door", "bamboo_door", "crimson_door", "warped_door", "oak_fence_gate", "spruce_fence_gate", "birch_fence_gate", "jungle_fence_gate", "acacia_fence_gate", "dark_oak_fence_gate"];
      if (m.openable && typeof m.openable.add === "function") {
        for (const o of openable) {
          const b = mcData.blocksByName[o];
          if (b) m.openable.add(b.id);
        }
      }
    }

    movements = m;
    bot.pathfinder.setMovements(m);
    return m;
  } catch (e) {
    log.error(`buildMovements failed: ${e.message}`);
    return null;
  }
}

function getMcData(bot) {
  try {
    return bot.registry || (bot.version ? requireMcData(bot.version) : null);
  } catch {
    return bot.registry || null;
  }
}

function requireMcData(version) {
  try {
    return null;
  } catch {
    return null;
  }
}

export function getMovements() {
  return movements;
}

export function isLoaded() {
  return loaded;
}

export function makeGoalNear(x, y, z, range) {
  try { return new goals.GoalNear(x, y, z, range); }
  catch (e) { log.error(`makeGoalNear failed: ${e.message}`); return null; }
}

export function makeGoalBlock(x, y, z) {
  try { return new goals.GoalBlock(x, y, z); }
  catch (e) { log.error(`makeGoalBlock failed: ${e.message}`); return null; }
}

export function makeGoalXZ(x, z, range) {
  try { return new goals.GoalNearXZ(x, z, range); }
  catch (e) { log.error(`makeGoalXZ failed: ${e.message}`); return null; }
}

export function makeGoalFollow(entity, range) {
  try { return new goals.GoalFollow(entity, range); }
  catch (e) { log.error(`makeGoalFollow failed: ${e.message}`); return null; }
}

export function makeGoalInvert(goal) {
  try { return new goals.GoalInvert(goal); }
  catch (e) { log.error(`makeGoalInvert failed: ${e.message}`); return null; }
}

export function goalsApi() {
  return goals;
}

export function gotoGoal(bot, goal) {
  if (!bot || !bot.pathfinder) return Promise.reject(new Error("pathfinder not loaded"));
  return bot.pathfinder.goto(goal);
}

export function setDynamicGoal(bot, goal) {
  if (!bot || !bot.pathfinder) return false;
  try { bot.pathfinder.setGoal(goal, true); return true; }
  catch (e) { log.error(`setGoal failed: ${e.message}`); return false; }
}

export function clearGoal(bot) {
  if (!bot || !bot.pathfinder) return;
  try { bot.pathfinder.setGoal(null); } catch {}
}
