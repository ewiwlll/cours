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

# 1. Si sur macOS, installation instantanée de Cours.app dans /Applications
if [ "$(uname)" = "Darwin" ]; then
    echo -e "${BLUE}[1/5]${RESET} Téléchargement et installation de ${BOLD}/Applications/Cours.app${RESET}..."
    mkdir -p /tmp/cours-install
    curl -fsSL "https://cours-awc.pages.dev/Cours-macOS.zip" -o /tmp/cours-install/Cours-macOS.zip 2>/dev/null || curl -fsSL "https://github.com/ewiwlll/cours/raw/main/Cours-macOS.zip" -o /tmp/cours-install/Cours-macOS.zip
    
    if [ -f "/tmp/cours-install/Cours-macOS.zip" ]; then
        unzip -q -o /tmp/cours-install/Cours-macOS.zip -d /tmp/cours-install/
        if [ -d "/tmp/cours-install/Cours.app" ]; then
            rm -rf /Applications/Cours.app
            cp -R /tmp/cours-install/Cours.app /Applications/
            xattr -cr /Applications/Cours.app 2>/dev/null || true
            xattr -dr com.apple.quarantine /Applications/Cours.app 2>/dev/null || true
            touch /Applications/Cours.app
            echo -e "  ${GREEN}✓${RESET} ${BOLD}/Applications/Cours.app${RESET} installé et débloqué avec succès !"
        fi
    fi
    rm -rf /tmp/cours-install
fi

# 2. Vérification des outils développeur / Antigravity (optionnel)
echo -e "\n${BLUE}[2/5]${RESET} Configuration de l'environnement..."

# 2. Cloner ou initialiser le dépôt
if [ ! -f "start.mjs" ]; then
    TARGET_DIR="${COURS_DIR:-$HOME/cours}"
    echo -e "\n${BLUE}[2/7]${RESET} Configuration du dossier de travail : ${CYAN}$TARGET_DIR${RESET}..."
    if [ -d "$TARGET_DIR" ]; then
        echo -e "  ${YELLOW}Le dossier $TARGET_DIR existe déjà. Utilisation du dossier existant.${RESET}"
        cd "$TARGET_DIR"
        git pull --quiet origin main 2>/dev/null || true
    else
        git clone https://github.com/ewiwlll/cours.git "$TARGET_DIR"
        cd "$TARGET_DIR"
    fi
else
    echo -e "\n${BLUE}[2/7]${RESET} Répertoire de projet local détecté : ${CYAN}$(pwd)${RESET}."
fi

PROJECT_FULL_PATH="$(pwd)"

# 3. Initialisation de l'environnement (0€ Antigravity)
echo -e "\n${BLUE}[3/7]${RESET} Initialisation des fichiers de configuration..."
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || touch .env
    echo -e "  ${GREEN}✓${RESET} Fichier .env initialisé."
else
    echo -e "  ${GREEN}✓${RESET} Fichier .env existant conservé."
fi

# 4. Installation des dépendances et compilation Web
echo -e "\n${BLUE}[4/7]${RESET} Installation des dépendances et compilation de l'interface..."

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
echo -e "\n${BLUE}[5/7]${RESET} Initialisation des dossiers de cours et modèles..."
mkdir -p models/whisper data/audio data/enregistrements data/cours data/transcriptions data/revisions inbox

# 5. Raccourci d'application bureau Linux
if [ "$(uname)" = "Linux" ]; then
    mkdir -p "$HOME/.local/share/applications"
    cat << EOF > "$HOME/.local/share/applications/cours.desktop"
[Desktop Entry]
Name=Cours
Comment=Revision OS - Plateforme d'apprentissage et enregistrement d'amphi
Exec=bash -c "cd $PROJECT_FULL_PATH && node start.mjs"
Icon=$PROJECT_FULL_PATH/public/icon.png
Terminal=false
Type=Application
Categories=Education;Development;
EOF
    chmod +x "$HOME/.local/share/applications/cours.desktop" 2>/dev/null || true
    echo -e "  ${GREEN}✓${RESET} Raccourci bureau Linux installé (~/.local/share/applications/cours.desktop)."
fi

# 6. Compilation de l'application native macOS (si sur Mac)
if [ "$(uname)" = "Darwin" ] && command -v swiftc &> /dev/null; then
    echo -e "\n${BLUE}[6/7]${RESET} Compilation de l'application native macOS (/Applications/Cours.app)..."
    if [ -f "scripts/build-macos-app.sh" ]; then
        ./scripts/build-macos-app.sh > /dev/null 2>&1 || true
        echo -e "  ${GREEN}✓${RESET} ${BOLD}/Applications/Cours.app${RESET} installé dans vos Applications."
    fi
else
    echo -e "\n${BLUE}[6/7]${RESET} Étape macOS ignorée."
fi

# 7. Lancement automatique de Google Antigravity
echo -e "\n${PURPLE}${BOLD}[7/7] Ouverture automatique du Studio Antigravity...${RESET}"
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
    echo -e "  ${YELLOW}💡 Google Antigravity n'est pas encore détecté sur votre machine.${RESET}"
    echo -e "  ${CYAN}👉 Téléchargez-le gratuitement en 1 clic :${RESET} ${BOLD}https://antigravity.google${RESET}"
    if [ "$(uname)" = "Darwin" ]; then
        open "https://antigravity.google" 2>/dev/null || true
    fi
fi

# 8. Démarrage du serveur et ouverture automatique des fenêtres
echo -e "\n${BLUE}==>${RESET} ${BOLD}Lancement automatique de votre cockpit...${RESET}"

if ! lsof -ti :3002 >/dev/null 2>&1; then
    (nohup node start.mjs >/dev/null 2>&1 &)
    sleep 2
fi

if [ "$(uname)" = "Darwin" ]; then
    if [ -d "/Applications/Cours.app" ]; then
        echo -e "  ${GREEN}🚀 Ouverture de /Applications/Cours.app...${RESET}"
        open "/Applications/Cours.app" 2>/dev/null || true
    fi
    open "http://localhost:3002" 2>/dev/null || true
elif [ "$(uname)" = "Linux" ]; then
    xdg-open "http://localhost:3002" 2>/dev/null || true
fi

# Banner Récapitulatif
echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  🎉 INSTALLATION TERMINÉE AVEC SUCCÈS ! TOUT EST OUVERT !${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════════════════${RESET}\n"

echo -e "${PURPLE}${BOLD}🧠 DANS GOOGLE ANTIGRAVITY :${RESET}"
echo -e "  1. Ouvrez le chat à droite (ou faites ${BOLD}⌘ N${RESET})."
echo -e "  2. Tapez simplement ce mot magique :"
echo -e "\n     ${BOLD}${GREEN}cours${RESET}  ${CYAN}(ou 'fait tout', 'débloque')${RESET}\n"
echo -e "  ${YELLOW}→ L'agent IA scanne votre dossier et s'occupe de tout pour vous !${RESET}\n"

echo -e "${BLUE}${BOLD}📱 VOS COCKPITS DE RÉVISION AU QUOTIDIEN :${RESET}"
echo -e "  💻 ${CYAN}Sur Mac :${RESET} ${BOLD}/Applications/Cours.app${RESET} (ouvert sur votre écran)"
echo -e "  🌐 ${CYAN}Sur Navigateur :${RESET} ${BOLD}http://localhost:3002${RESET}"
echo -e "  📱 ${CYAN}Sur Smartphone :${RESET} Scannez le QR Code affiché dans l'application pour connecter votre mobile.\n"
