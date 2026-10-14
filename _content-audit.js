/* ═══════════════════════════════════════════════════════════════════
   _content-audit.js — بازرسیِ ساختاریِ بانک‌های محتوا (بدونِ شبکه)

   این اسکریپت *هیچ* ادعای دینی‌ای را درست یا غلط نمی‌داند — نمی‌تواند.
   فقط چیزهایی را می‌گیرد که از منطقِ خودِ داده فهمیدنی است: پاسخِ بیرون
   از گزینه‌ها، گزینهٔ تکراری، پرسشِ تکراری، واژهٔ کلیدی که در متن نیست،
   واژه‌های دعا که در متن دعا نیستند، و کاراکترهای خراب.

   مهم: مقایسه‌ها با *همان* نرمال‌سازیِ برنامه (`U.norm`) انجام می‌شود.
   با نرمال‌سازیِ دست‌سازِ خودم ۱۳ «خطا»ی درست‌نما ساختم که همه از
   ناهم‌خوانیِ نرمال‌سازی بود، نه از داده.

   اجرا:  node _content-audit.js
   ═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
/* منبعِ منتشرشده، نه فقط سند: از وقتی `tools/split-index.js` کد را به
   `assets/app/` برد، `const DATA` دیگر در index.html نیست. */
const html = require('./_shipped.js').source();

const at = html.indexOf('\nconst DATA = {');
const end = html.indexOf('\n};', at);
if(at < 0 || end < 0) throw new Error('DATA پیدا نشد');
const DATA = eval('(' + html.slice(at + '\nconst DATA = '.length, end + 2) + ')');

/* نرمال‌سازیِ خودِ برنامه — عیناً همان تابع */
const norm = (s) => String(s ?? '')
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀهٔ]/g, 'ه')
  .replace(/[‌‏‎]/g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();

/* ── بانک‌های مشتق ──────────────────────────────────────────────────
   بعضی بانک‌ها در خودِ DATA نیستند و در زمان اجرا از بانک دیگری ساخته
   می‌شوند (`DATA.surahPick = DATA.surah.map(...)`، پایینِ فایل). بی این
   بلوک، بازرس «بانکِ surahPick نیست» می‌گفت و یک خطای درست‌نما می‌ساخت.
   تعریفِ زیر باید با همان خطِ برنامه یکی بماند. */
DATA.surahPick = DATA.surah.map(l => ({
  q: `جای خالی را کامل کن: ﴿ ${l.before} … ﴾`,
  o: [l.ans, ...l.wrong],
  a: l.ans,
  d: (l.a % 3) + 1,
  why: `${l.tr} — ${l.surah}، آیهٔ ${l.a}`,
  src: l.src || `قرآن، سورهٔ ${l.surah}`
}));
const DERIVED = ['surahPick'];   // برای برچسب‌زدن در گزارش

let issues = 0, warns = 0, notes = 0;
/* همهٔ پرچم‌ها یک‌جا جمع می‌شوند تا گزارشِ ماشینی (`--json`) هم همان چیزی
   باشد که روی کنسول چاپ شده — نه یک خلاصهٔ دست‌سازِ دوم. */
const FLAGS = [];
const bad = (where, msg) => { issues++; FLAGS.push({ level:'bad', where, msg }); console.log(`  ✗ ${where} — ${msg}`); };
const warn = (where, msg) => { warns++; FLAGS.push({ level:'warn', where, msg }); console.log(`  ⚠ ${where} — ${msg}`); };
/* «اطلاعیهٔ محتوایی»: چیزی که *ایرادِ ساختاری* نیست و فقط با ورودیِ
   صاحبِ برنامه بسته می‌شود (عددِ ثبت‌نشده، ترجمهٔ نبوده، دو رکورد با
   متنِ یکسان). روی کدِ خروج اثر ندارد. */
const note = (where, msg) => { notes++; FLAGS.push({ level:'note', where, msg }); console.log(`  · ${where} — ${msg}`); };
const head = (t) => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 56 - t.length)));

/* نوکِ رشته برای پیامِ کوتاه */
const cut = (s, n = 58) => JSON.stringify(String(s).replace(/\s+/g, ' ').slice(0, n));

/* ── ۱. بانک‌های پرسش‌محور (q / o / a) ─────────────────────────── */
head('بانک‌های پرسش‌محور');
{
  const banks = Object.entries(DATA).filter(([, v]) =>
    Array.isArray(v) && v.length && v[0] && v[0].q !== undefined && v[0].o && v[0].a !== undefined);
  for(const [bank, arr] of banks){
    let n = 0;
    const seenQ = new Map();
    arr.forEach((x, i) => {
      const w = `${bank}#${i}`;
      if(!String(x.q || '').trim()){ bad(w, 'متن پرسش خالی'); return; }
      if(!Array.isArray(x.o) || x.o.length < 2){ bad(w, 'گزینه‌ها کم‌اند'); return; }
      if(x.a == null || x.a === ''){ bad(w, 'پاسخ خالی'); return; }
      if(!x.o.some(o => norm(o) === norm(x.a))){ bad(w, `پاسخ ${cut(x.a, 34)} در گزینه‌ها نیست`); n++; }
      const ns = x.o.map(norm);
      if(new Set(ns).size !== ns.length){ bad(w, 'گزینهٔ تکراری: ' + x.o.map(o => cut(o, 22)).join(' | ')); n++; }
      if(!String(x.why || '').trim()){ bad(w, 'why خالی'); n++; }
      if(!String(x.src || '').trim()){ bad(w, 'src خالی'); n++; }
      if(x.d != null && (x.d < 1 || x.d > 3)){ bad(w, 'سختی بیرون از ۱..۳: ' + x.d); n++; }
      const nq = norm(x.q);
      if(seenQ.has(nq)){ bad(w, 'پرسش تکراری با #' + seenQ.get(nq)); n++; }
      else seenQ.set(nq, i);
    });
    console.log(`  ${bank.padEnd(11)} ${String(arr.length).padStart(3)} پرسش، ${arr[0].o.length} گزینه` +
                (DERIVED.includes(bank) ? ' (مشتق)' : '') +
                (n ? `  ← ${n} ایراد` : '  ✓'));
  }
}

