# temmeihAI

ai bots that actually play minecraft with you.

not just stand there. not just follow you around. actually talk, fight, build, craft, grind. like a real player, but it never logs off.

## what it does

you invite a bot to your server and it plays with you. talk to it in chat and it responds with an actual brain behind it. it knows it's in minecraft, knows its own name, remembers conversations, and responds to whoever's talking to it.

- **talks** - real conversations powered by claude
- **remembers** - 50 message rolling history with auto-summarization
- **knows the game** - it knows it's playing minecraft
- **custom personality** - give it a system prompt and make it act however you want
- **walks** - looks at the closest player (pathfinder coming soon)
- **leaves** - auto-disconnects after 5 minutes

## setup

### install

```bash
pip install -r requirements.txt

cd main/backend
npm install
```

### run

```bash
cd main/backend
python main.py
```

open http://localhost:3000

### connect

1. start minecraft server
2. start backend
3. open site, go to dashboard
4. click "create bot"
5. fill in server ip, port, version, bot name
6. paste your anthropic api key (get one at console.anthropic.com)
7. optionally add a system prompt to give the bot a personality
8. bot joins and starts talking

## project structure

```
main/
  site/               html frontend
    index.html
    start.html        dashboard
    about.html
    css/
      style.css
      dashboard.css
    js/
      main.js
      start.js
  backend/            fastapi + node bot
    main.py
    package.json
    bot/
      run.js          bot entry, chat listener
      llm.js          anthropic api calls
      history.js      rolling chat history + summarization
```

## how the ai works

- each player message goes through claude (sonnet by default)
- hardcoded system prompt tells the bot it's in minecraft and what its name is
- user can add their own instructions on top (custom personality)
- last 50 messages kept in memory per bot session
- when 50 messages is hit, it summarizes them and starts fresh
- summary is included in context on next round so it doesn't forget

## current features

- fastapi backend
- mineflayer bot (node subprocess)
- claude ai chat via anthropic api
- rolling 50-message history with summarization
- custom system prompt per bot
- 1 bot per ip (rate limit)
- input validation (including api key format check)
- looks at closest player
- auto leave after 5 min
- dashboard with live timer
- bot history (json)

## coming soon

- pathfinder (actually move around)
- tool calls (mining, crafting, combat, building)
- longer sessions

## license

apache 2.0
