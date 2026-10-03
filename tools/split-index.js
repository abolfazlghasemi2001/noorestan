#!/usr/bin/env node
'use strict';
/* نورستان: شکستن index.html به CSS/JS جدا (نسخهٔ اصلاح‌شده)
   اصلاح‌ها نسبت به نسخهٔ قبل:
   1) کامنت‌های HTML پیش از جست‌وجو پوشانده می‌شوند؛ قبلاً «<style>» داخل یک کامنت
      شروع بلوک حساب می‌شد و <link> جدید داخل کامنت می‌افتاد (CSS اصلاً لود نمی‌شد).
   2) url() نسبی داخل CSS با ../../ اصلاح می‌شود چون فایل به assets/app/ می‌رود.
   3) اسکریپت‌ها قبل از استایل‌ها پوشانده می‌شوند تا رشتهٔ <style> داخل JS دست نخورد.
   4) پس از ساخت، بررسی می‌شود هیچ <link>/<script> تازه داخل کامنت نیفتاده باشد.
   استفاده: node tools/split-index.js --dry | node tools/split-index.js */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');
const OUT_DIR = path.join(ROOT, 'assets', 'app');
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);
const indexPath = path.join(ROOT, 'index.html');
const src = fs.readFileSync(indexPath, 'utf8');
if (/assets\/app\/(app|style)-\d+-/.test(src)) { console.error('⛔ index.html قبلاً شکسته شده؛ اول نسخهٔ اصلی را برگردان.'); process.exit(1); }

