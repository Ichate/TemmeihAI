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
