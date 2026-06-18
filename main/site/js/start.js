const PROVIDERS = ["anthropic", "openai", "openrouter", "gemini"];
let SESSION_OPTIONS = [5, 10, 15, 30];
let APP_MODE = "local";
let IS_LOCAL = true;
let savedKeys = [];

function clientId() {
  let id = localStorage.getItem("temmeih_client_id");
  if (!id) {
    const rnd = (crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, "") : (Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2));
    id = rnd.slice(0, 32);
    localStorage.setItem("temmeih_client_id", id);
  }
  return id;
}

function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {}, { "X-Client-Id": clientId() });
  return fetch(path, Object.assign({}, opts, { headers }));
}

async function loadMode() {
  try {
    const r = await (await api("/api/mode", { cache: "no-store" })).json();
    APP_MODE = r.mode || "local";
    IS_LOCAL = !!r.local;
  } catch {
    APP_MODE = "local";
    IS_LOCAL = true;
  }
  SESSION_OPTIONS = IS_LOCAL ? [5, 10, 15, 30, 60, 120] : [5, 10, 15, 30];
}

async function loadSavedKeys() {
  if (!IS_LOCAL) { savedKeys = []; return; }
  try {
    const r = await (await api("/api/keys", { cache: "no-store" })).json();
    savedKeys = (r && r.success && r.keys) ? r.keys : [];
  } catch {
    savedKeys = [];
  }
}
const STATIC_STEPS = [
  { id: "ip",      title: "server address",    desc: "where should the bot connect?",  placeholder: "localhost",  def: "" },
  { id: "port",    title: "port",              desc: "usually 25565 for minecraft",     placeholder: "25565",      def: "25565" },
  { id: "version", title: "minecraft version", desc: "your server version, or 'auto' to detect it (works with viaversion)", placeholder: "auto", def: "auto" },
  { id: "botName", title: "bot name",          desc: "what should we call it?",         placeholder: "temmeihBot", def: "temmeihBot" },
];

let step = 0;
let phase = "static";
let models = [];
let vals = { ip: "", port: "25565", version: "auto", botName: "temmeihBot", apiKey: "", provider: "", model: "", systemPrompt: "", sessionMinutes: 5, costCapUsd: 0 };
let timerInterval = null;
let cooldownInterval = null;

const el = id => document.getElementById(id);
const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

async function getStatus() {
  try { return await (await api("/api/status",{cache:"no-store"})).json(); }
  catch { return {active:false}; }
}

function showView(name) {
  el("view-dashboard").style.display = name === "dashboard" ? "flex" : "none";
  el("view-onboarding").style.display = name === "onboarding" ? "block" : "none";
}

async function init() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  await loadMode();
  await loadSavedKeys();
  const s = await getStatus();
  paintDashboard(s);
  if (s.active) startTimer();
}

function usageLine(s) {
  const tin = s.tokens_in || 0, tout = s.tokens_out || 0;
  const cost = (s.cost || 0).toFixed(4);
  const calls = s.calls || 0;
  let line = `${calls} calls | ${tin}+${tout} tok | $${cost}`;
  if (s.cost_projected != null) {
    line += ` -> est $${s.cost_projected.toFixed(4)} for full session`;
  }
  if (s.cost_cap) {
    line += ` (cap $${s.cost_cap.toFixed(2)})`;
  }
  return line;
}

function paintDashboard(s) {
  const wrap = el("view-dashboard");
  if (!wrap) return;
  if (s.active) {
    wrap.innerHTML = `
      <div class="bot-status active">
        <div class="status-header">bot running</div>
        <div class="status-info"><span class="status-label">name:</span> ${s.name}</div>
        <div class="status-info"><span class="status-label">server:</span> ${s.target}</div>
        <div class="status-info"><span class="status-label">provider:</span> ${s.provider}</div>
        <div class="status-info"><span class="status-label">model:</span> ${s.model}</div>
        <div class="timer" id="timer">${fmt(s.remaining)}</div>
        <div class="status-info usage" id="usage"><span class="status-label">usage:</span> ${usageLine(s)}</div>
      </div>
      <div class="actions">
        <button class="pixel btn" id="stop-btn">stop bot</button>
      </div>
    `;
    el("stop-btn").onclick = async () => { await api("/api/stop",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:s.id||null})}); init(); };
  } else {
    wrap.innerHTML = `
      <div class="bot-status">
        <div class="status-header">no bot running</div>
        <div class="status-info">create a new bot to get started</div>
      </div>
      <div class="actions">
        <button class="pixel btn primary" id="create-btn">create bot</button>
      </div>
    `;
    el("create-btn").onclick = () => { showView("onboarding"); step = 0; phase = "static"; render(); };
  }
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(async () => {
    const s = await getStatus();
    if (s.active) {
      const t = el("timer");
      if (t) {
        t.textContent = fmt(s.remaining);
        t.className = "timer" + (s.remaining < 60 ? " warning" : "");
      }
      const u = el("usage");
      if (u) u.innerHTML = `<span class="status-label">usage:</span> ${usageLine(s)}`;
    } else {
      clearInterval(timerInterval);
      timerInterval = null;
      showView("dashboard");
      init();
    }
  }, 1000);
}

