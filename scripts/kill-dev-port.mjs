/**
 * Free ports 3000–3002 for local Next.js (Windows: stuck node after crash).
 */
import { execSync } from "child_process";

const ports = [3000, 3001, 3002];

function pidsOnPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port} "`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (pid > 0) pids.add(pid);
    }
    return pids;
  } catch {
    return new Set();
  }
}

for (const port of ports) {
  for (const pid of pidsOnPort(port)) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`[kill-dev-port] Stopped PID ${pid} on port ${port}`);
    } catch {
      /* already gone */
    }
  }
}
