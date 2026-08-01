"""Live monitoring — fh05 and o25 strategies."""

from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Callable, Optional
from api.football import fetch_fixture_by_id, fetch_live_fixtures, fetch_live_odds_for_fixture
from bot.card import card_from_fixture_row, render_match_card, render_win_card
from bot.client import send_message, send_photo
from bot.digest_card import render_digest_card
from bot.messages import (
    format_signal_caption_fh05,
    format_signal_caption_o25,
    format_starts_in,
    format_upcoming_matches_digest,
    format_win_caption,
)
from config import (
    DIGEST_AS_PHOTO,
    LIVE_SIGNAL_AS_PHOTO,
    REMINDER_LOOKAHEAD_MINUTES,
    REMINDER_WINDOW_MAX,
    REMINDER_WINDOW_MIN,
    TELEGRAM_PLAY_BUTTON_TEXT,
    WIN_REPLY_AS_PHOTO,
    WIN_REPLY_DELAY_MAX,
    WIN_REPLY_DELAY_MIN,
)
from engine.strategies import ALL_STRATEGIES, StrategySpec
from storage import (
    load_signals,
    load_watchlist,
    save_watchlist,
    upsert_signal,
    upsert_watchlist_item,
    write_upcoming_batch,
)

_LIVE_STATUSES = {"1H", "HT", "2H", "ET", "BT", "P", "INT"}
_TERMINAL = {"FT", "AET", "PEN", "CANC", "PST", "ABD", "AWD", "WO"}

_CAPTION_FORMATTERS: dict[str, Callable] = {
    "fh05": format_signal_caption_fh05,
    "o25": format_signal_caption_o25,
}


def _goals_total(goals: dict) -> int:
    return int(goals.get("home") or 0) + int(goals.get("away") or 0)


def _ht_total(score: dict) -> tuple[Optional[int], Optional[int]]:
    ht = score.get("halftime") or {}
    h, a = ht.get("home"), ht.get("away")
    if h is None or a is None:
        return None, None
    return int(h), int(a)


def _fixture_row_by_id(live_rows: list[dict], fixture_id: int) -> dict | None:
    for f in live_rows:
        if f.get("fixture", {}).get("id") == fixture_id:
            return f
    return None


def _minutes_until_kickoff(match_time_str: str) -> Optional[float]:
    if not match_time_str:
        return None
    try:
        kickoff = datetime.fromisoformat(match_time_str.replace("Z", "+00:00"))
        if kickoff.tzinfo is None:
            kickoff = kickoff.replace(tzinfo=timezone.utc)
        return (kickoff - datetime.now(timezone.utc)).total_seconds() / 60
    except ValueError:
        return None


def _live_minute(fixture_row: dict) -> Optional[str]:
    status = fixture_row.get("fixture", {}).get("status", {})
    short = status.get("short", "")
    elapsed = status.get("elapsed")
    if short == "HT":
        return "HT"
    if elapsed is not None:
        return f"{elapsed}'"
    return None


def _reminder_already_sent(watch: dict) -> bool:
    return bool(watch.get("reminder_digest_sent") or watch.get("reminder_1h_sent"))


def _collect_digest_candidates(*, ignore_sent: bool = False) -> list[dict]:
    merged: dict[int, dict] = {}

    for spec in ALL_STRATEGIES:
        watchlist = load_watchlist(spec.id)
        for key, watch in watchlist.items():
            if watch.get("status") not in ("watching", None):
                continue
            if not ignore_sent and _reminder_already_sent(watch):
                continue

            match_time = watch.get("match_time", "")
            minutes_left = _minutes_until_kickoff(match_time)
            if minutes_left is None or minutes_left <= 0 or minutes_left > REMINDER_LOOKAHEAD_MINUTES:
                continue

            fid = int(key)
            if fid not in merged:
                merged[fid] = {
                    "fixture_id": fid,
                    "match_time": match_time,
                    "minutes_left": minutes_left,
                    "league": watch.get("league", ""),
                    "country": watch.get("country", ""),
                    "home": watch.get("home", ""),
                    "away": watch.get("away", ""),
                    "home_logo": watch.get("home_logo"),
                    "away_logo": watch.get("away_logo"),
                    "strategies": [],
                }
            merged[fid]["strategies"].append(spec.id)
            merged[fid]["minutes_left"] = min(merged[fid]["minutes_left"], minutes_left)
            if not merged[fid].get("home_logo"):
                merged[fid]["home_logo"] = watch.get("home_logo")
            if not merged[fid].get("away_logo"):
                merged[fid]["away_logo"] = watch.get("away_logo")

    entries = list(merged.values())
    entries.sort(key=lambda e: e["match_time"])
    return entries


