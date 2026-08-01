/**
 * Removes stale or production .next output before dev/build.
 * Windows: `next build` then `next dev` without cleaning causes missing ./682.js errors.
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const nextDir = path.join(root, ".next");

function loadDotEnvFile(name) {
  const envPath = path.join(root, name);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
const serverDir = path.join(nextDir, "server");
const lifecycle = process.env.npm_lifecycle_event || "";
const isDevStart = ["dev", "dev:clean", "dev:fresh"].includes(lifecycle);
const isBuild = lifecycle === "build";

function chunkCandidates(chunk) {
  return [
    path.join(serverDir, chunk),
    path.join(serverDir, "chunks", chunk),
    path.join(nextDir, "server", "chunks", chunk),
  ];
}

function resolveChunkPath(fromFile, chunk) {
  const local = path.join(path.dirname(fromFile), chunk);
  if (fs.existsSync(local)) return local;
  for (const p of chunkCandidates(chunk)) {
    if (fs.existsSync(p)) return p;
  }
  return local;
}

function missingChunkInFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  const re = /(?:require|import)\(["']\.\/(\d+\.js)["']\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const chunk = m[1];
    const chunkPath = resolveChunkPath(filePath, chunk);
    if (!fs.existsSync(chunkPath)) {
      return chunk;
    }
  }
  return null;
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name.endsWith(".js")) {
      const missing = missingChunkInFile(full);
      if (missing) return missing;
    }
    if (fs.statSync(full).isDirectory() && name !== "node_modules") {
      const nested = scanDir(full);
      if (nested) return nested;
    }
  }
  return null;
}

function readHead(filePath, len = 12000) {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8").slice(0, len);
}

function isDevWebpackRuntime() {
  const head = readHead(path.join(serverDir, "webpack-runtime.js"), 4000);
  return head.includes("eval-source-map") || head.includes("webpackBootstrap");
}

function isProductionPagesBundle() {
  const doc = path.join(serverDir, "pages", "_document.js");
  if (!fs.existsSync(doc)) return false;
  const content = fs.readFileSync(doc, "utf8");
  return (
    content.includes("pages.runtime.prod") ||
    content.includes("next/dist/compiled/next-server/pages.runtime.prod")
  );
}

/** App Router production output breaks `next dev` (missing ./948.js etc.). */
function isProductionAppBundle() {
  const appDir = path.join(serverDir, "app");
  if (!fs.existsSync(appDir)) return false;

  const stack = [appDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!name.endsWith(".js") || name.endsWith(".js.map")) continue;
      const head = readHead(full);
      if (
        head.includes("app-page.runtime.prod") ||
        head.includes("next/dist/compiled/next-server/app-page.runtime.prod")
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Prod pages stub expects chunk in server/; dev only has server/chunks/682.js */
function productionPagesChunkMismatch() {
  const doc = path.join(serverDir, "pages", "_document.js");
  if (!fs.existsSync(doc)) return false;
  const content = fs.readFileSync(doc, "utf8");
  const m = content.match(/r\.X\(\d+,\[(\d+)\]/);
  if (!m) return false;
  const chunk = `${m[1]}.js`;
  if (fs.existsSync(path.join(serverDir, chunk))) return false;
  if (fs.existsSync(path.join(serverDir, "chunks", chunk))) return true;
  return false;
}

/** Dev webpack-runtime + production App/pages bundles cannot run under `next dev`. */
function isMixedDevProdOutput() {
  if (!isDevWebpackRuntime()) return false;
  return isProductionAppBundle() || isProductionPagesBundle();
}

function purge(reason) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log(`[prepare-dev] Removed stale .next (${reason}).`);
}

if (!fs.existsSync(nextDir)) {
  process.exit(0);
}

if (isBuild) {
  loadDotEnvFile(".env");
  loadDotEnvFile(".env.local");
  const site = (process.env.SITE_URL || "").trim();
  if (
    !site ||
    /localhost|127\.0\.0\.1/i.test(site) ||
    !/^https:\/\//i.test(site)
  ) {
    console.error(
      "[prepare-dev] Production build blocked: SITE_URL must be https://your-public-domain in .env (not http:// or localhost)."
    );
    process.exit(1);
  }
}

if (isBuild && isDevWebpackRuntime()) {
  purge("dev webpack-runtime before production build");
  process.exit(0);
}

if (isDevStart && isMixedDevProdOutput()) {
  purge("mixed dev webpack-runtime + production server bundles");
  process.exit(0);
}

if (isDevStart && isProductionPagesBundle()) {
  purge("production pages bundle — never run next dev on build output");
  process.exit(0);
}

if (isDevStart && isProductionAppBundle()) {
  purge("production App Router bundle — run dev:clean after npm run build");
  process.exit(0);
}

if (isDevStart && productionPagesChunkMismatch()) {
  purge("production pages chunk path mismatch (e.g. missing ./682.js)");
  process.exit(0);
}

if (isDevStart && isDevWebpackRuntime() && fs.existsSync(path.join(serverDir, "pages"))) {
  purge("dev server with leftover server/pages from production build");
  process.exit(0);
}

const runtimePath = path.join(serverDir, "webpack-runtime.js");
const missingFromRuntime = missingChunkInFile(runtimePath);
if (missingFromRuntime) {
  purge(`webpack-runtime missing ./${missingFromRuntime}`);
  process.exit(0);
}

const docPath = path.join(serverDir, "pages", "_document.js");
const missingFromDoc = missingChunkInFile(docPath);
if (missingFromDoc) {
  purge(`pages/_document.js missing ./${missingFromDoc}`);
  process.exit(0);
}

const missing = scanDir(serverDir);
if (missing) {
  purge(`missing server chunk ./${missing}`);
}
