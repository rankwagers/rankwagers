# Methodology (public product notes)

Public page: `/{locale}/methodology`  
Settlement detail: `docs/prediction-settlement-methodology.md`  
Transparency architecture: `docs/transparency.md`

## How predictions are generated

Qualified football markets come from provider-backed daily lists:

- First-half over 0.5  
- Over 1.5  
- Over 2.5  
- Second-half over 0.5  

A market appears only when it passes the list qualification pipeline. Fixtures and probabilities are not invented.

## How confidence is derived

The percentage next to a market is a **model probability** from provider potentials for that market. It is a statistical indicator — not a tip, guarantee, or edge claim.

## How evidence is collected

Match pages and research cards show supporting statistics when the provider returns them. Missing inputs stay unavailable. Archive evidence summaries capture market label, model probability, and competition at archive time.

## How settlement works

Settlement is server-authoritative (`lib/fixtures/settlement.ts` for match markets; daily archive `listResult` for list markets). Outcomes: won, lost, pending, void/postponed. Missing scores never become wins.

Hit rate uses settled wins and losses only. Pending and void rows remain visible and are excluded from hit rate.

## How archives are preserved

Each research day is stored under `data/daily-archives`. Archive pages project those rows into a transparent history. Settled content is not selectively rewritten for marketing.

## Language rules

- No guaranteed-win claims  
- No fabricated sample sizes or tipster bankrolls  
- Affiliate relationships disclosed in the site footer  
- 18+ / responsible gambling links required  
