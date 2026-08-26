#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const child = spawn(process.execPath, [path.join(ROOT, "start.mjs"), ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

function stop() {
  child.kill("SIGTERM");
  process.exit(0);
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
child.once("exit", (code) => process.exit(code || 0));
