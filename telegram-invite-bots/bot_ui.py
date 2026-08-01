from __future__ import annotations

from pathlib import Path

from telegram import Message
from telegram.constants import ParseMode
from telegram.error import BadRequest
from telegram.ext import ContextTypes

from content.copy_en import welcome_caption_html
from keyboards import start_menu
from media.welcome_banner import ensure_welcome_banner


def welcome_photo_path() -> Path:
    return ensure_welcome_banner()


async def send_welcome(
    context: ContextTypes.DEFAULT_TYPE,
    chat_id: int,
    *,
    reply_to: int | None = None,
) -> Message:
    with welcome_photo_path().open("rb") as f:
        return await context.bot.send_photo(
            chat_id=chat_id,
            photo=f,
            caption=welcome_caption_html(),
            parse_mode=ParseMode.HTML,
            reply_markup=start_menu(),
            reply_to_message_id=reply_to,
        )


async def show_screen(
    query,
    context: ContextTypes.DEFAULT_TYPE,
    text: str,
    reply_markup=None,
    *,
    prefer_photo_welcome: bool = False,
) -> None:
    """Edit or replace the current message (photo vs text safe)."""
    msg = query.message
    if not msg or not query.message.chat:
        return
    chat_id = msg.chat_id

    if prefer_photo_welcome:
        try:
            await msg.delete()
        except BadRequest:
            pass
        await send_welcome(context, chat_id)
        return

    edit_kw: dict = {"parse_mode": ParseMode.HTML}
    if reply_markup is not None:
        edit_kw["reply_markup"] = reply_markup

    is_photo = bool(msg.photo)
    if is_photo and len(text) <= 1000:
        try:
            await query.edit_message_caption(caption=text, **edit_kw)
            return
        except BadRequest:
            pass

    if is_photo:
        try:
            await msg.delete()
        except BadRequest:
            pass
        await context.bot.send_message(chat_id=chat_id, text=text, **edit_kw)
        return

    try:
        await query.edit_message_text(text=text, **edit_kw)
    except BadRequest:
        await context.bot.send_message(chat_id=chat_id, text=text, **edit_kw)
