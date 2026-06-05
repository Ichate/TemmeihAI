const PROVIDERS = ["anthropic", "openai", "openrouter", "gemini"];

const STATIC_STEPS = [
  { id: "ip", title: "server address", desc: "where should the bot connect?", placeholder: "localhost", default: "" },
  { id: "port", title: "port", desc: "usually 25565 for minecraft", placeholder: "25565", default: "25565" },
  { id: "version", title: "minecraft version", desc: "match your server version", placeholder: "1.20.4", default: "1.20.4" },
  { id: "botName", title: "bot name", desc: "what should we call it?", placeholder: "temmeihBot", default: "temmeihBot" },
];

let current = 0;
let phase = "static";
let selectedProvider = null;
let fetchedModels = [];
let values = { ip: "", port: "25565", version: "1.20.4", botName: "temmeihBot", apiKey: "", provider: "", model: "", systemPrompt: "" };
let statusInterval = null;

const dashboard = document.getElementById("dashboard");
const onboarding = document.getElementById("onboarding");
const botStatus = document.getElementById("bot-status");
const actions = document.getElementById("actions");
const history = document.getElementById("history");
const progress = document.getElementById("progress");
const stepContent = document.getElementById("step-content");

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

async function checkStatus() {
  try { return await (await fetch("/api/status")).json(); } catch { return { active: false }; }
}

async function loadHistory() {
  try { return (await (await fetch("/api/history")).json()).bots || []; } catch { return []; }
}

function renderDashboard(status, historyData) {
  if (status.active) {
    botStatus.className = "bot-status active";
    botStatus.innerHTML = `
      <div class="status-header">bot running</div>
      <div class="status-info"><span class="status-label">name:</span> ${status.name}</div>
      <div class="status-info"><span class="status-label">server:</span> ${status.target}</div>
      <div class="timer ${status.remaining < 60 ? "warning" : ""}" id="timer">${formatTime(status.remaining)}</div>
    `;
    actions.innerHTML = `<button class="pixel btn" id="stop-btn">stop bot</button>`;
    document.getElementById("stop-btn").onclick = stopBot;
  } else {
    botStatus.className = "bot-status";
    botStatus.innerHTML = `<div class="status-header">no bot running</div><div class="status-info">create a new bot to get started</div>`;
    actions.innerHTML = `<button class="pixel btn primary" id="create-btn">create bot</button>`;
    document.getElementById("create-btn").onclick = showOnboarding;
  }

  history.innerHTML = historyData.length > 0 ? `
    <div class="history-title">recent bots</div>
    <div class="history-list">
      ${historyData.slice().reverse().map(b => `
        <div class="history-item">
          <span class="history-name">${b.name}</span>
          <span class="history-target">${b.target}</span>
        </div>
      `).join("")}
    </div>
  ` : `<div class="history-title">recent bots</div><div class="history-empty">no bots created yet</div>`;
}

async function stopBot() {
  await fetch("/api/stop", { method: "POST" });
  init();
}

function showOnboarding() {
  dashboard.style.display = "none";
  onboarding.style.display = "block";
  current = 0;
  phase = "static";
  renderStep();
}

function showDashboard() {
  dashboard.style.display = "flex";
  onboarding.style.display = "none";
}

function totalSteps() {
  return STATIC_STEPS.length + 4;
}

function currentStepIndex() {
  if (phase === "static") return current;
  if (phase === "provider") return STATIC_STEPS.length;
  if (phase === "apikey") return STATIC_STEPS.length + 1;
  if (phase === "model") return STATIC_STEPS.length + 2;
  if (phase === "systemprompt") return STATIC_STEPS.length + 3;
  return 0;
}

function renderProgress() {
  const total = totalSteps();
  const idx = currentStepIndex();
  progress.innerHTML = Array.from({ length: total }, (_, i) => {
    let cls = "progress-dot";
    if (i < idx) cls += " done";
    if (i === idx) cls += " active";
    return `<div class="${cls}"></div>`;
  }).join("");
}

function canGoBack() {
  if (phase === "static") return current > 0;
  return true;
}

