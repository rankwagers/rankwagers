from __future__ import annotations

import re
from dataclasses import dataclass

from config import PROMO_CODE, SITE_URL


def _emph(text: str) -> str:
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)


@dataclass(frozen=True)
class RegionGuide:
    """English copy tailored to a region (main UI stays English)."""
    headline: str
    min_deposit_line: str
    bonus_hint: str
    local_note: str  # optional extra line (still English)


REGION_GUIDES: dict[str, RegionGuide] = {
    "eu": RegionGuide(
        headline="Europe — EUR-friendly partners",
        min_deposit_line="Typical minimum first deposit: from **€1–€10** (varies by bookmaker).",
        bonus_hint="Welcome offers often up to **€130–€200** on first deposit.",
        local_note="Payment methods: cards, e-wallets & crypto where available.",
    ),
    "us": RegionGuide(
        headline="United States",
        min_deposit_line="Use partners that accept your state; minimum often **$10–$25** equivalent.",
        bonus_hint="Check each site for US-eligible welcome promos.",
        local_note="Availability depends on state law — pick a partner that opens for you.",
    ),
    "ca": RegionGuide(
        headline="Canada",
        min_deposit_line="Typical minimum first deposit: **C$10–C$20**.",
        bonus_hint="100% welcome packages are common on first deposit.",
        local_note="Interac, cards & crypto may be available per operator.",
    ),
    "au": RegionGuide(
        headline="Australia",
        min_deposit_line="Typical minimum first deposit: **A$10–A$20**.",
        bonus_hint="Look for matched deposit or multi-bet welcome offers.",
        local_note="Use our links only — off-link signups won't qualify for VIP.",
    ),
    "uk": RegionGuide(
        headline="United Kingdom",
        min_deposit_line="Typical minimum first deposit: **£5–£10**.",
        bonus_hint="UK welcome offers follow operator terms & BeGambleAware rules.",
        local_note="18+ only. Gamble responsibly.",
    ),
    "br": RegionGuide(
        headline="Brazil",
        min_deposit_line="Typical minimum first deposit: **R$30–R$50** (operator-dependent).",
        bonus_hint="First-deposit bonuses are often shown in **BRL** on the partner page.",
        local_note="Registration pages may be in Portuguese — fields are standard.",
    ),
    "in": RegionGuide(
        headline="India",
        min_deposit_line="Typical minimum first deposit: **₹500–₹1,000** (UPI / wallet / crypto).",
        bonus_hint="Many partners support UPI & fast INR wallets.",
        local_note="Use the exact Mini App link below for tracking.",
    ),
    "ng": RegionGuide(
        headline="Nigeria",
        min_deposit_line="Minimum qualifying deposit: about **₦3,000–₦8,000** (partner-dependent).",
        bonus_hint="Example: **100% up to ₦150,000** on first deposit at top partners.",
        local_note="Pay with bank transfer, card or crypto where listed.",
    ),
    "bd": RegionGuide(
        headline="Bangladesh",
        min_deposit_line="Typical minimum first deposit: **৳500–৳2,000** equivalent.",
        bonus_hint="Mobile wallets & crypto are often supported.",
        local_note="Register only through the buttons below.",
    ),
    "np": RegionGuide(
        headline="Nepal",
        min_deposit_line="Typical minimum first deposit: **NPR 500+** or crypto equivalent.",
        bonus_hint="eSewa / wallets / crypto — depends on operator.",
        local_note="Send your player ID after deposit for VIP review.",
    ),
    "other": RegionGuide(
        headline="International",
        min_deposit_line="Minimum first deposit: usually **€1 / $1** in crypto or **$10** equivalent.",
        bonus_hint="Welcome bonus text is shown on each partner page.",
        local_note="Pick any partner that accepts players from your country.",
    ),
}

DEFAULT_GUIDE = REGION_GUIDES["other"]

