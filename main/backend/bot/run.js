import mineflayer from "mineflayer";
import https from "https";
import { History } from "./history.js";

const [ip, port, version, botName, apiKey, provider, model, systemPrompt, sessionSecondsArg] = process.argv.slice(2);

const SESSION_SECONDS = parseInt(sessionSecondsArg) || 300;
const SESSION_DEADLINE = Date.now() + SESSION_SECONDS * 1000;

const MAX_RECONNECTS = 5;
const RECONNECT_DELAY_MS = 5000;

const IDLE_MIN_MS = 45000;
const IDLE_MAX_MS = 90000;
const LOW_HEALTH_THRESHOLD = 6;

const EAT_THRESHOLD = 14;
const FOOD_ITEMS = new Set([
  "apple", "golden_apple", "enchanted_golden_apple", "bread", "cooked_beef", "cooked_porkchop",
  "cooked_chicken", "cooked_mutton", "cooked_rabbit", "cooked_cod", "cooked_salmon",
  "baked_potato", "carrot", "golden_carrot", "beetroot", "beetroot_soup", "mushroom_stew",
  "rabbit_stew", "melon_slice", "sweet_berries", "glow_berries", "cookie", "pumpkin_pie",
  "dried_kelp", "honey_bottle", "suspicious_stew", "tropical_fish", "beef", "porkchop",
  "chicken", "mutton", "rabbit", "cod", "salmon", "potato",
]);

const HOSTILE_MOBS = new Set([
  "zombie", "husk", "drowned", "skeleton", "stray", "creeper", "spider", "cave_spider",
  "enderman", "witch", "slime", "phantom", "pillager", "vindicator", "evoker", "ravager",
  "vex", "zombie_villager", "zombified_piglin", "piglin", "piglin_brute", "hoglin", "zoglin",
  "blaze", "ghast", "magma_cube", "wither_skeleton", "guardian", "elder_guardian", "shulker",
  "silverfish", "endermite", "warden",
]);

const history = new History();

let bot = null;
let reconnects = 0;
let shuttingDown = false;

let lookInterval = null;
let sessionTimeout = null;
let idleTimer = null;
let batchTimer = null;

let responding = false;
let eating = false;
let pending = [];
let lastActivity = Date.now();
let lowHealthAnnounced = false;
let lastDaySegment = null;
let lastRaining = false;
const cooldowns = {};

const log = {
  info:  msg => process.stdout.write(`[${botName}] ${msg}\n`),
  warn:  msg => process.stdout.write(`[${botName}] WARN ${msg}\n`),
  error: msg => process.stderr.write(`[${botName}] ERROR ${msg}\n`),
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function sessionRemainingMs() { return SESSION_DEADLINE - Date.now(); }

function onCooldown(key, ms) {
  const now = Date.now();
  if (cooldowns[key] && now - cooldowns[key] < ms) return true;
  cooldowns[key] = now;
  return false;
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: "POST", headers: { ...headers, "content-length": Buffer.byteLength(data) } },
      res => {
        let buf = "";
        res.on("data", c => buf += c);
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
          catch (e) { reject(new Error(`json parse failed: ${buf.slice(0,200)}`)); }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(60000, () => { req.destroy(new Error("request timeout")); });
    req.write(data);
    req.end();
  });
}

async function callAnthropic(msgs) {
  const res = await httpsPost("api.anthropic.com", "/v1/messages", {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  }, { model, max_tokens: 256, system: systemPrompt, messages: msgs });
  if (res.status !== 200) throw new Error(res.body?.error?.message || `anthropic ${res.status}`);
  const u = res.body.usage || {};
  return { text: res.body.content[0].text, usage: { input: u.input_tokens || 0, output: u.output_tokens || 0 } };
}

async function callOpenAI(msgs, host, path) {
  const messages = systemPrompt ? [{ role: "system", content: systemPrompt }, ...msgs] : msgs;
  const res = await httpsPost(host, path, {
    "Authorization": `Bearer ${apiKey}`,
    "content-type": "application/json",
  }, { model, max_tokens: 256, messages });
  if (res.status !== 200) throw new Error(res.body?.error?.message || `openai-compat ${res.status}`);
  const u = res.body.usage || {};
  return { text: res.body.choices[0].message.content, usage: { input: u.prompt_tokens || 0, output: u.completion_tokens || 0 } };
}

