import re
import os
import subprocess
import asyncio
import time

USAGE_RE = re.compile(r"usage input=(\d+) output=(\d+)")
from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from config import (
    BOT_DIR, BASE_DIR, PROVIDERS, RATE_LIMIT_BOT_SPAWN, RATE_LIMIT_BOT_WINDOW,
    MAX_SYSTEM_PROMPT_LEN, MAX_IP_LEN, MAX_BOT_NAME_LEN,
    DEFAULT_SESSION_MINUTES, MAX_SESSION_MINUTES, MIN_SESSION_MINUTES,
    price_for_model,
)
import logger
import db

router = APIRouter()
active_bots = {}
_spawn_limits = defaultdict(list)

class BotConfig(BaseModel):
    ip: str
    port: int
    version: str
    botName: str
    apiKey: str
    provider: str
    model: str
    systemPrompt: str = ""
    sessionMinutes: int = DEFAULT_SESSION_MINUTES

def _spawn_retry_after(ip):
    now = time.time()
    times = [t for t in _spawn_limits[ip] if now - t < RATE_LIMIT_BOT_WINDOW]
    _spawn_limits[ip] = times
    if len(times) >= RATE_LIMIT_BOT_SPAWN:
        oldest = min(times)
        return int(RATE_LIMIT_BOT_WINDOW - (now - oldest))
    return 0

def _record_spawn(ip):
    _spawn_limits[ip].append(time.time())

def build_system(bot_name, user_prompt):
    base = f"""You are a Minecraft bot named {bot_name} playing on a server.

Rules:
- Keep responses short (1-2 sentences max)
- Be casual, like a real minecraft player
- You know your name is {bot_name} and you're playing minecraft
- When multiple players talk, address them together
- Never repeat yourself
- No markdown, no emotes, just plain chat text
- Always respond to messages
- You get a [current game state: ...] line with your health, hunger, position, time, inventory, and nearby players/mobs. Use it to react naturally (mention low health, comment on mobs, etc) but don't recite it like a robot or read it out unless it's relevant"""
    if user_prompt:
        base += f"\n\nPersonality: {user_prompt}"
    return base

def validate(config):
    if not config.ip or len(config.ip) > MAX_IP_LEN:
        return "invalid ip"
    if not re.match(r"^[a-zA-Z0-9.\-]+$", config.ip):
        return "invalid ip characters"
    if config.port < 1 or config.port > 65535:
        return "invalid port"
    if not re.match(r"^\d+\.\d+(\.\d+)?$", config.version):
        return "invalid version"
    if not config.botName or len(config.botName) > MAX_BOT_NAME_LEN:
        return "invalid bot name"
    if not re.match(r"^[a-zA-Z0-9_]+$", config.botName):
        return "bot name: letters, numbers, underscore only"
    if config.provider not in PROVIDERS:
        return "unsupported provider"
    if not config.apiKey or len(config.apiKey) > 256:
        return "api key required"
    if not config.model or len(config.model) > 128:
        return "model required"
    if len(config.systemPrompt) > MAX_SYSTEM_PROMPT_LEN:
        return "system prompt too long"
    if config.sessionMinutes < MIN_SESSION_MINUTES or config.sessionMinutes > MAX_SESSION_MINUTES:
        return f"session must be {MIN_SESSION_MINUTES}-{MAX_SESSION_MINUTES} minutes"
    return None

@router.get("/status")
async def get_status(request: Request):
    ip = request.client.host
    if ip in active_bots:
        b = active_bots[ip]
        elapsed = int(time.time() - b["start_time"])
        total = b["session_seconds"]
        remaining = max(0, total - elapsed)
        return {
            "active": True,
            "name": b["name"],
            "target": b["target"],
            "provider": b["provider"],
            "model": b["model"],
            "elapsed": elapsed,
            "remaining": remaining,
            "total": total,
            "tokens_in": b["tokens_in"],
            "tokens_out": b["tokens_out"],
            "calls": b["calls"],
            "cost": round(b["cost"], 4),
        }
    return {"active": False}

@router.post("/stop")
async def stop_bot(request: Request):
    ip = request.client.host
    if ip in active_bots:
        b = active_bots[ip]
        b["proc"].terminate()
        del active_bots[ip]
        logger.info(f"{b['name']} stopped by user")
        return {"success": True}
    return {"success": False, "error": "no bot running"}

@router.get("/history")
async def get_history():
    return {"bots": db.recent_bots()}

@router.post("/bot")
async def create_bot(config: BotConfig, request: Request):
    ip = request.client.host

    if ip in active_bots:
        return {"success": False, "error": "you already have a bot running"}

    retry_after = _spawn_retry_after(ip)
    if retry_after > 0:
        return JSONResponse(
            {"success": False, "error": "spawn cooldown active", "retry_after": retry_after},
            status_code=429,
        )

    error = validate(config)
    if error:
        logger.error(f"rejected {ip} - {error}")
        return JSONResponse({"success": False, "error": error}, status_code=400)

    system_prompt = build_system(config.botName, config.systemPrompt)
    session_seconds = config.sessionMinutes * 60
    logger.bot(f"{config.botName} connecting to {config.ip}:{config.port} ({config.sessionMinutes}min)")

    try:
        proc = subprocess.Popen(
            ["node", "--no-warnings", str(BOT_DIR / "run.js"), config.ip, str(config.port), config.version,
             config.botName, config.apiKey, config.provider, config.model, system_prompt, str(session_seconds)],
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env={**os.environ, "NODE_NO_WARNINGS": "1", "FORCE_COLOR": "0"}
        )

        in_price, out_price = price_for_model(config.model)
        _record_spawn(ip)
        active_bots[ip] = {
            "proc": proc,
            "name": config.botName,
            "target": f"{config.ip}:{config.port}",
            "provider": config.provider,
            "model": config.model,
            "start_time": time.time(),
            "session_seconds": session_seconds,
            "tokens_in": 0,
            "tokens_out": 0,
            "calls": 0,
            "cost": 0.0,
            "in_price": in_price,
            "out_price": out_price,
        }

        db.append_bot({
            "name": config.botName, "target": f"{config.ip}:{config.port}",
            "version": config.version, "provider": config.provider,
            "model": config.model, "session_minutes": config.sessionMinutes,
            "time": datetime.now().isoformat()
        })

        async def monitor():
            loop = asyncio.get_event_loop()
            while proc.poll() is None:
                try:
                    line = await asyncio.wait_for(loop.run_in_executor(None, proc.stdout.readline), timeout=1.0)
                    if line:
                        line = line.strip()
                        m = USAGE_RE.search(line)
                        if m and ip in active_bots:
                            b = active_bots[ip]
                            ti, to = int(m.group(1)), int(m.group(2))
                            b["tokens_in"] += ti
                            b["tokens_out"] += to
                            b["calls"] += 1
                            b["cost"] += (ti / 1_000_000) * b["in_price"] + (to / 1_000_000) * b["out_price"]
                        logger.error(f"{config.botName}: {line}") if "error" in line.lower() else logger.info(f"{config.botName}: {line}")
                except asyncio.TimeoutError:
                    pass
            if ip in active_bots:
                del active_bots[ip]
                logger.info(f"{config.botName} process ended")

        asyncio.create_task(monitor())
        logger.success(f"{config.botName} spawned")
        return {"success": True}
    except Exception as e:
        logger.error(f"failed to spawn bot: {e}")
        return JSONResponse({"success": False, "error": "internal error"}, status_code=500)
