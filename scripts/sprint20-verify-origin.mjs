/**
 * Post-deploy / rehearsal origin verification (Sprint 20).
 * Does not follow affiliate destinations (redirect: manual).
 *
 * Usage:
 *   node scripts/sprint20-verify-origin.mjs https://prod.example
 *   BASE_URL=http://127.0.0.1:3000 node scripts/sprint20-verify-origin.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const base = (
  process.env.BASE_URL ||
  process.env.STAGING_BASE_URL ||
  process.argv[2] ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");

const outPath = path.join(
  process.cwd(),
  "docs",
  "sprint-20-origin-verify.generated.json"
);

async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = (await fn()) || null;
    return { name, ok: true, ms: Date.now() - started, detail };
  } catch (err) {
    return {
      name,
      ok: false,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function assertStatus(res, allowed) {
  if (!allowed.includes(res.status)) {
    throw new Error(`status ${res.status}`);
  }
}

async function run() {
  const cases = [
    [
      "health_liveness",
      async () => {
        const res = await fetch(`${base}/api/health`);
        assertStatus(res, [200]);
        const json = await res.json();
        if (json.status !== "ok") throw new Error("not ok");
        return { requestId: res.headers.get("x-request-id") };
      },
    ],
    [
      "health_ready",
      async () => {
        const res = await fetch(`${base}/api/health/ready`);
        assertStatus(res, [200, 503]);
        return {
          status: res.status,
          requestId: res.headers.get("x-request-id"),
        };
      },
    ],
    [
      "homepage",
      async () => {
        const res = await fetch(`${base}/en`);
        assertStatus(res, [200]);
        const html = await res.text();
        if (!/RankWagers|responsible|18\+/i.test(html)) {
          throw new Error("missing brand/RG signals");
        }
        if (!/application\/ld\+json/i.test(html) && !/og:title/i.test(html)) {
          // OG may be in meta; require either ld+json or opengraph tags
          if (!/property=["']og:/i.test(html)) {
            throw new Error("missing structured data / OG signals");
          }
        }
        return {
          requestId: res.headers.get("x-request-id"),
          csp: Boolean(res.headers.get("content-security-policy")),
        };
      },
    ],
    [
      "search",
      async () => {
        const res = await fetch(`${base}/en/search`);
        assertStatus(res, [200]);
        const robots = res.headers.get("x-robots-tag") || "";
        const html = await res.text();
        if (!/noindex/i.test(html) && !/noindex/i.test(robots)) {
          // pageMetadata may set robots in meta
          if (!/robots[^>]*noindex/i.test(html)) {
            throw new Error("search should be noindex");
          }
        }
      },
    ],
    [
      "archive",
      async () => {
        const res = await fetch(`${base}/en/archive`);
        assertStatus(res, [200]);
        const html = await res.text();
        if (!/archive|transparency|methodology/i.test(html)) {
          throw new Error("archive signals missing");
        }
      },
    ],
    [
      "methodology",
      async () => {
        const res = await fetch(`${base}/en/methodology`);
        assertStatus(res, [200]);
      },
    ],
    [
      "acca",
      async () => {
        const res = await fetch(`${base}/en/acca`);
        assertStatus(res, [200]);
        const html = await res.text();
        if (!/noindex/i.test(html) && !/noindex/i.test(res.headers.get("x-robots-tag") || "")) {
          if (!/robots[^>]*noindex/i.test(html)) {
            throw new Error("acca should be noindex");
          }
        }
      },
    ],
    [
      "operators_hub",
      async () => {
        const res = await fetch(`${base}/en/operators`);
        assertStatus(res, [200]);
      },
    ],
    [
      "go_rejects_destination_override",
      async () => {
        const res = await fetch(
          `${base}/go/1xbet?destination=https://evil.example`,
          { redirect: "manual" }
        );
        const loc = res.headers.get("location") || "";
        if (/evil\.example/i.test(loc)) throw new Error("open redirect");
      },
    ],
    [
      "go_invalid_token_safe",
      async () => {
        const res = await fetch(`${base}/go/1xbet?ctx=r2.not.valid.token`, {
          redirect: "manual",
        });
        const loc = res.headers.get("location") || "";
        if (/evil|javascript:/i.test(loc)) throw new Error("unsafe location");
      },
    ],
    [
      "security_headers",
      async () => {
        const res = await fetch(`${base}/en`);
        const csp = res.headers.get("content-security-policy") || "";
        const xfo = res.headers.get("x-frame-options") || "";
        if (!csp.includes("frame-ancestors")) {
          throw new Error("missing CSP frame-ancestors");
        }
        if (!/deny/i.test(xfo)) throw new Error("missing X-Frame-Options");
        const rid = res.headers.get("x-request-id") || "";
        if (!rid.startsWith("req_")) throw new Error("missing x-request-id");
        return {
          hsts: res.headers.get("strict-transport-security"),
          referrer: res.headers.get("referrer-policy"),
        };
      },
    ],
    [
      "robots",
      async () => {
        const res = await fetch(`${base}/robots.txt`);
        assertStatus(res, [200]);
        const body = await res.text();
        if (!/sitemap/i.test(body) && !/disallow:\s*\//i.test(body)) {
          throw new Error("robots missing sitemap or staging disallow");
        }
        return { bytes: body.length };
      },
    ],
    [
      "sitemap_static_shard",
      async () => {
        const res = await fetch(`${base}/sitemap/static.xml`);
        assertStatus(res, [200]);
        const body = await res.text();
        if (!/archive|methodology|\/en/i.test(body)) {
          throw new Error("static sitemap missing expected URLs");
        }
      },
    ],
    [
      "404_handling",
      async () => {
        const res = await fetch(`${base}/en/this-page-does-not-exist-xyz-sprint20`);
        assertStatus(res, [404, 200]);
      },
    ],
  ];

  const results = [];
  for (const [name, fn] of cases) {
    const result = await check(name, fn);
    console.log(`${result.ok ? "PASS" : "FAIL"} ${name}${result.error ? `: ${result.error}` : ""}`);
    results.push(result);
  }

  const failed = results.filter((r) => !r.ok);
  const report = {
    ok: failed.length === 0,
    base,
    generatedAt: new Date().toISOString(),
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, base, passed: report.passed, failed: report.failed, outPath }));
  process.exit(failed.length ? 1 : 0);
}

run();
