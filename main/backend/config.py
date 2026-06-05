from pathlib import Path

BASE_DIR = Path(__file__).parent
SITE_DIR = BASE_DIR.parent / "site"
BOT_DIR = BASE_DIR / "bot"
DB_FILE = BASE_DIR / "bots.json"

RATE_LIMIT_CHAT = 30
RATE_LIMIT_WINDOW = 60

RATE_LIMIT_BOT_SPAWN = 1
RATE_LIMIT_BOT_WINDOW = 300

RATE_LIMIT_GLOBAL = 60
RATE_LIMIT_GLOBAL_WINDOW = 60

MAX_SYSTEM_PROMPT_LEN = 500
MAX_IP_LEN = 255
MAX_BOT_NAME_LEN = 16
MAX_MESSAGE_CONTENT_LEN = 2000
MAX_MESSAGES_COUNT = 60

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
