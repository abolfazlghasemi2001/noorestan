/* ═══════════════════════════════════════════════════════════════════
   نورستان — نسخهٔ ۱۹الف: موتور اوقات نماز، قبله و تبدیل قمری
   ═══════════════════════════════════════════════════════════════════
   JS خالص، بی هیچ وابستگیِ npm. الگوریتمِ خورشیدی همان روشِ مستندِ
   PrayTimes.org (نسخهٔ ۲٫۲، حمید رشادی) است که از IAH (Islamic
   Information Institute) هم آمده: موقعیتِ خورشید (میل و معادلهٔ زمان)
   با تقریبِ نجومیِ استاندارد، و ساعتِ زاویهٔ خورشید با فرمولِ
   کرویِ مثلثاتی. محاسبات در «ساعتِ اعشاری» انجام می‌شود و در پایان
   با اختلافِ زمانیِ دستگاه و طولِ جغرافیایی به ساعتِ محلیِ خودِ دستگاه
   برمی‌گردد — یعنی اوقات همان لحظه‌ای را نشان می‌دهند که گوشیِ کاربر
   نشان می‌دهد.

   تقویمِ قمری: الگوریتمِ مدنیِ «کویت» (Kuwaiti algorithm) — تبدیلِ
   جدولیِ مستندی که در ابزارهای آزادِ گوناگون به کار رفته و مبنای
   محاسباتی‌اش گاه‌شماریِ هجریِ قمریِ حسابی (30-ساله با ۱۱ سالِ کبیسه)
   است. این تقویم *حسابی* است و ممکن است با رؤیتِ هلال یک تا دو روز
   اختلاف داشته باشد؛ به همین دلیل مناسبتِ محلِ نزاع (فاطمیه) به‌شکلِ
   «بازهٔ مشهور» آمده است، نه یک روزِ قطعی.

   این فایل عمداً هیچ دسترسی به DOM ندارد تا هم در مرورگر و هم در
   هارنسِ Node (node _harness.js) بی‌واسطه اجرا شود.
   ═══════════════════════════════════════════════════════════════════ */

/* ── شهرها ──
   دستِ‌کم ۳۰ شهرِ ایران به‌علاوهٔ نجف و کربلا (قم و مشهد هم که خود
   جزو شهرهای ایران‌اند). مختصات از منابعِ عمومیِ جغرافیایی است و
   tz تفاوتِ ساعتِ رسمیِ شهر با UTC است (نمایشی؛ محاسبه با منطقهٔ
   زمانیِ خودِ دستگاه انجام می‌شود). تهران شهرِ پیش‌فرض است: بدونِ
   مختصات، هیچ خطایی پرتاب نمی‌شود و همان تهران حساب می‌شود. */
const NOOR_CITIES = [
  { id:'tehran',       name:'تهران',       lat:35.6892, lon:51.3890, tz:3.5, def:true },
  { id:'mashhad',      name:'مشهد',        lat:36.2972, lon:59.6067, tz:3.5 },
  { id:'qom',          name:'قم',          lat:34.6416, lon:50.8746, tz:3.5 },
  { id:'isfahan',      name:'اصفهان',      lat:32.6546, lon:51.6680, tz:3.5 },
  { id:'karaj',        name:'کرج',         lat:35.8355, lon:50.9960, tz:3.5 },
  { id:'tabriz',       name:'تبریز',       lat:38.0962, lon:46.2738, tz:3.5 },
  { id:'shiraz',       name:'شیراز',       lat:29.5918, lon:52.5836, tz:3.5 },
  { id:'ahvaz',        name:'اهواز',       lat:31.3183, lon:48.6706, tz:3.5 },
  { id:'kermanshah',   name:'کرمانشاه',    lat:34.3277, lon:47.0778, tz:3.5 },
  { id:'urmia',        name:'ارومیه',      lat:37.5522, lon:45.0761, tz:3.5 },
  { id:'rasht',        name:'رشت',         lat:37.2808, lon:49.5832, tz:3.5 },
  { id:'zahedan',      name:'زاهدان',      lat:29.4963, lon:60.8629, tz:3.5 },
  { id:'kerman',       name:'کرمان',       lat:30.2839, lon:57.0837, tz:3.5 },
  { id:'hamadan',      name:'همدان',       lat:34.7988, lon:48.5150, tz:3.5 },
  { id:'yazd',         name:'یزد',         lat:31.8974, lon:54.3569, tz:3.5 },
  { id:'ardabil',      name:'اردبیل',      lat:38.2441, lon:48.2934, tz:3.5 },
  { id:'bandarabbas',  name:'بندرعباس',    lat:27.1832, lon:56.2666, tz:3.5 },
  { id:'zanjan',       name:'زنجان',       lat:36.6736, lon:48.4787, tz:3.5 },
  { id:'sanandaj',     name:'سنندج',       lat:35.3142, lon:46.9988, tz:3.5 },
  { id:'qazvin',       name:'قزوین',       lat:36.2688, lon:50.0041, tz:3.5 },
  { id:'khorramabad',  name:'خرم‌آباد',    lat:33.4878, lon:48.3558, tz:3.5 },
  { id:'gorgan',       name:'گرگان',       lat:36.8457, lon:54.4393, tz:3.5 },
  { id:'sari',         name:'ساری',        lat:36.5633, lon:53.0601, tz:3.5 },
  { id:'ilam',         name:'ایلام',       lat:33.6374, lon:46.4211, tz:3.5 },
  { id:'birjand',      name:'بیرجند',      lat:32.8649, lon:59.2247, tz:3.5 },
  { id:'bojnurd',      name:'بجنورد',      lat:37.4747, lon:57.3293, tz:3.5 },
  { id:'semnan',       name:'سمنان',       lat:35.5769, lon:53.3920, tz:3.5 },
  { id:'yasuj',        name:'یاسوج',       lat:30.6682, lon:51.5880, tz:3.5 },
  { id:'shahrekord',   name:'شهرکرد',      lat:32.3256, lon:50.8644, tz:3.5 },
  { id:'bushehr',      name:'بوشهر',       lat:28.9684, lon:50.8385, tz:3.5 },
  { id:'najaf',        name:'نجف',         lat:32.0000, lon:44.3360, tz:3 },
  { id:'karbala',      name:'کربلا',       lat:32.6160, lon:44.0240, tz:3 }
];

