/**
 * Lightweight secret / placeholder scan for source + build output.
 * Exit 1 on findings. Does not print secret values — only paths/patterns.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const patterns = [
  { name: "example_com_canonical", re: /https?:\/\/(www\.)?example\.com/i },
  { name: "your_domain_placeholder", re: /your-domain\.com/i },
  { name: "weak_admin_default", re: /ADMIN_KEY\s*=\s*["']?admin["']?/i },
  { name: "weak_redirect_default", re: /dev-only-redirect-secret-change-me/ },
  { name: "postgres_url_literal", re: /postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'`]+@/i },
  { name: "aws_key_like", re: /AKIA[0-9A-Z]{16}/ },
];

const skipDirs = new Set([
  "node_modules",
  ".git",
  ".next",
  ".next-build",
  "aff-panel",
  "marketingskills",
  "telegram-eng",
  "telegram-invite-bots",
  "coverage",
]);

const allowFiles = new Set([
  path.join("docs", "security-audit-phase-d.md"),
  path.join("docs", "security.md"),
  path.join("lib", "config", "env.ts"),
  path.join("lib", "operators", "redirect-token.ts"),
  path.join("scripts", "security-scan.mjs"),
  path.join(".env.example"),
  path.join("tests", "sprint17Env.test.ts"),
  path.join("tests", "sprint17Security.test.ts"),
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs|cjs|json|md|env)$/i.test(name)) out.push(full);
  }
  return out;
}

const targets = [
  ...walk(path.join(root, "app")),
  ...walk(path.join(root, "lib")),
  ...walk(path.join(root, "components")),
  ...walk(path.join(root, "scripts")),
];

if (existsSync(path.join(root, ".next"))) {
  // Scan a sample of client chunks if present
  const staticDir = path.join(root, ".next", "static", "chunks");
  if (existsSync(staticDir)) {
    for (const f of readdirSync(staticDir).slice(0, 40)) {
      if (f.endsWith(".js")) targets.push(path.join(staticDir, f));
    }
  }
}

const findings = [];
for (const file of targets) {
  const rel = path.relative(root, file);
  if ([...allowFiles].some((a) => rel.replace(/\\/g, "/").endsWith(a.replace(/\\/g, "/")))) {
    continue;
  }
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const p of patterns) {
    if (p.re.test(text)) {
      findings.push({ file: rel, pattern: p.name });
    }
  }
}

if (findings.length) {
  console.error(JSON.stringify({ ok: false, findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, scanned: targets.length }));
