# لایهٔ دادهٔ عبادیِ نورستان — `NoorContent` (نسخهٔ ۲۳ب)

**تاریخ:** ۲۰۲۶-۱۰-۱۴ · **شاخه:** `arena/435b5423-noorestan` · **PR:** #38
**فایل‌ها:** `assets/app/content-1.js` · `assets/app/dua-full-1.js` (پل) · `assets/app/wird-1.js` (مصرف‌کننده) · `_content-audit.js` (بازرس) · `_tests.js` (سنجش‌ها) · `sw.js` (نسخهٔ کش **۴۹**: بدنهٔ سه فایلِ پیش‌ذخیره‌شده عوض شد)

> ⚠️ **دامنهٔ راستی‌آزمایی:** این لایه **هیچ ادعای دینی‌ای را راستی‌آزمایی نمی‌کند** و نمی‌تواند بکند.
> کارِ آن فقط «ساختار، منبع و جایِ خالی» است. هیچ متنِ عربی، ترجمه یا عددِ تکراری حدس زده
> نشده است؛ هرچه در ورودیِ تأییدشدهٔ صاحبِ برنامه نیامده `null` مانده و در `pending()` دیده می‌شود.
> همچنین در این محیط **مرورگری نصب نیست**، پس هیچ راستی‌آزماییِ بصری انجام نشده است.

---

## ۱) قاعده‌های سخت

1. **یک منبعِ حقیقت:** هر متنِ عربی، ترجمه، عددِ تکرار، ترتیب و دسته فقط در `content-1.js` نوشته می‌شود.
2. **حدس ممنوع:** نبودِ داده ⇒ `null` ⇒ UI **جایِ خالیِ محترمانه** نشان می‌دهد («—» و پاورقیِ
   «تعدادِ تکرار در منبع ثبت نشده است»). هیچ عددِ پیش‌فرضی ساخته نمی‌شود.
3. **رشتهٔ تهی ممنوع:** `arabicText:''` یعنی «من متن دارم ولی خالی» — باید `null` باشد
   («نمی‌دانم»). اعتبارسنجی رد می‌کند.
4. **تأییدِ خودکار ممنوع:** `verified` فقط با ورودیِ صریح و **با منبع** `true` می‌شود.
5. **تعارض ⇒ تازهٔ تأییدشده برنده است** و اختلاف در `diff()`/`log` ثبت می‌شود.
6. **بانک‌های قفل دست‌نخورده:** `DATA.duas` (بازیِ «نجوا») فقط *خوانده* می‌شود.

---

## ۲) مدلِ داده (schema نسخهٔ ۱)

انواعِ مجاز (`NoorContent.TYPES`): `dhikr-set` · `dhikr` · `prayer-step` · `dua` · `act`

| فیلد | نوع | قاعده |
|---|---|---|
| `id` | string | یکتا. `zahra` · `zahra.takbir` · `step.sujud` · `dua.1` |
| `type` | enum | یکی از `TYPES` |
| `title` / `shortTitle` | string | `title` اجباری (در رکوردِ ادغام‌شده) |
| `arabicText` | string \| **null** | `null` = در منبع نیامده؛ رشتهٔ تهی رد می‌شود |
| `translationFa` | string \| **null** | همان قاعده |
| `repeatCount` | int>0 \| **null** | `null` ⇒ شمارنده باز، UI «—» |
| `category` | string | `تعقیباتِ نماز` · `نماز` · `شخصی` · `دعا` |
| `order` | number | ترتیبِ نمایش؛ تکراری در یک والد = ایراد |
| `phases` | string[] | فقط `dhikr-set` — باید با `order`ِ فازها یکی باشد |
| `parent` | string | فقط `dhikr` — والد باید `dhikr-set` باشد |
| `steps` | string[] | پشتیبانی می‌شود؛ امروز ترتیبِ مرحله‌های نماز از `order` **مشتق** می‌شود (`stepsOf()`) تا منبعِ دومی ساخته نشود |
| `source` | string | **اجباری** — کتاب/باب یا «ورودیِ تأییدشدهٔ صاحبِ برنامه» |
| `sourceBank` | string | منبعِ دوم وقتی دو منبع متفاوت هست (بانکِ دعا و پوششِ نمایشی) |
| `sourceNote` | string | «این رکورد از کجا منتقل شده» |
| `verified` | boolean | تأییدِ کلِ رکورد — فقط با منبع |
| `verifiedText` | boolean | فقط *متن* تأیید شده (عدد نه) — مثلِ ذکرِ سجده |
| `fragment` | boolean | متن، بریدهٔ کوتاهِ بانک است نه متنِ کامل |
| `notes` / `tags` | string / string[] | یادداشت و برچسب |
| `translations` | `{lang: string\|null}` | i18nِ آینده؛ هرگز حدس زده نمی‌شود |
| `editable` | boolean | کاربر اجازهٔ ویرایش دارد (ذکرِ دلخواه) |

