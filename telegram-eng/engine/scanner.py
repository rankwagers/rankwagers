"""Hourly fixture scan — fh05 and o25 strategies."""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from api.football import fetch_fixtures_by_date, fetch_prematch_odds, throttle_between_odds_requests
from config import PREMATCH_FH05_MAX, PREMATCH_O25_MAX, TIMEZONE
from engine.strategies import ALL_STRATEGIES, StrategySpec
from storage import load_watchlist, upsert_watchlist_item

PROGRESS_EVERY = 10


def format_match_time(match_time: str, tz: ZoneInfo) -> str:
    if not match_time:
        return "—"
    try:
        dt = datetime.fromisoformat(match_time.replace("Z", "+00:00"))
        return dt.astimezone(tz).strftime("%d.%m %H:%M")
    except ValueError:
        return match_time[:16].replace("T", " ")


def print_watchlist_summary(title: str | None = None) -> int:
    tz = ZoneInfo(TIMEZONE)
    total = 0
    for spec in ALL_STRATEGIES:
        watchlist = load_watchlist(spec.id)
        active = [
            (k, v)
            for k, v in watchlist.items()
            if v.get("status", "watching") in ("watching", None)
        ]
        active.sort(key=lambda x: x[1].get("match_time", ""))
        header = title or f"Watchlist [{spec.id.upper()}]"
        print(f"\n[Scanner] {header} — {spec.label} ({len(active)} matches):")
        if not active:
            print("  (empty)")
            continue
        for i, (_key, m) in enumerate(active, 1):
            when = format_match_time(m.get("match_time", ""), tz)
            league = m.get("league", "")
            country = m.get("country", "")
            league_line = f"{league} ({country})" if country else league
            odds = m.get(spec.prematch_field, "?")
            print(f"  {i:2}. {when} | {league_line} | {m.get('home')} vs {m.get('away')} | {spec.prematch_field}={odds}")
        total += len(active)
    print()
    return total


def _qualifies(spec: StrategySpec, odds: dict) -> bool:
    val = odds.get(spec.prematch_field)
    return val is not None and val <= spec.prematch_max


async def run_scan() -> dict:
    tz = ZoneInfo(TIMEZONE)
    today = datetime.now(tz).date()
    dates = [today.isoformat(), (today + timedelta(days=1)).isoformat()]

    watchlists = {spec.id: load_watchlist(spec.id) for spec in ALL_STRATEGIES}
    stats_by_strategy: dict[str, dict] = {
        spec.id: {"added": 0, "updated": 0, "matched": 0} for spec in ALL_STRATEGIES
    }
    matched_rows: dict[str, list] = {spec.id: [] for spec in ALL_STRATEGIES}

    pending: list[tuple[str, dict]] = []
    for date_str in dates:
        print(f"[Scanner] Fetching fixtures: {date_str}...")
        fixtures = await fetch_fixtures_by_date(date_str)
        ns_count = 0
        for f in fixtures:
            fixture_info = f.get("fixture", {})
            fid = fixture_info.get("id")
            status = fixture_info.get("status", {}).get("short", "")
            if fid and status == "NS":
                pending.append((date_str, f))
                ns_count += 1
        print(f"[Scanner] {date_str}: {len(fixtures)} fixtures, {ns_count} not started (NS)")

    total = len(pending)
    print(
        f"[Scanner] {total} fixtures to scan | "
        f"1H O0.5≤{PREMATCH_FH05_MAX} | Match O2.5≤{PREMATCH_O25_MAX}\n"
    )

    for idx, (_date_str, f) in enumerate(pending, 1):
        fixture_info = f.get("fixture", {})
        fid = fixture_info.get("id")
        teams = f.get("teams", {})
        home = teams.get("home", {}).get("name", "")
        away = teams.get("away", {}).get("name", "")
        home_logo = teams.get("home", {}).get("logo")
        away_logo = teams.get("away", {}).get("logo")

        if idx == 1 or idx == total or idx % PROGRESS_EVERY == 0:
            print(f"[Scanner] {idx}/{total} scanning — {home} vs {away}")

        odds = await fetch_prematch_odds(fid)
        await throttle_between_odds_requests()

        if not any(_qualifies(spec, odds) for spec in ALL_STRATEGIES):
            continue

        league = f.get("league", {}).get("name", "")
        country = f.get("league", {}).get("country", "")
        match_time = fixture_info.get("date", "")

        for spec in ALL_STRATEGIES:
            if not _qualifies(spec, odds):
                continue

            key = str(fid)
            wl = watchlists[spec.id]
            is_new = key not in wl
            prematch_val = odds.get(spec.prematch_field)
            entry = {
                "fixture_id": fid,
                "strategy": spec.id,
                "home": home,
                "away": away,
                "home_logo": home_logo,
                "away_logo": away_logo,
                "league": league,
                "country": country,
                "match_time": match_time,
                spec.prematch_field: prematch_val,
                "status": "watching",
                "updated_at": datetime.now(tz).isoformat(),
            }
            upsert_watchlist_item(spec.id, fid, entry)
            wl[key] = entry
            matched_rows[spec.id].append(entry)
            stats_by_strategy[spec.id]["matched"] += 1

            tag = "ADDED" if is_new else "updated"
            if is_new:
                stats_by_strategy[spec.id]["added"] += 1
            else:
                stats_by_strategy[spec.id]["updated"] += 1
            print(
                f"[Scanner]   {tag} [{spec.id.upper()}] "
                f"{spec.prematch_field}={prematch_val} | {home} vs {away}"
            )

    result = {
        "checked": total,
        "strategies": stats_by_strategy,
        "watchlist_sizes": {spec.id: len(load_watchlist(spec.id)) for spec in ALL_STRATEGIES},
    }
    print(f"\n[Scanner] Done: {result}")

    for spec in ALL_STRATEGIES:
        rows = matched_rows[spec.id]
        if not rows:
            continue
        print(f"[Scanner] This scan [{spec.id.upper()}]: {len(rows)} matches")
        rows.sort(key=lambda x: x.get("match_time", ""))
        for i, m in enumerate(rows, 1):
            when = format_match_time(m.get("match_time", ""), tz)
            print(
                f"  {i:2}. {when} | {m.get('league')} | "
                f"{m.get('home')} vs {m.get('away')} | "
                f"{spec.prematch_field}={m.get(spec.prematch_field)}"
            )

    print_watchlist_summary("All watchlists")
    return result
