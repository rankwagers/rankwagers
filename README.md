# aff-site

Affiliate karşılaştırma sitesi (betting / crypto betting). Next.js (App Router) +
TypeScript + Tailwind. SEO odaklı, 12 dilli geo-routing, Türkiye + VPN engelleme
ve cloaked affiliate yönlendirme içerir.

## Özellikler

- **Geo-routing (i18n):** Ziyaretçinin ülkesine göre otomatik dil. 12 locale:
  `en, fr, es, pt, it, de, nl, pl, cs, da, sw, ar` (Arapça için RTL desteği).
- **Geo engelleme:** Türkiye (`TR`) her zaman engellenir. Sadece `lib/countries.ts`
  içindeki allowlist ülkeleri siteye erişebilir.
- **VPN/proxy sinyalleri:** Edge header'ları + `Accept-Language` çapraz kontrolü.
  (Tam koruma için Cloudflare WAF kuralları, aşağıya bakın.)
- **Affiliate tracking:** `/go/{brand}?subid=...` cloaked 302 yönlendirme,
  `subid` ile granular takip, dosyaya tıklama logu (`data/clicks.log`).
- **SEO:** Per-locale metadata, canonical + hreflang, JSON-LD (ItemList, Review,
  FAQ), `sitemap.xml`, `robots.txt`.
- **Compliance:** 18+ uyarısı, sorumlu oyun, şartlar, gizlilik, erişilebilirlik
  sayfaları.
- **Telegram CTA:** Bonus kanalına yönlendiren bileşen.

## Kurulum

```bash
npm install
cp .env.example .env        # değerleri doldur
npm run dev                 # http://localhost:3000
```

Geliştirmede ülke header'ı olmadığından middleware varsayılan olarak engelleyebilir.
Test için tarayıcıda header geçirmek veya geçici olarak `lib/geo.ts` içindeki
kararı gevşetmek gerekir. Üretimde ülke bilgisi Cloudflare/Vercel'den gelir.

### Lokal test (ülke simülasyonu)

İzinli bir ülkeyi taklit etmek için isteklere header ekleyin (örn. tarayıcı
eklentisi veya curl):

```bash
curl -H "cf-ipcountry: NG" http://localhost:3000/   # -> /en'e yönlenir
curl -H "cf-ipcountry: FR" http://localhost:3000/   # -> /fr'e yönlenir
curl -H "cf-ipcountry: TR" http://localhost:3000/   # -> engellenir
```

## Önemli dosyalar

- `middleware.ts` — geo karar + dil yönlendirme + locale header.
- `lib/countries.ts` — ülke → dil eşlemesi ve allowlist (TR yok).
- `lib/geo.ts` — ülke tespiti + VPN sinyalleri + erişim kararı.
- `lib/brands.ts` — marka listesi ve affiliate URL'leri (PLACEHOLDER — değiştir!).
- `lib/dictionaries.ts` — UI çevirileri (eksik diller İngilizce'ye düşer).
- `app/go/[brand]/route.ts` — affiliate redirect + tıklama loglama.

## Yapılacaklar (yayın öncesi)

1. `lib/brands.ts` içindeki `affiliateUrl` değerlerini gerçek affiliate linklerinle değiştir.
2. `.env` içine `SITE_URL` ve `NEXT_PUBLIC_TELEGRAM_URL` gir.
3. Cloudflare'a bağla ve aşağıdaki WAF kurallarını uygula.
4. Domain al ve Cloudflare nameserver'larına yönlendir.

## Cloudflare ile sağlam geo + VPN engelleme

Uygulama katmanı temel engellemeyi yapar; asıl güç **Cloudflare edge**'tir.

1. **Country block (WAF Custom Rule):**
   `(ip.geoip.country eq "TR")` → Action: **Block**.
2. **Sadece allowlist'e izin (opsiyonel, daha sıkı):**
   `not ip.geoip.country in {"NG" "FR" "ES" "PE" "BR" "DE" "IT" "NL" "PL" "CZ" "DK" "TZ" "MA" "KW" "CI" "CM" "CD" "SN" "MU" "GN" "BF" "EC" "CO" "MX" "PA" "ZA" "GH" "US" "PG" "ZW" "CA" "UG"}`
   → Action: **Block**.
3. **VPN/Proxy/Datacenter engelleme:**
   - Cloudflare Bot Management veya `cf.threat_score` yüksek olanları challenge/block.
   - Hosting/datacenter ASN'lerini engelle (ör. bilinen VPN sağlayıcı ASN'leri).
   - Kural örneği: `(ip.geoip.is_in_european_union)` yerine
     `(cf.client.bot)` veya `(ip.geoip.asnum in {ASN listesi})` → Block/Managed Challenge.
4. **Managed Challenge:** Şüpheli trafiğe tam blok yerine challenge vererek
   gerçek kullanıcı kaybını azalt.

> Not: %100 VPN engelleme mümkün değildir; amaç maliyeti/çabayı yükseltmektir.
> Cloudflare IP intelligence + ASN blok + challenge kombinasyonu pratikte
> sıradan VPN'lerin büyük kısmını eler.
