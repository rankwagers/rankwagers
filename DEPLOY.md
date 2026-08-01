# aff-site — sunucu deploy

RankWagers Next.js sitesi + `telegram-eng` live feed botu. Otomatik CI/CD yok; WinSCP/rsync ile kod atıp sunucuda script çalıştırırsınız.

## Gereksinimler (sunucu)

| Bileşen | Sürüm |
|--------|--------|
| Linux (Ubuntu/Debian önerilir) | |
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.10+ (telegram bot) |
| nginx | reverse proxy |
| PM2 | önerilir (`npm i -g pm2`) |

---

## 1) WinSCP ile dosya yükleme

Hedef örnek: `/var/www/aff-site`

**Yükleyin:** `app`, `components`, `lib`, `public`, `data`, `telegram-eng`, `scripts`, `deploy`, `package.json`, `package-lock.json`, `next.config.js`, `tsconfig.json`, `postcss.config.js`, `tailwind.config.ts`, `.env.example`, vb.

**Yüklemeyin / sunucuda üretin:**

| Yol | Neden |
|-----|--------|
| `node_modules` | `npm ci` |
| `.next` | `npm run build` |
| `.env`, `.env.local` | Sunucuda elle oluşturun (gizli) |
| `telegram-eng/.env` | Sunucuda elle |
| `telegram-eng/.venv` | `install-server.sh` oluşturur |
| `data/*.log`, `data/events.log` | Canlı log |
| `.agents`, `marketingskills` | Site için gerekli değil (isteğe bağlı atlamak) |

`deploy/upload-exclude.txt` rsync için referans listesi.

---

## 2) Ortam dosyaları (ilk kurulum)

### Kök: `.env`

```bash
cd /var/www/aff-site
cp .env.example .env
nano .env
```

Zorunlu / önemli alanlar:

- `SITE_URL=https://rankwagers.com` (gerçek domain)
- `FOOTYSTATS_API_KEY`
- `API_FOOTBALL_KEY`
- `ADMIN_KEY` (uzun rastgele)
- `NEXT_PUBLIC_TELEGRAM_URL` / `NEXT_PUBLIC_TELEGRAM_BOT_URL` (live CTA)

Next.js production’da `.env` ve `.env.local` okunur; **`.env.local` önceliklidir**. Sunucuda genelde sadece `.env` kullanın. Eski dev’den kalan `.env.local` içinde `SITE_URL=http://...` varsa canonical/OG bozulur — satırı silin veya dosyayı kaldırın.

### Bot: `telegram-eng/.env`

```bash
cp telegram-eng/.env.example telegram-eng/.env
nano telegram-eng/.env
```

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `API_FOOTBALL_KEY` doldurun. Site live sütunu bu klasördeki `data/signals_*.json` dosyalarını okur — bot **bu** `telegram-eng` içinden çalışmalı.

---

## 3) İlk kurulum (sunucuda)

```bash
cd /var/www/aff-site
chmod +x deploy/install-server.sh deploy/update-server.sh
./deploy/install-server.sh
```

Bu script: `npm ci`, `npm run build`, `telegram-eng` venv + pip, `data` klasörlerini hazırlar.

Build hata verirse deploy etmeden önce yerelde `npm run build` ile düzeltin.

---

## 4) PM2 ile çalıştırma

```bash
export AFF_SITE_ROOT=/var/www/aff-site
pm2 start deploy/ecosystem.config.cjs
pm2 status
pm2 logs aff-site --lines 50
pm2 save
pm2 startup   # çıkan komutu root ile çalıştırın
```

Süreçler:

- `aff-site` — Next.js, port **3000**
- `telegram-eng` — Python bot (`telegram-eng/.venv/bin/python`)

---

## 5) nginx

1. Admin IP map (bir kez, `http { }` içinde):

   ```bash
   # nginx.conf içine veya snippets:
   include /var/www/aff-site/deploy/nginx-admin-map.conf;
   ```

   IP’yi `deploy/nginx-admin-map.conf` içinde güncelleyin.

2. Site vhost:

   ```bash
   sudo cp deploy/nginx-site.conf.example /etc/nginx/sites-available/rankwagers
   sudo nano /etc/nginx/sites-available/rankwagers   # server_name düzenle
   sudo ln -sf /etc/nginx/sites-available/rankwagers /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

Cloudflare kullanıyorsanız gerçek ziyaretçi IP’si `CF-Connecting-IP` üzerinden gelir; map bu header’a göre ayarlı.

---

## 6) Güncelleme (her kod push / WinSCP sonrası)

```bash
cd /var/www/aff-site
./deploy/update-server.sh
```

Veya elle:

```bash
npm ci && npm run build
export AFF_SITE_ROOT=/var/www/aff-site
pm2 reload deploy/ecosystem.config.cjs --update-env
```

**Windows’tan sadece dosya attıktan sonra sunucuda mutlaka `build` çalıştırın.** Windows `.next` klasörünü taşımayın.

---

## 7) Kontrol listesi

- [ ] `curl -sI http://127.0.0.1:3000/en` → HTTP 200
- [ ] Tarayıcıda ana sayfa + maç listeleri
- [ ] `/api/live-feed` JSON dönüyor
- [ ] `pm2 logs telegram-eng` hata yok
- [ ] `/admin?key=ADMIN_KEY` (sadece izinli IP + nginx map)

---

## 8) Sorun giderme

| Sorun | Çözüm |
|-------|--------|
| `Cannot find module './948.js'` (dev) | Windows: `npm run dev:fresh`. Sunucuda prod: `.next` sil, `npm run build` |
| Live sütun boş | Bot çalışıyor mu? `telegram-eng/data/signals_*.json` oluşuyor mu? |
| FootyStats listeler boş | `FOOTYSTATS_API_KEY`, API limit |
| Build `robots.txt` hatası | Temiz build: `rm -rf .next && npm run build` |

---

## Dosya özeti

| Dosya | Açıklama |
|-------|----------|
| `deploy/install-server.sh` | İlk kurulum |
| `deploy/update-server.sh` | Güncelleme + PM2 reload |
| `deploy/ecosystem.config.cjs` | PM2 tanımı |
| `deploy/nginx-site.conf.example` | Tam site proxy |
| `deploy/nginx-admin-map.conf` | /admin IP map |
| `deploy/nginx-admin-ip.conf` | Eski notlar + admin location |
