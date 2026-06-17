import { getBot } from "./ctx.js";
import { log } from "./log.js";
import { movement } from "./movement/index.js";
import { inventory } from "./inventory/index.js";
import { combat } from "./combat/index.js";
import { world } from "./world/index.js";
import { crafting } from "./crafting/index.js";

export const TOOL_DEFS = [
  {
    name: "come_here",
    description: "Walk ONCE to a player and stop next to them. Use ONLY for 'come here', 'come to me', 'over here', 'come'. This does NOT keep following them after.",
    parameters: {
      type: "object",
      properties: {
        player: { type: "string", description: "username of the player to walk to. omit to use whoever is closest" },
      },
      required: [],
    },
  },
  {
    name: "follow_player",
    description: "Keep following a player CONTINUOUSLY, staying near them as they move. Use this for 'follow me', 'follow', 'come with me', 'stick with me', 'stay with me', 'tag along'. This is different from come_here - it does not stop, it keeps following.",
    parameters: {
      type: "object",
      properties: {
        player: { type: "string", description: "username to follow. omit for the closest player" },
      },
      required: [],
    },
  },
  {
    name: "goto_coords",
    description: "Walk to specific x y z coordinates. Use ONLY when given actual numeric coordinates.",
    parameters: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
      },
      required: ["x", "z"],
    },
  },
  {
    name: "goto_player",
    description: "Walk once to a named player then stop. Rarely needed - prefer come_here for 'come' and follow_player for 'follow'.",
    parameters: {
      type: "object",
      properties: {
        player: { type: "string", description: "username to walk to" },
      },
      required: ["player"],
    },
  },
  {
    name: "stop_moving",
    description: "Stop whatever movement you are doing and stand still. Use when someone says stop, wait, stay, hold on.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "wander",
    description: "Roam around the area on your own for a bit. Use when someone says go explore, wander off, do your own thing.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "flee",
    description: "Run away from danger or a threat nearby. Use when scared, in danger, or told to run.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "jump",
    description: "Jump in place, once or a few times. Use to celebrate, get attention, or mess around.",
    parameters: {
      type: "object",
      properties: {
        times: { type: "integer", description: "how many times to jump, 1 to 5" },
      },
      required: [],
    },
  },
  {
    name: "crouch",
    description: "Sneak/crouch for a short moment. Use to be sneaky or as a gesture.",
    parameters: {
      type: "object",
      properties: {
        seconds: { type: "number", description: "how long to crouch, 1 to 5 seconds" },
      },
      required: [],
    },
  },
  {
    name: "lead_player",
    description: "Walk slightly ahead of a player and guide them, waiting if they fall behind. Use when someone says lead me, show me the way, take me to.",
    parameters: {
      type: "object",
      properties: {
        player: { type: "string", description: "username to lead. omit for the closest player" },
      },
      required: [],
    },
  },
  {
    name: "tail_player",
    description: "Follow a player but hang back at a distance instead of right on top of them. Use when someone says keep your distance, follow from behind.",
    parameters: {
      type: "object",
      properties: {
        player: { type: "string", description: "username to tail. omit for the closest player" },
      },
      required: [],
    },
  },
  {
    name: "stay_here",
    description: "Park at the current spot and stay put, returning if pushed away. Use when someone says wait here, stay, guard this spot, hold position.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "gather",
    description: "Walk to the middle of all the players around. Use when someone says everyone gather, group up, come together.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mirror_player",
    description: "Playfully copy what a player does, jumping and crouching when they do. Use when told to copy me, do what i do, mimic me.",
    parameters: {
      type: "object",
      properties: {
        player: { type: "string", description: "username to copy. omit for the closest player" },
      },
      required: [],
    },
  },
  {
    name: "set_speed",
    description: "Change how fast you move. Use when told to hurry, slow down, sneak, walk normally.",
    parameters: {
      type: "object",
      properties: {
        speed: { type: "string", enum: ["sneak", "walk", "sprint"], description: "movement speed" },
      },
      required: ["speed"],
    },
  },
  {
    name: "react_to_danger",
    description: "Assess nearby threats and reposition smartly, dodge creepers, back off from ranged mobs, retreat. Use when threatened but not necessarily told to flee.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "go_back",
    description: "Walk back to wherever you were right before your last move. Use for 'go back', 'return', 'come back here'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "save_waypoint",
    description: "Remember the current spot under a name so you can return later. Use for 'this is home', 'call this the farm', 'remember this spot as X'.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "name for this spot, e.g. home, farm, base" } },
      required: ["name"],
    },
  },
  {
    name: "goto_waypoint",
    description: "Walk to a previously saved named spot. Use for 'go home', 'head to the farm', 'go to X'.",
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "the saved spot name" } },
      required: ["name"],
    },
  },
  {
    name: "run_route",
    description: "Visit several saved spots in order, one after another. Use for 'go to A then B', 'do the rounds'. Set return_to_start to also come back.",
    parameters: {
      type: "object",
      properties: {
        stops: { type: "array", items: { type: "string" }, description: "ordered list of saved spot names" },
        return_to_start: { type: "boolean", description: "come back to where you started after the last stop" },
      },
      required: ["stops"],
    },
  },
  {
    name: "patrol",
    description: "Loop back and forth between two or more saved spots until told to stop. Use for 'patrol between A and B', 'guard the area'.",
    parameters: {
      type: "object",
      properties: { stops: { type: "array", items: { type: "string" }, description: "saved spot names to patrol between (at least 2)" } },
      required: ["stops"],
    },
  },
  {
    name: "climb_up",
    description: "Find and climb to the highest reachable ground nearby. Use for 'get up high', 'climb that', 'get on the roof', 'go up'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "go_down",
    description: "Find and descend to safe lower ground nearby. Use for 'go down', 'get down here', 'into the cave'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "jump_to_player",
    description: "Try to reach a player who is up on a ledge or higher spot, jumping/parkouring toward them.",
    parameters: {
      type: "object",
      properties: { player: { type: "string", description: "username to reach. omit for closest" } },
      required: [],
    },
  },
  {
    name: "check_on_hurt",
    description: "Go to the player who is most hurt (lowest health), or the nearest player. Use for 'go help', 'check on them', 'who's hurt'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "seek_light",
    description: "Head toward the nearest light source (torch, lantern, glowstone). Use when it's dark and dangerous, or told 'get to the light', 'find safety'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "use_door",
    description: "Walk to and through the nearest door or gate. Use for 'go inside', 'come in', 'go out', 'leave the house'. Set leave true for going out.",
    parameters: {
      type: "object",
      properties: { leave: { type: "boolean", description: "true to go out, false to go in" } },
      required: [],
    },
  },
  {
    name: "gesture",
    description: "Do a body-language gesture. Use to be expressive: wave hello/bye, nod yes, shake head no, bow, turn around, look behind you, or celebrate.",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["wave", "nod", "shake_head", "bow", "turn_around", "look_behind", "celebrate"], description: "which gesture" },
      },
      required: ["kind"],
    },
  },
  {
    name: "mount",
    description: "Walk to the nearest boat, minecart, or rideable animal (horse, pig, etc) and get on it. Use for 'get in the boat', 'ride the horse', 'hop in the minecart'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "dismount",
    description: "Get off whatever you are currently riding. Use for 'get off', 'hop out', 'get out of the boat'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "dive",
    description: "Dive down underwater while in water, instead of floating at the surface. Use for 'dive', 'go underwater', 'go down', 'swim down'. You'll come back up on your own when air runs low.",
    parameters: {
      type: "object",
      properties: { seconds: { type: "integer", description: "how long to stay down, omit for a few seconds" } },
      required: [],
    },
  },
  {
    name: "hold_item",
    description: "Equip/hold an item in your hand. Picks the best one you have of that kind. Use for 'hold a sword', 'get your pickaxe out', 'hold the bread'.",
    parameters: {
      type: "object",
      properties: { item: { type: "string", description: "what to hold, e.g. sword, pickaxe, bread, torch" } },
      required: ["item"],
    },
  },
  {
    name: "put_away",
    description: "Put away whatever you are currently holding (unequip your hand). Use for 'put that away', 'stop holding that', 'empty your hands'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "wear_armor",
    description: "Put on the best armor you have in each slot. Use for 'put your armor on', 'gear up', 'armor up'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "drop_item",
    description: "Drop items on the ground. Drops what you're holding if no item given. Use for 'drop that', 'drop the wood', 'drop 10 cobblestone'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "what to drop. omit to drop what you're holding" },
        count: { type: "integer", description: "how many. omit to drop all of that item" },
      },
      required: [],
    },
  },
  {
    name: "give_item",
    description: "Walk to a player and hand them items by tossing them over. Use for 'give me 10 wood', 'hand steve your sword', 'bring me some food'.",
    parameters: {
      type: "object",
      properties: {
        player: { type: "string", description: "who to give it to. omit for the closest player" },
        item: { type: "string", description: "what to give. omit to give what you're holding" },
        count: { type: "integer", description: "how many. omit to give all of that item" },
      },
      required: [],
    },
  },
  {
    name: "what_do_you_have",
    description: "Report what you're carrying. Use when asked 'what do you have', 'check your inventory', 'what's in your bag', 'how much food'.",
    parameters: {
      type: "object",
      properties: { focus: { type: "string", enum: ["all", "food", "armor", "space"], description: "what to report on" } },
      required: [],
    },
  },
  {
    name: "pick_up_item",
    description: "Walk to and grab a dropped item off the ground. If your inventory is full it will drop something low-value to make room for something better. Use for 'grab that', 'pick that up', 'get the loot'.",
    parameters: {
      type: "object",
      properties: { valuable: { type: "boolean", description: "prefer the most valuable item nearby instead of the closest" } },
      required: [],
    },
  },
  {
    name: "consume_item",
    description: "Eat food, drink a potion, or use a consumable. Use for 'eat something', 'drink that potion', 'eat a golden apple', 'have some food'. Omit item to use what you're holding, or 'food' to eat the best food you have.",
    parameters: {
      type: "object",
      properties: { item: { type: "string", description: "what to consume, e.g. potion, golden_apple, bread, or 'food' for best food. omit for held item" } },
      required: [],
    },
  },
  {
    name: "hold_totem",
    description: "Pull out a totem of undying into your off-hand for protection. Use for 'hold a totem', 'get your totem ready'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "count_item",
    description: "Say how many of a specific item you have. Use for 'how much wood do you have', 'how many arrows', 'do you have diamonds'.",
    parameters: {
      type: "object",
      properties: { item: { type: "string", description: "the item to count" } },
      required: ["item"],
    },
  },
  {
    name: "drop_everything",
    description: "Drop your entire inventory on the ground. Use for 'drop everything', 'empty your bags', 'dump it all'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "organize_inventory",
    description: "Tidy up by merging partial stacks of the same item together. Use for 'sort your inventory', 'tidy up', 'organize your stuff'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "attack",
    description: "Fight something. Attack a specific mob type, the nearest hostile, or whatever is threatening you. Use for 'kill that zombie', 'fight back', 'attack the skeleton', 'defend yourself'. Do NOT use this to attack players - use attack_player for that.",
    parameters: {
      type: "object",
      properties: { mob: { type: "string", description: "mob type to attack like zombie, skeleton, spider. omit to fight the nearest/most dangerous hostile" } },
      required: [],
    },
  },
  {
    name: "hunt",
    description: "Go find and kill a specific kind of creature further away. Use for 'go kill a cow', 'hunt a pig', 'go get that sheep'. Works on animals and mobs.",
    parameters: {
      type: "object",
      properties: { mob: { type: "string", description: "the creature to hunt, e.g. cow, pig, skeleton" } },
      required: ["mob"],
    },
  },
  {
    name: "attack_player",
    description: "Fight another PLAYER. Only use this when a player explicitly asks you to fight/duel/pvp them, or names a player to attack. This starts pvp with that player. Use for 'fight me', 'pvp steve', 'attack that player'.",
    parameters: {
      type: "object",
      properties: { player: { type: "string", description: "username of the player to fight" } },
      required: ["player"],
    },
  },
  {
    name: "stop_fighting",
    description: "Stop all combat and stand down, including ending any pvp. Use for 'stop fighting', 'calm down', 'stand down', 'peace'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "set_defense",
    description: "Turn auto-defense on or off. When on, you fight back when attacked by mobs (or pvp players). Use for 'stop defending yourself', 'don't fight back', 'defend yourself again'.",
    parameters: {
      type: "object",
      properties: { on: { type: "boolean", description: "true to defend when attacked, false to not fight back automatically" } },
      required: ["on"],
    },
  },
  {
    name: "protect_player",
    description: "Stay near a player and automatically fight anything that threatens them. Use for 'protect me', 'guard me', 'watch my back', 'keep me safe', 'protect steve'.",
    parameters: {
      type: "object",
      properties: { player: { type: "string", description: "username to protect. omit for whoever asked" } },
      required: [],
    },
  },
  {
    name: "guard_area",
    description: "Hold the current spot and kill anything hostile that comes near it. Use for 'guard this area', 'defend this spot', 'hold this position', 'keep watch here'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "fight_alongside",
    description: "Mark a player as your ally so you fight together and don't attack them, and stay near them in a group fight. Use for 'fight with me', 'we're a team', 'help me fight', 'you're on my side'.",
    parameters: {
      type: "object",
      properties: { player: { type: "string", description: "username of your ally. omit for whoever asked" } },
      required: [],
    },
  },
  {
    name: "regroup",
    description: "Move back to your nearest ally in a fight instead of charging off alone. Use for 'regroup', 'get back here', 'stay with me'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mine_block",
    description: "Break/mine blocks. Walks to it, equips the right tool, breaks it. Use for 'mine that', 'break the block', 'mine some stone', 'chop that tree', 'get me 10 cobblestone'. Omit block to break what you're looking at.",
    parameters: {
      type: "object",
      properties: {
        block: { type: "string", description: "block type to mine, e.g. stone, oak_log, iron_ore. omit to break what you're looking at" },
        count: { type: "integer", description: "how many to mine. omit for one" },
      },
      required: [],
    },
  },
  {
    name: "dig_down",
    description: "Dig straight down a few blocks, safely (stops at lava or a drop). Use for 'dig down', 'go down'.",
    parameters: {
      type: "object",
      properties: { depth: { type: "integer", description: "how many blocks down. omit for 3" } },
      required: [],
    },
  },
  {
    name: "place_block",
    description: "Place a block from your inventory. Use for 'place a block', 'block that hole', 'put down a torch', 'place some dirt'.",
    parameters: {
      type: "object",
      properties: { block: { type: "string", description: "what to place, e.g. dirt, cobblestone, torch. omit to use any block you have" } },
      required: [],
    },
  },
  {
    name: "store_items",
    description: "Put items into a nearby chest or container. Walks to it, opens it, deposits. Use for 'put your wood in the chest', 'store the loot', 'stash everything'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "what to store. omit to store everything" },
        count: { type: "integer", description: "how many. omit for all" },
        container: { type: "string", description: "kind of container like chest, barrel. omit for nearest" },
      },
      required: [],
    },
  },
  {
    name: "take_items",
    description: "Take items out of a nearby chest or container. Use for 'grab the food from the chest', 'take the iron out of the barrel', 'get everything from the chest'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "what to take. omit to take everything" },
        count: { type: "integer", description: "how many. omit for all" },
        container: { type: "string", description: "kind of container. omit for nearest" },
      },
      required: [],
    },
  },
  {
    name: "check_container",
    description: "Look inside a nearby chest or container and report what's in it. Use for 'what's in the chest', 'check the barrel'.",
    parameters: {
      type: "object",
      properties: { container: { type: "string", description: "kind of container. omit for nearest" } },
      required: [],
    },
  },
  {
    name: "smelt",
    description: "Smelt or cook something in a nearby furnace, loading fuel automatically. Use for 'smelt the iron ore', 'cook the food', 'smelt this'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "what to smelt, e.g. iron_ore, raw_beef, sand" },
        count: { type: "integer", description: "how many. omit for all you have" },
      },
      required: ["item"],
    },
  },
  {
    name: "collect_smelted",
    description: "Take the finished result out of a nearby furnace. Use for 'grab what's smelted', 'get the iron from the furnace'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "use_block",
    description: "Press a button, flip a lever, open a door or gate, or activate a block. Use for 'press the button', 'pull the lever', 'open the door', 'flip the switch'.",
    parameters: {
      type: "object",
      properties: { block: { type: "string", description: "what to use, e.g. button, lever, door. omit for what you're looking at or nearest" } },
      required: [],
    },
  },
  {
    name: "vein_mine",
    description: "Mine a whole connected vein/cluster of the same block (all the touching ore at once), then collect the drops. Use for 'mine all this iron', 'mine the whole vein', 'get all that coal'.",
    parameters: {
      type: "object",
      properties: { block: { type: "string", description: "block type, e.g. iron_ore, coal_ore. omit for what you're looking at" } },
      required: [],
    },
  },
  {
    name: "mine_area",
    description: "Clear out an area of blocks around you. Use for 'clear this area', 'dig out this room', 'clear a 3x3'. Optionally only a specific block type.",
    parameters: {
      type: "object",
      properties: {
        block: { type: "string", description: "only clear this type. omit to clear everything solid" },
        radius: { type: "integer", description: "how big, 1-5. omit for 2" },
      },
      required: [],
    },
  },
  {
    name: "chop_tree",
    description: "Chop a whole tree down, the entire trunk, pillaring up for tall ones, then collect the logs. Use for 'chop that tree', 'cut down the tree', 'get me some wood'.",
    parameters: {
      type: "object",
      properties: { block: { type: "string", description: "log type like oak_log. omit for the nearest tree" } },
      required: [],
    },
  },
  {
    name: "harvest_crops",
    description: "Harvest ripe crops nearby and replant them. Use for 'harvest the wheat', 'collect the crops', 'farm this'.",
    parameters: {
      type: "object",
      properties: { crop: { type: "string", description: "crop type like wheat, carrots. omit for any ripe crop" } },
      required: [],
    },
  },
  {
    name: "fill_bucket",
    description: "Scoop water or lava into an empty bucket from a nearby source. Use for 'get some water', 'fill a bucket', 'grab some lava'.",
    parameters: {
      type: "object",
      properties: { liquid: { type: "string", enum: ["water", "lava"], description: "what to scoop" } },
      required: [],
    },
  },
  {
    name: "empty_bucket",
    description: "Pour out the water or lava you're carrying in a bucket. Use for 'dump the water', 'empty the bucket', 'pour out the lava'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "milk_cow",
    description: "Milk a nearby cow with an empty bucket. Use for 'milk a cow', 'get some milk'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "ignite",
    description: "Light something with flint and steel. Use for 'light the furnace', 'light it up', 'set that on fire', 'light the portal'.",
    parameters: {
      type: "object",
      properties: { block: { type: "string", description: "what to light. omit for what you're looking at" } },
      required: [],
    },
  },
  {
    name: "furnace_status",
    description: "Check how a smelt is going in a nearby furnace, what's cooking and how far along. Use for 'is it done', 'check the furnace', 'how's the smelting'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "stash_keeping",
    description: "Dump everything into a nearby chest except the things you want to keep (tools, food, armor by default). Use for 'store everything but your gear', 'stash the junk', 'empty your bag into the chest but keep your tools'.",
    parameters: {
      type: "object",
      properties: { keep: { type: "array", items: { type: "string" }, description: "categories or items to keep: tools, food, armor, valuables, or specific names" } },
      required: [],
    },
  },
  {
    name: "craft",
    description: "Craft/make an item. Handles making planks and sticks automatically, and sets up a crafting table if the recipe needs one. Use for 'make planks', 'craft a pickaxe', 'make a chest', 'craft 10 sticks', 'make a sword'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "what to make, e.g. oak_planks, stick, wooden_pickaxe, chest, furnace" },
        count: { type: "integer", description: "how many. omit for one" },
      },
      required: ["item"],
    },
  },
  {
    name: "make_table",
    description: "Get a crafting table set up, finding one nearby or making and placing one. Use for 'make a crafting table', 'set up a table'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "can_craft",
    description: "Check whether you're able to make a specific item with what you have. Use for 'can you make a pickaxe', 'can you craft a chest'.",
    parameters: {
      type: "object",
      properties: { item: { type: "string", description: "the item to check" } },
      required: ["item"],
    },
  },
  {
    name: "what_can_i_craft",
    description: "List what you're able to make right now with your current materials. Use for 'what can you make', 'what can you craft'.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "craft_best",
    description: "Make the best version of a tool or armor piece you have materials for (diamond over iron over stone over wood). Use for 'make a pickaxe', 'make the best sword you can', 'make a helmet'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "the tool or armor kind, e.g. pickaxe, sword, helmet" },
        count: { type: "integer", description: "how many. omit for one" },
      },
      required: ["item"],
    },
  },
  {
    name: "craft_until",
    description: "Make sure you have at least N of something, crafting only the difference. Use for 'make sure you have 10 torches', 'get me up to 64 planks'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "what to have" },
        count: { type: "integer", description: "the total amount you should end up with" },
      },
      required: ["item", "count"],
    },
  },
  {
    name: "craft_set",
    description: "Make a full set of tools or armor of a tier. Use for 'make a full set of iron tools', 'craft diamond armor', 'make stone tools'.",
    parameters: {
      type: "object",
      properties: { set: { type: "string", description: "the set, e.g. 'iron tools', 'diamond armor', 'stone tools'" } },
      required: ["set"],
    },
  },
  {
    name: "craft_from_chest",
    description: "Pull the needed materials out of a nearby chest, then craft the item. Use for 'make a pickaxe from the chest', 'craft planks using the chest'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "what to make" },
        count: { type: "integer", description: "how many. omit for one" },
        container: { type: "string", description: "kind of container. omit for nearest" },
      },
      required: ["item"],
    },
  },
  {
    name: "recipe_info",
    description: "Say what ingredients are needed to make something, without crafting it. Use for 'what do you need to make a pickaxe', 'what's the recipe for a chest'.",
    parameters: {
      type: "object",
      properties: { item: { type: "string", description: "the item to look up" } },
      required: ["item"],
    },
  },
  {
    name: "smith_upgrade",
    description: "Upgrade diamond gear to netherite at a smithing table (needs a netherite ingot). Use for 'upgrade my pickaxe to netherite', 'make my armor netherite'.",
    parameters: {
      type: "object",
      properties: { item: { type: "string", description: "the diamond gear to upgrade, e.g. diamond_pickaxe" } },
      required: [],
    },
  },
  {
    name: "stonecut",
    description: "Use a stonecutter to cut a block into stairs/slabs/etc efficiently. Use for 'cut some stone stairs', 'make slabs at the stonecutter'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "what to cut into, e.g. stone_stairs, stone_slab" },
        count: { type: "integer", description: "how many. omit for one" },
      },
      required: ["item"],
    },
  },
  {
    name: "use_anvil",
    description: "Combine, repair, or rename an item at an anvil. Use for 'rename my sword', 'repair my pickaxe', 'combine these'.",
    parameters: {
      type: "object",
      properties: {
        first: { type: "string", description: "the main item" },
        second: { type: "string", description: "the item to combine with or material to repair with" },
        name: { type: "string", description: "new name to give it" },
      },
      required: [],
    },
  },
  {
    name: "enchant",
    description: "Enchant a tool, weapon, or armor at an enchanting table (needs xp levels and lapis). Use for 'enchant my sword', 'enchant this pickaxe'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "what to enchant. omit for what you're holding" },
        level: { type: "integer", description: "preferred enchant slot/level, 1-3" },
      },
      required: [],
    },
  },
  {
    name: "brew",
    description: "Set up a brew at a brewing stand with an ingredient and water bottles. Use for 'brew a healing potion', 'brew with nether wart'.",
    parameters: {
      type: "object",
      properties: { ingredient: { type: "string", description: "the brewing ingredient, e.g. nether_wart, blaze_powder" } },
      required: [],
    },
  },
];

