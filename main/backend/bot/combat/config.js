export const COMBAT_TICK_MS = 150;

export const MELEE_RANGE = 3;
export const MELEE_CLOSE_TO = 2.2;
export const REACH_BUFFER = 0.5;

export const RANGED_KEEP = 11;
export const RANGED_MIN = 6;
export const BOW_MAX_RANGE = 40;
export const BOW_CHARGE_MS = 1100;

export const ATTACK_COOLDOWN_MS = 600;
export const SPAM_ATTACK_MS = 120;

export const CRIT_JUMP_GAP_MS = 900;

export const STRAFE_SWITCH_MS = 1400;

export const FLEE_HEALTH = 7;
export const HEAL_HEALTH = 12;
export const EAT_HUNGER = 16;
export const TOTEM_HEALTH = 6;

export const ACQUIRE_RANGE = 22;
export const HUNT_RANGE = 48;
export const TARGET_LOST_RANGE = 32;
export const TARGET_LOST_MS = 6000;

export const PROTECT_RADIUS = 6;
export const PROTECT_THREAT_RANGE = 14;
export const GUARD_AREA_RADIUS = 10;
export const REGROUP_DISTANCE = 8;

export const HAZARD_SCAN_AHEAD = 2;
export const CLIFF_DROP_DANGER = 4;

export const KITE_TRIGGER_RANGE = 5;
export const KITE_BACK_MS = 400;

export const GAP_CLOSE_RANGE = 6;
export const FLEEING_TARGET_SPEED = 0.08;

export const CHASE_GIVEUP_MS = 9000;
export const CHASE_GIVEUP_RANGE = 28;

export const ATTACKER_MEMORY_MS = 5000;

export const CALLOUT_MIN_GAP_MS = 6000;
export const SHIELD_REACT_RANGE = 16;
export const CREEPER_SAFE_RANGE = 5;
export const CREEPER_STRIKE_GAP_MS = 1600;

export const RANGED_MOBS = new Set([
  "skeleton", "stray", "bogged", "blaze", "ghast", "pillager", "witch",
  "wither_skeleton", "piglin", "drowned",
]);

export const MELEE_MOBS = new Set([
  "zombie", "husk", "zombie_villager", "spider", "cave_spider", "zombified_piglin",
  "vindicator", "ravager", "hoglin", "zoglin", "vex", "silverfish", "endermite",
  "slime", "magma_cube", "guardian", "elder_guardian", "warden", "piglin_brute",
  "enderman", "phantom", "shulker",
]);

export const DANGER = {
  warden: 100, wither: 100, elder_guardian: 70, ravager: 65, evoker: 60,
  blaze: 45, ghast: 40, witch: 40, vindicator: 50, piglin_brute: 55,
  creeper: 80, skeleton: 35, stray: 35, bogged: 35, wither_skeleton: 50,
  enderman: 55, pillager: 35, zombie: 20, husk: 20, spider: 18, cave_spider: 22,
  drowned: 25, phantom: 25, slime: 12, magma_cube: 18, silverfish: 8,
  guardian: 30, hoglin: 35, zoglin: 40, vex: 28, shulker: 25,
};

export const DEFAULT_DANGER = 20;

export const PASSIVE_MOBS = new Set([
  "cow", "pig", "sheep", "chicken", "rabbit", "horse", "donkey", "mule",
  "cod", "salmon", "squid", "glow_squid", "bat", "villager", "wandering_trader",
  "cat", "ocelot", "parrot", "fox", "panda", "turtle", "axolotl", "frog",
  "bee", "mooshroom", "strider", "camel", "sniffer", "armadillo", "allay",
  "tadpole", "goat", "llama", "trader_llama", "wolf", "polar_bear",
]);
