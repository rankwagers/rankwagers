# RankWagers analytics foundation

The client sends no analytics data to a third party by default. `ConsoleAnalytics` is the only enabled provider and logs structured events locally in the browser or server console.

## Common event contract

Every event includes `event_name`, `fixture_id`, `market`, `operator_slug`, `country`, `locale`, `device`, `referrer`, `timestamp`, `session_id`, and nullable `user_id`. Never place names, email addresses, IP addresses, full user-agent strings, or affiliate credentials in event properties.

## Event triggers

| Event | Trigger |
| --- | --- |
| `fixture_view` | A user opens a fixture detail (legacy expander) |
| `fixture_expand` | A fixture detail accordion expands |
| `match_detail_viewed` | Canonical match page viewed (`source`, league, country, lifecycle, market) |
| `match_prediction_expanded` | Prediction accordion expanded on match page |
| `match_evidence_viewed` | Prediction evidence section viewed |
| `match_detail_retry` | Match-detail retry control used |
| `match_related_click` | Team / competition / related link from match page |
| `homepage_viewed` | Homepage loaded (live + qualified fixture counts) |
| `homepage_section_impression` | Homepage section enters viewport (`section` property) |
| `homepage_section_click` | Homepage section CTA/link clicked (`section` property) |
| `market_selected` | A market chip is selected |
| `operator_impression` | A visible operator card is observed |
| `operator_click` | An operator CTA is clicked |
| `partner_list_expand` | The additional operator list is expanded or collapsed |
| `review_click` | A review-page CTA is clicked |
| `go_redirect` | The server processes an affiliate redirect |
| `search` | A site search is submitted (legacy) |
| `search_open` | Global search panel opened |
| `search_query` | Debounced query executed (`results_count`) |
| `search_result_click` | Result selected (`entity_type`, `entity_slug`, position) |
| `search_empty` | Zero-result query |
| `search_filter` | Entity-type / country filter changed |
| `search_keyboard_navigation` | Arrow / Enter keyboard use in results |
| `search_group_expand` | Result group expanded |
| `entity_view` | Entity hub / landing viewed (graph + discovery) |
| `entity_navigation` / `related_click` | Internal link between entities |
| `filter_change` | A non-market filter changes |
| `homepage_navigation` | A homepage destination link is selected |
| `pagination` | A future homepage pagination control changes page |

Search diagnostics (popular terms, zero-results, entity views) accumulate in `lib/search/analytics.ts` for `/developer/search`. Do not attach PII to search payloads.

### Acca Studio events (Sprint 18E)

| Event | Trigger |
| --- | --- |
| `acca_opened` | Panel/studio opened |
| `acca_selection_added` | Selection added |
| `acca_selection_removed` | Selection removed |
| `acca_cleared` | Clear all |
| `acca_undo` | Undo |
| `acca_stake_entered` | Stake changed |
| `acca_operator_selected` | Operator chosen |
| `acca_affiliate_handoff` | Continue CTA clicked |
| `acca_share_clicked` | Share URL copied |
| `acca_copy_clicked` | Plain-text copy |
| `acca_telegram_export` | Telegram text copied |
| `acca_named_saved` / `acca_named_loaded` | Named Acca persistence |

Payloads may include `selection_count`, `combined_odds`, `markets`, `teams` — never signing secrets or PII.

### Archive & transparency events (Sprint 18G)

| Event | Trigger |
| --- | --- |
| `archive_viewed` | Prediction archive hub loaded |
| `archive_day_viewed` | Daily archive page loaded (`date`) |
| `archive_filter_used` | Archive filter form submitted |
| `archive_prediction_opened` | Archived row → match page |
| `methodology_viewed` | Methodology page loaded |
| `transparency_viewed` | Transparency dashboard surface viewed |
| `transparency_interaction` | Reserved dashboard interactions |

See `docs/transparency.md`. Do not attach PII or fabricated performance claims to payloads.

### Public Acca page events (Sprint 24 — public Acca pages)

Emitted by the **published** Acca surface at `/{locale}/accas`, not by the Studio slip or the
Builder. Helper: `lib/acca-publication/analytics.ts`.

| Event | Trigger |
| --- | --- |
| `acca_index_view` | Public Acca index rendered (once per locale + page number + filtered/unfiltered) |
| `acca_card_impression` | A published-Acca card crosses 60% visibility (once per public id, per page lifecycle) |
| `acca_card_click` | A link inside a published-Acca card is followed |
| `acca_detail_view` | A public Acca detail page is rendered (once per public id) |
| `acca_leg_expand` | A per-selection `<details>` disclosure is opened (once per selection) |
| `acca_evidence_expand` | The provenance/freshness disclosure is opened (once) |
| `acca_share_open` | A share control is activated (`shareMethod` = `native` \| `clipboard`) |
| `acca_share_copy` | The canonical link reached the clipboard, or the manual fallback was offered |
| `acca_share_native` | The Web Share sheet was successfully opened |
| `acca_builder_entry_click` | The Acca Builder entry point on a public Acca surface is followed |

**Property allowlist — exhaustive, enforced in code** (`PUBLIC_ACCA_ANALYTICS_PROPERTY_KEYS`):
`publicAccaId`, `surface`, `locale`, `profile`, `legCount`, `oddsBand`, `freshnessState`,
`position`, `page`, `resultCount`, `filtered`, `shareMethod`. There is no free-form property bag;
anything not on the list is dropped rather than forwarded.

- `publicAccaId` is the **slug**. The storage `accaId` is never sent — it appears nowhere on the
  page and an analytics destination has no reason to hold it.
- `oddsBand`, **not** `targetOddsBand`. The Builder's target odds range is generation
  configuration and is not copied onto the published snapshot, so a property named "target" would
  assert something no stored record carries. The band is derived from the combined price the
  server calculated and published.
- `filtered` is a boolean. Filter VALUES are never sent, so a facet cannot become a fingerprint.
- Duplicate suppression: page views key on locale + page + filtered state; impressions use the
  shared `rememberImpression` set and unobserve after the first crossing; disclosures count once
  per element per page lifecycle.

### Sprint 19 analytics audit notes

- Naming remains snake_case `event_name` values in `lib/analytics/types.ts`  
- Archive / methodology / Acca / homepage / search / affiliate (`go_redirect`, handoff) events retained  
- No obsolete Sprint 18 events removed without replacement (additive taxonomy)  
- Deduplication: impression helpers remain entity-id based where previously implemented  
- Production provider still optional — ConsoleAnalytics is the default; wire GTM/PostHog only with IDs in env  
- Never log PII, IPs, full UA, or affiliate credentials in properties  

## Provider activation

Provider implementations are isolated in `lib/analytics/providers.ts`. To activate PostHog, GA4, or a self-hosted destination, instantiate that provider in the relevant composition root instead of `ConsoleAnalytics`; do not add direct tracker calls to UI components.

The optional `POST /api/analytics` endpoint validates typed client events server-side. It derives country, device, and referrer from the request rather than trusting browser-supplied values.
