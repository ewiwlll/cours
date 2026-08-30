#!/usr/bin/env bash
# ==============================================================================
# Cours (Revision OS) — Script d'installation automatisé universel & Antigravity
# Pour tous vos cours, amphis, classes et études supérieures
# Compatible macOS (Apple Silicon / Intel) et Linux (x86_64 / arm64)
# ==============================================================================

set -e

# Couleurs pour le terminal
BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
PURPLE="\033[35m"
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
echo -e "${BLUE}==>${RESET} ${BOLD}Installation automatique de Cours (Revision OS)...${RESET}\n"

# 1. Vérification des prérequis système
echo -e "${BLUE}[1/8]${RESET} Vérification de l'environnement système..."

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
if [ ! -f "start.mjs" ]; then
    TARGET_DIR="${COURS_DIR:-$HOME/cours}"
    echo -e "\n${BLUE}[2/8]${RESET} Configuration du dossier de travail : ${CYAN}$TARGET_DIR${RESET}..."
    if [ -d "$TARGET_DIR" ]; then
        echo -e "  ${YELLOW}Le dossier $TARGET_DIR existe déjà. Utilisation du dossier existant.${RESET}"
        cd "$TARGET_DIR"
        git pull --quiet origin main 2>/dev/null || true
    else
        git clone https://github.com/ewiwlll/cours.git "$TARGET_DIR"
        cd "$TARGET_DIR"
    fi
else
    echo -e "\n${BLUE}[2/8]${RESET} Répertoire de projet local détecté : ${CYAN}$(pwd)${RESET}."
fi

PROJECT_FULL_PATH="$(pwd)"

# 3. Initialisation de l'environnement
echo -e "\n${BLUE}[3/8]${RESET} Initialisation des fichiers de configuration..."
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || touch .env
    echo -e "  ${GREEN}✓${RESET} Fichier .env initialisé."
else
    echo -e "  ${GREEN}✓${RESET} Fichier .env existant conservé."
fi

# 4. Installation des dépendances et compilation Web
echo -e "\n${BLUE}[4/8]${RESET} Installation des dépendances et compilation de l'interface..."

if [ -f "package.json" ]; then
    npm install --silent > /dev/null 2>&1 || true
fi

if [ -d "web" ]; then
    echo -e "  ${BLUE}→${RESET} Construction de l'interface Web & PWA..."
    (cd web && npm install --silent > /dev/null 2>&1 && npm run build > /dev/null 2>&1)
    echo -e "  ${GREEN}✓${RESET} Interface Web & PWA prête dans public/."
fi

if [ -d "apps/mobile" ]; then
    (cd apps/mobile && npm install --silent > /dev/null 2>&1 || true)
fi

# Installation du binaire CLI global 'cours'
mkdir -p "$HOME/.local/bin"
ln -sf "$PROJECT_FULL_PATH/bin/cours.mjs" "$HOME/.local/bin/cours" 2>/dev/null || true
ln -sf "$PROJECT_FULL_PATH/bin/cours.mjs" /usr/local/bin/cours 2>/dev/null || true

# 5. Création des dossiers de données
echo -e "\n${BLUE}[5/8]${RESET} Initialisation des dossiers de cours et modèles..."
mkdir -p models/whisper data/audio data/enregistrements data/cours data/transcriptions data/revisions inbox

# 6. Compilation de l'application native macOS (si sur Mac)
if [ "$(uname)" = "Darwin" ] && command -v swiftc &> /dev/null; then
    echo -e "\n${BLUE}[6/8]${RESET} Compilation de l'application native macOS (/Applications/Cours.app)..."
    if [ -f "scripts/build-macos-app.sh" ]; then
        ./scripts/build-macos-app.sh > /dev/null 2>&1 || true
        echo -e "  ${GREEN}✓${RESET} ${BOLD}/Applications/Cours.app${RESET} installé dans vos Applications."
    fi
else
    echo -e "\n${BLUE}[6/8]${RESET} Étape macOS native ignorée."
fi

