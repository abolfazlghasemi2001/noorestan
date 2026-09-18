/* یک‌بارمصرف و قابل‌تکرار: بانک حدیث را داخل DATA در index.html می‌نشاند.
   متن عربی از فایل منبع کپی می‌شود و هرگز بازتایپ نمی‌گردد. */
const fs = require('fs');

const src = fs.readFileSync('hadith-bank.js', 'utf8');
const BANK = eval(src.replace(/if \(typeof DATA[\s\S]*$/, '') + '\nHADITH_BANK');
if (!Array.isArray(BANK) || !BANK.length) { console.log('بانک خوانده نشد'); process.exit(1); }

/* بازبینی پیش از نشاندن — همان شرط‌هایی که selfTest می‌سنجد */
const bad = BANK.filter(h =>
  !h.ar || !h.key || !Array.isArray(h.wrong) || h.wrong.length !== 3 ||
  !h.fa || !h.src || !h.why || !h.topic);
if (bad.length) { console.log('❌ ' + bad.length + ' حدیث ناقص — نمی‌نشانم'); process.exit(1); }
const dup = BANK.length - new Set(BANK.map(h => h.ar)).size;
if (dup) { console.log('❌ ' + dup + ' متن تکراری — نمی‌نشانم'); process.exit(1); }

const HTML = 'index.html';
let html = fs.readFileSync(HTML, 'utf8');

const START = '  /* ── بانک حدیث (نسخهٔ ۱۵) ── */';
const END = '  /* ── پایان بانک حدیث ── */';
if (html.includes(START)) {
  const a = html.indexOf(START), b = html.indexOf(END, a);
  if (b < 0) { console.log('بلوک قبلی ناتمام'); process.exit(1); }
  html = html.slice(0, a) + html.slice(b + END.length + 1);
}

const body = START + '\n  hadith: ' +
  JSON.stringify(BANK, null, 2).split('\n').join('\n  ') + ',\n' + END;

const anchor = '  /* ── پایان بانک تأییدشده ── */\n};';
if (!html.includes(anchor)) { console.log('جای درج پیدا نشد'); process.exit(1); }
html = html.replace(anchor, '  /* ── پایان بانک تأییدشده ── */\n' + body + '\n};');

fs.writeFileSync(HTML, html);
console.log('✅ نشانده شد: ' + BANK.length + ' حدیث');
