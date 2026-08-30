#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_TOOLS="/Users/ewilien/Library/Android/sdk/build-tools/35.0.0"
KEYSTORE="$ROOT/apps/mobile/android/app/debug.keystore"
SRC_APK="$ROOT/apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
WORK_DIR="/tmp/cours-apk-rebuild"

echo "==> [1/4] Export du bundle React Native / Expo..."
cd "$ROOT/apps/mobile"
npx expo export:embed \
  --platform android \
  --dev false \
  --entry-file app/index.tsx \
  --bundle-output android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle \
  --assets-dest android/app/build/generated/res/createBundleReleaseJsAndAssets/

echo "==> [2/4] Extraction et injection des assets..."
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"
unzip -q -o "$SRC_APK"
rm -rf META-INF

mkdir -p "$WORK_DIR/assets"
cp "$ROOT/apps/mobile/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle" "$WORK_DIR/assets/index.android.bundle"
cp -rf "$ROOT/apps/mobile/android/app/build/generated/res/createBundleReleaseJsAndAssets/"* "$WORK_DIR/res/" 2>/dev/null || true

echo "==> [3/4] Compression et alignement (zipalign)..."
zip -q -r -0 unaligned.apk .
"$BUILD_TOOLS/zipalign" -f -v -p 4 unaligned.apk aligned.apk >/dev/null

echo "==> [4/4] Signature de l'APK avec debug.keystore..."
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
echo "✓ APK Cours recompilé et signé avec succès -> $ROOT/public/cours.apk"
