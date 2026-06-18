import re
import os
import subprocess
import asyncio
import time
from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from config import (
    BOT_DIR, BASE_DIR, PROVIDERS, RATE_LIMIT_BOT_SPAWN, RATE_LIMIT_BOT_WINDOW,
    MAX_SYSTEM_PROMPT_LEN, MAX_IP_LEN, MAX_BOT_NAME_LEN,
    DEFAULT_SESSION_MINUTES, MAX_SESSION_MINUTES, MIN_SESSION_MINUTES,
    STALE_LOG_TIMEOUT_S, MAX_COST_CAP_USD, MIN_COST_CAP_USD,
    LIMITS_ENABLED, MAX_BOTS_PER_OWNER, APP_MODE, IS_LOCAL,
    price_for_model,
)
import logger
import db
import identity

USAGE_RE = re.compile(r"usage input=(\d+) output=(\d+)")

router = APIRouter()
active_bots = {}
_spawn_limits = defaultdict(list)
_bot_seq = 0


def _owner_bots(owner):
    return [b for b in active_bots.values() if b["owner"] == owner]


def _next_bot_id():
    global _bot_seq
    _bot_seq += 1
    return f"b{_bot_seq}"


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
    costCapUsd: float = 0.0


def _spawn_retry_after(owner):
    if not LIMITS_ENABLED:
        return 0
    now = time.time()
    times = [t for t in _spawn_limits[owner] if now - t < RATE_LIMIT_BOT_WINDOW]
    _spawn_limits[owner] = times
    if len(times) >= RATE_LIMIT_BOT_SPAWN:
        oldest = min(times)
        return int(RATE_LIMIT_BOT_WINDOW - (now - oldest))
    return 0


def _record_spawn(owner):
    _spawn_limits[owner].append(time.time())


def build_system(bot_name, user_prompt):
    base = f"""You are {bot_name}, a player on a Minecraft server.

Style: reply in 1-2 short casual chat sentences, plain text, no markdown/emotes, never repeat yourself, address everyone together. You get a [current game state] line each turn; use it to react naturally but don't recite it.

You can actually act through tools - never just say you'll do something, call the tool. You can move and talk in the same reply, and keep chatting while busy. You roam on your own by default.

What you can do (use the matching tool, say so plainly if you can't): move (come, follow, go to coords, wander, flee, jump, crouch); items (hold/wear/drop/give/pick up/list, equip a weapon plus a shield in the offhand); fight mobs and defend yourself automatically (mace does a heavy slam on its own); protect/guard a player or spot and fight alongside allies; mine/dig/place blocks, vein-mine, clear areas, chop whole trees, harvest crops; chests and furnaces (store/take/smelt), buckets, flint and steel, buttons/levers/doors; craft anything (it works out the whole chain itself - planks, sticks, smelting ore, setting up a table), craft the best tier you can, full sets, top-ups, and use smithing/stonecutter/anvil/enchant/brew; fish, sleep at night, trade with villagers; elytra-fly to follow a player only if you have an elytra and they're actually gliding.

PvP only when a player explicitly asks (fight me/duel) or names a target - never attack players unprompted."""
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
    if config.costCapUsd:
        if config.costCapUsd < MIN_COST_CAP_USD or config.costCapUsd > MAX_COST_CAP_USD:
            return f"cost cap must be {MIN_COST_CAP_USD}-{MAX_COST_CAP_USD} usd"
    return None


def _tcp_open(host, port, timeout=3.0):
    import socket
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except OSError:
        return False


async def ping_server(host, port):
    loop = asyncio.get_event_loop()
    reachable = await loop.run_in_executor(None, _tcp_open, host, port)
    if not reachable:
        return False, f"nothing is listening on {host}:{port} (wrong port, or server offline)"

    try:
        proc = await asyncio.create_subprocess_exec(
            "node", "--no-warnings", str(BOT_DIR / "ping.js"), host, str(port),
            cwd=str(BASE_DIR),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=6.0)
        except asyncio.TimeoutError:
            try: proc.kill()
            except Exception: pass
            return True, "port open, status ping slow (continuing anyway)"
        code = proc.returncode
        if code == 0:
            return True, stdout.decode().strip()
        err = stderr.decode().strip() or "status ping refused"
        return True, f"port open but status ping failed ({err[:120]}), trying to join anyway"
    except FileNotFoundError:
        return True, "ping skipped (node missing)"
    except Exception as e:
        return True, f"port open, precheck error ({e}), trying anyway"


