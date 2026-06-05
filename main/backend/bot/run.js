import mineflayer from "mineflayer";
import http from "http";
import { History } from "./history.js";

const [ip, port, version, botName, apiKey, provider, model, systemPrompt] = process.argv.slice(2);

const bot = mineflayer.createBot({ host: ip, port: parseInt(port), username: botName, version });
const history = new History(botName, apiKey, provider, model, systemPrompt);

let lookInterval = null;
let leaveTimeout = null;
let responding = false;
let pendingMessages = [];
let batchTimer = null;

function callChat(messages) {
  const body = JSON.stringify({ apiKey, provider, model, messages, systemPrompt });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/api/chat",
      method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) }
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data).text || ""); } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function parseResponse(raw) {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.respond !== "boolean") return null;
    if (!Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function sendParts(parts) {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    if (i > 0) await new Promise(r => setTimeout(r, 700 + Math.random() * 800));
    const chunks = splitLong(part);
    for (const chunk of chunks) {
      bot.chat(chunk);
      if (chunks.length > 1) await new Promise(r => setTimeout(r, 400));
    }
  }
}

function splitLong(text) {
  const max = 100;
  if (text.length <= max) return [text];
  const words = text.split(" ");
  const result = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > max) {
      if (current) result.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) result.push(current);
  return result;
}

async function processBatch() {
  if (responding || pendingMessages.length === 0) return;
  responding = true;

  const batch = [...pendingMessages];
  pendingMessages = [];

  try {
    const combinedContent = batch.map(m => `${m.username}: ${m.message}`).join("\n");

    const msgs = [];
    const summary = history.getSummary();
    if (summary) {
      msgs.push({ role: "user", content: `[conversation summary: ${summary}]` });
      msgs.push({ role: "assistant", content: `{"respond":true,"messages":["got it"]}` });
    }
    const ctx = history.getContext();
    if (ctx) msgs.push(...ctx);
    msgs.push({ role: "user", content: combinedContent });

    const raw = await callChat(msgs);
    const result = parseResponse(raw);

    if (!result) {
      console.log("invalid json response, skipping");
      responding = false;
      return;
    }

    if (!result.respond) {
      console.log("bot chose not to respond");
      responding = false;
      return;
    }

    const validParts = result.messages.filter(m => typeof m === "string" && m.trim());
    if (validParts.length > 0) {
      await history.add("user", combinedContent);
      await sendParts(validParts);
      await history.add("assistant", JSON.stringify(result));
    }
  } catch (e) {
    console.error("llm error:", e.message);
  } finally {
    responding = false;
    if (pendingMessages.length > 0) processBatch();
  }
}

function findClosest() {
  if (!bot.entity) return null;
  const pos = bot.entity.position;
  let closest = null, minDist = Infinity;
  for (const name in bot.players) {
    const player = bot.players[name];
    if (name === bot.username || !player.entity) continue;
    const dist = pos.distanceTo(player.entity.position);
    if (dist < minDist) { minDist = dist; closest = player; }
  }
  return closest;
}

function lookAtClosest() {
  const closest = findClosest();
  if (!closest?.entity) return;
  bot.lookAt(closest.entity.position.offset(0, closest.entity.height, 0), true);
}

function cleanup() {
  if (lookInterval) clearInterval(lookInterval);
  if (leaveTimeout) clearTimeout(leaveTimeout);
  if (batchTimer) clearTimeout(batchTimer);
  history.cleanup();
  try { bot.quit(); } catch {}
  process.exit(0);
}

bot.once("spawn", () => {
  console.log(`joined ${ip}:${port}`);
  lookInterval = setInterval(lookAtClosest, 50);
  leaveTimeout = setTimeout(() => {
    console.log("5 minutes up, leaving");
    bot.chat("bye!");
    setTimeout(cleanup, 1000);
  }, 5 * 60 * 1000);
});

bot.on("chat", (username, message) => {
  if (username === bot.username) return;
  pendingMessages.push({ username, message });
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(processBatch, 1200);
});

bot.on("error", (err) => { console.error("error:", err.message); cleanup(); });
bot.on("kicked", (reason) => { console.log("kicked:", reason); cleanup(); });
bot.on("end", cleanup);
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
