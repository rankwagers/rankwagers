# RankWagers — Oturum İlerleme Özeti

Bu belge, aff-site (RankWagers) üzerinde yapılan çalışmaların birleşik özetidir. Amaç: design system uyumu, gerçek veri bütünlüğü, affiliate CRO altyapısı, analytics ve homepage interaction katmanının production’a hazır hale getirilmesi.

---

## 1. Tasarım sistemi ve Qualified Fixtures

- Design Bible’a göre tipografi, renk token’ları, spacing ve hierarchy yenilendi (`Playfair Display` + `Inter`, semantic CSS değişkenleri).
- Qualified Fixtures ekranı production-fix seviyesine çekildi:
  - İnsan okunabilir kickoff tarihleri
  - Confidence / probability ayrımı
  - Sahte odds / placeholder değerlerin kaldırılması
  - Erişilebilir filtre ve klavye desteği
- Ana araştırma yüzeyi: `BibleFixtureExplorer` + fixture detail accordion.

**Önemli dosyalar:** `app/globals.css`, `lib/fonts.ts`, `lib/design/bible.ts`, `components/bible/BibleFixtureExplorer.tsx`

---

## 2. FootyStats match intelligence

- Sanitized API alanlarına bağlı enrichment pipeline kuruldu.
- İç data dictionary: `lib/footystats/dataDictionary.ts`
- Pre-kickoff güvenli metrikler, home/away split, sample quality, league baseline, H2H, xG.
- Ham provider alan adları public UI’da gösterilmiyor; yorumlanmış research metric’lere dönüştürülüyor.
- Counter-evidence ve limitation’lar yalnızca gerçek veri eksikliğinden üretiliyor.
- Lig sezon bağlamı: `computeLeagueSeasonContext` (completed matches üzerinden).

**Önemli dosyalar:** `lib/footystats/matchDetail.ts`, `lib/research/footyStatsEvidence.ts`, `lib/research/qualifiedFixture.ts`

---

## 3. API-Football odds + affiliate operators

- Fixture matching: takım adı + kickoff + lig/ülke skorlaması, belirsiz match’lerde reddetme.
- Tüm bookmaker odd’ları toplanıyor; tek bookmaker varsa coverage `single-bookmaker`.
- Affiliate katmanı odds snapshot’tan ayrıldı:
  - Market Odds Snapshot = objektif fiyatlar
  - Recommended Operators = affiliate partner kartları
- Partner ranking: skor motoru (`PartnerRankingService`)
  - verified market, regional availability, affiliate configured, live/crypto/mobile/cashback, priority override
  - CTR / FTD / EPC için genişletilebilir rule arayüzü
- Top pick, why-choose reason’ları, verified market CTA’ları.

**Önemli dosyalar:** `lib/api-football/odds.ts`, `lib/affiliate/operators.ts`, `lib/affiliate/partnerRanking.ts`

---

## 4. Odds History + Closing Line Value

- Append-only odds history (PostgreSQL):
  - fixture, operator, market, line, odd, timestamp
  - overwrite yok; batch insert; fixture/market/operator/timestamp index’leri
- Migration: `db/migrations/20260724_create_odds_history.sql`
- Env: `ODDS_HISTORY_DATABASE_URL`
- CLV engine (architecture-only): opening / current / closing → CLV % + direction

**Önemli dosyalar:** `lib/odds-history/*`, `lib/odds-history/closingLineValue.ts`

---

## 5. Analytics foundation

- Typed analytics service + `AnalyticsProvider` abstraction:
  - ConsoleAnalytics (aktif)
  - PostHog / GA4 / Self-hosted (hazır, opt-in)
  - First-party file append: `data/analytics-events.log`
- Ortak event alanları: event_name, fixture_id, market, operator_slug, country, locale, device, referrer, timestamp, session_id, user_id
- Browser → Console + `/api/analytics`
- Server `/go/[brand]` → FileAnalytics + session cookie

**Önemli dosyalar:** `lib/analytics/*`, `app/api/analytics/route.ts`, `app/go/[brand]/route.ts`

### Temel event’ler

| Event | Kullanım |
|---|---|
| `fixture_view` / `fixture_expand` | Fixture açılma |
| `fixture_impression` | Liste kartı görünürlüğü (IO %60) |
| `market_selected` / `filter_change` | Filtreler |
| `operator_impression` / `operator_click` | Partner kartları |
| `partner_list_expand` | Daha fazla partner |
| `go_redirect` | Affiliate redirect |
| `search_*` | Header arama |
| `live_signals_nav_clicked` / `live_signal_*` | Live Signals |
| `pagination_clicked` / `pagination_page_viewed` | Sayfalama |
| `homepage_navigation` | Nav hedefleri |

---

## 6. Developer analytics dashboard