def _bot_status(b):
    elapsed = int(time.time() - b["start_time"])
    total = b["session_seconds"]
    remaining = max(0, total - elapsed)
    cost_projected = None
    if elapsed > 10 and b["cost"] > 0:
        rate = b["cost"] / elapsed
        cost_projected = round(rate * total, 4)
    return {
        "id": b["id"],
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
        "cost_projected": cost_projected,
        "cost_cap": b["cost_cap"] or None,
    }


@router.get("/status")
async def get_status(request: Request):
    try:
        owner = identity.owner_for(request)
        mine = _owner_bots(owner)
        if not mine:
            return {"active": False, "bots": []}
        bots = [_bot_status(b) for b in mine]
        primary = bots[0]
        return {"active": True, "bots": bots, **primary}
    except Exception as e:
        logger.error(f"status error: {e}")
        return {"active": False, "bots": []}


@router.post("/stop")
async def stop_bot(request: Request):
    owner = identity.owner_for(request)
    body = {}
    try:
        body = await request.json()
    except Exception:
        body = {}
    bot_id = body.get("id") if isinstance(body, dict) else None

    mine = _owner_bots(owner)
    if not mine:
        return {"success": False, "error": "no bot running"}

    targets = [b for b in mine if (not bot_id or b["id"] == bot_id)]
    if not targets:
        return {"success": False, "error": "no such bot"}

    for b in targets:
        try:
            b["proc"].terminate()
        except Exception:
            pass
        active_bots.pop(b["id"], None)
        logger.info(f"{b['name']} stopped by user")
    return {"success": True, "stopped": len(targets)}


@router.get("/mode")
async def get_mode():
    return {"mode": APP_MODE, "local": IS_LOCAL, "max_bots": MAX_BOTS_PER_OWNER}


@router.get("/history")
async def get_history(request: Request):
    owner = identity.owner_for(request)
    if IS_LOCAL:
        return {"bots": db.recent_bots()}
    return {"bots": db.recent_bots(owner=owner)}


