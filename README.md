# temmeihAI

ai bots that actually play minecraft with you.

not just stand there. not just follow you around. actually play like fight, build, craft, cook, grind, talk. like a real player, but it never logs off.

---

## what it does

you invite a bot to your server and it  plays with you. you can talk to it in chat, ask it to go mine some iron, tell it to build a house, or just have it fight alongside you. it's got a brain (llm), legs (pathfinder), and hands (mineflayer).

- **talks** — real conversations in chat, not just commands
- **walks** — follows you, navigates on its own
- **fights** — alongside you or against you (yes really)
- **crafts** — tell it what you need, it figures out the recipe
- **cooks** — so you stop dying of hunger mid-build
- **grinds** — send it off to farm while you do other stuff
- **builds** — describe something and watch it happen

---

## how it works

mineflayer handles the actual minecraft connection and the bot joins like a real player. pathfinder gives it the ability to move around without falling into lava every 5 seconds. the llm is the brain that decides what to do, responds to chat, and plans out tasks with toolcalls etc. nextjs frontend is where you can control everything.

```
your server > mineflayer > pathfinder > llm > bot works and plays with you
```

---

## stack

- **mineflayer** — bot connects to minecraft
- **mineflayer-pathfinder** — so it can actually walk
- **llm** (preferably claude since its smart) — the brain
- **node.js** — runs the whole thing
- **next.js** — the ui you interact with

---

## setup

coming soon
