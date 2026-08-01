# aff-panel — VIP application admin (port 9000)

English UI. Manages `vip-applications.json` shared with `telegram-invite-bots`.

## Local

```bash
cd aff-panel
npm ci
cp .env.example .env
npm run dev
# http://localhost:9000/affpanel?key=YOUR_ADMIN_KEY
```

## Server paths

| Path | Purpose |
|------|---------|
| `/var/www/aff-panel` | This app |
| `/var/www/rankwagers/telegram-invite-bots/data/vip-applications.json` | Shared applications |

Both `.env` files should use the **same** `VIP_APPLICATIONS_PATH` (bot optional; defaults to `data/vip-applications.json` under bot dir).

---

## WinSCP / SCP upload (from Windows)

Upload folder **`aff-site/aff-panel`** to server **`/var/www/aff-panel`**.

**Include:** `app`, `components`, `lib`, `deploy`, `package.json`, `package-lock.json`, `next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `middleware.ts`, `.env.example`

**Exclude:** `node_modules`, `.next`, `.env`

Example with `scp` (PowerShell, adjust host and key):

```powershell
scp -r "C:\Users\Administrator\Desktop\aff-site\aff-panel\app" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\components" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\lib" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\deploy" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\package.json" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\package-lock.json" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\next.config.js" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\tsconfig.json" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\tailwind.config.ts" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\postcss.config.js" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\middleware.ts" `
      "C:\Users\Administrator\Desktop\aff-site\aff-panel\.env.example" `
      root@YOUR_SERVER:/var/www/aff-panel/
```

Easier: WinSCP drag **`aff-panel`** contents into `/var/www/aff-panel`.

Also upload updated **`telegram-invite-bots`** (`storage.py`, `config.py`, `handlers.py`) to `/var/www/rankwagers/telegram-invite-bots/`.

---

## Server commands (first time)

```bash
mkdir -p /var/www/aff-panel
mkdir -p /var/www/rankwagers/telegram-invite-bots/data

cd /var/www/aff-panel
cp .env.example .env
nano .env
```

`.env` example:

```env
PORT=9000
ADMIN_KEY=your-long-secret
TELEGRAM_INVITE_BOT_TOKEN=SAME_AS_INVITE_BOT
VIP_APPLICATIONS_PATH=/var/www/rankwagers/telegram-invite-bots/data/vip-applications.json
VIP_SETTINGS_PATH=/var/www/aff-panel/data/vip-settings.json
```

```bash
npm ci
npm run build
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 logs aff-panel --lines 30
```

Bot (if not running):

```bash
cd /var/www/rankwagers
pm2 start deploy/ecosystem.config.cjs --only telegram-invite
# reload after storage.py update:
pm2 reload telegram-invite
```

Open panel:

```text
http://YOUR_SERVER_IP:9000/affpanel?key=YOUR_ADMIN_KEY
```

Restrict port 9000 to your IP (ufw / nginx).

---

## Update deploy

```bash
cd /var/www/aff-panel
npm ci
npm run build
pm2 reload aff-panel
```

Placeholders in approval message: `{brand}`, `{player_id}`, `{vip_link}`, `{region}`, `{username}`, `{brand_slug}`.
