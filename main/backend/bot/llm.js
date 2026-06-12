import https from "https";
import { args } from "./ctx.js";
import { log } from "./log.js";
import { MAX_TOKENS, REASONING_MAX_TOKENS, HTTP_TIMEOUT_MS } from "./config.js";

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: "POST", headers: { ...headers, "content-length": Buffer.byteLength(data) } },
      res => {
        let buf = "";
        res.on("data", c => buf += c);
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
          catch { reject(new Error(`json parse failed: ${buf.slice(0, 200)}`)); }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(HTTP_TIMEOUT_MS, () => { req.destroy(new Error("request timeout")); });
    req.write(data);
    req.end();
  });
}

function isReasoningModel(model) {
  const m = (model || "").toLowerCase();
  return /gpt-5|^o1|^o3|^o4|-o1|-o3|-o4|reasoning|thinking/.test(m);
}

function tokenBudget() {
  return isReasoningModel(args.model) ? REASONING_MAX_TOKENS : MAX_TOKENS;
}

let toolIdCounter = 0;
function nextToolId() {
  toolIdCounter += 1;
  return `call_${Date.now()}_${toolIdCounter}`;
}

function anthropicTools(tools) {
  return tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
}
function openaiTools(tools) {
  return tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
}
function geminiTools(tools) {
  return [{ function_declarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
}

function toAnthropicMessages(msgs) {
  const out = [];
  for (const m of msgs) {
    if (m.role === "user" || m.role === "assistant") {
      if (typeof m.content === "string") {
        out.push({ role: m.role, content: m.content });
      } else {
        out.push({ role: m.role, content: m.content });
      }
    } else if (m.role === "tool_calls") {
      const content = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const c of m.calls) content.push({ type: "tool_use", id: c.id, name: c.name, input: c.input || {} });
      out.push({ role: "assistant", content });
    } else if (m.role === "tool_results") {
      const content = m.results.map(r => ({ type: "tool_result", tool_use_id: r.id, content: r.output }));
      out.push({ role: "user", content });
    }
  }
  return out;
}

function toOpenAIMessages(msgs, systemPrompt) {
  const out = [];
  if (systemPrompt) out.push({ role: "system", content: systemPrompt });
  for (const m of msgs) {
    if (m.role === "user" || m.role === "assistant") {
      out.push({ role: m.role, content: m.content });
    } else if (m.role === "tool_calls") {
      out.push({
        role: "assistant",
        content: m.text || null,
        tool_calls: m.calls.map(c => ({
          id: c.id, type: "function",
          function: { name: c.name, arguments: JSON.stringify(c.input || {}) },
        })),
      });
    } else if (m.role === "tool_results") {
      for (const r of m.results) {
        out.push({ role: "tool", tool_call_id: r.id, content: r.output });
      }
    }
  }
  return out;
}

function toGeminiContents(msgs, systemPrompt) {
  const contents = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: `[system]: ${systemPrompt}` }] });
    contents.push({ role: "model", parts: [{ text: "understood" }] });
  }
  for (const m of msgs) {
    if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant") {
      contents.push({ role: "model", parts: [{ text: m.content }] });
    } else if (m.role === "tool_calls") {
      const parts = [];
      if (m.text) parts.push({ text: m.text });
      for (const c of m.calls) parts.push({ functionCall: { name: c.name, args: c.input || {} } });
      contents.push({ role: "model", parts });
    } else if (m.role === "tool_results") {
      const parts = m.results.map(r => ({
        functionResponse: { name: r.name, response: { result: r.output } },
      }));
      contents.push({ role: "user", parts });
    }
  }
  return contents;
}

async function callAnthropic(msgs, tools) {
  const { apiKey, model, systemPrompt } = args;
  const payload = {
    model, max_tokens: tokenBudget(), system: systemPrompt,
    messages: toAnthropicMessages(msgs),
  };
  if (tools && tools.length) payload.tools = anthropicTools(tools);

  const res = await httpsPost("api.anthropic.com", "/v1/messages", {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  }, payload);
  if (res.status !== 200) {
    const detail = res.body?.error?.message || `anthropic ${res.status}`;
    log.error(`anthropic ${res.status}: ${detail}`);
    throw new Error(detail);
  }

  const u = res.body.usage || {};
  const blocks = res.body.content || [];
  let text = "";
  const toolCalls = [];
  for (const b of blocks) {
    if (b.type === "text") text += b.text;
    else if (b.type === "tool_use") toolCalls.push({ id: b.id, name: b.name, input: b.input || {} });
  }
  return { text: text.trim(), toolCalls, usage: { input: u.input_tokens || 0, output: u.output_tokens || 0 } };
}