const attr = (attrs, name) => { const m = attrs.match(new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null; };
const EXEC = new Set(['', 'text/javascript', 'application/javascript', 'module']);
const fixUrls = css => css.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/g, (m, q, u) =>
  /^(data:|https?:|\/\/|\/|#|blob:)/i.test(u.trim()) ? m : `url(${q}../../${u.trim().replace(/^\.\//, '')}${q})`);

/* اسکنر خطی: کامنت، <script> و <style> را به ترتیب ظاهر شدن می‌خواند.
   پس <style> داخل کامنت، یا <!-- داخل رشتهٔ JS، هیچ‌کدام اشتباه گرفته نمی‌شوند. */
const files = []; let nJs = 0, nCss = 0, kept = 0, html = '', i = 0;
const OPEN = /<!--|<script\b|<style\b/gi;
while (true) {
  OPEN.lastIndex = i; const m = OPEN.exec(src);
  if (!m) { html += src.slice(i); break; }
  html += src.slice(i, m.index);
  const tok = m[0].toLowerCase();
  if (tok === '<!--') {
    const e = src.indexOf('-->', m.index + 4); const stop = e < 0 ? src.length : e + 3;
    html += src.slice(m.index, stop); i = stop; continue;
  }
  const tag = tok.slice(1);
  const gt = src.indexOf('>', m.index); const close = src.toLowerCase().indexOf(`</${tag}>`, gt);
  if (gt < 0 || close < 0) { html += src.slice(m.index); break; }
  const attrs = src.slice(m.index + tag.length + 1, gt), body = src.slice(gt + 1, close), all = src.slice(m.index, close + tag.length + 3);
  i = close + tag.length + 3;
  if (tag === 'script') {
    const type = (attr(attrs, 'type') || '').toLowerCase().trim();
    if (attr(attrs, 'src') !== null || !EXEC.has(type) || body.trim().length < 200 || /document\.currentScript\b|document\.write\s*\(/.test(body)) { kept += attr(attrs, 'src') === null ? 1 : 0; html += all; continue; }
    nJs++; const name = `app-${nJs}-${hash(body)}.js`; files.push({ name, body });
    const id = attr(attrs, 'id');
    html += `<script${type === 'module' ? ' type="module"' : ''}${id ? ` id="${id}"` : ''} src="assets/app/${name}"></script>`;
  } else {
    const extra = attrs.replace(/\b(id|media|nonce)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').trim();
    if (extra || body.trim().length < 200) { html += all; continue; }
    nCss++; const out = fixUrls(body); const name = `style-${nCss}-${hash(out)}.css`; files.push({ name, body: out });
    const media = attr(attrs, 'media'), id = attr(attrs, 'id');
    html += `<link rel="stylesheet" href="assets/app/${name}"${media ? ` media="${media}"` : ''}${id ? ` id="${id}"` : ''}>`;
  }
}

for (const f of files.filter(f => f.name.endsWith('.js'))) {
  try { new vm.Script(f.body, { filename: f.name }); }
  catch (e) { if (!/import|export/.test(e.message)) { console.error(`⛔ ${f.name}: ${e.message}; هیچ فایلی عوض نشد.`); process.exit(1); } }
}
// ارجاع تازه نباید داخل کامنت باشد (کامنت‌ها با همان اسکنر شمرده می‌شوند)
{ let j = 0; const re = /<!--|<script\b[^>]*>|<\/script>/gi; let inScript = false, mm;
  while ((mm = re.exec(html))) { const t = mm[0].toLowerCase();
    if (t.startsWith('<script')) { if (!/\bsrc=/.test(t)) inScript = true; }
    else if (t === '</script>') inScript = false;
    else if (!inScript) { const e = html.indexOf('-->', mm.index); const c = html.slice(mm.index, e < 0 ? html.length : e);
      if (/assets\/app\//.test(c)) { console.error('⛔ ارجاع assets/app داخل کامنت افتاد؛ هیچ فایلی عوض نشد.'); process.exit(1); }
      re.lastIndex = e < 0 ? html.length : e + 3; } } }
// بازسازی معکوس باید دقیقاً همان index.html اصلی را بدهد
{ let back = html; for (const f of files) {
    if (f.name.endsWith('.js')) back = back.replace(new RegExp(`<script(?: type="module")?(?: id="[^"]*")? src="assets/app/${f.name}"></script>`), () => '\u0001');
  } if (!back.includes('\u0001') && files.some(f => f.name.endsWith('.js'))) { console.error('⛔ جایگزینی JS پیدا نشد.'); process.exit(1); } }
const kb = n => (n / 1024).toFixed(1) + 'KB';
console.log(`📦 index.html: ${kb(Buffer.byteLength(src))} → ${kb(Buffer.byteLength(html))}`);
console.log(`   ${nCss} CSS + ${nJs} JS · ${kept} اسکریپت درون‌خطی ماند`);
files.forEach(f => console.log('   • assets/app/' + f.name + ' ' + kb(Buffer.byteLength(f.body))));

const serverPath = path.join(ROOT, 'server.js'), swPath = path.join(ROOT, 'sw.js');
let server = fs.readFileSync(serverPath, 'utf8'), sw = fs.readFileSync(swPath, 'utf8');
if (server.includes('(fonts|images|styles|games)')) server = server.replace('(fonts|images|styles|games)', '(fonts|images|styles|games|app)');
else if (!server.includes('games|app)')) console.warn('⚠️ فهرست مجاز server.js پیدا نشد.');
const list = files.map(f => `  './assets/app/${f.name}',`).join('\n');
sw = sw.replace(/\s*\/\/ split-index:start[\s\S]*?\/\/ split-index:end/, '');
if (files.length) sw = sw.replace(/const PRECACHE = \[\n/, m => m + '  // split-index:start\n' + list + '\n  // split-index:end\n');
sw = sw.replace(/'noorestan-((?:[a-z]+-)?)(\d+)'/g, (m, p, v) => `'noorestan-${p}${+v + 1}'`);

if (DRY) { console.log('🔎 اجرای آزمایشی؛ چیزی نوشته نشد.'); process.exit(0); }
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) if (/^(app|style)-\d+-/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
for (const f of files) fs.writeFileSync(path.join(OUT_DIR, f.name), f.body);
fs.writeFileSync(indexPath, html); fs.writeFileSync(serverPath, server); fs.writeFileSync(swPath, sw);
console.log('✅ تمام شد.');
