#!/usr/bin/env python3
"""Live Goals Telegram Bot (English) — standalone service."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from bot.client import send_test_message
from config import LIVE_POLL_SECONDS, SCAN_INTERVAL_MINUTES, validate_config
from engine.monitor import run_monitor_cycle, send_reminder_digest_test
from engine.scanner import print_watchlist_summary, run_scan


async def scanner_loop() -> None:
    while True:
        try:
            await run_scan()
        except Exception as exc:
            print(f"[Scanner] Error: {exc}")
        await asyncio.sleep(SCAN_INTERVAL_MINUTES * 60)


async def monitor_loop() -> None:
    while True:
        try:
            await run_monitor_cycle()
        except Exception as exc:
            print(f"[Monitor] Error: {exc}")
        await asyncio.sleep(LIVE_POLL_SECONDS)


async def discover_chats() -> None:
    import httpx
    from config import TELEGRAM_BOT_TOKEN

    if not TELEGRAM_BOT_TOKEN:
        print("TELEGRAM_BOT_TOKEN is missing")
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        data = resp.json()

    if not data.get("ok"):
        print(f"Error: {data.get('description', data)}")
        return

    updates = data.get("result", [])
    if not updates:
        print(
            "No updates yet.\n"
            "1) Add the bot as admin to your channel/group\n"
            "2) Post a message or send /start in the group\n"
            "3) Run again: python main.py --discover-chat"
        )
        return

    seen: set[int] = set()
    for u in updates:
        msg = u.get("message") or u.get("channel_post") or {}
        chat = msg.get("chat", {})
        cid = chat.get("id")
        if cid and cid not in seen:
            seen.add(cid)
            title = chat.get("title") or chat.get("username") or chat.get("first_name", "")
            ctype = chat.get("type", "")
            print(f"chat_id={cid}  type={ctype}  title={title}")


async def run_bot(skip_test: bool = False) -> None:
    errors = validate_config()
    if errors:
        for e in errors:
            print(f"[Config] {e}")
        sys.exit(1)

    print("[Bot] Live Goals Bot (EN) starting...")
    print(f"[Bot] Scan every {SCAN_INTERVAL_MINUTES}m | Poll every {LIVE_POLL_SECONDS}s | Live signals as photo")

    if not skip_test:
        ok = await send_test_message()
        if not ok:
            print("[Bot] WARNING: Test message failed. Check chat ID and bot permissions.")
        else:
            print("[Bot] Test message sent.")

    print("[Bot] Initial fixture scan...")
    await run_scan()

    await asyncio.gather(scanner_loop(), monitor_loop())


def main() -> None:
    parser = argparse.ArgumentParser(description="Live Goals Telegram Bot (English)")
    parser.add_argument("--test", action="store_true", help="Send test message and exit")
    parser.add_argument("--scan-once", action="store_true", help="Run one scan and exit")
    parser.add_argument("--skip-test", action="store_true", help="Skip startup test message")
    parser.add_argument("--discover-chat", action="store_true", help="Discover Telegram chat IDs")
    parser.add_argument("--watchlist", action="store_true", help="Print watchlist")
    parser.add_argument("--digest-test", action="store_true", help="Send upcoming digest test (scan + notify)")
    parser.add_argument("--preview-cards", action="store_true", help="Generate sample live card PNGs")
    args = parser.parse_args()

    if args.preview_cards:
        from bot.card import save_preview_samples

        out = Path(__file__).resolve().parent / "data" / "previews"
        paths = save_preview_samples(out)
        print("[Preview] Sample cards created:")
        for p in paths:
            print(f"  {p}")
        return

    if args.watchlist:
        print_watchlist_summary()
        return

    if args.discover_chat:
        asyncio.run(discover_chats())
        return

    if args.test:
        errors = validate_config()
        if errors:
            for e in errors:
                print(e)
            sys.exit(1)
        ok = asyncio.run(send_test_message())
        sys.exit(0 if ok else 1)

    if args.scan_once:
        errors = validate_config()
        if errors:
            for e in errors:
                print(e)
            sys.exit(1)
        asyncio.run(run_scan())
        return

    if args.digest_test:
        errors = validate_config()
        if errors:
            for e in errors:
                print(e)
            sys.exit(1)

        async def _digest_test() -> None:
            print("[Bot] Fixture scan (fresh watchlist)...")
            await run_scan()
            print_watchlist_summary("Watchlist (before digest test)")
            await send_reminder_digest_test(mark_sent=False)

        asyncio.run(_digest_test())
        return

    try:
        asyncio.run(run_bot(skip_test=args.skip_test))
    except KeyboardInterrupt:
        print("\n[Bot] Stopped.")


if __name__ == "__main__":
    main()
