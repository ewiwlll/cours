#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_TOOLS="/Users/ewilien/Library/Android/sdk/build-tools/35.0.0"
HERMESC="$ROOT/apps/mobile/node_modules/react-native/sdks/hermesc/osx-bin/hermesc"
KEYSTORE="$ROOT/apps/mobile/android/app/debug.keystore"
SRC_APK="$ROOT/apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
WORK_DIR="/tmp/cours-apk-rebuild"

echo "==> [1/5] Export du bundle React Native avec index.js..."
cd "$ROOT/apps/mobile"
npx expo export:embed \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output "$WORK_DIR/raw.bundle.js" \
  --assets-dest "$WORK_DIR/res"

echo "==> [2/5] Compilation Hermes Bytecode (HBC)..."
mkdir -p "$WORK_DIR/assets"
"$HERMESC" -emit-binary -O -out "$WORK_DIR/assets/index.android.bundle" "$WORK_DIR/raw.bundle.js"

echo "==> [3/5] Extraction de l'APK source et injection du bundle Hermes..."
cd "$WORK_DIR"
mkdir -p apk_root
cd apk_root
unzip -q -o "$SRC_APK"
rm -rf META-INF

mkdir -p assets
cp "$WORK_DIR/assets/index.android.bundle" assets/index.android.bundle
cp -rf "$WORK_DIR/res/"* res/ 2>/dev/null || true

echo "==> [4/5] Alignement (zipalign)..."
zip -q -r -0 ../unaligned.apk .
cd "$WORK_DIR"
"$BUILD_TOOLS/zipalign" -f -v -p 4 unaligned.apk aligned.apk >/dev/null

echo "==> [5/5] Signature de l'APK avec debug.keystore..."
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --ks-key-alias androiddebugkey \
  --out "$ROOT/public/cours.apk" \
  aligned.apk

cp "$ROOT/public/cours.apk" "$ROOT/web/public/cours.apk" 2>/dev/null || true
cp "$ROOT/public/cours.apk" "$ROOT/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk" 2>/dev/null || true
cp "$ROOT/public/cours.apk" "$ROOT/apps/mobile/android/app/build/outputs/apk/release/app-release.apk" 2>/dev/null || true

rm -rf "$WORK_DIR"
echo "✓ APK Cours recompilé avec index.js + registerRootComponent -> $ROOT/public/cours.apk"
