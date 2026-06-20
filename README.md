![temmeihAI](banner.png)

# temmeihAI

ai bots that actually play minecraft with you.

## what it does

invite a bot to your server, it joins and just lives there. walks around on its own, talks to people in chat, reacts to stuff happening around it. eats when it's hungry, panics when it's at 2 hearts, comments when on world updates. tell it to come over or follow you and it actually walks to you, tell it to kill a mob or guard you and it fights, tell it to mine the ore or chop the tree or stash the loot and it does, tell it to make a pickaxe and it works out the whole chain. it fishes, sleeps, trades, and flies after you on an elytra. you pick the provider (anthropic / openai / openrouter / gemini) and watch the token usage and cost tick up live on the dashboard.

## in action

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://cdn.hackclub.com/019ecf5c-06e9-7d01-ad6f-91ce5a47e122/image.png" width="100%"><br>
      <sub><b>mining</b>, breaking blocks with the right tool</sub>
    </td>
    <td align="center" width="50%">
      <img src="https://cdn.hackclub.com/019ed569-7489-76c3-9419-d328c3a4a7ca/image.png" width="100%"><br>
      <sub><b>smelting</b>, ore into ingots in a furnace</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="https://cdn.hackclub.com/019ed56e-d377-712f-a5da-5a8b3c5661e5/image.png" width="100%"><br>
      <sub><b>crafting</b>, working out the whole recipe chain</sub>
    </td>
    <td align="center" width="50%">
      <img src="https://cdn.hackclub.com/019ec6be-c3c8-7cca-8654-0fe0cf8d9f6e/image.png" width="100%"><br>
      <sub><b>combat</b>, fighting back when something attacks</sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="https://cdn.hackclub.com/019ebc99-af3f-7ba2-81b8-81f1821a37dd/image.png" width="50%"><br>
      <sub><b>walking</b>, walking towards the player</sub>
    </td>
  </tr>
</table>

## features

**chat**
- multi-provider
- custom personality prompt
- 40-message in-memory history, wiped on disconnect
- message batching, multiple players talking at once get one combined reply
- chat sanitization
- prompt-injection guard

**movement**
- wanders its local area on its own when nothing else is going on
- comes to you, follows you, tails you from a distance, leads you somewhere, walks to coordinates, stops, waits at a spot, runs from danger
- remembers spots you name, runs a route of several spots in order, patrols back and forth between spots until told to stop
- goes back to where it was before a detour
- climbs to higher ground, finds a safe way down, tries to reach a player up on a ledge
- heads for a torch or lantern when it's dark, walks in or out through a door, comes to whoever's lowest on health
- gestures: waves, nods, shakes its head, bows, turns around, looks behind it, jumps around to celebrate
- jumps, crouches, changes speed
- parkour, jumping gaps, opening doors, avoiding lava and other hazards
- swims properly
- gets in and out of boats, minecarts, and rides animals like horses and pigs

**items**
- tells you what it's carrying, or how much of one thing it has
- holds what you ask for and picks the best one it owns , same for tools and armor
- puts on its best armor, puts things away
- drops what it's holding, a named item, or an exact count, or empties the whole bag
- gives you items by walking over and handing them across
- picks dropped items up off the ground, and if its bag is full it'll dump something low-value to grab something better
- eats food, drinks potions, holds a totem
- merges loose stacks
- knows real items from how you talk

**combat**
- fights mobs on command
- fights back on its own when something attacks it, and spots nearby hostiles on sight instead of waiting to get hit
- matches the server version: on old versions (under 1.9) it spam-clicks, on newer ones it waits out the attack cooldown so every hit lands, and jumps for crits
- sprints to close in, strafes while swinging, gives up a chase that's going nowhere
- uses a bow if it has one
- backs off from creepers until the moment's right instead of blowing up next to one
- won't chase a target into lava or off a cliff
- goes for whatever's hurting it most, finishes off the weakest first, switches to a creeper if one shows up
- eats, drinks a potion, pops a totem, and runs when it's about to die, then comes back once it's patched up
- pvp only when a player actually asks for it. if it dies or the other player dies the duel's over, two people can both pick a fight, and it keeps chatting while it swings
- protects a player or guards a spot
- fight alongside it as an ally and it won't hit you, and stays near you in a group
- throws out short lines mid-fight, taunts before a duel, calls out a victory

