/* ═══════════════════════════════════════════════════════════════════
   _laqab.js — استخراج القاب چهارده معصوم از ویکی‌شیعه (یک‌بارمصرف)

   چرا اسکریپت و نه دست‌نویس؟ چون نوشتنِ لقب‌ها از حافظه دقیقاً همان کاری
   است که نباید کرد. هر لقبی که در DATA.imams می‌نشیند از این‌جا آمده و
   `src`ش همان صفحهٔ ویکی‌شیعه است.

   اجرا:  node _laqab.js           → گزارش خوانا
          node _laqab.js --json    → JSON برای چسباندن در index.html
   ═══════════════════════════════════════════════════════════════════ */
const API = 'https://fa.wikishia.net/w/api.php';
const UA = 'Noorestan/17 (offline PWA; one-off content fetch)';

/* نامِ هر معصوم در برنامه → عنوانِ جست‌وجو در ویکی‌شیعه */
const WANT = [
  { n: 1,  name: 'محمد بن عبدالله (ص)', q: 'محمد بن عبدالله (ص)' },
  { n: 2,  name: 'فاطمه بنت محمد (س)',  q: 'فاطمه زهرا' },
  { n: 3,  name: 'علی بن ابی‌طالب (ع)', q: 'علی بن ابی‌طالب (ع)' },
  { n: 4,  name: 'حسن بن علی (ع)',      q: 'حسن بن علی (ع)' },
  { n: 5,  name: 'حسین بن علی (ع)',     q: 'حسین بن علی (ع)' },
  { n: 6,  name: 'علی بن حسین (ع)',     q: 'علی بن حسین (ع)' },
  { n: 7,  name: 'محمد بن علی (ع)',     q: 'محمد بن علی (ع)' },
  { n: 8,  name: 'جعفر بن محمد (ع)',    q: 'جعفر بن محمد (ع)' },
  { n: 9,  name: 'موسی بن جعفر (ع)',    q: 'موسی بن جعفر (ع)' },
  { n: 10, name: 'علی بن موسی (ع)',     q: 'علی بن موسی (ع)' },
  { n: 11, name: 'محمد بن علی (ع)',     q: 'محمد بن علی (ع)' },
  { n: 12, name: 'علی بن محمد (ع)',     q: 'علی بن محمد (ع)' },
  { n: 13, name: 'حسن بن علی (ع)',      q: 'حسن بن علی (ع)' },
  { n: 14, name: 'محمد بن حسن (ع)',     q: 'محمد بن حسن (ع)' }
];

/* جست‌وجوی «محمد بن علی (ع)» برای باقر به مقالهٔ کلیِ «چهارده معصوم» و
   برای مهدی به «شیعه» می‌رسد؛ و «حسن بن علی» میان مجتبی و عسکری گم
   می‌شود. این‌ها عنوانِ درست را مستقیم می‌دهند، نه از راهِ جست‌وجو. */
const OVERRIDE = {
  4:  'امام حسن مجتبی علیه‌السلام',
  7:  'امام محمد باقر علیه‌السلام',
  11: 'امام جواد علیه‌السلام',
  13: 'امام حسن عسکری علیه‌السلام',
  14: 'امام مهدی عجل الله تعالی فرجه'
};

const get = (url) => fetch(url, { headers: { 'user-agent': UA } })
  .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });

/* جست‌وجو → بهترین عنوان */
async function resolve(q){
  const u = API + '?action=query&list=search&format=json&srlimit=5&srsearch=' + encodeURIComponent(q);
  const j = await get(u);
  const hits = (j.query && j.query.search) || [];
  return hits.map(h => h.title);
}

/* متنِ صفحه → القابِ جعبهٔ اطلاعات */
async function laqabs(title){
  const u = API + '?action=parse&format=json&prop=text&page=' + encodeURIComponent(title);
  const j = await get(u);
  const html = (j.parse && j.parse.text && j.parse.text['*']) || '';
  /* ردیفِ «لقب» در جعبهٔ اطلاعات. الگو: <th ...>لقب</th><td ...>…</td> */
  const m = html.match(/<th[^>]*>\s*لقب\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/);
  if(!m) return { titles: [], raw: '' };
  /* بعضی لقب‌ها پیوند دارند و بعضی بی‌پیوندند («صامت • هادی • رفیق»). اگر
     فقط پیوندها را می‌خواندیم، نیمی از لقب‌ها بی‌صدا می‌رفتند. پس اول متنِ
     هر پیوند را می‌نشانیم سرِ جایش، بعد تگ‌ها را می‌کنیم. */
  const flat = m[1]
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#160;|&nbsp;/g, ' ');
  const titles = [...new Set(flat.split('•')
    .map(s => s
      .replace(/\[[^\]]*\]/g, '')                 // پانویس [۱]
      .replace(/\((?:لقب|کنیه)\)/g, '')           // توضیحِ داخلِ پرانتز
      .replace(/\s+/g, ' ')
      .trim())
    .filter(s => s && !/^ادامه/.test(s) && !/^[فم]هرست /.test(s)))];
  return { titles, raw: titles.join(' • ') };
}

