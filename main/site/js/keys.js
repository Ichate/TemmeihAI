const PROVIDERS = ["anthropic", "openai", "openrouter", "gemini"];
const app = document.getElementById("keys-app");

function clientId() {
  let id = localStorage.getItem("temmeih_client_id");
  if (!id) {
    const rnd = (crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, "") : (Math.random().toString(36).slice(2) + Date.now().toString(36));
    id = rnd.slice(0, 32);
    localStorage.setItem("temmeih_client_id", id);
  }
  return id;
}

function api(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {}, { "X-Client-Id": clientId() });
  return fetch(path, Object.assign({}, opts, { headers }));
}

let saved = [];

async function loadKeys() {
  try {
    const r = await (await api("/api/keys", { cache: "no-store" })).json();
    if (!r.success) {
      app.innerHTML = `<div class="bot-status"><div class="status-header">${r.error || "key vault is local mode only"}</div></div>`;
      return false;
    }
    saved = r.keys || [];
    return true;
  } catch {
    app.innerHTML = `<div class="bot-status"><div class="status-header">couldn't reach the server</div></div>`;
    return false;
  }
}

function render() {
  const list = saved.length ? saved.map(k => `
    <div class="status-info" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem">
      <span><span class="status-label">${k.label}</span> ${k.provider} ${k.masked}</span>
      <button class="pixel btn del-btn" data-label="${k.label}">delete</button>
    </div>
  `).join("") : `<div class="status-info">no saved keys yet</div>`;

  app.innerHTML = `
    <div class="bot-status">
      <div class="status-header">saved keys</div>
      ${list}
    </div>
    <div class="bot-status" style="margin-top:1rem">
      <div class="status-header">add a key</div>
      <input class="input" id="k-label" placeholder="label (e.g. my openai)" autocomplete="off">
      <div class="provider-list" style="margin:0.5rem 0">
        ${PROVIDERS.map(p => `<button class="pixel btn prov-btn" data-p="${p}">${p}</button>`).join("")}
      </div>
      <input class="input" id="k-key" type="password" placeholder="sk-..." autocomplete="off">
      <div class="actions" style="margin-top:0.75rem">
        <button class="pixel btn primary" id="save-btn">verify & save</button>
      </div>
      <div id="msg" style="margin-top:0.75rem;font-size:0.9rem;color:var(--dim)"></div>
    </div>
  `;

  let provider = "";
  document.querySelectorAll(".prov-btn").forEach(b => {
    b.onclick = () => {
      provider = b.dataset.p;
      document.querySelectorAll(".prov-btn").forEach(x => x.classList.remove("primary"));
      b.classList.add("primary");
    };
  });

  document.querySelectorAll(".del-btn").forEach(b => {
    b.onclick = async () => {
      await api("/api/keys/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: b.dataset.label }) });
      await loadKeys();
      render();
    };
  });

  document.getElementById("save-btn").onclick = async () => {
    const label = document.getElementById("k-label").value.trim();
    const key = document.getElementById("k-key").value.trim();
    const msg = document.getElementById("msg");
    if (!label) { msg.textContent = "give it a label"; msg.style.color = "#ff6b6b"; return; }
    if (!provider) { msg.textContent = "pick a provider"; msg.style.color = "#ff6b6b"; return; }
    if (!key) { msg.textContent = "paste the key"; msg.style.color = "#ff6b6b"; return; }
    msg.textContent = "verifying..."; msg.style.color = "var(--dim)";
    try {
      const r = await (await api("/api/keys/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, provider, apiKey: key }) })).json();
      if (r.success) { await loadKeys(); render(); }
      else { msg.textContent = r.error || "couldn't save"; msg.style.color = "#ff6b6b"; }
    } catch {
      msg.textContent = "connection error"; msg.style.color = "#ff6b6b";
    }
  };
}

(async () => {
  const ok = await loadKeys();
  if (ok) render();
})();
