export const CRAFT_TIMEOUT_MS = 6000;
export const TABLE_OPEN_TIMEOUT_MS = 6000;
export const TABLE_REACH = 4;
export const TABLE_SCAN_RADIUS = 24;
export const TABLE_PLACE_TRIES = 4;
export const POST_CRAFT_WAIT_MS = 250;

export const CRAFTING_TABLE = "crafting_table";

export const TOOL_TIERS = ["netherite", "diamond", "iron", "stone", "golden", "wooden"];

export const TOOL_KINDS = ["pickaxe", "axe", "shovel", "hoe", "sword"];

export const TIER_MATERIAL = {
  wooden: "planks",
  stone: "cobblestone",
  iron: "iron_ingot",
  golden: "gold_ingot",
  diamond: "diamond",
  netherite: "netherite_ingot",
};

export const INTERMEDIATES = [
  { make: "planks", from: "log", matches: /planks$/ },
  { make: "stick", from: "planks", matches: /^stick$/ },
];

export const ALWAYS_INVENTORY_CRAFT = /(planks$|^stick$|^torch$|button$|^bowl$|nugget$|^crafting_table$)/;

export const ARMOR_KINDS = ["helmet", "chestplate", "leggings", "boots"];

export const ARMOR_TIERS = ["netherite", "diamond", "iron", "golden", "chainmail", "leather"];

export const FULL_SET_TOOLS = ["pickaxe", "axe", "shovel", "sword"];

export const SMELTABLES = {
  iron_ingot: ["raw_iron", "iron_ore", "deepslate_iron_ore"],
  gold_ingot: ["raw_gold", "gold_ore", "deepslate_gold_ore", "nether_gold_ore"],
  copper_ingot: ["raw_copper", "copper_ore", "deepslate_copper_ore"],
  netherite_scrap: ["ancient_debris"],
  glass: ["sand", "red_sand"],
  stone: ["cobblestone"],
  smooth_stone: ["stone"],
  charcoal: ["oak_log", "birch_log", "spruce_log", "jungle_log", "acacia_log", "dark_oak_log", "mangrove_log", "cherry_log"],
  cooked_beef: ["beef"],
  cooked_porkchop: ["porkchop"],
  cooked_chicken: ["chicken"],
  cooked_mutton: ["mutton"],
  cooked_cod: ["cod"],
  cooked_salmon: ["salmon"],
  green_dye: ["cactus"],
  brick: ["clay_ball"],
  terracotta: ["clay"],
};

export const RECURSE_MAX_DEPTH = 5;
export const RECURSE_MAX_STEPS = 64;

export const STATION_NAMES = {
  smithing: "smithing_table",
  stonecutter: "stonecutter",
  anvil: ["anvil", "chipped_anvil", "damaged_anvil"],
  enchanting: "enchanting_table",
  brewing: "brewing_stand",
};

export const STATION_REACH = 4;
export const STATION_SCAN_RADIUS = 24;
export const STATION_TIMEOUT_MS = 6000;
