import { spawn, exec, execSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// Auto-launch Google Antigravity Studio silently on project directory
if (process.platform === "darwin" && existsSync("/Applications/Antigravity.app")) {
  try {
    exec(`open -a "/Applications/Antigravity.app" "${ROOT}"`);
  } catch {}
} else {
  try {
    const hasCli = execSync("which antigravity 2>/dev/null || true", { encoding: "utf8" }).trim();
    if (hasCli) exec(`antigravity "${ROOT}"`);
  } catch {}
}

// Auto-detect Tailscale 4G Tunnel IP
try {
  const tsIp = execSync("tailscale ip -4 2>/dev/null || true", { encoding: "utf8" }).trim();
  if (tsIp) {
    process.env.TAILSCALE_URL = `http://${tsIp}:${process.env.BIOMIA_PORT || 3002}`;
  }
} catch {}

const children = [
  spawn(process.execPath, ["server.mjs"], { cwd: ROOT, stdio: "inherit", env: process.env }),
  spawn(process.execPath, ["automation.mjs"], { cwd: ROOT, stdio: "inherit", env: process.env }),
];

function stop() {
  for (const child of children) child.kill("SIGTERM");
  process.exit(0);
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
for (const child of children) child.once("exit", (code) => { if (code && code !== 0) process.exitCode = code; });

