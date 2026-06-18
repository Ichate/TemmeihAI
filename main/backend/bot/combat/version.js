import { args, getBot } from "../ctx.js";

let cached = null;

function parseVersion(v) {
  const s = String(v || "").trim();
  const m = s.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return { major: parseInt(m[1]) || 1, minor: parseInt(m[2]) || 0, patch: parseInt(m[3]) || 0 };
}

function resolveVersionString() {
  const fromArg = parseVersion(args.version);
  if (fromArg) return fromArg;
  try {
    const bot = getBot();
    const v = bot && (bot.version || (bot.game && bot.game.version));
    const fromBot = parseVersion(v);
    if (fromBot) return fromBot;
  } catch {}
  return null;
}

export function versionInfo() {
  if (cached) return cached;
  const resolved = resolveVersionString();
  const parsed = resolved || { major: 1, minor: 20, patch: 0 };
  const isPre19 = parsed.major === 1 && parsed.minor < 9;
  const info = {
    ...parsed,
    isPre19,
    style: isPre19 ? "spam" : "cooldown",
    supportsOffhand: !isPre19,
    supportsShieldBlock: !isPre19,
    supportsCrit: true,
  };
  if (resolved) cached = info;
  return info;
}

export function isSpamStyle() {
  return versionInfo().style === "spam";
}

export function attackIntervalMs(baseSpam, baseCooldown) {
  return isSpamStyle() ? baseSpam : baseCooldown;
}