/* ── ابزارِ عددی (همان قراردادِ PrayTimes) ── */
const NOOR_ASTRO = {
  FIXANGLE: 360,
  dtr(d){ return (d * Math.PI) / 180; },
  rtd(r){ return (r * 180) / Math.PI; },
  sin(d){ return Math.sin(this.dtr(d)); },
  cos(d){ return Math.cos(this.dtr(d)); },
  tan(d){ return Math.tan(this.dtr(d)); },
  arcsin(x){ return this.rtd(Math.asin(x)); },
  arccos(x){ return this.rtd(Math.acos(x)); },
  arctan2(y, x){ return this.rtd(Math.atan2(y, x)); },
  fixAngle(a){ return this.fix(a, this.FIXANGLE); },
  fixHour(h){ return this.fix(h, 24); },
  fix(a, b){ a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; },

  /* شمارهٔ روزِ ژولینی — همان فرمولِ استانداردِ Meeus */
  julian(year, month, day){
    if(month <= 2){ year -= 1; month += 12; }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  },

  /* موقعیتِ خورشید: [میل (declination)، معادلهٔ زمان (eqt)] بر حسبِ درجه/ساعت.
     تقریبِ همان PrayTimes/NOAA است؛ d = شمارِ روزها از مبدأِ J2000.0 */
  sunPosition(jd){
    const D = jd - 2451545.0;
    const g = this.fixAngle(357.529 + 0.98560028 * D);
    const q = this.fixAngle(280.459 + 0.98564736 * D);
    const L = this.fixAngle(q + 1.915 * this.sin(g) + 0.020 * this.sin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const RA = this.fixHour(this.arctan2(this.cos(e) * this.sin(L), this.cos(L)) / 15);
    const decl = this.arcsin(this.sin(e) * this.sin(L));
    const eqt = q / 15 - RA;
    return [decl, eqt];
  }
};

/* ── روش‌های محاسبه ──
   هر روش یک پیکربندیِ مستند است:
   • fajr:        زاویهٔ فجر (درجه زیرِ افق)
   • ishaAngle:   زاویهٔ عشا (MWL/ISNA)
   • ishaMin:     دقیقه پس از مغرب (ام‌القری و جعفریت)
   • maghribMin:  دقیقه پس از غروب (جعفریتِ ایران؛ بقیه = خودِ غروب)
   • asrFactor:   ضریبِ سایهٔ عصر (۱ = متعارفِ جعفری/اهل‌سنتِ غیر حنفی)
   • midnight:    'jafari' = میانهٔ غروب تا فجرِ فردا (نیمه‌شبِ شرعی)
   «جعفریت — ایران» پیش‌فرض است و سه پارامترش از Store تنظیم می‌شود:
   زاویهٔ فجر ۱۸ (قابلِ تنظیم ۱۵/۱۸)، مغرب = غروب + ۱۴ دقیقه
   (قابلِ تنظیم ۱۲–۱۸) و عشا = مغرب + ۹۰ دقیقه (قابلِ تنظیم). */
const SALAH_METHODS = {
  jafari: {
    id:'jafari', name:'جعفریت — ایران', madhab:'jafari',
    fajr:18, maghribMin:14, ishaMin:90, asrFactor:1, midnight:'jafari',
    fajrChoices:[15, 18], maghribRange:[12, 18], ishaRange:[60, 120]
  },
  mwl: {
    id:'mwl', name:'اتحادیهٔ جهانی اسلام (MWL)', madhab:'sunni',
    fajr:18, ishaAngle:17, maghribMin:0, asrFactor:1, midnight:'jafari'
  },
  ummqura: {
    id:'ummqura', name:'ام‌القری — مکه', madhab:'sunni',
    fajr:18.5, ishaMin:90, maghribMin:0, asrFactor:1, midnight:'jafari'
  },
  isna: {
    id:'isna', name:'اسنا — آمریکای شمالی (ISNA)', madhab:'sunni',
    fajr:15, ishaAngle:15, maghribMin:0, asrFactor:1, midnight:'jafari'
  }
};
/* نام‌های مستعارِ روش‌ها — اگر کاربرِ قدیمی یا تنظیماتِ دستی نامِ دیگری
   فرستاد، به نزدیک‌ترین روشِ معتبر برمی‌گردیم، نه به خطا. */
const SALAH_METHOD_ALIAS = {
  'jafari-iran':'jafari', 'jafari_iran':'jafari', 'iran':'jafari', 'shia':'jafari',
  'tehran':'jafari', 'makkah':'ummqura', 'umm_al_qura':'ummqura', 'umm-al-qura':'ummqura',
  'mecca':'ummqura', 'muslim_world_league':'mwl', 'muslim-world-league':'mwl',
  'north_america':'isna', 'north-america':'isna'
};

/* پنج نمازِ ستونِ اصلی (به ترتیبِ روز) — «نام‌ها» کلیدِ ذخیره و
   نمایش‌اند و هیچ‌وقت عوض نمی‌شوند. */
const SALAH_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const SALAH_LABEL_FA = {
  fajr:'صبح', sunrise:'طلوع', dhuhr:'ظهر', asr:'عصر',
  sunset:'غروب', maghrib:'مغرب', isha:'عشا', midnight:'نیمه‌شب'
};

const Salah = {
  NAMES: SALAH_NAMES,
  LABEL: SALAH_LABEL_FA,
  METHODS: SALAH_METHODS,
  DEFAULT_METHOD: 'jafari',
  KAABA: { lat:21.4225, lon:39.8262 },

  /* ── شهرِ پیش‌فرض و یافتنِ شهر ── */
  defaultCity(){ return NOOR_CITIES.find(c => c.def) || NOOR_CITIES[0]; },
  city(id){ return NOOR_CITIES.find(c => c.id === id) || null; },

  /* ورودیِ مکان را نرمال می‌کند:
     • null/undefined/خراب → تهران (بی هیچ خطا)
     • رشته → شناسهٔ شهر
     • {lat, lon} یا {lat, lng} → همان مختصات
     • Store-shape {cityId, lat, lon} → اگر مختصاتِ عددی داشت همان،
       وگرنه از شهرِ cityId. */
  resolveLoc(loc){
    const d = this.defaultCity();
    if(loc == null) return { lat:d.lat, lon:d.lon, cityId:d.id, source:'city' };
    if(typeof loc === 'string'){
      const c = this.city(loc);
      return c ? { lat:c.lat, lon:c.lon, cityId:c.id, source:'city' }
               : { lat:d.lat, lon:d.lon, cityId:d.id, source:'city' };
    }
    if(typeof loc !== 'object') return { lat:d.lat, lon:d.lon, cityId:d.id, source:'city' };
    let lat = parseFloat(loc.lat), lon = parseFloat(loc.lon != null ? loc.lon : loc.lng);
    const src = loc.source === 'geo' ? 'geo' : 'city';
    if(!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180){
      const c = this.city(loc.cityId);
      if(c) return { lat:c.lat, lon:c.lon, cityId:c.id, source:'city' };
      return { lat:d.lat, lon:d.lon, cityId:d.id, source:'city' };
    }
    return { lat, lon, cityId:loc.cityId || '', source:src };
  },

  /* پیکربندیِ روش را با تنظیماتِ کاربر یکی می‌کند. سه پارامترِ
     تنظیم‌پذیر (زاویهٔ فجر، دقیقهٔ مغرب، دقیقهٔ عشا) فقط رویِ روشِ
     «جعفریت — ایران» اثر دارند — MWL/ISNA/ام‌القری تعریفِ ثابتِ
     خودشان را نگه می‌دارند. */
  resolveMethod(method, opt){
    const o = opt || {};
    let id = (typeof method === 'string' ? method : (method && method.id) || this.DEFAULT_METHOD);
    id = SALAH_METHOD_ALIAS[id] || id;
    const m = Object.assign({}, SALAH_METHODS[id] || SALAH_METHODS[this.DEFAULT_METHOD]);
    if(m.id === 'jafari'){
      /* تنظیماتِ جعفریت — فقط در همان بازه‌های مجاز پذیرفته می‌شوند */
      const fajrAngle = parseFloat(o.fajrAngle);
      if(isFinite(fajrAngle) && (fajrAngle === 15 || fajrAngle === 18)) m.fajr = fajrAngle;
      const mag = parseFloat(o.maghribOffsetMin);
      if(isFinite(mag) && mag >= 12 && mag <= 18) m.maghribMin = mag;
      const ish = parseFloat(o.ashaOffsetMin);
      if(isFinite(ish) && ish >= 60 && ish <= 120) m.ishaMin = ish;
    }
    if(typeof method === 'object' && method){
      if(isFinite(+method.fajr)) m.fajr = +method.fajr;
      if(isFinite(+method.ishaAngle)) m.ishaAngle = +method.ishaAngle;
    }
    return m;
  },

  /* ── هستهٔ محاسبه — یک روزِ کامل، ساعتِ اعشاریِ محلی ──
     مراحل (همان PrayTimes):
     ۱) jDate = روزِ ژولینیِ محل، با جابه‌جاییِ طولِ جغرافیایی
     ۲) میلِ خورشید و معادلهٔ زمان در تقریبِ ظهر
     ۳) ظهر = ۱۲ − معادلهٔ زمان (ساعتِ خورشیدیِ محل)
     ۴) هر وقتِ زاویه‌دار: T = (۱/۱۵)·arccos((−cos(a) − sin(δ)·sin(φ)) / (cos(δ)·cos(φ)))
     ۵) عصر: زاویه از ضریبِ سایه، angle = arccot(factor + tan|φ−δ|)
     ۶) تبدیل به ساعتِ دستگاه: t + منطقهٔ زمانی − طول/۱۵
     عرض‌های خیلی بالا (که arccos تعریف‌نشده می‌شود) با «نزدیک‌ترین
     مقدارِ ممکن» جایگزین می‌شوند تا تابع هرگز NaN برنگرداند. */
  _computeDay(date, loc, m){
    const A = NOOR_ASTRO;
    /* date این‌جا «UTC-noonِ روزِ مدنیِ خودِ شهر» است (نگاه کن به
       _dayDate) — پس روز از UTC خوانده می‌شود، نه از منطقهٔ زمانیِ
       دستگاه. این‌طور گوشیِ مسافری در توکیو یا تستِ TZ=New_York هم
       همان روزِ خورشیدیِ شهرِ مقصد را حساب می‌کند. */
    const y = date.getUTCFullYear(), mo = date.getUTCMonth() + 1, dd = date.getUTCDate();
    const jDate = A.julian(y, mo, dd) - loc.lon / (15 * 24);
    const approx = t => jDate + (t || 0);

    let [decl, eqt] = A.sunPosition(approx(12 / 24));
    const noon = A.fixHour(12 - eqt);                       // ساعتِ خورشیدی

    /* T برای زاویهٔ a؛ cc=1 یعنی پس از ظهر، cc=-1 یعنی پیش از ظهر */
    const sunT = (a, cc) => {
      const denom = A.cos(decl) * A.cos(loc.lat);
      if(Math.abs(denom) < 1e-9) return 0;
      const x = (-A.sin(a) - A.sin(decl) * A.sin(loc.lat)) / denom;
      if(x > 1 || x < -1){
        /* خورشید هرگز به این زاویه نمی‌رسد (نیمه‌شبِ خورشیدی/روزِ
        قطبی): به جای NaN، لبهٔ ممکن — عملاً فقط در عرض‌های قطبی. */
        return 0;
      }
      const t = A.arccos(x) / 15;
      return cc > 0 ? noon + t : noon - t;
    };

    /* زاویهٔ غروب/طلوع: ۰٫۸۳۳° = شعاعِ ظاهریِ خورشید + شکستِ نور */
    const RISE = 0.833;
    /* زاویهٔ عصر از ضریبِ سایه: وقتی سایهٔ شاخص = factor + سایهٔ ظهر
       (tan|φ−δ|) شد. خروجیِ atan رادیان است و به درجه برمی‌گردد. */
    const shadow = m.asrFactor || 1;
    const asrA = A.rtd(Math.atan(1 / (shadow + A.tan(Math.abs(loc.lat - decl)))));

    /* خروجی در «ساعتِ خورشیدیِ محل» است (۱۲ = ظهرِ خورشیدی). تبدیل به
       لحظهٔ مطلق (Date) در _at انجام می‌شود: UTC = ساعتِ خورشیدی − طول/۱۵.
       چرا این‌جا منطقهٔ زمانیِ دستگاه را اضافه نمی‌کنیم؟ چون کاربر ممکن
       است با دستگاهی در منطقهٔ زمانیِ دیگر اوقاتِ شهری را ببیند (یا
       تست‌ها روی UTC اجرا شوند)؛ لحظهٔ واقعیِ رویدادِ نجومی به منطقهٔ
       زمانیِ دستگاه ربطی ندارد. نمایش به عهدهٔ خودِ Date در منطقهٔ
       زمانیِ دستگاه است. */
    const fajr    = sunT(m.fajr, -1);
    const sunrise = sunT(RISE, -1);
    const dhuhr   = noon;
    const asr     = noon + (() => {
      const denom = A.cos(decl) * A.cos(loc.lat);
      if(Math.abs(denom) < 1e-9) return 0;
      /* عصر بالای افق است: PrayTimes زاویهٔ منفی می‌فرستد، یعنی
         −sin(−a) = +sin(a) — همین‌جا صریحِ مثبت گذاشته شده. */
      const x = (A.sin(asrA) - A.sin(decl) * A.sin(loc.lat)) / denom;
      if(x > 1 || x < -1) return 0;
      return A.arccos(x) / 15;
    })();
    const sunset  = sunT(RISE, +1);
    const maghrib = sunset + (m.maghribMin || 0) / 60;
    const isha    = (m.ishaMin != null && !m.ishaAngle)
      ? maghrib + m.ishaMin / 60
      : sunT(m.ishaAngle != null ? m.ishaAngle : 17, +1);

    return { fajr, sunrise, dhuhr, asr, sunset, maghrib, isha };
  },

  /* ساعتِ خورشیدیِ محل → آبجکتِ Date (لحظهٔ مطلق).
     UTC = ساعتِ خورشیدی − طولِ جغرافیایی/۱۵. خودِ Date در هر منطقهٔ
     زمانی که نمایش داده شود، ساعتِ محلیِ درستِ همان منطقه را نشان
     می‌دهد — پس اوقات هم روی گوشیِ مسافر و هم در تست‌های UTC سالم‌اند.
     minute-afzayi رویِ Dateِ UTC یعنی DST/تقویم خودش حل می‌شود. */
  _at(date, solarHours, lon){
    const ms = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) +
               Math.round((solarHours - lon / 15) * 60) * 6e4;
    return new Date(ms);
  },

  /* روزِ مدنیِ خودِ شهر برای یک لحظهٔ مطلق: لحظه را به اندازهٔ
     طولِ جغرافیاییِ شهر جابه‌جا می‌کنیم و روزِ UTC را می‌خوانیم.
     نتیجه «امروز در آن شهر» است، فارغ از منطقهٔ زمانیِ دستگاه —
     پایهٔ مستقل‌شدنِ next/current/times از TZ. */
  _dayDate(date, lon){
    const s = new Date(+date + (lon / 15) * 36e5);
    return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 12));
  },

  /* ── API اصلی ──
     Salah.times(date, loc, method) →
       { fajr, sunrise, dhuhr, asr, sunset, maghrib, isha, midnight }
     همه به‌شکلِ Dateِ محلی. loc و method اختیاری‌اند:
     بی loc → تهران، بی method → «جعفریت — ایران».
     method می‌تواند رشته باشد یا آبجکتِ
       { id, fajrAngle, maghribOffsetMin, ashaOffsetMin } که همان
       کلیدهای Store است. اگر هیچ ندهد، از Store خوانده می‌شود. */
  times(date, loc, method){
    const raw = (date instanceof Date && !isNaN(+date)) ? date : new Date();
    const L = this.resolveLoc(loc != null ? loc : this._storeLoc());
    const m = this.resolveMethod(
      method != null ? method : this._storeMethod(),
      method == null ? this._storeParams() : (typeof method === 'object' ? method : {})
    );
    /* روزِ محاسبه = روزِ مدنیِ خودِ شهر، نه روزِ دستگاه */
    const d = this._dayDate(raw, L.lon);
    const t = this._computeDay(d, L, m);
    const out = {
      fajr:    this._at(d, t.fajr, L.lon),
      sunrise: this._at(d, t.sunrise, L.lon),
      dhuhr:   this._at(d, t.dhuhr, L.lon),
      asr:     this._at(d, t.asr, L.lon),
      sunset:  this._at(d, t.sunset, L.lon),
      maghrib: this._at(d, t.maghrib, L.lon),
      isha:    this._at(d, t.isha, L.lon)
    };
    /* نیمه‌شبِ شرعی = میانهٔ غروب تا فجرِ فردا */
    const nd = new Date(+d + 864e5);
    const t2 = this._computeDay(nd, L, m);
    const sunsetToday = this._at(d, t.sunset, L.lon);
    const fajrTmr = this._at(nd, t2.fajr, L.lon);
    out.midnight = new Date((+sunsetToday + +fajrTmr) / 2);
    return out;
  },

  /* اگر Store در دسترس بود (مرورگر/هارنس)، تنظیماتِ کاربر مرجع است؛
     وگرنه پیش‌فرض‌ها. این موتور هرگز به Store *نیاز* ندارد. */
  _storeLoc(){
    try{ if(typeof Store !== 'undefined' && Store.data) return Store.data.loc || null; }catch(e){}
    return null;
  },
  _storeMethod(){
    try{ if(typeof Store !== 'undefined' && Store.data) return Store.data.salahMethod || this.DEFAULT_METHOD; }catch(e){}
    return this.DEFAULT_METHOD;
  },
  _storeParams(){
    try{
      if(typeof Store !== 'undefined' && Store.data)
        return { fajrAngle:Store.data.fajrAngle, maghribOffsetMin:Store.data.maghribOffsetMin,
                 ashaOffsetMin:Store.data.ashaOffsetMin };
    }catch(e){}
    return {};
  },

  /* نمازِ بعدی: { name, at, inMs } — بینِ پنج نمازِ اصلی. اگر تا
     نیمه‌شبِ محلی چیزی نمانده باشد، فجرِ فردا برمی‌گردد. */
  next(now, loc, method){
    const n = (now instanceof Date && !isNaN(+now)) ? now : new Date();
    const t = this.times(n, loc, method);
    for(const name of SALAH_NAMES){
      if(+t[name] > +n) return { name, at:t[name], inMs:+t[name] - +n };
    }
    const nd = new Date(+n + 864e5);
    const t2 = this.times(nd, loc, method);
    return { name:'fajr', at:t2.fajr, inMs:+t2.fajr - +n };
  },

  /* نمازِ جاری: آخرین وقتی که گذشته است. پیش از فجر، «عشا»ی دیشب
     جاری است (بازهٔ عشا تا فجرِ بعدی). */
  current(now, loc, method){
    const n = (now instanceof Date && !isNaN(+now)) ? now : new Date();
    const t = this.times(n, loc, method);
    let cur = null;
    for(const name of SALAH_NAMES){
      if(+t[name] <= +n) cur = { name, at:t[name] };
    }
    if(cur) return cur;
    const pd = new Date(+n - 864e5);
    const tp = this.times(pd, loc, method);
    return { name:'isha', at:tp.isha };
  },

  /* پیشرفتِ بازهٔ نمازِ جاری، ۰..۱ (تا وقتیِ نمازِ بعدی). */
  progress(now, loc, method){
    const n = (now instanceof Date && !isNaN(+now)) ? now : new Date();
    const c = this.current(n, loc, method);
    const x = this.next(n, loc, method);
    const span = +x.at - +c.at;
    if(!(span > 0)) return 0;
    const p = (+n - +c.at) / span;
    return Math.min(1, Math.max(0, p));
  },

  /* ── قبله ──
     سمتِ قبله بر حسبِ درجه از شمالِ جغرافیایی (ساعتگردِ مثبت)، با
     فرمولِ استانداردِ great-circle bearing نسبت به کعبه
     (۲۱٫۴۲۲۵ شمالی، ۳۹٫۸۲۶۲ شرقی). تهران ≈ ۲۱۹° می‌شود. */
  qibla(lat, lon){
    const A = NOOR_ASTRO;
    const L = this.resolveLoc({ lat, lon });
    const k = this.KAABA;
    const dLon = k.lon - L.lon;
    const y = A.sin(dLon);
    const x = A.cos(L.lat) * A.tan(k.lat) - A.sin(L.lat) * A.cos(dLon);
    return A.fixAngle(A.arctan2(y, x));
  }
};

