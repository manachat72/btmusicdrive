#!/usr/bin/env bash
set -euo pipefail
mkdir -p reports/pagespeed
pages=(
  "home|https://btmusicdrive.com/"
  "shop|https://btmusicdrive.com/shop"
  "category-lukthung|https://btmusicdrive.com/category/lukthung"
  "product-sek-loso|https://btmusicdrive.com/product/usb-mp3-sek-loso"
  "blog-usb-guide|https://btmusicdrive.com/blog/usb-music-buying-guide"
)
for item in "${pages[@]}"; do
  name="${item%%|*}"; url="${item#*|}"
  mobile="reports/pagespeed/${name}-mobile.json"
  desktop="reports/pagespeed/${name}-desktop.json"
  echo "[mobile] $name"
  npx --yes lighthouse "$url" --output=json --output-path="$mobile" --quiet --chrome-flags="--headless=new --no-sandbox --disable-gpu" || {
    # chrome-launcher may return EPERM while deleting its Windows temp profile
    # after Lighthouse has already written a complete JSON report.
    test -s "$mobile" || exit 1
    echo "warning: Lighthouse report written; ignored Windows temp cleanup error"
  }
  echo "[desktop] $name"
  npx --yes lighthouse "$url" --preset=desktop --output=json --output-path="$desktop" --quiet --chrome-flags="--headless=new --no-sandbox --disable-gpu" || {
    test -s "$desktop" || exit 1
    echo "warning: Lighthouse report written; ignored Windows temp cleanup error"
  }
done
node scripts/summarize-lighthouse.js reports/pagespeed > reports/pagespeed/SUMMARY.md
echo "LIGHTHOUSE_COMPLETE"
