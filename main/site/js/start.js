const PROVIDERS = ["anthropic", "openai", "openrouter", "gemini"];
const STATIC_STEPS = [
  { id: "ip",      title: "server address",    desc: "where should the bot connect?",  placeholder: "localhost",  def: "" },
  { id: "port",    title: "port",              desc: "usually 25565 for minecraft",     placeholder: "25565",      def: "25565" },
  { id: "version", title: "minecraft version", desc: "match your server version",       placeholder: "1.20.4",     def: "1.20.4" },
  { id: "botName", title: "bot name",          desc: "what should we call it?",         placeholder: "temmeihBot", def: "temmeihBot" },
];

let step = 0;
let phase = "static";
let models = [];
let vals = { ip: "", port: "25565", version: "1.20.4", botName: "temmeihBot", apiKey: "", provider: "", model: "", systemPrompt: "" };
let timerInterval = null;

const el = id => document.getElementById(id);
const fmt = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

async function getStatus() {
  try { return await (await fetch("/api/status",{cache:"no-store"})).json(); }
  catch { return {active:false}; }
}

function showView(name) {
  el("view-dashboard").style.display = name === "dashboard" ? "flex" : "none";
  el("view-onboarding").style.display = name === "onboarding" ? "block" : "none";
}

async function init() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  const s = await getStatus();
  paintDashboard(s);
  if (s.active) startTimer();
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
        <div class="timer" id="timer">${fmt(s.remaining)}</div>
      </div>
      <div class="actions">
        <button class="pixel btn" id="stop-btn">stop bot</button>
      </div>
    `;
    el("stop-btn").onclick = async () => { await fetch("/api/stop",{method:"POST"}); init(); };
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
    } else {
      clearInterval(timerInterval);
      timerInterval = null;
      showView("dashboard");
      init();
    }
  }, 1000);
}

function totalSteps() { return STATIC_STEPS.length + 4; }
function stepIdx() {
  if (phase === "static") return step;
  if (phase === "provider") return STATIC_STEPS.length;
  if (phase === "apikey") return STATIC_STEPS.length + 1;
  if (phase === "model") return STATIC_STEPS.length + 2;
  return STATIC_STEPS.length + 3;
}

function canBack() { return phase !== "static" || step > 0; }
function goBack() {
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
  else renderPersonality();
}

function navBtns(isLast) {
  return `<div class="buttons">
    ${canBack() ? '<button class="pixel btn" id="bb">back</button>' : '<button class="pixel btn" id="cb">cancel</button>'}
    <button class="pixel btn primary" id="nb">${isLast?"create":"next"}</button>
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
    ${navBtns(false)}
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
    ${navBtns(false)}
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
  el("step-content").innerHTML = `
    <div class="step-icon pixel">${STATIC_STEPS.length+2}</div>
    <div class="step-title">${vals.provider} api key</div>
    <div class="step-desc">paste your api key — we'll verify and fetch models</div>
    <input class="input" type="password" id="inp" value="" placeholder="sk-..." autocomplete="off">
    <div class="buttons">
      <button class="pixel btn" id="bb">back</button>
      <button class="pixel btn primary" id="nb">verify</button>
    </div>
    <div id="ks" style="margin-top:1rem;font-size:0.9rem;color:var(--dim)"></div>
  `;
  const inp = el("inp"); inp.focus();
  inp.onkeydown = e => { if(e.key==="Enter") el("nb").click(); };
  el("nb").onclick = async () => {
    const key = inp.value.trim(); if (!key) return;
    const ks = el("ks"), btn = el("nb");
    btn.textContent = "verifying..."; btn.disabled = true; ks.textContent = "";
    try {
      const r = await (await fetch("/api/verify-key",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:vals.provider,apiKey:key})})).json();
      if (r.success) { vals.apiKey=key; models=r.models||[]; phase="model"; render(); }
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
    <div class="step-desc">${models.length} models — click to select</div>
    <div class="model-box" id="mb">
      ${models.map(m=>`<div class="mitem${vals.model===m?" sel":""}" data-m="${m}">${m}</div>`).join("")}
    </div>
    ${navBtns(false)}
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
    ${navBtns(true)}
  `;
  const inp = el("inp"); inp.focus();
  inp.onkeydown = e => { if(e.key==="Enter") el("nb").click(); };
  el("nb").onclick = () => { vals.systemPrompt = inp.value.trim(); createBot(); };
  bindNav();
}

async function createBot() {
  el("step-content").innerHTML = `<div class="status-header blink">connecting...</div>`;
  try {
    const r = await (await fetch("/api/bot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ip:vals.ip,port:parseInt(vals.port),version:vals.version,botName:vals.botName,apiKey:vals.apiKey,provider:vals.provider,model:vals.model,systemPrompt:vals.systemPrompt})})).json();
    if (r.success) { showView("dashboard"); init(); }
    else {
      el("step-content").innerHTML = `<div class="status-header" style="color:#ff6b6b">failed</div><div class="step-desc">${r.error}</div><div class="buttons"><button class="pixel btn" id="rb">try again</button></div>`;
      el("rb").onclick = () => { step=0; phase="static"; render(); };
    }
  } catch {
    el("step-content").innerHTML = `<div class="status-header" style="color:#ff6b6b">connection error</div><div class="buttons"><button class="pixel btn" id="rb">try again</button></div>`;
    el("rb").onclick = () => { step=0; phase="static"; render(); };
  }
}

init();
