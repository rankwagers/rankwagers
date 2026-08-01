import os
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent
load_dotenv(_ROOT / ".env")

API_FOOTBALL_KEY = os.environ.get("API_FOOTBALL_KEY", "")
API_FOOTBALL_BASE = "https://v3.football.api-sports.io"

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

TELEGRAM_PLAY_URL = os.environ.get("TELEGRAM_PLAY_URL", "").strip()
TELEGRAM_PLAY_BUTTON_TEXT = os.environ.get(
    "TELEGRAM_PLAY_BUTTON_TEXT", "👉 BET HERE"
).strip()
TELEGRAM_PLAY_BUTTON_MODE = os.environ.get("TELEGRAM_PLAY_BUTTON_MODE", "url").strip().lower()
TELEGRAM_BOT_USERNAME = os.environ.get("TELEGRAM_BOT_USERNAME", "").strip()
TELEGRAM_MINI_APP_SHORT_NAME = os.environ.get("TELEGRAM_MINI_APP_SHORT_NAME", "play").strip()

PREMATCH_FH05_MAX = float(os.environ.get("PREMATCH_FH05_MAX", "1.22"))
LIVE_FH05_TRIGGER = float(os.environ.get("LIVE_FH05_TRIGGER", "1.35"))

PREMATCH_O25_MAX = float(os.environ.get("PREMATCH_O25_MAX", "1.44"))
LIVE_O25_TRIGGER = float(os.environ.get("LIVE_O25_TRIGGER", "1.50"))

SCAN_INTERVAL_MINUTES = int(os.environ.get("SCAN_INTERVAL_MINUTES", "60"))
LIVE_POLL_SECONDS = int(os.environ.get("LIVE_POLL_SECONDS", "30"))

WIN_REPLY_DELAY_MIN = int(os.environ.get("WIN_REPLY_DELAY_MIN", "60"))
WIN_REPLY_DELAY_MAX = int(os.environ.get("WIN_REPLY_DELAY_MAX", "120"))

TIMEZONE = os.environ.get("TIMEZONE", "UTC")

DATA_DIR = _ROOT / "data"
WATCHLIST_PATH = DATA_DIR / "watchlist.json"
SIGNALS_PATH = DATA_DIR / "signals.json"

ODDS_REQUEST_DELAY = float(os.environ.get("ODDS_REQUEST_DELAY", "0.3"))

REMINDER_LOOKAHEAD_MINUTES = int(os.environ.get("REMINDER_LOOKAHEAD_MINUTES", "120"))
REMINDER_WINDOW_MIN = int(os.environ.get("REMINDER_WINDOW_MIN", "55"))
REMINDER_WINDOW_MAX = int(os.environ.get("REMINDER_WINDOW_MAX", "65"))
DIGEST_MAX_MATCHES = int(os.environ.get("DIGEST_MAX_MATCHES", "8"))

LIVE_SIGNAL_AS_PHOTO = os.environ.get("LIVE_SIGNAL_AS_PHOTO", "true").strip().lower() in (
    "1",
    "true",
    "yes",
)

WIN_REPLY_AS_PHOTO = os.environ.get("WIN_REPLY_AS_PHOTO", "true").strip().lower() in (
    "1",
    "true",
    "yes",
)

DIGEST_AS_PHOTO = os.environ.get("DIGEST_AS_PHOTO", "true").strip().lower() in (
    "1",
    "true",
    "yes",
)


def normalize_chat_id(chat_id: str) -> str:
    cid = str(chat_id).strip()
    if not cid:
        return cid
    if cid.startswith("-100") or cid.startswith("-"):
        return cid
    if cid.isdigit():
        return f"-100{cid}"
    return cid


def validate_config() -> list[str]:
    errors: list[str] = []
    if not TELEGRAM_BOT_TOKEN:
        errors.append("TELEGRAM_BOT_TOKEN is missing")
    if not TELEGRAM_CHAT_ID:
        errors.append("TELEGRAM_CHAT_ID is missing")
    if not API_FOOTBALL_KEY:
        errors.append("API_FOOTBALL_KEY is missing")
    return errors
