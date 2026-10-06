#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# نورستان — دروازهٔ محلی، همان چیزی که CI می‌زند.
#
# چرا این فایل؟ پیش‌تر فهرستِ گام‌ها دو جا نوشته شده بود (یکی در
# .github/workflows/ci.yml و یکی در ذهنِ کسی که روی دستگاه خودش
# `node _harness.js` می‌زد). هر بار که یکی از این دو عوض می‌شد، آن یکی
# عقب می‌ماند. حالا هر دو یک فهرست را اجرا می‌کنند؛ CI فقط همین
# اسکریپت را صدا می‌زند.
#
# اجرا: bash tools/ci.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step '۱) سینتکس — هر اسکریپتی که منتشر می‌شود'
shopt -s nullglob
bad=0
for f in *.js tools/*.js tests/*.js games/*.js assets/app/*.js assets/games/*.js; do
  node --check "$f" || { echo "❌ $f"; bad=1; }
done
bash -n start.sh || bad=1
[ "$bad" = 0 ] || exit 1
echo "سینتکس سالم"

step '۲) دروازهٔ محلی — پیوند، استایل، پیش‌ذخیره'
node _check-scripts.js

step '۳) هارنسِ کلاینت (DOMِ استاب)'
node _harness.js

step '۴) نگهبان‌های tests/'
for f in tests/*.test.js; do echo "▶ $f"; node "$f"; done

step '۵) تستِ یکپارچهٔ سرور (سوکتِ واقعی)'
node _servertest.js

step '۶) بازرسیِ محتوا'
node _content-audit.js

printf '\n\033[1;32m✅ دروازهٔ محلی: همهٔ گام‌ها سبز\033[0m\n'