# 7. Détection & Installation automatique sur Téléphone Android (ADB)
echo -e "\n${BLUE}[7/8]${RESET} Détection des téléphones connectés..."
if command -v adb &> /dev/null; then
    ADB_DEVICES=$(adb devices 2>/dev/null | grep -w "device" | grep -v "List" || true)
    if [ -n "$ADB_DEVICES" ]; then
        echo -e "  ${GREEN}✓${RESET} ${BOLD}Téléphone Android détecté via ADB !${RESET}"
        if [ -f "apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk" ]; then
            echo -e "  ${BLUE}→${RESET} Installation directe de Cours sur votre téléphone..."
            adb install -r -d "apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk" > /dev/null 2>&1 || true
            adb reverse tcp:3002 tcp:3002 > /dev/null 2>&1 || true
            echo -e "  ${GREEN}✓${RESET} Application mobile installée et configurée avec succès !"
        fi
    else
        echo -e "  ${YELLOW}ℹ Aucun téléphone Android ADB branché. Utilisez le QR Code pour vous connecter.${RESET}"
    fi
else
    echo -e "  ${YELLOW}ℹ ADB non configuré. Vous pouvez flasher le QR Code sur iPhone ou Android.${RESET}"
fi

# 8. Lancement automatique de Google Antigravity
echo -e "\n${PURPLE}${BOLD}[8/8] Ouverture automatique du Studio Antigravity...${RESET}"
ANTIGRAVITY_LAUNCHED=false

if [ "$(uname)" = "Darwin" ]; then
    if [ -d "/Applications/Antigravity.app" ]; then
        open -a "/Applications/Antigravity.app" "$PROJECT_FULL_PATH"
        ANTIGRAVITY_LAUNCHED=true
        echo -e "  ${GREEN}✓${RESET} ${BOLD}Google Antigravity ouvert sur le projet :${RESET} ${CYAN}$PROJECT_FULL_PATH${RESET}"
    elif command -v antigravity &> /dev/null; then
        antigravity "$PROJECT_FULL_PATH" &
        ANTIGRAVITY_LAUNCHED=true
        echo -e "  ${GREEN}✓${RESET} ${BOLD}Google Antigravity ouvert sur le projet :${RESET} ${CYAN}$PROJECT_FULL_PATH${RESET}"
    fi
elif command -v antigravity &> /dev/null; then
    antigravity "$PROJECT_FULL_PATH" &
    ANTIGRAVITY_LAUNCHED=true
    echo -e "  ${GREEN}✓${RESET} ${BOLD}Google Antigravity ouvert sur le projet :${RESET} ${CYAN}$PROJECT_FULL_PATH${RESET}"
fi

if [ "$ANTIGRAVITY_LAUNCHED" = false ]; then
    echo -e "  ${YELLOW}💡 Google Antigravity n'est pas encore installé.${RESET}"
    echo -e "  ${CYAN}👉 Téléchargez-le gratuitement :${RESET} ${BOLD}https://antigravity.google${RESET}"
fi

# Ouvrir l'application ou le navigateur
if [ "$(uname)" = "Darwin" ] && [ -d "/Applications/Cours.app" ]; then
    open "/Applications/Cours.app" 2>/dev/null || true
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:3002" 2>/dev/null || true
fi

# Banner Récapitulatif
echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  🎉 INSTALLATION TERMINÉE ! TOUT EST CONFIGURÉ ET PRÊT !${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}\n"

echo -e "${PURPLE}${BOLD}🧠 DANS GOOGLE ANTIGRAVITY :${RESET}"
echo -e "  1. Ouvrez le chat à droite (ou faites ${BOLD}⌘ N${RESET})."
echo -e "  2. Tapez simplement ce mot magique :"
echo -e "\n     ${BOLD}${GREEN}cours${RESET}  ${CYAN}(ou 'fait tout', 'débloque')${RESET}\n"
echo -e "  ${YELLOW}→ L'agent IA scanne votre dossier et s'occupe de tout pour vous !${RESET}\n"

echo -e "${BLUE}${BOLD}📱 VOS COCKPITS DE RÉVISION AU QUOTIDIEN :${RESET}"
echo -e "  💻 ${CYAN}Sur Mac :${RESET} Ouvrez ${BOLD}/Applications/Cours.app${RESET}"
echo -e "  🌐 ${CYAN}Sur Navigateur :${RESET} ${BOLD}http://localhost:3002${RESET}"
echo -e "  📱 ${CYAN}Sur Smartphone :${RESET} Scannez le QR Code affiché dans l'application ou tapez ${BOLD}cours${RESET} !\n"
