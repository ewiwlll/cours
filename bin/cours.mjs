#!/usr/bin/env node
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2];

if (command === "update") {
  console.log("\x1b[36m\x1b[1m==> Mise à jour de Cours (Revision OS)...\x1b[0m\n");
  try {
    console.log("[1/3] Récupération de la dernière version depuis GitHub...");
    execSync("git pull origin main", { cwd: ROOT, stdio: "inherit" });

    console.log("\n[2/3] Mise à jour des dépendances...");
    execSync("npm install --silent", { cwd: ROOT, stdio: "inherit" });

    console.log("\n[3/3] Recompilation de l'interface Web...");
    execSync("npm run build:web", { cwd: ROOT, stdio: "inherit" });

    console.log("\n\x1b[32m\x1b[1m🎉 Cours a été mis à jour avec succès !\x1b[0m");
    console.log("Lancez l'application avec : \x1b[36mcours\x1b[0m\n");
  } catch (err) {
    console.error("\x1b[31mErreur lors de la mise à jour :\x1b[0m", err.message);
    process.exit(1);
  }
  process.exit(0);
}

if (command === "tailscale") {
  console.log("\x1b[36m\x1b[1m==> Configuration Tailscale pour la synchronisation 4G...\x1b[0m\n");
  try {
    const isMac = process.platform === "darwin";
    let hasTailscale = false;
    try {
      execSync("which tailscale", { stdio: "ignore" });
      hasTailscale = true;
    } catch {}

    if (!hasTailscale) {
      console.log("Tailscale n'est pas encore installé. Installation...");
      if (isMac) {
        execSync("brew install tailscale || open https://tailscale.com/download/mac", { stdio: "inherit" });
      } else {
        execSync("curl -fsSL https://tailscale.com/install.sh | sh", { stdio: "inherit" });
      }
    } else {
      console.log("\x1b[32m✓ Tailscale est déjà installé.\x1b[0m");
      try {
        const ip = execSync("tailscale ip -4", { encoding: "utf8" }).trim();
        console.log(`\x1b[35m📱 Votre IP Tailscale 4G est : ${ip}\x1b[0m`);
        console.log(`👉 URL d'accès direct sur smartphone : http://${ip}:3002`);
      } catch {
        console.log("Tailscale est en pause. Pour l'activer : \x1b[33mtailscale up\x1b[0m");
      }
    }
  } catch (err) {
    console.error("\x1b[31mErreur Tailscale :\x1b[0m", err.message);
  }
  process.exit(0);
}

if (command === "test") {
  execSync("npm test", { cwd: ROOT, stdio: "inherit" });
  process.exit(0);
}

// Default: Start Server
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
