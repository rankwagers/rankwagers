from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import DATA_DIR, VIP_APPLICATIONS_PATH

_LEGACY_JSONL = DATA_DIR / "vip_applications.jsonl"


def _store_path() -> Path:
    if VIP_APPLICATIONS_PATH:
        return Path(VIP_APPLICATIONS_PATH)
    return DATA_DIR / "vip-applications.json"


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    p = _store_path()
    p.parent.mkdir(parents=True, exist_ok=True)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_store() -> dict[str, Any]:
    ensure_data_dir()
    path = _store_path()
    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("applications"), list):
                return data
        except json.JSONDecodeError:
            pass
    return {"applications": []}


def _save_store(data: dict[str, Any]) -> None:
    path = _store_path()
    ensure_data_dir()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _migrate_jsonl_if_needed() -> None:
    if not _LEGACY_JSONL.is_file():
        return
    store = _load_store()
    seen = {
        (
            a.get("telegram_user_id"),
            a.get("player_id"),
            a.get("created_at"),
        )
        for a in store["applications"]
    }
    changed = False
    for line in _LEGACY_JSONL.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = row.get("ts") or _now_iso()
        key = (row.get("telegram_user_id"), row.get("player_id"), ts)
        if key in seen:
            continue
        app_id = row.get("id") or str(uuid.uuid4())
        store["applications"].insert(
            0,
            {
                "id": app_id,
                "telegram_user_id": row.get("telegram_user_id"),
                "username": row.get("username"),
                "region": row.get("region", ""),
                "brand_slug": row.get("brand_slug", ""),
                "brand_name": row.get("brand_name", ""),
                "player_id": row.get("player_id", ""),
                "deposit_claimed": bool(row.get("deposit_claimed")),
                "status": row.get("status", "pending_review"),
                "created_at": ts,
                "updated_at": ts,
            },
        )
        seen.add(key)
        changed = True
    if changed:
        _save_store(store)


def append_application(record: dict[str, Any]) -> str:
    _migrate_jsonl_if_needed()
    store = _load_store()
    app_id = str(uuid.uuid4())
    now = _now_iso()
    entry = {
        "id": app_id,
        "telegram_user_id": record.get("telegram_user_id"),
        "username": record.get("username"),
        "region": record.get("region", ""),
        "brand_slug": record.get("brand_slug", ""),
        "brand_name": record.get("brand_name", ""),
        "player_id": record.get("player_id", ""),
        "deposit_claimed": bool(record.get("deposit_claimed")),
        "status": "pending_review",
        "created_at": now,
        "updated_at": now,
    }
    store["applications"].insert(0, entry)
    _save_store(store)
    return app_id
