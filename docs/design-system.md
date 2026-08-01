# RankWagers Design System (Sprint 18F)

## Principles

Premium · calm · evidence-driven · consistent · light-first (Design Bible).  
Avoid visual noise, decorative UI, and magic values.

## Token source of truth

Runtime CSS variables in `app/globals.css` `:root`.  
Flutter-mappable names documented in `lib/ui/tokens.ts`.

| Category | Examples |
|----------|----------|
| Surfaces | `--canvas-primary`, `--canvas-secondary`, `--canvas`, `--surface-elevated`, `--card` |
| Ink | `--ink-primary/secondary/muted/subtle` |
| Brand / status | `--green-*`, `--amber-*`, `--red-*`, `--info-*` |
| Settlement | `--status-won/lost/void/pending/live-*` |
| Acca risk | `--risk-low/balanced/aggressive/very-aggressive-*` |
| Spacing | `--space-1…12`, `--touch-min` |
| Radius | `--radius-sm/md/lg/xl/full` |
| Elevation | `--shadow-card/elevated/focus` |
| Motion | `--motion-fast/base/slow`, `--ease-out` |

Tailwind `colors` / `boxShadow` / `borderRadius` read from these variables (`tailwind.config.ts`).

## Shared components

| Component | Path |
|-----------|------|
| EmptyState | `components/ui/EmptyState.tsx` |
| PageSkeleton | `components/ui/PageSkeleton.tsx` |
| InlineAlert | `components/ui/InlineAlert.tsx` |
| BottomSheet | `components/ui/BottomSheet.tsx` |
| StatusBadge | `components/homepage/sectionChrome.tsx` |
| Focus trap | `lib/ui/focusTrap.ts` |

## Public Acca components (Sprint 20B-B + Sprint 24)

| Component | Path | Runtime |
|-----------|------|---------|
| PublicAccaIndexView | `components/acca-publication/PublicAccaIndexView.tsx` | server |
| PublicAccaDetailView | `components/acca-publication/PublicAccaDetailView.tsx` | server |
| PublicAccaCard | `components/acca-publication/PublicAccaCard.tsx` | server |
| PublicAccaFilters | `components/acca-publication/PublicAccaFilters.tsx` | server (plain links) |
| PublicAccaPagination | `components/acca-publication/PublicAccaPagination.tsx` | server (plain links) |
| HomepagePublishedAccas | `components/homepage/HomepagePublishedAccas.tsx` | server, self-hiding |
| AccaShareControls | `components/acca-publication/AccaShareControls.tsx` | **client** |
| AccaIndexAnalytics | `components/acca-publication/AccaIndexAnalytics.tsx` | **client**, renders `null` |
| AccaDetailAnalytics | `components/acca-publication/AccaDetailAnalytics.tsx` | **client**, renders `null` |

Admin-only counterparts (`AccaListView`, `AccaDetailView`, `AccaLifecycleActions`) live in the same
directory and must never be imported by a public surface — a test enforces it.

Only three client components exist on this surface, and two of them render nothing. Everything a
reader can read is server-rendered, including filtering, pagination and disclosures. Props crossing
into a client component are plain serializable values; no client island imports the publication
store, the projection module or anything `server-only`.

## Motion

Subtle enter animations: `.sheet-enter`, `.panel-enter`, `.fixture-detail-enter`.  
`prefers-reduced-motion: reduce` disables decorative and enter animations (including pct-shine / play-now).

## Theme architecture

- **Current:** light brand experience (`color-scheme: light`).  
- **Future dark:** reserved comment block in `globals.css` (`data-theme="dark"`) — not activated in 18F.  
- Prefer layered canvases over pure black/white when dark ships.

## Flutter readiness

Token names are stable strings. Interaction patterns (sheet focus trap, status/risk tones, touch min) are not React-specific. No Flutter package in Sprint 18.
