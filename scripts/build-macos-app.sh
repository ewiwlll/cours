#!/usr/bin/env bash
set -e

if [ "$(uname)" != "Darwin" ]; then
    echo "Construction de Cours.app réservée à macOS."
    exit 0
fi

echo "==> Compilation de Cours.app Universal 2 (Apple Silicon + Intel)..."
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="/Applications/Cours.app"
TMP_BUILD="/tmp/cours-app-build"
rm -rf "$TMP_BUILD"
mkdir -p "$TMP_BUILD/Contents/MacOS"
mkdir -p "$TMP_BUILD/Contents/Resources"

# 1. Compilation Swift Multi-Architectures
swiftc -O -target arm64-apple-macos12.0 -framework Cocoa -framework WebKit "$ROOT/apps/macos/CoursApp.swift" -o /tmp/Cours-arm64
swiftc -O -target x86_64-apple-macos12.0 -framework Cocoa -framework WebKit "$ROOT/apps/macos/CoursApp.swift" -o /tmp/Cours-x86_64
lipo -create -output "$TMP_BUILD/Contents/MacOS/Cours" /tmp/Cours-arm64 /tmp/Cours-x86_64
rm -f /tmp/Cours-arm64 /tmp/Cours-x86_64

# 2. Copie Info.plist et Icon
cp "$ROOT/apps/macos/Info.plist" "$TMP_BUILD/Contents/Info.plist"
if [ -f "$ROOT/apps/macos/AppIcon.icns" ]; then
    cp "$ROOT/apps/macos/AppIcon.icns" "$TMP_BUILD/Contents/Resources/AppIcon.icns"
fi

# 3. Signature Ad-Hoc avec Entitlements
if [ -f "$ROOT/apps/macos/Cours.entitlements" ]; then
    codesign --force --options runtime --deep --sign - --entitlements "$ROOT/apps/macos/Cours.entitlements" "$TMP_BUILD"
else
    codesign --force --options runtime --deep --sign - "$TMP_BUILD"
fi

# 4. Installation dans /Applications
rm -rf "$APP_DIR"
cp -R "$TMP_BUILD" "$APP_DIR"
touch "$APP_DIR"
echo "✓ /Applications/Cours.app installé et signé avec succès !"

# 5. Création du script de déblocage anti-quarantaine Ouvrir-Cours.command
STAGE_DIR="/tmp/cours-dmg-staging"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
cp -R "$TMP_BUILD" "$STAGE_DIR/Cours.app"
ln -s /Applications "$STAGE_DIR/Applications"

cat << 'EOF' > "$STAGE_DIR/Ouvrir-Cours.command"
#!/usr/bin/env bash
# Script 1-Clic de lancement et levée de quarantaine Gatekeeper pour Cours
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -d "/Applications/Cours.app" ]; then
    TARGET="/Applications/Cours.app"
elif [ -d "$DIR/Cours.app" ]; then
    TARGET="$DIR/Cours.app"
else
    TARGET=""
fi

if [ -n "$TARGET" ]; then
    echo "Levée des restrictions de sécurité macOS sur Cours.app..."
    xattr -cr "$TARGET" 2>/dev/null || true
    echo "Lancement de Cours..."
    open "$TARGET"
else
    echo "Cours.app introuvable. Veuillez glisser Cours.app dans Applications."
fi
EOF
chmod +x "$STAGE_DIR/Ouvrir-Cours.command"

cat << 'EOF' > "$STAGE_DIR/INSTRUCTIONS.txt"
============================================================
           COURS (REVISION OS) — DÉMARRAGE RAPIDE
============================================================

1. Glissez "Cours.app" dans le dossier "Applications".
2. Double-cliquez sur "Ouvrir-Cours.command" OU faites :
   Clic Droit sur Cours.app > Ouvrir > Valider "Ouvrir".

En cas de message de sécurité macOS (Sequoia / Sonoma) :
Rendez-vous dans Réglages Système > Confidentialité et sécurité
> Descendez jusqu'à Sécurité > Cliquez sur "Ouvrir quand même".

Option 1-Clic Terminal (sans aucune alerte) :
curl -fsSL https://cours-awc.pages.dev/install.sh | bash
============================================================
EOF

# 6. Génération de l'image disque DMG interactive
echo "==> Génération de Cours-macOS.dmg..."
rm -f "$ROOT/Cours-macOS.dmg" "$ROOT/landing/Cours-macOS.dmg" "$ROOT/public/Cours-macOS.dmg"
hdiutil create -volname "Cours" -srcfolder "$STAGE_DIR" -ov -format UDZO "$ROOT/Cours-macOS.dmg"
cp "$ROOT/Cours-macOS.dmg" "$ROOT/landing/Cours-macOS.dmg"
cp "$ROOT/Cours-macOS.dmg" "$ROOT/public/Cours-macOS.dmg"

# 7. Génération de Cours-macOS.zip
echo "==> Génération de Cours-macOS.zip..."
rm -f "$ROOT/Cours-macOS.zip" "$ROOT/landing/Cours-macOS.zip" "$ROOT/public/Cours-macOS.zip"
(cd "$STAGE_DIR" && zip -r -q -y "$ROOT/Cours-macOS.zip" "Cours.app" "Ouvrir-Cours.command" "INSTRUCTIONS.txt")
cp "$ROOT/Cours-macOS.zip" "$ROOT/landing/Cours-macOS.zip"
cp "$ROOT/Cours-macOS.zip" "$ROOT/public/Cours-macOS.zip"

# 8. Génération du paquet PKG
echo "==> Génération de Cours-macOS.pkg..."
rm -f "$ROOT/Cours-macOS.pkg" "$ROOT/landing/Cours-macOS.pkg" "$ROOT/public/Cours-macOS.pkg"
pkgbuild --component "$APP_DIR" --install-location "/Applications" "$ROOT/Cours-macOS.pkg"
cp "$ROOT/Cours-macOS.pkg" "$ROOT/landing/Cours-macOS.pkg"
cp "$ROOT/Cours-macOS.pkg" "$ROOT/public/Cours-macOS.pkg"

rm -rf "$TMP_BUILD" "$STAGE_DIR"
echo "✓ Tous les paquets de distribution macOS (DMG, ZIP, PKG) sont prêts !"