def _should_send_digest(entries: list[dict]) -> bool:
    if not entries:
        return False
    for entry in entries:
        mins = entry["minutes_left"]
        if REMINDER_WINDOW_MIN <= mins <= REMINDER_WINDOW_MAX:
            return True
        if mins < REMINDER_WINDOW_MIN:
            return True
    return False


async def _send_digest_message(entries: list[dict]) -> Optional[int]:
    lookahead_hours = REMINDER_LOOKAHEAD_MINUTES / 60
    text = format_upcoming_matches_digest(entries, lookahead_hours=lookahead_hours)
    message_id: Optional[int] = None

    if DIGEST_AS_PHOTO and entries:
        try:
            png = render_digest_card(entries, lookahead_hours=lookahead_hours)
            message_id = await send_photo(
                png,
                text[:1024],
                with_play_button=True,
                play_button_text=TELEGRAM_PLAY_BUTTON_TEXT,
            )
        except Exception as exc:
            print(f"[Monitor] Digest card failed, text fallback: {exc}")

    if message_id is None:
        message_id = await send_message(
            text,
            with_play_button=True,
            play_button_text=TELEGRAM_PLAY_BUTTON_TEXT,
        )
    return message_id


async def _try_send_reminder_digest() -> None:
    entries = _collect_digest_candidates()
    if not _should_send_digest(entries):
        return

    message_id = await _send_digest_message(entries)
    if message_id is None:
        return

    now_iso = datetime.now(timezone.utc).isoformat()
    for entry in entries:
        fid = entry["fixture_id"]
        patch = {
            "reminder_digest_sent": True,
            "reminder_digest_at": now_iso,
            "reminder_digest_message_id": message_id,
        }
        for sid in entry["strategies"]:
            upsert_watchlist_item(sid, fid, patch)

    kickoffs = ", ".join(
        f"{format_starts_in(e['minutes_left'])} {e['home']}-{e['away']}" for e in entries
    )
    print(f"[Monitor] DIGEST ({len(entries)} matches) | msg_id={message_id} | {kickoffs}")
    write_upcoming_batch(entries)


def _live_trigger_ok(spec: StrategySpec, fixture_row: dict, live_odds: dict) -> bool:
    status = fixture_row.get("fixture", {}).get("status", {}).get("short", "")
    goals = fixture_row.get("goals", {})
    home_g = int(goals.get("home") or 0)
    away_g = int(goals.get("away") or 0)
    live_val = live_odds.get(spec.live_field)

    if live_val is None or live_val < spec.live_min:
        return False

    if spec.id == "fh05":
        return status == "1H" and home_g == 0 and away_g == 0

    if spec.id == "o25":
        return status in _LIVE_STATUSES

    return False


async def _try_send_signal(
    spec: StrategySpec, fixture_id: int, watch: dict, fixture_row: dict
) -> None:
    live = await fetch_live_odds_for_fixture(fixture_id)
    if not live.get("supported"):
        return
    if not _live_trigger_ok(spec, fixture_row, live):
        return

    goals = fixture_row.get("goals", {})
    home_score = int(goals.get("home") or 0)
    away_score = int(goals.get("away") or 0)
    minute = _live_minute(fixture_row)
    live_val = live.get(spec.live_field)

    caption_fn = _CAPTION_FORMATTERS[spec.id]
    caption = caption_fn(
        watch.get("league", ""),
        watch.get("country", ""),
        watch.get("home", ""),
        watch.get("away", ""),
        minute=minute,
        home_score=home_score,
        away_score=away_score,
        live_odd=live_val,
    )

    message_id: Optional[int] = None
    if LIVE_SIGNAL_AS_PHOTO:
        try:
            card_data = card_from_fixture_row(spec.id, watch, fixture_row, live_val)
            png = render_match_card(card_data)
            message_id = await send_photo(png, caption, with_play_button=True)
        except Exception as exc:
            print(f"[Monitor:{spec.id}] Card render failed, text fallback: {exc}")

    if message_id is None:
        message_id = await send_message(caption, with_play_button=True)

    if message_id is None:
        return

    upsert_signal(
        spec.id,
        fixture_id,
        {
            "fixture_id": fixture_id,
            "strategy": spec.id,
            "message_id": message_id,
            "signaled_at": datetime.now(timezone.utc).isoformat(),
            f"signal_{spec.live_field}": live_val,
            "status": "pending_result",
            "home": watch.get("home"),
            "away": watch.get("away"),
            "league": watch.get("league"),
            "country": watch.get("country"),
            "home_logo": watch.get("home_logo"),
            "away_logo": watch.get("away_logo"),
        },
    )
    print(
        f"[Monitor:{spec.id}] SIGNAL {watch.get('home')} vs {watch.get('away')} "
        f"| live {spec.live_field}={live_val} | msg_id={message_id}"
    )