---

## ۳) API

### پرس‌وجو
`item(id)` · `all()` · `byType(t)` · `byCategory(c)` · `categories()` · `phases(setId)` ·
`goalTotal(setId)` · `countSummary(setId)` · `repeatLabel(itemOrId)` · `preset(setId)` ·
`presetIds()` · `prayerStep(id)` · `stepsOf(type)` / `stepIds(type)` ·
`duas()` · `dua(idOrTitle)` · `duaByTitle(title)` · `translation(itemOrId, lang)` · `fa(n)`

### هنجارسازی (فقط برای مقایسه)
`bare(s)` — اعراب/کشیده پاک، `إأآ→ا`، `ي→ی`، `ك→ک`، `ة/ۀ/ٔ→ه`، ZWNJ→فاصله ·
`bareKey(s)` — همان، بی‌فاصله و lowercase (برای برابریِ سخت‌گیرانه) ·
`norm(s)` — **همان `U.norm` خودِ برنامه** اگر در دسترس باشد (تا بازرس و برنامه یکی مقایسه کنند).

### ورودِ داده
| تابع | کار |
|---|---|
| `validate(rec, meta)` | ایرادهای ساختاریِ **رکوردِ ادغام‌شده** (وصلهٔ جزئی رد نمی‌شود) |
| `diff(incoming)` | پیش‌نمایشِ **خالص**ِ تعارض‌ها: `new / text / spelling / count / fill / erase / order / title / source / verified / …` |
| `register(incoming, meta)` | تنها دروازهٔ نوشتن ⇒ `{added, updated, invalid, conflicts, warnings}` |
| `note(id, changes, source)` | دفترِ تغییرها (`log`، کرانِ `LOG_MAX = 200`) |
| `adoptDuas(bank, overlay, meta)` | پلِ دعاها ⇒ `{added, updated, matched, fragments, sourceDiff, invalid}` |

### وضعیتِ محتوا
| تابع | خروجی |
|---|---|
| `expectsRepeat(type)` | `dhikr` و `prayer-step` ⇒ بله؛ `dua` و `dhikr-set` ⇒ نه |
| `expectsText(type)` | همه جز `dhikr-set` (مجموعه ظرف است، متنش در فازهایش) |
| `gaps(rec)` | شکاف‌های داده: `arabicText` / `translationFa` / `repeatCount` / `source` |
| `isPending(rec)` | چهار شرطِ «در انتظارِ منبعِ معتبر» |
| `pending()` | فهرستِ رکوردهای در انتظار با `{id, type, title, category, missing, verified, source}` |
| `pendingSummary()` | خلاصهٔ عددی برای گزارش و بازرس |
| `selfTest()` | **۲۴ سنجشِ ساختاری**، بی DOM، پاک‌شونده (رکوردهای آزمون را برمی‌دارد) |

**چهار شرطِ `isPending`** (هرکدام ⇒ رکورد «در انتظارِ منبعِ معتبر» است):
1. `arabicText` برابرِ `null`/`undefined` (برای نوعی که متن دارد)،
2. `repeatCount` برابرِ `null`/`undefined` **و** نوعش تکرارپذیر باشد،
3. `source` خالی،
4. `verified === false`.

---

## ۴) پلِ دعاها (`adoptDuas`)

بانکِ `DATA.duas` (۱۴ دعا) به دلیلِ بازیِ «نجوا» و دروازهٔ «DATA source unchanged» **قفل** است،
پس این ماژول آن را تغییر نمی‌دهد؛ `assets/app/dua-full-1.js` هنگامِ بار شدنِ برنامه همان بانک و
پوششِ نمایشیِ `DUA_FULL` را به رکوردهای `type:'dua'` نگاشت می‌کند:

| فیلدِ رکورد | از کجا |
|---|---|
| `id` | `dua.<n>` (n = شمارهٔ مدخل در بانک؛ بانک بایت‌به‌بایت قفل است، پس پایدار است) |
| `title` / `order` / `bankIndex` | بانک |
| `arabicText` / `translationFa` | پوششِ `DUA_FULL` اگر پیدا شد، وگرنه بانک + `fragment:true` |
| `source` | `src` پوشش (کامل‌تر)، وگرنه `src` بانک |
| `sourceBank` | `src` بانک وقتی با پوشش متفاوت است (هر ۱۴ مورد) |
| `verified` | **همیشه `false`** — این دعاها در ورودیِ تأییدشدهٔ صاحبِ برنامه نبوده‌اند |
| `repeatCount` | **همیشه `null`** — دعا عددِ تکرارِ حدسی نمی‌گیرد |

تطبیقِ پوشش با بانک **همان قاعدهٔ `WirdUI.text()`** است (`norm(title).includes(norm(for))`) تا یک
دعا دو پوشش نگیرد. `WirdUI.text()` از نسخهٔ ۲۳ب ابتدا از `NoorContent.duaByTitle()` می‌خواند و
اگر لایهٔ محتوا بار نشد، **همان مسیرِ پیشین** (پوشش، بعد بانک) بی‌تغییر کار می‌کند؛ قراردادِ
خروجی `{title, ar, fa, src}` دست‌نخورده است و یک سنجشِ «قاعدهٔ طلایی» بایت‌به‌بایت بودنِ خروجیِ
هر ۱۴ دعا را قفل می‌کند.

---

## ۵) بازرسِ محتوا (`node _content-audit.js`)

بخشِ **۹ — لایهٔ محتوا (NoorContent)** سه کار می‌کند:

**۹.۱ ساختار (ایراد ⇒ کدِ خروج ۱):** شناسهٔ تکراری · نتیجهٔ `validate()` · `arabicText` رشتهٔ تهی ·
متنِ عربیِ بی‌`source` · `verified:true` بی‌منبعِ تأیید · مجموعهٔ بی‌فاز · فاز/والدِ گم‌شده ·
`parent`ای که `dhikr-set` نیست · فازی که `parent`ش به مجموعه برنمی‌گردد · `order` تکراری در یک والد ·
`phases` نامرتب نسبت به `order`.

**۹.۲ مغایرتِ کد/داده (ایراد):** اسکنِ رشته‌های لایهٔ نمایش
(`sajjada-1.js`, `wird-1.js`, `m3-1.js`, `salah-1.js`, `courtyard-1.js`) با نشانگرِ عربی
`[ـٰ إ ؤ ك ي]` — بیرونِ توضیح‌ها، و بی شمردنِ رشته‌هایی که **ارجاع** به عنوان/متنِ داده‌اند.
رشتهٔ عربیِ پوشش‌نداده ⇒ «متنِ عبادیِ hard-code در لایهٔ نمایش».
> چرا این نشانگرها؟ فارسیِ رابط اعراب دارد («نمازِ») و `أ` هم در فارسی می‌آید («تأیید»)؛ اگر
> اعراب یا `أ` نشانگر بود، هر رشتهٔ فارسی خطا می‌شد. `ی/کِ عربی` و `ٰ` و `إ/ؤ` در فارسیِ روزمره
> نمی‌آیند.

**۹.۳ وضعیتِ محتوا (اطلاعیه ⇒ بدونِ اثر بر کدِ خروج):** هم‌پوشانیِ متن‌ها (هم‌متن/پارهٔ هم) ·
`repeatCount` ثبت‌نشده · ترجمهٔ فارسیِ نبوده · متنِ عربیِ نبوده · `fragment` · دو منبعِ متفاوت.

سه سطحِ گزارش: `bad` (✗ ایرادِ ساختاری) · `warn` (⚠ هشدارِ بانک‌ها) · `note` (· اطلاعیهٔ محتوایی).

**خروجیِ ماشینی:** `node _content-audit.js --json` ⇒ `tmp/content-report.json`
(`tmp/` در `.gitignore` است):
```json
{ "tool":"_content-audit.js", "generatedAt":"…",
  "counts":{ "issues":0, "warns":0, "notes":19 },
  "content":{ "summary":{ … }, "adopted":{ "added":14, "matched":14, "fragments":0, "sourceDiff":14 },
              "overlaps":13, "strayHardcode":[], "verified":[…], "pending":[…] },
  "flags":[ { "level":"note", "where":"content:…", "msg":"…" } ] }
```