- Route: `/developer/analytics` (auth yok; internal tool)
- Operator bazlı: Impressions, Clicks, CTR, Country, League, Market, Fixture
- Sortable + searchable, minimal UI

**Önemli dosyalar:** `app/developer/analytics/page.tsx`, `components/developer/OperatorAnalyticsDashboard.tsx`, `lib/analytics/dashboard.ts`

---

## 7. Homepage redesign

Yeni homepage kompozisyonu (`RankWagersHome`):

1. Today’s Highest Confidence  
2. Trending Markets  
3. Live Signals  
4. Top Operators  
5. Recently Qualified  
6. Latest Insights (+ methodology / saved anchors)

- Bloomberg × Sofascore tonu; gambling-banner stili yok
- Mevcut bileşenler yeniden kullanıldı (`BibleFixtureExplorer`, `LiveFeedPanel`, `BibleOperatorStrip`, `BibleHomeNotes`)

**Önemli dosyalar:** `components/bible/RankWagersHome.tsx`, `app/[locale]/page.tsx`

---

## 8. Homepage interaction layer (audit gaps)

### Header search
- Takım / lig / competition araması
- Trim, case-insensitive, accent-insensitive
- Enter submit, Escape clear
- Sonuçlar yalnızca mevcut route: `/{locale}#fixtures`
- API: `/api/home-search`

### Live Signals
- Nav ve CTA’lar `/{locale}#live-signals`’a çözülüyor
- Impression + card click tracking

### Pagination
- Client-side, page size 12
- Filtre + search korunuyor
- Previous / Next, sınırlarda disable
- Scroll → fixture list heading

### Impression policy
- IntersectionObserver threshold: **0.6**
- Entity başına page lifecycle’da bir kez
- Helper: `lib/analytics/impressions.ts`

---

## 9. Legacy cleanup

| Bileşen | Durum |
|---|---|
| `MatchListsPanel` | Kaldırıldı (kullanılmıyordu) |
| `MatchListTable` + expand/kickoff/play-now/date picker/layout/placeholder/flag/badge zinciri | Kaldırıldı (orphaned) |
| `LiveFeedPanel` | Korundu + analytics ile bağlandı |
| Live source of truth | `app/[locale]/page.tsx` → `RankWagersHome` → `BibleFixtureExplorer` |

---

## 10. Test ve doğrulama

Mevcut test kapsamı örnekleri:

- Fixture presentation / odds / affiliate resolution
- Partner ranking
- Analytics enrichment + session id
- Odds history mapping
- CLV calculation
- Homepage search normalization / locale links / pagination / impression dedupe
- Operator analytics aggregation
- Legacy import status

Son bilinen doğrulama durumu:

- `npm test` — geçti  
- `npm run lint` — temiz  
- `npx tsc --noEmit` — geçti  
- `npm run build` / `npm run build:verify` — geçti (Windows’ta ara sıra `.next` cache race; izole `build:verify` tercih edilmeli)

Dev: `http://localhost:9000` (`npm run dev:9000`)

---

## 11. Mimari harita (özet)

```text
/[locale]
  RankWagersHome
    ├── Highest Confidence / Trending Markets
    ├── LiveFeedPanel          (#live-signals)
    ├── BibleOperatorStrip     (#operators)
    ├── BibleFixtureExplorer   (#fixtures)  ← research + partners + pagination
    └── Latest Insights / Saved / Methodology

Header search → /api/home-search → rankwagers:home-search event → explorer filter

Affiliate CTA → /go/[brand]?fixture_id&market&... → AnalyticsProvider + redirect

Odds import → parseFixtureOdds → appendFixtureOddsHistory (Postgres, append-only)
```

---

## 12. Sonraki faz adayları (henüz yapılmadı / kısmi)

Önceki stratejik roadmap’ten kalanlar:

1. Country Personalization (dinamik partner sırası)  
2. Odds Movement grafikleri / steam  
3. Closing Line Value UI entegrasyonu  
4. Live Signals ürün derinleştirme  
5. SEO review / operator detail / compare sayfaları  
6. Prediction Timeline / Confidence Evolution  
7. Dashboard’a auth ekleme  
8. PostHog / GA4 provider’ların production enable’ı  
9. Odds history DB’nin deploy’da migrate + env ile açılması  

---

## 13. Kritik env / deploy notları

```env
FOOTYSTATS_API_KEY=
API_FOOTBALL_KEY=
ODDS_HISTORY_DATABASE_URL=   # opsiyonel; yoksa history yazılmaz
ADMIN_KEY=
SITE_URL=
NEXT_PUBLIC_GTM_ID=
```

Odds history için migration uygulanmalı:

`db/migrations/20260724_create_odds_history.sql`

Analytics first-party log:

`data/analytics-events.log` (git’e alınmaz)

---

*Bu özet, Design Bible redesign’dan homepage interaction completion ve legacy cleanup’a kadar olan oturum çalışmalarını kapsar.*
