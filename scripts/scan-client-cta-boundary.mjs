/**
 * Fail if any "use client" module imports server-only CTA/signing code
 * (direct import paths). Also scans client chunks after build when .next exists.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN_IMPORT_RE =
  /from\s+["'](?:@\/)?(?:lib\/operators\/(?:go-path|redirect-token|brandListItems)|lib\/affiliate\/signOffers|lib\/security\/adminAuth)["']|require\(["'](?:@\/)?(?:lib\/operators\/(?:go-path|redirect-token|brandListItems)|lib\/affiliate\/signOffers)["']\)|from\s+["']node:crypto["']|from\s+["']server-only["']/;

const findings = [];

function walk(dir, out = [], { skipDotNext = true, extRe = /\.(tsx?|jsx?)$/ } = {}) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "design") continue;
    if (skipDotNext && name === ".next") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out, { skipDotNext, extRe });
    else if (extRe.test(name)) out.push(full);
  }
  return out;
}

const files = [
  ...walk(path.join(root, "components")),
  ...walk(path.join(root, "app")),
  ...walk(path.join(root, "lib")),
];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const isClient =
    /^\s*["']use client["']\s*;?/m.test(src) ||
    src.includes('"use client"') ||
    src.includes("'use client'");
  if (!isClient) continue;
  if (FORBIDDEN_IMPORT_RE.test(src)) {
    findings.push({
      file: path.relative(root, file).replace(/\\/g, "/"),
      kind: "client_imports_server_signing",
    });
  }
}

// Post-build client chunk scan (optional if .next present)
let chunkScanned = 0;
const chunksDir = path.join(root, ".next", "static", "chunks");
if (existsSync(chunksDir)) {
  const chunkFiles = walk(chunksDir, [], {
    skipDotNext: false,
    extRe: /\.js$/,
  });
  chunkScanned = chunkFiles.length;
  const secretish =
    /AFFILIATE_REDIRECT_SECRET|AFFILIATE_REDIRECT_PREVIOUS_SECRET|dev-only-redirect-secret|createHmac\(|node:crypto/;
  for (const file of chunkFiles) {
    const src = readFileSync(file, "utf8");
    if (secretish.test(src)) {
      findings.push({
        file: path.relative(root, file).replace(/\\/g, "/"),
        kind: "client_chunk_secret_or_crypto",
      });
    }
  }
}

const ok = findings.length === 0;
console.log(
  JSON.stringify(
    { ok, findings, scanned: files.length, clientChunksScanned: chunkScanned },
    null,
    2
  )
);
process.exit(ok ? 0 : 1);
