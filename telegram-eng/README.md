# Live Goals Bot (English)

Standalone Telegram notification bot for live goal strategies.  
**Separate from** the Turkish `telegram/` bot and from `scorezone-web` / `scorezone-backend`.

## Strategies

| ID | Prematch | Live trigger |
|----|----------|----------------|
| **fh05** | 1st half over 0.5 ≤ 1.22 | Live ≥ 1.35 (1H, 0-0) |
| **o25** | Match over 2.5 ≤ 1.44 | Live ≥ 1.50 |

## Features (vs Turkish bot)

- **100% English** messages
- **Compact upcoming digest** (2 lines per match, max 8 + “+N more”)
- **Live signals as photo cards** (team logos, score, minute, live odd) + short caption
- Team logos stored in watchlist from API-Football

## Setup

```bash
cd telegram-eng
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your bot token, chat ID, API-Football key
```

## Commands

```bash
python main.py --test              # test message
python main.py --discover-chat     # find chat ID
python main.py --scan-once         # one fixture scan
python main.py --watchlist         # print watchlist
python main.py --preview-cards     # sample PNG cards (no Telegram)
python main.py --digest-test       # scan + send digest test
python main.py                     # run bot (scanner + monitor)
```

## PM2 (when ready to deploy)

```bash
pm2 start main.py --name telegram-bot-eng --interpreter python3
```

## RankWagers (aff-site) web feed

This copy lives under `aff-site/telegram-eng/`. The Next.js site reads live signals from:

- `data/signals_fh05.json`
- `data/signals_o25.json`

Run the bot from **this folder** (not Desktop `telegram-eng`). Keep `TELEGRAM_*` empty in `.env` until the bot is ready. The site shows **one free tip per UTC hour** in the right-hand Live column; extra signals appear blurred until users unlock via partner sites / Telegram VIP.

