# Telegram Invite / VIP Bot

Ayrı bot servisi (`telegram-eng` canlı sinyal botundan farklı token).

## Kurulum

```bash
cd telegram-invite-bots
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux:   source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# .env içinde TELEGRAM_BOT_TOKEN doldurun
python main.py
```

## BotFather

- Web App domain: `rankwagers.com` (veya `SITE_URL` host)
- Mini App butonları `https://rankwagers.com/go/{brand}?subid=...` ve site için `/en`

## Görsel

- `/start` hoş geldin: `assets/welcome.png` (yoksa Pillow ile üretilir)
- Özel banner: `.env` → `WELCOME_IMAGE_PATH=/path/to/banner.png`
- Yeniden üret: `python scripts/generate_welcome_asset.py`

## Metin

- Ana dil: **English** — `content/copy_en.py`
- Bölgeye özel min. yatırım / bonus notları: `REGION_GUIDES` (aynı dosya)

## Akış

1. `/start` → Open App Site (Mini App) + GET FREE VIP
2. Bölge seçimi → 13 partner (Mini App) + I registered
3. Site seçimi → player ID metin → Yatırım Evet/Hayır
4. Evet → kayıt + `data/vip_applications.jsonl`; Hayır → tekrar partner listesi

## PM2

`deploy/ecosystem.config.cjs` içinde `telegram-invite` uygulaması (sunucuda `install-server.sh` venv kurar).
