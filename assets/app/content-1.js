/* ═══════════════════════════════════════════════════════════════════
   نورستان — لایهٔ دادهٔ محتوای عبادی (`NoorContent`)
   ═══════════════════════════════════════════════════════════════════
   چرا این فایل وجود دارد؟
   تا نسخهٔ ۲۲ متنِ عربیِ اذکار و تعدادِ تکرارشان در لایهٔ نمایش پخش
   بود: `Dhikr.PRESETS` در sajjada-1.js، `Sajjada.TXT` هم همان‌جا، و
   یک نسخهٔ پشتیبانِ سوم در `Tasbih.PHASES` (wird-1.js). سه جای مستقل
   برای یک واقعیت، یعنی هر اصلاح باید سه بار تکرار شود و اگر یکی جا
   بیفتد برنامه *بی‌صدا* متن یا عددِ اشتباه نشان می‌دهد. دو نمونهٔ
   واقعی که همین‌جا پیدا شد:
     • ذکرِ سجده «سُبْحانَ اللهِ الْعَلِیِّ رَبِّنا وَ بِحَمْدِهِ» بود،
       نه متنِ درستِ «سُبْحانَ رَبِّیَ الأَعْلیٰ وَ بِحَمْدِهِ».
     • تسبیحاتِ حضرتِ زهرا (س) سه فازِ ۳۳/۳۳/۳۳ با ترتیبِ
       سبحان‌الله ← الحمدلله ← الله‌اکبر بود؛ حال آنکه ۳۴ الله‌اکبر،
       ۳۳ الحمدلله و ۳۳ سبحان‌الله است (جمعاً ۱۰۰، نه ۹۹).

   حالا یک منبعِ حقیقت هست: هر واحدِ عبادی یک رکوردِ مستقل با فیلدهای
   صریح است و UI فقط از این‌جا می‌خواند. هیچ متنِ عربی و هیچ عددِ
   تکراری در لایهٔ نمایش hard-code نمی‌شود.

   ── قراردادِ داده ────────────────────────────────────────────────
   هر رکورد این فیلدها را دارد:
     id            شناسهٔ یکتا و پایدار (کلیدِ ذخیره‌سازی هم از این می‌آید)
     type          'dhikr' | 'dhikr-set' | 'dua' | 'prayer-step' | 'act'
     title         نامِ فارسیِ کوتاه برای فهرست و زبانه
     arabicText    متنِ عربی؛ `null` یعنی «هنوز از منبعِ معتبر نرسیده»
     translationFa ترجمهٔ فارسی؛ `null` یعنی ثبت‌نشده (جای خالی در UI)
     repeatCount   تعدادِ تکرار؛ `null` یعنی نامشخص — هرگز عددِ پیش‌فرض
                   ساخته نمی‌شود، UI جای خالیِ محترمانه نشان می‌دهد
     category      دستهٔ نمایشی («تعقیباتِ نماز»، «نماز»، …)
     order         ترتیبِ نمایش در دسته/مجموعه (عددِ صحیح)
     phases        برای `dhikr-set`: فهرستِ شناسهٔ فازها، به همان ترتیبی
                   که باید شمرده و نمایش داده شوند
     parent        برای فازها: شناسهٔ مجموعهٔ والد
     notes         توضیحِ کوتاهِ عملکردی (نه بخشی از متنِ عبادی)
     source        نشانیِ منبع («ورودیِ تأییدشدهٔ صاحبِ برنامه — تاریخ»،
                   «نسخهٔ پیشینِ برنامه — در انتظار تأیید»)
     verified      `true` فقط وقتی متن/عدد مستقیماً از ورودیِ معتبرِ
                   صاحبِ برنامه آمده باشد؛ وگرنه `false`
     tags          برچسب‌های جست‌وجو

   سه قاعدهٔ سختِ محتوا (همان‌ها که در سندِ طراحی آمده):
     ۱) هیچ متن و هیچ عددی فرضی نیست؛ هرچه `verified:false` است از
        نسخهٔ پیشینِ برنامه مانده و در فهرستِ `pending()` دیده می‌شود.
     ۲) اگر داده‌ای نامشخص است `null` می‌ماند — عددِ پیش‌فرض اضافه
        نمی‌شود و UI جای خالیِ محترمانه نشان می‌دهد (`repeatLabel`).
     ۳) ورودیِ تازهٔ تأییدشده همیشه بر دادهٔ قدیمی می‌چربد
        (`register()` با `verified:true` رکوردِ قبلی را جایگزین می‌کند).
   ═══════════════════════════════════════════════════════════════════ */

