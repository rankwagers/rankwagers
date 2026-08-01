/**
 * Generate docs/route-inventory.generated.md from the app directory.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const appDir = path.join(root, "app");

function walk(dir, base = "") {
  const rows = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.join(base, name).replace(/\\/g, "/");
    const st = statSync(full);
    if (st.isDirectory()) {
      rows.push(...walk(full, rel));
      continue;
    }
    if (name === "route.ts" || name === "page.tsx" || name === "page.ts") {
      const routePath =
        "/" +
        rel
          .replace(/\/route\.ts$/, "")
          .replace(/\/page\.tsx?$/, "")
          .replace(/\[([^\]]+)\]/g, ":$1")
          .replace(/\/\([^)]+\)/g, "");
      const kind =
        routePath.startsWith("/api/internal")
          ? "protected_internal"
          : routePath.includes("/diagnostics") ||
              routePath === "/api/crawl-quality" ||
              routePath === "/api/data-quality"
            ? "protected_diagnostics"
            : routePath.startsWith("/api/health")
              ? "health"
              : routePath.startsWith("/api/")
                ? "public_api"
                : routePath.startsWith("/go")
                  ? "affiliate_redirect"
                  : routePath.startsWith("/admin")
                    ? "admin"
                    : routePath.startsWith("/developer")
                      ? "developer_only"
                      : name.startsWith("page")
                        ? "public_page"
                        : "other";
      rows.push({
        path: routePath || "/",
        file: path.join("app", rel).replace(/\\/g, "/"),
        kind,
        type: name.startsWith("route") ? "route" : "page",
      });
    }
  }
  return rows;
}

const inventory = walk(appDir).sort((a, b) => a.path.localeCompare(b.path));
const byKind = {};
for (const row of inventory) {
  byKind[row.kind] ??= [];
  byKind[row.kind].push(row);
}

const lines = [
  "# Route inventory (generated)",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Total routes/pages: ${inventory.length}`,
  "",
];

for (const [kind, rows] of Object.entries(byKind).sort()) {
  lines.push(`## ${kind} (${rows.length})`, "");
  for (const r of rows) {
    lines.push(`- \`${r.path}\` — ${r.type} — \`${r.file}\``);
  }
  lines.push("");
}

const out = path.join(root, "docs", "route-inventory.generated.md");
if (!existsSync(path.dirname(out))) mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, lines.join("\n"), "utf8");
console.log(JSON.stringify({ ok: true, count: inventory.length, out: "docs/route-inventory.generated.md" }));
