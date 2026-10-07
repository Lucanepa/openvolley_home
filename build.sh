#!/bin/bash
# Build script for Cloudflare Pages deployment (npm run build -> dist/).
# Copies only the static files the landing page needs, plus the self-hosted
# Inter font from @fontsource-variable/inter (installed by npm ci/install).

set -euo pipefail

cd "$(dirname "$0")"

OUTPUT_DIR="dist"
FONT_SRC="node_modules/@fontsource-variable/inter"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Page, styles and icons
cp index.html landing.css legal.css _redirects "$OUTPUT_DIR/"
cp favicon.ico favicon.svg apple-touch-icon.png "$OUTPUT_DIR/"
cp CNAME "$OUTPUT_DIR/" 2>/dev/null || true

# Images: brand (OpenVolley logo A, og:image), OpenBeach and ReadVolley marks
cp -r assets "$OUTPUT_DIR/"
rm -f "$OUTPUT_DIR/assets/README.md"

# Inter Variable, optical-size build (Display cut), latin + latin-ext
if [ ! -d "$FONT_SRC/files" ]; then
  echo "Missing $FONT_SRC - run 'npm install' first." >&2
  exit 1
fi
mkdir -p "$OUTPUT_DIR/assets/fonts"
cp "$FONT_SRC/files/inter-latin-opsz-normal.woff2" \
   "$FONT_SRC/files/inter-latin-ext-opsz-normal.woff2" \
   "$OUTPUT_DIR/assets/fonts/"
cp "$FONT_SRC/LICENSE" "$OUTPUT_DIR/assets/fonts/LICENSE-Inter.txt"

# Legal pages (privacy, legal notice, terms, open source) in DE/EN/FR/IT,
# rendered from legal/<lang>/*.md; address from legal/operator.txt
node legal/build.mjs "$OUTPUT_DIR"

echo "Build complete! Output directory: $OUTPUT_DIR"
