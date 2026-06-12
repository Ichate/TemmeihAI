const cooldowns = {};

export function onCooldown(key, ms) {
  const now = Date.now();
  if (cooldowns[key] && now - cooldowns[key] < ms) return true;
  cooldowns[key] = now;
  return false;
}

export function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
