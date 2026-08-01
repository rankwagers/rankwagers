"""Live signal match card image (Pillow)."""

from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx
from PIL import Image, ImageDraw, ImageFont

_FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"

_BG_TOP = (13, 17, 23)
_BG_BOTTOM = (22, 30, 46)
_BORDER = (48, 54, 61)
_TEXT = (240, 246, 252)
_TEXT_MUTED = (139, 148, 158)
_LIVE_RED = (239, 68, 68)
_ACCENT_FH05 = (16, 185, 129)
_ACCENT_O25 = (249, 115, 22)
_SCORE_BG = (30, 41, 59)

_CARD_W = 1080
_CARD_H = 600
_LOGO_SIZE = 110


@dataclass
class MatchCardData:
    league: str
    country: str
    home: str
    away: str
    home_score: int = 0
    away_score: int = 0
    minute: Optional[str] = None
    strategy_id: str = "fh05"
    live_odd: Optional[float] = None
    home_logo_url: Optional[str] = None
    away_logo_url: Optional[str] = None


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        _FONTS / ("Inter-Bold.ttf" if bold else "Inter-Regular.ttf"),
        _FONTS / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf") if bold else Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf") if bold else Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for path in candidates:
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size)
            except OSError:
                continue
    return ImageFont.load_default()


def _gradient_bg(w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(_BG_TOP[0] + (_BG_BOTTOM[0] - _BG_TOP[0]) * t)
        g = int(_BG_TOP[1] + (_BG_BOTTOM[1] - _BG_TOP[1]) * t)
        b = int(_BG_TOP[2] + (_BG_BOTTOM[2] - _BG_TOP[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    return img


def _fetch_logo(url: Optional[str], size: int) -> Optional[Image.Image]:
    if not url:
        return None
    try:
        with httpx.Client(timeout=8.0, follow_redirects=True) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return None
            logo = Image.open(io.BytesIO(resp.content)).convert("RGBA")
            logo.thumbnail((size, size), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            ox = (size - logo.width) // 2
            oy = (size - logo.height) // 2
            canvas.paste(logo, (ox, oy), logo)
            return canvas
    except Exception:
        return None


def _placeholder_logo(draw: ImageDraw.ImageDraw, x: int, y: int, size: int, label: str) -> None:
    draw.ellipse([x, y, x + size, y + size], fill=(40, 48, 60), outline=_BORDER, width=2)
    font = _font(size // 2, bold=True)
    letter = (label[:1] or "?").upper()
    bbox = draw.textbbox((0, 0), letter, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((x + (size - tw) // 2, y + (size - th) // 2 - 4), letter, fill=_TEXT, font=font)


def _paste_logo(base: Image.Image, logo: Optional[Image.Image], x: int, y: int, size: int, fallback: str) -> None:
    if logo:
        base.paste(logo, (x, y), logo)
    else:
        _placeholder_logo(ImageDraw.Draw(base), x, y, size, fallback)


def _strategy_meta(strategy_id: str) -> tuple[str, str, tuple[int, int, int]]:
    if strategy_id == "o25":
        return "OVER 2.5 GOALS", "High total goals expected", _ACCENT_O25
    return "1H OVER 0.5", "First-half goal expected", _ACCENT_FH05


def _truncate(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_w: int) -> str:
    if draw.textlength(text, font=font) <= max_w:
        return text
    trimmed = text
    while trimmed and draw.textlength(trimmed + "…", font=font) > max_w:
        trimmed = trimmed[:-1]
    return (trimmed + "…") if trimmed else "…"


def render_match_card(data: MatchCardData) -> bytes:
    img = _gradient_bg(_CARD_W, _CARD_H)
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle([24, 24, _CARD_W - 24, _CARD_H - 24], radius=28, outline=_BORDER, width=2)

    live_font = _font(28, bold=True)
    live_text = "LIVE"
    live_w = int(draw.textlength(live_text, font=live_font)) + 36
    draw.rounded_rectangle([56, 52, 56 + live_w, 96], radius=18, fill=_LIVE_RED)
    draw.text((74, 58), live_text, fill=(255, 255, 255), font=live_font)

    if data.minute:
        minute_font = _font(26, bold=True)
        minute_text = data.minute if data.minute.endswith("'") or data.minute == "HT" else f"{data.minute}'"
        mw = int(draw.textlength(minute_text, font=minute_font)) + 28
        mx = 56 + live_w + 16
        draw.rounded_rectangle([mx, 52, mx + mw, 96], radius=18, fill=(30, 41, 59))
        draw.text((mx + 14, 58), minute_text, fill=_TEXT, font=minute_font)

    league_font = _font(24)
    league_plain = data.league or "League"
    if data.country and data.country.lower() not in league_plain.lower():
        league_plain = f"{league_plain} ({data.country})"
    league_plain = _truncate(draw, league_plain, league_font, _CARD_W - 120)
    draw.text((56, 118), league_plain, fill=_TEXT_MUTED, font=league_font)

    home_logo = _fetch_logo(data.home_logo_url, _LOGO_SIZE)
    away_logo = _fetch_logo(data.away_logo_url, _LOGO_SIZE)
    logo_y = 200
    home_x = 120
    away_x = _CARD_W - 120 - _LOGO_SIZE
    _paste_logo(img, home_logo, home_x, logo_y, _LOGO_SIZE, data.home)
    _paste_logo(img, away_logo, away_x, logo_y, _LOGO_SIZE, data.away)

    score_text = f"{data.home_score}  -  {data.away_score}"
    score_font = _font(72, bold=True)
    sw = draw.textlength(score_text, font=score_font)
    score_x = (_CARD_W - sw) // 2
    draw.rounded_rectangle(
        [score_x - 28, logo_y + 10, score_x + sw + 28, logo_y + _LOGO_SIZE - 10],
        radius=20,
        fill=_SCORE_BG,
    )
    draw.text((score_x, logo_y + 18), score_text, fill=_TEXT, font=score_font)

    name_font = _font(30, bold=True)
    home_name = _truncate(draw, data.home, name_font, 340)
    away_name = _truncate(draw, data.away, name_font, 340)
    hw = draw.textlength(home_name, font=name_font)
    aw = draw.textlength(away_name, font=name_font)
    draw.text((home_x + (_LOGO_SIZE - hw) // 2, logo_y + _LOGO_SIZE + 20), home_name, fill=_TEXT, font=name_font)
    draw.text((away_x + (_LOGO_SIZE - aw) // 2, logo_y + _LOGO_SIZE + 20), away_name, fill=_TEXT, font=name_font)

    tag, subtitle, accent = _strategy_meta(data.strategy_id)
    draw.rounded_rectangle([56, 430, _CARD_W - 56, 540], radius=22, fill=(18, 24, 36), outline=accent, width=2)
    tag_font = _font(34, bold=True)
    draw.text((88, 452), tag, fill=accent, font=tag_font)
    sub_font = _font(22)
    draw.text((88, 498), subtitle, fill=_TEXT_MUTED, font=sub_font)

    if data.live_odd is not None:
        odd_font = _font(40, bold=True)
        odd_text = f"{data.live_odd:.2f}"
        ow = draw.textlength(odd_text, font=odd_font)
        draw.text((_CARD_W - 88 - ow, 468), odd_text, fill=_TEXT, font=odd_font)
        odd_label_font = _font(18)
        draw.text((_CARD_W - 88 - ow, 508), "live odd", fill=_TEXT_MUTED, font=odd_label_font)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


_WIN_GREEN = (34, 197, 94)


def render_win_card(data: MatchCardData) -> bytes:
    img = _gradient_bg(_CARD_W, _CARD_H)
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([24, 24, _CARD_W - 24, _CARD_H - 24], radius=28, outline=_WIN_GREEN, width=3)

    win_font = _font(32, bold=True)
    win_text = "WINNER"
    win_w = int(draw.textlength(win_text, font=win_font)) + 40
    draw.rounded_rectangle([56, 52, 56 + win_w, 100], radius=18, fill=_WIN_GREEN)
    draw.text((76, 58), win_text, fill=(255, 255, 255), font=win_font)

    league_font = _font(24)
    league_plain = data.league or "League"
    if data.country and data.country.lower() not in league_plain.lower():
        league_plain = f"{league_plain} ({data.country})"
    league_plain = _truncate(draw, league_plain, league_font, _CARD_W - 120)
    draw.text((56, 118), league_plain, fill=_TEXT_MUTED, font=league_font)

    home_logo = _fetch_logo(data.home_logo_url, _LOGO_SIZE)
    away_logo = _fetch_logo(data.away_logo_url, _LOGO_SIZE)
    logo_y = 200
    home_x = 120
    away_x = _CARD_W - 120 - _LOGO_SIZE
    _paste_logo(img, home_logo, home_x, logo_y, _LOGO_SIZE, data.home)
    _paste_logo(img, away_logo, away_x, logo_y, _LOGO_SIZE, data.away)

    score_text = f"{data.home_score}  -  {data.away_score}"
    score_font = _font(72, bold=True)
    sw = draw.textlength(score_text, font=score_font)
    score_x = (_CARD_W - sw) // 2
    draw.rounded_rectangle(
        [score_x - 28, logo_y + 10, score_x + sw + 28, logo_y + _LOGO_SIZE - 10],
        radius=20,
        fill=_SCORE_BG,
    )
    draw.text((score_x, logo_y + 18), score_text, fill=_TEXT, font=score_font)

    name_font = _font(30, bold=True)
    home_name = _truncate(draw, data.home, name_font, 340)
    away_name = _truncate(draw, data.away, name_font, 340)
    hw = draw.textlength(home_name, font=name_font)
    aw = draw.textlength(away_name, font=name_font)
    draw.text((home_x + (_LOGO_SIZE - hw) // 2, logo_y + _LOGO_SIZE + 20), home_name, fill=_TEXT, font=name_font)
    draw.text((away_x + (_LOGO_SIZE - aw) // 2, logo_y + _LOGO_SIZE + 20), away_name, fill=_TEXT, font=name_font)

    tag, subtitle, accent = _strategy_meta(data.strategy_id)
    draw.rounded_rectangle([56, 430, _CARD_W - 56, 540], radius=22, fill=(18, 24, 36), outline=accent, width=2)
    tag_font = _font(34, bold=True)
    draw.text((88, 452), tag, fill=accent, font=tag_font)
    sub_font = _font(22)
    draw.text((88, 498), subtitle, fill=_TEXT_MUTED, font=sub_font)

    if data.minute:
        minute_font = _font(26, bold=True)
        minute_text = data.minute if data.minute.endswith("'") or data.minute == "HT" else f"{data.minute}'"
        mw = int(draw.textlength(minute_text, font=minute_font)) + 28
        draw.rounded_rectangle([_CARD_W - 56 - mw, 52, _CARD_W - 56, 96], radius=18, fill=(30, 41, 59))
        draw.text((_CARD_W - 56 - mw + 14, 58), minute_text, fill=_TEXT, font=minute_font)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def card_from_fixture_row(
    spec_id: str,
    watch: dict,
    fixture_row: dict,
    live_odd: Optional[float],
) -> MatchCardData:
    teams = fixture_row.get("teams", {})
    goals = fixture_row.get("goals", {})
    status = fixture_row.get("fixture", {}).get("status", {})
    elapsed = status.get("elapsed")
    short = status.get("short", "")
    minute: Optional[str] = None
    if short == "HT":
        minute = "HT"
    elif elapsed is not None:
        minute = f"{elapsed}'"

    return MatchCardData(
        league=watch.get("league", ""),
        country=watch.get("country", ""),
        home=watch.get("home", ""),
        away=watch.get("away", ""),
        home_score=int(goals.get("home") or 0),
        away_score=int(goals.get("away") or 0),
        minute=minute,
        strategy_id=spec_id,
        live_odd=live_odd,
        home_logo_url=teams.get("home", {}).get("logo") or watch.get("home_logo"),
        away_logo_url=teams.get("away", {}).get("logo") or watch.get("away_logo"),
    )


def save_preview_samples(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    samples = [
        MatchCardData(
            league="Premier League",
            country="England",
            home="Arsenal",
            away="Chelsea",
            home_score=1,
            away_score=1,
            minute="67'",
            strategy_id="o25",
            live_odd=1.52,
            home_logo_url="https://media.api-sports.io/football/teams/42.png",
            away_logo_url="https://media.api-sports.io/football/teams/49.png",
        ),
        MatchCardData(
            league="USL League Two",
            country="USA",
            home="AC Connecticut",
            away="Vermont Green",
            home_score=0,
            away_score=0,
            minute="12'",
            strategy_id="fh05",
            live_odd=1.41,
            home_logo_url="https://media.api-sports.io/football/teams/4031.png",
            away_logo_url="https://media.api-sports.io/football/teams/18912.png",
        ),
    ]
    paths: list[Path] = []
    for i, sample in enumerate(samples, 1):
        png = render_match_card(sample)
        path = out_dir / f"preview_card_{i}_{sample.strategy_id}.png"
        path.write_bytes(png)
        paths.append(path)
    return paths