/* ── ۲. سوره: کامل‌کردن آیه ─────────────────────────────────────── */
head('سوره — کامل‌کردن آیه');
{
  const arr = DATA.surah || [];
  let n = 0;
  arr.forEach((x, i) => {
    const w = 'surah#' + i;
    if(!(x.n >= 1 && x.n <= 114)){ bad(w, 'شمارهٔ سوره بیرون از ۱..۱۱۴: ' + x.n); n++; }
    const all = [x.ans, ...(x.wrong || [])];
    if(!x.ans){ bad(w, 'پاسخ خالی'); n++; }
    const nm = all.map(norm);
    if(new Set(nm).size !== nm.length){ bad(w, 'گزینهٔ تکراری: ' + all.join(' | ')); n++; }
    if((x.wrong || []).length !== 3){ bad(w, 'سه گزینهٔ نادرست لازم است، ' + (x.wrong || []).length + ' هست'); n++; }
    if(!String(x.before || '').trim()){ bad(w, 'متن آیه خالی'); n++; }
    if(!String(x.tr || '').trim()){ bad(w, 'ترجمه خالی'); n++; }
    if(!(x.a >= 1)){ bad(w, 'شمارهٔ آیه نامعتبر: ' + x.a); n++; }
  });
  console.log(`  surah       ${String(arr.length).padStart(3)} آیه` + (n ? `  ← ${n} ایراد` : '  ✓'));
}

/* ── ۲٫۵. آیه‌ها در برابر مرجعِ عثمانی ─────────────────────────────
   بازرسیِ بالا فقط *ساختار* را می‌سنجید: پاسخ در گزینه‌ها هست، تکراری
   نیست، ترجمه دارد. هیچ‌کدام نمی‌فهمید که «إِنَّ ______» دنبالهٔ آیه را
   گم کرده باشد. متنِ آیه را نمی‌توان از حافظه نوشت، پس یک مرجعِ
   برون‌خط در `archive/raw/quran-ref.json` نگه می‌داریم (منبعش آنجاست) و
   همان را می‌سنجیم.

   دو چیز گرفته می‌شود:
     ۱) دنبالهٔ افتاده — `before + ans` پیشوندِ آیه باشد ولی تمامش نکند
     ۲) واژهٔ جابه‌جا — پیشوند نباشد، یعنی متن با آیه نمی‌خواند */
