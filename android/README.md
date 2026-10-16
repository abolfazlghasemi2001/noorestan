# نورستان — نسخهٔ اندروید (Native)

این پوشهٔ `android/` نسخهٔ کاملاً بومی (Native) اندروید پروژهٔ نورستان است و
کد وب را دست نمی‌زند.

## ساخت APK بدون Android Studio

1. تغییرات را commit و push کنید روی شاخهٔ `main` (یا PR بسازید).
2. به تب **Actions** در گیت‌هاب بروید و workflow **Android Build** را ببینید.
3. پس از اتمام، در بخش Artifacts فایل `noorestan-debug-apk` را دانلود کنید.
4. فایل APK را روی گوشی منتقل و نصب کنید (اجازهٔ نصب از منابع ناشناخته را بدهید).

## تغییر آدرس سرور

آدرس سرور فقط در یک نقطه تعریف شده است:

- فایل `android/app/build.gradle.kts`، فیلد `buildConfigField("String", "BASE_URL", ...)`
- و `WS_URL` برای WebSocket.

پیش‌فرض: `https://hoosna1402.ir`. آن را عوض کنید و دوباره build بگیرید.

## ساخت محلی (اختیاری)

```bash
cd android
gradle :app:assembleDebug
```

APK در `android/app/build/outputs/apk/debug/` ساخته می‌شود.

## ساخت release امضاشده

Workflow `Android Release` را با secrets زیر اجرا کنید:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
