# Affiliate placement contracts

Source: `lib/affiliate-intelligence/placements.ts` (`AFFILIATE_PLACEMENTS`).

| Placement ID | Page | Signing | Notes |
|--------------|------|---------|-------|
| homepage_operator | home | buildGoPath | BibleOperatorStrip |
| fixture_operator | fixture/home | signAffiliateOffers | Explorer + match detail |
| operator_page | operator | buildGoPath | OperatorDetailView |
| review_page | review | buildGoPath | |
| compare_page | compare | buildGoPath | |
| brand_list | hubs/bonuses | prepareBrandListItems | Higher duplicate-CTA risk |
| acca_studio | Acca Studio | /api/acca/operators | Real /go handoff |
| combo_studio | combo | buildGoPath | Legacy; /combo redirects |
| acca_builder_handoff | Acca Builder | none | Transfers to Studio |
| competition_operator_link | competition | none | Links to operator page |
| team_operator_link | team | none | Links to operator page |
| go_redirect_fallback | /go | verify token | Rejects client destinations |

Archive pages have **no** operator CTAs today.
