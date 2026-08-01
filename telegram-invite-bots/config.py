from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent
load_dotenv(_ROOT / ".env")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
SITE_URL = os.getenv("SITE_URL", "https://rankwagers.com").strip().rstrip("/")
ADMIN_NOTIFY_CHAT_ID = os.getenv("ADMIN_NOTIFY_CHAT_ID", "").strip()
PROMO_CODE = os.getenv("PROMO_CODE", "").strip()
WELCOME_IMAGE_PATH = os.getenv("WELCOME_IMAGE_PATH", "").strip()
VIP_APPLICATIONS_PATH = os.getenv("VIP_APPLICATIONS_PATH", "").strip()
DATA_DIR = _ROOT / "data"
