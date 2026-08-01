#!/usr/bin/env node
/**
 * SEO Faz 1 — canlı site teknik kontrolü (robots, sitemap, örnek sayfa meta).
 * Kullanım: SITE_URL=https://rankwagers.com npm run seo:phase1
 */

const base = (process.env.SITE_URL || "https://rankwagers.com").replace(
  /\/$/,
  ""
);

const SAMPLE_PATHS = [
  "/en",
  "/en/reviews/1xbet",
  "/en/compare/1xbet-vs-melbet",
  "/pl/best-crypto-betting-sites",
];

const GSC_CHECKLIST = [
  "Search Console → Sayfalar: Indexed / Discovered-not-indexed sayıları",
  "Site haritaları: sitemap.xml hatasız mı",
  "Performans: impression/tıklama (boşsa normal — baseline)",
  "Admin panel → SEO Faz 1: Organic views (GSC ile karşılaştır)",
];

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  return false;
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
  return true;
}

async function fetchText(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "RankwagersSeoPhase1/1.0" },
    redirect: "follow",
  });
  const text = await res.text();
  return { url, status: res.status, text };
}

async function checkRobots() {
  console.log("\n[1] robots.txt");
  const { status, text } = await fetchText("/robots.txt");
  if (status !== 200) return fail(`HTTP ${status}`);
  let good = true;
  if (!/Disallow:\s*\/admin/i.test(text)) {
    good = fail("Disallow: /admin yok");
  } else ok("/admin disallow");
  if (!/Disallow:\s*\/go\//i.test(text)) {
    good = fail("Disallow: /go/ yok");
  } else ok("/go/ disallow");
  if (!/Sitemap:\s*https?:\/\//i.test(text)) {
    good = fail("Sitemap satırı yok");
  } else ok("Sitemap URL tanımlı");
  return good;
}

async function checkSitemap() {
  console.log("\n[2] sitemap.xml");
  const { status, text } = await fetchText("/sitemap.xml");
  if (status !== 200) return fail(`HTTP ${status}`);
  const locs = (text.match(/<loc>/g) || []).length;
  if (locs < 100) {
    fail(`Sadece ${locs} URL — compare eksik olabilir (beklenen ~1000+)`);
  } else {
    ok(`${locs} URL`);
  }
  const compareCount = (text.match(/\/compare\//g) || []).length;
  if (compareCount === 0) {
    fail("Hiç /compare/ URL yok");
  } else {
    ok(`${compareCount} compare URL referansı`);
  }
  return locs >= 100 && compareCount > 0;
}

function checkHtmlMeta(label, html) {
  let good = true;
  if (!/<title[^>]*>[\s\S]+?<\/title>/i.test(html)) {
    good = fail(`${label}: <title> yok`);
  } else ok(`${label}: title var`);
  if (!/rel=["']canonical["']/i.test(html)) {
    good = fail(`${label}: canonical link yok`);
  } else ok(`${label}: canonical var`);
  if (!/hreflang=/i.test(html)) {
    fail(`${label}: hreflang yok (locale sayfalarında beklenir)`);
  } else ok(`${label}: hreflang var`);
  return good;
}

async function checkSamplePages() {
  console.log("\n[3] Örnek sayfalar (title, canonical, hreflang)");
  let all = true;
  for (const p of SAMPLE_PATHS) {
    const { status, text, url } = await fetchText(p);
    if (status !== 200) {
      all = fail(`${p} → HTTP ${status}`);
      continue;
    }
    const pathLabel = p;
    if (!checkHtmlMeta(pathLabel, text)) all = false;
    if (text.includes('name="robots"') && /noindex/i.test(text)) {
      fail(`${pathLabel}: noindex (beklenmiyor)`);
      all = false;
    }
    void url;
  }
  return all;
}

function printGscChecklist() {
  console.log("\n[4] Google Search Console — haftalık 15 dk");
  for (const line of GSC_CHECKLIST) {
    console.log(`  • ${line}`);
  }
}

async function main() {
  console.log(`SEO Faz 1 kontrol — ${base}`);
  let pass = true;
  try {
    if (!(await checkRobots())) pass = false;
    if (!(await checkSitemap())) pass = false;
    if (!(await checkSamplePages())) pass = false;
  } catch (e) {
    console.error("\nHata:", e.message || e);
    process.exit(2);
  }
  printGscChecklist();
  console.log(pass ? "\nSonuç: teknik kontroller tamam.\n" : "\nSonuç: bazı kontroller başarısız.\n");
  process.exit(pass ? 0 : 1);
}

main();
