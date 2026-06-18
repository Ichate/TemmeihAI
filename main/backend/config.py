import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
SITE_DIR = BASE_DIR.parent / "site"
BOT_DIR = BASE_DIR / "bot"
DB_FILE = BASE_DIR / "bots.json"
KEYS_FILE = BASE_DIR / "keys.json"
ENV_FILE = BASE_DIR / ".env"


def _load_env():
    if not ENV_FILE.exists():
        return
    try:
        for raw in ENV_FILE.read_text().splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except Exception:
        pass


_load_env()

APP_MODE = os.environ.get("APP_MODE", "local").strip().lower()
if APP_MODE not in ("local", "production"):
    APP_MODE = "local"

IS_LOCAL = APP_MODE == "local"
IS_PRODUCTION = APP_MODE == "production"

LOCAL_OWNER = "local-owner"

RATE_LIMIT_CHAT = 30
RATE_LIMIT_WINDOW = 60

RATE_LIMIT_BOT_SPAWN = 1
RATE_LIMIT_BOT_WINDOW = 300

MAX_BOTS_PER_OWNER = 5 if IS_LOCAL else 1

LIMITS_ENABLED = IS_PRODUCTION

STALE_LOG_TIMEOUT_S = 200

MAX_COST_CAP_USD = 25.0
MIN_COST_CAP_USD = 0.05

RATE_LIMIT_GLOBAL = 60
RATE_LIMIT_GLOBAL_WINDOW = 60

MAX_SYSTEM_PROMPT_LEN = 500
MAX_IP_LEN = 255
MAX_CLIENT_ID_LEN = 128
MAX_BOT_NAME_LEN = 16
MAX_MESSAGE_CONTENT_LEN = 2000
MAX_MESSAGES_COUNT = 60

DEFAULT_SESSION_MINUTES = 5
MAX_SESSION_MINUTES = 1440 if IS_LOCAL else 30
MIN_SESSION_MINUTES = 1
SESSION_OPTIONS = [5, 10, 15, 30, 60, 120] if IS_LOCAL else [5, 10, 15, 30]

PROVIDERS = ["anthropic", "openai", "openrouter", "gemini"]

PROVIDER_ENDPOINTS = {
    "anthropic": "https://api.anthropic.com/v1/messages",
    "openai": "https://api.openai.com/v1/chat/completions",
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
}

PROVIDER_MODEL_ENDPOINTS = {
    "anthropic": "https://api.anthropic.com/v1/models",
    "openai": "https://api.openai.com/v1/models",
    "openrouter": "https://openrouter.ai/api/v1/models",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/models",
}

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

PRICING_PER_MTOK = {
    "claude-opus": (15.0, 75.0),
    "claude-sonnet": (3.0, 15.0),
    "claude-haiku": (0.80, 4.0),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.0),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1": (2.0, 8.0),
    "gpt-4": (30.0, 60.0),
    "gpt-3.5": (0.50, 1.50),
    "o1": (15.0, 60.0),
    "o3": (2.0, 8.0),
    "gemini-1.5-pro": (1.25, 5.0),
    "gemini-1.5-flash": (0.075, 0.30),
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-2.5-pro": (1.25, 10.0),
    "gemini-2.5-flash": (0.30, 2.50),
}

DEFAULT_PRICING = (1.0, 3.0)

def price_for_model(model):
    m = (model or "").lower()
    for key, price in PRICING_PER_MTOK.items():
        if key in m:
            return price
    return DEFAULT_PRICING
