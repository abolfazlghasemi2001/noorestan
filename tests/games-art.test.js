// نگهبان تصویرسازی کارت‌های بازی و توکن‌های طراحی — node tests/games-art.test.js
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.error('❌ ' + m)); };
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const hub = read('games/index.html');
const arts = [...hub.matchAll(/src="(art\/[^"]+\.svg)"/g)].map(m => 'games/' + m[1]);
ok(arts.length >= 2, 'هاب بازی‌ها باید برای هر بازی تصویر SVG داشته باشد');
const ids = new Set();
for (const a of arts) {
  ok(fs.existsSync(path.join(root, a)), a + ' وجود ندارد');
  if (!fs.existsSync(path.join(root, a))) continue;
  const s = read(a);
  ok(/^<svg[^>]+viewBox="0 0 120 120"/.test(s), a + ': viewBox باید 0 0 120 120 باشد');
  ok(!/<script|on\w+=|javascript:|<foreignObject/i.test(s), a + ': اسکریپت/رویداد در SVG ممنوع');
  ok(!/https?:\/\/(?!www\.w3\.org)/.test(s), a + ': SVG نباید منبع بیرونی بخواند (آفلاین)');
  ok(/aria-label="[^"]+"/.test(s), a + ': aria-label لازم است');
  ok(Buffer.byteLength(s) < 8 * 1024, a + ': بزرگ‌تر از ۸KB');
  // شناسه‌ها باید یکتا باشند تا اگر SVG درون‌خطی شد، گرادیان‌ها با هم قاطی نشوند
  for (const m of s.matchAll(/id="([^"]+)"/g)) { ok(!ids.has(m[1]), 'شناسهٔ تکراری ' + m[1]); ids.add(m[1]); }
}

const tok = read('games/tokens.css');
for (const v of ['--bg', '--gold', '--grad', '--sp-4', '--r-lg', '--sh-2', '--ease', '--dur-2', '--f-ui'])
  ok(new RegExp(v + ':').test(tok), 'توکن ' + v + ' در tokens.css نیست');
const css = read('games/common.css');
ok(/@import url\('tokens\.css'\)/.test(css), 'common.css باید tokens.css را بخواند');
ok(!/:root\s*\{/.test(css), 'common.css نباید :root جداگانه داشته باشد (منبع واحد = tokens.css)');

console.log(`games-art: ${pass} ✓  ${fail} ✗`);
process.exit(fail ? 1 : 0);
