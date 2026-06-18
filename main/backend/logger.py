from datetime import datetime

CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
MAGENTA = "\033[95m"
DIM = "\033[2m"
RESET = "\033[0m"
BOLD = "\033[1m"

def _log(icon, color, msg):
    t = datetime.now().strftime("%H:%M:%S")
    print(f"{DIM}{t}{RESET} {color}{icon}{RESET} {msg}", flush=True)

def info(msg): _log("*", CYAN, msg)
def success(msg): _log("+", GREEN, msg)
def warn(msg): _log("!", YELLOW, msg)
def error(msg): _log("x", RED, msg)
def bot(msg): _log(">", MAGENTA, msg)