# Short suffix on inline bookmaker buttons (English)
BRAND_BUTTON_TAG: dict[str, str] = {
    "1xbet": "100% welcome · top pick",
    "megapari": "Big welcome package",
    "melbet": "Sports + casino",
    "bet-and-you": "Crypto-friendly",
    "betwinner": "Global sportsbook",
    "888starz": "Crypto-first",
    "paripulse": "Modern platform",
    "fansport": "Sports-focused",
    "topbet": "Fast signup",
    "dbbet": "Low min deposit",
    "bizbet": "Wide markets",
    "betroller": "VIP rewards",
    "wepari": "Live betting",
}


def welcome_caption_html() -> str:
    promo = f"\n<b>Promo:</b> <code>{PROMO_CODE}</code>" if PROMO_CODE else ""
    return (
        "<b>Welcome to RankWagers VIP</b> 🔥\n\n"
        "🏆 Premium goal-market picks &amp; live stats\n"
        "📊 ROI tracking with verified partners\n"
        "⚡ <b>FREE VIP</b> after partner signup + deposit\n"
        f"{promo}\n\n"
        "👇 Open the app or tap <b>GET FREE VIP</b>"
    )


def region_prompt_html() -> str:
    return (
        "<b>Where are you from?</b> 🌍\n\n"
        "Pick your region to unlock <b>FREE VIP</b> access.\n"
        "<i>All instructions are in English.</i>"
    )


def rules_html(region_key: str, region_label: str) -> str:
    guide = REGION_GUIDES.get(region_key, DEFAULT_GUIDE)
    promo = f"\n<b>Promo code:</b> <code>{PROMO_CODE}</code>\n" if PROMO_CODE else "\n"
    return (
        "<b>🔥 RULES — GET FREE VIP</b>\n"
        f"{promo}"
        f"<b>{guide.headline}</b> ({region_label})\n\n"
        f"{_emph(guide.min_deposit_line)}\n"
        f"{_emph(guide.bonus_hint)}\n\n"
        "<b>Steps</b>\n"
        "1️⃣ Register via a button below (our referral link)\n"
        "2️⃣ Make a qualifying first deposit\n"
        "3️⃣ Do not Google or bypass the link\n"
        "4️⃣ Tap <b>I registered</b> and submit your player ID\n\n"
        f"<i>{guide.local_note}</i>"
    )


def brand_button_label(slug: str, name: str) -> str:
    tag = BRAND_BUTTON_TAG.get(slug)
    if tag:
        return f"{name} — {tag}"
    return name


def pick_site_html() -> str:
    return (
        "<b>Which site did you register on?</b>\n\n"
        "Select one of our partner bookmakers:"
    )


def player_id_prompt_html(brand_name: str) -> str:
    return (
        f"<b>{brand_name}</b> — enter your <b>player ID</b>\n\n"
        "Send it as a text message (numbers/letters, e.g. <code>234234234</code>)."
    )


def deposit_question_html(brand_name: str, player_id: str) -> str:
    return (
        f"Player ID saved: <code>{player_id}</code>\n\n"
        f"Did you make a <b>qualifying deposit</b> on {brand_name}?"
    )


def application_received_html() -> str:
    return (
        "✅ <b>Application received</b>\n\n"
        "We will review your signup and get back to you as soon as possible.\n"
        "Thank you for choosing RankWagers."
    )


def deposit_required_html(region_key: str | None = None) -> str:
    extra = ""
    if region_key:
        guide = REGION_GUIDES.get(region_key, DEFAULT_GUIDE)
        extra = f"\n\n<i>{_emph(guide.min_deposit_line)}</i>"
    return (
        "❌ <b>Deposit required</b>\n\n"
        "We cannot approve VIP without a qualifying first deposit.\n"
        "Register using a link below, deposit, then tap <b>I registered</b> again."
        f"{extra}"
    )


def invalid_player_id_html() -> str:
    return "Please send a valid player ID (text, max 64 characters)."


def complete_id_first_alert() -> str:
    return "Complete your player ID first (tap I registered)."
