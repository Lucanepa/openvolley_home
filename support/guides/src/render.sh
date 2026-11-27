#!/bin/bash
# Prints the guide pages in this folder to PDF (A4), one per <name>-<lang>.html.
# Each page is printed from a copy with soft hyphens in its justified text
# (hyphenate.mjs: headless Google Chrome on Linux does not hyphenate by itself);
# the copy is removed again.
set -euo pipefail
cd "$(dirname "$0")"
trap 'rm -f ./*.print.html' EXIT
for f in club-day-one-de club-day-one-en referee-day-one-de referee-day-one-en scorer-day-one-de scorer-day-one-en; do
  node hyphenate.mjs "$f.html" "$f.print.html"
  google-chrome --headless --no-sandbox --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="../openvolley-$f.pdf" "$f.print.html"
done
