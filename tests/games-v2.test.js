// نگهبان نسخهٔ ۲ بازی‌ها: بانک حدیث، صفحهٔ نتیجه، کش آفلاین — node tests/games-v2.test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0, warn = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.error('❌ ' + m)); };
const note = m => { warn++; console.warn('⚠️  ' + m); };
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

// همان نرمال‌سازی games/common.js — اگر آن‌جا عوض شد، این‌جا هم عوض شود
const norm = s => String(s).replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه').replace(/[^\u0621-\u064A]/g, '');
const PUNCT = /^[\s.،؛:!؟?«»()\[\]"']+|[\s.،؛:!؟?«»()\[\]"']+$/g;

/* ۱) بانک حدیث: key باید (بی‌اعراب) در متن باشد، گزینهٔ غلط نباید با پاسخ یکی شود */
const ctx = {}; vm.createContext(ctx);
vm.runInContext(read('hadith-bank.js') + '\nthis.HADITH_BANK = HADITH_BANK;', ctx);
const bank = ctx.HADITH_BANK;
ok(Array.isArray(bank) && bank.length > 0, 'HADITH_BANK خالی است');
bank.forEach((h, i) => {
  const tag = `حدیث #${i + 1} (${h.key})`;
  ok(h.ar && h.fa && h.src && h.key, tag + ': ar/fa/src/key لازم است');
  const words = String(h.ar).split(/\s+/);
  const idx = words.findIndex(w => norm(w) === norm(h.key));
  ok(idx >= 0, tag + ': key در متن پیدا نشد');
  ok(Array.isArray(h.wrong) && h.wrong.length >= 3, tag + ': دست‌کم ۳ گزینهٔ غلط لازم است');
  (h.wrong || []).forEach(w => ok(norm(w) !== norm(h.key), tag + ': گزینهٔ غلط «' + w + '» همان پاسخ است'));
  ok(new Set((h.wrong || []).map(norm)).size === (h.wrong || []).length, tag + ': گزینهٔ غلط تکراری');
  // اختلاف اعراب key با متن دیگر بازی را نمی‌شکند (گزینهٔ درست از متن برداشته می‌شود) ولی گزارش می‌شود
  if (idx >= 0 && words[idx].replace(PUNCT, '') !== h.key) note(tag + ': اعراب key با متن یکی نیست → «' + words[idx].replace(PUNCT, '') + '»');
});

/* ۲) اسکریپت‌های درون‌خطی بازی‌ها باید از نظر نحوی سالم باشند */
for (const f of ['games/index.html', 'games/ayah-builder.html', 'games/hadith-rush.html']) {
  const html = read(f);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  ok(scripts.length > 0, f + ': اسکریپتی ندارد');
  scripts.forEach((s, k) => { try { new vm.Script(s); pass++; } catch (e) { ok(false, `${f} اسکریپت ${k + 1}: ${e.message}`); } });
  ok(/<script src="common\.js"><\/script>/.test(html), f + ': common.js را نمی‌خواند');
}
for (const f of ['games/common.js', 'sw.js']) { try { new vm.Script(read(f)); pass++; } catch (e) { ok(false, f + ': ' + e.message); } }

/* ۳) صفحهٔ نتیجهٔ سینمایی در هر دو بازی */
const common = read('games/common.js');
for (const fn of ['result', 'stars', 'report', 'esc']) ok(new RegExp('\\b' + fn + '\\b[,\\s]').test(common.slice(common.lastIndexOf('return {'))), 'G.' + fn + ' صادر نشده');
for (const f of ['games/ayah-builder.html', 'games/hadith-rush.html']) {
  const h = read(f);
  ok(/G\.result\(\{/.test(h), f + ': باید از G.result استفاده کند');
  ok(!/id="end"/.test(h), f + ': پنجرهٔ پایانِ قدیمی باید حذف شده باشد');
}
ok(/\.res-stars/.test(read('games/common.css')), 'سبک صفحهٔ نتیجه در common.css نیست');

/* ۴) سرویس‌ورکر: games/* با کش جدا و همهٔ فایل‌های فهرست‌شده واقعاً وجود دارند */
const sw = read('sw.js');
ok(/const GAMES = 'noorestan-games-\d+'/.test(sw), 'کش GAMES تعریف نشده');
ok(/new Set\(\[[^\]]*GAMES[^\]]*\]\)/.test(sw), 'activate کش GAMES را نگه نمی‌دارد');
const vers = [...sw.matchAll(/'noorestan-(?:[a-z]+-)?(\d+)'/g)].map(m => m[1]);
ok(new Set(vers).size === 1, 'همهٔ کش‌ها باید یک شمارهٔ نسخه داشته باشند: ' + vers.join(','));
const list = (sw.match(/const GAME_FILES = \[([\s\S]*?)\];/) || [, ''])[1];
for (const m of list.matchAll(/'\.\/([^']*)'/g)) {
  const p = m[1] || '.';
  ok(p.endsWith('/') || fs.existsSync(path.join(root, p)), 'sw.js فایلی را پیش‌ذخیره می‌کند که نیست: ' + p);
}
ok(sw.indexOf('/\\/games\\//') < sw.indexOf("req.mode === 'navigate'"), 'شاخهٔ بازی‌ها باید پیش از navigate بیاید');

console.log(`games-v2: ${pass} ✓  ${fail} ✗  ${warn} ⚠️`);
process.exit(fail ? 1 : 0);