---

## ۶) وضعیتِ محتوا در این نوبت

**۳۸ رکورد** = ۲۴ (ذکر/تسبیح/نماز) + ۱۴ (دعا، از پل)

| | تعداد |
|---|---|
| تأییدشده (`verified:true`) | **۴** — `zahra`, `zahra.takbir`, `zahra.hamd`, `zahra.tasbih` |
| متنِ تأییدشده، عدد در انتظار (`verifiedText`) | **۱** — `step.sujud` |
| در انتظارِ منبعِ معتبر (`pending`) | **۳۴** |
| بی‌منبع (`source` خالی) | **۰** |
| بریدهٔ بانک (`fragment`) | **۰** |
| هم‌پوشانیِ متن (برای بازبینیِ انسانی) | **۱۳** |
| متنِ عبادیِ hard-code در لایهٔ نمایش | **۰** |

نوع‌ها: `dhikr-set=6 · dhikr=8 · prayer-step=10 · dua=14`
جایِ خالی: `translationFa=2 · repeatCount=2 · arabicText=1`

| id | نوع | وضعیت | جایِ خالی |
|---|---|---|---|
| `zahra` | dhikr-set | ✅ تأییدشده (۳۴/۳۳/۳۳، `editable:false`) | — |
| `zahra.takbir` | dhikr | ✅ تأییدشده — «اَللهُ اَکبَر» · ۳۴ | — |
| `zahra.hamd` | dhikr | ✅ تأییدشده — «اَلْحَمْدُ لِلّٰه» · ۳۳ | — |
| `zahra.tasbih` | dhikr | ✅ تأییدشده — «سُبْحانَ الله» · ۳۳ | — |
| `step.sujud` | prayer-step | 🟡 متن تأییدشده، عدد/ترجمه نه | `translationFa` · عدد در انتظارِ تأیید |
| `step.dhikr34` | prayer-step | 🟡 متن از نسخهٔ پیشین | `repeatCount` ⇒ UI «—» |
| `custom.1` | dhikr | 🟡 ذکرِ دلخواهِ کاربر | `arabicText` + `translationFa` + `repeatCount` |
| `istighfar.1 / tahlil.1 / hawqala.1 / salawat.1` | dhikr | 🟡 عددها از نسخهٔ پیشین (۷۰/۱۰۰/۱۰۰/۱۰۰) | `verified` |
| `dua.1 … dua.14` | dua | 🟡 از بانک + پوشش، با `src` واقعی | `verified` · `repeatCount` (طبیعی برای دعا) |

**هم‌پوشانی‌های گزارش‌شده (نیازمندِ تأییدِ انسانی، نه ایراد):**
`zahra.takbir` = `step.takbir` = `step.julus` («اَللهُ اَکبَر») · `salawat.1` = `dua.10` (صلوات) ·
`step.dhikr34` ⊃ سه فازِ تسبیحات + تکبیر + تهلیل · `step.tashahhud` ⊃ تهلیل و صلوات ·
`dua.9` ⊃ `hawqala.1` · `dua.11` ⊃ `zahra.tasbih`.

---

## ۷) چگونه دادهٔ تأییدشده وارد کنید

در کنسولِ مرورگر (یا در یک فایلِ دادهٔ تازه که پس از `content-1.js` بار شود):

**۱. تأییدِ عددِ تکرارِ ذکرِ سجده + افزودنِ ترجمه:**
```js
NoorContent.register([{
  id:'step.sujud', repeatCount: 3, translationFa:'پاک است پروردگارِ برترِ من، و ستایش از آنِ اوست',
  verified:true, source:'ورودیِ تأییدشدهٔ صاحبِ برنامه — <تاریخ>'
}]);
NoorContent.pending().filter(p => p.id === 'step.sujud');   // ⇒ []
```

**۲. اصلاحِ متنِ یک ذکر (متنِ تازه بر قدیمی می‌چربد):**
```js
NoorContent.diff([{ id:'tahlil.1', arabicText:'لا اِلهَ اِلَّا الله' }]);   // پیش‌نمایش، بدونِ نوشتن
NoorContent.register([{ id:'tahlil.1', arabicText:'لا اِلهَ اِلَّا الله',
                        verified:true, source:'…' }]);                       // نوشتن
```