/* ═══════════════════════════ Hijri ═══════════════════════════
   تبدیلِ میلادی ↔ قمری با الگوریتمِ مدنیِ کویت (tabular Islamic
   calendar). مبنای حسابی: دورهٔ ۳۰ ساله با ۱۱ سالِ کبیسه
   (۲، ۵، ۷، ۱۰، ۱۳، ۱۵، ۱۸، ۲۱، ۲۴، ۲۶، ۲۹). این همان روشی است که
   در مبدل‌های آزادِ فراوان (از جمله تقویمِ KDE و چند کتابخانهٔ JS)
   مستند شده. دقت: برای کاربرِ روزمره کافی است، اما یک تا دو روز با
   تقویمِ رؤیتِ هلال (ام‌القری) اختلاف دارد — مناسبت‌های این برنامه
   فقط «کم‌اختلاف» انتخاب شده‌اند و فاطمیه بازه است. */
const Hijri = {
  /* مبدأ: ۱ محرم ۱ ه‍.ق = جمعه ۱۹ جولای ۶۲۲ م (ژولینی)،
     JDN آن ۱۹۴۸۴۴۰ است (مبدأِ مدنی/epoch با شروعِ روز). */
  EPOCH_JDN: 1948440,
  MONTHS_FA: ['محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی', 'جمادی‌الاول', 'جمادی‌الثانی',
              'رجب', 'شعبان', 'رمضان', 'شوال', 'ذی‌القعده', 'ذی‌الحجه'],
  /* نامِ لاتینیِ مستند، کنارِ نامِ فارسی — برای src و دیباگ */
  MONTHS_EN: ['Muharram','Safar','Rabi I','Rabi II','Jumada I','Jumada II',
              'Rajab','Shaban','Ramadan','Shawwal','Dhu al-Qadah','Dhu al-Hijjah'],

  _int(x){ return Math.floor(x); },

  /* میلادی → JDN (تقویمِ گرگوریِ پیش‌نهادیِ نجومی) */
  gregorianToJDN(gy, gm, gd){
    const i = this._int, a = i((14 - gm) / 12), y = gy + 4800 - a, m = gm + 12 * a - 3;
    return gd + i((153 * m + 2) / 5) + 365 * y + i(y / 4) - i(y / 100) + i(y / 400) - 32045;
  },

  /* JDN → میلادی (الگوریتمِ مستندِ Fliegel–Van Flandern) */
  jdnToGregorian(jdn){
    const i = this._int;
    const l = jdn + 68569;
    const n = i(4 * l / 146097);
    const l2 = l - i((146097 * n + 3) / 4);
    const yy = i(4000 * (l2 + 1) / 1461001);
    const l3 = l2 - i(1461 * yy / 4) + 31;
    const j = i(80 * l3 / 2447);
    const gd = l3 - i(2447 * j / 80);
    const l4 = i(j / 11);
    return { gy: 100 * (n - 49) + yy + l4, gm: j + 2 - 12 * l4, gd };
  },

  /* قمری → JDN (فرمولِ مدنیِ کویت/تابولار).
     ثابتِ ۱۹۴۸۰۵۵ (= EPOCH_JDN − ۳۸۵) با جابه‌جاییِ خودِ jdnToHijri
     سازگار است؛ round-trip در node روی همهٔ روزهای ۱۴۰۰–۱۴۶۰ قمری و
     همهٔ روزهای ۲۰۲۴–۲۰۲۸ میلادی سنجیده شده (صفر خطا). */
  hijriToJDN(hy, hm, hd){
    const i = this._int;
    return hd + 30 * hm - i((hm - 1) / 2) + 354 * hy + i((3 + 11 * hy) / 30) + 1948055;
  },

  /* JDN → قمری (الگوریتمِ کویت) */
  jdnToHijri(jdn){
    const i = this._int;
    let l = jdn - this.EPOCH_JDN + 10632;
    const n = i((l - 1) / 10631);
    l = l - 10631 * n + 354;
    const j = i((10985 - l) / 5316) * i(50 * l / 17719) + i(l / 5670) * i(43 * l / 15238);
    l = l - i((30 - j) / 15) * i(17719 * j / 50) - i(j / 16) * i(15238 * j / 43) + 29;
    const hm = i(24 * l / 709);
    const hd = l - i(709 * hm / 24);
    const hy = 30 * n + j - 30;
    return { hy, hm, hd };
  },

  /* API: از Dateِ محلی (سال/ماه/روزِ خودِ دستگاه) */
  fromGregorian(date){
    const d = (date instanceof Date && !isNaN(+date)) ? date : new Date();
    const jdn = this.gregorianToJDN(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return this.jdnToHijri(jdn);
  },
  toGregorian(hy, hm, hd){
    const jdn = this.hijriToJDN(hy, hm, hd);
    const g = this.jdnToGregorian(jdn);
    /* خروجیِ jdnToGregorian به‌شکلِ عددِ ساده ساخته می‌شود تا Dateِ
       محلیِ نصفِ روز بدهد و DST ساعت را کج نکند. */
    return new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0, 0);
  },
  monthName(hm){ return this.MONTHS_FA[(hm - 1 + 12) % 12] || ''; },

  /* نمایشِ فارسی برای فازِ بعد: «۱۰ محرم ۱۴۴۷» با رقمِ فارسی.
     U.fa اگر در دسترس بود همان، وگرنه تبدیلِ محلی. */
  _faDigits(s){
    const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    try{ if(typeof U !== 'undefined' && U.fa) return U.fa(s); }catch(e){}
    return fa(s);
  },
  formatFa(date){
    const h = this.fromGregorian(date);
    return `${this._faDigits(h.hd)} ${this.monthName(h.hm)} ${this._faDigits(h.hy)}`;
  },
  /* کلیدِ ثابتِ روزِ قمری — برای مقایسهٔ مناسبت‌ها */
  dayKey(date){
    const h = this.fromGregorian(date);
    return `${h.hy}-${String(h.hm).padStart(2,'0')}-${String(h.hd).padStart(2,'0')}`;
  },
  /* طولِ ماه/سال از خودِ الگوریتم گرفته می‌شود تا با jdnToHijri
     سازگار بماند (کبیسه‌ها همان‌هایی است که تبدیلِ رفت‌وبرگشت می‌گوید). */
  monthLength(hy, hm){
    return this.hijriToJDN(hm === 12 ? hy + 1 : hy, hm === 12 ? 1 : hm + 1, 1) - this.hijriToJDN(hy, hm, 1);
  },
  yearLength(hy){ return this.hijriToJDN(hy + 1, 1, 1) - this.hijriToJDN(hy, 1, 1); },
  isRamadan(date){ return this.fromGregorian(date).hm === 9; }
};

