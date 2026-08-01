from __future__ import annotations

from pathlib import Path

from config import WELCOME_IMAGE_PATH

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
WELCOME_PNG = ASSETS_DIR / "welcome.png"


def ensure_welcome_banner() -> Path:
    """Return path to welcome.png, generating it if missing."""
    if WELCOME_IMAGE_PATH:
        custom = Path(WELCOME_IMAGE_PATH)
        if custom.is_file():
            return custom
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    if WELCOME_PNG.is_file():
        return WELCOME_PNG
    _generate(WELCOME_PNG)
    return WELCOME_PNG


def _generate(path: Path) -> None:
    from PIL import Image, ImageDraw, ImageFont

    w, h = 1200, 630
    img = Image.new("RGB", (w, h), "#0a0e17")
    draw = ImageDraw.Draw(img)

    for y in range(h):
        t = y / h
        r = int(10 + t * 8)
        g = int(14 + t * 20)
        b = int(23 + t * 40)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Gold accent bars
    draw.rectangle([0, h - 8, w, h], fill="#fbbf24")
    draw.rounded_rectangle([60, 80, 1140, 550], radius=32, outline="#fbbf24", width=4)

    try:
        title_font = ImageFont.truetype("arial.ttf", 72)
        sub_font = ImageFont.truetype("arial.ttf", 36)
        small_font = ImageFont.truetype("arial.ttf", 28)
    except OSError:
        title_font = ImageFont.load_default()
        sub_font = title_font
        small_font = title_font

    draw.text((100, 140), "RankWagers", fill="#ffffff", font=title_font)
    draw.text((100, 240), "VIP ACCESS", fill="#fbbf24", font=title_font)
    draw.text(
        (100, 360),
        "Open App  ·  Free VIP  ·  Partner bonuses",
        fill="#94a3b8",
        font=sub_font,
    )
    draw.text(
        (100, 430),
        "Daily picks · Live stats · Verified affiliates",
        fill="#64748b",
        font=small_font,
    )

    # RW badge
    draw.rounded_rectangle([960, 120, 1100, 260], radius=24, fill="#fbbf24")
    draw.text((980, 165), "RW", fill="#0a0e17", font=title_font)

    img.save(path, format="PNG", optimize=True)
