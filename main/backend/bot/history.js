import fs from "fs";
import path from "path";
import http from "http";

const MAX_MESSAGES = 50;

function callChat(apiKey, provider, model, messages, systemPrompt) {
  const body = JSON.stringify({ apiKey, provider, model, messages, systemPrompt });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: 3000,
      path: "/api/chat",
      method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) }
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json.text || "");
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export class History {
  constructor(botName, apiKey, provider, model, systemPrompt) {
    this.botName = botName;
    this.apiKey = apiKey;
    this.provider = provider;
    this.model = model;
    this.systemPrompt = systemPrompt;
    this.file = path.join(process.cwd(), `history_${botName}.json`);
    this.data = this._load();
  }

  _load() {
    if (fs.existsSync(this.file)) {
      try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch {}
    }
    return { summary: null, messages: [] };
  }

  _save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  async add(role, content) {
    this.data.messages.push({ role, content });
    if (this.data.messages.length >= MAX_MESSAGES) await this._summarize();
    this._save();
  }

  async _summarize() {
    const transcript = this.data.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    const prev = this.data.summary ? `Previous summary: ${this.data.summary}\n\n` : "";
    try {
      const summary = await callChat(
        this.apiKey, this.provider, this.model,
        [{ role: "user", content: `${prev}Summarize this minecraft bot conversation in 2-3 sentences:\n${transcript}` }],
        "You summarize conversations briefly and factually."
      );
      this.data.summary = summary;
      this.data.messages = [];
      this._save();
    } catch {}
  }

  getContext() {
    return this.data.messages.length > 0 ? [...this.data.messages] : null;
  }

  getSummary() { return this.data.summary; }

  cleanup() {
    if (fs.existsSync(this.file)) fs.unlinkSync(this.file);
  }
}
