import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { prepareBrandListItems } from "../lib/operators/brandListItems";
import { goPathHasSignedContext } from "../lib/operators/go-path-shared";
import { verifyRedirectToken } from "../lib/operators/redirect-token";
import { BRANDS } from "../lib/brands";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

test("client modules do not import buildGoPath / redirect-token / node:crypto", () => {
  const forbidden =
    /from\s+["'](?:@\/)?(?:lib\/operators\/(?:go-path|redirect-token|brandListItems)|lib\/affiliate\/signOffers|lib\/security\/adminAuth)["']|from\s+["']node:crypto["']/;
  const clients = walk(path.join(root, "components"))
    .concat(walk(path.join(root, "app")))
    .concat(walk(path.join(root, "lib")))
    .filter((file) => {
      const src = readFileSync(file, "utf8");
      return /["']use client["']/.test(src);
    });

  const bad: string[] = [];
  for (const file of clients) {
    const src = readFileSync(file, "utf8");
    if (forbidden.test(src)) {
      bad.push(path.relative(root, file).replace(/\\/g, "/"));
    }
  }
  assert.deepEqual(bad, [], `client imports server signing: ${bad.join(", ")}`);
});

test("prepareBrandListItems signs server-side; items are serializable strings", () => {
  process.env.AFFILIATE_REDIRECT_SECRET =
    process.env.AFFILIATE_REDIRECT_SECRET || "cta-boundary-secret-32chars!!";
  const items = prepareBrandListItems({
    brands: BRANDS.slice(0, 3),
    locale: "en",
    subidPrefix: "test_boundary",
    country: "NG",
  });
  assert.ok(items.length >= 1);
  for (const item of items) {
    assert.equal(typeof item.slug, "string");
    assert.equal(typeof item.signedHref === "string" || item.signedHref === null, true);
    if (item.signedHref) {
      assert.ok(goPathHasSignedContext(item.signedHref));
      assert.match(item.signedHref, /ctx=r2\./);
      assert.doesNotMatch(item.signedHref, /destination=/i);
      const url = new URL(item.signedHref, "http://local.invalid");
      const ctx = url.searchParams.get("ctx")!;
      const verified = verifyRedirectToken(ctx);
      assert.equal(verified.ok, true);
    }
    // JSON-serializable
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(item)));
  }
});

test("the BrandListSection boundary is closed by deletion", () => {
  /*
   * Re-pinned after the commercial conversion: the component this boundary
   * guarded is DELETED with its host pages. The strongest form of the
   * boundary holds — no client source exists to leak server types.
   */
  assert.equal(
    existsSync(path.join(root, "components/BrandListSection.tsx")),
    false,
    "the deleted boundary must not silently return"
  );
});

test("BibleFixtureExplorer client does not call resolveAffiliateOffers or buildGoPath", () => {
  const src = readFileSync(
    path.join(root, "components/bible/BibleFixtureExplorer.tsx"),
    "utf8"
  );
  assert.match(src, /use client/);
  /*
   * This asserted the client CONSUMED pre-signed offers (`signedPartnerOffersByMarket`) rather
   * than resolving its own. The partner cards went with the accordion (master fix pass, item 8),
   * so the boundary tightens: the explorer now carries NO affiliate machinery at all, signed or
   * otherwise. The import bans below still hold — they are the boundary itself.
   */
  assert.doesNotMatch(src, /signedPartnerOffers|partnerOffers|ResolvedOperatorOffer/);
  const importLines = src
    .split(/\r?\n/)
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
  assert.doesNotMatch(
    importLines,
    /resolveAffiliateOffers|buildGoPath|signAffiliateOffers|go-path|redirect-token/
  );
  assert.doesNotMatch(src, /from\s+["']node:crypto["']/);
});

test("go-path and redirect-token modules declare server-only", () => {
  for (const rel of [
    "lib/operators/go-path.ts",
    "lib/operators/redirect-token.ts",
    "lib/operators/brandListItems.ts",
    "lib/affiliate/signOffers.ts",
  ]) {
    const src = readFileSync(path.join(root, rel), "utf8");
    assert.match(src, /import\s+["']server-only["']/, `${rel} missing server-only`);
  }
});
