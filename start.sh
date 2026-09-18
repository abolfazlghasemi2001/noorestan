#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  🌟 نورستان ۱۴ — اجرای سرور محفل
#  استفاده:  bash start.sh [پورت] [رمز مدیر]
#  مثال:     bash start.sh 8787 noor2024
#  (روی /storage/emulated/0 اجازهٔ اجرا نیست، پس با bash صدا بزن)
#  پیش‌نیاز: فقط Node.js — هیچ npm install ای لازم نیست.
# ─────────────────────────────────────────────────────────────
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8787}"
PASS="${2:-noor2024}"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js پیدا نشد. در Termux:  pkg install nodejs" >&2
  exit 1
fi

if [ ! -f "$DIR/server.js" ]; then
  echo "❌ فایل server.js در $DIR پیدا نشد." >&2
  exit 1
fi

# اگر پورت در حال استفاده است، هشدار بده (پیدا کردن پروسهٔ قدیمی)
if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "⚠️  پورت $PORT همین حالا در حال استفاده است — یک سرور دیگر در حال اجراست؟"
  echo "    برای اجرای سرور تازه، اول آن را ببند یا پورت دیگری بده:  ./start.sh $((PORT+1))"
  exit 1
fi

echo "🚀 اجرای سرور نورستان روی پورت $PORT ..."
cd "$DIR"
exec env PORT="$PORT" NOOR_ADMIN_PASS="$PASS" node server.js
