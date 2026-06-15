import { args } from "../ctx.js";

let cached = null;

function parseVersion(v) {
  const s = String(v || "").trim();
  const m = s.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return { major: 1, minor: 8, patch: 0 };
  return { major: parseInt(m[1]) || 1, minor: parseInt(m[2]) || 0, patch: parseInt(m[3]) || 0 };
}

export function versionInfo() {
  if (cached) return cached;
  const parsed = parseVersion(args.version);
  const isPre19 = parsed.major === 1 && parsed.minor < 9;
  cached = {
    ...parsed,
    isPre19,
    style: isPre19 ? "spam" : "cooldown",
    supportsOffhand: !isPre19,
    supportsShieldBlock: !isPre19,
    supportsCrit: true,
  };
  return cached;
}

export function isSpamStyle() {
  return versionInfo().style === "spam";
}

export function attackIntervalMs(baseSpam, baseCooldown) {
  return isSpamStyle() ? baseSpam : baseCooldown;
}
