import json
from config import DB_FILE

def load():
    if DB_FILE.exists():
        return json.loads(DB_FILE.read_text())
    return {"bots": []}

def save(data):
    DB_FILE.write_text(json.dumps(data, indent=2))

def append_bot(entry):
    data = load()
    data["bots"].append(entry)
    save(data)

def recent_bots(n=10):
    return load()["bots"][-n:]
