#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
BUILD_DIR="$ROOT_DIR/.build-xpi"
MANIFEST_PATH="$ROOT_DIR/manifest.json"
BOOTSTRAP_PATH="$ROOT_DIR/bootstrap.js"
ICONS_DIR="$ROOT_DIR/icons"

if [[ ! -f "$MANIFEST_PATH" || ! -f "$BOOTSTRAP_PATH" ]]; then
  echo "Missing manifest.json or bootstrap.js in $ROOT_DIR" >&2
  exit 1
fi

VERSION="$(/usr/bin/awk -F'"' '/"version"/ { print $4; exit }' "$MANIFEST_PATH")"
OUT_PATH="$DIST_DIR/collection-numbering-${VERSION}.xpi"

rm -rf "$BUILD_DIR"
mkdir -p "$DIST_DIR" "$BUILD_DIR"
rm -f "$OUT_PATH"

cp "$MANIFEST_PATH" "$BUILD_DIR/manifest.json"
cp "$BOOTSTRAP_PATH" "$BUILD_DIR/bootstrap.js"
if [[ -d "$ICONS_DIR" ]]; then
  mkdir -p "$BUILD_DIR/icons"
  for size in 16 32 48 96 128; do
    if [[ -f "$ICONS_DIR/icon-$size.png" ]]; then
      cp "$ICONS_DIR/icon-$size.png" "$BUILD_DIR/icons/icon-$size.png"
    fi
  done
fi

(
  cd "$BUILD_DIR"
  if [[ -d "icons" ]]; then
    /usr/bin/zip -X -r "$OUT_PATH" manifest.json bootstrap.js icons >/dev/null
  else
    /usr/bin/zip -X -r "$OUT_PATH" manifest.json bootstrap.js >/dev/null
  fi
)

rm -rf "$BUILD_DIR"

echo "Built: $OUT_PATH"