function goBack() {
  if (phase === "systemprompt") { phase = "model"; renderStep(); return; }
  if (phase === "model") { phase = "apikey"; renderStep(); return; }
  if (phase === "apikey") { phase = "provider"; renderStep(); return; }
  if (phase === "provider") { phase = "static"; current = STATIC_STEPS.length - 1; renderStep(); return; }
  if (phase === "static" && current > 0) { current--; renderStep(); }
}

function renderStep() {
  renderProgress();
  if (phase === "static") renderStaticStep();
  else if (phase === "provider") renderProviderStep();
  else if (phase === "apikey") renderApiKeyStep();
  else if (phase === "model") renderModelStep();
  else if (phase === "systemprompt") renderSystemPromptStep();
}

function makeButtons(isLast = false, nextLabel = "next") {
  return `
    <div class="buttons">
      ${canGoBack() ? '<button class="pixel btn" id="back-btn">back</button>' : '<button class="pixel btn" id="cancel-btn">cancel</button>'}
      <button class="pixel btn primary" id="next-btn">${isLast ? "create" : nextLabel}</button>
    </div>
  `;
}

function bindBack() {
  document.getElementById("back-btn")?.addEventListener("click", goBack);
  document.getElementById("cancel-btn")?.addEventListener("click", () => { showDashboard(); init(); });
}

function renderStaticStep() {
  const step = STATIC_STEPS[current];
  const isLast = current === STATIC_STEPS.length - 1;
  stepContent.innerHTML = `
    <div class="step-icon pixel">${current + 1}</div>
    <div class="step-title">${step.title}</div>
    <div class="step-desc">${step.desc}</div>
    <div class="input-group">
      <input class="input" type="text" id="input" value="${values[step.id]}" placeholder="${step.placeholder}" autocomplete="off">
    </div>
    ${makeButtons(false, isLast ? "next" : "next")}
  `;
  const input = document.getElementById("input");
  input.focus(); input.select();
  input.onkeydown = e => { if (e.key === "Enter") document.getElementById("next-btn").click(); };
  document.getElementById("next-btn").onclick = () => {
    values[step.id] = input.value.trim() || step.default;
    if (current < STATIC_STEPS.length - 1) { current++; renderStep(); }
    else { phase = "provider"; renderStep(); }
  };
  bindBack();
}

function renderProviderStep() {
  stepContent.innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length + 1}</div>
    <div class="step-title">ai provider</div>
    <div class="step-desc">which llm provider should power the bot?</div>
    <div class="provider-list">
      ${PROVIDERS.map(p => `<button class="pixel btn provider-btn ${values.provider === p ? "primary" : ""}" data-p="${p}">${p}</button>`).join("")}
    </div>
    ${makeButtons(false, "next")}
  `;
  document.querySelectorAll(".provider-btn").forEach(btn => {
    btn.onclick = () => {
      values.provider = btn.dataset.p;
      document.querySelectorAll(".provider-btn").forEach(b => b.classList.remove("primary"));
      btn.classList.add("primary");
    };
  });
  document.getElementById("next-btn").onclick = () => {
    if (!values.provider) return;
    phase = "apikey";
    renderStep();
  };
  bindBack();
}

function renderApiKeyStep() {
  stepContent.innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length + 2}</div>
    <div class="step-title">${values.provider} api key</div>
    <div class="step-desc">paste your api key — we'll verify it and fetch available models</div>
    <div class="input-group">
      <input class="input" type="password" id="input" value="" placeholder="sk-..." autocomplete="off">
    </div>
    <div class="buttons">
      <button class="pixel btn" id="back-btn">back</button>
      <button class="pixel btn primary" id="next-btn">verify</button>
    </div>
    <div id="key-status" style="margin-top:1rem;font-size:0.9rem;color:var(--dim)"></div>
  `;
  const input = document.getElementById("input");
  input.focus();
  input.onkeydown = e => { if (e.key === "Enter") document.getElementById("next-btn").click(); };
  document.getElementById("next-btn").onclick = async () => {
    const key = input.value.trim();
    if (!key) return;
    const status = document.getElementById("key-status");
    const btn = document.getElementById("next-btn");
    btn.textContent = "verifying...";
    btn.disabled = true;
    status.textContent = "";
    try {
      const res = await fetch("/api/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: values.provider, apiKey: key })
      });
      const data = await res.json();
      if (data.success) {
        values.apiKey = key;
        fetchedModels = data.models || [];
        phase = "model";
        renderStep();
      } else {
        status.textContent = `invalid: ${data.error}`;
        status.style.color = "#ff6b6b";
        btn.textContent = "verify";
        btn.disabled = false;
      }
    } catch {
      status.textContent = "connection error";
      status.style.color = "#ff6b6b";
      btn.textContent = "verify";
      btn.disabled = false;
    }
  };
  bindBack();
}