function totalSteps() { return STATIC_STEPS.length + 6; }
function stepIdx() {
  if (phase === "static") return step;
  if (phase === "provider") return STATIC_STEPS.length;
  if (phase === "apikey") return STATIC_STEPS.length + 1;
  if (phase === "model") return STATIC_STEPS.length + 2;
  if (phase === "systemprompt") return STATIC_STEPS.length + 3;
  if (phase === "session") return STATIC_STEPS.length + 4;
  return STATIC_STEPS.length + 5;
}

function canBack() { return phase !== "static" || step > 0; }
function goBack() {
  if (phase === "costcap") { phase = "session"; render(); return; }
  if (phase === "session") { phase = "systemprompt"; render(); return; }
  if (phase === "systemprompt") { phase = "model"; render(); return; }
  if (phase === "model") { phase = "apikey"; render(); return; }
  if (phase === "apikey") { phase = "provider"; render(); return; }
  if (phase === "provider") { phase = "static"; step = STATIC_STEPS.length - 1; render(); return; }
  if (step > 0) { step--; render(); }
}

function render() {
  const total = totalSteps(), idx = stepIdx();
  el("progress").innerHTML = Array.from({length:total},(_,i) =>
    `<div class="progress-dot${i===idx?" active":i<idx?" done":""}"></div>`
  ).join("");

  if (phase === "static") renderStatic();
  else if (phase === "provider") renderProvider();
  else if (phase === "apikey") renderApiKey();
  else if (phase === "model") renderModel();
  else if (phase === "systemprompt") renderPersonality();
  else if (phase === "session") renderSession();
  else renderCostCap();
}

function navBtns(label) {
  return `<div class="buttons">
    ${canBack() ? '<button class="pixel btn" id="bb">back</button>' : '<button class="pixel btn" id="cb">cancel</button>'}
    <button class="pixel btn primary" id="nb">${label}</button>
  </div>`;
}
function bindNav() {
  el("bb")?.addEventListener("click", goBack);
  el("cb")?.addEventListener("click", () => { showView("dashboard"); init(); });
}

function renderStatic() {
  const s = STATIC_STEPS[step];
  el("step-content").innerHTML = `
    <div class="step-icon pixel">${step+1}</div>
    <div class="step-title">${s.title}</div>
    <div class="step-desc">${s.desc}</div>
    <input class="input" type="text" id="inp" value="${vals[s.id]}" placeholder="${s.placeholder}" autocomplete="off">
    ${navBtns("next")}
  `;
  const inp = el("inp"); inp.focus(); inp.select();
  inp.onkeydown = e => { if(e.key==="Enter") el("nb").click(); };
  el("nb").onclick = () => {
    vals[s.id] = inp.value.trim() || s.def;
    if (step < STATIC_STEPS.length-1) { step++; render(); }
    else { phase = "provider"; render(); }
  };
  bindNav();
}