(async () => {
  const out = [];
  for(const w of WANT){
    const tries = OVERRIDE[w.n] ? [OVERRIDE[w.n], w.q] : [w.q];
    let done = null;
    for(const t of tries){
      try{
        const cands = await resolve(t);
        if(!cands.length) continue;
        const pick = cands[0];
        const r = await laqabs(pick);
        done = { n: w.n, name: w.name, page: pick, candidates: cands, titles: r.titles, raw: r.raw };
        break;
      }catch(e){ done = { n: w.n, name: w.name, error: e.message }; }
    }
    out.push(done || { n: w.n, name: w.name, error: 'پیدا نشد' });
    const d = out[out.length - 1];
    console.error(`  ${String(w.n).padStart(2)} ${w.name}  →  ${d.error ? 'خطا: ' + d.error : d.page + '  (' + d.titles.length + ' لقب)'}`);
  }

  /* ── --patch: نوشتنِ نتیجه در DATA.imams ──────────────────────────
     مهم: لقب‌ها هرگز دست‌نویس نمی‌شوند. این تنها راهِ واردکردنشان است،
     تا هر رشته عیناً همان چیزی باشد که از ویکی‌شیعه آمد. */
  if(process.argv.includes('--patch')){
    const fs = require('fs');
    const FILE = __dirname + '/index.html';
    const html = fs.readFileSync(FILE, 'utf8');
    const open = html.indexOf('\n  imams: [');
    if(open < 0) throw new Error('DATA.imams پیدا نشد');
    /* مرزها را با نشانه‌های خودِ فایل می‌گیریم، نه با شمردنِ فاصله */
    const ARR_AT = open + 1 + '  imams: '.length;        // جایی که «[» نشسته
    if(html[ARR_AT] !== '[') throw new Error('ابتدای آرایه این‌جا نیست: ' +
      JSON.stringify(html.slice(ARR_AT - 4, ARR_AT + 4)));
    const close = html.indexOf('\n  ],', ARR_AT);
    if(close < 0) throw new Error('پایانِ DATA.imams پیدا نشد');
    const ARR_END = close + 3;                            // جایی که «]» نشسته
    if(html[ARR_END] !== ']') throw new Error('انتهای آرایه این‌جا نیست: ' +
      JSON.stringify(html.slice(close, close + 6)));

    const body = html.slice(ARR_AT, ARR_END + 1);
    const arr = eval(body);  /* eslint-disable-line */
    if(!Array.isArray(arr) || arr.length !== 14)
      throw new Error('آرایهٔ معصومان ۱۴ نبود: ' + (arr && arr.length));

    let added = 0; const missed = [];
    const merged = arr.map((p, i) => {
      const rec = out[i];
      const titles = (rec && rec.titles) || [];
      if(!titles.length){ missed.push(p.name); return p; }
      added++;
      /* لقبِ نام‌آورِ فعلی همیشه اول می‌ماند، یکتا شود */
      const list = [...new Set([p.title, ...titles].filter(Boolean)
        .map(s => s.replace(/\s+/g, ' ').trim())
        .filter(s => s && s !== 'سایر..'))];
      return {
        name: p.name,
        title: p.title,
        titles: list,
        laqabSrc: rec.page ? 'ویکی‌شیعه، «' + rec.page + '»' : null,
        father: p.father,
        mother: p.mother ?? null,
        rank: p.rank,
        shrine: p.shrine ?? null,
        note: p.note
      };
    });

    const json = JSON.stringify(merged, null, 2).split('\n').map((l, k) => k ? '  ' + l : l).join('\n');
    const next = html.slice(0, ARR_AT) + json + html.slice(ARR_END + 1);
    fs.writeFileSync(FILE, next);
    console.log(`✅ ${added}/14 معصوم لقب گرفتند` + (missed.length ? ' — بی‌لقب: ' + missed.join('، ') : ''));
    console.log(`   فایل: ${FILE}`);
    return;
  }

  if(process.argv.includes('--json')){
    console.log(JSON.stringify(out.map(x => ({
      name: x.name,
      src: x.page ? 'ویکی‌شیعه، ' + x.page : null,
      titles: x.titles || []
    })), null, 1));
    return;
  }
  console.log('\n════ گزارش ════');
  for(const x of out){
    console.log('\n' + String(x.n).padStart(2) + '. ' + x.name + (x.page ? '   [' + x.page + ']' : ''));
    if(x.error){ console.log('   ⚠️ ' + x.error); continue; }
    console.log('   ' + (x.titles.join(' • ') || '(خالی)'));
    if(x.candidates && x.candidates.length > 1)
      console.log('   نامزدهای دیگر: ' + x.candidates.slice(1).join(' | '));
  }
})();
