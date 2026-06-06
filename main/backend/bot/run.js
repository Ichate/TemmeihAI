import mineflayer from "mineflayer";
import https from "https";
import { History } from "./history.js";

const [ip, port, version, botName, apiKey, provider, model, systemPrompt] = process.argv.slice(2);

const bot = mineflayer.createBot({ host: ip, port: parseInt(port), username: botName, version });
const history = new History();

let lookInterval = null;
let leaveTimeout = null;
let responding = false;
let pending = [];
let batchTimer = null;

const log = {
  info:  msg => process.stdout.write(`[${botName}] ${msg}\n`),
  warn:  msg => process.stdout.write(`[${botName}] WARN ${msg}\n`),
  error: msg => process.stderr.write(`[${botName}] ERROR ${msg}\n`),
};

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
  return res.body.content[0].text;
}

async function callOpenAI(msgs, host, path) {
  const messages = systemPrompt ? [{ role: "system", content: systemPrompt }, ...msgs] : msgs;
  const res = await httpsPost(host, path, {
    "Authorization": `Bearer ${apiKey}`,
    "content-type": "application/json",
  }, { model, max_tokens: 256, messages });
  if (res.status !== 200) throw new Error(res.body?.error?.message || `openai-compat ${res.status}`);
  return res.body.choices[0].message.content;
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
  return res.body.candidates[0].content.parts[0].text;
}

async function callLLM(msgs) {
  if (provider === "anthropic")   return callAnthropic(msgs);
  if (provider === "gemini")      return callGemini(msgs);
  if (provider === "openrouter")  return callOpenAI(msgs, "openrouter.ai", "/api/v1/chat/completions");
  return callOpenAI(msgs, "api.openai.com", "/v1/chat/completions");
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

async function sendText(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await delay(600 + Math.random() * 500);
    for (const chunk of splitLong(lines[i])) bot.chat(chunk);
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processBatch() {
  if (responding || pending.length === 0) return;
  responding = true;
  const batch = [...pending];
  pending = [];

  try {
    const userContent = batch.map(m => `${m.username}: ${m.message}`).join("\n");
    log.info(`prompt received — ${batch.length} message(s) from: ${batch.map(m=>m.username).join(", ")}`);

    const msgs = [...history.getMessages(), { role: "user", content: userContent }];
    log.info(`calling ${provider}/${model} with ${msgs.length} messages in context`);

    const reply = await callLLM(msgs);
    const replyClean = reply?.trim() || "";

    if (replyClean) {
      history.add("user", userContent);
      history.add("assistant", replyClean);
      log.info(`reply: "${replyClean.slice(0,80)}${replyClean.length>80?"...":""}"`);
      await sendText(replyClean);
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

function findClosest() {
  if (!bot.entity) return null;
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

function cleanup(reason) {
  log.info(`cleanup: ${reason}`);
  if (lookInterval) clearInterval(lookInterval);
  if (leaveTimeout) clearTimeout(leaveTimeout);
  if (batchTimer) clearTimeout(batchTimer);
  history.reset();
  log.info("memory cleared");
  try { bot.quit(); } catch {}
  process.exit(0);
}

bot.once("spawn", () => {
  log.info(`joined ${ip}:${port} as ${botName}`);
  log.info(`provider: ${provider} | model: ${model}`);
  lookInterval = setInterval(lookAtClosest, 50);
  leaveTimeout = setTimeout(() => {
    log.info("5 minute session limit reached");
    bot.chat("bye!");
    setTimeout(() => cleanup("session timeout"), 1000);
  }, 5 * 60 * 1000);
});

bot.on("chat", (username, message) => {
  if (username === bot.username) return;
  log.info(`chat from ${username}: "${message}"`);
  pending.push({ username, message });
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(processBatch, 1200);
});

bot.on("error", err => { log.error(`mineflayer: ${err.message}`); cleanup("error"); });
bot.on("kicked", reason => { log.warn(`kicked: ${reason}`); cleanup("kicked"); });
bot.on("end", () => cleanup("disconnected"));
process.on("SIGTERM", () => cleanup("SIGTERM"));
process.on("SIGINT", () => cleanup("SIGINT"));