function renderModelStep() {
  if (!values.model && fetchedModels.length > 0) values.model = fetchedModels[0];

  stepContent.innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length + 3}</div>
    <div class="step-title">model</div>
    <div class="step-desc">↑↓ to navigate, enter to confirm</div>
    <div class="model-list" id="model-list" tabindex="0">
      ${fetchedModels.map(m => `<button class="model-btn${values.model === m ? " active" : ""}" data-m="${m}">${m}</button>`).join("")}
    </div>
    ${makeButtons(false, "next")}
  `;

  const list = document.getElementById("model-list");

  function setActive(m) {
    values.model = m;
    document.querySelectorAll(".model-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.m === m);
    });
    list.querySelector(".model-btn.active")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  document.querySelectorAll(".model-btn").forEach(btn => {
    btn.onclick = () => setActive(btn.dataset.m);
  });

  list.addEventListener("keydown", e => {
    const idx = fetchedModels.indexOf(values.model);
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(fetchedModels[Math.min(idx + 1, fetchedModels.length - 1)]); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive(fetchedModels[Math.max(idx - 1, 0)]); }
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("next-btn").click(); }
    if (e.key === "Escape") goBack();
  });

  list.focus();

  document.getElementById("next-btn").onclick = () => {
    if (!values.model) return;
    phase = "systemprompt";
    renderStep();
  };
  bindBack();
}

function renderSystemPromptStep() {
  stepContent.innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length + 4}</div>
    <div class="step-title">personality</div>
    <div class="step-desc">how should the bot act? (optional — leave blank for default)</div>
    <div class="input-group">
      <input class="input" type="text" id="input" value="${values.systemPrompt}" placeholder="be sarcastic and funny" autocomplete="off">
    </div>
    ${makeButtons(true)}
  `;
  const input = document.getElementById("input");
  input.focus();
  input.onkeydown = e => { if (e.key === "Enter") document.getElementById("next-btn").click(); };
  document.getElementById("next-btn").onclick = () => {
    values.systemPrompt = input.value.trim();
    createBot();
  };
  bindBack();
}

async function createBot() {
  stepContent.innerHTML = `<div class="status-header blink">connecting...</div>`;
  try {
    const res = await fetch("/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ip: values.ip, port: parseInt(values.port), version: values.version,
        botName: values.botName, apiKey: values.apiKey, provider: values.provider,
        model: values.model, systemPrompt: values.systemPrompt
      })
    });
    const data = await res.json();
    if (data.success) { showDashboard(); init(); }
    else {
      stepContent.innerHTML = `
        <div class="status-header" style="color:#ff6b6b">failed</div>
        <div class="step-desc">${data.error}</div>
        <div class="buttons"><button class="pixel btn" id="retry-btn">try again</button></div>
      `;
      document.getElementById("retry-btn").onclick = () => { current = 0; phase = "static"; renderStep(); };
    }
  } catch {
    stepContent.innerHTML = `
      <div class="status-header" style="color:#ff6b6b">connection error</div>
      <div class="buttons"><button class="pixel btn" id="retry-btn">try again</button></div>
    `;
    document.getElementById("retry-btn").onclick = () => { current = 0; phase = "static"; renderStep(); };
  }
}

async function init() {
  if (statusInterval) clearInterval(statusInterval);
  const [status, historyData] = await Promise.all([checkStatus(), loadHistory()]);
  renderDashboard(status, historyData);
  if (status.active) {
    statusInterval = setInterval(async () => {
      const s = await checkStatus();
      if (s.active) {
        const timer = document.getElementById("timer");
        if (timer) { timer.textContent = formatTime(s.remaining); timer.className = `timer ${s.remaining < 60 ? "warning" : ""}`; }
      } else { init(); }
    }, 1000);
  }
}

init();
