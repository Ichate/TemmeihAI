import time
from collections import defaultdict
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from config import RATE_LIMIT_CHAT, RATE_LIMIT_WINDOW, RATE_LIMIT_GLOBAL, RATE_LIMIT_GLOBAL_WINDOW, PROVIDERS, MAX_MESSAGE_CONTENT_LEN, MAX_MESSAGES_COUNT, MAX_SYSTEM_PROMPT_LEN
import llm

router = APIRouter()
_chat_limits = defaultdict(list)
_global_limits = defaultdict(list)

class KeyVerifyRequest(BaseModel):
    provider: str
    apiKey: str

class ChatRequest(BaseModel):
    provider: str
    apiKey: str
    model: str
    messages: list
    systemPrompt: str = ""

def _check(limits, ip, max_count, window):
    now = time.time()
    limits[ip] = [t for t in limits[ip] if now - t < window]
    if len(limits[ip]) >= max_count:
        return False
    limits[ip].append(now)
    return True

def _sanitize_chat(req):
    if len(req.messages) > MAX_MESSAGES_COUNT:
        return "too many messages"
    for msg in req.messages:
        if not isinstance(msg, dict):
            return "invalid message format"
        if msg.get("role") not in ("user", "assistant", "system"):
            return "invalid message role"
        content = msg.get("content", "")
        if not isinstance(content, str) or len(content) > MAX_MESSAGE_CONTENT_LEN:
            return "message content too long"
    if len(req.systemPrompt) > MAX_SYSTEM_PROMPT_LEN:
        return "system prompt too long"
    if req.provider not in PROVIDERS:
        return "unsupported provider"
    if not req.apiKey or len(req.apiKey) > 256:
        return "invalid api key"
    if not req.model or len(req.model) > 128:
        return "invalid model"
    return None

@router.post("/verify-key")
async def verify_key(req: KeyVerifyRequest, request: Request):
    ip = request.client.host
    if not _check(_global_limits, ip, RATE_LIMIT_GLOBAL, RATE_LIMIT_GLOBAL_WINDOW):
        return JSONResponse({"success": False, "error": "rate limited"}, status_code=429)
    if req.provider not in PROVIDERS:
        return {"success": False, "error": "unsupported provider"}
    if not req.apiKey or len(req.apiKey) > 256:
        return {"success": False, "error": "invalid api key"}
    models, error = await llm.fetch_models(req.provider, req.apiKey)
    if error:
        return {"success": False, "error": error}
    return {"success": True, "models": models}

@router.post("/chat")
async def chat(req: ChatRequest, request: Request):
    ip = request.client.host
    if not _check(_global_limits, ip, RATE_LIMIT_GLOBAL, RATE_LIMIT_GLOBAL_WINDOW):
        return JSONResponse({"success": False, "error": "rate limited"}, status_code=429)
    if not _check(_chat_limits, ip, RATE_LIMIT_CHAT, RATE_LIMIT_WINDOW):
        return JSONResponse({"success": False, "error": "chat rate limited"}, status_code=429)
    error = _sanitize_chat(req)
    if error:
        return JSONResponse({"success": False, "error": error}, status_code=400)
    text, err = await llm.call(req.provider, req.apiKey, req.model, req.messages, req.systemPrompt)
    if err:
        return {"success": False, "error": err}
    return {"success": True, "text": text}
