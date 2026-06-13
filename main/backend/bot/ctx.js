const [ip, port, version, botName, apiKey, provider, model, systemPrompt, sessionSecondsArg] = process.argv.slice(2);

export const args = {
  ip,
  port: parseInt(port),
  version,
  botName,
  apiKey,
  provider,
  model,
  systemPrompt,
  sessionSeconds: parseInt(sessionSecondsArg) || 300,
};

export const SESSION_DEADLINE = Date.now() + args.sessionSeconds * 1000;
export function sessionRemainingMs() { return SESSION_DEADLINE - Date.now(); }

export const state = {
  bot: null,
  reconnects: 0,
  shuttingDown: false,

  lookInterval: null,
  sessionTimeout: null,
  idleTimer: null,
  batchTimer: null,

  responding: false,
  eating: false,
  pending: [],
  lastActivity: Date.now(),

  lowHealthAnnounced: false,
  lastDaySegment: null,
  lastRaining: false,
  lastThundering: false,
  lastBiome: null,
  lastXpLevel: null,
  lastDamageSource: null,
  lastY: null,
  fallStartY: null,
  knownEntities: new Set(),

  movementMode: "idle",
  movementTarget: null,
  swimming: false,
};

export function setBot(b) { state.bot = b; }
export function getBot() { return state.bot; }