function renderProvider() {
  el("step-content").innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length+1}</div>
    <div class="step-title">ai provider</div>
    <div class="step-desc">which provider should power the bot?</div>
    <div class="provider-list">
      ${PROVIDERS.map(p=>`<button class="pixel btn provider-btn${vals.provider===p?" primary":""}" data-p="${p}">${p}</button>`).join("")}
    </div>
    ${navBtns("next")}
  `;
  document.querySelectorAll(".provider-btn").forEach(b => {
    b.onclick = () => {
      vals.provider = b.dataset.p;
      document.querySelectorAll(".provider-btn").forEach(x=>x.classList.remove("primary"));
      b.classList.add("primary");
    };
  });
  el("nb").onclick = () => { if (vals.provider) { phase="apikey"; render(); } };
  bindNav();
}

function renderApiKey() {
  const mine = savedKeys.filter(k => k.provider === vals.provider);
  const savedBlock = (IS_LOCAL && mine.length) ? `
    <div class="step-desc" style="margin-top:0.5rem">saved keys:</div>
    <div class="provider-list">
      ${mine.map(k => `<button class="pixel btn saved-key-btn" data-label="${k.label}">${k.label} (${k.masked})</button>`).join("")}
    </div>
    <div class="step-desc" style="font-size:0.85rem;opacity:0.7;margin:0.5rem 0">or paste a new one below</div>
  ` : "";
  const saveOpt = IS_LOCAL ? `
    <label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;font-size:0.9rem">
      <input type="checkbox" id="save-key"> save this key as
      <input class="input" type="text" id="save-label" placeholder="my key" style="flex:1;min-width:0" autocomplete="off">
    </label>
  ` : "";
  el("step-content").innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length+2}</div>
    <div class="step-title">${vals.provider} api key</div>
    <div class="step-desc">paste your api key, we'll verify and fetch models</div>
    ${savedBlock}
    <input class="input" type="password" id="inp" value="" placeholder="sk-..." autocomplete="off">
    ${saveOpt}
    <div class="buttons">
      <button class="pixel btn" id="bb">back</button>
      <button class="pixel btn primary" id="nb">verify</button>
    </div>
    <div id="ks" style="margin-top:1rem;font-size:0.9rem;color:var(--dim)"></div>
  `;
  const inp = el("inp"); inp.focus();
  inp.onkeydown = e => { if(e.key==="Enter") el("nb").click(); };
  document.querySelectorAll(".saved-key-btn").forEach(b => {
    b.onclick = async () => {
      const ks = el("ks");
      ks.textContent = "loading saved key..."; ks.style.color = "var(--dim)";
      try {
        const v = await (await api("/api/keys/verify-saved",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({label:b.dataset.label})})).json();
        if (v && v.success) { vals.apiKey = "saved:" + b.dataset.label; models = v.models || []; phase = "model"; render(); return; }
        ks.textContent = (v && v.error) ? v.error : "couldn't load that saved key"; ks.style.color = "#ff6b6b";
      } catch {
        ks.textContent = "couldn't load that saved key"; ks.style.color = "#ff6b6b";
      }
    };
  });
  el("nb").onclick = async () => {
    const key = inp.value.trim(); if (!key) return;
    const ks = el("ks"), btn = el("nb");
    btn.textContent = "verifying..."; btn.disabled = true; ks.textContent = "";
    try {
      const r = await (await api("/api/verify-key",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:vals.provider,apiKey:key})})).json();
      if (r.success) {
        vals.apiKey=key; models=r.models||[];
        if (IS_LOCAL && el("save-key") && el("save-key").checked) {
          const label = (el("save-label").value || "").trim();
          if (label) {
            try { await api("/api/keys/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({label,provider:vals.provider,apiKey:key})}); } catch {}
          }
        }
        phase="model"; render();
      }
      else { ks.textContent=`error: ${r.error}`; ks.style.color="#ff6b6b"; btn.textContent="verify"; btn.disabled=false; }
    } catch { ks.textContent="connection error"; ks.style.color="#ff6b6b"; btn.textContent="verify"; btn.disabled=false; }
  };
  el("bb")?.addEventListener("click", goBack);
}

function renderModel() {
  if (!vals.model && models.length) vals.model = models[0];
  el("step-content").innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length+3}</div>
    <div class="step-title">model</div>
    <div class="step-desc">${models.length} models, click to select</div>
    <div class="model-box" id="mb">
      ${models.map(m=>`<div class="mitem${vals.model===m?" sel":""}" data-m="${m}">${m}</div>`).join("")}
    </div>
    ${navBtns("next")}
  `;
  document.querySelectorAll(".mitem").forEach(b => {
    b.onclick = () => {
      vals.model = b.dataset.m;
      document.querySelectorAll(".mitem").forEach(x=>x.classList.remove("sel"));
      b.classList.add("sel");
      b.scrollIntoView({block:"nearest"});
    };
  });
  const selEl = document.querySelector(".mitem.sel");
  if (selEl) selEl.scrollIntoView({block:"nearest"});
  el("nb").onclick = () => { if(vals.model){phase="systemprompt";render();} };
  bindNav();
}

function renderPersonality() {
  el("step-content").innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length+4}</div>
    <div class="step-title">personality</div>
    <div class="step-desc">how should the bot act? (optional)</div>
    <input class="input" type="text" id="inp" value="${vals.systemPrompt}" placeholder="be sarcastic and funny" autocomplete="off">
    ${navBtns("next")}
  `;
  const inp = el("inp"); inp.focus();
  inp.onkeydown = e => { if(e.key==="Enter") el("nb").click(); };
  el("nb").onclick = () => { vals.systemPrompt = inp.value.trim(); phase = "session"; render(); };
  bindNav();
}

