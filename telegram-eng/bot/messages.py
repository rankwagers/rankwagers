"""Telegram message templates — English."""

from __future__ import annotations

from config import DIGEST_MAX_MATCHES

_COUNTRY_ISO: dict[str, str] = {
    "albania": "AL",
    "argentina": "AR",
    "australia": "AU",
    "austria": "AT",
    "belgium": "BE",
    "brazil": "BR",
    "canada": "CA",
    "chile": "CL",
    "china": "CN",
    "colombia": "CO",
    "croatia": "HR",
    "czech republic": "CZ",
    "czechia": "CZ",
    "denmark": "DK",
    "england": "GB",
    "finland": "FI",
    "france": "FR",
    "germany": "DE",
    "greece": "GR",
    "hungary": "HU",
    "iceland": "IS",
    "ireland": "IE",
    "israel": "IL",
    "italy": "IT",
    "japan": "JP",
    "mexico": "MX",
    "netherlands": "NL",
    "northern ireland": "GB",
    "norway": "NO",
    "poland": "PL",
    "portugal": "PT",
    "romania": "RO",
    "russia": "RU",
    "scotland": "GB",
    "serbia": "RS",
    "spain": "ES",
    "sweden": "SE",
    "switzerland": "CH",
    "turkey": "TR",
    "ukraine": "UA",
    "usa": "US",
    "united states": "US",
    "wales": "GB",
    "europe": "EU",
}


def country_flag(country: str) -> str:
    if not country:
        return "🌍"
    key = country.strip().lower()
    if key in ("world", "international"):
        return "🌍"
    iso = _COUNTRY_ISO.get(key)
    if not iso or len(iso) != 2:
        return "🏳️"
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in iso.upper())


def league_display(league: str, country: str) -> str:
    flag = country_flag(country)
    name = (league or "League").strip()
    return f"{flag} {name}"


_STRATEGY_EXPECTATION: dict[str, str] = {
    "fh05": "1H Goal",
    "o25": "Over 2.5",
}


def format_expectations(strategy_ids: list[str]) -> str:
    parts: list[str] = []
    for sid in ("fh05", "o25"):
        if sid in strategy_ids:
            parts.append(_STRATEGY_EXPECTATION[sid])
    return " · ".join(parts) if parts else "—"


def format_signal_caption_fh05(
    league: str,
    country: str,
    home: str,
    away: str,
    *,
    minute: str | None = None,
    home_score: int = 0,
    away_score: int = 0,
    live_odd: float | None = None,
) -> str:
    clock = f" · {minute}" if minute else ""
    odd_line = f"\n📊 Live odd: {live_odd:.2f}" if live_odd is not None else ""
    return (
        f"🚨 LIVE{clock} · {home_score}-{away_score}\n"
        f"{league_display(league, country)}\n"
        f"⚽ {home} vs {away}\n"
        f"👉 1st Half Over 0.5{odd_line}"
    )


def format_signal_caption_o25(
    league: str,
    country: str,
    home: str,
    away: str,
    *,
    minute: str | None = None,
    home_score: int = 0,
    away_score: int = 0,
    live_odd: float | None = None,
) -> str:
    clock = f" · {minute}" if minute else ""
    odd_line = f"\n📊 Live odd: {live_odd:.2f}" if live_odd is not None else ""
    return (
        f"🚨 LIVE{clock} · {home_score}-{away_score}\n"
        f"{league_display(league, country)}\n"
        f"⚽ {home} vs {away}\n"
        f"👉 Match Over 2.5 Goals{odd_line}"
    )


def _market_line(strategy_id: str) -> str:
    if strategy_id == "o25":
        return "👉 Match Over 2.5 Goals"
    return "👉 1st Half Over 0.5"


def _score_context(fixture_row: dict | None) -> str:
    if not fixture_row:
        return ""
    goals = fixture_row.get("goals", {})
    h = int(goals.get("home") or 0)
    a = int(goals.get("away") or 0)
    status = fixture_row.get("fixture", {}).get("status", {}) or {}
    short = status.get("short", "")
    elapsed = status.get("elapsed")
    part = f" · {h}-{a}"
    if elapsed is not None and short in ("1H", "2H", "HT", "ET", "BT", "P"):
        part += f" · {elapsed}'" if short != "HT" else " · HT"
    elif short:
        part += f" · {short}"
    return part


def format_win_caption(strategy_id: str, signal: dict, fixture_row: dict | None = None) -> str:
    home = signal.get("home", "")
    away = signal.get("away", "")
    score = _score_context(fixture_row)
    return (
        f"✅ WINNER!!\n"
        f"⚽ {home} vs {away}{score}\n"
        f"{_market_line(strategy_id)}\n"
        f"🎉 Congrats to everyone who backed it!"
    )


def format_win_reply() -> str:
    """Legacy short text; prefer format_win_caption with signal + fixture."""
    return "✅ WINNER!!\n🎉 Congrats to everyone who backed it!"


def format_starts_in(minutes_left: float) -> str:
    """Relative kickoff label — timezone-neutral for global audience."""
    if minutes_left < 1:
        return "Starting soon"
    total = int(round(minutes_left))
    if total < 1:
        return "Starting soon"
    if total < 60:
        rounded = max(5, round(total / 5) * 5)
        if rounded >= 60:
            return "In ~1 hour"
        return f"In ~{rounded} min"
    hours = total // 60
    mins = total % 60
    if mins < 8:
        return "In ~1 hour" if hours == 1 else f"In ~{hours} hours"
    if hours == 1:
        return f"In ~1h {mins}m"
    return f"In ~{hours}h {mins}m"


def format_upcoming_matches_digest(
    entries: list[dict],
    lookahead_hours: float = 2.0,
    *,
    max_shown: int | None = None,
) -> str:
    """Compact upcoming digest — two lines per match."""
    cap = max_shown if max_shown is not None else DIGEST_MAX_MATCHES
    hours_label = int(lookahead_hours) if lookahead_hours == int(lookahead_hours) else lookahead_hours
    total = len(entries)
    lines = [
        f"📋 Upcoming — {total} match{'es' if total != 1 else ''} in the next {hours_label} hour"
        + ("s" if hours_label != 1 else ""),
        "",
    ]

    for entry in entries[:cap]:
        flag = country_flag(entry.get("country", ""))
        mins = entry.get("minutes_left")
        when = format_starts_in(float(mins)) if mins is not None else "Soon"
        lines.append(f"⏳ {when} · {format_expectations(entry['strategies'])}")
        lines.append(f"{flag} {entry['home']} - {entry['away']}")

    hidden = total - min(total, cap)
    if hidden > 0:
        lines.append("")
        lines.append(f"… +{hidden} more match{'es' if hidden != 1 else ''}")

    return "\n".join(lines).rstrip()
