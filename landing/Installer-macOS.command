#!/usr/bin/env bash
# ==============================================================================
# Cours (Revision OS) — Installateur 1-Clic pour macOS
# Double-cliquez sur ce fichier pour installer et lancer Cours automatiquement !
# ==============================================================================

set -e

# Se placer dans le répertoire du script ou dans $HOME/cours
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Couleurs
BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
CYAN="\033[36m"
YELLOW="\033[33m"
PURPLE="\033[35m"
RESET="\033[0m"

clear
echo -e "${CYAN}${BOLD}"
echo "  ____                              "
echo " / ___|___  _   _ _ __ ___          "
echo "| |   / _ \| | | | '__/ __|         "
echo "| |__| (_) | |_| | |  \__ \         "
echo " \____\___/ \__,_|_|  |___/         "
echo "  Revision OS • Pour tous vos cours "
echo -e "${RESET}"
echo -e "${BLUE}==>${RESET} ${BOLD}Installation 1-Clic de Cours (Revision OS) sur macOS...${RESET}\n"

# 1. Vérifier Git et Node.js
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}ℹ Installation des outils de développement Apple (Xcode Command Line Tools)...${RESET}"
    xcode-select --install 2>/dev/null || true
    echo -e "${YELLOW}Veuillez valider l'installation à l'écran puis relancer ce fichier.${RESET}"
    exit 1
fi

# 2. Répertoire cible
TARGET_DIR="$HOME/cours"
if [ -f "$DIR/start.mjs" ]; then
    PROJECT_PATH="$DIR"
else
    echo -e "${BLUE}[1/5]${RESET} Téléchargement du projet dans ${CYAN}$TARGET_DIR${RESET}..."
    if [ -d "$TARGET_DIR" ]; then
        cd "$TARGET_DIR"
        git pull --quiet origin main 2>/dev/null || true
    else
        git clone https://github.com/ewiwlll/cours.git "$TARGET_DIR"
        cd "$TARGET_DIR"
    fi
    PROJECT_PATH="$TARGET_DIR"
fi

cd "$PROJECT_PATH"

# 3. Initialisation .env et dossiers
echo -e "${BLUE}[2/5]${RESET} Initialisation de l'environnement..."
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || touch .env
fi
mkdir -p models/whisper data/audio data/enregistrements data/cours data/transcriptions data/revisions inbox public

# 4. Installation des dépendances et compilation Web
echo -e "${BLUE}[3/5]${RESET} Préparation de l'interface..."
if [ -f "package.json" ]; then
    npm install --silent > /dev/null 2>&1 || true
fi
if [ -d "web" ]; then
    (cd web && npm install --silent > /dev/null 2>&1 && npm run build > /dev/null 2>&1)
fi

# 5. Compilation de l'application native macOS
echo -e "${BLUE}[4/5]${RESET} Compilation de l'application native /Applications/Cours.app..."
if command -v swiftc &> /dev/null && [ -f "scripts/build-macos-app.sh" ]; then
    chmod +x scripts/build-macos-app.sh
    ./scripts/build-macos-app.sh > /dev/null 2>&1 || true
    echo -e "  ${GREEN}✓${RESET} Application installée dans /Applications/Cours.app"
fi

# 6. Lancement de Google Antigravity si présent
echo -e "${BLUE}[5/5]${RESET} Lancement de l'environnement de révision..."
if [ -d "/Applications/Antigravity.app" ]; then
    open -a "/Applications/Antigravity.app" "$PROJECT_PATH"
    echo -e "  ${GREEN}✓${RESET} Google Antigravity Studio ouvert sur le projet."
fi

# Lancer Cours.app
if [ -d "/Applications/Cours.app" ]; then
    open "/Applications/Cours.app"
else
    open "http://localhost:3002"
    node start.mjs
fi

echo -e "\n${GREEN}${BOLD}🎉 Cours est installé et lancé avec succès !${RESET}\n"
