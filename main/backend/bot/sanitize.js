const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?)/i,
  /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?)/i,
  /forget\s+(everything|all|your\s+(prompt|instructions?|rules?|persona))/i,
  /you\s+are\s+(now|actually)\s+(?!a minecraft)/i,
  /from\s+now\s+on\s+you('?re|\s+are)?\s+/i,
  /new\s+(instructions?|rules?|persona|prompt|system)\s*[:.]/i,
  /system\s*[:.]?\s*(prompt|instructions?|rules?|override)/i,
  /(act|behave|pretend|roleplay)\s+as\s+if/i,
  /jailbreak/i,
  /\[system\]/i,
  /\[\/?(inst|instructions?|system|user|assistant)\]/i,
  /<\s*\/?\s*(system|user|assistant|inst|instructions?)\s*>/i,
];

export function sanitizeChat(text) {
  if (typeof text !== "string") return { text: "", changed: false, suspicious: false };
  let cleaned = text;
  let changed = false;
  let suspicious = false;

  const trimmed = cleaned.trim();
  if (trimmed.startsWith("/")) {
    cleaned = trimmed.slice(1);
    changed = true;
  }

  for (const re of INJECTION_PATTERNS) {
    if (re.test(cleaned)) {
      suspicious = true;
      break;
    }
  }

  cleaned = cleaned.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (cleaned.length > 500) {
    cleaned = cleaned.slice(0, 500);
    changed = true;
  }

  if (cleaned !== text) changed = true;
  return { text: cleaned, changed, suspicious };
}
