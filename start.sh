#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  🌟 نورستان — اجرای سرور محفل
#  استفاده:  bash start.sh [پورت] [رمز مدیر]
#  مثال:     bash start.sh 8787 'یک-رمز-قوی'
#  یا:       NOOR_ADMIN_PASS='یک-رمز-قوی' bash start.sh
#  (روی /storage/emulated/0 اجازهٔ اجرا نیست، پس با bash صدا بزن)
#  پیش‌نیاز: فقط Node.js — هیچ npm install ای لازم نیست.
#
#  🔒 رمز پیش‌فرض عمداً حذف شد: این ریپو عمومی است و هر رمز پیش‌فرضی
#     که این‌جا نوشته شود، برای همهٔ دنیا رمزِ پنل مدیر است.
# ─────────────────────────────────────────────────────────────
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8787}"
PASS="${2:-${NOOR_ADMIN_PASS:-}}"

if [ -z "$PASS" ]; then
  echo "❌ رمز مدیر داده نشده." >&2
  echo "   bash start.sh $PORT 'رمز-قوی'   یا   NOOR_ADMIN_PASS='رمز-قوی' bash start.sh" >&2
  exit 1
fi

if [ "$PASS" = "noor2024" ] || [ ${#PASS} -lt 10 ]; then
  echo "❌ این رمز ناامن است (رمزِ پیش‌فرضِ قدیمی یا کوتاه‌تر از ۱۰ نویسه)." >&2
  exit 1
fi

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
  echo "    برای اجرای سرور تازه، اول آن را ببند یا پورت دیگری بده:  bash start.sh $((PORT+1)) '<رمز>'"
  exit 1
fi

echo "🚀 اجرای سرور نورستان روی پورت $PORT ..."
cd "$DIR"
exec env PORT="$PORT" NOOR_ADMIN_PASS="$PASS" node server.js
