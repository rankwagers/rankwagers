#!/usr/bin/env python3
"""Generate assets/welcome.png (run from telegram-invite-bots root)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from media.welcome_banner import WELCOME_PNG, _generate  # noqa: E402

if __name__ == "__main__":
    WELCOME_PNG.parent.mkdir(parents=True, exist_ok=True)
    _generate(WELCOME_PNG)
    print(f"Wrote {WELCOME_PNG}")
