#!/bin/bash
# ── ShieldBrowse Build Script ────────────────────────────────────────────────
# Builds both Chrome (MV3) and Firefox (MV2) extension packages

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
CHROME_DIR="$BUILD_DIR/shieldbrowse-chrome"
FIREFOX_DIR="$BUILD_DIR/shieldbrowse-firefox"

echo "╔══════════════════════════════════════════╗"
echo "║     ShieldBrowse Extension Builder       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Clean previous builds
rm -rf "$BUILD_DIR"
mkdir -p "$CHROME_DIR/scripts" "$CHROME_DIR/icons" "$CHROME_DIR/styles" "$CHROME_DIR/rules"
mkdir -p "$FIREFOX_DIR/scripts" "$FIREFOX_DIR/icons" "$FIREFOX_DIR/styles" "$FIREFOX_DIR/rules"

# ── Build both versions ──────────────────────────────────────────────────────

echo "[1/4] Preparing Chrome extension (Manifest V3)..."
cp "$SCRIPT_DIR/manifest.json" "$CHROME_DIR/"
cp "$SCRIPT_DIR/popup.html" "$CHROME_DIR/"
cp "$SCRIPT_DIR/options.html" "$CHROME_DIR/"
cp -r "$SCRIPT_DIR/icons/"* "$CHROME_DIR/icons/"
cp -r "$SCRIPT_DIR/styles/"* "$CHROME_DIR/styles/"
cp -r "$SCRIPT_DIR/rules/"* "$CHROME_DIR/rules/"
cp "$SCRIPT_DIR/scripts/content.js" "$CHROME_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/youtube.js" "$CHROME_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/inject.js" "$CHROME_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/popup.js" "$CHROME_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/background.js" "$CHROME_DIR/scripts/"
echo "  ✓ Chrome build ready at $CHROME_DIR"

echo "[2/4] Preparing Firefox extension (Manifest V2)..."
cp "$SCRIPT_DIR/manifest-firefox.json" "$FIREFOX_DIR/manifest.json"
cp "$SCRIPT_DIR/popup.html" "$FIREFOX_DIR/"
cp "$SCRIPT_DIR/options.html" "$FIREFOX_DIR/"
cp -r "$SCRIPT_DIR/icons/"* "$FIREFOX_DIR/icons/"
cp -r "$SCRIPT_DIR/styles/"* "$FIREFOX_DIR/styles/"
cp -r "$SCRIPT_DIR/rules/"* "$FIREFOX_DIR/rules/"
cp "$SCRIPT_DIR/scripts/content.js" "$FIREFOX_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/youtube.js" "$FIREFOX_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/inject.js" "$FIREFOX_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/popup.js" "$FIREFOX_DIR/scripts/"
cp "$SCRIPT_DIR/scripts/background-firefox.js" "$FIREFOX_DIR/scripts/"
echo "  ✓ Firefox build ready at $FIREFOX_DIR"

echo "[3/4] Packaging Chrome extension..."
cd "$CHROME_DIR"
zip -r "$BUILD_DIR/shieldbrowse-chrome.zip" . -q
echo "  ✓ Chrome package: $BUILD_DIR/shieldbrowse-chrome.zip"

echo "[4/4] Packaging Firefox extension..."
cd "$FIREFOX_DIR"
zip -r "$BUILD_DIR/shieldbrowse-firefox.zip" . -q
echo "  ✓ Firefox package: $BUILD_DIR/shieldbrowse-firefox.zip"

echo ""
echo "Build complete!"
echo ""
echo "Chrome: Load via chrome://extensions → Developer mode → Load unpacked"
echo "Firefox: Load via about:debugging → This Firefox → Load Temporary Add-on"
echo ""

# File sizes
echo "Package sizes:"
du -sh "$BUILD_DIR/shieldbrowse-chrome.zip"
du -sh "$BUILD_DIR/shieldbrowse-firefox.zip"
