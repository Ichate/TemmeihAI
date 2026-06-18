import json
from config import KEYS_FILE, PROVIDERS


def _load():
    if KEYS_FILE.exists():
        try:
            return json.loads(KEYS_FILE.read_text())
        except Exception:
            return {}
    return {}


def _save(data):
    KEYS_FILE.write_text(json.dumps(data, indent=2))


def _mask(key):
    if not key:
        return ""
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "*" * (len(key) - 8) + key[-4:]


def list_keys():
    data = _load()
    out = []
    for label, entry in data.items():
        out.append({
            "label": label,
            "provider": entry.get("provider", ""),
            "masked": _mask(entry.get("key", "")),
        })
    out.sort(key=lambda x: x["label"].lower())
    return out


def get_key(label):
    data = _load()
    entry = data.get(label)
    if not entry:
        return None
    return entry.get("key")


def get_provider(label):
    data = _load()
    entry = data.get(label)
    if not entry:
        return None
    return entry.get("provider")


def save_key(label, provider, key):
    label = (label or "").strip()
    provider = (provider or "").strip().lower()
    key = (key or "").strip()
    if not label or len(label) > 64:
        return False, "label required (max 64 chars)"
    if provider not in PROVIDERS:
        return False, "unsupported provider"
    if not key or len(key) > 256:
        return False, "invalid key"
    data = _load()
    data[label] = {"provider": provider, "key": key}
    _save(data)
    return True, "saved"


def delete_key(label):
    data = _load()
    if label in data:
        del data[label]
        _save(data)
        return True
    return False