**۳. افزودنِ دعوای تازه (بی دست‌زدن به بانکِ قفل):**
```js
NoorContent.register([{ id:'dua.shafa', type:'dua', title:'دعای شفا',
  arabicText:'…', translationFa:'…', repeatCount:null, category:'دعا', order:15,
  verified:true, source:'مفاتیح‌الجنان، …' }]);
```

**۴. افزودنِ ترجمهٔ انگلیسی (وقتی تأیید شد):**
```js
NoorContent.register([{ id:'zahra.takbir', translations:{ en:'Allah is the Greatest' } }]);
NoorContent.translation('zahra.takbir', 'en');   // تا آن لحظه ⇒ null (هرگز حدس نمی‌زند)
```

**۵. دیدنِ وضعیت:**
```js
NoorContent.pendingSummary();
NoorContent.pending().map(p => `${p.id} [${p.missing.join('+') || 'verified'}]`);
```

---

## ۸) سنجش‌ها

* `NoorContent.selfTest()` — **۲۴ سنجش** (اعتبارسنجی، `diff`، وصلهٔ جزئی، تعارض، تأییدِ بی‌منبع،
  چهار شرطِ `pending`، آگاهی از نوع، ترجمهٔ حدسی‌نشدنی، مشتق‌بودنِ ترتیب، `pendingSummary`، پاک‌سازی).
* `_tests.js` → بخشِ **«لایهٔ محتوا — ثبت، تعارض و جایِ خالی (نسخهٔ ۲۳ب)»** — ۲۱ سنجش:
  پلِ دعاها (۱۴ رکورد، بی متنِ تازه، بانکِ قفل دست‌نخورده)، قاعدهٔ طلاییِ `WirdUI.text()`،
  اسکنِ hard-code، برابریِ متنِ هر مرحلهٔ نماز با داده، **جایِ خالیِ محترمانه در HTMLِ ذکرشمار**
  (`از —` + پاورقیِ «ثبت نشده» + نبودِ هر عددِ پیش‌فرض + `openEnded`)، `pendingSummary`،
  i18n و کرانِ `log`.
* `_tests.js` → بخشِ «محتوا — بازرسِ ساختاری»: سه سنجشِ تازه که اجرا و اعدادِ بخشِ ۹ِ بازرس و
  گزارشِ `--json` را قفل می‌کند.

**دروازه‌ها:** `_harness.js` ۱۱۸۶/۰ (۵۷ بخش) · `tools/ci.sh` سبز · `_servertest.js` ۲۵۵/۰ ·
`tests/sw.test.js` ۱۷/۰ · `_content-audit.js` ۰ ایراد، ۰ هشدار، ۱۹ اطلاعیه ·
`tests/server.test.js` ۱۱۴/۰/۱ در انتظار · games ۴۷۲/۱۶۶/۴۲ سبز.

---

## ۹) آنچه هنوز به ورودیِ صاحبِ برنامه نیاز دارد

1. **ذکرِ سجده:** تعدادِ تکرارِ تأییدشده + ترجمهٔ فارسی.
2. **شکلِ اعراب‌گذاریِ** سه ذکرِ تسبیحات (بااعراب مانده یا بی‌اعراب شود).
3. **عددهای نسخهٔ پیشین** (`istighfar.1` ۷۰، `tahlil.1`/`hawqala.1`/`salawat.1` ۱۰۰،
   `step.*`) — تأیید، اصلاح یا حذف.
4. **`step.dhikr34`** — عددِ تکرار (امروز `null` ⇒ شمارش آزاد).
5. **فهرستِ نهاییِ دعاها و دسته‌بندی‌ها** (امروز همهٔ دعاها `category:'دعا'` — منتظرِ دسته‌بندیِ شما).
6. **هم‌پوشانی‌های متن** (بندِ ۶) — آیا هر دو رکورد باید بماند یا یکی حذف/ادغام شود.
7. **ترجمهٔ انگلیسی** — چه زمانی و با چه دامنه‌ای (تا رسیدنِ ورودیِ تأییدشده، `translation()` فقط `null` می‌دهد).