async def _process_result_fh05(fixture_id: int, signal: dict, fixture_row: dict | None) -> None:
    status = signal.get("status", "")
    if status in ("won", "lost"):
        return
    if fixture_row is None:
        fixture_row = await fetch_fixture_by_id(fixture_id)
    if not fixture_row:
        return

    fix_status = fixture_row.get("fixture", {}).get("status", {}).get("short", "")
    total_goals = _goals_total(fixture_row.get("goals", {}))
    ht_home, ht_away = _ht_total(fixture_row.get("score", {}))
    fh_goal_confirmed = False

    if fix_status == "1H" and total_goals > 0:
        fh_goal_confirmed = True
    elif fix_status in ("HT", "2H", "ET", "BT", "P") and ht_home is not None and ht_away is not None:
        if ht_home + ht_away >= 1:
            fh_goal_confirmed = True
        elif fix_status == "HT" and ht_home == 0 and ht_away == 0:
            upsert_signal("fh05", fixture_id, {"status": "lost", "lost_at": datetime.now(timezone.utc).isoformat(), "reason": "HT 0-0"})
            return
        elif fix_status == "2H" and ht_home == 0 and ht_away == 0:
            upsert_signal("fh05", fixture_id, {"status": "lost", "lost_at": datetime.now(timezone.utc).isoformat(), "reason": "HT 0-0"})
            return

    if not fh_goal_confirmed:
        if fix_status in _TERMINAL:
            upsert_signal("fh05", fixture_id, {"status": "lost", "lost_at": datetime.now(timezone.utc).isoformat(), "reason": "no 1H goal"})
        return

    await _schedule_or_send_win("fh05", fixture_id, signal, fixture_row)


async def _process_result_o25(fixture_id: int, signal: dict, fixture_row: dict | None) -> None:
    status = signal.get("status", "")
    if status in ("won", "lost"):
        return
    if fixture_row is None:
        fixture_row = await fetch_fixture_by_id(fixture_id)
    if not fixture_row:
        return

    fix_status = fixture_row.get("fixture", {}).get("status", {}).get("short", "")
    total_goals = _goals_total(fixture_row.get("goals", {}))

    if total_goals >= 3:
        await _schedule_or_send_win("o25", fixture_id, signal, fixture_row)
        return

    if fix_status in _TERMINAL:
        upsert_signal("o25", fixture_id, {"status": "lost", "lost_at": datetime.now(timezone.utc).isoformat(), "reason": "under 3 goals"})


def _win_snapshot_from_fixture(fixture_row: dict | None) -> dict:
    if not fixture_row:
        return {}
    goals = fixture_row.get("goals", {})
    minute = _live_minute(fixture_row)
    patch: dict = {
        "win_home_score": int(goals.get("home") or 0),
        "win_away_score": int(goals.get("away") or 0),
    }
    if minute:
        patch["win_minute"] = minute
    return patch


