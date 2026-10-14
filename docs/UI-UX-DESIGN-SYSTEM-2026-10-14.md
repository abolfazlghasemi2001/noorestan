# سیستم طراحی و بازطراحی UI/UX نورستان

**نسخه:** ۱٫۰ · **تاریخ:** ۱۴ اکتبر ۲۰۲۶ · **دامنه:** فقط لایهٔ نمایش و تعامل

> این سند هیچ متن، عدد یا حکم عبادی ایجاد یا اصلاح نمی‌کند. UI فقط دادهٔ لایهٔ `NoorContent` را نمایش می‌دهد و در نبود داده، حالت خالی محترمانه نشان می‌دهد.

## ۱. خلاصهٔ طراحی

نورستان جدید باید حس «خلوت شبانهٔ یک صحن ایرانی» را داشته باشد: عمیق، آرام، دقیق و مطمئن. زمینهٔ سرمه‌ای نزدیک به شب، طلای کم‌اشباع برای کنش اصلی، و سبز معنوی برای موفقیت استفاده می‌شود. هندسهٔ اسلامی در حد بافت ۳ تا ۶ درصدی است؛ هرگز با محتوا رقابت نمی‌کند.

رابط mobile-first است. روی موبایل هر صفحه یک هدف اصلی، یک ستون، فاصلهٔ تنفسی و اهداف لمس حداقل ۴۸ پیکسل دارد. در عرض متوسط، جزئیات در pane دوم قرار می‌گیرند؛ در دسکتاپ navigation rail در سمت راست و شبکهٔ دو یا سه‌ستونه فعال می‌شود. هیچ اکشن مهمی صرفاً با رنگ منتقل نمی‌شود.

Material 3 اسکلت سیستم است، اما شکل‌ها، سطوح تونال، تایپوگرافی فارسی و متن مقدس شخصی‌سازی شده‌اند. Vazirmatn برای UI و Amiri برای عربی، هر دو محلی و آفلاین‌اند. حرکت‌ها ۱۶۰ تا ۲۴۰ میلی‌ثانیه، معنادار و قابل خاموش‌کردن‌اند.

ورود به‌جای «دیوار احراز هویت»، یک آستانهٔ آرام است: در موبایل فرم متمرکز و در دسکتاپ قاب دو ستونه با روایت برند در راست و فرم در چپ. قرارداد فعلی اپ OTP موبایل است؛ طرح ایمیل/رمز در این سند مشخص شده اما تا وجود endpoint معتبر نباید به منطق متصل شود.

---

## ۲. Design Tokens

### ۲.۱ رنگ‌ها

| Role | Dark (پیش‌فرض) | Light | مصرف |
|---|---:|---:|---|
| `primary` | `#C9A96E` | `#8A6A3F` | CTA، focus، active |
| `onPrimary` | `#1A1208` | `#FFFFFF` | متن روی primary |
| `primaryContainer` | `#3D2E1A` | `#E8D4B0` | pill و انتخاب |
| `onPrimaryContainer` | `#E8D4B0` | `#3D2E1A` | متن container |
| `secondary` | `#6B8CAE` | `#4A6B8A` | اکشن مکمل |
| `tertiary` | `#6B8E7F` | `#4A6B5A` | اطلاعات/آمار |
| `success` | `#6FCF97` | `#2E7D4F` | تکمیل |
| `warning` | `#F2C94C` | `#B8860B` | هشدار |
| `error` | `#CF6679` | `#B3261E` | خطا |
| `background` | `#0A0E1A` | `#F7F3EC` | بوم اصلی |
| `surface` | `#121826` | `#FFFFFF` | کارت پایه |
| `surfaceVariant` | `#1A2233` | `#EFE9DE` | سطح مرتفع |
| `neutral` | `#8A92A6` | `#5A6170` | متن دوم |
| `neutralVariant` | `#3A4255` | `#C9CDD6` | placeholder |
| `outline` | `#3A4255` | `#C9CDD6` | مرز ضروری |

نگاشت اجرایی در `assets/styles/m3.css` با پیشوند `--md-*` است. تم تاریک پیش‌فرض در `<html data-theme="dark">` تعریف شده است. کنتراست متن عادی حداقل 4.5:1 و متن درشت 3:1 هدف‌گذاری می‌شود.

### ۲.۲ تایپوگرافی

| Token | Size / line-height / weight | کاربرد |
|---|---|---|
| `displayLarge` | 57 / 77 / 800 | hero دسکتاپ |
| `displaySmall` | 36 / 52 / 800 | hero موبایل |
| `headlineLarge` | 32 / 48 / 700 | عنوان صفحه |
| `headlineSmall` | 24 / 38 / 700 | عنوان بخش |
| `titleLarge` | 22 / 35 / 700 | عنوان کارت مهم |
| `titleMedium` | 16 / 27 / 700 | app bar، فهرست |
| `bodyLarge` | 16 / 33 / 400 | متن اصلی |
| `bodyMedium` | 14 / 28 / 400 | توضیح و فرم |
| `labelLarge` | 14 / 22 / 700 | دکمه و chip |
| `labelSmall` | 11 / 18 / 700 | metadata |
| `sacredLarge` | 30 / 70 / 400 Amiri | دعا/ذکر اصلی |
| `sacredMedium` | 24 / 55 / 400 Amiri | پیش‌نمایش عربی |

