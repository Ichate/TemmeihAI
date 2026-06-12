import { args, state, getBot } from "./ctx.js";
import { log } from "./log.js";
import { callLLM, callLLMWithTools } from "./llm.js";
import { getWorldState } from "./state.js";
import { delay } from "./cooldowns.js";
import { history } from "./history-instance.js";
import { TOOL_DEFS, executeTool } from "./tools.js";
import { MAX_TOOL_ROUNDS } from "./config.js";

export function splitLong(text, max = 100) {
  if (text.length <= max) return [text];
  const words = text.split(" ");
  const out = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) out.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

export async function sendText(text) {
  const bot = getBot();
  if (!bot || !text) return;
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await delay(600 + Math.random() * 500);
    for (const chunk of splitLong(lines[i])) {
      if (getBot()) {
        try { getBot().chat(chunk); } catch (e) { log.warn(`chat send failed: ${e.message}`); }
      }
    }
  }
}

export function buildContext(extra, full) {
  const msgs = [];
  const ws = getWorldState(full);
  if (ws) {
    msgs.push({ role: "user", content: `[current game state: ${ws}]` });
    msgs.push({ role: "assistant", content: "ok" });
  }
  msgs.push(...history.getMessages());
  if (extra) msgs.push(extra);
  return msgs;
}

const MOVING_TOOLS = new Set([
  "come_here", "follow_player", "goto_coords", "goto_player",
  "lead_player", "tail_player", "gather", "wander", "flee", "react_to_danger",
]);

const CONTINUOUS_TOOLS = new Set(["follow_player", "tail_player", "lead_player", "stay_here", "mirror_player"]);

function describeToolForReply(name, reason) {
  if (CONTINUOUS_TOOLS.has(name)) return reason || "on it";
  if (MOVING_TOOLS.has(name)) return reason || "on my way";
  return reason || "done";
}

async function executeCalls(toolCalls) {
  const results = [];
  for (const call of toolCalls) {
    let r;
    try {
      r = await executeTool(call.name, call.input);
    } catch (e) {
      log.error(`tool ${call.name} threw: ${e.message}`);
      r = { ok: false, reason: e.message };
    }
    let outcome;
    if (!r || !r.ok) {
      outcome = `failed: ${(r && r.reason) || "could not do it"}`;
    } else if (MOVING_TOOLS.has(call.name) && !CONTINUOUS_TOOLS.has(call.name)) {
      outcome = `ok, ${r.reason || "on my way"}. you are now walking there - you have NOT arrived. say something brief like 'on my way'. do NOT say you reached or made it; you will announce arrival yourself later when you actually get there.`;
    } else {
      outcome = `done: ${r.reason || "ok"}`;
    }
    log.info(`tool ${call.name}: ${r && r.ok ? "ok" : "FAIL"} - ${r && r.reason}`);
    results.push({ id: call.id, name: call.name, output: outcome, ok: !!(r && r.ok) });
  }
  return results;
}

export async function processBatch() {
  if (state.responding || state.pending.length === 0 || !getBot()) return;
  state.responding = true;
  const batch = [...state.pending];
  state.pending = [];

  try {
    const userContent = batch.map(m => `${m.username}: ${m.message}`).join("\n");
    log.info(`prompt received - ${batch.length} message(s) from: ${batch.map(m => m.username).join(", ")}`);

    history.add("user", userContent);

    const convo = buildContext({ role: "user", content: userContent }, true);
    let finalText = "";
    let lastResults = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      log.info(`calling ${args.provider}/${args.model} (round ${round + 1})`);
      const res = await callLLMWithTools(convo, TOOL_DEFS);
      const text = res.text?.trim() || "";
      const toolCalls = res.toolCalls || [];

      if (!toolCalls.length) {
        finalText = text;
        break;
      }

      const names = toolCalls.map(t => t.name).join(", ");
      log.info(`llm requested ${toolCalls.length} action(s): ${names}`);
      state.lastActivity = Date.now();

      convo.push({ role: "tool_calls", text, calls: toolCalls });
      lastResults = await executeCalls(toolCalls);
      convo.push({ role: "tool_results", results: lastResults.map(r => ({ id: r.id, name: r.name, output: r.output })) });

      if (text) { finalText = text; break; }

      const anyFailed = lastResults.some(r => !r.ok);
      if (!anyFailed) { finalText = ""; break; }
      if (round === MAX_TOOL_ROUNDS - 1) finalText = text;
    }

    if (!finalText && lastResults && lastResults.length) {
      const parts = lastResults.map(r => describeToolForReply(r.name, r.ok ? null : "couldn't do that"));
      finalText = parts.filter(Boolean).join(", ");
    }

    if (finalText) {
      history.add("assistant", finalText);
      log.info(`reply: "${finalText.slice(0, 80)}${finalText.length > 80 ? "..." : ""}"`);
      await sendText(finalText);
      log.info("message sent to chat");
    } else {
      log.warn("no text reply produced");
    }
    state.lastActivity = Date.now();
  } catch (e) {
    log.error(`llm call failed: ${e.message}`);
  } finally {
    state.responding = false;
    if (state.pending.length > 0) processBatch();
  }
}

export async function proactiveSpeak(trigger, instruction, full = false) {
  if (state.responding || !getBot()) return;
  state.responding = true;
  try {
    log.info(`proactive trigger: ${trigger}`);
    const msgs = buildContext({ role: "user", content: `[${instruction}]` }, !!full);
    const reply = await callLLM(msgs);
    const clean = reply?.trim() || "";
    if (clean) {
      history.add("assistant", clean);
      log.info(`proactive reply: "${clean.slice(0, 80)}"`);
      await sendText(clean);
      state.lastActivity = Date.now();
      log.info("proactive message sent");
    }
  } catch (e) {
    log.error(`proactive call failed: ${e.message}`);
  } finally {
    state.responding = false;
  }
}