async function callGemini(msgs) {
  const contents = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: `[system]: ${systemPrompt}` }] });
    contents.push({ role: "model", parts: [{ text: "understood" }] });
  }
  for (const m of msgs) {
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] });
  }
  const res = await httpsPost("generativelanguage.googleapis.com",
    `/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { "content-type": "application/json" },
    { contents, generationConfig: { maxOutputTokens: 256 } }
  );
  if (res.status !== 200) throw new Error(res.body?.error?.message || `gemini ${res.status}`);
  const u = res.body.usageMetadata || {};
  return { text: res.body.candidates[0].content.parts[0].text, usage: { input: u.promptTokenCount || 0, output: u.candidatesTokenCount || 0 } };
}

async function callLLM(msgs) {
  let result;
  if (provider === "anthropic")       result = await callAnthropic(msgs);
  else if (provider === "gemini")     result = await callGemini(msgs);
  else if (provider === "openrouter") result = await callOpenAI(msgs, "openrouter.ai", "/api/v1/chat/completions");
  else                                result = await callOpenAI(msgs, "api.openai.com", "/v1/chat/completions");

  if (result.usage && (result.usage.input || result.usage.output)) {
    log.info(`usage input=${result.usage.input} output=${result.usage.output}`);
  }
  return result.text;
}

function splitLong(text, max = 100) {
  if (text.length <= max) return [text];
  const words = text.split(" ");
  const out = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) out.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

function fmtTimeOfDay(timeOfDay) {
  if (timeOfDay == null) return "unknown";
  if (timeOfDay < 1000) return "sunrise";
  if (timeOfDay < 6000) return "morning";
  if (timeOfDay < 9000) return "midday";
  if (timeOfDay < 12000) return "afternoon";
  if (timeOfDay < 13000) return "sunset";
  if (timeOfDay < 18000) return "night";
  if (timeOfDay < 22000) return "midnight";
  return "late night";
}

function isHostile(e) {
  if (e.kind && /hostile/i.test(e.kind)) return true;
  const n = (e.name || "").toLowerCase();
  return HOSTILE_MOBS.has(n);
}

function getWorldState(full) {
  if (!bot || !bot.entity) return null;
  const parts = [];

  const hp = bot.health != null ? Math.round(bot.health) : null;
  const food = bot.food != null ? Math.round(bot.food) : null;
  if (hp != null) parts.push(`health ${hp}/20`);
  if (food != null) parts.push(`hunger ${food}/20`);

  const tod = bot.time?.timeOfDay;
  if (tod != null) parts.push(`time ${fmtTimeOfDay(tod)}`);
  if (bot.isRaining) parts.push("raining");

  const held = bot.heldItem;
  parts.push(`holding ${held ? `${held.count}x ${held.name}` : "nothing"}`);

  const bp = bot.entity.position;
  const players = [];
  const threats = [];
  const allMobs = [];
  if (bot.entities) {
    for (const id in bot.entities) {
      const e = bot.entities[id];
      if (!e || e === bot.entity || !e.position) continue;
      const dist = Math.round(bp.distanceTo(e.position));
      if (dist > 24) continue;
      if (e.type === "player" && e.username && e.username !== botName) {
        players.push(`${e.username} (${dist}m)`);
      } else if (e.type === "mob" || e.type === "hostile" || e.type === "animal" || e.kind) {
        const name = e.name || e.displayName || "mob";
        allMobs.push(`${name} (${dist}m)`);
        if (isHostile(e) && dist <= 12) threats.push(`${name} (${dist}m)`);
      }
    }
  }

  if (full) {
    parts.push(`position x${Math.round(bp.x)} y${Math.round(bp.y)} z${Math.round(bp.z)}`);
    if (bot.game?.dimension) parts.push(`dimension ${bot.game.dimension.replace("minecraft:", "")}`);
    if (bot.inventory) {
      const items = bot.inventory.items();
      if (items.length) {
        const summary = {};
        for (const it of items) summary[it.name] = (summary[it.name] || 0) + it.count;
        const top = Object.entries(summary).sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([n, c]) => `${c}x ${n}`).join(", ");
        parts.push(`inventory ${top}`);
      } else {
        parts.push("inventory empty");
      }
    }
    parts.push(`nearby players: ${players.length ? players.slice(0, 5).join(", ") : "none"}`);
    parts.push(`nearby mobs: ${allMobs.length ? allMobs.slice(0, 5).join(", ") : "none"}`);
  } else {
    parts.push(`nearby players: ${players.length}`);
    if (threats.length) parts.push(`threats: ${threats.slice(0, 3).join(", ")}`);
  }

  return parts.join(" | ");
}

function buildContext(extra, full) {
  const msgs = [];
  const state = getWorldState(full);
  if (state) {
    msgs.push({ role: "user", content: `[current game state: ${state}]` });
    msgs.push({ role: "assistant", content: "ok" });
  }
  msgs.push(...history.getMessages());
  if (extra) msgs.push(extra);
  return msgs;
}

async function sendText(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await delay(600 + Math.random() * 500);
    for (const chunk of splitLong(lines[i])) {
      if (bot) bot.chat(chunk);
    }
  }
}

async function tryAutoEat() {
  if (eating || !bot || !bot.inventory) return;
  if (bot.food == null || bot.food > EAT_THRESHOLD) return;

  const foodItem = bot.inventory.items().find(it => FOOD_ITEMS.has(it.name));
  if (!foodItem) return;

  eating = true;
  const previousHeld = bot.heldItem;
  try {
    log.info(`auto-eat: hunger ${Math.round(bot.food)}/20, eating ${foodItem.name}`);
    await bot.equip(foodItem, "hand");
    await bot.consume();
    log.info(`auto-eat: ate ${foodItem.name}, hunger now ${Math.round(bot.food)}/20`);
    if (previousHeld && previousHeld.type !== foodItem.type) {
      try { await bot.equip(previousHeld, "hand"); } catch {}
    }
  } catch (e) {
    log.warn(`auto-eat failed: ${e.message}`);
  } finally {
    eating = false;
  }
}

async function processBatch() {
  if (responding || pending.length === 0 || !bot) return;
  responding = true;
  const batch = [...pending];
  pending = [];

  try {
    const userContent = batch.map(m => `${m.username}: ${m.message}`).join("\n");
    log.info(`prompt received - ${batch.length} message(s) from: ${batch.map(m=>m.username).join(", ")}`);

    const msgs = buildContext({ role: "user", content: userContent }, true);
    log.info(`calling ${provider}/${model} with ${msgs.length} messages in context`);

    const reply = await callLLM(msgs);
    const replyClean = reply?.trim() || "";

    if (replyClean) {
      history.add("user", userContent);
      history.add("assistant", replyClean);
      log.info(`reply: "${replyClean.slice(0,80)}${replyClean.length>80?"...":""}"`);
      await sendText(replyClean);
      lastActivity = Date.now();
      log.info("message sent to chat");
    } else {
      log.warn("llm returned empty reply, not sending");
    }
  } catch (e) {
    log.error(`llm call failed: ${e.message}`);
  } finally {
    responding = false;
    if (pending.length > 0) processBatch();
  }
}

async function proactiveSpeak(trigger, instruction, full) {
  if (responding || !bot) return;
  responding = true;
  try {
    log.info(`proactive trigger: ${trigger}`);
    const msgs = buildContext({ role: "user", content: `[${instruction}]` }, !!full);
    const reply = await callLLM(msgs);
    const replyClean = reply?.trim() || "";
    if (replyClean) {
      history.add("assistant", replyClean);
      log.info(`proactive reply: "${replyClean.slice(0,80)}"`);
      await sendText(replyClean);
      lastActivity = Date.now();
      log.info("proactive message sent");
    }
  } catch (e) {
    log.error(`proactive call failed: ${e.message}`);
  } finally {
    responding = false;
  }
}

function scheduleIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  const wait = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
  idleTimer = setTimeout(async () => {
    if (!bot) return;
    const sinceActivity = Date.now() - lastActivity;
    if (sinceActivity >= IDLE_MIN_MS && pending.length === 0 && !responding) {
      await proactiveSpeak("idle",
        "You've been standing around quietly for a while. Say something short and casual to break the silence, like a real player would. One sentence.", false);
    }
    if (bot) scheduleIdle();
  }, wait);
}

function findClosest() {
  if (!bot || !bot.entity) return null;
  const pos = bot.entity.position;
  let closest = null, minDist = Infinity;
  for (const name in bot.players) {
    const p = bot.players[name];
    if (name === bot.username || !p.entity) continue;
    const d = pos.distanceTo(p.entity.position);
    if (d < minDist) { minDist = d; closest = p; }
  }
  return closest;
}

function lookAtClosest() {
  const c = findClosest();
  if (c?.entity) bot.lookAt(c.entity.position.offset(0, c.entity.height, 0), true);
}

function checkTimeOfDay() {
  if (!bot || bot.time?.timeOfDay == null) return;
  const tod = bot.time.timeOfDay;
  const segment = (tod >= 13000 && tod < 23000) ? "night" : "day";
  if (lastDaySegment === null) { lastDaySegment = segment; return; }
  if (segment !== lastDaySegment) {
    lastDaySegment = segment;
    if (onCooldown("daynight", 60000)) return;
    if (segment === "night") {
      proactiveSpeak("nightfall", "Night just fell in the game. Comment on it briefly, maybe mention mobs coming, one short line.", false);
    } else {
      proactiveSpeak("daybreak", "The sun just came up. Comment briefly that it's morning, one short line.", false);
    }
  }
}

function clearTimers() {
  if (lookInterval) { clearInterval(lookInterval); lookInterval = null; }
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
}

function shutdown(reason) {
  shuttingDown = true;
  log.info(`shutdown: ${reason}`);
  clearTimers();
  if (sessionTimeout) { clearTimeout(sessionTimeout); sessionTimeout = null; }
  history.reset();
  log.info("memory cleared");
  try { if (bot) bot.quit(); } catch {}
  process.exit(0);
}

function attachHandlers() {
  bot.once("spawn", () => {
    reconnects = 0;
    lastActivity = Date.now();
    lowHealthAnnounced = false;
    lastDaySegment = null;
    lastRaining = !!bot.isRaining;
    log.info(`joined ${ip}:${port} as ${botName}`);
    log.info(`provider: ${provider} | model: ${model} | session: ${Math.round(SESSION_SECONDS/60)}min`);

    lookInterval = setInterval(() => { lookAtClosest(); checkTimeOfDay(); }, 1000);
    scheduleIdle();
  });

  bot.on("playerJoined", player => {
    if (!player || player.username === bot.username) return;
    if (Date.now() < lastActivity + 3000) return;
    proactiveSpeak("playerJoined", `A player named ${player.username} just joined the server. Greet them briefly and naturally, one short line.`, false);
  });

  bot.on("playerLeft", player => {
    if (!player || player.username === bot.username) return;
    if (onCooldown("playerLeft", 20000)) return;
    proactiveSpeak("playerLeft", `${player.username} just left the server. Briefly react, one short line.`, false);
  });

  bot.on("health", () => {
    if (!bot) return;
    if (bot.health > 0 && bot.health <= LOW_HEALTH_THRESHOLD) {
      if (!lowHealthAnnounced) {
        lowHealthAnnounced = true;
        proactiveSpeak("lowHealth", `Your health just dropped to ${Math.round(bot.health)} (out of 20). React like a panicked player, one short line.`, true);
      }
    } else if (bot.health > LOW_HEALTH_THRESHOLD) {
      lowHealthAnnounced = false;
    }
    tryAutoEat();
  });

  bot.on("entityHurt", entity => {
    if (!bot || entity !== bot.entity) return;
    if (lowHealthAnnounced) return;
    if (onCooldown("hurt", 25000)) return;
    proactiveSpeak("tookDamage", "You just took a hit from something. React briefly, one short line.", true);
  });

  bot.on("death", () => {
    if (onCooldown("death", 5000)) return;
    proactiveSpeak("death", "You just died in the game and respawned. React to dying, one short line.", false);
  });

  bot.on("rain", () => {
    if (!bot) return;
    const nowRaining = !!bot.isRaining;
    if (nowRaining === lastRaining) return;
    lastRaining = nowRaining;
    if (onCooldown("rain", 60000)) return;
    proactiveSpeak("weather",
      nowRaining ? "It just started raining. Comment briefly, one short line." : "The rain just stopped. Comment briefly, one short line.",
      false);
  });

  bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    log.info(`chat from ${username}: "${message}"`);
    lastActivity = Date.now();
    pending.push({ username, message });
    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = setTimeout(processBatch, 1200);
  });

  bot.on("error", err => { log.error(`mineflayer: ${err.message}`); handleDisconnect("error"); });
  bot.on("kicked", reason => { log.warn(`kicked: ${reason}`); handleDisconnect("kicked"); });
  bot.on("end", () => handleDisconnect("disconnected"));
}

function handleDisconnect(reason) {
  if (shuttingDown) return;
  clearTimers();

  if (sessionRemainingMs() <= 0) {
    shutdown(`session ended (${reason})`);
    return;
  }

  if (reconnects >= MAX_RECONNECTS) {
    shutdown(`max reconnects (${MAX_RECONNECTS}) reached after ${reason}`);
    return;
  }

  reconnects++;
  log.warn(`${reason} - reconnect attempt ${reconnects}/${MAX_RECONNECTS} in ${RECONNECT_DELAY_MS/1000}s`);
  try { if (bot) bot.removeAllListeners(); } catch {}
  bot = null;

  setTimeout(() => {
    if (shuttingDown || sessionRemainingMs() <= 0) return;
    connect();
  }, RECONNECT_DELAY_MS);
}

function connect() {
  log.info(`connecting to ${ip}:${port}...`);
  bot = mineflayer.createBot({ host: ip, port: parseInt(port), username: botName, version });
  attachHandlers();
}

function startSessionClock() {
  sessionTimeout = setTimeout(() => {
    log.info("session limit reached");
    if (bot) bot.chat("bye!");
    setTimeout(() => shutdown("session timeout"), 1000);
  }, sessionRemainingMs());
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startSessionClock();
connect();