/* ═══════════════════════════ مناسبت‌ها ═══════════════════════
   اسکلتِ فازِ ۱ — فقط مناسبت‌های *کم‌اختلاف* با تاریخِ قمریِ ثابت:
   غدیر (۱۸ ذی‌الحجه)، عاشورا (۱۰ محرم)، اربعین (۲۰ صفر)،
   نیمهٔ شعبان (۱۵ شعبان)، مبعث (۲۷ رجب).
   فاطمیه یک روزِ محلِ نزاع نیست: بازهٔ «مشهور» از ۱۳ جمادی‌الاول
   تا ۳ جمادی‌الثانی است و با برچسبِ مشهور نمایش داده می‌شود.
   src منبعِ تاریخیِ همان مناسبت است، نه ادعای تقویمی. */
const NOOR_OCCASIONS = [
  { hijriMonth:12, hijriDay:18, title:'عید غدیر خم', kind:'celebration', topic:'ghadir',
    src:'واقعهٔ غدیر خم در ۱۸ ذی‌الحجهٔ سالِ ۱۰ ه‍.ق — بینِ مسلمانان ثابت است' },
  { hijriMonth:1, hijriDay:10, title:'عاشورا', kind:'mourning', topic:'karbala',
    src:'شهادتِ امام حسین علیه‌السلام در ۱۰ محرم ۶۱ ه‍.ق' },
  { hijriMonth:2, hijriDay:20, title:'اربعین حسینی', kind:'mourning', topic:'karbala',
    src:'چهلمِ شهادتِ امام حسین علیه‌السلام — ۲۰ صفر' },
  { hijriMonth:8, hijriDay:15, title:'نیمهٔ شعبان', kind:'celebration', topic:'mahdavi',
    src:'ولادتِ امام مهدی عجل‌الله‌فرجه در ۱۵ شعبان ۲۵۵ ه‍.ق' },
  { hijriMonth:7, hijriDay:27, title:'مبعث رسول خدا صلی‌الله‌علیه‌وآله', kind:'celebration', topic:'quran',
    src:'بعثتِ پیامبر اکرم در ۲۷ رجب — تاریخِ مشهور' },
  /* فاطمیه: بازهٔ مشهور، نه یک روزِ قطعی. روزهایِ ۱۳ جمادی‌الاول و
     ۳ جمادی‌الثانی هر دو در منابع آمده‌اند؛ برنامه هیچ‌کدام را به‌تنهایی
     «قطعی» اعلام نمی‌کند. */
  { hijriMonth:5, hijriDay:13, hijriEndMonth:6, hijriEndDay:3,
    title:'ایامِ فاطمیه (بازهٔ مشهور)', kind:'mourning', range:true, disputed:true,
    label:'مشهور', topic:'ahlulbayt',
    src:'در منابع، ۱۳ جمادی‌الاول و ۳ جمادی‌الثانی هر دو آمده‌اند — بازهٔ عزاداری، نه روزِ قطعی' }
];

