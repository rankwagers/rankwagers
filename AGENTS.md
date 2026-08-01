# aff-site (RankWagers)

This project uses [Marketing Skills](https://github.com/coreyhaines31/marketingskills) for AI-assisted marketing, CRO, copy, and SEO work.

## Skills location

- **Installed skills:** `.agents/skills/` (45 skills, copied from `marketingskills/skills/`)
- **Full repo (tools, docs):** `marketingskills/` (GitHub zip; update by re-downloading or install Git and `git pull`)

## Site review workflow

1. Read or create **`.agents/product-marketing.md`** (use the `product-marketing` skill).
2. Run audits with skills such as `cro`, `seo-audit`, `copywriting`, `site-architecture`, `schema`, `analytics`.
3. Reference the codebase under `app/`, `components/`, `lib/dictionaries.ts`.

Cursor loads skills from `.agents/skills/` per the [Agent Skills](https://agentskills.io/specification.md) layout.

## Updating skills

Git is not required on this machine. To refresh:

```powershell
# From aff-site folder — re-download and copy skills
Invoke-WebRequest -Uri "https://github.com/coreyhaines31/marketingskills/archive/refs/heads/main.zip" -OutFile marketingskills-main.zip
Expand-Archive marketingskills-main.zip -DestinationPath . -Force
Copy-Item marketingskills-main\skills\* .agents\skills\ -Recurse -Force
Remove-Item marketingskills-main.zip; Remove-Item marketingskills-main -Recurse -Force
```

Or install [Git for Windows](https://git-scm.com/) and run: `npx skills add coreyhaines31/marketingskills`