async function callOpenAI(msgs, tools, host, path) {
  const { apiKey, model, systemPrompt } = args;
  const payload = {
    model,
    messages: toOpenAIMessages(msgs, systemPrompt),
    max_completion_tokens: tokenBudget(),
  };
  if (tools && tools.length) {
    payload.tools = openaiTools(tools);
    payload.tool_choice = "auto";
  }

  const headers = { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" };
  let res = await httpsPost(host, path, headers, payload);

  if (res.status === 400) {
    const errMsg = (res.body?.error?.message || "").toLowerCase();
    if (errMsg.includes("max_completion_tokens") || errMsg.includes("unsupported parameter")) {
      delete payload.max_completion_tokens;
      payload.max_tokens = tokenBudget();
      res = await httpsPost(host, path, headers, payload);
    }
  }

  if (res.status !== 200) {
    const detail = res.body?.error?.message || JSON.stringify(res.body).slice(0, 200);
    log.error(`openai ${res.status}: ${detail}`);
    throw new Error(detail || `openai-compat ${res.status}`);
  }

  const u = res.body.usage || {};
  const choice = res.body.choices?.[0]?.message || {};
  const text = (choice.content || "").trim();
  const toolCalls = [];
  if (Array.isArray(choice.tool_calls)) {
    for (const tc of choice.tool_calls) {
      if (tc.function) {
        let inp = {};
        try { inp = JSON.parse(tc.function.arguments || "{}"); } catch {}
        toolCalls.push({ id: tc.id || nextToolId(), name: tc.function.name, input: inp });
      }
    }
  }
  return { text, toolCalls, usage: { input: u.prompt_tokens || 0, output: u.completion_tokens || 0 } };
}

async function callGemini(msgs, tools) {
  const { apiKey, model, systemPrompt } = args;
  const payload = {
    contents: toGeminiContents(msgs, systemPrompt),
    generationConfig: { maxOutputTokens: tokenBudget() },
  };
  if (tools && tools.length) payload.tools = geminiTools(tools);

  const res = await httpsPost("generativelanguage.googleapis.com",
    `/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { "content-type": "application/json" },
    payload
  );
  if (res.status !== 200) {
    const detail = res.body?.error?.message || `gemini ${res.status}`;
    log.error(`gemini ${res.status}: ${detail}`);
    throw new Error(detail);
  }

  const u = res.body.usageMetadata || {};
  const parts = res.body.candidates?.[0]?.content?.parts || [];
  let text = "";
  const toolCalls = [];
  for (const p of parts) {
    if (p.text) text += p.text;
    else if (p.functionCall) toolCalls.push({ id: nextToolId(), name: p.functionCall.name, input: p.functionCall.args || {} });
  }
  return { text: text.trim(), toolCalls, usage: { input: u.promptTokenCount || 0, output: u.candidatesTokenCount || 0 } };
}

function isRetryable(err) {
  const msg = (err?.message || "").toLowerCase();
  return /timeout|overloaded|529|503|502|504|empty response|rate.?limit|429/.test(msg);
}
function jitter(ms) { return ms + Math.floor(Math.random() * 250); }

async function callOnce(msgs, tools) {
  const { provider } = args;
  if (provider === "anthropic")   return callAnthropic(msgs, tools);
  if (provider === "gemini")      return callGemini(msgs, tools);
  if (provider === "openrouter")  return callOpenAI(msgs, tools, "openrouter.ai", "/api/v1/chat/completions");
  return callOpenAI(msgs, tools, "api.openai.com", "/v1/chat/completions");
}

export async function callLLMRaw(msgs, tools = null) {
  let result;
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      result = await callOnce(msgs, tools);
      const hasText = result?.text && result.text.trim();
      const hasTools = result?.toolCalls && result.toolCalls.length;
      if (!hasText && !hasTools) throw new Error("empty response");
      break;
    } catch (e) {
      lastErr = e;
      if (attempt === 0 && isRetryable(e)) {
        const backoff = jitter(1200);
        log.warn(`llm transient error (${e.message.slice(0, 80)}), retrying in ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw e;
    }
  }
  if (!result) throw lastErr || new Error("llm failed");

  if (result.usage && (result.usage.input || result.usage.output)) {
    log.info(`usage input=${result.usage.input} output=${result.usage.output}`);
  }
  return result;
}

export async function callLLM(msgs) {
  const r = await callLLMRaw(msgs, null);
  return r.text;
}

export async function callLLMWithTools(msgs, tools) {
  return callLLMRaw(msgs, tools);
}
