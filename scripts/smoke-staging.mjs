/**
 * Staging smoke tests — safe local/staging checks.
 * Does NOT follow real affiliate destinations (redirect: manual).
 *
 * Usage: STAGING_BASE_URL=https://staging… node scripts/smoke-staging.mjs
 *    or: node scripts/smoke-staging.mjs https://staging…
 */
const base = (
  process.env.STAGING_BASE_URL ||
  process.argv[2] ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");

const isDeployedSmoke =
  process.env.APP_ENV === "staging" ||
  process.env.EXPECT_STAGING === "1" ||
  /staging/i.test(base);

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (err) {
    console.error(`FAIL ${name}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function run() {
  const cases = [
    [
      "health_liveness",
      async () => {
        const res = await fetch(`${base}/api/health`);
        if (res.status !== 200) throw new Error(`status ${res.status}`);
        const json = await res.json();
        if (json.status !== "ok") throw new Error("not ok");
      },
    ],
    [
      "health_ready",
      async () => {
        const res = await fetch(`${base}/api/health/ready`);
        if (![200, 503].includes(res.status)) throw new Error(`status ${res.status}`);
      },
    ],
    [
      "homepage",
      async () => {
        const res = await fetch(`${base}/en`);
        if (res.status !== 200) throw new Error(`status ${res.status}`);
        const html = await res.text();
        if (!/RankWagers|responsible|18\+/i.test(html)) {
          throw new Error("missing brand or responsible-use signals");
        }
      },
    ],
    [
      "combo_page",
      async () => {
        const res = await fetch(`${base}/en/combo`);
        if (![200, 503].includes(res.status)) throw new Error(`status ${res.status}`);
      },
    ],
    [
      "diagnostics_disabled_or_protected",
      async () => {
        const res = await fetch(`${base}/api/operators/diagnostics`);
        if (isDeployedSmoke && res.status === 200) {
          throw new Error("diagnostics publicly readable");
        }
        if (![200, 401, 403, 404].includes(res.status)) {
          throw new Error(`unexpected ${res.status}`);
        }
      },
    ],
    [
      "crawl_quality_protected",
      async () => {
        const res = await fetch(`${base}/api/crawl-quality`);
        if (isDeployedSmoke && res.status === 200) {
          throw new Error("crawl-quality publicly readable");
        }
        if (![200, 401, 403, 404].includes(res.status)) {
          throw new Error(`unexpected ${res.status}`);
        }
      },
    ],
    [
      "cron_disabled_or_protected",
      async () => {
        const res = await fetch(`${base}/api/internal/cron/cleanup`, {
          method: "POST",
        });
        if (![403, 404, 405, 401].includes(res.status)) {
          throw new Error(`unexpected ${res.status}`);
        }
      },
    ],
    [
      "admin_rejects_query_key",
      async () => {
        const res = await fetch(`${base}/admin?key=not-a-real-secret`);
        if (res.status === 404) return; // disabled
        const html = await res.text();
        // Must show login form, not analytics dashboard
        if (/Visitors today|Organic views today/i.test(html) && !/Admin access/i.test(html)) {
          throw new Error("query key appears to grant access");
        }
      },
    ],
    [
      "admin_invalid_login",
      async () => {
        const res = await fetch(`${base}/api/admin/login`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ key: "wrong-key-value-xxxxx" }),
        });
        if (![403, 404, 429].includes(res.status)) {
          throw new Error(`unexpected ${res.status}`);
        }
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
      "robots_staging_isolation",
      async () => {
        const res = await fetch(`${base}/robots.txt`);
        if (res.status !== 200) throw new Error(`status ${res.status}`);
        const body = await res.text();
        if (isDeployedSmoke && !/disallow:\s*\/\s*$/im.test(body) && !/disallow: \//i.test(body)) {
          // staging must disallow all
          if (process.env.APP_ENV === "staging" && !/disallow:\s*\//i.test(body)) {
            throw new Error("staging robots must disallow all");
          }
        }
      },
    ],
    [
      "404_handling",
      async () => {
        const res = await fetch(`${base}/en/this-page-does-not-exist-xyz`);
        if (![404, 200].includes(res.status)) throw new Error(`status ${res.status}`);
      },
    ],
    [
      "archive_hub",
      async () => {
        const res = await fetch(`${base}/en/archive`);
        if (res.status !== 200) throw new Error(`status ${res.status}`);
        const html = await res.text();
        if (!/prediction archive|transparency|methodology/i.test(html)) {
          throw new Error("archive hub missing transparency signals");
        }
      },
    ],
    [
      "methodology_page",
      async () => {
        const res = await fetch(`${base}/en/methodology`);
        if (res.status !== 200) throw new Error(`status ${res.status}`);
      },
    ],
    [
      "security_headers_present",
      async () => {
        const res = await fetch(`${base}/en`);
        const csp = res.headers.get("content-security-policy") || "";
        const xfo = res.headers.get("x-frame-options") || "";
        if (!csp.includes("frame-ancestors")) {
          throw new Error("missing CSP frame-ancestors");
        }
        if (!/deny/i.test(xfo)) throw new Error("missing X-Frame-Options DENY");
        if (isDeployedSmoke) {
          const hsts = res.headers.get("strict-transport-security") || "";
          if (!hsts.includes("max-age=")) {
            throw new Error("staging/prod must send HSTS");
          }
        }
        const rid = res.headers.get("x-request-id") || "";
        if (!rid.startsWith("req_")) {
          throw new Error("missing x-request-id correlation header");
        }
      },
    ],
  ];

  let passed = 0;
  let failed = 0;
  for (const [name, fn] of cases) {
    if (await check(name, fn)) passed += 1;
    else failed += 1;
  }

  const summary = {
    ok: failed === 0,
    base,
    passed,
    failed,
    isDeployedSmoke,
  };
  console.log(JSON.stringify(summary));
  process.exit(failed ? 1 : 0);
}

run();