/* مناسبتِ امروز (یا بازهٔ جاری) — اگر نبود، null. یعنی خانه هیچ
   کارتی نشان نمی‌دهد، نه کارتِ اشتباه. */
function noorOccasionFor(date){
  const d = (date instanceof Date && !isNaN(+date)) ? date : new Date();
  const h = Hijri.fromGregorian(d);
  const pos = (m, dd) => (m - 1) * 30 + dd;           // جای تقریبی در سالِ قمری
  const cur = pos(h.hm, h.hd);
  for(const o of NOOR_OCCASIONS){
    if(!o.range){
      if(o.hijriMonth === h.hm && o.hijriDay === h.hd) return o;
    }else{
      const a = pos(o.hijriMonth, o.hijriDay);
      const b = pos(o.hijriEndMonth, o.hijriEndDay);
      if(cur >= a && cur <= b) return o;
    }
  }
  return null;
}

/* مناسبت‌ها روی DATA هم می‌نشینند تا بقیهٔ برنامه (فازِ بعد) با همان
   قراردادِ همیشگیِ DATA کار کنند. در هارنس، DATA پیش از این فایل
   تعریف شده است (اسکریپت‌ها به ترتیبِ سند eval می‌شوند). */
try{ if(typeof DATA !== 'undefined' && !DATA.occasions) DATA.occasions = NOOR_OCCASIONS; }catch(e){}

