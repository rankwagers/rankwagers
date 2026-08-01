import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const distDir = process.env.NEXT_DIST_DIR || ".next-build";
rmSync(distDir, { recursive: true, force: true });

const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const result = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: distDir },
});

process.exit(result.status ?? 1);
