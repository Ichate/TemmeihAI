export const MAX_RECONNECTS = 5;
export const RECONNECT_DELAY_MS = 5000;

export const IDLE_MIN_MS = 45000;
export const IDLE_MAX_MS = 90000;
export const LOW_HEALTH_THRESHOLD = 6;

export const EAT_THRESHOLD = 14;

export const BATCH_DELAY_MS = 1200;
export const LOOK_TICK_MS = 1000;

export const NEARBY_RANGE = 24;
export const ATTACK_WITNESS_RANGE = 16;
export const THREAT_RANGE = 12;

export const MAX_TOKENS = 512;
export const REASONING_MAX_TOKENS = 3000;
export const MAX_TOOL_ROUNDS = 4;
export const HTTP_TIMEOUT_MS = 60000;

export const FOOD_ITEMS = new Set([
  "apple", "golden_apple", "enchanted_golden_apple", "bread", "cooked_beef", "cooked_porkchop",
  "cooked_chicken", "cooked_mutton", "cooked_rabbit", "cooked_cod", "cooked_salmon",
  "baked_potato", "carrot", "golden_carrot", "beetroot", "beetroot_soup", "mushroom_stew",
  "rabbit_stew", "melon_slice", "sweet_berries", "glow_berries", "cookie", "pumpkin_pie",
  "dried_kelp", "honey_bottle", "suspicious_stew", "tropical_fish", "beef", "porkchop",
  "chicken", "mutton", "rabbit", "cod", "salmon", "potato",
]);

export const HOSTILE_MOBS = new Set([
  "zombie", "husk", "drowned", "skeleton", "stray", "creeper", "spider", "cave_spider",
  "enderman", "witch", "slime", "phantom", "pillager", "vindicator", "evoker", "ravager",
  "vex", "zombie_villager", "zombified_piglin", "piglin", "piglin_brute", "hoglin", "zoglin",
  "blaze", "ghast", "magma_cube", "wither_skeleton", "guardian", "elder_guardian", "shulker",
  "silverfish", "endermite", "warden",
]);
