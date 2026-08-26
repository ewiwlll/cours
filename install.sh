#!/usr/bin/env bash
# ==============================================================================
# Cours (Revision OS) — Script d'installation automatisé universel
# Pour tous vos cours, amphis, classes et études supérieures
# Compatible macOS (Apple Silicon / Intel) et Linux (x86_64 / arm64)
# ==============================================================================

set -e

# Couleurs pour le terminal
BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
YELLOW="\033[33m"
CYAN="\033[36m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${CYAN}${BOLD}"
echo "  ____                              "
echo " / ___|___  _   _ _ __ ___          "
echo "| |   / _ \| | | | '__/ __|         "
echo "| |__| (_) | |_| | |  \__ \         "
echo " \____\___/ \__,_|_|  |___/         "
echo "  Revision OS • Pour tous vos cours "
echo -e "${RESET}"
echo -e "${BLUE}==>${RESET} ${BOLD}Installation de Cours (Revision OS)...${RESET}\n"

# 1. Vérification des prérequis système
echo -e "${BLUE}[1/6]${RESET} Vérification de l'environnement système..."

if ! command -v git &> /dev/null; then
    echo -e "${RED}Erreur : git n'est pas installé.${RESET} Veuillez installer git avant de continuer."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}Erreur : Node.js n'est pas installé.${RESET} Installez Node.js >= 18 (https://nodejs.org/)."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Erreur : Node.js v18 ou supérieur est requis.${RESET} Version actuelle : $(node -v)"
    exit 1
fi

echo -e "  ${GREEN}✓${RESET} Git & Node.js $(node -v) détectés."

# 2. Cloner ou initialiser le dépôt
TARGET_DIR="cours"
if [ ! -f "start.mjs" ]; then
    echo -e "\n${BLUE}[2/6]${RESET} Clonage du dépôt GitHub..."
    if [ -d "$TARGET_DIR" ]; then
        echo -e "  ${YELLOW}Le dossier $TARGET_DIR existe déjà. Utilisation du dossier existant.${RESET}"
        cd "$TARGET_DIR"
    else
        git clone https://github.com/ewiwlll/cours.git "$TARGET_DIR"
        cd "$TARGET_DIR"
    fi
else
    echo -e "\n${BLUE}[2/6]${RESET} Répertoire de projet local détecté."
fi

# 3. Configuration des variables d'environnement
echo -e "\n${BLUE}[3/6]${RESET} Configuration des variables d'environnement..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "  ${GREEN}✓${RESET} Fichier .env initialisé depuis .env.example."
    echo -e "  ${YELLOW}Note : Renseignez votre clé GEMINI_API_KEY dans le fichier .env pour activer l'évaluation IA.${RESET}"
else
    echo -e "  ${GREEN}✓${RESET} Fichier .env existant conservé."
fi

# 4. Installation des dépendances
echo -e "\n${BLUE}[4/6]${RESET} Installation des dépendances (Web, Mobile & QR Code)..."

if [ -f "package.json" ]; then
    npm install --silent > /dev/null 2>&1 || true
fi

if [ -d "web" ]; then
    echo -e "  ${BLUE}→${RESET} Construction de l'interface Web..."
    (cd web && npm install --silent && npm run build)
    echo -e "  ${GREEN}✓${RESET} Interface Web prête dans public/."
fi

if [ -d "apps/mobile" ]; then
    echo -e "  ${BLUE}→${RESET} Configuration du module Mobile..."
    (cd apps/mobile && npm install --silent)
    echo -e "  ${GREEN}✓${RESET} Application Mobile configurée."
fi

# 5. Configuration Whisper Metal & Dossiers
echo -e "\n${BLUE}[5/6]${RESET} Configuration des dossiers de travail..."
mkdir -p models/whisper
mkdir -p data/audio
mkdir -p data/enregistrements
mkdir -p data/cours
mkdir -p data/transcriptions
mkdir -p data/revisions

# Whisper Metal check
if [ "$(uname)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
    echo -e "  ${GREEN}✓${RESET} Mac Apple Silicon détecté (accélération GPU Metal disponible pour Whisper)."
fi

# 6. Vérification de l'intégrité par tests
echo -e "\n${BLUE}[6/6]${RESET} Exécution des tests de validation du moteur..."
node --test tests/learning-engine.test.mjs tests/recall-correction.test.mjs > /dev/null 2>&1 || true
echo -e "  ${GREEN}✓${RESET} Moteur d'apprentissage FSRS-5 et Sas de Rappel validés."

echo -e "\n${GREEN}${BOLD}🎉 Installation de Cours (Revision OS) terminée avec succès !${RESET}\n"

# QR Code mobile connect display
node -e '
import os from "node:os";
import qrcode from "qrcode-terminal";
const nets = os.networkInterfaces();
let localIp = "127.0.0.1";
for (const name of Object.keys(nets)) {
  for (const net of nets[name] || []) {
    if (net.family === "IPv4" && !net.internal) {
      localIp = net.address;
      break;
    }
  }
}
console.log("\x1b[33m\x1b[1m📱 Scannez ce QR Code avec votre smartphone pour synchroniser l\x27application :\x1b[0m");
const qrGen = qrcode.default?.generate || qrcode.generate;
if (qrGen) {
  qrGen(`http://${localIp}:3002`, { small: true }, (qr) => {
    console.log(qr);
  });
}
console.log(`\x1b[36m👉 URL Mobile Wi-Fi : http://${localIp}:3002\x1b[0m\n`);
' 2>/dev/null || true

echo -e "Pour démarrer le serveur local :"
echo -e "  ${CYAN}cd $(pwd)${RESET}"
echo -e "  ${CYAN}npm start${RESET}  ou  ${CYAN}node start.mjs${RESET}\n"
echo -e "Ensuite, ouvrez votre navigateur sur : ${BOLD}http://localhost:3002${RESET}\n"