async def _schedule_or_send_win(
    strategy_id: str,
    fixture_id: int,
    signal: dict,
    fixture_row: dict | None = None,
) -> None:
    status = signal.get("status", "")
    if status == "pending_result":
        delay = random.randint(WIN_REPLY_DELAY_MIN, WIN_REPLY_DELAY_MAX)
        if fixture_row is None:
            fixture_row = await fetch_fixture_by_id(fixture_id)
        upsert_signal(
            strategy_id,
            fixture_id,
            {
                "status": "win_scheduled",
                "goal_detected_at": datetime.now(timezone.utc).isoformat(),
                "win_reply_at": datetime.now(timezone.utc).timestamp() + delay,
                **_win_snapshot_from_fixture(fixture_row),
            },
        )
        print(f"[Monitor:{strategy_id}] Win detected — reply in {delay}s | {signal.get('home')} vs {signal.get('away')}")
        return

    if status == "win_scheduled":
        fire_at = signal.get("win_reply_at")
        if fire_at and datetime.now(timezone.utc).timestamp() >= float(fire_at):
            message_id = signal.get("message_id")
            fixture_row = await fetch_fixture_by_id(fixture_id)
            watch = {
                "home": signal.get("home"),
                "away": signal.get("away"),
                "league": signal.get("league", ""),
                "country": signal.get("country", ""),
                "home_logo": signal.get("home_logo"),
                "away_logo": signal.get("away_logo"),
            }
            caption = format_win_caption(strategy_id, signal, fixture_row)
            reply_id: Optional[int] = None

            if WIN_REPLY_AS_PHOTO and fixture_row:
                try:
                    live_val = signal.get(f"signal_{strategy_id}")
                    card_data = card_from_fixture_row(
                        strategy_id,
                        watch,
                        fixture_row,
                        float(live_val) if live_val is not None else None,
                    )
                    png = render_win_card(card_data)
                    reply_id = await send_photo(
                        png,
                        caption,
                        reply_to_message_id=message_id,
                        with_play_button=True,
                    )
                except Exception as exc:
                    print(f"[Monitor:{strategy_id}] Win card failed, text fallback: {exc}")

            if reply_id is None:
                reply_id = await send_message(
                    caption,
                    reply_to_message_id=message_id,
                    with_play_button=True,
                )
            if reply_id is not None:
                upsert_signal(
                    strategy_id,
                    fixture_id,
                    {"status": "won", "won_at": datetime.now(timezone.utc).isoformat()},
                )
                print(f"[Monitor:{strategy_id}] WIN reply | {signal.get('home')} vs {signal.get('away')}")


async def _cleanup_finished_watchlist(spec: StrategySpec, live_rows: list[dict]) -> None:
    watchlist = load_watchlist(spec.id)
    changed = False
    for key, item in list(watchlist.items()):
        row = _fixture_row_by_id(live_rows, int(key))
        if row and row.get("fixture", {}).get("status", {}).get("short", "") in _TERMINAL:
            item["status"] = "finished"
            changed = True
    if changed:
        save_watchlist(spec.id, watchlist)


async def _run_strategy_cycle(spec: StrategySpec, live_rows: list[dict]) -> None:
    watchlist = load_watchlist(spec.id)
    signals = load_signals(spec.id)
    if not watchlist and not signals:
        return

    for key, watch in watchlist.items():
        if watch.get("status") not in ("watching", None):
            continue
        fid = int(key)
        if str(fid) in signals:
            continue
        row = _fixture_row_by_id(live_rows, fid)
        if row:
            await _try_send_signal(spec, fid, watch, row)

    for key, signal in list(signals.items()):
        fid = int(key)
        if signal.get("status") in ("won", "lost"):
            continue
        row = _fixture_row_by_id(live_rows, fid)
        if spec.id == "fh05":
            await _process_result_fh05(fid, signal, row)
        else:
            await _process_result_o25(fid, signal, row)

    await _cleanup_finished_watchlist(spec, live_rows)


async def send_reminder_digest_test(*, mark_sent: bool = False) -> int:
    entries = _collect_digest_candidates(ignore_sent=True)
    if not entries:
        print("[Monitor] Digest test: no matches in the next 2 hours.")
        return 0

    lookahead_hours = REMINDER_LOOKAHEAD_MINUTES / 60
    message_id = await _send_digest_message(entries)
    if message_id is None:
        print("[Monitor] Digest test: send failed.")
        return 0

    if mark_sent:
        now_iso = datetime.now(timezone.utc).isoformat()
        for entry in entries:
            fid = entry["fixture_id"]
            patch = {
                "reminder_digest_sent": True,
                "reminder_digest_at": now_iso,
                "reminder_digest_message_id": message_id,
            }
            for sid in entry["strategies"]:
                upsert_watchlist_item(sid, fid, patch)

    kickoffs = ", ".join(
        f"{format_starts_in(e['minutes_left'])} {e['home']}-{e['away']}" for e in entries
    )
    print(f"[Monitor] TEST DIGEST ({len(entries)} matches) | msg_id={message_id} | {kickoffs}")
    return len(entries)


async def run_monitor_cycle() -> None:
    live_rows = await fetch_live_fixtures()
    for spec in ALL_STRATEGIES:
        await _run_strategy_cycle(spec, live_rows)
    await _try_send_reminder_digest()
