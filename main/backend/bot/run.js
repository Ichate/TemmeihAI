import { connect, startSessionClock, shutdown } from "./session.js";
import { getBot } from "./ctx.js";
import { log } from "./log.js";

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

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
