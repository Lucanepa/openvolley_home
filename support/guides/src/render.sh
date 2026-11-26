#!/bin/bash
# Prints the "Day one for clubs" pages to PDF (A4, two pages each).
set -euo pipefail
cd "$(dirname "$0")"
for l in de en; do
  google-chrome --headless --no-sandbox --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="../openvolley-club-day-one-$l.pdf" "club-day-one-$l.html"
done
