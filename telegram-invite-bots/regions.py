from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Region:
    key: str
    label: str
    country_code: str  # subid + brand filtresi için ISO alpha-2 veya mantıksal kod


REGIONS: list[Region] = [
    Region("eu", "🇪🇺 Europe", "DE"),
    Region("us", "🇺🇸 USA", "US"),
    Region("ca", "🇨🇦 Canada", "CA"),
    Region("au", "🇦🇺 Australia", "AU"),
    Region("uk", "🇬🇧 UK", "GB"),
    Region("br", "🇧🇷 Brazil", "BR"),
    Region("in", "🇮🇳 India", "IN"),
    Region("ng", "🇳🇬 Nigeria", "NG"),
    Region("bd", "🇧🇩 Bangladesh", "BD"),
    Region("np", "🇳🇵 Nepal", "NP"),
    Region("other", "🌍 Other", "XX"),
]

REGION_BY_KEY = {r.key: r for r in REGIONS}