قاعده: برای فارسی `letter-spacing: 0`؛ برای عربی کشیده یا فاصلهٔ مصنوعی اضافه نمی‌شود. اندازهٔ متن مقدس مستقل از scale رابط قابل کنترل است.

### ۲.۳ شکل، فاصله، سایه و حرکت

| گروه | Tokenها |
|---|---|
| Radius | `sm: 8px`، `md: 16px`، `lg: 24px`، `xl: 28px`، `full: 999px` |
| Space | `4, 8, 12, 16, 24, 32, 48`؛ واحد پایه 8px |
| Elevation 0 | بدون سایه؛ تفاوت سطح با رنگ |
| Elevation 1 | `0 1px 3px rgba(0,0,0,.18)` |
| Elevation 2 | `0 8px 24px rgba(0,0,0,.18)` |
| Elevation 3 | `0 18px 54px rgba(0,0,0,.22)` |
| Motion | quick `160ms`، standard `200ms`، emphasized `240ms` |
| Touch | حداقل `48×48px`؛ فاصلهٔ دو هدف حداقل 8px |
| Focus | outline 2px primary + offset 2px |

**Grid:** موبایل `<600`: یک ستون و gutter 16؛ تبلت `600–1024`: دو ستون و gutter 24؛ دسکتاپ `>1024`: سه ستون، gutter 32 و حداکثر عرض 1200. Navigation Rail از فضای expanded در سمت راست فعال می‌شود.

---

## ۳. ورود و Onboarding

### ۳.۱ Wireframe موبایل 390×844

```text
┌──────────────────────────┐
│        نشان محراب         │
│         نورستان           │
│   همراه آرام هر روز       │
│                          │
│ ┌──────────────────────┐ │
│ │ ۱ شماره — ۲ کد — ۳ ورود│ │
│ │ شماره موبایل / ایمیل  │ │
│ │ توضیح یا خطای inline  │ │
│ │ [ دکمه اصلی 48px ]    │ │
│ │ [ کنش ثانویه ghost ]  │ │
│ └──────────────────────┘ │
│     پیام حریم خصوصی       │
└──────────────────────────┘
```

پس‌زمینه گرادیان سرمه‌ای و pattern هندسی با opacity حداکثر ۵٪ است. فرم radius 24، سطح تونال و elevation 3 دارد. ورود صفحه `fade + translateY(12px)` در 210ms است. خطای شدید فقط یک nudge کوتاه دارد و با `prefers-reduced-motion` خاموش می‌شود.

### ۳.۲ تبلت و دسکتاپ

قاب مرکزی حداکثر 1040px، دو ستون: **سمت راست** روایت برند، نشان و دو trust-chip؛ **سمت چپ** فرم. pattern و محراب انتزاعی فقط در پنل برند است. پیاده‌سازی جاری در `index.html` و `assets/styles/auth.css` انجام شده است.

### ۳.۳ حالت‌ها

- **OTP:** یک input حقیقی با `autocomplete="one-time-code"` و ۵ آینهٔ بصری؛ paste و screen reader سالم می‌ماند.
- **ایمیل/رمز (آمادهٔ UI):** input ایمیل با `autocomplete=email`، رمز با toggle دارای `aria-pressed`، لینک فراموشی؛ اتصال فقط پس از endpoint معتبر.
- **Validation:** آیکن + رنگ + متن کوتاه، `aria-describedby`؛ فوکوس روی اولین خطا.
- **Loading:** label ثابت، spinner درون دکمه، دکمه disabled و پیام `role=status`.
- **Network error:** پیام inline با دکمهٔ «بررسی دوبارهٔ اتصال»، نه modal.
- **خطای شدید:** shake حداکثر یک بار؛ نه در هر typo.

Component tree:

```text
AuthDialog
├── AmbientPattern (aria-hidden)
└── AuthShell
    ├── BrandPanel (desktop only)
    │   ├── MihrabMark
    │   ├── BrandCopy
    │   └── TrustChips
    └── AuthForm
        ├── StepIndicator
        ├── AuthField / OtpField
        ├── InlineMessage (aria-live)
        ├── PrimaryButton
        └── PrivacyNote
```

---

## ۴. الگوهای سراسری