@router.post("/bot")
async def create_bot(config: BotConfig, request: Request):
    owner = identity.owner_for(request)
    ip = identity.owner_ip(request)

    if len(_owner_bots(owner)) >= MAX_BOTS_PER_OWNER:
        if MAX_BOTS_PER_OWNER == 1:
            return {"success": False, "error": "you already have a bot running"}
        return {"success": False, "error": f"you're at your limit of {MAX_BOTS_PER_OWNER} bots"}

    retry_after = _spawn_retry_after(owner)
    if retry_after > 0:
        return JSONResponse(
            {"success": False, "error": "spawn cooldown active", "retry_after": retry_after},
            status_code=429,
        )

    if config.apiKey.startswith("saved:"):
        if not IS_LOCAL:
            return JSONResponse({"success": False, "error": "saved keys are local mode only"}, status_code=400)
        import keys as keyvault
        label = config.apiKey[len("saved:"):]
        real = keyvault.get_key(label)
        if not real:
            return JSONResponse({"success": False, "error": "saved key not found"}, status_code=400)
        config.apiKey = real

    error = validate(config)
    if error:
        logger.error(f"rejected {ip} - {error}")
        return JSONResponse({"success": False, "error": error}, status_code=400)

    ok, info = await ping_server(config.ip, config.port)
    if not ok:
        logger.warn(f"precheck failed for {config.ip}:{config.port} - {info}")
        return JSONResponse({"success": False, "error": info}, status_code=400)

    logger.info(f"precheck ok: {info}")

    system_prompt = build_system(config.botName, config.systemPrompt)
    session_seconds = config.sessionMinutes * 60
    logger.bot(f"{config.botName} connecting to {config.ip}:{config.port} ({config.sessionMinutes}min)")

    try:
        proc = subprocess.Popen(
            ["node", "--no-warnings", str(BOT_DIR / "run.js"), config.ip, str(config.port), config.version,
             config.botName, "-", config.provider, config.model, system_prompt, str(session_seconds)],
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env={**os.environ, "NODE_NO_WARNINGS": "1", "FORCE_COLOR": "0", "BOT_API_KEY": config.apiKey}
        )

        in_price, out_price = price_for_model(config.model)
        _record_spawn(owner)
        now = time.time()
        bot_id = _next_bot_id()
        active_bots[bot_id] = {
            "id": bot_id,
            "owner": owner,
            "proc": proc,
            "name": config.botName,
            "target": f"{config.ip}:{config.port}",
            "provider": config.provider,
            "model": config.model,
            "start_time": now,
            "session_seconds": session_seconds,
            "tokens_in": 0,
            "tokens_out": 0,
            "calls": 0,
            "cost": 0.0,
            "in_price": in_price,
            "out_price": out_price,
            "cost_cap": float(config.costCapUsd) if config.costCapUsd else 0.0,
            "last_log_time": now,
        }

        db.append_bot({
            "name": config.botName, "target": f"{config.ip}:{config.port}",
            "version": config.version, "provider": config.provider,
            "model": config.model, "session_minutes": config.sessionMinutes,
            "owner": owner,
            "time": datetime.now().isoformat()
        })

        async def monitor():
            loop = asyncio.get_event_loop()
            while proc.poll() is None:
                try:
                    line = await asyncio.wait_for(loop.run_in_executor(None, proc.stdout.readline), timeout=1.0)
                    if not line:
                        continue
                    line = line.strip()
                    if not line:
                        continue
                    if bot_id in active_bots:
                        active_bots[bot_id]["last_log_time"] = time.time()
                    try:
                        m = USAGE_RE.search(line)
                        if m and bot_id in active_bots:
                            b = active_bots[bot_id]
                            ti, to = int(m.group(1)), int(m.group(2))
                            b["tokens_in"] += ti
                            b["tokens_out"] += to
                            b["calls"] += 1
                            b["cost"] += (ti / 1_000_000) * b["in_price"] + (to / 1_000_000) * b["out_price"]
                            logger.info(f"{config.botName}: cost now ${b['cost']:.4f} ({b['calls']} calls)")
                            if b["cost_cap"] and b["cost"] >= b["cost_cap"]:
                                logger.warn(f"{b['name']} hit cost cap ${b['cost_cap']:.2f} (spent ${b['cost']:.4f}), stopping")
                                try: b["proc"].terminate()
                                except Exception: pass
                    except Exception as e:
                        logger.error(f"usage parse error: {e}")
                    if "error" in line.lower():
                        logger.error(f"{config.botName}: {line}")
                    else:
                        logger.info(f"{config.botName}: {line}")
                except asyncio.TimeoutError:
                    if bot_id in active_bots:
                        b = active_bots[bot_id]
                        if time.time() - b["last_log_time"] > STALE_LOG_TIMEOUT_S:
                            logger.warn(f"{b['name']} stale (no output for {STALE_LOG_TIMEOUT_S}s), killing")
                            try: b["proc"].kill()
                            except Exception: pass
                            break
                except Exception as e:
                    logger.error(f"monitor loop error: {e}")
                    await asyncio.sleep(0.5)
            if bot_id in active_bots:
                del active_bots[bot_id]
                logger.info(f"{config.botName} process ended")

        asyncio.create_task(monitor())
        logger.success(f"{config.botName} spawned")
        return {"success": True}
    except FileNotFoundError as e:
        logger.error(f"failed to spawn bot, node missing: {e}")
        return JSONResponse({"success": False, "error": "node is not installed on the server"}, status_code=500)
    except Exception as e:
        logger.error(f"failed to spawn bot: {type(e).__name__}: {e}")
        return JSONResponse({"success": False, "error": f"spawn failed: {type(e).__name__}"}, status_code=500)
