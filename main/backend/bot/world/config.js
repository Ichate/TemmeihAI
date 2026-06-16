export const REACH_DISTANCE = 4.2;
export const REACH_GOAL_TOLERANCE = 2;
export const REACH_TIMEOUT_MS = 12000;
export const BLOCK_SCAN_RADIUS = 6;
export const FIND_SCAN_RADIUS = 32;
export const MINE_TIMEOUT_MS = 30000;
export const PLACE_TIMEOUT_MS = 6000;
export const CONTAINER_OPEN_TIMEOUT_MS = 6000;
export const SMELT_WAIT_MS = 600;
export const COLLECT_WAIT_MS = 800;

export const TOOL_FOR_MATERIAL = [
  { match: /(_ore$|_block$|stone|cobble|deepslate|granite|diorite|andesite|tuff|obsidian|netherrack|basalt|blackstone|furnace|anvil|concrete|terracotta|brick| amethyst|quartz|sandstone|prismarine|purpur|end_stone|nether_brick|magma|spawner)/, tool: "pickaxe" },
  { match: /(log$|_wood$|planks$|fence|door|table|chest|barrel|bookshelf|wood|stem$|hyphae|sign|ladder|trapdoor|stripped_)/, tool: "axe" },
  { match: /(dirt|grass_block|sand|gravel|clay|soul_sand|soul_soil|podzol|mycelium|farmland|snow|mud|path)/, tool: "shovel" },
  { match: /(leaves|wool|web|cobweb)/, tool: "shears" },
  { match: /(wheat|carrot|potato|beetroot|melon|pumpkin|cane|crop|netherwart|berry|hay)/, tool: "hoe" },
];

export const UNBREAKABLE = new Set([
  "bedrock", "barrier", "command_block", "chain_command_block", "repeating_command_block",
  "structure_block", "structure_void", "jigsaw", "end_portal", "end_portal_frame",
  "end_gateway", "nether_portal", "light", "air", "cave_air", "void_air", "water", "lava",
]);

export const CONTAINER_NAMES = new Set([
  "chest", "trapped_chest", "ender_chest", "barrel",
  "shulker_box", "white_shulker_box", "orange_shulker_box", "magenta_shulker_box",
  "light_blue_shulker_box", "yellow_shulker_box", "lime_shulker_box", "pink_shulker_box",
  "gray_shulker_box", "light_gray_shulker_box", "cyan_shulker_box", "purple_shulker_box",
  "blue_shulker_box", "brown_shulker_box", "green_shulker_box", "red_shulker_box", "black_shulker_box",
  "hopper", "dispenser", "dropper",
]);

export const FURNACE_NAMES = new Set(["furnace", "blast_furnace", "smoker", "lit_furnace"]);

export const USABLE_NAMES = [
  "button", "lever", "_door", "fence_gate", "trapdoor", "pressure_plate",
  "note_block", "bell", "daylight_detector", "lectern", "jukebox", "comparator", "repeater",
];

export const FUEL_PRIORITY = [
  "coal", "charcoal", "coal_block", "blaze_rod", "lava_bucket", "dried_kelp_block",
  "planks", "log", "stick", "wooden",
];

export const VEIN_MAX = 64;
export const VEIN_CONNECT_RADIUS = 1;
export const AREA_MAX = 256;
export const TREE_MAX = 48;
export const TREE_PILLAR_BLOCK = ["dirt", "cobblestone", "netherrack", "cobbled_deepslate", "stone"];
export const COLLECT_RADIUS = 6;
export const COLLECT_PER_BLOCK_MS = 400;
export const WORK_EAT_HUNGER = 16;
export const WORK_FLEE_HEALTH = 7;

export const LOG_NAMES = /(_log$|_wood$|_stem$|_hyphae$|stripped_)/;
export const LEAF_NAMES = /(leaves|_wart_block|shroomlight|nether_wart_block)/;

export const CROP_REPLANT = {
  wheat: "wheat_seeds",
  carrots: "carrot",
  potatoes: "potato",
  beetroots: "beetroot_seeds",
  nether_wart: "nether_wart",
};

export const MATURE_AGE = {
  wheat: 7, carrots: 7, potatoes: 7, beetroots: 3, nether_wart: 3,
};

export const KEEP_CATEGORIES = {
  tools: /(_sword|_pickaxe|_axe|_shovel|_hoe|shears|bow|crossbow|fishing_rod|flint_and_steel|shield|bucket)/,
  food: /(apple|bread|carrot|potato|beetroot|melon|berries|cooked_|beef|porkchop|chicken|mutton|rabbit|cod|salmon|stew|soup|pie|cookie|kelp|honey_bottle)/,
  armor: /(_helmet|_chestplate|_leggings|_boots|elytra|turtle_helmet)/,
  valuables: /(diamond|netherite|emerald|totem|enchanted|ancient_debris|nether_star|beacon)/,
};