/* ═══════════════════ selfTest — گسترشِ فازِ ۱ ═══════════════════
   خودِ selfTest() در باندلِ اصلی است؛ این‌جا همان را می‌پوشانیم و
   سنجش‌های قبله و اوقاتِ تهران را به نتیجه‌اش اضافه می‌کنیم تا هم در
   کنسولِ مرورگر و هم در «تنظیمات → selfTest» دیده شوند. */
(function extendSelfTest(){
  try{
    if(typeof selfTest !== 'function') return;
    const base = selfTest;
    const wrapped = function(){
      const res = base.apply(this, arguments);
      if(!res || !Array.isArray(res.rows)) return res;
      try{
        const ok = (name, cond, extra) => res.rows.push({ name, ok:!!cond, extra });
        const tehran = { lat:35.6892, lon:51.3890 };
        const q = Salah.qibla(tehran.lat, tehran.lon);
        ok('selfTest/قبلهٔ تهران ≈ ۲۱۹°', q > 216 && q < 222, q.toFixed(2));
        const t = Salah.times(new Date(), tehran, 'jafari');
        ok('selfTest/ترتیبِ اوقاتِ تهران', +t.fajr < +t.sunrise && +t.sunrise < +t.dhuhr &&
           +t.dhuhr < +t.asr && +t.asr < +t.sunset && +t.sunset <= +t.maghrib &&
           +t.maghrib < +t.isha && +t.isha < +t.midnight);
        ok('selfTest/مغربِ جعفری پس از غروب است', +t.maghrib > +t.sunset);
        const tmr = Salah.times(new Date(Date.now() + 864e5), tehran, 'jafari');
        ok('selfTest/نیمه‌شب بینِ مغرب و فجرِ فرداست',
           +t.midnight > +t.maghrib && +t.midnight < +tmr.fajr);
        const nx = Salah.next(new Date(), tehran, 'jafari');
        ok('selfTest/نمازِ بعدی در آینده است', nx && nx.at && nx.inMs > 0);
      }catch(e){
        res.rows.push({ name:'selfTest/موتور اوقات', ok:false, extra:e && e.message });
      }
      res.total = res.rows.length;
      res.pass = res.rows.filter(r => r.ok).length;
      res.ok = res.pass === res.total;
      return res;
    };
    selfTest = wrapped;                       // بازانتساب به همان پیوندِ سراسری
    try{ window.selfTest = wrapped; }catch(e){}
  }catch(e){}
})();

/* در محیطِ CommonJS (تست‌های مستقلِ Node) هم قابلِ استفاده است،
   بدونِ آنکه در مرورگر چیزی صادر شود. */
if(typeof module !== 'undefined' && module.exports){
  module.exports = { Salah, Hijri, NOOR_CITIES, NOOR_OCCASIONS, SALAH_METHODS, noorOccasionFor };
}