export function toolNames() {
  return TOOL_DEFS.map(t => t.name);
}

export async function executeTool(name, input) {
  const bot = getBot();
  if (!bot || !bot.entity) return { ok: false, reason: "not in game yet" };
  const a = input || {};
  log.info(`tool call: ${name} ${JSON.stringify(a)}`);

  try {
    switch (name) {
      case "come_here":
        return await movement.comeToPlayer(a.player || null);
      case "follow_player":
        return await movement.followPlayer(a.player || null);
      case "goto_coords": {
        if (typeof a.x !== "number" || typeof a.z !== "number") {
          return { ok: false, reason: "need at least x and z" };
        }
        const y = typeof a.y === "number" ? a.y : Math.round(bot.entity.position.y);
        return await movement.gotoCoords(a.x, y, a.z, { label: `${Math.round(a.x)},${Math.round(y)},${Math.round(a.z)}` });
      }
      case "goto_player":
        return await movement.gotoPlayer(a.player);
      case "stop_moving":
        return await movement.stop("told to stop");
      case "wander":
        movement.startWander();
        return { ok: true, reason: "wandering around now" };
      case "flee":
        return await movement.fleeFrom(null, { label: "danger" });
      case "jump": {
        const t = clampInt(a.times, 1, 5, 1);
        await movement.jumpTimes(t);
        return { ok: true, reason: `jumped ${t}x` };
      }
      case "crouch": {
        const s = clampNum(a.seconds, 0.5, 5, 1);
        await movement.sneakFor(s * 1000);
        return { ok: true, reason: `crouched ${s}s` };
      }
      case "lead_player":
        return await movement.escortPlayer(a.player || null);
      case "tail_player":
        return await movement.tailPlayer(a.player || null);
      case "stay_here":
        return await movement.guardSpot(null, null, null, { label: "this spot" });
      case "gather":
        return await movement.gatherToGroup();
      case "mirror_player":
        return movement.startMirror(a.player || null);
      case "set_speed": {
        const sp = ["sneak", "walk", "sprint"].includes(a.speed) ? a.speed : "walk";
        movement.setSpeed(sp);
        return { ok: true, reason: `speed set to ${sp}` };
      }
      case "react_to_danger":
        return await movement.reactToThreats();
      case "go_back":
        return await movement.returnToPrevious();
      case "save_waypoint":
        if (!a.name) return { ok: false, reason: "need a name for the spot" };
        return movement.saveCurrentAs(a.name);
      case "goto_waypoint":
        if (!a.name) return { ok: false, reason: "need the spot name" };
        return await movement.gotoWaypoint(a.name);
      case "run_route":
        if (!Array.isArray(a.stops) || !a.stops.length) return { ok: false, reason: "need a list of stops" };
        return await movement.runQueue(a.stops, { returnToStart: !!a.return_to_start });
      case "patrol":
        if (!Array.isArray(a.stops) || a.stops.length < 2) return { ok: false, reason: "need at least two spots to patrol" };
        return await movement.startPatrol(a.stops);
      case "climb_up":
        return await movement.climbHighGround();
      case "go_down":
        return await movement.descendSafely();
      case "jump_to_player":
        return await movement.jumpToPlayer(a.player || null);
      case "check_on_hurt":
        return await movement.comeToHurtPlayer();
      case "seek_light":
        return await movement.seekLight();
      case "use_door":
        return await movement.goToDoor({ leave: !!a.leave });
      case "gesture": {
        const k = a.kind;
        if (k === "wave") return await movement.wave();
        if (k === "nod") return await movement.nod();
        if (k === "shake_head") return await movement.shakeHead();
        if (k === "bow") return await movement.bow();
        if (k === "turn_around") return await movement.turnAround();
        if (k === "look_behind") return await movement.lookBehind();
        if (k === "celebrate") return await movement.celebrate();
        return { ok: false, reason: "unknown gesture" };
      }
      case "mount":
        return await movement.mountNearest();
      case "dismount":
        return await movement.dismount();
      case "dive":
        return await movement.dive(Number.isFinite(a.seconds) ? a.seconds : null);
      case "hold_item": {
        if (!a.item) return { ok: false, reason: "what should i hold?" };
        const w = a.item.toLowerCase();
        if (/^(sword|axe|weapon)$/.test(w)) {
          if (w === "weapon") return await inventory.equipBestWeapon();
        }
        if (/^(pickaxe|pick|shovel|spade|hoe)$/.test(w)) {
          const kind = w === "pick" ? "pickaxe" : (w === "spade" ? "shovel" : w);
          return await inventory.equipBestTool(kind);
        }
        return await inventory.equipNamed(a.item);
      }
      case "put_away":
        return await inventory.unequipHand();
      case "wear_armor":
        return await inventory.equipArmorSet();
      case "drop_item": {
        const count = Number.isFinite(a.count) ? a.count : null;
        return await inventory.dropItem(a.item || null, count);
      }
      case "give_item": {
        const count = Number.isFinite(a.count) ? a.count : null;
        return await inventory.giveToPlayer(a.player || null, a.item || null, count);
      }
      case "what_do_you_have": {
        const focus = a.focus || "all";
        if (focus === "food") return inventory.foodReport();
        if (focus === "armor") return inventory.armorReport();
        if (focus === "space") return inventory.spaceReport();
        return inventory.carrySummary();
      }
      case "pick_up_item":
        return await inventory.pickUpNearest({ preferValuable: !!a.valuable });
      case "consume_item": {
        const w = (a.item || "").toLowerCase();
        if (!w) return await inventory.useHeld();
        if (w === "food" || w === "anything") return await inventory.eatBestFood();
        return await inventory.useNamed(a.item);
      }
      case "hold_totem":
        return await inventory.holdTotem();
      case "count_item":
        if (!a.item) return { ok: false, reason: "count what?" };
        return inventory.countItem(a.item);
      case "drop_everything":
        return await inventory.dropEverything();
      case "organize_inventory":
        return await inventory.organizeInventory();
      case "attack":
        return await combat.attackMobByName(a.mob || null);
      case "hunt":
        if (!a.mob) return { ok: false, reason: "hunt what?" };
        return await combat.huntMob(a.mob);
      case "attack_player":
        if (!a.player) return { ok: false, reason: "which player?" };
        return await combat.attackPlayer(a.player);
      case "stop_fighting":
        return combat.stopFighting();
      case "set_defense":
        return combat.setAutoDefend(!!a.on);
      case "protect_player":
        return combat.protectPlayer(a.player || null);
      case "guard_area":
        return combat.guardArea();
      case "fight_alongside":
        return combat.addFightAlly(a.player || null);
      case "regroup":
        return await combat.regroup();
      case "mine_block": {
        const count = Number.isFinite(a.count) ? a.count : null;
        if (a.block) return await world.mineNamed(a.block, count);
        return await world.mineLookingAt();
      }
      case "dig_down":
        return await world.digDown(Number.isFinite(a.depth) ? a.depth : null);
      case "place_block":
        return await world.placeBlock(a.block || null, null);
      case "store_items": {
        const count = Number.isFinite(a.count) ? a.count : null;
        return await world.depositItems(a.item || null, count, a.container || null);
      }
      case "take_items": {
        const count = Number.isFinite(a.count) ? a.count : null;
        return await world.withdrawItems(a.item || null, count, a.container || null);
      }
      case "check_container":
        return await world.listContainer(a.container || null);
      case "smelt": {
        if (!a.item) return { ok: false, reason: "smelt what?" };
        const count = Number.isFinite(a.count) ? a.count : null;
        return await world.smelt(a.item, count);
      }
      case "collect_smelted":
        return await world.collectSmelted();
      case "use_block":
        return await world.useBlock(a.block || null);
      case "vein_mine":
        return await world.veinMine(a.block || null);
      case "mine_area":
        return await world.mineArea(a.block || null, Number.isFinite(a.radius) ? a.radius : null);
      case "chop_tree":
        return await world.chopTree(a.block || null);
      case "harvest_crops":
        return await world.harvestCrops(a.crop || null);
      case "fill_bucket":
        return await world.fillBucket(a.liquid || "water");
      case "empty_bucket":
        return await world.emptyBucket();
      case "milk_cow":
        return await world.milkCow();
      case "ignite":
        return await world.ignite(a.block || null);
      case "furnace_status":
        return await world.smeltStatus();
      case "stash_keeping":
        return await world.depositAllExcept(Array.isArray(a.keep) ? a.keep : null, null);
      case "craft":
        if (!a.item) return { ok: false, reason: "make what?" };
        return await crafting.craft(a.item, Number.isFinite(a.count) ? a.count : null);
      case "make_table":
        return await crafting.makeTable();
      case "can_craft":
        if (!a.item) return { ok: false, reason: "make what?" };
        return crafting.canCraft(a.item);
      case "what_can_i_craft":
        return crafting.whatCanICraft();
      case "craft_best":
        if (!a.item) return { ok: false, reason: "make what?" };
        return await crafting.craftBest(a.item, Number.isFinite(a.count) ? a.count : null);
      case "craft_until":
        if (!a.item) return { ok: false, reason: "have what?" };
        return await crafting.craftUntil(a.item, Number.isFinite(a.count) ? a.count : 1);
      case "craft_set":
        if (!a.set) return { ok: false, reason: "which set?" };
        return await crafting.craftSet(a.set);
      case "craft_from_chest":
        if (!a.item) return { ok: false, reason: "make what?" };
        return await crafting.craftFromChest(a.item, Number.isFinite(a.count) ? a.count : null, a.container || null);
      case "recipe_info":
        if (!a.item) return { ok: false, reason: "recipe for what?" };
        return crafting.recipeInfo(a.item);
      case "smith_upgrade":
        return await crafting.smith(a.item || null);
      case "stonecut":
        if (!a.item) return { ok: false, reason: "cut what?" };
        return await crafting.cut(a.item, Number.isFinite(a.count) ? a.count : null);
      case "use_anvil":
        return await crafting.anvil({ first: a.first || null, second: a.second || null, name: a.name || null });
      case "enchant":
        return await crafting.enchant(a.item || null, Number.isFinite(a.level) ? a.level : null);
      case "brew":
        return await crafting.brew(a.ingredient || null);
      default:
        return { ok: false, reason: `unknown tool ${name}` };
    }
  } catch (e) {
    log.error(`tool ${name} threw: ${e.message}`);
    return { ok: false, reason: e.message };
  }
}

function clampInt(v, lo, hi, dflt) {
  const n = parseInt(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}

function clampNum(v, lo, hi, dflt) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(lo, Math.min(hi, n));
}
