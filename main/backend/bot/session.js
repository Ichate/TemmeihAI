import mineflayer from "mineflayer";
import { args, state, sessionRemainingMs, setBot } from "./ctx.js";
import { MAX_RECONNECTS, RECONNECT_DELAY_MS } from "./config.js";
import { log } from "./log.js";
import { history } from "./history-instance.js";
import { attachHandlers } from "./handlers.js";

function clearTimers() {
  if (state.lookInterval) { clearInterval(state.lookInterval); state.lookInterval = null; }
  if (state.idleTimer) { clearTimeout(state.idleTimer); state.idleTimer = null; }
  if (state.batchTimer) { clearTimeout(state.batchTimer); state.batchTimer = null; }
}

export function shutdown(reason) {
  state.shuttingDown = true;
  log.info(`shutdown: ${reason}`);
  clearTimers();
  if (state.sessionTimeout) { clearTimeout(state.sessionTimeout); state.sessionTimeout = null; }
  history.reset();
  log.info("memory cleared");
  try { if (state.bot) state.bot.quit(); } catch {}
  process.exit(0);
}

const FATAL_KICK_PATTERNS = [
  /you are already connected/i,
  /already connected/i,
  /already logged in/i,
  /duplicate.{0,10}login/i,
  /logged in from another/i,
  /banned/i,
  /whitelist/i,
  /not whitelisted/i,
  /outdated (?:client|server)/i,
  /incompatible/i,
  /server is full/i,
  /no permission/i,
];

function isFatalKick(reason) {
  if (!reason) return false;
  const text = typeof reason === "string" ? reason : JSON.stringify(reason);
  return FATAL_KICK_PATTERNS.some(re => re.test(text));
}

export function handleDisconnect(reason) {
  if (state.shuttingDown) return;
  clearTimers();

  if (sessionRemainingMs() <= 0) {
    shutdown(`session ended (${reason})`);
    return;
  }

  if (isFatalKick(reason)) {
    shutdown(`fatal kick (will not retry): ${typeof reason === "string" ? reason : "non-recoverable"}`);
    return;
  }

  if (state.reconnects >= MAX_RECONNECTS) {
    shutdown(`max reconnects (${MAX_RECONNECTS}) reached after ${reason}`);
    return;
  }

  state.reconnects++;
  log.warn(`${reason} - reconnect attempt ${state.reconnects}/${MAX_RECONNECTS} in ${RECONNECT_DELAY_MS/1000}s`);
  try { if (state.bot) state.bot.removeAllListeners(); } catch {}
  setBot(null);

  setTimeout(() => {
    if (state.shuttingDown || sessionRemainingMs() <= 0) return;
    connect();
  }, RECONNECT_DELAY_MS);
}

export function connect() {
  log.info(`connecting to ${args.ip}:${args.port}...`);
  const bot = mineflayer.createBot({
    host: args.ip,
    port: args.port,
    username: args.botName,
    version: args.version,
  });
  setBot(bot);
  attachHandlers(bot);
}

export function startSessionClock() {
  state.sessionTimeout = setTimeout(() => {
    log.info("session limit reached");
    if (state.bot) state.bot.chat("bye!");
    setTimeout(() => shutdown("session timeout"), 1000);
  }, sessionRemainingMs());
}