head('سوره — آیه در برابر مرجعِ عثمانی');
{
  const arr = DATA.surah || [];
  /* مرجع کنارِ خودِ بازرس است، نه در `archive/`. پوشهٔ `archive/` در
     `.gitignore` است (متنِ خامِ اسکرپ‌شده، چهل‌وچهار مگابایت) و اگر مرجع
     آن‌جا می‌ماند، روی یک کلونِ تازه پیدا نمی‌شد و همین سنجش بی‌صدا
     از کار می‌افتاد. */
  const refPath = path.join(__dirname, '_quran-ref.json');
  if(!fs.existsSync(refPath)){
    bad('quran-ref', 'مرجع پیدا نشد: _quran-ref.json');
  } else {
    const REF = JSON.parse(fs.readFileSync(refPath, 'utf8')).ayat;
    /* نرمال‌سازیِ عثمانی‌فهم: نشانه‌های قرآنی می‌روند و شکل‌های الف یکی
       می‌شوند، وگرنه یک تفاوتِ *رسم‌الخط* به‌شکلِ «واژهٔ گمشده» دیده
       می‌شود (همان اشتباهی که در فهرستِ نخستم رخ داد). */
    /* ترتیبِ این گام‌ها مهم است. رسم عثمانی و املایی یک واژه را دو جور
       می‌نویسند و هر تفاوت یک «واژهٔ گمشده»ی درست‌نما می‌ساخت:
         ٱلْإِنسَٰنَ   ↔  الْإِنْسَانَ     (الفِ کوچک)
         يَٰٓأَيُّهَا    ↔  يَا أَيُّهَا     (مرزِ واژه)
         أَلْهَىٰكُمُ  ↔  أَلْهَاكُمُ      (الف مقصوره + الف کوچک)
         أَرَءَيْتَ   ↔  أَرَأَيْتَ       (همزه روی خط)
         ءَامَنُوا    ↔  آمَنُوا         (همزه + الف)
       پس اول اعراب می‌رود، بعد «ىٰ» یک الف می‌شود، بعد همزه با الفِ
       پسِ خود یکی می‌شود، و آخر شکل‌های الف یکدست می‌شوند. */
    const loose = (s) => String(s ?? '')
      .replace(/[ً-ْٓ-ٕٔ-ٟۖ-ۭـ]/g, '')   /* اعراب، همزهٔ بالانویس، نشانهٔ وقف */
      .replace(/ىٰ/g, 'ا')                 /* الف مقصوره + الف کوچک → یک الف */
      .replace(/ٰ/g, 'ا')                  /* الف کوچک → الف */
      .replace(/ئ/g, 'ي')                  /* همزه روی یا → یا */
      .replace(/ؤ/g, 'و')                  /* همزه روی واو → واو */
      .replace(/ءا/g, 'ا')                 /* همزه + الف → الف */
      .replace(/ء/g, 'ا')                  /* همزهٔ ایستاده */
      .replace(/[ٱآأإ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ').trim();
    /* بسمله با واژهٔ «الرحمن» سنجیده نمی‌شود: در رسم عثمانی «ٱلرَّحْمَٰنِ»
       الفِ کوچک دارد و «الرحمان» نرمال می‌شود. دو واژهٔ نخست کافی است. */
    const stripB = (raw) => {
      const w = raw.split(' ');
      return (loose(w[0]) === 'بسم' && loose(w[1]) === 'الله') ? w.slice(4).join(' ') : raw;
    };

    /* مقایسه در سطحِ *نویسه*، نه واژه.
       مرزِ واژه در رسم عثمانی و املایی یکی نیست: «يَٰٓأَيُّهَا» یک واژه است
       و «يَا أَيُّهَا» دو واژه. سنجشِ واژه‌به‌واژه آن را «ناهم‌خوانی»
       می‌دید. پس هر دو را به رشتهٔ بی‌فاصله بدل می‌کنیم و جایگاه را
       با `indexOf` می‌جوییم؛ نقشهٔ بازگشت به نویسهٔ خام را هم نگه
       می‌داریم تا دنباله را از *متنِ خام* ببریم، نه از نرمال‌شده.

       مهم: این نگاشت *نمی‌تواند* `loose(s[i])` باشد. دو قاعدهٔ `loose`
       دو‌نویسه‌ای‌اند («ءا» و «ىٰ») و در حالتِ تک‌نویسه هرگز شلیک
       نمی‌شوند، پس یک «ء» تنها به «ا» و «ا» پسِ آن هم به «ا» بدل
       می‌شد و «ءَامَنُوا» یک «ا» اضافه می‌گرفت. نتیجه سه خطای
       درست‌نما بود (۵:۵۵، ۴:۵۹، ۱۰۲:۱) که متنشان عیناً با مرجع یکی
       است. پس قواعد را روی *دنبالهٔ نویسه‌ها* پیاده می‌کنیم.
       `map` انتهای بازهٔ خامِ هر نویسهٔ نرمال‌شده است، نه آغازش؛
       وگرنه بریدنِ دنباله وسطِ یک جفت می‌ایستاد. */
    const flatOf = (s) => {
      /* گامِ ۱: حذف‌ها. فاصله هم می‌رود، چون مرزِ واژه در دو رسم یکی
         نیست: مرجع «يَٰٓأَيُّهَا» را یک واژه می‌نویسد و برنامه
         «يَا أَيُّهَا» را دو واژه، و همین یک فاصله سه آیهٔ سالم را
         «ناهم‌خوان» می‌کرد. */
      const kept = [];
      for(let i = 0; i < s.length; i++){
        const c = s[i];
        if(/[ً-ْٓ-ٕٔ-ٟۖ-ۭـ]/.test(c)) continue;
        if(/\s/.test(c)) continue;
        kept.push({ ch: c, at: i });
      }

      /* گامِ ۲: نگاشت، با قواعدِ جفتی — به *همان ترتیبی* که در `loose` بود */
      const flat = [], map = [];
      const out = (ch, at) => { for(const k of ch){ flat.push(k); map.push(at); } };
      for(let i = 0; i < kept.length; i++){
        const c = kept[i].ch, at = kept[i].at, nx = kept[i + 1];
        if(c === 'ى' && nx && nx.ch === 'ٰ'){ out('ا', nx.at); i++; continue; }
        if(c === 'ٰ'){ out('ا', at); continue; }
        if(c === 'ء' && nx && nx.ch === 'ا'){ out('ا', nx.at); i++; continue; }
        if(c === 'ئ'){ out('ي', at); continue; }
        if(c === 'ؤ'){ out('و', at); continue; }
        if(c === 'ء'){ out('ا', at); continue; }
        if(/[ٱآأإ]/.test(c)){ out('ا', at); continue; }
        if(c === 'ى'){ out('ي', at); continue; }
        out(c, at);
      }
      return { flat: flat.join(''), map };
    };

    let n = 0, checked = 0;
    arr.forEach((x, i) => {
      const key = `${x.n}:${x.a}`;
      const r = REF[key];
      if(!r){ bad('surah#' + i, `مرجعِ آیهٔ ${key} در quran-ref.json نیست`); n++; return; }
      checked++;
      const A = flatOf(x.before + ' ' + x.ans);
      /* بعضی پرسش‌ها چند آیهٔ پشت‌سرهم‌اند (۹۶:۱–۲). پس تا سه آیهٔ
         پیاپی را به هم می‌چسبانیم و در همان می‌جوییم. */
      let raw = '', R = null;
      for(let span = 1; span <= 3 && !R; span++){
        let acc = '';
        for(let k = 0; k < span; k++){
          const kk = `${x.n}:${x.a + k}`;
          if(!REF[kk]) break;
          acc += (acc ? ' ' : '') + stripB(REF[kk]);
        }
        if(!acc) break;
        const cand = flatOf(acc);
        if(cand.flat.indexOf(A.flat) >= 0){ raw = acc; R = cand; }
      }
      if(!R){
        bad('surah#' + i, `متنِ آیهٔ ${key} در مرجع پیدا نشد`);
        n++; return;
      }
      const at = R.flat.indexOf(A.flat);
      /* دنباله از نخستین نویسهٔ معنادارِ پس از پایانِ متنِ پرسش */
      let p = R.map[at + A.flat.length - 1] + 1;
      while(p < raw.length && !loose(raw[p])) p++;
      const want = p < raw.length ? raw.slice(p).trim() : '';

      if(!want){
        if(x.after){ bad('surah#' + i, `آیهٔ ${key} به پایان رسیده ولی دنباله دارد`); n++; }
        return;
      }
      if(!x.after){
        bad('surah#' + i, `آیهٔ ${key} ناقص است — دنبالهٔ گمشده: «${want.slice(0, 34)}…»`);
        n++;
      } else if(flatOf(x.after).flat !== flatOf(want).flat){
        bad('surah#' + i, `دنبالهٔ آیهٔ ${key} با مرجع نمی‌خواند`);
        n++;
      }
    });
    console.log(`  quran-ref   ${String(checked).padStart(3)} آیه` + (n ? `  ← ${n} ایراد` : '  ✓'));
  }
}

/* ── ۳. حدیث ────────────────────────────────────────────────────── */
head('حدیث — واژهٔ کلیدی داخلِ متن');
{
  const arr = DATA.hadith || [];
  let n = 0;
  const seen = new Map();
  arr.forEach((x, i) => {
    const w = 'hadith#' + i;
    if(!String(x.ar || '').trim()){ bad(w, 'متن عربی خالی'); n++; return; }
    if(!String(x.key || '').trim()){ bad(w, 'واژهٔ کلیدی خالی'); n++; return; }
    if(!norm(x.ar).includes(norm(x.key))){ bad(w, `${cut(x.key, 20)} در متن نیست`); n++; }
    const kws = String(x.key).split(/\s+/).length;
    if(kws !== 1){ bad(w, `واژهٔ کلیدی ${kws} کلمه است (بازی تک‌واژه می‌خواهد): ${cut(x.key, 24)}`); n++; }
    if(!String(x.fa || '').trim()){ bad(w, 'ترجمه خالی'); n++; }
    if(!String(x.src || '').trim()){ bad(w, 'منبع خالی'); n++; }
    const wr = x.wrong || [];
    if(wr.length !== 3){ bad(w, 'سه واژهٔ نادرست لازم است، ' + wr.length + ' هست'); n++; }
    if(wr.some(v => norm(v) === norm(x.key))){ bad(w, 'واژهٔ نادرست با پاسخ یکی است'); n++; }
    const nw = wr.map(norm);
    if(new Set(nw).size !== nw.length){ bad(w, 'واژهٔ نادرست تکراری: ' + wr.join(' | ')); n++; }
    const key = norm(x.ar);
    if(seen.has(key)){ bad(w, 'حدیث تکراری با #' + seen.get(key)); n++; }
    else seen.set(key, i);
  });
  console.log(`  hadith      ${String(arr.length).padStart(3)} حدیث` + (n ? `  ← ${n} ایراد` : '  ✓'));
}

/* ── ۴. دعاهای نجوا ─────────────────────────────────────────────── */
head('نجوا — واژه‌ها باید در متنِ دعا باشند');
{
  const arr = DATA.duas || [];
  let n = 0;
  arr.forEach((x, i) => {
    const w = 'duas#' + i;
    if(!String(x.ar || '').trim()){ bad(w, 'متن عربی خالی'); n++; return; }
    if(!Array.isArray(x.words) || !x.words.length){ bad(w, 'واژه‌ها خالی'); n++; return; }
    const hay = norm(x.ar);
    const out = x.words.filter(v => !hay.includes(norm(v)));
    if(out.length){ bad(w, `${out.length} واژه در متن نیست: ${out.map(v => cut(v, 16)).join(' ')}`); n++; }
    if(!String(x.fa || '').trim()){ bad(w, 'ترجمه خالی'); n++; }
    if(!String(x.src || '').trim()){ bad(w, 'منبع خالی'); n++; }
    if(!String(x.title || '').trim()){ bad(w, 'عنوان خالی'); n++; }
  });
  console.log(`  duas        ${String(arr.length).padStart(3)} دعا` + (n ? `  ← ${n} ایراد` : '  ✓'));
}

/* ── ۵. متن‌های دوزبانه (نقل نهج‌البلاغه) ───────────────────────── */
head('متن دوزبانه');
for(const [bank, arr] of Object.entries(DATA).filter(([, v]) =>
      Array.isArray(v) && v.length && v[0] && v[0].ar !== undefined && v[0].fa !== undefined && v[0].key === undefined)){
  let n = 0;
  const seen = new Map();
  arr.forEach((x, i) => {
    const w = `${bank}#${i}`;
    if(!String(x.ar || '').trim()){ bad(w, 'متن عربی خالی'); n++; }
    if(!String(x.fa || '').trim()){ bad(w, 'ترجمه خالی'); n++; }
    if(!String(x.src || '').trim()){ bad(w, 'منبع خالی'); n++; }
    const k = norm(x.ar);
    if(seen.has(k)){ bad(w, 'تکراری با #' + seen.get(k)); n++; }
    else seen.set(k, i);
  });
  console.log(`  ${bank.padEnd(11)} ${String(arr.length).padStart(3)} مدخل` + (n ? `  ← ${n} ایراد` : '  ✓'));
}

/* ── ۶. بقیهٔ بانک‌ها: ارجاع‌های شکسته ──────────────────────────── */
head('ارجاع‌های شکسته و فیلدهای خالی');
for(const [id, t] of Object.entries(DATA.TOPICS_DEF || {})){
  if(!t.bank) bad('TOPICS_DEF.' + id, 'bank ندارد');
  else if(!Array.isArray(DATA[t.bank])) bad('TOPICS_DEF.' + id, `بانکِ «${t.bank}» نیست`);
  else if(!DATA[t.bank].length) bad('TOPICS_DEF.' + id, `بانکِ «${t.bank}» خالی است`);
  if(!t.name) bad('TOPICS_DEF.' + id, 'نام خالی');
  if(!t.icon) warn('TOPICS_DEF.' + id, 'آیکن ندارد');
}
for(const [id, g] of Object.entries(DATA.GAMES || {})){
  if(g.bank && !Array.isArray(DATA[g.bank])) bad('GAMES.' + id, `بانکِ «${g.bank}» نیست`);
  if(!g.name) bad('GAMES.' + id, 'نام خالی');
}
for(const [id, c] of Object.entries(DATA.categories || {}))
  if(!Array.isArray(c.games) || !c.games.length) bad('categories.' + id, 'بی بازی');
for(const [k, v] of Object.entries(DATA)){
  if(!Array.isArray(v) || !v.length) continue;
  const empt = v.filter(x => x && typeof x === 'object' && Object.values(x).some(y => y === ''));
  if(empt.length) warn(k, `${empt.length} مدخل رشتهٔ خالی دارد`);
}

/* ── ۷. بهداشتِ متنِ نمایشی ─────────────────────────────────────── */
head('بهداشتِ متنِ نمایشی');
/* کشیده (ـ) در متنِ اسکرپ‌شده اثرِ «تراز کردن» است، نه املا. در عربیِ
   درست جایی ندارد و در دکمه‌های بازی بد دیده می‌شود. سنجشِ تطبیق بی‌اثر
   است چون U.norm آن را دور می‌ریزد — پس فقط زشتیِ نمایش است. */
const KASHIDA = /ـ/;
const DIRTY = [
  [/�/, 'کاراکتر جانشین U+FFFD'],
  [/[​‎‏‪-‮]/, 'کاراکتر جهت‌دهی/صفرعرض'],
  [/<[a-z/][^>]*>/i, 'تگ HTML'],
  [/&(?:nbsp|amp|lt|gt|quot|#\d+);/, 'راه‌گزیرِ HTML'],
  [/\s{2,}/, 'دو فاصلهٔ پشت‌سرهم'],
  [/^\s|\s$/, 'فاصلهٔ ابتدا/انتها'],
  [/\n\s/, 'خطِ تازه با فاصله']
];
const hits = {};
for(const [bank, arr] of Object.entries(DATA)){
  if(!Array.isArray(arr) || !arr.length || typeof arr[0] !== 'object') continue;
  arr.forEach((x, i) => {
    if(!x || typeof x !== 'object') return;
    for(const [f, v] of Object.entries(x)){
      const vals = Array.isArray(v) ? v : [v];
      vals.forEach((s, k) => {
        if(typeof s !== 'string') return;
        const where = `${bank}#${i}.${f}${Array.isArray(v) ? '[' + k + ']' : ''}`;
        for(const [re, label] of DIRTY)
          if(re.test(s)){ (hits[label] = hits[label] || []).push(where + ' → ' + cut(s, 46)); break; }
        /* کشیده در *متنِ آیه* عیب نیست: رسمِ عثمانیِ معتبر خودش
           U+0640 دارد («يَـُٔودُهُۥ» در ۲:۲۵۵). فقط جایی زشت است که
           متنِ اسکرپ‌شده برای تراز کردن کشیده‌اش کرده باشد. */
        if(KASHIDA.test(s) && !(bank === 'surah' && /^(before|ans|after)$/.test(f)))
          (hits['کشیده (ـ)'] = hits['کشیده (ـ)'] || []).push(where + ' → ' + cut(s, 46));
      });
    }
  });
}
for(const [label, list] of Object.entries(hits)){
  console.log(`\n  ▸ ${label}: ${list.length} مورد`);
  for(const l of list.slice(0, 6)) console.log('      ' + l);
  if(list.length > 6) console.log(`      … و ${list.length - 6} مورد دیگر`);
}

/* ── ۸. پوششِ متنِ کاملِ ادعیه (نسخهٔ ۲۱) ─────────────────────────
   DUA_FULL بیرونِ DATA زندگی می‌کند (بانک قفل است، چون بازیِ «نجوا»
   روی همان متنِ کوتاه سوار است) ولی هر مدخلش با کلیدِ `for` به یکی از
   عنوان‌های DATA.duas گره خورده. این‌جا همان گره سنجیده می‌شود: به‌ازای
   هر دعای بانک دقیقاً یک مدخل، با متنِ کامل و منبعِ کامل. */
head('پوششِ متنِ کاملِ ادعیه');
{
  const atF = html.indexOf('\nconst DUA_FULL = [');
  const endF = atF < 0 ? -1 : html.indexOf('\n];', atF);
  if(atF < 0 || endF < 0){ bad('DUA_FULL', 'پوشش در منبعِ منتشرشده پیدا نشد'); }
  else {
    const FULL = eval('(' + html.slice(atF + '\nconst DUA_FULL = '.length, endF + 2) + ')');
    let n = 0;
    const bank = DATA.duas || [];
    if(FULL.length !== bank.length){ bad('DUA_FULL', `شمارِ مدخل‌ها ${FULL.length} است ولی بانک ${bank.length} دعا دارد`); n++; }
    FULL.forEach((x, i) => {
      const w = 'full#' + i;
      for(const f of ['for', 'ar', 'fa', 'src'])
        if(!String(x[f] || '').trim()){ bad(w, f + ' خالی'); n++; }
      const m = bank.filter(b => norm(b.title || '').includes(norm(x.for || '')));
      if(m.length !== 1){ bad(w, `کلیدِ ${cut(x.for, 30)} به ${m.length} عنوان می‌خورد (باید ۱ باشد)`); n++; }
      for(const f of ['for', 'ar', 'fa', 'src']){
        const v = x[f];
        if(typeof v !== 'string') continue;
        for(const [re, label] of DIRTY)
          if(re.test(v)){ bad(w + '.' + f, label + ': ' + cut(v, 40)); n++; break; }
        if(KASHIDA.test(v)){ bad(w + '.' + f, 'کشیده (ـ): ' + cut(v, 40)); n++; }
      }
    });
    console.log(`  dua-full    ${String(FULL.length).padStart(3)} مدخل` + (n ? `  ← ${n} ایراد` : '  ✓'));
  }
}


/* ── ۹. لایهٔ محتوا (NoorContent) — نسخهٔ ۲۳ب ─────────────────────
   از این نسخه، همهٔ «دادهٔ عبادی» برنامه (ذکر، مجموعهٔ تسبیح، مرحلهٔ
   نماز، دعا) در یک ماژول است: `assets/app/content-1.js`. این بخش همان
   ماژول را جدا بار می‌کند و سه کار می‌کند:

     ۱) **ساختار**: اعتبارسنجیِ هر رکورد، شناسهٔ تکراری، فاز/والدِ
        گم‌شده، `order` تکراری، متنِ عربیِ بی‌منبع، و `verified:true`
        بی‌منبعِ تأیید.
     ۲) **مغایرتِ کد/داده**: اگر متنِ عبادی در لایهٔ نمایش hard-code شده
        باشد (یعنی جایی متن نشان داده می‌شود که رکوردش در داده نیست)
        ایرادِ ساختاری است.
     ۳) **وضعیتِ محتوا**: چند رکورد تأییدشده، چندتا در انتظارِ منبعِ
        معتبر، و دقیقاً کدام فیلدِ کدام رکورد خالی است. این‌ها *ایراد*
        نیستند — «اطلاعیه»اند، چون پرکردنشان فقط با ورودیِ صاحبِ برنامه
        ممکن است و این ابزار هیچ ادعای دینی‌ای را درست یا غلط نمی‌داند.

   بانکِ `DATA.duas` قفل است (بازیِ «نجوا»)؛ این‌جا فقط *خوانده* می‌شود و
   با `adoptDuas()` — همان پلی که در `dua-full-1.js` هنگامِ بار شدنِ
   برنامه اجرا می‌شود — به رکوردهای `type:'dua'` نگاشت می‌شود.
   خروجیِ ماشینی: `node _content-audit.js --json` ⇒ `tmp/content-report.json`. */
head('لایهٔ محتوا (NoorContent)');
let CONTENT_REPORT = null;
{
  const NCsrc = fs.readFileSync(path.join(__dirname, 'assets/app/content-1.js'), 'utf8');
  const NC = new Function(NCsrc + '; return NoorContent;')();
  const atF = html.indexOf('\nconst DUA_FULL = [');
  const endF = atF < 0 ? -1 : html.indexOf('\n];', atF);
  const FULL = (atF >= 0 && endF >= 0)
    ? eval('(' + html.slice(atF + '\nconst DUA_FULL = '.length, endF + 2) + ')') : [];
  const adopted = NC.adoptDuas(DATA.duas || [], FULL);
  const S = NC.pendingSummary();
  let n = 0;

  /* ۹.۱ — ساختار */
  const ids = NC.all().map(x => x.id);
  const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
  if(dupIds.length){ bad('content', 'شناسهٔ تکراری: ' + dupIds.join(',')); n++; }
  NC.all().forEach(r => {
    const w = 'content:' + r.id;
    const problems = NC.validate(r);
    if(problems.length){ bad(w, 'اعتبارسنجی: ' + problems.join('؛ ')); n++; }
    if(typeof r.arabicText === 'string' && !r.arabicText.trim()){
      bad(w, 'arabicText رشتهٔ تهی است — «نمی‌دانم» باید null باشد'); n++; }
    if(r.arabicText && !String(r.source || '').trim()){
      bad(w, 'متنِ عربی دارد ولی source ندارد'); n++; }
    if(r.verified && !/(صاحبِ برنامه|ورودیِ تأییدشده)/.test(String(r.source || ''))){
      bad(w, 'verified:true ولی منبعش ورودیِ تأییدشدهٔ صاحبِ برنامه نیست'); n++; }
    if(r.type === 'dhikr-set' && (!Array.isArray(r.phases) || !r.phases.length)){
      bad(w, 'مجموعهٔ ذکر بدونِ فاز'); n++; }
    if(r.type === 'dhikr-set' && (r.phases || []).some(id => !NC.item(id))){
      bad(w, 'فازِ گم‌شده: ' + (r.phases || []).filter(id => !NC.item(id)).join(',')); n++; }
    if(r.parent && !NC.item(r.parent)){ bad(w, 'والدِ گم‌شده: ' + r.parent); n++; }
    if(r.parent && NC.item(r.parent) && NC.item(r.parent).type !== 'dhikr-set'){
      bad(w, 'والدش مجموعهٔ ذکر نیست'); n++; }
    if(Array.isArray(r.phases) && r.phases.some(id => NC.item(id) && NC.item(id).parent !== r.id)){
      bad(w, 'فازی که `parent`ش به این مجموعه برنمی‌گردد'); n++; }
  });
  /* ترتیبِ تکراری = دو رکورد در یک جای فهرست می‌نشینند */
  const seenOrder = {};
  NC.all().forEach(r => {
    const k = r.type + '|' + (r.parent || r.category || '');
    const key = k + '#' + r.order;
    if(seenOrder[key]) { bad('content:' + r.id, `order=${r.order} با ${seenOrder[key]} تکراری است`); n++; }
    else seenOrder[key] = r.id;
  });
  /* ترتیبِ فازها باید با `order`ِ خودِ فازها یکی باشد (منبعِ حقیقتِ دوم نه) */
  NC.byType('dhikr-set').forEach(set => {
    const sorted = NC.phases(set.id).map(x => x.id);
    if(set.phases.join(',') !== sorted.join(',')){
      bad('content:' + set.id, 'ترتیبِ `phases` با `order`ِ فازها یکی نیست: ' +
          set.phases.join(',') + ' ≠ ' + sorted.join(',')); n++; }
  });

  /* ۹.۲ — هم‌پوشانیِ متن‌ها: کشفِ سیستماتیکِ اختلافِ قدیم/تازه
     دو رکورد با متنِ *یکی* یا متنِ «این پارهٔ آن» — برای بازبینیِ انسانی.
     ایرادِ ساختاری نیست (ممکن است کاملاً درست باشد: «الله‌اکبرِ» تکبیر و
     «الله‌اکبرِ» تسبیحات یکی‌اند)، پس «اطلاعیه» می‌شود. */
  const withText = NC.all().filter(r => typeof r.arabicText === 'string' && r.arabicText.trim());
  const byKey = {};
  withText.forEach(r => { const k = NC.bareKey(r.arabicText); (byKey[k] = byKey[k] || []).push(r); });
  const overlaps = [];
  Object.keys(byKey).forEach(k => {
    if(byKey[k].length > 1)
      overlaps.push({ kind:'هم‌متن', ids:byKey[k].map(r => r.id), text:cut(byKey[k][0].arabicText, 46) });
  });
  withText.forEach(a => withText.forEach(b => {
    if(a.id >= b.id) return;
    const ka = NC.bareKey(a.arabicText), kb = NC.bareKey(b.arabicText);
    if(ka === kb || ka.length < 8 || kb.length < 8) return;
    if(ka.includes(kb) || kb.includes(ka))
      overlaps.push({ kind:'پارهٔ هم', ids:[a.id, b.id],
                      text:cut(ka.length < kb.length ? a.arabicText : b.arabicText, 46) });
  }));
  overlaps.forEach(o => note('content:' + o.ids.join(' + '), `${o.kind}: ${o.text} — باید تأیید شود که تکراری/مغایر نیست`));

  /* ۹.۳ — مغایرتِ کد/داده: متنِ عبادیِ hard-code در لایهٔ نمایش */
  const AR = /[\u0670\u0625\u0624\u0643\u064A]/;   /* نشانهٔ عربی: ی/کِ عربی، الفِ مقصوره، همزهٔ واو */
  const DISPLAY = ['sajjada-1.js', 'wird-1.js', 'm3-1.js', 'salah-1.js', 'courtyard-1.js'];
  const known = new Set();
  NC.all().forEach(r => [r.title, r.shortTitle, r.arabicText, r.translationFa, r.notes]
    .forEach(v => { if(v) known.add(NC.norm(v)); }));
  FULL.forEach(f => [f.for, f.ar, f.fa, f.src].forEach(v => { if(v) known.add(NC.norm(v)); }));
  Object.keys(DATA).forEach(k => { if(Array.isArray(DATA[k])) DATA[k].forEach(o => {
    if(o && typeof o === 'object') Object.keys(o).forEach(f => {
      const v = o[f];
      if(typeof v === 'string') known.add(NC.norm(v));
      if(Array.isArray(v)) v.forEach(y => { if(typeof y === 'string') known.add(NC.norm(y)); });
    }); }); });
  const KN = [...known];
  const literals = file => {
    const src = fs.readFileSync(path.join(__dirname, 'assets/app', file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));   // توضیح‌ها شمرده نمی‌شوند
    const out = [];
    src.split('\n').forEach((line, i) => {
      if(!AR.test(line)) return;
      (line.match(/'[^']*'|"[^"]*"|`[^`]*`/g) || []).forEach(s => {
        const t = s.slice(1, -1);
        if(!AR.test(t)) return;
        const nt = NC.norm(t);
        if(nt.length >= 6 && KN.some(k => k && (k.includes(nt) || nt.includes(k)))) return;  // ارجاع به داده
        out.push(`${file}:${i + 1} ${cut(t, 46)}`);
      });
    });
    return out;
  };
  const stray = DISPLAY.flatMap(literals);
  if(stray.length){ stray.forEach(x => { bad('hardcode', 'متنِ عبادیِ hard-code در لایهٔ نمایش: ' + x); n++; }); }
  const SAJJ = fs.readFileSync(path.join(__dirname, 'assets/app/sajjada-1.js'), 'utf8');
  if(!/NoorContent\.prayerStep\(/.test(SAJJ)){
    bad('sajjada-1.js', 'متنِ مرحله‌های نماز از NoorContent خوانده نمی‌شود'); n++; }
  if(!/presetIds\(\)\.map/.test(SAJJ)){
    bad('sajjada-1.js', 'فهرستِ ذکرشمار از NoorContent ساخته نمی‌شود'); n++; }
  if(!/NoorContent\.countSummary\(|NoorContent\.phases\(/.test(
      fs.readFileSync(path.join(__dirname, 'assets/app/wird-1.js'), 'utf8'))){
    bad('wird-1.js', 'عددهای تسبیحات از NoorContent خوانده نمی‌شود'); n++; }

  /* ۹.۴ — وضعیتِ محتوا (اطلاعیه، نه ایراد) */
  if(adopted.matched + adopted.fragments !== (DATA.duas || []).length){
    bad('adoptDuas', `نگاشتِ دعاها ${(DATA.duas || []).length} را پوشش نداد`); n++; }
  if(adopted.fragments > 0)
    note('adoptDuas', `${adopted.fragments} دعا پوششِ متنِ کامل نداشت ⇒ همان بریدهٔ بانک با fragment:true ثبت شد`);
  if(adopted.sourceDiff > 0)
    note('adoptDuas', `${adopted.sourceDiff} دعا دو منبعِ متفاوت دارد (بانک و پوشش) ⇒ هر دو نگه داشته شدند (source / sourceBank)`);
  S.unresolvedRepeat.forEach(id =>
    note('content:' + id, 'repeatCount در منبع ثبت نشده ⇒ UI «—» و پاورقیِ «ثبت نشده» نشان می‌دهد'));
  NC.pending().filter(p => p.missing.includes('translationFa')).forEach(p =>
    note('content:' + p.id, 'ترجمهٔ فارسی در منبع نیست'));
  NC.pending().filter(p => p.missing.includes('arabicText')).forEach(p =>
    note('content:' + p.id, 'متنِ عربی در منبع نیست'));

  console.log(`\n  ▸ وضعیتِ محتوا: ${S.records} رکورد — ${S.verified} تأییدشده · ${S.verifiedText} با متنِ تأییدشده · ${S.pending} در انتظارِ منبع · ${S.noSource} بی‌منبع · ${S.fragment} بریدهٔ بانک`);
  console.log(`    نوع‌ها: ` + Object.keys(S.counts).map(k => `${k}=${S.counts[k]}`).join(' · '));
  console.log(`    جایِ خالی: ` + (Object.keys(S.pendingByGap).length
    ? Object.keys(S.pendingByGap).map(k => `${k}=${S.pendingByGap[k]}`).join(' · ') : '—'));
  console.log(`\n  ▸ تأییدشده‌ها (فقط با ورودیِ صریحِ صاحبِ برنامه):`);
  NC.all().filter(r => r.verified || r.verifiedText).forEach(r =>
    console.log(`      ${r.id.padEnd(16)} ${cut(r.arabicText || '(بدونِ متن)', 44).padEnd(48)} ${r.verified ? 'verified' : 'verifiedText'}`));
  console.log(`\n  ▸ در انتظارِ منبعِ معتبر (${S.pending}):`);
  NC.pending().forEach(p =>
    console.log(`      ${p.id.padEnd(16)} ${p.type.padEnd(12)} ${('[' + (p.missing.join('+') || 'verified') + ']').padEnd(28)} ${p.title}`));
  console.log(`  content      ${String(S.records).padStart(3)} رکورد` + (n ? `  ← ${n} ایراد` : '  ✓'));

  CONTENT_REPORT = { summary:S, adopted, overlaps:overlaps.length, strayHardcode:stray,
                     verified:NC.all().filter(r => r.verified || r.verifiedText)
                       .map(r => ({ id:r.id, verified:!!r.verified, verifiedText:!!r.verifiedText, source:r.source })),
                     pending:NC.pending() };
}

/* ── گزارشِ ماشینی ──
   `node _content-audit.js --json` ⇒ `tmp/content-report.json`
   (همان چیزی که در گزارشِ این نوبت به شکلِ جدول می‌آید). */
if(process.argv.includes('--json')){
  const REPORT = {
    tool:'_content-audit.js', generatedAt:new Date().toISOString(),
    counts:{ issues, warns, notes },
    content:CONTENT_REPORT,
    flags:FLAGS
  };
  try{
    fs.mkdirSync(path.join(__dirname, 'tmp'), { recursive:true });
    const out = path.join(__dirname, 'tmp', 'content-report.json');
    fs.writeFileSync(out, JSON.stringify(REPORT, null, 2));
    console.log('\n── گزارشِ JSON ──\n  ' + path.relative(__dirname, out));
  }catch(e){ console.log('\n── گزارشِ JSON ──\n  نوشته نشد: ' + e.message); }
}

console.log(`\n── نتیجه ──\n  ${issues} ایراد ساختاری، ${warns} هشدار، ${notes} اطلاعیهٔ محتوایی`);
process.exit(issues ? 1 : 0);
