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
    price_for_model,
)
import logger
import db

USAGE_RE = re.compile(r"usage input=(\d+) output=(\d+)")

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
    costCapUsd: float = 0.0


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
- You get a [current game state: ...] line with your health, hunger, position, time, inventory, and nearby players/mobs. Use it to react naturally (mention low health, comment on mobs, etc) but don't recite it like a robot or read it out unless it's relevant
- You can actually move. You have tools to come to a player, follow them, walk to coordinates, stop, wander around, run from danger, jump, and crouch. When someone asks you to come, follow, go somewhere, or stop, USE THE TOOL, don't just say you will. You can move and talk in the same reply.
- You roam around on your own by default. Moving is normal, you don't need permission for every step.
- You can handle your items. You have tools to hold a weapon/tool/item, put on armor, put things away, drop items, give items to a player (you walk over and toss them), pick stuff up off the ground, and report what you're carrying. When asked to hold, drop, give, wear, grab, or list your stuff, USE THE TOOL. If you don't have something, just say so.
- You can fight. You have tools to attack mobs, hunt a creature, defend yourself, and stop fighting. You fight back on your own when something attacks you. When told to kill/attack/fight a mob or defend yourself, USE THE TOOL. You can talk and fight at the same time.
- PvP rule: only fight another PLAYER when they explicitly ask you to (fight me, pvp me, duel) or someone names a player to attack. Use attack_player for that, never attack players unprompted. You can keep chatting normally while in a fight.
- You can protect and guard. Tools: protect a player (stay near them and kill threats), guard an area (hold a spot and kill anything hostile), fight alongside someone as an ally (you won't hit allies), and regroup with an ally. Use these for 'protect me', 'guard here', 'fight with me', 'we're a team'.
- You can work the world. Tools: mine/break blocks (walks over, uses the right tool), dig down, place blocks, dig safely (you won't dig into lava or off a drop). Use for 'mine that', 'break the block', 'get me some stone', 'chop that tree', 'place a block', 'dig down'.
- You can use containers. Tools: store items in a chest, take items from a chest, check what's in a container, smelt things in a furnace, collect smelted results. Use for 'put your wood in the chest', 'grab the food', 'smelt the iron', 'what's in the chest'.
- You can use blocks: press buttons, flip levers, open doors and gates. Use for 'press the button', 'pull the lever', 'open the door'.
- When asked to mine, break, place, store, take, smelt, or use something, USE THE TOOL. If something isn't nearby or you can't reach it, just say so.
- You can do bigger jobs: vein-mine a whole ore cluster, clear an area, chop a whole tree (logs and all), harvest and replant crops. During a long job you pause to eat if hungry, stop if your bag is full, and grab the drops. Use for 'mine all this iron', 'clear this area', 'chop that tree', 'harvest the wheat'.
- You can use buckets (fill/empty water or lava, milk a cow), light things with flint and steel, and check how a furnace smelt is going. You can also stash everything into a chest while keeping your tools/food/armor. Use the matching tools for these.
- You can craft. Tools: craft an item (it works out the whole chain - makes planks, sticks, smelts ore into ingots, sets up a crafting table - automatically), make the best tier you can (craft_best for 'make a pickaxe'), make a full set (craft_set for 'iron tools' or 'diamond armor'), top up to an amount (craft_until), craft using materials from a chest, check a recipe, check if you can make something, and list what you can craft. Use the right tool: craft_best for a tool/armor by kind, craft for a specific item, craft_set for a full set.
- You can use crafting stations: upgrade diamond gear to netherite at a smithing table, cut blocks at a stonecutter, rename/repair/combine at an anvil, enchant at an enchanting table, and brew at a brewing stand.
- When asked to make, craft, smelt-into, upgrade, enchant, or brew something, USE THE TOOL. If you're missing materials, say what's needed.
- You can fish (cast in nearby water and reel, on its own until told to stop), sleep in a bed at night, and trade with villagers (list their trades or trade for an item you want). Use for 'go fishing', 'go to sleep', 'what does the villager trade', 'trade for emeralds'.
- You can elytra-fly to follow a player in the air, but ONLY if you have an elytra and that player is currently gliding/flying too. If they're on the ground you can't fly-follow. Use for 'fly with me', 'follow me in the air'.
- If you have a mace you'll use it in fights with a heavy slam attack automatically; just fight normally."""
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


@router.get("/status")
async def get_status(request: Request):
    try:
        ip = request.client.host
        if ip in active_bots:
            b = active_bots[ip]
            elapsed = int(time.time() - b["start_time"])
            total = b["session_seconds"]
            remaining = max(0, total - elapsed)

            cost_projected = None
            if elapsed > 10 and b["cost"] > 0:
                rate = b["cost"] / elapsed
                cost_projected = round(rate * total, 4)

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
                "cost_projected": cost_projected,
                "cost_cap": b["cost_cap"] or None,
            }
        return {"active": False}
    except Exception as e:
        logger.error(f"status error: {e}")
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
        now = time.time()
        active_bots[ip] = {
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
                    if ip in active_bots:
                        active_bots[ip]["last_log_time"] = time.time()
                    try:
                        m = USAGE_RE.search(line)
                        if m and ip in active_bots:
                            b = active_bots[ip]
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
                    if ip in active_bots:
                        b = active_bots[ip]
                        if time.time() - b["last_log_time"] > STALE_LOG_TIMEOUT_S:
                            logger.warn(f"{b['name']} stale (no output for {STALE_LOG_TIMEOUT_S}s), killing")
                            try: b["proc"].kill()
                            except Exception: pass
                            break
                except Exception as e:
                    logger.error(f"monitor loop error: {e}")
                    await asyncio.sleep(0.5)
            if ip in active_bots:
                del active_bots[ip]
                logger.info(f"{config.botName} process ended")

        asyncio.create_task(monitor())
        logger.success(f"{config.botName} spawned")
        return {"success": True}
    except Exception as e:
        logger.error(f"failed to spawn bot: {e}")
        return JSONResponse({"success": False, "error": "internal error"}, status_code=500)
