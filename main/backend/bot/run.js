import { connect, startSessionClock, shutdown } from "./session.js";
import { getBot } from "./ctx.js";
import { log } from "./log.js";

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

const RECOVERABLE = [
  /unknown chat format code/i,
  /Read error|Chunk size|PartialReadError|Deserialization/i,
  /Cannot read.{0,30}from network/i,
  /missing characters in string/i,
  /unexpected (?:buffer|end of)/i,
  /Invalid (?:value|tag|state)/i,
];

function isRecoverable(err) {
  const msg = err && err.message ? String(err.message) : String(err);
  return RECOVERABLE.some(re => re.test(msg));
}

process.on("uncaughtException", (err) => {
  if (isRecoverable(err)) {
    log.warn(`recovered from bad packet: ${(err && err.message ? err.message : err).toString().slice(0, 120)}`);
    return;
  }
  log.error(`uncaught exception: ${err && err.stack ? err.stack.split("\n")[0] : err}`);
});

process.on("unhandledRejection", (reason) => {
  if (isRecoverable(reason)) {
    log.warn(`recovered from rejected packet: ${(reason && reason.message ? reason.message : reason).toString().slice(0, 120)}`);
    return;
  }
  log.warn(`unhandled rejection: ${(reason && reason.message ? reason.message : reason).toString().slice(0, 120)}`);
});

const hb = setInterval(() => {
  try {
    const bot = getBot();
    if (bot && bot.entity) {
      const p = bot.entity.position;
      log.info(`hb ${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)} hp${Math.round(bot.health ?? 0)}`);
    } else {
      log.info("hb connecting");
    }
  } catch {
    log.info("hb");
  }
}, 10000);
hb.unref?.();

startSessionClock();
connect();
