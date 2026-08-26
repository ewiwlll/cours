import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
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
