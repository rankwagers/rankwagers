from __future__ import annotations

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from bot_ui import send_welcome, show_screen
from brands import BRAND_BY_SLUG, brands_for_country
from config import ADMIN_NOTIFY_CHAT_ID
from content.copy_en import (
    application_received_html,
    complete_id_first_alert,
    deposit_question_html,
    deposit_required_html,
    invalid_player_id_html,
    pick_site_html,
    player_id_prompt_html,
    region_prompt_html,
    rules_html,
)
from keyboards import (
    brand_pick_for_registration,
    brand_webapp_rows,
    deposit_yes_no,
    region_grid,
    start_menu,
)
from regions import REGION_BY_KEY
from storage import append_application


def _subid_prefix(user_id: int, region_key: str) -> str:
    return f"tgvip_{user_id}_{region_key}"


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_chat or not update.message:
        return
    context.user_data.clear()
    await send_welcome(
        context,
        update.effective_chat.id,
        reply_to=update.message.message_id,
    )


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    await query.answer()
    data = query.data
    user = update.effective_user
    if not user:
        return

    if data == "vip:start":
        context.user_data.pop("awaiting_player_id", None)
        await show_screen(
            query,
            context,
            region_prompt_html(),
            region_grid(),
        )
        return

    if data == "vip:back_start":
        context.user_data.clear()
        await show_screen(
            query,
            context,
            "",
            start_menu(),
            prefer_photo_welcome=True,
        )
        return

    if data.startswith("vip:reg:"):
        region_key = data.split(":", 2)[2]
        region = REGION_BY_KEY.get(region_key)
        if not region:
            await query.answer("Unknown region", show_alert=True)
            return
        context.user_data["region_key"] = region_key
        context.user_data["region_label"] = region.label
        context.user_data["country_code"] = region.country_code
        brands = brands_for_country(region.country_code)
        subid = _subid_prefix(user.id, region_key)
        text = rules_html(region_key, region.label)
        await show_screen(
            query,
            context,
            text,
            brand_webapp_rows(brands, subid, include_registered=True),
        )
        return

    if data == "vip:back_brands":
        region_key = context.user_data.get("region_key")
        region_label = context.user_data.get("region_label", "")
        if not region_key:
            await show_screen(query, context, "", start_menu(), prefer_photo_welcome=True)
            return
        cc = context.user_data.get("country_code", "")
        brands = brands_for_country(cc)
        subid = _subid_prefix(user.id, region_key)
        text = rules_html(region_key, region_label)
        await show_screen(
            query,
            context,
            text,
            brand_webapp_rows(brands, subid, include_registered=True),
        )
        return

    if data == "vip:ireg":
        context.user_data.pop("awaiting_player_id", None)
        context.user_data.pop("reg_brand_slug", None)
        await show_screen(
            query,
            context,
            pick_site_html(),
            brand_pick_for_registration(),
        )
        return

    if data.startswith("vip:pick:"):
        slug = data.split(":", 2)[2]
        brand = BRAND_BY_SLUG.get(slug)
        if not brand:
            await query.answer("Unknown brand", show_alert=True)
            return
        context.user_data["reg_brand_slug"] = slug
        context.user_data["reg_brand_name"] = brand.name
        context.user_data["awaiting_player_id"] = True
        await show_screen(
            query,
            context,
            player_id_prompt_html(brand.name),
            None,
        )
        return

    if data == "vip:dep:yes":
        slug = context.user_data.get("reg_brand_slug")
        brand_name = context.user_data.get("reg_brand_name", slug or "?")
        player_id = context.user_data.get("player_id", "")
        if not slug or not player_id:
            await query.answer(complete_id_first_alert(), show_alert=True)
            return
        region_label = context.user_data.get("region_label", "")
        record = {
            "telegram_user_id": user.id,
            "username": user.username,
            "region": region_label,
            "brand_slug": slug,
            "brand_name": brand_name,
            "player_id": player_id,
            "deposit_claimed": True,
        }
        append_application(record)
        if ADMIN_NOTIFY_CHAT_ID:
            try:
                await context.bot.send_message(
                    chat_id=ADMIN_NOTIFY_CHAT_ID,
                    text=(
                        "🆕 VIP application\n"
                        f"User: {user.id} @{user.username or '—'}\n"
                        f"Region: {region_label}\n"
                        f"Site: {brand_name}\n"
                        f"Player ID: {player_id}\n"
                        "Deposit: Yes"
                    ),
                )
            except Exception as exc:
                print(f"[notify] failed: {exc}")

        context.user_data.pop("awaiting_player_id", None)
        await show_screen(
            query,
            context,
            application_received_html(),
            None,
        )
        return

    if data == "vip:dep:no":
        region_key = context.user_data.get("region_key")
        if not region_key:
            await show_screen(query, context, "", start_menu(), prefer_photo_welcome=True)
            return
        cc = context.user_data.get("country_code", "")
        region_label = context.user_data.get("region_label", "")
        brands = brands_for_country(cc)
        subid = _subid_prefix(user.id, region_key)
        context.user_data.pop("awaiting_player_id", None)
        await show_screen(
            query,
            context,
            deposit_required_html(region_key),
            brand_webapp_rows(brands, subid, include_registered=True),
        )
        return


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_user:
        return
    if not context.user_data.get("awaiting_player_id"):
        return
    brand_name = context.user_data.get("reg_brand_name", "Partner")
    text = (update.message.text or "").strip()
    if not text or len(text) > 64:
        await update.message.reply_text(
            invalid_player_id_html(),
            parse_mode=ParseMode.HTML,
        )
        return
    context.user_data["player_id"] = text
    context.user_data["awaiting_player_id"] = False
    await update.message.reply_text(
        deposit_question_html(brand_name, text),
        reply_markup=deposit_yes_no(),
        parse_mode=ParseMode.HTML,
    )
