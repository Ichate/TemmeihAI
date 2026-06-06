# temmeihAI

ai bots that actually play minecraft with you.

not just stand there. not just follow you around. actually talk, fight, build, craft, grind. like a real player, but it never logs off.

## what it does

you invite a bot to your server and it plays with you. talk to it in chat and it responds with an actual brain behind it. it knows it's in minecraft, knows its own name, remembers conversations, and responds to whoever's talking to it.

- talks - real conversations powered by your choice of llm
- remembers - rolling in-memory history, cleared on disconnect
- multi-provider - anthropic, openai, openrouter, gemini
- model picker - verifies your key and lists actual available models
- custom personality - give it a system prompt and make it act however you want
- looks at closest player - turns to face whoever is nearby
- batches messages - if multiple players talk at once, one smart reply to all
- auto-leaves - disconnects after 5 minutes
- 1 bot per ip - one session at a time

## setup

```bash
pip install -r requirements.txt
cd main/backend && npm install
```

then run:

```bash
cd main/backend
python main.py
```

go to http://localhost:3000

## how to use

1. open the dashboard
2. click create bot
3. type in server ip, port, minecraft version, bot name
4. pick a provider
5. paste your api key (it verifies it and pulls the real model list)
6. pick a model
7. optionally give it a personality
8. bot joins and starts chatting

## project layout

```
main/
  site/
    index.html
    start.html          dashboard page
    about.html
    css/
      style.css
      dashboard.css
    js/
      main.js
      start.js
  backend/
    main.py             server entry point
    config.py           all the constants
    logger.py           terminal logging
    db.py               saves recent bot sessions
    llm.py              api calls to all providers
    routes/
      bot.py            bot endpoints
      chat.py           chat + key verify endpoints
    bot/
      run.js            the actual bot, calls apis directly
      history.js        in-memory chat history
```

## how the ai works

- player messages are batched (1.2s window) so multiple players get one combined reply
- bot calls the provider api directly
- system prompt is hardcoded minecraft context plus whatever personality you set
- last 40 messages kept in memory per session
- memory is in-ram only, cleared completely when bot leaves or session ends

## current features

- fastapi backend
- mineflayer bot (node subprocess)
- multi-provider llm support (anthropic, openai, openrouter, gemini)
- live model fetching on key verify
- rolling 40-message in-memory history
- custom system prompt per bot
- 1 bot per ip
- input validation
- looks at closest player
- auto leave after 5 min
- dashboard with live countdown timer

## coming soon

- pathfinder (actually move around)
- tool calls (mining, crafting, combat, building)
- longer sessions

## license

apache 2.0
