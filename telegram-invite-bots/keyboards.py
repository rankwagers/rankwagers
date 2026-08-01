from __future__ import annotations

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from content.copy_en import brand_button_label
from brands import BrandRow, brands_for_country, go_url, site_app_url
from regions import REGIONS


def start_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "Open App Site 🌐",
                    web_app=WebAppInfo(url=site_app_url()),
                ),
            ],
            [InlineKeyboardButton("GET FREE VIP 💎", callback_data="vip:start")],
        ]
    )


def region_grid() -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    pair: list[InlineKeyboardButton] = []
    for r in REGIONS:
        pair.append(InlineKeyboardButton(r.label, callback_data=f"vip:reg:{r.key}"))
        if len(pair) == 2:
            rows.append(pair)
            pair = []
    if pair:
        rows.append(pair)
    rows.append([InlineKeyboardButton("⬅️ Back to welcome", callback_data="vip:back_start")])
    return InlineKeyboardMarkup(rows)


def brand_webapp_rows(
    brands: list[BrandRow],
    subid_prefix: str,
    *,
    include_registered: bool = True,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for b in brands:
        subid = f"{subid_prefix}_{b.slug}"
        label = brand_button_label(b.slug, b.name)
        if len(label) > 64:
            label = b.name[:60]
        rows.append(
            [
                InlineKeyboardButton(
                    label,
                    web_app=WebAppInfo(url=go_url(b.slug, subid)),
                ),
            ]
        )
    if include_registered:
        rows.append([InlineKeyboardButton("✅ I registered", callback_data="vip:ireg")])
    rows.append([InlineKeyboardButton("⬅️ Change region", callback_data="vip:start")])
    return InlineKeyboardMarkup(rows)


def brand_pick_for_registration() -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    pair: list[InlineKeyboardButton] = []
    for b in brands_for_country(None):
        pair.append(
            InlineKeyboardButton(b.name, callback_data=f"vip:pick:{b.slug}")
        )
        if len(pair) == 2:
            rows.append(pair)
            pair = []
    if pair:
        rows.append(pair)
    rows.append([InlineKeyboardButton("⬅️ Back", callback_data="vip:back_brands")])
    return InlineKeyboardMarkup(rows)


def deposit_yes_no() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("Yes ✅", callback_data="vip:dep:yes"),
                InlineKeyboardButton("No ❌", callback_data="vip:dep:no"),
            ],
        ]
    )
