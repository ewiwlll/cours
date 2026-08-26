#!/usr/bin/env bash
set -e

if [ "$(uname)" != "Darwin" ]; then
    echo "Construction de Cours.app réservée à macOS."
    exit 0
fi

echo "==> Compilation de Cours.app pour macOS..."
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="/Applications/Cours.app"

# Create App bundle structure
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Compile Swift app
swiftc -O -framework Cocoa -framework WebKit "$ROOT/apps/macos/CoursApp.swift" -o "$APP_DIR/Contents/MacOS/Cours"

# Copy Info.plist and Icon
cp "$ROOT/apps/macos/Info.plist" "$APP_DIR/Contents/Info.plist"
if [ -f "$ROOT/apps/macos/AppIcon.icns" ]; then
    cp "$ROOT/apps/macos/AppIcon.icns" "$APP_DIR/Contents/Resources/AppIcon.icns"
fi

# Touch to register with Launchpad / Finder
touch "$APP_DIR"
echo "✓ /Applications/Cours.app installé avec succès dans les Applications macOS !"
