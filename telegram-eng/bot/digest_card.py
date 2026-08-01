"""Single-image upcoming matches digest (compact list with logos)."""

from __future__ import annotations

import io
from typing import Any, Optional

from PIL import Image, ImageDraw

from bot.card import _fetch_logo, _font, _gradient_bg, _paste_logo, _truncate
from bot.messages import format_expectations, format_starts_in
from config import DIGEST_MAX_MATCHES

_CARD_W = 1080
_ROW_H = 76
_LOGO = 40
_HEADER = 128
_FOOTER = 56
_PAD = 40
_BORDER = (48, 54, 61)
_TEXT = (240, 246, 252)
_MUTED = (139, 148, 158)


def render_digest_card(
    entries: list[dict[str, Any]],
    *,
    lookahead_hours: float = 2.0,
    max_rows: int | None = None,
) -> bytes:
    cap = max_rows if max_rows is not None else DIGEST_MAX_MATCHES
    shown = entries[:cap]
    hidden = len(entries) - len(shown)
    hours_label = int(lookahead_hours) if lookahead_hours == int(lookahead_hours) else lookahead_hours
    h = _HEADER + len(shown) * _ROW_H + (_FOOTER if hidden > 0 else 0) + _PAD
    h = max(h, _HEADER + _ROW_H + _PAD)

    img = _gradient_bg(_CARD_W, h)
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([20, 20, _CARD_W - 20, h - 20], radius=24, outline=_BORDER, width=2)

    title_font = _font(36, bold=True)
    draw.text((_PAD, 48), "UPCOMING MATCHES", fill=_TEXT, font=title_font)
    sub_font = _font(22)
    sub = f"Next {hours_label} hour{'s' if hours_label != 1 else ''} · {len(entries)} match{'es' if len(entries) != 1 else ''}"
    draw.text((_PAD, 92), sub, fill=_MUTED, font=sub_font)

    y = _HEADER
    logo_cache: dict[str, Optional[Image.Image]] = {}

    def logo(url: Optional[str]) -> Optional[Image.Image]:
        if not url:
            return None
        if url not in logo_cache:
            logo_cache[url] = _fetch_logo(url, _LOGO)
        return logo_cache[url]

    row_font = _font(24, bold=True)
    meta_font = _font(20)
    for entry in shown:
        draw.line([(_PAD, y), (_CARD_W - _PAD, y)], fill=_BORDER, width=1)
        y += 10
        lx = _PAD
        _paste_logo(img, logo(entry.get("home_logo")), lx, y, _LOGO, entry.get("home", "?"))
        _paste_logo(img, logo(entry.get("away_logo")), lx + _LOGO + 8, y, _LOGO, entry.get("away", "?"))
        tx = lx + _LOGO * 2 + 28
        matchup = f"{entry.get('home', '')}  vs  {entry.get('away', '')}"
        matchup = _truncate(draw, matchup, row_font, _CARD_W - tx - 280)
        draw.text((tx, y + 4), matchup, fill=_TEXT, font=row_font)

        pick = format_expectations(entry.get("strategies", []))
        draw.text((tx, y + 36), pick, fill=_MUTED, font=meta_font)

        mins = entry.get("minutes_left")
        when = format_starts_in(float(mins)) if mins is not None else "Soon"
        when_font = _font(20, bold=True)
        ww = int(draw.textlength(when, font=when_font)) + 24
        wx = _CARD_W - _PAD - ww
        draw.rounded_rectangle([wx, y + 8, wx + ww, y + 40], radius=12, fill=(30, 41, 59))
        draw.text((wx + 12, y + 10), when, fill=_TEXT, font=when_font)

        y += _ROW_H - 10

    if hidden > 0:
        draw.line([(_PAD, y), (_CARD_W - _PAD, y)], fill=_BORDER, width=1)
        more_font = _font(22)
        draw.text(
            (_PAD, y + 16),
            f"+ {hidden} more match{'es' if hidden != 1 else ''} (see caption)",
            fill=_MUTED,
            font=more_font,
        )

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
