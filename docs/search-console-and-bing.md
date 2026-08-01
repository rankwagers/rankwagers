# Search Console & Bing Webmaster — Sprint 20 ops checklist

**Prerequisite:** Production domain live with HTTPS and correct `SITE_URL` (not a placeholder).

Current workstation `SITE_URL` host `gercek-domainin.com` is a **placeholder** — do not submit sitemaps for it.

## Google Search Console

| Step | Action | Status template |
|------|--------|-----------------|
| 1 | Create domain or URL-prefix property for production host | ☐ |
| 2 | Complete ownership (DNS TXT or HTML file) | ☐ |
| 3 | Submit sitemap index: `https://<prod>/sitemap.xml` (Next shards under `/sitemap/*.xml`) | ☐ |
| 4 | Inspect homepage canonical `https://<prod>/en` | ☐ |
| 5 | Inspect `/en/archive`, `/en/methodology`, one competition, one market | ☐ |
| 6 | Confirm `robots.txt` allows public research URLs; disallows `/admin`, `/developer`, `/api/`, `/go/` | ☐ |
| 7 | Monitor Coverage / Page indexing for soft-404 and noindex surprises | ☐ |
| 8 | Watch Core Web Vitals (field) after traffic arrives | ☐ |

### Indexability reminders

- `/search`, `/acca` → **noindex**  
- Thin country / archive day pages may stay noindex by design  
- Staging must Disallow all (`APP_ENV=staging`)

## Bing Webmaster Tools

| Step | Action | Status template |
|------|--------|-----------------|
| 1 | Add production site | ☐ |
| 2 | Import GSC verification **or** Bing XML/DNS verification | ☐ |
| 3 | Submit sitemap `https://<prod>/sitemap.xml` | ☐ |
| 4 | Run URL inspection on homepage + archive | ☐ |
| 5 | Review Crawl diagnostics / Index explorer after 48–72h | ☐ |

## Evidence to paste into `docs/launch-report.md`

- Property URLs  
- Sitemap submission timestamps  
- Sample inspection screenshots / status codes  
- Any blocking issues (redirect chains, wrong canonical host)

## Automation note

This machine cannot create GSC/Bing properties without operator accounts. After DNS is live, re-run:

```bash
BASE_URL=https://<prod> npm run ops:verify-origin
```
