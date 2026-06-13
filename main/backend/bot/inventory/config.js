export const MATERIAL_TIER = {
  netherite: 6,
  diamond: 5,
  iron: 4,
  golden: 3,
  gold: 3,
  stone: 2,
  chainmail: 2,
  wooden: 1,
  wood: 1,
  leather: 1,
  turtle: 4,
};

export const TOOL_KINDS = ["sword", "pickaxe", "axe", "shovel", "hoe"];

export const ARMOR_SLOTS = {
  head: ["helmet", "turtle_helmet", "carved_pumpkin", "skull", "head"],
  torso: ["chestplate", "elytra"],
  legs: ["leggings"],
  feet: ["boots"],
};

export const ARMOR_SLOT_ORDER = ["head", "torso", "legs", "feet"];

export const VALUE_RANK = [
  { match: /netherite/, score: 100 },
  { match: /elytra|totem|beacon|nether_star|enchanted_golden_apple/, score: 98 },
  { match: /diamond/, score: 90 },
  { match: /^emerald$/, score: 85 },
  { match: /ancient_debris/, score: 95 },
  { match: /gold_ingot|gold_block|^gold_ore|raw_gold/, score: 70 },
  { match: /iron_ingot|iron_block|raw_iron|^iron_ore/, score: 60 },
  { match: /enchanted_book|experience_bottle/, score: 80 },
  { match: /shulker|trident|crossbow|^bow$|shield/, score: 75 },
  { match: /_sword|_pickaxe|_axe|_shovel|_hoe/, score: 55 },
  { match: /_helmet|_chestplate|_leggings|_boots/, score: 55 },
  { match: /golden_apple|ender_pearl|blaze_rod|ghast_tear|nether_wart/, score: 65 },
  { match: /redstone|lapis|quartz|amethyst|copper/, score: 40 },
  { match: /cooked_|bread|steak|golden_carrot|cake|pie/, score: 35 },
  { match: /log$|_wood$|planks$/, score: 25 },
  { match: /coal|charcoal/, score: 22 },
  { match: /raw_|_ingot/, score: 30 },
  { match: /stone|cobble|deepslate|granite|diorite|andesite|tuff/, score: 8 },
  { match: /dirt|gravel|sand|netherrack|grass_block|cobblestone/, score: 3 },
  { match: /seeds|sapling|stick|flint|rotten_flesh|poisonous/, score: 4 },
];

export const DEFAULT_VALUE = 15;

export const FOOD_NAMES = new Set([
  "apple", "golden_apple", "enchanted_golden_apple", "bread", "carrot", "golden_carrot",
  "potato", "baked_potato", "beetroot", "melon_slice", "sweet_berries", "glow_berries",
  "cooked_beef", "cooked_porkchop", "cooked_chicken", "cooked_mutton", "cooked_rabbit",
  "cooked_cod", "cooked_salmon", "beef", "porkchop", "chicken", "mutton", "rabbit",
  "cod", "salmon", "tropical_fish", "pufferfish", "mushroom_stew", "rabbit_stew",
  "beetroot_soup", "suspicious_stew", "pumpkin_pie", "cookie", "dried_kelp", "honey_bottle",
  "chorus_fruit", "spider_eye", "rotten_flesh",
]);

export const PICKUP_SCAN_RADIUS = 16;
export const PICKUP_REACH = 1;
export const SMART_SWAP_MIN_GAP = 25;
export const GIVE_REACH = 2;
export const TOSS_GAP_MS = 250;

export const ALIASES = {
  wood: ["log", "planks"],
  logs: ["log"],
  planks: ["planks"],
  stone: ["cobblestone", "stone"],
  cobble: ["cobblestone"],
  food: ["bread", "cooked", "apple", "carrot", "steak", "potato"],
  meat: ["cooked_beef", "cooked_porkchop", "cooked_chicken", "cooked_mutton", "beef", "porkchop"],
  sword: ["sword"],
  pick: ["pickaxe"],
  pickaxe: ["pickaxe"],
  axe: ["_axe"],
  shovel: ["shovel"],
  spade: ["shovel"],
  armor: ["helmet", "chestplate", "leggings", "boots"],
  diamonds: ["diamond"],
  iron: ["iron_ingot"],
  gold: ["gold_ingot"],
  dirt: ["dirt"],
  torch: ["torch"],
  arrow: ["arrow"],
  arrows: ["arrow"],
};
