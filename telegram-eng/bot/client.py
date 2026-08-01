"""Telegram Bot API — messages, photos, inline buttons."""

from __future__ import annotations

from typing import Any, Optional

import httpx

from config import (
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME,
    TELEGRAM_CHAT_ID,
    TELEGRAM_MINI_APP_SHORT_NAME,
    TELEGRAM_PLAY_BUTTON_MODE,
    TELEGRAM_PLAY_BUTTON_TEXT,
    TELEGRAM_PLAY_URL,
    normalize_chat_id,
)

_BASE = "https://api.telegram.org"
_cached_bot_username: Optional[str] = None


async def _resolve_bot_username() -> str:
    global _cached_bot_username
    if TELEGRAM_BOT_USERNAME:
        return TELEGRAM_BOT_USERNAME.lstrip("@")
    if _cached_bot_username:
        return _cached_bot_username
    if not TELEGRAM_BOT_TOKEN:
        return ""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{_BASE}/bot{TELEGRAM_BOT_TOKEN}/getMe")
        data = resp.json()
        if data.get("ok"):
            _cached_bot_username = data.get("result", {}).get("username", "") or ""
    return _cached_bot_username or ""


def _mini_app_tme_url(bot_username: str) -> str:
    name = TELEGRAM_MINI_APP_SHORT_NAME.strip() or "play"
    return f"https://t.me/{bot_username.lstrip('@')}/{name}"


async def _build_inline_button(button_text: Optional[str] = None) -> dict[str, Any]:
    label = button_text or TELEGRAM_PLAY_BUTTON_TEXT
    mode = TELEGRAM_PLAY_BUTTON_MODE

    if mode == "url":
        return {"text": label, "url": TELEGRAM_PLAY_URL}

    if mode in ("mini_app", "tme", "miniapp"):
        username = await _resolve_bot_username()
        if not username:
            print("[Telegram] Could not resolve bot username, using direct URL")
            return {"text": label, "url": TELEGRAM_PLAY_URL}
        return {"text": label, "url": _mini_app_tme_url(username)}

    if mode == "web_app":
        return {"text": label, "web_app": {"url": TELEGRAM_PLAY_URL}}

    username = await _resolve_bot_username()
    if username:
        return {"text": label, "url": _mini_app_tme_url(username)}
    return {"text": label, "url": TELEGRAM_PLAY_URL}


async def play_button_markup(button_text: Optional[str] = None) -> Optional[dict[str, Any]]:
    if not TELEGRAM_PLAY_URL and TELEGRAM_PLAY_BUTTON_MODE not in ("mini_app", "tme", "miniapp"):
        return None
    btn = await _build_inline_button(button_text)
    return {"inline_keyboard": [[btn]]}


def _chat_id_candidates() -> list[str]:
    chat_ids = [TELEGRAM_CHAT_ID.strip(), normalize_chat_id(TELEGRAM_CHAT_ID)]
    seen: set[str] = set()
    candidates: list[str] = []
    for cid in chat_ids:
        if cid and cid not in seen:
            seen.add(cid)
            candidates.append(cid)
    return candidates


async def send_message(
    text: str,
    reply_to_message_id: Optional[int] = None,
    *,
    with_play_button: bool = False,
    play_button_text: Optional[str] = None,
) -> Optional[int]:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[Telegram] Missing token or chat_id")
        return None

    api_url = f"{_BASE}/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload_base: dict[str, Any] = {
        "text": text,
        "disable_web_page_preview": True,
    }
    if reply_to_message_id is not None:
        payload_base["reply_to_message_id"] = reply_to_message_id

    markup = await play_button_markup(play_button_text) if with_play_button else None
    if markup:
        payload_base["reply_markup"] = markup

    mode_label = TELEGRAM_PLAY_BUTTON_MODE if with_play_button else ""
    last_error = ""
    async with httpx.AsyncClient(timeout=30.0) as client:
        for chat_id in _chat_id_candidates():
            payload = {**payload_base, "chat_id": chat_id}
            try:
                resp = await client.post(api_url, json=payload)
                data = resp.json()
                if resp.status_code == 200 and data.get("ok"):
                    msg_id = data.get("result", {}).get("message_id")
                    btn_info = ""
                    if markup:
                        btn_url = markup["inline_keyboard"][0][0].get("url", "web_app")
                        btn_info = f" + button ({mode_label}: {btn_url})"
                    print(f"[Telegram] Message sent chat_id={chat_id} message_id={msg_id}{btn_info}")
                    return msg_id
                last_error = data.get("description", resp.text)
                print(f"[Telegram] Error chat_id={chat_id}: {last_error}")

                if (
                    markup
                    and TELEGRAM_PLAY_BUTTON_MODE == "web_app"
                    and "BUTTON_TYPE_INVALID" in last_error
                ):
                    print("[Telegram] web_app not supported in channel, url fallback...")
                    payload["reply_markup"] = {
                        "inline_keyboard": [
                            [{"text": TELEGRAM_PLAY_BUTTON_TEXT, "url": TELEGRAM_PLAY_URL}]
                        ]
                    }
                    resp2 = await client.post(api_url, json=payload)
                    data2 = resp2.json()
                    if resp2.status_code == 200 and data2.get("ok"):
                        return data2.get("result", {}).get("message_id")

            except Exception as exc:
                last_error = str(exc)
                print(f"[Telegram] Exception chat_id={chat_id}: {exc}")

    print(f"[Telegram] All chat_id attempts failed: {last_error}")
    return None


async def send_photo(
    image_bytes: bytes,
    caption: str,
    reply_to_message_id: Optional[int] = None,
    *,
    with_play_button: bool = False,
    play_button_text: Optional[str] = None,
) -> Optional[int]:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[Telegram] Missing token or chat_id")
        return None

    api_url = f"{_BASE}/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
    markup = await play_button_markup(play_button_text) if with_play_button else None
    last_error = ""

    async with httpx.AsyncClient(timeout=45.0) as client:
        for chat_id in _chat_id_candidates():
            data_fields: dict[str, Any] = {
                "chat_id": chat_id,
                "caption": caption[:1024],
            }
            if reply_to_message_id is not None:
                data_fields["reply_to_message_id"] = str(reply_to_message_id)
            if markup:
                import json

                data_fields["reply_markup"] = json.dumps(markup)

            files = {"photo": ("match_card.png", image_bytes, "image/png")}
            try:
                resp = await client.post(api_url, data=data_fields, files=files)
                body = resp.json()
                if resp.status_code == 200 and body.get("ok"):
                    msg_id = body.get("result", {}).get("message_id")
                    print(f"[Telegram] Photo sent chat_id={chat_id} message_id={msg_id}")
                    return msg_id
                last_error = body.get("description", resp.text)
                print(f"[Telegram] Photo error chat_id={chat_id}: {last_error}")
            except Exception as exc:
                last_error = str(exc)
                print(f"[Telegram] Photo exception chat_id={chat_id}: {exc}")

    print(f"[Telegram] Photo send failed: {last_error}")
    return None


async def send_test_message() -> bool:
    has_button = bool(TELEGRAM_PLAY_URL) or TELEGRAM_PLAY_BUTTON_MODE in ("mini_app", "tme", "miniapp")
    msg_id = await send_message("Live Goals Bot (EN) is online ✓", with_play_button=has_button)
    return msg_id is not None
