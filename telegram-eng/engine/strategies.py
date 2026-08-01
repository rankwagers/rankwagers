"""Strategy definitions — fh05 and o25 are independent."""

from __future__ import annotations

from dataclasses import dataclass

from config import (
    LIVE_FH05_TRIGGER,
    LIVE_O25_TRIGGER,
    PREMATCH_FH05_MAX,
    PREMATCH_O25_MAX,
)


@dataclass(frozen=True)
class StrategySpec:
    id: str
    label: str
    prematch_field: str
    prematch_max: float
    live_field: str
    live_min: float


FH05 = StrategySpec(
    id="fh05",
    label="1st Half Over 0.5",
    prematch_field="fh05",
    prematch_max=PREMATCH_FH05_MAX,
    live_field="fh05",
    live_min=LIVE_FH05_TRIGGER,
)

O25 = StrategySpec(
    id="o25",
    label="Match Over 2.5 Goals",
    prematch_field="o25",
    prematch_max=PREMATCH_O25_MAX,
    live_field="o25",
    live_min=LIVE_O25_TRIGGER,
)

ALL_STRATEGIES: tuple[StrategySpec, ...] = (FH05, O25)
