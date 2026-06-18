import json
from config import DB_FILE

def load():
    if DB_FILE.exists():
        try:
            return json.loads(DB_FILE.read_text())
        except Exception:
            return {"bots": []}
    return {"bots": []}

def save(data):
    DB_FILE.write_text(json.dumps(data, indent=2))

def append_bot(entry):
    data = load()
    data["bots"].append(entry)
    save(data)

def recent_bots(n=10, owner=None):
    bots = load()["bots"]
    if owner is not None:
        bots = [b for b in bots if b.get("owner") == owner]
    return bots[-n:]