- **Top bar:** عنوان در inline-start (راست در RTL)، back-chevron رو به راست، ارتفاع 64، sticky با surface نیمه‌شفاف.
- **Bottom nav:** حداکثر ۶ مقصد، ارتفاع 64 به‌علاوهٔ safe-area؛ active indicator یک pill `64×32` است. label حذف نمی‌شود.
- **Navigation rail:** در نمایش expanded در سمت راست، عرض 72 (و در حالت بازشده 240)، tooltip برای آیکن‌ها.
- **Card:** content = surface/r16؛ feature = surfaceVariant/r24؛ interactive با hover tonal، نه جهش بزرگ.
- **Dialog:** حداکثر 560px، r28؛ در موبایل bottom sheet با handle و safe-area.
- **States:** skeleton با ارتفاع نهایی محتوا؛ empty با یک اقدام؛ error با علت قابل‌فهم و retry؛ content بدون layout shift.

---

## ۵. Wireframe صفحات اصلی

### ۵.۱ خانه

```text
TopBar
Hero «ذکر امروز» [متن از NoorContent] [شروع]
QuickActions: ذکرشمار | اذکار | نمازها | دعاها
Stats: امروز | زنجیره | تکمیل
ContinueCard + progress
BottomNav
```

Hero سطح `primaryContainer`، r28 و تنها CTA پر صفحه را دارد. میانبرها ۲×۲ روی موبایل و ۴تایی روی تبلت‌اند. آمار در کارت‌های کوچک هم‌اندازه است. loading با skeleton، empty با توضیح «داده‌ای ثبت نشده»، error با retry نمایش داده می‌شود.

### ۵.۲ ذکرشمار

```text
TopBar (back / تنظیمات)
ArabicText (Amiri, sacredLarge)
Translation
      progress ring
       current / total
 [ سطح لمس اصلی 160–220px ]
 reset       sound/haptic
```

دکمهٔ شمارش با هر لمس scale حداکثر `.98` و موج 200ms دارد. ring از دادهٔ موجود پر می‌شود و `role=progressbar` با `aria-valuenow/max` دارد. completion یک سطح آرام با check، عنوان و دو اقدام است؛ confetti یا هیجان تجاری ندارد.

### ۵.۳ فهرست اذکار

موبایل: search sticky، chips افقی، فهرست کارت‌ها، badge تعداد فقط از محتوا. دسکتاپ: master list در راست و detail pane در چپ؛ انتخاب کارت URL/history و focus را حفظ می‌کند. empty-search امکان پاک‌کردن فیلتر دارد.

### ۵.۴ دعا

عرض متن در دسکتاپ حداکثر 720px است. عنوان/منبع در بالا، متن عربی با line-height باز، ترجمه در سطح جدا، toolbar خوانش sticky (اندازه فونت و line-height). CTAهای ممکن فقط وقتی لایهٔ منطق اجازه دهد نمایش داده می‌شوند؛ UI قابلیت عبادی تازه حدس نمی‌زند.

### ۵.۵ تنظیمات و پوسته‌ها

تنظیمات در card groupهای «ظاهر»، «خوانش»، «دسترس‌پذیری» و «حریم خصوصی» است. هر row حداقل 56px و label مستقل دارد. theme picker کارت‌های preview واقعی از سه سطح و primary است؛ انتخاب با check و `aria-checked` مشخص می‌شود، نه صرفاً border رنگی.

---

## ۶. Snippetهای مرجع

```css
.noor-card {
  padding: var(--md-space-4);
  border-radius: var(--md-shape-lg);
  color: var(--md-on-surface);
  background: var(--md-surface-container);
  box-shadow: var(--md-elev-1);
}
.noor-card[data-interactive]:hover {
  background: var(--md-surface-container-high);
}
```

```html
<nav class="nav" aria-label="راهبری اصلی">
  <button class="navi on" aria-current="page">
    <i aria-hidden="true"><!-- line icon --></i><span>صحن</span>
  </button>
</nav>
```

## ۷. معیار پذیرش

1. در 320px اسکرول افقی وجود ندارد؛ در 390×844 CTA ورود بدون zoom قابل دستیابی است.
2. تمام کنترل‌ها با Tab قابل دسترسی و focus واضح دارند.
3. صفحه‌خوان عنوان dialog، label، خطا و loading را به ترتیب اعلام می‌کند.
4. با reduced motion هیچ pattern، shake یا ring متحرک اجباری نیست.
5. UI هیچ متن/عدد عبادی hard-code نمی‌کند.
6. تم تاریک/روشن و تمام breakpointها بدون تغییر DOM کار می‌کنند.

## ۸. پرسش‌های برند برای دور بعد

- آیا نشان «ن» در محراب باید لوگوی نهایی باشد یا صرفاً placeholder هندسی؟
- لحن برند رسمی‌تر باشد یا صمیمیِ محترمانهٔ فعلی؟
- آیا احراز هویت آینده ایمیل/رمز خواهد داشت یا OTP موبایل قرارداد نهایی است؟
- کدام تم‌های موجود باید در محصول نهایی حفظ شوند: شب، اقیانوس، جنگل، زرین، کویر، روشن؟
