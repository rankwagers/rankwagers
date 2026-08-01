"""Aff-site ile aynı 13 marka (slug + görünen ad)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from config import SITE_URL


@dataclass(frozen=True)
class BrandRow:
    slug: str
    name: str
    accepted_countries: Optional[frozenset[str]] = None


BRANDS: list[BrandRow] = [
    BrandRow("1xbet", "1xBet"),
    BrandRow("bet-and-you", "Bet&You"),
    BrandRow("melbet", "Melbet"),
    BrandRow("megapari", "Megapari"),
    BrandRow("fansport", "FanSport"),
    BrandRow("topbet", "TopBet"),
    BrandRow("dbbet", "DBBet"),
    BrandRow("bizbet", "Bizbet"),
    BrandRow("betroller", "Betroller"),
    BrandRow("wepari", "WePari"),
    BrandRow("888starz", "888Starz"),
    BrandRow("betwinner", "Betwinner"),
    BrandRow("paripulse", "PariPulse"),
]

BRAND_BY_SLUG = {b.slug: b for b in BRANDS}


def brands_for_country(country_code: str | None) -> list[BrandRow]:
    cc = (country_code or "").upper()
    if not cc:
        return list(BRANDS)
    out: list[BrandRow] = []
    for b in BRANDS:
        if b.accepted_countries is None or cc in b.accepted_countries:
            out.append(b)
    return out if out else list(BRANDS)


def go_url(slug: str, subid: str) -> str:
    from urllib.parse import quote

    safe = quote(subid or "direct", safe="")
    return f"{SITE_URL}/go/{slug}?subid={safe}"


def site_app_url() -> str:
    return f"{SITE_URL}/en"
