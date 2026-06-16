![temmeihAI](banner.png)

# temmeihAI

ai bots that actually play minecraft with you.

## what it does

invite a bot to your server, it joins and just lives there. walks around on its own, talks to people in chat, reacts to stuff happening around it. eats when it's hungry, panics when it's at 2 hearts, comments when it rains, greets new players. tell it to come over or follow you and it actually walks to you, tell it to kill a mob or guard you and it fights, tell it to mine the ore or chop the tree or stash the loot and it does. you pick the provider (anthropic / openai / openrouter / gemini) and watch the token usage and cost tick up live on the dashboard.

## features

**chat**
- multi-provider with live key check and real model list
- custom personality prompt
- 40-message in-memory history, wiped on disconnect
- message batching, multiple players talking at once get one combined reply
- chat sanitization, strips server `/commands` and junk
- prompt-injection guard, catches "ignore your instructions" type stuff

**movement**
- wanders its local area on its own when nothing else is going on
- comes to you, follows you, tails you from a distance, leads you somewhere, walks to coordinates, stops, waits at a spot, runs from danger
- remembers spots you name ("this is home" then later "go home"), runs a route of several spots in order, patrols back and forth between spots until told to stop
- goes back to where it was before a detour
- climbs to higher ground, finds a safe way down, tries to reach a player up on a ledge
- heads for a torch or lantern when it's dark, walks in or out through a door, comes to whoever's lowest on health
- gestures: waves, nods, shakes its head, bows, turns around, looks behind it, jumps around to celebrate
- jumps, crouches, changes speed between sneak / walk / sprint
- it picks all of this itself through the model's tool calls, so it acts because it decided to, not because a keyword matched
- runs on pathfinder for the actual walking: parkour, jumping gaps, opening doors, avoiding lava and other hazards
- swims properly instead of sinking, stays at the surface in water and comes up for air instead of drowning on the bottom
- gets in and out of boats, minecarts, and rides animals like horses and pigs
- arrival is only reported when it physically gets there, and it tells you honestly if it can't find a path or gets stuck
- one thing at a time, with an order to it: surviving comes before your commands, your commands come before its own wandering

**items**
- tells you what it's carrying, or how much of one thing it has
- holds what you ask for and picks the best one it owns (asking for a sword with a stone and a diamond one gets you the diamond), same for tools and armor
- puts on its best armor, puts things away
- drops what it's holding, a named item, or an exact count, or empties the whole bag
- gives you items by walking over and handing them across, gives what it has if you ask for more
- picks dropped items up off the ground, and if its bag is full it'll dump something low-value to grab something better (but won't throw away something worth more than what it's grabbing)
- eats food, drinks potions, holds a totem
- merges loose stacks of the same thing together
- knows real items from how you talk, "wood" finds logs and planks, "sword" finds the diamond sword

**combat**
- fights mobs on command ("kill that zombie") or hunts a creature down ("go kill a cow")
- fights back on its own when something attacks it, and spots nearby hostiles on sight instead of waiting to get hit
- matches the server version: on old versions (under 1.9) it spam-clicks, on newer ones it waits out the attack cooldown so every hit lands, and jumps for crits
- sprints to close in, strafes while swinging, gives up a chase that's going nowhere
- uses a bow if it has one: aims ahead of moving targets, keeps its distance, backs up while shooting when something rushes it
- backs off from creepers until the moment's right instead of blowing up next to one
- won't chase a target into lava or off a cliff
- handles a crowd: goes for whatever's hurting it most, finishes off the weakest first, switches to a creeper if one shows up
- looks after itself mid-fight: eats, drinks a potion, pops a totem, and runs when it's about to die, then comes back once it's patched up
- pvp only when a player actually asks for it ("fight me", "pvp steve"), never random players. if it dies or the other player dies the duel's over, two people can both pick a fight, and it keeps chatting while it swings
- protects a player (stays near them and kills what comes at them) or guards a spot
- fight alongside it as an ally and it won't hit you, and stays near you in a group scrap
- throws out short lines mid-fight, taunts before a duel, calls out a victory

**working the world**
- mines and breaks blocks, walking over and grabbing the drops, picking the right tool for what it's breaking (pickaxe for stone, axe for wood, shovel for dirt)
- mines a whole connected vein at once ("mine all this iron"), or clears out an area
- chops a whole tree, the entire trunk, pillaring up to reach the top of tall ones
- digs down safely, won't dig into lava or off a drop, won't break bedrock
- places blocks, against a real surface
- harvests ripe crops and replants them
- puts items in chests and takes them out, by name and count, checks what's inside, and can dump everything but keep its tools and food
- smelts in furnaces, loading fuel on its own, and tells you how far along it is
- fills and empties buckets, milks cows, lights things with flint and steel
- presses buttons, pulls levers, opens doors and gates
- on a long job it stops to eat if it gets hungry, stops when its bag is full instead of wasting drops, and fights back if something jumps it then carries on

**world awareness**
the bot gets a `[current game state: ...]` line every turn with health, hunger, position, dimension, biome, time of day, weather, held item, inventory, nearby players + mobs, xp level. light version for idle chatter, full version for real conversations and combat.

**survival**
- auto-eats when hunger drops, knows ~40 food items, swaps back to whatever it was holding
- runs from danger when it's low and something hostile is close
- knows what's hurting it, a mob, a player, a fall, drowning, lava, fire, or a cactus, instead of just saying "something hit me"

