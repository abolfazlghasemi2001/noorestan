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
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');

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

let issues = 0, warns = 0;
const bad = (where, msg) => { issues++; console.log(`  ✗ ${where} — ${msg}`); };
const warn = (where, msg) => { warns++; console.log(`  ⚠ ${where} — ${msg}`); };
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
        if(KASHIDA.test(s)) (hits['کشیده (ـ)'] = hits['کشیده (ـ)'] || []).push(where + ' → ' + cut(s, 46));
      });
    }
  });
}
for(const [label, list] of Object.entries(hits)){
  console.log(`\n  ▸ ${label}: ${list.length} مورد`);
  for(const l of list.slice(0, 6)) console.log('      ' + l);
  if(list.length > 6) console.log(`      … و ${list.length - 6} مورد دیگر`);
}

console.log(`\n── نتیجه ──\n  ${issues} ایراد ساختاری، ${warns} هشدار`);
process.exit(issues ? 1 : 0);
