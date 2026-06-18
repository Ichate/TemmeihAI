import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from config import SITE_DIR, APP_MODE
from routes.bot import router as bot_router
from routes.chat import router as chat_router
from routes.keys import router as keys_router
from logger import GREEN, CYAN, DIM, RESET, BOLD

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(bot_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(keys_router, prefix="/api")

app.mount("/", StaticFiles(directory=str(SITE_DIR), html=True), name="site")

@app.get("/")
async def root():
    return FileResponse(str(SITE_DIR / "index.html"))

def banner():
    print()
    print(f"{GREEN}  ======================================{RESET}")
    print(f"{GREEN}  |{RESET}  {BOLD}temmeihAI{RESET} {DIM}server{RESET}                  {GREEN}|{RESET}")
    print(f"{GREEN}  |{RESET}  {CYAN}>{RESET} http://localhost:3000         {GREEN}|{RESET}")
    print(f"{GREEN}  |{RESET}  {CYAN}>{RESET} anthropic openai openrouter gemini {GREEN}|{RESET}")
    print(f"{GREEN}  |{RESET}  {CYAN}>{RESET} mode: {BOLD}{APP_MODE}{RESET}                    {GREEN}|{RESET}")
    print(f"{GREEN}  ======================================{RESET}")
    print()

if __name__ == "__main__":
    import uvicorn
    banner()
    uvicorn.run(app, host="0.0.0.0", port=3000, log_level="warning")