**reacts to stuff (each with its own cooldown so it doesn't spam)**
- arrival line on first spawn
- player joined / left
- low health, took damage (says what hit it), death
- xp level up
- nightfall / daybreak
- rain start/stop, thunderstorm
- biome change
- item pickup
- watching another player attack something nearby
- advancements other players earn
- idle chatter when it's been quiet

**reliability**
- auto-reconnect on kick/disconnect/error, 5 tries 5s apart
- session timer is wall-clock so reconnecting doesn't reset it
- clean shutdown, clears everything and wipes memory on exit
- 60s timeout on llm calls, retries once on a hiccup

**dashboard**
- adjustable session length, 5 to 30 min
- optional cost cap, auto-stops if it spends too much
- live countdown, warns under a minute
- provider/model + live token + cost meter with projection
- countdown when you hit the spawn cooldown
- scrollable model list with keyboard nav

**security**
- 1 bot per ip, 1 spawn per 5 min, rate limited
- server gets pinged before spawn so you get a clear error instead of a hang
- full input validation

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

## how to use

1. open the dashboard, click create bot
2. server ip, port, version, bot name
3. pick provider, paste api key (it verifies and pulls the real model list)
4. pick model, optional personality, session length, optional cost cap
5. bot joins and starts doing its thing

then just talk to it in chat. try "come here", "follow me", "go to 100 64 -200", "stop", "this is home", "go home", "wait here", "climb up", "wave", "patrol between home and the gate", "hold a sword", "give me 10 wood", "what do you have", "drop everything", "eat something", "kill that zombie", "protect me", "guard this spot", "fight me", "mine that", "mine all this iron", "chop that tree", "put your wood in the chest", "what's in the chest", "smelt the iron", "harvest the wheat".

## project layout

```
main/
  site/                        frontend
    index.html  about.html  start.html
    css/  js/
  backend/                     fastapi server
    main.py                    entry
    config.py  logger.py  db.py  llm.py
    routes/
      bot.py                   spawn / status / stop / history
      chat.py                  chat proxy + key verify
    bot/                       node mineflayer bot
      run.js                   entry
      ctx.js                   shared state + args
      config.js                thresholds, ranges, food/hostile sets
      log.js  cooldowns.js  history.js
      llm.js                   provider calls + tool calling
      tools.js                 tool definitions the bot can call
      state.js                 world state + entity helpers
      damage.js  sanitize.js  sounds.js  intents.js  drops.js
      speech.js                chat, context, runs tool calls
      session.js               connect / reconnect / shutdown
      handlers.js              all the bot event listeners
      ping.js                  server reachability check
      movement/                the movement system
        config.js              all movement tuning
        pathfinder.js          pathfinder setup + goal helpers
        actions.js             jump, sneak, sprint, look, stop
        controller.js          mode state machine + priorities
        goals.js               come, follow, goto, flee, climb, descend, doors, light
        waypoints.js           named spots, routes, patrol
        gestures.js            wave, nod, bow, turn, celebrate
        wander.js              roams on its own
        combat-move.js         dodge, keep distance, retreat
        social.js              personal space, mirror a player
        swim.js                stays afloat, surfaces for air
        riding.js              boats, minecarts, animals
        poi.js                 finds interesting nearby spots to wander to
        watchdog.js            lost-target / flee timeout / guard return
        index.js               init + public api
      inventory/               carrying and using items
        config.js              material tiers, item values, aliases
        read.js                what it's holding / carrying
        match.js               turns "wood" into real item names
        value.js               scores items junk vs valuable
        equip.js               hold best gear, armor, unequip
        transfer.js            drop and give items
        pickup.js              grab items, swap out junk when full
        consume.js             eat food, drink potions, totem
        organize.js            merge loose stacks
        summary.js             carry / food / count reports
        index.js               public api
      combat/                  fighting
        config.js              ranges, cooldowns, mob danger ratings
        version.js             spam vs cooldown combat by server version
        targeting.js           pick / score / switch targets
        threat.js              health checks, who's hitting hardest
        melee.js               swing timing, crits, strafe, gap-close
        ranged.js              bow aiming, kiting
        defense.js             shield, heal/eat/totem, creeper hit-and-run
        hazard.js              don't chase into lava or off cliffs
        protect.js             guard a player or a spot
        allies.js              who it's fighting alongside
        callouts.js            short lines mid-fight
        pvp.js                 the pvp opt-in rules
        watch.js               spots threats on sight
        controller.js          the fight loop
        index.js               init + public api
      world/                   working with blocks and the world
        config.js              reach, tool-for-block, hazards, timeouts
        reach.js               get next to a block and face it
        blocks.js              find a target block
        safety.js              don't mine into lava or off a drop
        mine.js                break blocks, vein-mine, area clear, dig down
        place.js               place a block against a surface
        tree.js                chop a whole tree, pillar up tall ones
        farm.js                harvest and replant crops
        collect.js             grab the drops off the ground
        workguard.js           eat / stop-when-full / fight mid-job
        containers.js          chests: deposit, withdraw, stash, list
        furnace.js             smelt, fuel, collect, status
        bucket.js              fill/empty water and lava, milk cows
        ignite.js              flint and steel
        use.js                 buttons, levers, doors
        index.js               public api
```

## coming soon

- crafting tools and items (in works)
- gathering loops, "go get me 20 wood"
- building, walls and shelters
- live chat feed on the dashboard

## license

apache 2.0