const NoorContent = {
  SCHEMA: 1,
  REV: '2026-10-13',

  /* منبعِ دو رکوردِ تأییدشده: همان ورودیِ صریحِ صاحبِ برنامه. */
  CONFIRMED: 'ورودیِ تأییدشدهٔ صاحبِ برنامه — ۲۰۲۶-۱۰-۱۳',
  /* بقیه از نسخهٔ پیشینِ برنامه آمده‌اند؛ تا تأیید نشوند `verified:false`
     می‌مانند و در `pending()` فهرست می‌شوند. هیچ‌کدام بی‌صدا «معتبر»
     شمرده نمی‌شوند. */
  LEGACY: 'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع',

  /* ── انواعِ مجازِ واحدِ عبادی ──
     هر «واحدِ عبادی» یک رکوردِ مستقل است؛ هیچ متنِ عربی، ترجمه یا عددِ
     تکراری در لایهٔ نمایش نوشته نمی‌شود. */
  TYPES:['dhikr-set', 'dhikr', 'prayer-step', 'dua', 'act'],

  /* ── قراردادِ رکورد (schema نسخهٔ ۱) ────────────────────────────
     id            string  یکتا. مجموعه `zahra`، فاز `zahra.takbir`،
                           مرحلهٔ نماز `step.sujud`، دعا `dua.1`
     type          یکی از TYPES
     title         نامِ فارسی (اجباری)
     shortTitle    نامِ کوتاه برای تب/فهرست (اختیاری)
     arabicText    string | null   — `null` یعنی «در منبع نیامده».
                           رشتهٔ تهی مجاز نیست (اعتبارسنجی رد می‌کند).
     translationFa string | null   — همان قاعده
     repeatCount   number | null   — عددِ صحیحِ مثبت یا `null`؛ `null` یعنی
                           ثبت‌نشده ⇒ UI جایِ خالی نشان می‌دهد و شمارنده
                           باز می‌ماند. هرگز مقدارِ پیش‌فرض ساخته نمی‌شود.
     category      string  — دستهٔ نمایشی
     order         number  — ترتیبِ نمایش، فقط از داده
     phases        string[] — فقط `dhikr-set`: شناسهٔ فازها *به ترتیب*
     parent        string  — فقط `dhikr`: مجموعهٔ والد
     steps         string[] — برای `act`/عملِ چندگامی: شناسهٔ گام‌ها به ترتیب.
                           (مرحله‌های نماز امروز از `order`ِ خودِ رکوردها
                           *مشتق* می‌شوند — `stepsOf()` — تا منبعِ حقیقتِ
                           دومی برای ترتیب ساخته نشود.)
     source        string  — **اجباری**: کتاب/باب یا «ورودیِ تأییدشدهٔ …»
     sourceBank    string  — وقتی دو منبع برای یک رکورد هست (مثلاً بانکِ
                           دعا و پوششِ نمایشی‌اش) منبعِ دوم این‌جا می‌ماند
     sourceNote    string  — توضیحِ «این رکورد از کجا منتقل شده»
     verified      boolean — کلِ رکورد تأیید شده؟ فقط با ورودیِ صریح
     verifiedText  boolean — فقط *متن* تأیید شده (عدد نه)
     fragment      boolean — متن، بریدهٔ کوتاهِ یک بانک است نه متنِ کامل
     notes         string  — یادداشتِ کوتاه
     tags          string[]
     translations  {lang: string|null} — i18nِ آینده؛ هرگز حدس زده نمی‌شود
     editable      boolean — کاربر اجازهٔ ویرایش دارد (ذکرِ دلخواه)
     ───────────────────────────────────────────────────────────── */

  items: [
    /* ── تسبیحاتِ حضرتِ زهرا (س) ──
       ترتیب و تعداد دقیقاً همان چیزی است که صاحبِ برنامه داد:
       ۳۴ الله‌اکبر ← ۳۳ الحمدلله ← ۳۳ سبحان‌الله (جمعاً ۱۰۰).
       شکلِ بااعرابِ متن‌ها نگه داشته شده (هم‌خانوادهٔ ذکرِ سجده که
       خودِ صاحبِ برنامه بااعراب فرستاد)؛ اگر شکلِ بی‌اعراب خواسته شود
       فقط همین سه `arabicText` عوض می‌شود و هیچ منطقی تغییر نمی‌کند. */
    { id:'zahra', type:'dhikr-set', title:'تسبیحاتِ حضرتِ زهرا (س)',
      shortTitle:'تسبیحاتِ زهرا (س)', category:'تعقیباتِ نماز', order:1,
      phases:['zahra.takbir', 'zahra.hamd', 'zahra.tasbih'],
      notes:'پس از هر نماز', source:'ورودیِ تأییدشدهٔ صاحبِ برنامه — ۲۰۲۶-۱۰-۱۳',
      verified:true, tags:['tasbih', 'zahra', 'تعقیب'] },

    { id:'zahra.takbir', type:'dhikr', title:'الله‌اکبر', parent:'zahra', order:1,
      arabicText:'اَللهُ اَکبَر', translationFa:'خدا بزرگ‌تر است', repeatCount:34,
      category:'تعقیباتِ نماز', notes:'فازِ نخستِ تسبیحات',
      source:'ورودیِ تأییدشدهٔ صاحبِ برنامه — ۲۰۲۶-۱۰-۱۳', verified:true, tags:['zahra'] },

    { id:'zahra.hamd', type:'dhikr', title:'الحمدلله', parent:'zahra', order:2,
      arabicText:'اَلْحَمْدُ لِلّٰه', translationFa:'ستایش، از آنِ خداست', repeatCount:33,
      category:'تعقیباتِ نماز', notes:'فازِ دومِ تسبیحات',
      source:'ورودیِ تأییدشدهٔ صاحبِ برنامه — ۲۰۲۶-۱۰-۱۳', verified:true, tags:['zahra'] },

    { id:'zahra.tasbih', type:'dhikr', title:'سبحان‌الله', parent:'zahra', order:3,
      arabicText:'سُبْحانَ الله', translationFa:'پاک است خدا', repeatCount:33,
      category:'تعقیباتِ نماز', notes:'فازِ سومِ تسبیحات',
      source:'ورودیِ تأییدشدهٔ صاحبِ برنامه — ۲۰۲۶-۱۰-۱۳', verified:true, tags:['zahra'] },

    /* ── ذکرِ سجده ──
       متنِ تأییدشده؛ تعدادِ تکرار در ورودیِ صاحبِ برنامه نیامده، پس از
       نسخهٔ پیشین (۳ بار) با نشانِ `verified:false` مانده و در `pending()`
       فهرست می‌شود تا تأیید شود. هیچ عددِ تازه‌ای ساخته نشده است. */
    { id:'step.sujud', type:'prayer-step', title:'ذکرِ سجده', order:7,
      arabicText:'سُبْحانَ رَبِّیَ الأَعْلیٰ وَ بِحَمْدِهِ',
      translationFa:null, repeatCount:3,
      category:'نماز', notes:'سه بار در سجده — هفت عضو بر زمین',
      source:'متن: ورودیِ تأییدشدهٔ صاحبِ برنامه (۲۰۲۶-۱۰-۱۳) · تعداد: نسخهٔ پیشین، در انتظار تأیید',
      verified:false, verifiedText:true, tags:['sajdah', 'نماز'] },

    /* ── بقیهٔ مرحله‌های نماز (همان متن‌های نسخهٔ پیشین، بی تغییر) ── */
    { id:'step.takbir', type:'prayer-step', title:'تکبیرةُالاحرام', order:1,
      arabicText:'اَللهُ اَکبَر', translationFa:'خدا بزرگ‌تر است — آغازِ نماز', repeatCount:1,
      category:'نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['نماز'] },
    { id:'step.hamd', type:'prayer-step', title:'حمد و سوره', order:2,
      arabicText:'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحیمِ', translationFa:'حمد و سپس سوره‌ای کوتاه بخوان',
      repeatCount:1, category:'نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع',
      verified:false, tags:['نماز'] },
    { id:'step.dhikr34', type:'prayer-step', title:'ذکرِ رکعتِ سوم و چهارم', order:3,
      arabicText:'سُبْحَانَ اللَّهِ وَ الْحَمْدُ لِلّٰهِ وَ لا اِلٰهَ اِلَّا اللهُ وَ اللهُ اَکبَرُ',
      translationFa:'در رکعتِ سوم و چهارم: سه بار این ذکر، یا سه بار حمد', repeatCount:null,
      category:'نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['نماز'] },
    { id:'step.qunut', type:'prayer-step', title:'قنوت', order:4,
      arabicText:'رَبَّنا آتِنا فِی الدُّنْیا حَسَنَةً وَ فِی الْآخِرَةِ حَسَنَةً وَ قِنا عَذابَ النّارِ',
      translationFa:'دست‌ها روبه‌آسمان — هر دوعایی هم کافی است', repeatCount:1,
      category:'نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['نماز'] },
    { id:'step.ruku', type:'prayer-step', title:'ذکرِ رکوع', order:5,
      arabicText:'سُبْحانَ رَبِّیَ الْعَظیمِ وَ بِحَمْدِهِ', translationFa:'سه بار در رکوع',
      repeatCount:3, category:'نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع',
      verified:false, tags:['نماز'] },
    { id:'step.rise', type:'prayer-step', title:'برخاستن از رکوع', order:6,
      arabicText:'سَمِعَ اللهُ لِمَنْ حَمِدَهُ',
      translationFa:'برخاستن از رکوع — و برقامه: اَلْحَمْدُ لِلّٰهِ رَبِّ الْعالَمینَ', repeatCount:1,
      category:'نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['نماز'] },
    { id:'step.julus', type:'prayer-step', title:'جُلوس میانِ دو سجده', order:8,
      arabicText:'اَللهُ اَکبَر', translationFa:'نشستن میانِ دو سجده', repeatCount:1,
      category:'نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['نماز'] },
    { id:'step.tashahhud', type:'prayer-step', title:'تشهّد', order:9,
      arabicText:'اَلتَّحِیّاتُ لِلّٰهِ وَ الصَّلَواتُ وَ الطَّیِّباتُ… اَشْهَدُ اَنْ لا اِلٰهَ اِلَّا اللهُ وَحْدَهُ لا شَریکَ لَهُ وَ اَنَّ مُحَمَّداً عَبْدُهُ وَ رَسولُهُ، اَللّٰهُمَّ صَلِّ عَلی مُحَمَّدٍ وَ آلِ مُحَمَّدٍ',
      translationFa:'ستایش‌ها از آنِ خداست — در نشستن بخوان', repeatCount:1,
      category:'نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['نماز'] },
    { id:'step.salam', type:'prayer-step', title:'سلامِ نماز', order:10,
      arabicText:'اَلسَّلامُ عَلَیْنا وَ عَلی عِبادِ اللهِ الصّالِحینَ',
      translationFa:'با این سلام نماز از حالتِ خواندن بیرون می‌آید', repeatCount:1,
      category:'نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['نماز'] },

    /* ── ذکرشمارهای تعقیب (هدف‌ها از نسخهٔ پیشین؛ در انتظار تأیید) ── */
    { id:'istighfar', type:'dhikr-set', title:'اِستِغفار', shortTitle:'استغفار',
      category:'تعقیباتِ نماز', order:2, phases:['istighfar.1'], notes:'در تعقیباتِ نماز',
      source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['استغفار'] },
    { id:'istighfar.1', type:'dhikr', title:'اِستِغفار', parent:'istighfar', order:1,
      arabicText:'اَسْتَغْفِرُ اللهَ رَبّی وَ اَتُوبُ اِلَیْهِ',
      translationFa:'از خداوندِ پروردگارم آمرزش می‌خواهم و به سوی او بازم‌گردم',
      repeatCount:70, category:'تعقیباتِ نماز',
      source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['استغفار'] },

    { id:'tahlil', type:'dhikr-set', title:'تَهلیل', shortTitle:'تهلیل',
      category:'تعقیباتِ نماز', order:3, phases:['tahlil.1'], notes:'یادِ خدا با زبان',
      source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['تهلیل'] },
    { id:'tahlil.1', type:'dhikr', title:'تَهلیل', parent:'tahlil', order:1,
      arabicText:'لا اِلٰهَ اِلَّا اللهُ', translationFa:'نیست معبودی جز خدا', repeatCount:100,
      category:'تعقیباتِ نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع',
      verified:false, tags:['تهلیل'] },

    { id:'hawqala', type:'dhikr-set', title:'حَولَقَه', shortTitle:'حولقه',
      category:'تعقیباتِ نماز', order:4, phases:['hawqala.1'], notes:'توکّل به خدا',
      source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['حولقه'] },
    { id:'hawqala.1', type:'dhikr', title:'حَولَقَه', parent:'hawqala', order:1,
      arabicText:'لا حَولَ وَ لا قُوَّةَ اِلَّا بِاللهِ العَلِیِّ العَظیم',
      translationFa:'نه دگرگونی هست و نه نیرو، مگر از سوی خدایِ برترِ بزرگ', repeatCount:100,
      category:'تعقیباتِ نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع',
      verified:false, tags:['حولقه'] },

    { id:'salawat', type:'dhikr-set', title:'صَلَوات', shortTitle:'صلوات',
      category:'تعقیباتِ نماز', order:5, phases:['salawat.1'], notes:'درود بر پیامبر و خاندانش',
      source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع', verified:false, tags:['صلوات'] },
    { id:'salawat.1', type:'dhikr', title:'صَلَوات', parent:'salawat', order:1,
      arabicText:'اَللّٰهُمَّ صَلِّ عَلی مُحَمَّدٍ وَ آلِ مُحَمَّدٍ',
      translationFa:'خدایا درود فرست بر محمد و خاندانِ محمد', repeatCount:100,
      category:'تعقیباتِ نماز', source:'نسخهٔ پیشینِ برنامه — در انتظار تأییدِ منبع',
      verified:false, tags:['صلوات'] },

    /* ── ذکرِ دلخواه: متن و هدف را خودِ کاربر می‌نویسد ──
       `repeatCount:null` است چون «هدف» را کاربر تعیین می‌کند؛ تا وقتی
       ننوشته، UI جای خالی نشان می‌دهد و عددی از خودش نمی‌سازد. */
    { id:'custom', type:'dhikr-set', title:'ذکرِ دلخواه', shortTitle:'ذکرِ من',
      category:'شخصی', order:6, phases:['custom.1'], editable:true,
      notes:'خودت ذکر و هدف را بنویس', source:'ورودیِ کاربرِ همان دستگاه',
      verified:false, tags:['شخصی'] },
    { id:'custom.1', type:'dhikr', title:'ذکرِ دلخواه', parent:'custom', order:1,
      arabicText:null, translationFa:null, repeatCount:null, category:'شخصی',
      source:'ورودیِ کاربرِ همان دستگاه', verified:false, tags:['شخصی'] }
  ],

  /* ── پرس‌وجو ─────────────────────────────────────────────────── */
  item(id){ return this.items.find(x => x.id === id) || null; },
  all(){ return this.items.slice(); },
  byType(type){ return this.items.filter(x => x.type === type); },
  byCategory(cat){ return this.items.filter(x => x.category === cat); },
  categories(){
    const seen = [];
    this.items.forEach(x => { if(x.category && seen.indexOf(x.category) < 0) seen.push(x.category); });
    return seen;
  },

  /* ── هنجارسازی برای *مقایسه* (نه برای نمایش) ────────────────────
     مقایسهٔ متنِ عربی با اعرابِ متفاوت («اَکبَر» و «اکبر») بدونِ هنجارسازی
     شکستِ کاذب می‌سازد. `bare` اعراب/کشیده را پاک و الف/ی/ک/ة را یکسان
     می‌کند؛ `bareKey` همان است بی‌فاصله (برای برابریِ سخت‌گیرانه)؛ `norm`
     اگر لایهٔ ابزارِ برنامه در دسترس باشد *همان* `U.norm` خودِ برنامه است
     تا این ماژول و بازرسِ محتوا یک جور مقایسه کنند. */
  bare(s){
    return String(s == null ? '' : s)
      .replace(/[\u064B-\u0652\u0653-\u0656\u0670\u0640]/g, '')
      .replace(/[\u0625\u0623\u0622]/g, '\u0627').replace(/\u064A/g, '\u06CC').replace(/\u0643/g, '\u06A9')
      .replace(/[\u0647\u06C0\u0629\u0654]/g, '\u0647')
      .replace(/[\u200C\u200F\u200E]/g, ' ').replace(/\s+/g, ' ').trim();
  },
  bareKey(s){ return this.bare(s).replace(/\s+/g, '').toLowerCase(); },
  norm(s){
    try{ if(typeof U !== 'undefined' && U && typeof U.norm === 'function') return U.norm(s); }catch(e){}
    return this.bare(s).toLowerCase();
  },

  /* کدام نوع‌ها «معمولاً» عددِ تکرار دارند؟ مبنایِ تفاوتِ «جایِ خالیِ
     غیرمنتظره» و «جایِ خالیِ طبیعی»: دعا عملِ چندگامی نیست که عددِ تکرار
     داشته باشد، ولی ذکر و مرحلهٔ نماز چرا. */
  expectsRepeat(type){ return type === 'dhikr' || type === 'prayer-step'; },
  /* کدام نوع‌ها اصلاً «متن» دارند؟ مجموعهٔ ذکر (`dhikr-set`) ظرف است و
     متنش در فازهایش می‌نشیند، پس نداشتنِ `arabicText` برایش جایِ خالی
     نیست — وگرنه خودِ `zahra` (تأییدشده) هم «در انتظار» گزارش می‌شد. */
  expectsText(type){ return type !== 'dhikr-set'; },

  /* ── اعتبارسنجیِ یک رکورد (پیش از ثبت) ──
     خروجی: فهرستِ ایرادها (خالی یعنی معتبر). هیچ ایرادی حدسِ محتوا نیست؛
     همه ساختاری‌اند.
     نکتهٔ مهم: `register` «وصلهٔ جزئی» را هم می‌پذیرد (فقط فیلدهایی که
     صریحاً داده شده‌اند). پس این‌جا نه خودِ وصله، بلکه **رکوردِ
     ادغام‌شده** سنجیده می‌شود: اگر شناسه پیش‌تر ثبت شده باشد، فیلدهایِ
     داده‌نشده از رکوردِ موجود کامل می‌شوند. بی این قاعده، یک
     به‌روزرسانیِ سادهٔ متن («فقط `arabicText` عوض شود») به دلیلِ نداشتنِ
     `type` رد می‌شد — یعنی دروازهٔ ورودِ دادهٔ تأییدشده، سدِ خودِ همان
     داده می‌شد. */
  validate(rec, meta){
    const p = [];
    if(!rec || typeof rec !== 'object' || Array.isArray(rec)) return ['رکورد باید شیء باشد'];
    if(typeof rec.id !== 'string' || !rec.id.trim()){ p.push('id ندارد یا رشته نیست'); return p; }
    const cur = this.item(rec.id);
    const merged = k => (rec[k] !== undefined ? rec[k] : (cur ? cur[k] : undefined));
    if(this.TYPES.indexOf(merged('type')) < 0) p.push('type ناشناخته: ' + String(merged('type')));
    const text = (k, v) => {
      if(v === null || v === undefined) return;                       // «نمی‌دانم» مجاز است
      if(typeof v !== 'string' || !v.trim()) p.push(k + ' باید متنِ غیرتهی یا null باشد');
    };
    text('arabicText', rec.arabicText);
    text('translationFa', rec.translationFa);
    text('source', rec.source);
    text('title', merged('title'));
    if(!String(merged('title') || '').trim()) p.push('title ندارد');
    const nn = merged('repeatCount');
    if(nn !== null && nn !== undefined && (!Number.isInteger(nn) || nn <= 0))
      p.push('repeatCount باید عددِ صحیحِ مثبت یا null باشد');
    if(rec.order !== undefined && !Number.isFinite(rec.order)) p.push('order عددی نیست');
    if(rec.phases !== undefined && !Array.isArray(rec.phases)) p.push('phases باید آرایه باشد');
    if(rec.steps !== undefined && !Array.isArray(rec.steps)) p.push('steps باید آرایه باشد');
    if(rec.translations !== undefined && (typeof rec.translations !== 'object' ||
       rec.translations === null || Array.isArray(rec.translations)))
      p.push('translations باید شیءِ زبان→متن باشد');
    const srcAny = String(rec.source || (meta && meta.source) || merged('source') || '').trim();
    if(rec.verified && !srcAny) p.push('verified:true بدونِ source پذیرفته نیست');
    return p;
  },

  /* ── پیش‌نمایشِ تعارض‌ها — تابعِ خالص، هیچ تغییری نمی‌دهد ──
     همان «کشفِ سیستماتیکِ اختلافِ نسخهٔ قدیم و دادهٔ تازه»: پیش از ثبت
     می‌گوید چه چیزی عوض می‌شود و از چه به چه.
     kind: new | text | spelling | count | fill | erase | order | title |
           source | verified | notes | category | shortTitle | translation */
  diff(incoming){
    const list = Array.isArray(incoming) ? incoming : (incoming ? [incoming] : []);
    const out = [];
    const FIELDS = ['arabicText', 'translationFa', 'repeatCount', 'order', 'title',
                    'shortTitle', 'source', 'verified', 'notes', 'category'];
    list.forEach(rec => {
      if(!rec || typeof rec !== 'object' || !rec.id) return;
      const cur = this.item(rec.id);
      if(!cur){ out.push({ id:rec.id, field:null, kind:'new', from:null, to:null }); return; }
      FIELDS.forEach(f => {
        if(rec[f] === undefined) return;
        const a = cur[f] === undefined ? null : cur[f], b = rec[f];
        if(a === b) return;
        let kind = f;
        if(f === 'arabicText' || f === 'translationFa'){
          kind = (a === null || a === undefined) ? 'fill'
               : (b === null || b === undefined) ? 'erase'
               : (this.bareKey(a) === this.bareKey(b)) ? 'spelling' : 'text';
        } else if(f === 'repeatCount'){
          kind = (a === null || a === undefined) ? 'fill' : 'count';
        }
        out.push({ id:rec.id, field:f, kind, from:a, to:b });
      });
      if(rec.translations && typeof rec.translations === 'object'){
        Object.keys(rec.translations).forEach(lang => {
          const a = (cur.translations || {})[lang], b = rec.translations[lang];
          if(a !== b) out.push({ id:rec.id, field:'translations.' + lang,
                                 kind:(a === null || a === undefined) ? 'fill' : 'translation', from:a, to:b });
        });
      }
    });
    return out;
  },

  /* ── ترجمهٔ یک رکورد به زبانِ خواسته‌شده ──
     هیچ ترجمه‌ای حدس زده نمی‌شود: اگر در `translations` نبود `null`
     برمی‌گردد (نه متنِ فارسی، نه رشتهٔ تهی). */
  translation(it, lang){
    const rec = typeof it === 'string' ? this.item(it) : it;
    if(!rec) return null;
    if(!lang || lang === 'fa') return rec.translationFa === undefined ? null : rec.translationFa;
    const t = rec.translations ? rec.translations[lang] : null;
    return (typeof t === 'string' && t.trim()) ? t : null;
  },

  /* ── مرحله‌های نماز به ترتیبِ `order` (مشتق، نه یک فهرستِ دوم) ── */
  stepsOf(type){
    const t = type || 'prayer-step';
    return this.byType(t).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  },
  stepIds(type){ return this.stepsOf(type).map(x => x.id); },

  /* ── دعاها ── */
  duas(){ return this.byType('dua').slice().sort((a, b) => (a.order || 0) - (b.order || 0)); },
  dua(idOrTitle){ return this.item(idOrTitle) || this.duaByTitle(idOrTitle); },
  duaByTitle(title){
    const n = this.norm(title);
    if(!n) return null;
    return this.duas().find(x => this.norm(x.title) === n) || null;
  },

  /* رقم‌های فارسی فقط برای نمایش؛ اگر `U` (لایهٔ ابزارِ برنامه) نبود
     همان رقم‌های لاتین می‌آید تا این ماژول تنها هم کار کند. */
  fa(n){
    try{ if(typeof U !== 'undefined' && U && typeof U.fa === 'function') return U.fa(n); }catch(e){}
    return String(n);
  },

  /* ── فازهای یک مجموعه، به ترتیبِ `order` ──
       خروجی: [{ id, ar, fa, n, title, verified }] — `n` می‌تواند `null`
       باشد (هدفِ نامشخص) و لایهٔ نمایش باید جای خالی نشان دهد. */
  phases(setId){
    const set = this.item(setId);
    if(!set || !Array.isArray(set.phases)) return [];
    return set.phases
      .map(id => this.item(id))
      .filter(Boolean)
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(x => ({ id:x.id, ar:x.arabicText || '', fa:x.translationFa || '', n:x.repeatCount,
                   title:x.title || '', verified:!!x.verified }));
  },
  /* جمعِ هدف‌های یک مجموعه؛ `null` اگر هیچ هدفِ شناخته‌شده‌ای نداشته باشد.
     فازِ بی‌هدف (ذکرِ دلخواهِ نوشته‌نشده) شمرده نمی‌شود. */
  goalTotal(setId){
    const ns = this.phases(setId).map(p => p.n).filter(n => Number.isFinite(n) && n > 0);
    return ns.length ? ns.reduce((a, b) => a + b, 0) : null;
  },
  /* خلاصهٔ عددیِ مجموعه برای متنِ UI: «۳۴/۳۳/۳۳» — از داده ساخته می‌شود،
     هیچ‌جا hard-code نیست. */
  countSummary(setId){
    const ps = this.phases(setId);
    const known = ps.filter(p => Number.isFinite(p.n) && p.n > 0);
    if(!known.length) return '';                 // هیچ هدفِ ثبت‌شده‌ای نیست → خلاصهٔ عددی هم نیست
    return ps.map(p => (Number.isFinite(p.n) && p.n > 0) ? this.fa(p.n) : '—').join('/');
  },

  /* ── برچسبِ تعدادِ تکرار برای UI ──
       قاعدهٔ ۲: اگر عدد نامشخص است، UI *جای خالیِ محترمانه* نشان می‌دهد
       و هیچ عددِ پیش‌فرضی ساخته نمی‌شود. */
  repeatLabel(it){
    const rec = typeof it === 'string' ? this.item(it) : it;
    const n = rec && Number.isFinite(rec.repeatCount) ? rec.repeatCount : null;
    if(n === null) return { known:false, text:'تعدادِ تکرار در منبع ثبت نشده است', value:null };
    return { known:true, text:this.fa(n) + ' بار', value:n, verified:!!(rec && rec.verified) };
  },

  /* ── پیش‌تنظیمِ ذکرشمار ──
       لایهٔ نمایش (Dhikr) سیاستِ خودش را — سکه، تجربه، جای ذخیره — روی
       این داده سوار می‌کند؛ خودِ این ماژول هیچ سیاستِ برنامه‌ای ندارد. */
  preset(setId){
    const set = this.item(setId);
    if(!set) return null;
    const phases = this.phases(setId);
    const sum = this.countSummary(setId);
    return {
      id:set.id, title:set.title, tab:set.shortTitle || set.title,
      sub:[set.notes, sum ? sum : ''].filter(Boolean).join(' — '),
      phases, editable:!!set.editable, verified:!!set.verified,
      source:set.source || '', notes:set.notes || ''
    };
  },
  /* فهرستِ مجموعه‌های ذکرشمار، به ترتیبِ `order` (ذکرِ دلخواه آخر است) */
  presetIds(){
    return this.byType('dhikr-set').slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(x => x.id);
  },

  /* متنِ یک مرحلهٔ نماز — `Sajjada.TXT` از این‌جا ساخته می‌شود */
  prayerStep(id){
    const it = this.item('step.' + id) || this.item(id);
    if(!it) return null;
    return { ar:it.arabicText || '', fa:it.translationFa || it.notes || '', n:it.repeatCount,
             verified:!!it.verified, source:it.source || '' };
  },

  /* ── ورودیِ معتبرِ تازه ──
       قاعدهٔ ۳: متنِ تأییدشدهٔ تازه بر دادهٔ قدیمی می‌چربد. هر رکوردِ
       ورودی با شناسهٔ موجود ادغام می‌شود (فقط فیلدهایی که صریحاً داده
       شده‌اند) و رکوردِ تازه به `items` اضافه می‌شود. `verified` تنها
       وقتی `true` می‌شود که در ورودی آمده باشد — این ماژول هیچ‌وقت
       خودش چیزی را تأییدشده علامت نمی‌زند. */
  /* ── ورودیِ معتبرِ تازه (تنها دروازهٔ ورودِ داده) ──
     قاعدهٔ ۳: متنِ تأییدشدهٔ تازه بر دادهٔ قدیمی می‌چربد. هر رکوردِ ورودی
     با شناسهٔ موجود ادغام می‌شود (فقط فیلدهایی که صریحاً داده شده‌اند) و
     رکوردِ تازه به `items` اضافه می‌شود. `verified` تنها وقتی `true`
     می‌شود که در ورودی آمده باشد *و* منبع داشته باشد — این ماژول
     هیچ‌وقت خودش چیزی را تأییدشده علامت نمی‌زند.
     خروجی: { added, updated, invalid, conflicts, warnings }
       invalid   — رکوردهایی که اعتبارسنجی رد کرد (اعمال *نشدند*)
       conflicts — چه چیزی از چه به چه عوض شد (خروجیِ `diff`)
       warnings  — مثلاً تأییدِ بی‌منبع که پذیرفته نشد
     هر ثبت در `log` هم می‌نشیند تا اختلاف‌های قدیم/تازه قابلِ گزارش باشد. */
  register(incoming, meta){
    const list = Array.isArray(incoming) ? incoming : (incoming ? [incoming] : []);
    const res = { added:0, updated:0, invalid:[], conflicts:[], warnings:[] };
    list.forEach(rec => {
      const problems = this.validate(rec, meta);
      if(problems.length){ res.invalid.push({ id:(rec && rec.id) || '(بی‌شناسه)', problems }); return; }
      const src = (meta && meta.source) || rec.source || this.CONFIRMED;
      const cur = this.item(rec.id);
      let verified = !!rec.verified;
      if(verified && !String(rec.source || '').trim()){
        /* تأیید بی‌منبعِ خودِ رکورد: اگر منبع از `meta`ِ دسته بیاید، پذیرفته
           می‌شود ولی با هشدار (منبعِ تأیید باید در خودِ رکورد هم بنشیند)؛
           اگر هیچ منبعی نباشد، تأیید *پذیرفته نمی‌شود*. */
        if(String((meta && meta.source) || '').trim()){
          res.warnings.push({ id:rec.id, warning:'verified:true — منبعِ تأیید از meta دسته آمد، نه از خودِ رکورد' });
        } else {
          verified = false;
          res.warnings.push({ id:rec.id, warning:'verified:true بدونِ source — تأیید پذیرفته نشد' });
        }
      }
      const changes = this.diff([rec]).filter(c => c.kind !== 'new');
      if(cur){
        Object.keys(rec).forEach(k => { if(k !== 'id' && rec[k] !== undefined) cur[k] = rec[k]; });
        cur.source = rec.source || src;
        if(rec.verified !== undefined) cur.verified = verified;
        res.updated++;
      } else {
        this.items.push(Object.assign(
          { type:'dhikr', arabicText:null, translationFa:null, repeatCount:null,
            category:'نامشخص', order:this.items.length + 1, verified:false },
          rec, { source:src, verified:verified }));
        res.added++;
      }
      changes.forEach(c => res.conflicts.push(c));
      this.note(rec.id, changes, src);
    });
    return res;
  },

  /* دفترِ تغییرهای داده — فقط برای گزارش/بازرسی، نه برای نمایشِ کاربر. */
  LOG_MAX:200, log:[],
  note(id, changes, source){
    try{
      this.log.push({ id:id, changes:(changes || []).length, source:String(source || ''), at:Date.now() });
      while(this.log.length > this.LOG_MAX) this.log.shift();
    }catch(e){}
    return this.log.length;
  },

  /* ── پلِ لایهٔ دعاها ──
     بانکِ `DATA.duas` به دلیلِ بازیِ «نجوا» قفل است (دروازهٔ «DATA source
     unchanged» بایت‌به‌بایت می‌سنجدش) پس این ماژول هرگز آن را تغییر
     نمی‌دهد؛ این تابع همان بانک و پوششِ نمایشیِ `DUA_FULL` را — که هر دو
     از پیش در برنامه‌اند — به رکوردهای `type:'dua'` نگاشت می‌کند تا برای
     «دادهٔ عبادی» یک منبعِ حقیقت وجود داشته باشد.
     قاعدهٔ سخت: **هیچ متنِ تازه‌ای ساخته نمی‌شود.** هر فیلد یا از پوشش است
     یا از بانک؛ اگر پوششی پیدا نشد، `fragment:true` می‌خورد تا معلوم باشد
     آن متن بریدهٔ کوتاهِ بازی است نه متنِ کامل، و `verified` هرگز `true`
     نمی‌شود چون صاحبِ برنامه این دعاها را در این گفتگو تأیید نکرده است. */
  DUA_NOTE:'از بانکِ دعوای برنامه (DATA.duas) و پوششِ نمایشیِ DUA_FULL منتقل شد — در انتظارِ تأییدِ صاحبِ برنامه',
  adoptDuas(bank, overlay, meta){
    const list = Array.isArray(bank) ? bank : [];
    const ov = Array.isArray(overlay) ? overlay : [];
    const res = { added:0, updated:0, matched:0, fragments:0, sourceDiff:0, invalid:[] };
    list.forEach((b, i) => {
      if(!b || typeof b !== 'object') return;
      const title = String(b.title || '').trim();
      /* همان قاعدهٔ تطبیقیِ `WirdUI.text()` تا پوششِ یک دعا دوتا نشود */
      const f = ov.find(x => x && this.norm(title).includes(this.norm(x.for || '###')));
      if(f) res.matched++; else res.fragments++;
      const bankSrc = String(b.src || '').trim();
      const ovSrc = f ? String(f.src || '').trim() : '';
      if(ovSrc && bankSrc && this.norm(ovSrc) !== this.norm(bankSrc)) res.sourceDiff++;
      const rec = {
        id:'dua.' + (i + 1), type:'dua', title:title || ('دعای ' + this.fa(i + 1)),
        order:i + 1, bankIndex:i,
        arabicText:(f && String(f.ar || '').trim()) || (String(b.ar || '').trim() || null),
        translationFa:(f && String(f.fa || '').trim()) || (String(b.fa || '').trim() || null),
        repeatCount:null, category:'دعا',
        source: ovSrc || bankSrc || null,
        sourceBank: (ovSrc && bankSrc && ovSrc !== bankSrc) ? bankSrc : undefined,
        sourceNote: this.DUA_NOTE, fragment: !f, verified:false, tags:['دعا']
      };
      const r = this.register([rec], meta);
      res.added += r.added; res.updated += r.updated;
      r.invalid.forEach(x => res.invalid.push(x));
    });
    return res;
  },

  /* ── جای خالی‌ها: هرچه هنوز از منبعِ معتبر تأیید نشده ──
       این فهرست همان چیزی است که در UI «در انتظارِ منبعِ معتبر» نشان
       داده می‌شود و در گزارشِ دقتِ محتوا هم می‌آید. */
  /* ── شکاف‌های دادهٔ یک رکورد (اطلاع‌رسانی) ──
     آنچه *نباید* حدس زده شود و هنوز نیامده است. */
  gaps(rec){
    const g = [];
    if(!rec) return g;
    if((rec.arabicText === null || rec.arabicText === undefined) && this.expectsText(rec.type))
      g.push('arabicText');
    if((rec.translationFa === null || rec.translationFa === undefined) && this.expectsText(rec.type))
      g.push('translationFa');
    if((rec.repeatCount === null || rec.repeatCount === undefined) && this.expectsRepeat(rec.type))
      g.push('repeatCount');
    if(!String(rec.source || '').trim()) g.push('source');
    return g;
  },

  /* ── آیا این رکورد «در انتظارِ منبعِ معتبر» است؟ ──
     چهار شرطِ خواسته‌شده: متنِ عربیِ null · عددِ تکرارِ null برای نوعِ
     تکرارپذیر · `source` خالی · `verified === false`. */
  isPending(rec){
    if(!rec) return false;
    return ((rec.arabicText === null || rec.arabicText === undefined) && this.expectsText(rec.type)) ||
           ((rec.repeatCount === null || rec.repeatCount === undefined) && this.expectsRepeat(rec.type)) ||
           !String(rec.source || '').trim() ||
           !rec.verified;
  },

  /* ── جای خالی‌ها: هرچه هنوز از منبعِ معتبر تأیید نشده ──
     این فهرست همان چیزی است که در UI «در انتظارِ منبعِ معتبر» نشان
     داده می‌شود و در گزارشِ دقتِ محتوا هم می‌آید. */
  pending(){
    return this.items.filter(x => this.isPending(x)).map(x => ({
      id:x.id, type:x.type, title:x.title || x.id, category:x.category || '',
      missing:this.gaps(x), verified:!!x.verified, source:x.source || ''
    }));
  },

  /* خلاصهٔ عددیِ وضعیتِ محتوا — برای گزارش و بازرس (`_content-audit.js`). */
  pendingSummary(){
    const all = this.items, p = this.pending();
    const byType = {}, byGap = {};
    p.forEach(x => {
      byType[x.type] = (byType[x.type] || 0) + 1;
      x.missing.forEach(g => { byGap[g] = (byGap[g] || 0) + 1; });
    });
    const counts = {};
    all.forEach(x => { counts[x.type] = (counts[x.type] || 0) + 1; });
    return {
      records: all.length,
      counts,
      verified: all.filter(x => x.verified).length,
      verifiedText: all.filter(x => x.verifiedText).length,
      pending: p.length,
      pendingByType: byType,
      pendingByGap: byGap,
      noSource: all.filter(x => !String(x.source || '').trim()).length,
      fragment: all.filter(x => x.fragment).length,
      unresolvedRepeat: all.filter(x => this.expectsRepeat(x.type) &&
        (x.repeatCount === null || x.repeatCount === undefined)).map(x => x.id)
    };
  },

  /* ── خودسنجیِ ساختاری (بی DOM، قابلِ اجرا در Node و مرورگر) ──
       همان چک‌لیستی که در سندِ دقتِ محتوا آمده، به شکلِ اجرایی. */
  selfTest(){
    const out = [];
    const ok = (name, cond, extra) => out.push({ name, ok:!!cond, extra:extra === undefined ? '' : String(extra) });
    const ids = this.items.map(x => x.id);
    ok('شناسهٔ هر رکورد یکتاست', new Set(ids).size === ids.length,
       ids.filter((v, i) => ids.indexOf(v) !== i).join(','));
    ok('هر رکورد id و type و order دارد',
       this.items.every(x => x.id && x.type && Number.isFinite(x.order)));
    ok('نوع‌ها از فهرستِ مجازند',
       this.items.every(x => ['dhikr', 'dhikr-set', 'dua', 'prayer-step', 'act'].indexOf(x.type) >= 0),
       this.items.filter(x => ['dhikr', 'dhikr-set', 'dua', 'prayer-step', 'act'].indexOf(x.type) < 0).map(x => x.id).join(','));
    const leaf = x => x.type !== 'dhikr-set';
    ok('repeatCount یا عددِ صحیحِ مثبت است یا null (هیچ مقدارِ پیش‌فرضِ پنهانی نیست)',
       this.items.filter(leaf).every(x => x.repeatCount === null || x.repeatCount === undefined ||
         (Number.isInteger(x.repeatCount) && x.repeatCount > 0)),
       this.items.filter(x => leaf(x) && !(x.repeatCount === null || x.repeatCount === undefined ||
         (Number.isInteger(x.repeatCount) && x.repeatCount > 0))).map(x => x.id).join(','));
    ok('متنِ عربیِ تأییدشده خالی نیست و نویسهٔ عربی دارد',
       this.items.filter(x => x.verified && x.type !== 'dhikr-set')
         .every(x => typeof x.arabicText === 'string' && /[\u0600-\u06FF]/.test(x.arabicText)));
    ok('هر مجموعهٔ ذکر، فازهای موجود و مرتب دارد',
       this.byType('dhikr-set').every(s => Array.isArray(s.phases) && s.phases.length > 0 &&
         s.phases.every(id => !!this.item(id))));

    /* دو نمونهٔ صریحِ خواسته‌شده در گزارشِ باگ */
    const z = this.phases('zahra');
    /* مقایسهٔ متن بی‌اعراب: شکلِ بااعرابِ «اَللهُ اَکبَر» و بی‌اعرابِ
       «الله اکبر» یکی‌اند و اختلافِ اعراب نباید دروازه را بشکند. */
    const bare = t => this.bareKey(t);          // هنجارسازیِ عمومیِ خودِ ماژول
    ok('تسبیحاتِ زهرا (س): ۳۴ الله‌اکبر ← ۳۳ الحمدلله ← ۳۳ سبحان‌الله',
       z.length === 3 && z[0].n === 34 && z[1].n === 33 && z[2].n === 33 &&
       bare(z[0].ar) === bare('الله اکبر') && bare(z[1].ar) === bare('الحمد لله') &&
       bare(z[2].ar) === bare('سبحان الله'),
       JSON.stringify(z.map(x => [x.ar, x.n])));
    ok('جمعِ تسبیحاتِ زهرا (س) ۱۰۰ است (۳۴+۳۳+۳۳)', this.goalTotal('zahra') === 100,
       this.goalTotal('zahra'));
    const sj = this.item('step.sujud');
    ok('ذکرِ سجده: متنِ تأییدشده «سُبْحانَ رَبِّیَ الأَعْلیٰ وَ بِحَمْدِهِ»',
       !!sj && bare(sj.arabicText) === bare('سبحان ربی الاعلی و بحمده') && sj.verifiedText === true,
       sj && sj.arabicText);
    ok('خلاصهٔ عددی از داده ساخته می‌شود، نه hard-code',
       this.countSummary('zahra') === this.fa(34) + '/' + this.fa(33) + '/' + this.fa(33),
       this.countSummary('zahra'));
    /* ── سنجش‌های لایهٔ داده: ثبت، تعارض، اعتبارسنجی، جایِ خالی ── */
    const TMP = 'selftest.tmp';
    try{
      ok('اعتبارسنجی: بی‌شناسه، نوعِ ناشناخته و رشتهٔ تهیِ عربی رد می‌شوند',
         this.validate({ type:'dhikr' }).length > 0 &&
         this.validate({ id:'x', type:'nope' }).length > 0 &&
         this.validate({ id:'x', type:'dhikr', arabicText:'   ' }).length > 0 &&
         this.validate({ id:'x', type:'dhikr', repeatCount:0 }).length > 0 &&
         this.validate({ id:'x', type:'dhikr', repeatCount:2.5 }).length > 0 &&
         this.validate({ id:'x', type:'dhikr', title:'آزمون', arabicText:null, repeatCount:null }).length === 0);
      ok('اعتبارسنجی: verified:true بدونِ source پذیرفته نیست',
         this.validate({ id:'x', type:'dhikr', title:'آزمون', verified:true }).some(s => /source/.test(s)) &&
         this.validate({ id:'x', type:'dhikr', title:'آزمون', verified:true, source:'کتاب' }).length === 0 &&
         this.validate({ id:'x', type:'dhikr', title:'آزمون', verified:true }, { source:'کتاب' }).length === 0);
      const before = this.item('zahra.takbir');
      const d1 = this.diff([{ id:'zahra.takbir', repeatCount:40 }]);
      ok('diff() خالص است: تعارض را می‌گوید و داده را دست نمی‌زند',
         d1.length === 1 && d1[0].kind === 'count' && d1[0].from === 34 && d1[0].to === 40 &&
         before.repeatCount === 34, JSON.stringify(d1));
      ok('diff() تفاوتِ املایی را از تفاوتِ محتوایی جدا می‌کند',
         this.diff([{ id:'zahra.takbir', arabicText:'الله اكبر' }])[0].kind === 'spelling' &&
         this.diff([{ id:'zahra.takbir', arabicText:'سبحان الله' }])[0].kind === 'text' &&
         this.diff([{ id:'custom.1', arabicText:'متنِ تازه' }])[0].kind === 'fill' &&
         this.diff([{ id:'step.sujud', arabicText:null }])[0].kind === 'erase');
      const r1 = this.register([{ id:TMP, type:'dhikr', title:'آزمون', arabicText:'قَدیم',
                                  repeatCount:null, order:9001 }], { source:'آزمون' });
      const r2 = this.register([{ id:TMP, arabicText:'جَدید', repeatCount:7, verified:true,
                                  source:'ورودیِ تأییدشدهٔ صاحبِ برنامه — آزمون' }]);
      const rec = this.item(TMP);
      ok('register(): وصلهٔ جزئیِ رکوردِ موجود پذیرفته می‌شود و بقیهٔ فیلدها دست نمی‌خورند',
         this.register([{ id:'zahra.takbir', arabicText:'الله اكبر' }]).invalid.length === 0 &&
         this.item('zahra.takbir').repeatCount === 34 && this.item('zahra.takbir').type === 'dhikr' &&
         this.item('zahra.takbir').arabicText === 'الله اكبر' &&
         this.register([{ id:'zahra.takbir', arabicText:'اَللهُ اَکبَر' }]).invalid.length === 0 &&
         this.item('zahra.takbir').arabicText === 'اَللهُ اَکبَر');
      ok('register(): متنِ تأییدشدهٔ تازه بر قدیمی می‌چربد و تعارض گزارش می‌شود',
         r1.added === 1 && r1.invalid.length === 0 && rec.arabicText === 'جَدید' &&
         rec.repeatCount === 7 && rec.verified === true &&
         r2.conflicts.some(c => c.field === 'arabicText' && c.kind === 'text') &&
         r2.conflicts.some(c => c.field === 'repeatCount' && c.kind === 'fill') &&
         this.log.some(x => x.id === TMP));
      const r3 = this.register([{ id:TMP + '.b', type:'dhikr', title:'آزمون', arabicText:'نص',
                                 verified:true }]);
      ok('register(): رکوردِ نامعتبر اعمال نمی‌شود و تأییدِ بی‌منبع پذیرفته نیست',
         r3.invalid.length === 1 && this.item(TMP + '.b') === null &&
         this.register([{ id:TMP + '.c', type:'dhikr', title:'آزمون', arabicText:'نص',
                         verified:true, source:'منبعِ آزمون' }]).warnings.length === 0 &&
         this.item(TMP + '.c').verified === true &&
         this.register([{ id:TMP + '.d', type:'dhikr', title:'آزمون', arabicText:'نص',
                         verified:true }], { source:'منبعِ دسته' }).warnings.length === 1 &&
         this.item(TMP + '.d').verified === true && this.item(TMP + '.d').source === 'منبعِ دسته');
      ok('pending(): ذکرِ سجده متن دارد ولی «در انتظار» است (عدد/ترجمه/تأیید)',
         this.isPending(this.item('step.sujud')) &&
         this.gaps(this.item('step.sujud')).indexOf('translationFa') >= 0 &&
         !this.isPending(this.item('zahra.takbir')) &&
         this.gaps(this.item('zahra.takbir')).length === 0 &&
         !this.isPending(this.item('zahra')) &&
         this.gaps({ type:'dhikr-set', arabicText:null, source:'x', verified:true }).length === 0);
      ok('pending(): شرط‌ها — متنِ null، عددِ nullِ نوعِ تکرارپذیر، source خالی، verified:false',
         this.isPending({ type:'dhikr', arabicText:null, source:'x', verified:true }) &&
         this.isPending({ type:'dhikr', arabicText:'نص', repeatCount:null, source:'x', verified:true }) &&
         this.isPending({ type:'dhikr', arabicText:'نص', repeatCount:3, source:'', verified:true }) &&
         this.isPending({ type:'dhikr', arabicText:'نص', repeatCount:3, source:'x', verified:false }) &&
         !this.isPending({ type:'dhikr', arabicText:'نص', repeatCount:3, source:'x', verified:true }));
      ok('pending(): دعا بی‌عددِ تکرار «کمبودِ عدد» نمی‌گیرد (نوعش تکرارپذیر نیست)',
         !this.expectsRepeat('dua') && !this.expectsRepeat('dhikr-set') &&
         this.expectsRepeat('dhikr') && this.expectsRepeat('prayer-step') &&
         this.gaps({ type:'dua', arabicText:'نص', source:'x', repeatCount:null }).indexOf('repeatCount') < 0);
      ok('ترجمهٔ زبانِ دوم هرگز حدس زده نمی‌شود',
         this.translation('zahra.takbir', 'en') === null &&
         this.translation('zahra.takbir', 'fa') === this.item('zahra.takbir').translationFa &&
         this.translation('id.nist', 'fa') === null);
      ok('مرحله‌های نماز از `order` مشتق می‌شوند، نه از یک فهرستِ دوم',
         this.stepIds().length === this.byType('prayer-step').length &&
         this.stepIds()[0] === 'step.takbir' &&
         this.stepsOf().every((x, i, a) => i === 0 || (a[i - 1].order || 0) <= (x.order || 0)));
      ok('خلاصهٔ وضعیتِ محتوا با خودِ رکوردها می‌خواند',
         (function(s){ return s.records === this.items.length && s.pending === this.pending().length &&
                              s.verified === this.items.filter(x => x.verified).length &&
                              s.unresolvedRepeat.indexOf('step.dhikr34') >= 0; }).call(this, this.pendingSummary()));
    } finally {
      this.items = this.items.filter(x => String(x.id).indexOf(TMP) !== 0);
      this.log.length = 0;
    }
    ok('پاک‌سازیِ خودسنجی: دادهٔ محتوا دست‌نخورده برگشت',
       this.items.map(x => x.id).join(',') === ids.join(',') && this.log.length === 0);
    return out;

  }
};

/* روی کنسولِ مرورگر و در محیطِ تست هم در دسترس باشد (مثلِ بقیهٔ ماژول‌های
   برنامه که `const` سراسری‌اند؛ این یکی صریحاً به window هم می‌نشیند). */
try{ if(typeof window !== 'undefined') window.NoorContent = NoorContent; }catch(e){}
