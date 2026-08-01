"""API-Football client — fixtures, prematch odds, live odds."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from config import API_FOOTBALL_BASE, API_FOOTBALL_KEY, ODDS_REQUEST_DELAY, TIMEZONE

_live_odds_cache: dict[str, Any] = {"data": [], "fetched_at": None}
_live_fixtures_cache: dict[str, Any] = {"data": [], "fetched_at": None}


async def _get(endpoint: str, params: dict | None = None, timeout: float = 20.0) -> dict:
    headers = {"x-apisports-key": API_FOOTBALL_KEY}
    url = f"{API_FOOTBALL_BASE}/{endpoint}"
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url, headers=headers, params=params or {})
        if resp.status_code == 200:
            return resp.json()
        print(f"[API-Football] HTTP {resp.status_code} {endpoint} params={params}")
        return {"response": []}


async def fetch_fixtures_by_date(date_str: str) -> list[dict]:
    data = await _get(
        "fixtures",
        {"date": date_str, "timezone": TIMEZONE},
    )
    return data.get("response", []) or []


async def fetch_live_fixtures(ttl_seconds: int = 25) -> list[dict]:
    now = datetime.now(timezone.utc)
    cached_at = _live_fixtures_cache.get("fetched_at")
    if cached_at and (now - cached_at).total_seconds() < ttl_seconds:
        return _live_fixtures_cache["data"]

    data = await _get("fixtures", {"live": "all"})
    rows = data.get("response", []) or []
    _live_fixtures_cache["data"] = rows
    _live_fixtures_cache["fetched_at"] = now
    return rows


async def fetch_fixture_by_id(fixture_id: int) -> Optional[dict]:
    data = await _get("fixtures", {"id": fixture_id})
    rows = data.get("response", []) or []
    return rows[0] if rows else None


async def fetch_prematch_odds(fixture_id: int) -> dict[str, Optional[float]]:
    """Prematch 1st-half over 0.5 and match over 2.5 odds."""
    data = await _get("odds", {"fixture": fixture_id})
    rows = data.get("response", []) or []
    return parse_prematch_odds(rows)


def parse_prematch_odds(odds_data: list) -> dict[str, Optional[float]]:
    result: dict[str, Optional[float]] = {"fh05": None, "o25": None}
    if not odds_data:
        return result

    for bookmaker_data in odds_data:
        for bookmaker in bookmaker_data.get("bookmakers", []):
            for bet in bookmaker.get("bets", []):
                bet_name = bet.get("name", "").lower()
                values = bet.get("values", [])

                if "first half" in bet_name and "over" in bet_name:
                    for v in values:
                        value_str = str(v.get("value", "")).lower()
                        if "over" in value_str and "0.5" in value_str:
                            try:
                                result["fh05"] = float(v.get("odd", 0))
                            except (TypeError, ValueError):
                                pass

                elif ("over/under" in bet_name or "goals over" in bet_name) and "half" not in bet_name:
                    for v in values:
                        value_str = str(v.get("value", "")).lower()
                        if "over" in value_str and "2.5" in value_str:
                            try:
                                result["o25"] = float(v.get("odd", 0))
                            except (TypeError, ValueError):
                                pass

            if result["fh05"] is not None and result["o25"] is not None:
                return result

    return result


async def fetch_live_odds_bulk(ttl_seconds: int = 25) -> list[dict]:
    now = datetime.now(timezone.utc)
    cached_at = _live_odds_cache.get("fetched_at")
    if cached_at and (now - cached_at).total_seconds() < ttl_seconds:
        return _live_odds_cache["data"]

    data = await _get("odds/live", {})
    rows = data.get("response", []) or []
    _live_odds_cache["data"] = rows
    _live_odds_cache["fetched_at"] = now
    return rows


async def fetch_live_odds_for_fixture(fixture_id: int) -> dict[str, Any]:
    """Live 1st-half over 0.5 and match over 2.5 odds."""
    bulk = await fetch_live_odds_bulk()
    for item in bulk:
        if item.get("fixture", {}).get("id") == fixture_id:
            parsed = parse_live_odds(item.get("odds", []))
            return {
                "fh05": parsed.get("fh05"),
                "o25": parsed.get("o25"),
                "supported": True,
            }

    data = await _get("odds/live", {"fixture": fixture_id})
    rows = data.get("response", []) or []
    if not rows:
        return {"fh05": None, "o25": None, "supported": False}

    item = rows[0]
    odds_list = item.get("odds", [])
    parsed = parse_live_odds(odds_list)
    return {
        "fh05": parsed.get("fh05"),
        "o25": parsed.get("o25"),
        "supported": True,
    }


def parse_live_odds(odds_list: list) -> dict[str, Optional[float]]:
    result: dict[str, Optional[float]] = {"fh05": None, "o25": None}
    for market in odds_list:
        name = market.get("name", "").lower()
        values = market.get("values", [])

        if ("1st half" in name or "first half" in name) and "over/under" in name:
            for v in values:
                if str(v.get("value", "")).lower() == "over" and str(v.get("handicap", "")) == "0.5":
                    try:
                        result["fh05"] = float(v.get("odd", 0))
                    except (TypeError, ValueError):
                        pass

        elif name in ["match goals", "over/under line"]:
            for v in values:
                if str(v.get("value", "")).lower() == "over" and str(v.get("handicap", "")) == "2.5":
                    try:
                        result["o25"] = float(v.get("odd", 0))
                    except (TypeError, ValueError):
                        pass

    return result


async def throttle_between_odds_requests() -> None:
    if ODDS_REQUEST_DELAY > 0:
        await asyncio.sleep(ODDS_REQUEST_DELAY)
