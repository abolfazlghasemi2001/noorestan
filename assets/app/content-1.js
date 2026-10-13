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
  register(incoming, meta){
    const list = Array.isArray(incoming) ? incoming : (incoming ? [incoming] : []);
    let added = 0, updated = 0;
    list.forEach(rec => {
      if(!rec || typeof rec !== 'object' || !rec.id) return;
      const src = (meta && meta.source) || rec.source || this.CONFIRMED;
      const cur = this.item(rec.id);
      if(cur){
        Object.keys(rec).forEach(k => { if(k !== 'id' && rec[k] !== undefined) cur[k] = rec[k]; });
        cur.source = rec.source || src;
        updated++;
      } else {
        this.items.push(Object.assign({ type:'dhikr', arabicText:null, translationFa:null,
          repeatCount:null, category:'نامشخص', order:this.items.length + 1, verified:false }, rec, { source:src }));
        added++;
      }
    });
    return { added, updated };
  },

  /* ── جای خالی‌ها: هرچه هنوز از منبعِ معتبر تأیید نشده ──
       این فهرست همان چیزی است که در UI «در انتظارِ منبعِ معتبر» نشان
       داده می‌شود و در گزارشِ دقتِ محتوا هم می‌آید. */
  pending(){
    return this.items.filter(x =>
      !x.verified || x.arabicText === null || x.repeatCount === null || x.translationFa === null
    ).map(x => ({
      id:x.id, title:x.title || x.id,
      missing:[x.arabicText === null ? 'arabicText' : null,
               x.repeatCount === null ? 'repeatCount' : null,
               x.translationFa === null ? 'translationFa' : null].filter(Boolean),
      verified:!!x.verified, source:x.source || ''
    }));
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
    const bare = t => String(t || '').replace(/[\u064B-\u0652\u0653-\u0656\u0670\u0640]/g, '')
      .replace(/[إأآ]/g, 'ا').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/\s+/g, '');
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
    return out;
  }
};

/* روی کنسولِ مرورگر و در محیطِ تست هم در دسترس باشد (مثلِ بقیهٔ ماژول‌های
   برنامه که `const` سراسری‌اند؛ این یکی صریحاً به window هم می‌نشیند). */
try{ if(typeof window !== 'undefined') window.NoorContent = NoorContent; }catch(e){}
