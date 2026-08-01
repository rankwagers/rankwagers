#!/usr/bin/env python3
"""RankWagers Telegram Invite / VIP bot — bölge → affiliate Mini App → kayıt doğrulama."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from telegram.ext import Application, CallbackQueryHandler, CommandHandler, MessageHandler, filters

from config import TELEGRAM_BOT_TOKEN
from handlers import cmd_start, on_callback, on_text


def main() -> None:
    if not TELEGRAM_BOT_TOKEN:
        print("TELEGRAM_BOT_TOKEN is missing — copy .env.example to .env")
        sys.exit(1)

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))

    print("[telegram-invite-bots] polling...")
    app.run_polling(allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    main()
