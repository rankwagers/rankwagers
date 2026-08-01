import json
import re
import shutil
import threading
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import DATA_DIR, SIGNALS_PATH, WATCHLIST_PATH

_lock = threading.Lock()
_migrated = False

UPCOMING_BATCH_PATH = DATA_DIR / "upcoming_batch.json"


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _migrate_legacy_files() -> None:
    global _migrated
    if _migrated:
        return
    _migrated = True
    _ensure_data_dir()
    legacy_wl = WATCHLIST_PATH
    legacy_sig = SIGNALS_PATH
    fh05_wl = watchlist_path("fh05")
    fh05_sig = signals_path("fh05")
    if legacy_wl.exists() and not fh05_wl.exists():
        shutil.copy(legacy_wl, fh05_wl)
    if legacy_sig.exists() and not fh05_sig.exists():
        shutil.copy(legacy_sig, fh05_sig)


def watchlist_path(strategy_id: str) -> Path:
    return DATA_DIR / f"watchlist_{strategy_id}.json"


def signals_path(strategy_id: str) -> Path:
    return DATA_DIR / f"signals_{strategy_id}.json"


def _load(path: Path) -> dict[str, Any]:
    _ensure_data_dir()
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return {str(k): v for k, v in data.items()}
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def _save(path: Path, data: dict[str, Any]) -> None:
    _ensure_data_dir()
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


def load_watchlist(strategy_id: str) -> dict[str, Any]:
    _migrate_legacy_files()
    with _lock:
        return _load(watchlist_path(strategy_id))


def save_watchlist(strategy_id: str, data: dict[str, Any]) -> None:
    with _lock:
        _save(watchlist_path(strategy_id), data)


def load_signals(strategy_id: str) -> dict[str, Any]:
    _migrate_legacy_files()
    with _lock:
        return _load(signals_path(strategy_id))


def save_signals(strategy_id: str, data: dict[str, Any]) -> None:
    with _lock:
        _save(signals_path(strategy_id), data)


def upsert_watchlist_item(strategy_id: str, fixture_id: int, item: dict[str, Any]) -> None:
    data = load_watchlist(strategy_id)
    key = str(fixture_id)
    existing = data.get(key, {})
    existing.update(item)
    data[key] = existing
    save_watchlist(strategy_id, data)


def upsert_signal(strategy_id: str, fixture_id: int, item: dict[str, Any]) -> None:
    data = load_signals(strategy_id)
    key = str(fixture_id)
    existing = data.get(key, {})
    existing.update(item)
    data[key] = existing
    save_signals(strategy_id, data)


def _norm_team(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def upcoming_merge_key(home: str, away: str, kickoff_iso: str) -> str:
    try:
        kickoff = datetime.fromisoformat(kickoff_iso.replace("Z", "+00:00"))
        if kickoff.tzinfo is None:
            kickoff = kickoff.replace(tzinfo=timezone.utc)
        t = int(kickoff.timestamp() * 1000)
    except ValueError:
        t = 0
    bucket = t // 300_000
    return f"{_norm_team(home)}|{_norm_team(away)}|{bucket}"


def public_upcoming_id(home: str, away: str, match_time: str) -> str:
    return f"up-{upcoming_merge_key(home, away, match_time)}"


def upcoming_batch_key_utc() -> str:
    now = datetime.now(timezone.utc)
    slot = (now.hour // 2) * 2
    return f"{now.year:04d}-{now.month:02d}-{now.day:02d}T{slot:02d}"


def write_upcoming_batch(entries: list[dict[str, Any]]) -> None:
    if not entries:
        return
    sorted_entries = sorted(entries, key=lambda e: e.get("match_time") or "")
    first = sorted_entries[0]
    home = str(first.get("home") or "")
    away = str(first.get("away") or "")
    match_time = str(first.get("match_time") or "")
    featured_id = public_upcoming_id(home, away, match_time) if home and away and match_time else None
    payload = {
        "batchKey": upcoming_batch_key_utc(),
        "publishedAt": datetime.now(timezone.utc).isoformat(),
        "featuredId": featured_id,
        "fixtureIds": [int(e["fixture_id"]) for e in sorted_entries if e.get("fixture_id")],
    }
    with _lock:
        _save(UPCOMING_BATCH_PATH, payload)


# Backward compatibility (legacy imports)
def load_watchlist_legacy() -> dict[str, Any]:
    return load_watchlist("fh05")


def load_signals_legacy() -> dict[str, Any]:
    return load_signals("fh05")