**working the world**
- mines and breaks blocks
- mines a whole connected vein at once 
- chops a whole tree
- digs down safely
- places blocks
- harvests ripe crops and replants them
- puts items in chests and takes them out, by name and count, checks what's inside, and can dump everything but keep its tools and food
- smelts in furnaces
- fills and empties buckets, milks cows, lights things with flint and steel
- presses buttons, pulls levers, opens doors and gates

**crafting**
- makes things from what it's carrying, working out the whole chain itself
- sets up a crafting table when a recipe needs one
- smelts ore into ingots as part of a craft
- makes the best version it can
- makes full sets if asked
- tells you what a recipe needs without making it, and what it can make right now
- uses the other stations too, smithing table for netherite, stonecutter, anvil for repair/rename, enchanting, brewing

**other stuff**
- fishes, casting and reeling on its own until you tell it to stop
- sleeps in a bed at night, and gets up when you want
- trades with villagers, reads out what they offer or trades for something you want
- follows you through the air on an elytra, but only if you've got one and you're actually gliding too, comes back down when you land

**world awareness**
the bot gets a `[current game state: ...]` line every turn with health, hunger, position, dimension, biome, time of day, weather, held item, inventory, nearby players + mobs, xp level. light version for idle chatter, full version for real conversations and combat.

**survival**
- auto-eats when hunger drops
- runs from danger when it's low and something hostile is close
- knows what's hurting it

**reacts to stuff (each with its own cooldown so it doesn't spam)**
- arrival line on first spawn
- player joined / left
- low health, took damage , death
- xp level up
- nightfall / daybreak
- weather change
- biome change
- item pickup
- watching another player attack something nearby
- advancements other players earn
- idle chatter when it's been quiet

**reliability**
- auto-reconnect on kick/disconnect/error, 5 tries 5s apart
- session timer is wall-clock so reconnecting doesn't reset it
- clean shutdown, clears everything and wipes memory on exit
- 60s timeout on llm calls, retries once on error

**dashboard**
- adjustable session length, 5 to 30 min
- optional cost cap
- live countdown, warns under a minute
- provider/model + live token + cost meter with projection

**security**
- 1 bot per ip, 1 spawn per 5 min, rate limited

## setup

```bash
pip install -r requirements.txt
cd main/backend && npm install
```

run:

```bash
cd main/backend
python main.py
```

open http://localhost:3000

### docker

there's a Dockerfile in the root that bundles python and node together, so you don't have to set either up yourself.

```bash
docker build -t temmeih .
docker run -p 3000:3000 temmeih
```

open http://localhost:3000. it builds in production mode by default; pass `-e APP_MODE=local` to run it as a personal local instance instead. on a host like easypanel or railway just point it at the repo, it picks up the Dockerfile and exposes port 3000 on its own.

## local vs production

there are two ways to run it, set by the `APP_MODE` env var.

**local** (the default, for running on your own machine)
- no timers cap, no spawn cooldown, no ip limits, it's your box, do what you want
- run several bots at once
- sessions can go much longer (up to a day)
- an "api keys" page on the home menu: save your keys once (they get verified, then stored in `keys.json` on your machine), and just pick a saved key when you spawn a bot instead of pasting it every time

```bash
python main.py
```

**production** (for hosting it publicly for lots of people)
- run it with `APP_MODE=production`
- no accounts, no signup. each browser quietly gets a random id the first time it visits, and that's how users are told apart, so two people on the same wifi don't step on each other
- everyone only sees their own bots on the dashboard, and their own history
- the limits stay on (spawn cooldown, session cap, cost cap), counted per person
- no key storage, keys are used for the spawn and never saved to disk

```bash
APP_MODE=production python main.py
```

## how to use

1. open the dashboard, click create bot
2. server ip, port, version, bot name
3. pick provider, paste api key (it verifies and pulls the real model list)
4. pick model, optional personality, session length, optional cost cap
5. bot joins and starts doing its thing

then just talk to it in chat.

## coming soon

- redstone
- building, walls and shelters
- gathering

## license

apache 2.0
