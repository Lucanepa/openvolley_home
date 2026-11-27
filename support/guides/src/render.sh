#!/bin/bash
# Prints the guide pages in this folder to PDF (A4), one per <name>-<lang>.html.
set -euo pipefail
cd "$(dirname "$0")"
for f in club-day-one-de club-day-one-en referee-day-one-de referee-day-one-en scorer-day-one-de scorer-day-one-en; do
  google-chrome --headless --no-sandbox --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="../openvolley-$f.pdf" "$f.html"
done
