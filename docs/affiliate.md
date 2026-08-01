# Affiliate handoff (Acca + Builder)

Primary attribution docs: `docs/affiliate-attribution.md`, `docs/affiliate-postbacks.md`.  
Admin intelligence (Sprint 23): `docs/affiliate-intelligence.md` → `/admin/affiliate`.

## Acca Studio

Operator CTAs: `POST /api/acca/operators` → server `buildGoPath` with `placement: acca_studio`.

## Acca Builder

Builder does **not** sign affiliate links itself. After transfer:

1. Combination lands in Acca Studio slip  
2. User selects operator in Studio  
3. Existing signed `/go` handoff applies  

Track `acca_builder_operator_handoff` only when handoff originates after a builder transfer (aggregate properties only).

Never expose partner secrets or unsigned destination URLs from the builder UI.
