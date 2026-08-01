import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ADMIN_COOKIE,
  evaluateAdminAccess,
  mintAdminSession,
  safeEqualSecret,
  verifyAdminSession,
} from "../lib/security/adminAuth";
import { buildGoPath } from "../lib/operators/go-path";
import { goPathHasSignedContext } from "../lib/operators/go-path-shared";
import { operatorAffiliateHref } from "../lib/operators/links";
import { getOperator } from "../lib/operators/registry";
import {
  ensureReleaseDirs,
  pruneReleases,
  rollbackToPrevious,
  switchCurrent,
  writeReleaseMeta,
} from "../lib/ops/releaseLayout";
import { resetRateLimitBuckets } from "../lib/security/rateLimit";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("admin: query key ignored; bearer and cookie work; weak secret rejected in prod", () => {
  resetRateLimitBuckets();
  const secret = "phase-e-admin-secret-32chars!!";
  const env = {
    APP_ENV: "production",
    NODE_ENV: "production",
    ADMIN_KEY: secret,
  } as NodeJS.ProcessEnv;

  const queryIgnored = evaluateAdminAccess({
    headers: new Headers(),
    cookieValue: null,
    searchParams: new URLSearchParams({ key: secret }),
    clientKey: "t1",
    env,
  });
  assert.equal(queryIgnored.ok, false);

  const bearer = evaluateAdminAccess({
    headers: new Headers({ authorization: `Bearer ${secret}` }),
    clientKey: "t2",
    env,
  });
  assert.equal(bearer.ok, true);
  if (bearer.ok) assert.equal(bearer.via, "bearer");

  const session = mintAdminSession(secret);
  assert.ok(verifyAdminSession(session, secret));
  assert.equal(verifyAdminSession(session, "wrong-secret-value-xxxxx"), false);

  const cookieOk = evaluateAdminAccess({
    headers: new Headers(),
    cookieValue: session,
    clientKey: "t3",
    env,
  });
  assert.equal(cookieOk.ok, true);

  const weak = evaluateAdminAccess({
    headers: new Headers({ authorization: "Bearer admin" }),
    clientKey: "t4",
    env: { ...env, ADMIN_KEY: "admin" },
  });
  assert.equal(weak.ok, false);

  assert.equal(safeEqualSecret(secret, secret), true);
  assert.equal(safeEqualSecret(secret, "nope"), false);
  assert.equal(ADMIN_COOKIE, "rw_admin_session");
});

test("admin: emergency disable returns route_disabled", () => {
  resetRateLimitBuckets();
  const res = evaluateAdminAccess({
    headers: new Headers(),
    clientKey: "t5",
    env: {
      ADMIN_KEY: "phase-e-admin-secret-32chars!!",
      FF_EMERGENCY_DISABLE_ADMIN: "true",
    } as NodeJS.ProcessEnv,
  });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, "route_disabled");
    assert.equal(res.status, 404);
  }
});

test("CTA producers emit signed r2 ctx", () => {
  process.env.AFFILIATE_REDIRECT_SECRET =
    process.env.AFFILIATE_REDIRECT_SECRET || "phase-e-redirect-secret-32chars";
  const pathGo = buildGoPath({
    slug: "1xbet",
    placement: "unit_test",
    subid: "t",
  });
  assert.ok(goPathHasSignedContext(pathGo));
  assert.match(pathGo, /ctx=r2\./);
  assert.doesNotMatch(pathGo, /destination=/);

  const op = getOperator("1xbet");
  assert.ok(op);
  const href = operatorAffiliateHref(op!, "en", "NG");
  assert.ok(goPathHasSignedContext(href));
});

test("release layout: atomic switch, rollback, retention keeps current/previous", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "rw-release-"));
  try {
    ensureReleaseDirs(tmp);
    writeReleaseMeta(tmp, {
      releaseId: "r1",
      createdAt: new Date().toISOString(),
      retention: 2,
    });
    writeReleaseMeta(tmp, {
      releaseId: "r2",
      createdAt: new Date().toISOString(),
      retention: 2,
    });
    writeReleaseMeta(tmp, {
      releaseId: "r3",
      createdAt: new Date().toISOString(),
      retention: 2,
    });
    writeReleaseMeta(tmp, {
      releaseId: "r4",
      createdAt: new Date().toISOString(),
      retention: 2,
    });
    switchCurrent(tmp, "r1");
    switchCurrent(tmp, "r2");
    const rolled = rollbackToPrevious(tmp);
    assert.equal(rolled.current, "r1");
    switchCurrent(tmp, "r4");
    switchCurrent(tmp, "r3");
    pruneReleases(tmp, 1);
    // current + previous must remain
    const cur = readFileSync(path.join(tmp, "current"), "utf8").trim();
    const prev = readFileSync(path.join(tmp, "previous"), "utf8").trim();
    assert.ok(cur);
    assert.ok(prev);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("admin login route rejects GET; page rejects query auth pattern", () => {
  const login = readFileSync(
    path.join(root, "app/api/admin/login/route.ts"),
    "utf8"
  );
  const index = readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
  const traffic = readFileSync(
    path.join(root, "app/admin/traffic/page.tsx"),
    "utf8"
  );
  const loginForm = readFileSync(
    path.join(root, "components/admin-dashboard/AdminLoginForm.tsx"),
    "utf8"
  );
  assert.match(login, /method_not_allowed/);
  assert.match(index, /redirect\("\/admin\/dashboard"\)/);
  assert.match(traffic, /Query-string secrets are rejected/);
  assert.doesNotMatch(traffic, /searchParams\.key\s*\|\|/);
  assert.doesNotMatch(loginForm, /searchParams\.key/);
  assert.doesNotMatch(loginForm, /PersistKey/);
});

test("deploy/rollback scripts exist", () => {
  assert.ok(
    readFileSync(path.join(root, "deploy/release-deploy.sh"), "utf8").includes(
      "releases"
    )
  );
  assert.ok(
    readFileSync(path.join(root, "scripts/rollback-release.sh"), "utf8").includes(
      "previous"
    )
  );
});
