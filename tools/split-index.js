#!/usr/bin/env node
'use strict';
/* ═══════════════════════════════════════════════════════════════════
   نورستان — شکستنِ index.html به ماژول‌های جدا (بی وابستگی npm)

   چه می‌کند:
   · هر <style> درون‌خطی ⇒ assets/app/style-N-<hash>.css و جایش <link>
   · هر <script> درون‌خطیِ معمولی/ماژول ⇒ assets/app/app-N-<hash>.js و جایش <script src>
     ترتیبِ اجرا عیناً همان می‌ماند (اسکریپتِ کلاسیکِ خارجی هم همگام و به
     ترتیب اجرا می‌شود و همان دامنهٔ سراسری را دارد).
   · <script type="application/json"> و هر نوعِ غیراجرایی دست نمی‌خورد.
   · server.js: پوشهٔ assets/app به فهرستِ مجازِ سرو اضافه می‌شود.
   · sw.js: فایل‌های تازه به پیش‌ذخیره می‌روند و شمارهٔ کش یکی بالا می‌رود.
   · نام فایل‌ها هش دارد؛ پس کشِ یک‌روزهٔ سرور هرگز نسخهٔ کهنه نشان نمی‌دهد.

   استفاده:
     node tools/split-index.js --dry     فقط گزارش، هیچ فایلی عوض نمی‌شود
     node tools/split-index.js           اجرای واقعی
   برگشت: git checkout -- index.html server.js sw.js && rm -rf assets/app
   ═══════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');
const OUT_DIR = path.join(ROOT, 'assets', 'app');
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);

const indexPath = path.join(ROOT, 'index.html');
const src = fs.readFileSync(indexPath, 'utf8');
if (/assets\/app\/app-\d+-/.test(src)) { console.error('⛔ index.html قبلاً شکسته شده است.'); process.exit(1); }

const EXEC_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module']);
const attr = (attrs, name) => { const m = attrs.match(new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null; };

const files = [];
let nJs = 0, nCss = 0, keptJs = 0, bytesOut = 0;

/* <style> — فقط بلوک‌هایی که جز id/media/nonce صفتی ندارند جدا می‌شوند */
let html = src.replace(/<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi, (all, attrs = '', body) => {
  const extra = attrs.replace(/\b(id|media|nonce)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').trim();
  if (extra || body.trim().length < 200) return all;            // بلوک‌های ریز درون‌خطی می‌مانند
  nCss++;
  const name = `style-${nCss}-${hash(body)}.css`;
  files.push({ name, body });
  bytesOut += Buffer.byteLength(body);
  const media = attr(attrs, 'media'), id = attr(attrs, 'id');
  return `<link rel="stylesheet" href="assets/app/${name}"${media ? ` media="${media}"` : ''}${id ? ` id="${id}"` : ''}>`;
});

/* <script> — فقط درون‌خطیِ اجرایی */
html = html.replace(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi, (all, attrs = '', body) => {
  if (attr(attrs, 'src') !== null) return all;
  const type = (attr(attrs, 'type') || '').toLowerCase().trim();
  if (!EXEC_TYPES.has(type) || body.trim().length < 200) { keptJs++; return all; }
  if (/document\.currentScript\b/.test(body) || /document\.write\s*\(/.test(body)) { keptJs++; return all; } // رفتارِ متفاوت در فایل خارجی
  nJs++;
  const name = `app-${nJs}-${hash(body)}.js`;
  files.push({ name, body: body.replace(/^\s*\n/, '') });
  bytesOut += Buffer.byteLength(body);
  const id = attr(attrs, 'id');
  return `<script${type === 'module' ? ' type="module"' : ''}${id ? ` id="${id}"` : ''} src="assets/app/${name}"></script>`;
});

/* نحوِ هر فایلِ JS پیش از نوشتن سنجیده می‌شود */
const vm = require('vm');
for (const f of files.filter(f => f.name.endsWith('.js'))) {
  try { new vm.Script(f.body, { filename: f.name }); }
  catch (e) { if (!/import|export/.test(e.message)) { console.error(`⛔ ${f.name}: ${e.message} — هیچ فایلی عوض نشد.`); process.exit(1); } }
}

const kb = n => (n / 1024).toFixed(1) + 'KB';
console.log(`📦 index.html: ${kb(Buffer.byteLength(src))} ← ${kb(Buffer.byteLength(html))}`);
console.log(`   ${nCss} فایل CSS + ${nJs} فایل JS (${kb(bytesOut)}) · ${keptJs} اسکریپت درون‌خطی ماند`);
files.forEach(f => console.log('   • assets/app/' + f.name + '  ' + kb(Buffer.byteLength(f.body))));

/* server.js و sw.js */
const serverPath = path.join(ROOT, 'server.js'), swPath = path.join(ROOT, 'sw.js');
let server = fs.readFileSync(serverPath, 'utf8'), sw = fs.readFileSync(swPath, 'utf8');
const WL = '(fonts|images|styles|games)';
if (server.includes(WL)) server = server.replace(WL, '(fonts|images|styles|games|app)');
else if (!server.includes('games|app)')) console.warn('⚠️ فهرست مجاز server.js پیدا نشد — assets/app را دستی اضافه کن.');

const list = files.map(f => `  './assets/app/${f.name}',`).join('\n');
if (sw.includes('const PRECACHE = [') && files.length) {
  sw = sw.replace(/(\n\s*\/\/ split-index:start[\s\S]*?\/\/ split-index:end\n)?(const PRECACHE = \[\n)/,
    (m, old, head) => head + '  // split-index:start\n' + list + '\n  // split-index:end\n');
}
sw = sw.replace(/'noorestan-((?:[a-z]+-)?)(\d+)'/g, (m, p, v) => `'noorestan-${p}${+v + 1}'`);

if (DRY) { console.log('🔎 اجرای آزمایشی — چیزی نوشته نشد.'); process.exit(0); }
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of files) fs.writeFileSync(path.join(OUT_DIR, f.name), f.body);
fs.writeFileSync(indexPath, html);
fs.writeFileSync(serverPath, server);
fs.writeFileSync(swPath, sw);
console.log('✅ تمام شد. حالا: node tests/games-v2.test.js && git add -A && git commit -m "split index.html" && git push');