function renderSession() {
  el("step-content").innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length+5}</div>
    <div class="step-title">session length</div>
    <div class="step-desc">how long should the bot stay?${IS_LOCAL ? "" : " (max 30 min)"}</div>
    <div class="session-list">
      ${SESSION_OPTIONS.map(m=>`<button class="pixel btn session-btn${vals.sessionMinutes===m?" primary":""}" data-m="${m}">${m>=60?(m/60)+" hr":m+" min"}</button>`).join("")}
    </div>
    ${navBtns("next")}
  `;
  document.querySelectorAll(".session-btn").forEach(b => {
    b.onclick = () => {
      vals.sessionMinutes = parseInt(b.dataset.m);
      document.querySelectorAll(".session-btn").forEach(x=>x.classList.remove("primary"));
      b.classList.add("primary");
    };
  });
  el("nb").onclick = () => { phase = "costcap"; render(); };
  bindNav();
}

function renderCostCap() {
  el("step-content").innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length+6}</div>
    <div class="step-title">cost cap</div>
    <div class="step-desc">stop the bot if it spends more than this in usd (leave blank for no cap)</div>
    <input class="input" type="number" id="inp" min="0" max="25" step="0.05" value="${vals.costCapUsd || ""}" placeholder="0.50" autocomplete="off">
    <div class="step-desc" style="font-size:0.85rem;opacity:0.7;margin-top:0.5rem">range $0.05 to $25.00, optional</div>
    ${navBtns("create")}
  `;
  const inp = el("inp"); inp.focus();
  inp.onkeydown = e => { if (e.key === "Enter") el("nb").click(); };
  el("nb").onclick = () => {
    const v = parseFloat(inp.value);
    vals.costCapUsd = Number.isFinite(v) && v > 0 ? Math.min(25, Math.max(0.05, v)) : 0;
    createBot();
  };
  bindNav();
}

function renderCooldown(seconds) {
  if (cooldownInterval) clearInterval(cooldownInterval);
  let remaining = seconds;
  const paint = () => {
    el("step-content").innerHTML = `
      <div class="status-header" style="color:#ff6b6b">spawn cooldown</div>
      <div class="step-desc">you spawned a bot recently. you can create another in</div>
      <div class="timer" style="color:#ff6b6b">${fmt(remaining)}</div>
      <div class="buttons"><button class="pixel btn" id="cd-cancel">back to dashboard</button></div>
    `;
    el("cd-cancel").onclick = () => {
      if (cooldownInterval) clearInterval(cooldownInterval);
      cooldownInterval = null;
      showView("dashboard"); init();
    };
  };
  paint();
  cooldownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
      step = 0; phase = "static"; render();
    } else {
      const t = el("step-content")?.querySelector(".timer");
      if (t) t.textContent = fmt(remaining);
    }
  }, 1000);
}

async function createBot() {
  el("step-content").innerHTML = `<div class="status-header blink">connecting...</div>`;
  try {
    const res = await api("/api/bot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ip:vals.ip,port:parseInt(vals.port),version:vals.version,botName:vals.botName,apiKey:vals.apiKey,provider:vals.provider,model:vals.model,systemPrompt:vals.systemPrompt,sessionMinutes:vals.sessionMinutes,costCapUsd:vals.costCapUsd})});
    const r = await res.json();
    if (r.success) { showView("dashboard"); init(); return; }
    if (res.status === 429 && r.retry_after) { renderCooldown(r.retry_after); return; }
    el("step-content").innerHTML = `<div class="status-header" style="color:#ff6b6b">failed</div><div class="step-desc">${r.error}</div><div class="buttons"><button class="pixel btn" id="rb">try again</button></div>`;
    el("rb").onclick = () => { step=0; phase="static"; render(); };
  } catch {
    el("step-content").innerHTML = `<div class="status-header" style="color:#ff6b6b">connection error</div><div class="buttons"><button class="pixel btn" id="rb">try again</button></div>`;
    el("rb").onclick = () => { step=0; phase="static"; render(); };
  }
}

init();
