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

step '۷) ماتریسِ مرورگر — بودجۀ نقضِ چیدمان (با درخواستِ صریح)'
# چرا در CI نیست؟ اجرای کامل ~۱۵ دقیقه Chromium می‌برد، و ابزارش به
# `_shots_env/node_modules` (puppeteer + @sparticuz/chromium) تکیه می‌کند که
# در Git نیست. بودجه در `docs/audit/BROWSER-BUDGET.json` قفل شده (شمارِ واقعیِ
# امروز، نه آرزو): هر بدترشدنِ عدد، همین گام را می‌شکند.
# چرا *صریح* خواسته می‌شود؟ تصویرِ ubuntu-latest را GitHub خودش با
# google-chrome می‌دهد؛ «پس مرورگر هست» به‌تنهایی CI را سراغ گامی می‌برد که
# نصبِ وابستگی ندارد. پس سه شرط: درخواست، مرورگر، وابستگیِ نصب‌شده.
have_browser=0
[ -n "${CHROMIUM_PATH:-}" ] && have_browser=1
command -v chromium >/dev/null 2>&1 && have_browser=1
command -v chromium-browser >/dev/null 2>&1 && have_browser=1
command -v google-chrome >/dev/null 2>&1 && have_browser=1
if [ "${NOOR_BROWSER_GATE:-0}" = 1 ] && [ "$have_browser" = 1 ] && [ -d _shots_env/node_modules ]; then
  node _browser-check.js --budget=docs/audit/BROWSER-BUDGET.json --out=screenshots/browser
elif [ "${NOOR_BROWSER_GATE:-0}" = 1 ]; then
  echo '  گامِ مرورگر خواسته شد ولی اجرایی نشد: مرورگر (CHROMIUM_PATH) و'
  echo '  `cd _shots_env && npm ci` هر دو لازم‌اند.'
  exit 1
else
  echo '  پرش: با NOOR_BROWSER_GATE=1 اجرا می‌شود (مرورگر + `cd _shots_env && npm ci`)'
fi

printf '\n\033[1;32m✅ دروازهٔ محلی: همهٔ گام‌ها سبز\033[0m\n'
