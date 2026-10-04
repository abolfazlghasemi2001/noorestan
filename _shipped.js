/* ─────────────────────────────────────────────────────────────
   نورستان — «منبعِ منتشرشده» برای سنجش‌های متنی
   ─────────────────────────────────────────────────────────────
   چرا این فایل وجود دارد؟

   تا پیش از `tools/split-index.js`، کل برنامه در خودِ `index.html`
   بود: HTML و CSS و JS در یک فایل. برای همین سنجش‌های متنیِ
   `_tests.js` فقط `index.html` را می‌خواندند و همه‌چیز را می‌دیدند.

   پس از شکستنِ سند، `index.html` فقط یک پوسته است و کد و استایل به
   `assets/app/*` رفته‌اند. نتیجه: همان سنجش‌ها روی یک فایلِ تقریباً
   خالی اجرا می‌شدند — یعنی یا بی‌دلیل رد می‌شدند (چون چیزی را که
   می‌گشتند آن‌جا نبود) یا با `.match(...)[1]` روی نال فرو‌می‌ریختند
   و کل هارنس نیمه‌کاره می‌مرد.

   این ماژول همان قراردادِ قدیمی را نگه می‌دارد: «منبعِ برنامه»،
   یعنی سند به‌علاوهٔ هرچه واقعاً به مرورگر می‌رود — اسکریپت‌های
   پیوند‌شده (و `@import`ِ استایل‌ها، برای همان دلیل). ترتیبِ
   الحاق عمداً با ترتیبِ سند است: سند اول، بعد منابعِ پیوند‌شده،
   بعد اسکریپت‌های درون‌خطی. سنجش‌هایی که با `slice` روی نشانیِ
   یک شناسه کار می‌کنند به همین ترتیب وابسته‌اند.

   ابزار توسعه است؛ برنامه در مرورگر به آن نیاز ندارد.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const isRemote = u => /^(https?:)?\/\//i.test(u) || /^data:/i.test(u);

function readIfLocal(ref) {
  if (!ref || isRemote(ref)) return '';
  const file = path.join(ROOT, ref.replace(/[?#].*$/, ''));
  try { return fs.readFileSync(file, 'utf8'); }
  catch (e) { return ''; }
}

/* نشانی‌های نسبیِ `url()` را به نسبتِ ریشهٔ پروژه برمی‌گرداند.
   چرا: `tools/split-index.js` هنگام بیرون کشیدنِ CSS به `assets/app/`
   هر نشانی را با `../../` پیشوند می‌زند تا از جای تازهٔ فایل درست باشد.
   اما سنجش‌ها می‌خواهند بدانند «این قلم روی دیسک هست یا نه» و با
   `__dirname + '/' + نشانی` آن را می‌جویند — با آن پیشوند، نشانی از
   ریشهٔ پروژه بیرون می‌زند و فایلِ موجود «نیست» دیده می‌شد. در نمایِ
   سنجش، نشانی‌ها به ریشه نسبت داده می‌شوند؛ خودِ فایلِ منتشرشده
   دست‌نخورده می‌ماند. */
function rootRelativeUrls(css, cssPath) {
  const dir = path.posix.dirname(cssPath.split(path.sep).join('/'));
  return css.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/gi, (all, url) => {
    const u = url.trim();
    if (isRemote(u) || u.startsWith('/')) return all;
    return all.replace(u, path.posix.normalize(path.posix.join(dir, u)));
  });
}

/* `@import` را دنبال می‌کند: motion.css این‌گونه به sanctuary.css
   می‌رسد و بی آن، توکن‌های حرکت در منبعِ سنجش دیده نمی‌شدند. */
function withImports(css, seen) {
  return css.replace(/@import\s+url\(\s*["']?([^"')]+)["']?\s*\)[^;]*;/gi, (all, ref) => {
    if (isRemote(ref)) return all;
    const key = path.normalize(ref);
    if (seen.has(key)) return '';
    seen.add(key);
    return withImports(readIfLocal(ref), seen);
  });
}

/** نشانیِ منابعِ متن‌بازِ برنامه، به ترتیبِ سند. */
function manifest() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [], styles = [], inline = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi))
    scripts.push(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)) {
    const href = (m[0].match(/\bhref=["']([^"']+)["']/i) || [])[1];
    if (href) styles.push(href);
  }
  for (const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))
    if (m[1] && m[1].trim()) inline.push(m[1]);
  return { html, scripts, styles, inline };
}

const joinAll = parts => parts.filter(Boolean).join('\n');

function collect() {
  const m = manifest();
  return joinAll([
    m.html,
    ...m.scripts.map(readIfLocal),
    ...m.styles.map(ref => withImports(readIfLocal(ref), new Set())),
    ...m.inline,
  ]);
}

/** فقط سند — برای سنجش‌هایی که دربارهٔ خودِ HTML‌اند. */
function collectDocument() { return manifest().html; }

/** فقط استایل‌ها، با `@import` درونی‌شده و نشانی‌ها نسبت به ریشه. */
function collectCss() {
  return manifest().styles
    .map(ref => rootRelativeUrls(withImports(readIfLocal(ref), new Set()), ref))
    .join('\n');
}

/** فقط کد — اسکریپت‌های پیوند‌شده و درون‌خطی. */
function collectJs() {
  const m = manifest();
  return joinAll([...m.scripts.map(readIfLocal), ...m.inline]);
}

let cache = null, cssCache = null, jsCache = null, docCache = null;
module.exports = {
  /** کل منبعِ منتشرشده (سند + اسکریپت‌ها + استایل‌ها)، کش‌شده. */
  source() { return cache === null ? (cache = collect()) : cache; },
  /** فقط استایلِ منتشرشده. */
  css() { return cssCache === null ? (cssCache = collectCss()) : cssCache; },
  /** فقط کدِ منتشرشده. */
  js() { return jsCache === null ? (jsCache = collectJs()) : jsCache; },
  /** فقط `index.html`. */
  document() { return docCache === null ? (docCache = collectDocument()) : docCache; },
  /** خواندنِ یک فایلِ پروژه با مسیر نسبی به ریشه. */
  file(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); },
  collect,
};
