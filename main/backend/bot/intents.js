import { getBot, args } from "./ctx.js";
import { fmtTimeOfDay } from "./state.js";

function refersToBot(text) {
  const lower = text.toLowerCase();
  const name = args.botName.toLowerCase();
  if (lower.includes(name)) return true;
  if (/\b(you|u|yo|hey|bot)\b/.test(lower)) return true;
  return false;
}

function answerCoords() {
  const bot = getBot();
  if (!bot?.entity) return null;
  const p = bot.entity.position;
  return `im at x ${Math.round(p.x)}, y ${Math.round(p.y)}, z ${Math.round(p.z)}`;
}

function answerTime() {
  const bot = getBot();
  if (!bot?.time) return null;
  const tod = bot.time.timeOfDay;
  const day = bot.time.day != null ? `day ${bot.time.day}` : null;
  const phase = fmtTimeOfDay(tod);
  return day ? `${phase}, ${day}` : phase;
}

function answerInventory() {
  const bot = getBot();
  if (!bot?.inventory) return null;
  const items = bot.inventory.items();
  if (!items.length) return "nothing, im broke";
  const summary = {};
  for (const it of items) summary[it.name] = (summary[it.name] || 0) + it.count;
  const top = Object.entries(summary).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([n, c]) => `${c}x ${n}`).join(", ");
  return top;
}

function answerStatus() {
  const bot = getBot();
  if (!bot) return null;
  const hp = bot.health != null ? Math.round(bot.health) : "?";
  const food = bot.food != null ? Math.round(bot.food) : "?";
  return `${hp}/20 hp, ${food}/20 hunger`;
}

export function detectIntent(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  if (!refersToBot(t)) return null;

  if (/(where|wheres).*(you|u|at|are you)|coords?\??$|location\??$|loc\??$/.test(t)) {
    const a = answerCoords();
    if (a) return { kind: "coords", answer: a };
  }
  if (/(what|whats).{0,8}(time|hour)|time(\sof)?( day)?\??$|day\??$/.test(t)) {
    const a = answerTime();
    if (a) return { kind: "time", answer: a };
  }
  if (/(what|whats).{0,8}(you got|inventory|inv|in your inv|on you|holding|carrying)|show.{0,8}(inv|inventory)/.test(t)) {
    const a = answerInventory();
    if (a) return { kind: "inventory", answer: a };
  }
  if (/(you good|you ok|you alright|hp\??$|health\??$|status\??$)/.test(t)) {
    const a = answerStatus();
    if (a) return { kind: "status", answer: a };
  }
  return null;
}
