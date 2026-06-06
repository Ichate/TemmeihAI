import re
import subprocess
import asyncio
import time
from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from config import BOT_DIR, BASE_DIR, PROVIDERS, RATE_LIMIT_BOT_SPAWN, RATE_LIMIT_BOT_WINDOW, MAX_SYSTEM_PROMPT_LEN, MAX_IP_LEN, MAX_BOT_NAME_LEN
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

def _check_spawn(ip):
    now = time.time()
    _spawn_limits[ip] = [t for t in _spawn_limits[ip] if now - t < RATE_LIMIT_BOT_WINDOW]
    if len(_spawn_limits[ip]) >= RATE_LIMIT_BOT_SPAWN:
        return False
    _spawn_limits[ip].append(now)
    return True

def build_system(bot_name, user_prompt):
    base = f"""You are a Minecraft bot named {bot_name} playing on a server.

Rules:
- Keep responses short (1-2 sentences max)
- Be casual, like a real minecraft player
- You know your name is {bot_name} and you're playing minecraft
- When multiple players talk, address them together
- Never repeat yourself
- No markdown, no emotes, just plain chat text
- Always respond to messages"""
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
    return None

@router.get("/status")
async def get_status(request: Request):
    ip = request.client.host
    if ip in active_bots:
        b = active_bots[ip]
        elapsed = int(time.time() - b["start_time"])
        remaining = max(0, 300 - elapsed)
        return {"active": True, "name": b["name"], "target": b["target"], "elapsed": elapsed, "remaining": remaining}
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

    if not _check_spawn(ip):
        return JSONResponse({"success": False, "error": "too many bots spawned recently, wait a few minutes"}, status_code=429)

    error = validate(config)
    if error:
        logger.error(f"rejected {ip} - {error}")
        return JSONResponse({"success": False, "error": error}, status_code=400)

    system_prompt = build_system(config.botName, config.systemPrompt)
    logger.bot(f"{config.botName} connecting to {config.ip}:{config.port}")

    try:
        proc = subprocess.Popen(
            ["node", "--no-warnings", str(BOT_DIR / "run.js"), config.ip, str(config.port), config.version,
             config.botName, config.apiKey, config.provider, config.model, system_prompt],
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env={**__import__("os").environ, "NODE_NO_WARNINGS": "1", "FORCE_COLOR": "0"}
        )

        active_bots[ip] = {
            "proc": proc, "name": config.botName,
            "target": f"{config.ip}:{config.port}",
            "start_time": time.time()
        }

        db.append_bot({
            "name": config.botName, "target": f"{config.ip}:{config.port}",
            "version": config.version, "provider": config.provider,
            "model": config.model, "time": datetime.now().isoformat()
        })

        async def monitor():
            loop = asyncio.get_event_loop()
            while proc.poll() is None:
                try:
                    line = await asyncio.wait_for(loop.run_in_executor(None, proc.stdout.readline), timeout=1.0)
                    if line:
                        line = line.strip()
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
