#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   _browser-check.js — بازبینیِ هندسه و خوانایی در مرورگرِ واقعی
   (فاز ۱ ممیزی ۱۴۰۵/۰۷/۲۱ — ابزار توسعه، نه بخشی از برنامه)

   چرا؟ باگِ نسخهٔ ۳۷ (کاروسلِ عبادت با ۲۴۰px فضای خالی) روی گوشیِ واقعی
   دیده شد، در حالی که هر آزمونِ نودی سبز بود. دروازهٔ متنی نمی‌تواند
   «ارتفاعِ کانتینر» را ببیند؛ این ابزار می‌بیند.

   چه چیزی را می‌سنجد؟ (هر نقض، خروجِ ۱ می‌دهد)
     • هیچ افقیِ لغزان: documentElement.scrollWidth > clientWidth + 1
     • هیچ عنصرِ لمسی بیرون از ویوپورت
     • هر هدفِ لمسی ≥ 44×44 CSS px (استثنای مستند: inline و هم‌ارزِ بزرگ)
     • هیچ فضای خالی > 160px زیر محتوای فعال (همان شکستِ نسخهٔ ۳۷)
     • هیچ متنِ برش‌خورده (clip) — سه‌نقطه/line-clamp «اطلاع» شمرده می‌شود
     • کنتراست ≥ 4.5:1 برای متنِ معمولی، ≥ 3:1 برای متنِ درشت، در هر دو پوسته
     • هیچ خطای کنسولی (pageerror + console.error) در بارگذاری هر صفحه

   اجرا:
     node _browser-check.js                       # شبکهٔ کامل (۶ پهنا × ۲ جهت × ۲ پوسته)
     node _browser-check.js --quick               # فقط پرکاربردترین‌ها
     node _browser-check.js --screens=home,play    # گزینشی
     node _browser-check.js --lighthouse           # LCP/TBT/CLS با Lighthouse (موبایل، 4G، CPU 4×)
     node _browser-check.js --out=screenshots/browser --shots=1

   وابستگی: _shots_env `_shots_env/` (puppeteer + @sparticuz/chromium + lighthouse).
   برنامهٔ نورستان هیچ وابستگیِ اجرایی‌ای نمی‌گیرد.
   محدودیتِ صریح: سنسور (شتاب‌سنج/قطب‌نما/موقعیت) در Chromium سرورِ‌لس است؛
   آن موردها در `docs/PHASE-2-ANDROID-CHECKLIST.md` مانده‌اند.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const http = require('http');
const { spawn, execSync } = require('child_process');

const ROOT = __dirname;
const argOf = (n, d) => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const hasFlag = n => process.argv.includes('--' + n);
const OUT = path.resolve(ROOT, argOf('out', 'screenshots/browser'));
const PORT = +argOf('port', 8899);
const QUICK = hasFlag('quick');
const WANTS = (argOf('screens', '') || '').split(',').filter(Boolean);
const WIDTHS = (argOf('widths', QUICK ? '360,412' : '320,360,390,412,768,1024')).split(',').map(Number);
const ORIENT = QUICK ? ['portrait'] : ['portrait', 'landscape'];
const THEMES = (argOf('themes', 'dark,light')).split(',');
const SHOTS = hasFlag('shots') || hasFlag('quick') || true;   // عکس همیشه گرفته می‌شود (هنرِ شاهد)
const BASE = 'http://127.0.0.1:' + PORT;
const DATA_FILE = path.join(os.tmpdir(), 'noor-browsercheck-data.json');
const ADMIN_PASS = 'check-pass-1405';
/* دهانهٔ پیامکِ جعلی — همان قراردادِ `_servertest.js`. بدونِ ورود، پنج تبِ
   پایین قفل‌اند و بازبینی فقط خانه را می‌دید؛ پس برای پوششِ واقعی لازم است. */
const SMS_PORT = +argOf('sms-port', 8811);
const SMS_KEY = 'txb_browsercheck_key', SMS_DEVICE = 'dev_browser_000000000000000000';
/* هر پیکربندی شمارهٔ خودش را دارد: سقفِ ۶۰ ثانیهٔ فاصلهٔ کد (که خودش
   درست است) اگر یک شماره برای شش حالت مصرف شود، ورودِ دوم را می‌بندد و
   بازبینیِ بعدی روی صفحهٔ قفل‌شده انجام می‌شود. */
let phoneSeq = 0;
const phoneFor = () => '0912' + String(1000000 + ((Date.now() / 60000 | 0) % 900) * 1000 + (phoneSeq++ % 999));
const smsHits = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* صفحه‌ها: پنج تبِ پایین + عبادت + ورود + قبله‌نما + یک بازی */
const SCREENS = [
  { id: 'home', name: 'خانه' },
  { id: 'quran', name: 'قرآن' },
  { id: 'play', name: 'بازی‌ها' },
  { id: 'online', name: 'محفل' },
  { id: 'me', name: 'من' },
  { id: 'ebadat', name: 'عبادت' },
  { id: '@gate', name: 'ورود' },
  { id: '@qibla', name: 'قبله‌نما' },
  { id: '@game', name: 'بازیِ آیه‌ساز' }
];
const MAX_GAP = 160, MIN_TARGET = 44;
const CONTRAST_CAP = +argOf('contrast-cap', 12);   // بدترین‌ها در هر صفحه (پیکسل‌سنجی گران است)
/* پیچِ تنظیمِ بودجه: تا رفعِ کاملِ فاز ۳/۴، دروازه «بدتر از بودجه» را قرمز
   می‌کند و بودجه فقط کم می‌شود (هرگز بالا نمی‌رود). هدفِ پایانِ کار صفر است.
   بی این پرونده، دروازه سراسخت است. */
const BUDGET_FILE = argOf('budget', '');

let server = null, browser = null, failCount = 0, checkCount = 0;
const REPORT = { generated: new Date().toISOString(), env: {}, configs: [], violations: {}, info: {} };

function log(...a){ console.log(...a); }

/* ═════════════════════  سرور  ═════════════════════ */
let smsServer = null;
function startFakeSms(){
  return new Promise(res => {
    smsServer = http.createServer((req, r) => {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        smsHits.push({ body, at: Date.now() });
        r.writeHead(200, { 'Content-Type': 'application/json' });
        r.end(JSON.stringify({ success: true, data: { _id: 'bc' + smsHits.length, status: 'sent' } }));
      });
    });
    smsServer.listen(SMS_PORT, '127.0.0.1', () => res());
  });
}
function lastCode(){
  /* کد را از بدنهٔ پیامک می‌خوانیم، نه از هر رقمِ بدنه — شمارهٔ گیرنده هم
     در JSON است و /(\d{5,6})/ تنها، «0912…» را می‌گرفت. */
  for(let i = smsHits.length - 1; i >= 0; i--){
    let msg = '';
    try{ msg = String(JSON.parse(smsHits[i].body).message || ''); }
    catch(e){ msg = smsHits[i].body; }
    const m = /(\d{5,6})/.exec(msg);
    if(m) return m[1];
  }
  return null;
}

function startServer(){
  try{ fs.rmSync(DATA_FILE, { force: true }); }catch(e){}
  server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NOOR_DATA: DATA_FILE, NOOR_ADMIN_PASS: ADMIN_PASS,
           NOOR_HOST: '0.0.0.0', NOOR_LOG: '0',
           NOOR_SMS_KEY: SMS_KEY, NOOR_SMS_DEVICE: SMS_DEVICE,
           NOOR_SMS_ENDPOINT: `http://127.0.0.1:${SMS_PORT}/api/v1/gateway/send-sms`,
           NOOR_SMS_TIMEOUT: '3000', NOOR_SMS_MAX_IP: '2000', NOOR_SMS_MAX_HOUR: '5000',
           NOOR_QUIET: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const lines = [];
  server.stdout.on('data', d => { lines.push(String(d)); if(lines.length > 400) lines.shift(); });
  server.stderr.on('data', d => lines.push('! ' + d));
  REPORT.serverLog = () => lines.join('');
  return new Promise((res, rej) => {
    const t0 = Date.now();
    (function probe(){
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/health', timeout: 1500 }, r => {
        r.resume();
        if(r.statusCode === 200) return res();
        retry();
      });
      req.on('error', retry); req.on('timeout', () => { req.destroy(); retry(); });
      function retry(){
        if(Date.now() - t0 > 25000) return rej(new Error('سرور بالا نیامد:\n' + lines.join('')));
        setTimeout(probe, 250);
      }
    })();
  });
}
async function stopServer(){ if(smsServer){ try{ smsServer.close(); }catch(e){} } if(server){ server.kill('SIGTERM'); await sleep(200); try{ server.kill('SIGKILL'); }catch(e){} } }

/* ═════════════════════  مرورگر  ═════════════════════ */
async function launchChrome(){
  if(!fs.existsSync(path.join(ROOT, '_shots_env/node_modules/puppeteer')))
    throw new Error('وابستگیِ ابزار نیست: `cd _shots_env && npm install` (برنامهٔ نورستان به آن نیاز ندارد)');
  const C = require(path.join(ROOT, '_shots_env/node_modules/@sparticuz/chromium/build/index.js')).default;
  const libDir = path.join(os.tmpdir(), 'noor-al2023'), libPath = path.join(libDir, 'lib');
  if(!fs.existsSync(path.join(libPath, 'libnss3.so'))){
    fs.mkdirSync(libDir, { recursive: true });
    const tar = zlib.brotliDecompressSync(
      fs.readFileSync(path.join(ROOT, '_shots_env/node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
    fs.writeFileSync(path.join(libDir, 'a.tar'), tar);
    execSync(`tar -xf ${path.join(libDir, 'a.tar')} -C ${libDir}`);
    fs.unlinkSync(path.join(libDir, 'a.tar'));
  }
  process.env.LD_LIBRARY_PATH = libPath + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '');
  const puppeteer = require(path.join(ROOT, '_shots_env/node_modules/puppeteer'));
  browser = await puppeteer.launch({
    executablePath: await C.executablePath(), headless: 'shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
           '--hide-scrollbars', '--mute-audio', '--font-render-hinting=none', '--force-color-profile=srgb',
           '--force-prefers-reduced-motion']
  });
  return puppeteer;
}

/* ═════════════════════  سنجش‌ها (در صفحه)  ═════════════════════
   تنها یک بار تزریق می‌شود؛ بعد برای هر صفحه صدا زده می‌شود. */
const AUDIT_SRC = function auditPage(o){
  const MAX_GAP = o.maxGap, MIN_TARGET = o.minTarget;
  const de = document.documentElement, vw = de.clientWidth, vh = de.clientHeight;
  const V = [], INFO = { truncated: [], notes: [] };
  const cs = el => getComputedStyle(el);
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
    (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const inDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const box = el => el.getBoundingClientRect();
  function shown(el){
    const c = cs(el);
    if(c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.06) return false;
    const r = box(el);
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh + 2 && r.right > 0 && r.left < vw + 2;
  }
  const SEL = 'a[href],button,input,select,textarea,summary,[role="button"],[role="tab"],[role="link"],' +
              '[role="checkbox"],[role="switch"],[role="menuitem"],[data-nav],[tabindex]:not([tabindex="-1"])';

  /* ۱) افقیِ لغزان */
  if(de.scrollWidth > vw + 1)
    V.push({ t: 'hscroll', v: de.scrollWidth - vw, w: vw, note: 'scrollWidth ' + de.scrollWidth + ' > clientWidth ' + vw });
  /* ۲) بیرون از ویوپورت + ۳) اندازهٔ هدفِ لمسی */
  const seen = new Set();
  document.querySelectorAll(SEL).forEach(el => {
    if(!shown(el) || seen.has(el)) return;
    seen.add(el);
    const r = box(el), c = cs(el);
    if(r.right > vw + 1 || r.left < -1)
      V.push({ t: 'outside', el: name(el), r: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
               label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40) });
    const small = r.width < MIN_TARGET - 0.5 || r.height < MIN_TARGET - 0.5;
    if(small){
      /* دو استثنا، هر دو به‌جای «چشم‌پوشیِ سراسری»:
         (الف) لینکِ درونِ متن (استثنای WCAG 2.5.8 برای هدفِ inline)
         (ب) هدفِ هم‌ارزِ بزرگ‌تر روی همان صفحه (کل ردیف کلیک‌پذیر است) */
      const inline = c.display === 'inline' || c.display === 'inline-block' && !/btn|chip|tab|icon/.test(el.className || '');
      let dup = false;
      for(let p = el.parentElement; p && p !== document.body; p = p.parentElement){
        const pr = box(p);
        if(p.matches(SEL) && pr.width >= MIN_TARGET && pr.height >= MIN_TARGET){ dup = true; break; }
      }
      if(inline || dup){ INFO.truncated.push({ why: inline ? 'inline' : 'equivalent', el: name(el), r: [Math.round(r.width), Math.round(r.height)] }); return; }
      V.push({ t: 'target', el: name(el), w: Math.round(r.width), h: Math.round(r.height),
               label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40) });
    }
  });
  /* ۴) فضای خالیِ زیر محتوا — همان شکستِ نسخهٔ ۳۷ */
  const CAND = ['.screen.active', '.screen.active .card', '.screen.active .slide', '.screen.active .glass',
                '.carousel-slide', '#modalBox > *', '.modal-box > *'];
  const candEls = new Set();
  CAND.forEach(s => document.querySelectorAll(s).forEach(el => candEls.add(el)));
  candEls.forEach(el => {
    if(!shown(el)) return;
    const r = box(el);
    if(r.height < MAX_GAP + 40) return;
    let bottom = r.top;
    for(const ch of el.children){
      const c = cs(ch);
      if(c.position === 'absolute' || c.position === 'fixed' || !shown(ch)) continue;
      const cr = box(ch);
      if(cr.bottom > bottom) bottom = cr.bottom;
    }
    const clip = Math.min(r.bottom, vh);
    const gap = Math.round(clip - bottom);
    if(bottom > r.top && gap > MAX_GAP)
      V.push({ t: 'gap', el: name(el), gap, h: Math.round(r.height), note: 'آخرین فرزندها ' + gap + 'px بالاتر از کفِ کانتینر' });
  });
  /* ── رنگ و کنتراست ── */
  function parse(c){
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if(!m) return null;
    const p2 = m[1].split(/[,\/\s]+/).filter(x => x !== '').map(Number);
    return { r: p2[0], g: p2[1], b: p2[2], a: p2[3] === undefined ? 1 : (p2[3] > 1 ? p2[3] / 100 : p2[3]) };
  }
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  function over2(fg, bg){ const a = fg.a; return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) }; }
  const base = parse(cs(document.body).backgroundColor) || (inDark ? { r: 10, g: 14, b: 24, a: 1 } : { r: 246, g: 244, b: 238, a: 1 });
  /* پس‌زمینهٔ مؤثر: نزدیک‌ترین جد با رنگِ نه‌شفاف. گرادیان/نگاره «هموار»
   نیست و در DOM قابل محاسبه نیست — برای همین نامزدها بعداً با پیکسلِ
   واقعیِ همان ناحیه داوری می‌شوند (pixel-verified). */
  function bgOf(el){
    for(let p = el; p; p = p.parentElement){
      const c = cs(p);
      const col = parse(c.backgroundColor);
      if(col && col.a > 0.75) return col.a === 1 ? col : over2(col, base);
      if(c.backgroundImage && c.backgroundImage !== 'none') break;
      if(p === document.body) break;
    }
    return base;
  }
  /* ۵) متنِ برش‌خورده — با مستطیلِ خودِ گلیف‌ها (Range)، نه scrollHeight.
        اختلافِ scrollHeight با line-height:1 یک مصنوعِ رندر است؛ چیزی که
        باید ببینیم این است که بخشی از خط بیرونِ جعبهٔ دید رفته باشد. */
  const textEls = [];
  document.querySelectorAll('body *').forEach(el => {
    let hasText = false;
    for(const n of el.childNodes) if(n.nodeType === 3 && /[^\s\u200b-\u200f\ufeff]/.test(n.nodeValue)) { hasText = true; break; }
    if(hasText && shown(el)) textEls.push(el);
  });
  INFO.textNodes = textEls.length;
  let bcId = 0;
  const suspects = [];
  textEls.slice(0, 4000).forEach(el => {
    const c = cs(el), r = box(el);
    if(/auto|scroll/.test(c.overflowX + ' ' + c.overflowY)) return;
    const rg = document.createRange();
    rg.selectNodeContents(el);
    let over = { t: 0, b: 0, l: 0, rr: 0 };
    for(const cr of rg.getClientRects()){
      over.b = Math.max(over.b, cr.bottom - r.bottom);
      over.t = Math.max(over.t, r.top - cr.top);
      over.rr = Math.max(over.rr, cr.right - r.right);
      over.l = Math.max(over.l, r.left - cr.left);
    }
    const clipB = Math.round(over.b - parseFloat(c.paddingBottom || 0) - 1);
    const clipR = Math.round(over.rr - parseFloat(c.paddingRight || 0) - 1);
    const clipY = c.overflowY === 'hidden' || c.overflowY === 'clip';
    const clipX = c.overflowX === 'hidden' || c.overflowX === 'clip';
    if((clipB > 2 || over.t - 1 > 2) && clipY)
      V.push({ t: 'clip', el: name(el), dir: 'v', px: Math.max(clipB, Math.round(over.t)), label: (el.textContent || '').trim().slice(0, 40) });
    else if((clipR > 2 || over.l - 1 > 2) && (clipX || clipY)){
      const clamp = c.webkitLineClamp && c.webkitLineClamp !== 'none';
      if(c.textOverflow === 'ellipsis' || clamp) INFO.truncated.push({ why: 'ellipsis', el: name(el), px: clipR });
      else V.push({ t: 'clip', el: name(el), dir: 'h', px: clipR, label: (el.textContent || '').trim().slice(0, 40) });
    }
    /* نامزدِ کنتراست: پیش‌بینیِ DOM؛ داوریِ نهایی با پیکسل (پایین) */
    if(r.width < 4 || r.height < 4) return;
    const fg0 = parse(c.color); if(!fg0) return;
    const bg = bgOf(el), fg = over2(fg0, bg);
    const ratio = lum(fg) > lum(bg) ? (lum(fg) + 0.05) / (lum(bg) + 0.05) : (lum(bg) + 0.05) / (lum(fg) + 0.05);
    const size = parseFloat(c.fontSize), large = size >= 24 || (size >= 18.66 && (+c.fontWeight) >= 600);
    const need = large ? 3 : 4.5;
    INFO.contrastChecked = (INFO.contrastChecked || 0) + 1;
    if(ratio < need + 0.9){
      const id = ++bcId;
      el.setAttribute('data-bc', String(id));
      suspects.push({ id, ratio: Math.round(ratio * 100) / 100, need, size: Math.round(size),
                      color: c.color, label: (el.textContent || '').trim().slice(0, 36), el: name(el),
                      r: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } });
    }
  });
  INFO.contrastSuspects = suspects.length;
  INFO.bcSuspects = suspects;
  return { v: V, info: INFO, vw, vh, scrollW: de.scrollWidth, scrollH: de.scrollHeight, theme: inDark ? 'dark' : 'light',
           rtl: getComputedStyle(document.body).direction };
};

/* ورودِ واقعی (شماره ← کدِ دهانهٔ جعلی ← نشستنِ نشست) */
async function login(page, phone){
  await page.evaluate(() => { Gate.open('phone'); return true; });
  await page.waitForSelector('#gtPhone', { visible: true, timeout: 10000 });
  /* تایپِ کلید‌به‌کلید اینجا مسابقه دارد: هر `field()` برگه را دوباره
     می‌کشد و گرهٔ ورودیِ میانی گم می‌شود. پس مقدار یک‌جا نشستن و بعد رویداد
     input — همان مسیری که خودِ برنامه می‌شناسد. */
  await page.evaluate(ph => {
    const el = U.$('#gtPhone');
    el.value = ph;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, phone);
  await page.waitForFunction(() => !U.$('#gtSend').disabled, { timeout: 8000 });
  const before = smsHits.length;
  await sleep(150);
  await page.evaluate(() => { U.$('#gtSend').click(); return true; });
  const t0 = Date.now();
  while(smsHits.length === before && Date.now() - t0 < 15000) await sleep(250);
  const code = lastCode();
  if(!code) throw new Error('کدِ تأیید از دهانهٔ جعلیِ پیامک بیرون نیامد');
  try{ await page.waitForSelector('#gtCode', { visible: true, timeout: 20000 }); }
  catch(e){
    const why = await page.evaluate(() => ({
      step: (typeof Gate !== 'undefined' && Gate.step) || '?', shown: (typeof Gate !== 'undefined' && Gate.shown),
      msg: (U.$('#gtMsg') || {}).textContent || '', hint: (U.$('#gtHint') || {}).textContent || '',
      send: !!U.$('#gtSend') && U.$('#gtSend').disabled, sms: (typeof SMS !== 'undefined' && SMS.ready && SMS.ready())
    })).catch(() => null);
    throw new Error('برگهٔ کد باز نشد ' + JSON.stringify(why) + ' — ' + String(e.message).slice(0, 60));
  }
  await page.evaluate(c => {
    const el = U.$('#gtCode');
    el.value = c;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, code);
  await page.evaluate(() => { U.$('#gtOk').click(); return true; });
  await page.waitForFunction(() => { try{ return !!Session.user(); }catch(e){ return false; } }, { timeout: 20000 });
  await page.evaluate(() => { try{ if(U.$('#onb.on')) Onboarding.close(true); }catch(e){} return true; });
  await sleep(400);
  return true;
}


/* ═════════════════════  کنتراستِ پیکسلی  ═════════════════════
   پیش‌بینیِ DOM روی پس‌زمینهٔ هموار درست است، ولی روی گرادیان/شیشه/نگاره
   گمراه‌کننده (متنِ سفیدِ روی دکمهٔ طلایی «تقریباً همان رنگِ پس‌زمینه»
   به‌نظر می‌رسد). پس نامزدها داوریِ نهایی را از خودِ پیکسل‌های رندرشده
   می‌گیرند: متنِ همان عنصر پنهان می‌شود، رنگِ پُرکارِ ناحیه = پس‌زمینه. */
let PNG = null;
function pngLib(){
  if(PNG === null){
    try{ PNG = require(path.join(ROOT, '_shots_env/node_modules/pngjs')).PNG; }
    catch(e){ PNG = false; }
  }
  return PNG || null;
}
const chan = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lumi = (r, g, b) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const ratioOf = (L1, L2) => (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
function rgba(str){
  const m = String(str).match(/rgba?\(([^)]+)\)/); if(!m) return null;
  const p = m[1].split(/[,\/\s]+/).filter(x => x !== '').map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : (p[3] > 1 ? p[3] / 100 : p[3]) };
}
function dominant(buf){
  const png = PNG.sync.read(buf);
  const w = png.width, h = png.height, d = png.data;
  const buckets = new Map();
  for(let y = 0; y < h; y += 2) for(let x = 0; x < w; x += 2){
    const i = (y * w + x) * 4;
    if(d[i + 3] < 250) continue;
    const key = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3);
    const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
    buckets.set(key, b);
  }
  let best = null;
  for(const b of buckets.values()) if(!best || b.n > best.n) best = b;
  if(!best) return null;
  return { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n, n: best.n };
}
async function verifyContrast(page, list, cap){
  const lib = pngLib();
  if(!lib) return { skipped: 'pngjs نیست — کنتراست فقط با DOM پیش‌بینی شد', out: list.map(it => ({ t: 'contrast', mode: 'dom', el: it.el, ratio: it.ratio, need: it.need, label: it.label })) };
  const out = [], okList = [];
  const cands = list.slice().sort((a, b) => a.ratio - b.ratio).slice(0, cap);
  for(const it of cands){
    const g = await page.evaluate(id => {
      const el = document.querySelector('[data-bc="' + id + '"]');
      if(!el) return null;
      el.style.setProperty('color', 'transparent', 'important'); el.setAttribute('data-bc-h', '1');
      el.querySelectorAll('*').forEach(c => {
        const s2 = getComputedStyle(c);
        const own = s2.backgroundColor !== 'rgba(0, 0, 0, 0)' || (s2.backgroundImage && s2.backgroundImage !== 'none');
        if(!own){ c.style.setProperty('visibility', 'hidden', 'important'); c.setAttribute('data-bc-h', '1'); }
      });
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }, it.id).catch(() => null);
    if(!g) continue;
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    const vh = await page.evaluate(() => document.documentElement.clientHeight);
    const clip = {
      x: Math.max(0, Math.round(g.x) + 1), y: Math.max(0, Math.round(g.y) + 1),
      width: Math.max(3, Math.min(vw - Math.max(0, Math.round(g.x)) - 2, Math.round(g.w) - 2)),
      height: Math.max(3, Math.min(vh - Math.max(0, Math.round(g.y)) - 2, Math.round(g.h) - 2))
    };
    let buf = null;
    try{ buf = await page.screenshot({ clip, type: 'png' }); }catch(e){}
    await page.evaluate(() => {
      document.querySelectorAll('[data-bc-h]').forEach(el => { el.style.removeProperty('color'); el.style.removeProperty('visibility'); el.removeAttribute('data-bc-h'); });
    }).catch(() => {});
    if(!buf){ okList.push({ el: it.el, note: 'na' }); continue; }
    const bg = dominant(buf);
    if(!bg){ okList.push({ el: it.el, note: 'no-pixels' }); continue; }
    const fg0 = rgba(it.color) || { r: 0, g: 0, b: 0, a: 1 };
    const fg = { r: fg0.r * fg0.a + bg.r * (1 - fg0.a), g: fg0.g * fg0.a + bg.g * (1 - fg0.a), b: fg0.b * fg0.a + bg.b * (1 - fg0.a) };
    const ratio = Math.round(ratioOf(lumi(fg.r, fg.g, fg.b), lumi(bg.r, bg.g, bg.b)) * 100) / 100;
    (ratio < it.need - 0.02 ? out : okList).push({
      t: ratio < it.need - 0.02 ? 'contrast' : null, mode: 'pixel', el: it.el, ratio, need: it.need, size: it.size,
      bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ')', label: it.label, dom: it.ratio
    });
  }
  return { out: out.filter(Boolean), cleared: okList.length, checked: cands.length, of: list.length };
}

/* ═════════════════════  یک پیکربندی  ═════════════════════ */
async function runConfig(puppeteer, width, orient, theme){
  const label = width + '×' + (orient === 'portrait' ? (width <= 500 ? 844 : 1024) : 400) ;
  const h = orient === 'portrait' ? (width <= 400 ? 780 : 915) : 420;
  const cfg = { label: width + 'px ' + orient + ' ' + theme, width, height: h, orient, theme, screens: [], v: [] };
  const page = await browser.newPage();
  const cerr = [];
  /* قلم‌ها/صوت/متن قرآن از بیرون می‌آیند و در جعبهٔ شنی sandbox دسترس‌ناپذیرند؛
     خطایِ «Failed to load resource» همیشه جفتِ requestfailed می‌آید و آنجا
     پالایش می‌شود، پس تکراری شمرده نمی‌شود. */
  const EXTERNAL = /cdn\.jsdelivr\.net|api\.alquran\.cloud|fonts\.googleapis\.com|fonts\.gstatic\.com|everyayah\.com|mp3quran\.net|quranicaudio\.com|islamic\.network/;
  page.on('console', m => {
    const t = m.text();
    if(m.type() !== 'error') return;
    if(/Failed to load resource|net::ERR_/.test(t)) return;
    cerr.push('console: ' + t.slice(0, 200));
  });
  page.on('pageerror', e => cerr.push('pageerror: ' + String(e && e.message || e).slice(0, 200)));
  page.on('requestfailed', r => { const u = r.url(); if(!EXTERNAL.test(u) && !/favicon/.test(u)) cerr.push('requestfailed: ' + u.replace(/^https?:\/\/[^/]+/, '') + ' ' + (r.failure() || {}).errorText); });
  page.on('response', r => { const u = r.url(); if(u.startsWith(BASE) && r.status() >= 400) cerr.push('http ' + r.status() + ' ' + u.slice(BASE.length).split('?')[0]); });
  await page.setViewport({ width, height: h, deviceScaleFactor: 2, isMobile: width <= 500 && orient === 'portrait', hasTouch: true });
  await page.goto(BASE + '/?bc=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.App && window.App.ready !== false', { timeout: 25000 }).catch(() => {});
  /* پوسته از همان‌جا که خودِ برنامه عوض می‌کند (Theme.set → applyTheme) */
  await page.evaluate(t => {
    try{ applyTheme(t); }
    catch(e){ try{ Theme.set(t); }catch(e2){ document.documentElement.setAttribute('data-theme', t); } }
  }, theme);
  await page.evaluate(() => {
    /* pick: کوچک‌ترین عنصرِ کلیک‌پذیرِ هم‌خوانِ متن — برای «قبله‌نما» و
       «یک بازی»، بی وابستگی به کلاس‌های داخلیِ صفحه */
    window.__pick = (scope, re, sel) => {
      const nodes = [...document.querySelectorAll((scope || 'body') + ' ' + (sel || 'button, a, [role=\"button\"], .card, .tile, [data-game], [onclick]'))];
      const hit = nodes.filter(el => re.test((el.textContent || '') + ' ' + (el.dataset ? Object.values(el.dataset).join(' ') : '')) &&
        el.getBoundingClientRect().height > 8)
        .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
      if(!hit) return null;
      (hit.closest('button,a,[role=\"button\"]') || hit).click();
      return true;
    };
  });
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await sleep(600);
  try{ await login(page, phoneFor()); cfg.loggedIn = true; }
  catch(e){ cfg.loggedIn = false; cfg.v.push({ t: 'login', note: 'ورود نشد → پنج تبِ پایین قفل می‌مانند و بازبینیِ واقعی نیست: ' + String(e && e.message || e).slice(0, 160) }); }

  for(const s of (WANTS.length ? SCREENS.filter(x => WANTS.includes(x.id) || WANTS.includes(x.name)) : SCREENS)){
    const go = async () => {
      if(s.id === '@gate') return page.evaluate(() => { Gate.open(); return true; });
      if(s.id === '@qibla'){
        await page.evaluate(() => { try{ Router.go('ebadat'); }catch(e){} });
        await sleep(500);
        return page.evaluate(() => {
          const b = window.__pick('#s-ebadat', /قبله/);
          if(!b) throw new Error('دکمهٔ قبله‌نما پیدا نشد');
          b.click(); return true;
        });
      }
      if(s.id === '@game'){
        await page.evaluate(() => { try{ Router.go('play'); }catch(e){} });
        await sleep(400);
        return page.evaluate(() => {
          const b = window.__pick('#s-play', /آیه|حکمت|جفت/);
          if(!b) throw new Error('کارتِ بازی آیه‌ساز پیدا نشد');
          b.click(); return true;
        });
      }
      return page.evaluate(n => { Router.go(n); return true; }, s.id);
    };
    let err = null;
    try{ await go(); }catch(e){ err = String(e && e.message || e).slice(0, 160); }
    await sleep(900);
    let r = null;
    try{ r = await page.evaluate(AUDIT_SRC, { maxGap: MAX_GAP, minTarget: MIN_TARGET }); }
    catch(e){ err = (err ? err + ' / ' : '') + 'audit: ' + String(e && e.message || e).slice(0, 160); }
    const shot = SHOTS ? path.join(OUT, 'shots', cfg.label.replace(/[^\w]+/g, '-') + '--' + s.id + '.png') : null;
    if(shot){ try{ fs.mkdirSync(path.dirname(shot), { recursive: true }); await page.screenshot({ path: shot, fullPage: false }); }catch(e){ err = (err || '') + ' shot: ' + e.message; } }
    if(s.id === 'home' && !cfg.firstLoad){
      /* شمارشِ بارِ اول: هر درخواستِ سندِ خانه، با اندازهٔ منتقل‌شده.
         هدفِ فاز ۵ (تصویرِ بارِ اول ≤ 200KB) و فاز ۶ (JS اولیه) از همین‌جا خوانده می‌شود. */
      cfg.firstLoad = await page.evaluate(() => {
        const e = performance.getEntriesByType('resource');
        const nav = performance.getEntriesByType('navigation')[0] || { transferSize: 0 };
        const ext = p => { const m = /\.([a-z0-9]{1,6})(\?|$)/i.exec(p); return m ? m[1].toLowerCase() : (/-\d{8,}\.(js|css)$/i.test(p) ? 'hashed' : '—'); };
        const byExt = {}, byKind = {};
        let total = nav.transferSize || 0, n = 1;
        const list = [];
        for(const r of e){
          const sz = r.transferSize || r.encodedBodySize || 0;
          const k = ext(r.name);
          byExt[k] = (byExt[k] || 0) + sz; byKind[r.initiatorType] = (byKind[r.initiatorType] || 0) + sz;
          total += sz; n++;
          list.push({ u: r.name.replace(/^https?:\/\/[^/]+/, ''), kb: Math.round(sz / 1024), kind: r.initiatorType });
        }
        const sum = o => Object.entries(o).map(([k, v]) => k + ':' + Math.round(v / 1024) + 'KB').sort().join('  ');
        const imgKB = Object.entries(byExt).filter(([k]) => /png|jpg|jpeg|webp|svg|avif|gif/.test(k)).reduce((a, b) => a + b[1], 0);
        const jsKB = (byExt.js || 0) + (byExt.mjs || 0);
        return { n, kb: Math.round(total / 1024), byExt: sum(byExt), byKind: sum(byKind), images_kb: Math.round(imgKB / 1024), js_kb: Math.round(jsKB / 1024),
                 biggest: list.slice().sort((a, b) => b.kb - a.kb).slice(0, 12) };
      }).catch(e => ({ err: String(e.message).slice(0, 120) }));
    }
    if(r){
      let cv = null;
      if(r.info && r.info.bcSuspects && r.info.bcSuspects.length){
        cv = await verifyContrast(page, r.info.bcSuspects, CONTRAST_CAP);
        for(const v of (cv.out || [])) cfg.v.push(Object.assign({ screen: s.id }, v));
      }
      const item = { screen: s.id, title: s.name, v: r.v, info: Object.assign({}, r.info, { contrast: cv
               ? { checked: cv.checked, of: cv.of, failed: (cv.out || []).length, cleared: cv.cleared } : null }), vw: r.vw, vh: r.vh, scrollW: r.scrollW, rtl: r.rtl, err };
      delete item.info.bcSuspects;
      cfg.screens.push(item);
      for(const v of r.v) cfg.v.push(Object.assign({ screen: s.id }, v));
    } else cfg.screens.push({ screen: s.id, err: err || 'بدون نتیجه' });
    if(s.id === '@qibla' || s.id === '@game' || s.id === '@gate'){ try{ await page.evaluate(() => { try{ UI.closeModal ? UI.closeModal() : (UI.modal && UI.modal.closeModal()); }catch(e){} try{ history.back(); }catch(e){} }); }catch(e){} await sleep(300); }
  }
  if(cerr.length) cfg.v.push({ t: 'console', n: cerr.length, list: [...new Set(cerr)].slice(0, 12) });
  await page.close();
  checkCount++;
  const bad = cfg.v.length;
  failCount += bad;
  log(`  ${bad ? '✗' : '✓'} ${cfg.label.padEnd(26)} صفحات ${cfg.screens.length}  نقض ${bad}` +
      (bad ? '  [' + [...new Set(cfg.v.map(x => x.t))].join(',') + ']' : ''));
  return cfg;
}

/* ═════════════════════  Lighthouse  ═════════════════════ */
async function runLighthouse(){
  let lh;
  try{ lh = require(path.join(ROOT, '_shots_env/node_modules/lighthouse')); }
  catch(e){ log('  ⚠ Lighthouse نصب نیست (`cd _shots_env && npm install lighthouse`)'); return null; }
  const url = 'http://127.0.0.1:' + PORT + '/';
  const flags = {
    output: 'json', logLevel: 'error', port: new URL(browser.wsEndpoint()).port, onlyCategories: ['performance'],
    formFactor: 'mobile', screenEmulation: { mobile: true, width: 412, height: 915, deviceScaleFactor: 2, disabled: false },
    throttlingMethod: 'simulate', throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4, requestLatencyMs: 150, downloadThroughputKbps: 1638.4, uploadThroughputKbps: 750 }
  };
  const res = await lh(url, flags);
  const a = res.lhr.audits;
  const num = k => a[k] && a[k].numericValue;
  const out = {
    url, lighthouse: res.lhr.lighthouseVersion,
    LCP_ms: Math.round(num('largest-contentful-paint')), TBT_ms: Math.round(num('total-blocking-time')),
    CLS: Math.round((num('cumulative-layout-shift') || 0) * 1000) / 1000,
    FCP_ms: Math.round(num('first-contentful-paint')), TTI_ms: Math.round(num('interactive')),
    speed_ms: Math.round(num('speed-index')),
    transfer_kb: Math.round((res.lhr.audits['total-byte-weight'].numericValue || 0) / 1024),
    font_kb: Math.round(((a['font-display'] ? 0 : 0) + (res.lhr.audits['unused-css-rules'] ? 0 : 0))),
    budget: { LCP_ms: 2500, TBT_ms: 200, CLS: 0.1 },
    pass: num('largest-contentful-paint') <= 2500 && num('total-blocking-time') <= 200 && (num('cumulative-layout-shift') || 0) <= 0.1
  };
  REPORT.lighthouse = out;
  log('  ' + (out.pass ? '✓' : '✗') + ` Lighthouse  LCP ${out.LCP_ms}ms · TBT ${out.TBT_ms}ms · CLS ${out.CLS} · ${out.transfer_kb}KB`);
  if(!out.pass) failCount++;
  return out;
}

/* ═════════════════════  گزارش  ═════════════════════ */
function writeReport(){
  fs.mkdirSync(OUT, { recursive: true });
  const tally = {};
  for(const c of REPORT.configs) for(const v of c.v) tally[v.t] = (tally[v.t] || 0) + 1;
  REPORT.tally = tally;
  REPORT.configs.forEach(c => { delete c.raw; });
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(REPORT, null, 1));
  const md = [];
  md.push('# بازبینیِ مرورگری — ' + new Date().toISOString().slice(0, 10));
  md.push('');
  md.push('```', 'node _browser-check.js' + (QUICK ? ' --quick' : ''), '```', '');
  md.push(`**پیکربندی:** ${WIDTHS.join('/')}px · ${ORIENT.join('+')} · ${THEMES.join('/')} — ${REPORT.configs.length} حالت`);
  md.push(`**جمعِ نقض‌ها:** ${failCount}` + (failCount ? '' : ' (پاک)'));
  md.push('');
  md.push('| نوع نقض | شمار |');
  md.push('|---|---:|');
  for(const k of Object.keys(tally).sort((a, b) => tally[b] - tally[a])) md.push('| `' + k + '` | ' + tally[k] + ' |');
  if(!Object.keys(tally).length) md.push('| — | 0 |');
  md.push('');
  md.push('| پیکربندی | صفحات | نقض |');
  md.push('|---|---:|---:|');
  for(const c of REPORT.configs) md.push('| ' + c.label + ' | ' + c.screens.length + ' | ' + c.v.length + ' |');
  md.push('');
  const byType = {};
  for(const c of REPORT.configs) for(const v of c.v){ const k = v.t; (byType[k] = byType[k] || []).push(Object.assign({ cfg: c.label }, v)); }
  for(const k of Object.keys(byType)){
    md.push('## `' + k + '` — ' + byType[k].length + ' مورد');
    md.push('');
    for(const v of byType[k].slice(0, 25)){
      md.push('- `' + v.cfg + (v.screen ? ' · ' + v.screen : '') + '` ' + (v.el || v.note || v.list ? [v.el, v.gap ? 'gap ' + v.gap + 'px' : '', v.w ? v.w + '×' + v.h : '', v.ratio ? v.ratio + ':1 (need ' + v.need + ')·' + v.size + 'px' : '', v.px ? v.px + 'px' : '', v.label ? '«' + v.label + '»' : ''].filter(Boolean).join(' ') : '') + (v.list ? '\n  - ' + v.list.join('\n  - ') : ''));
    }
    if(byType[k].length > 25) md.push('- … و ' + (byType[k].length - 25) + ' موردِ دیگر در `report.json`');
    md.push('');
  }
  const fl = (REPORT.configs[0] || {}).firstLoad;
  if(fl && !fl.err){
    md.push('## بارِ اول (پیکربندی نخست)');
    md.push('');
    md.push('| درخواست | KB |');
    md.push('|---|---:|');
    for(const b of (fl.biggest || [])) md.push('| `' + b.u + '` | ' + b.kb + ' |');
    md.push('');
    md.push('`' + fl.n + ' درخواست · ' + fl.kb + 'KB منتقل‌شده · تصویر ' + fl.images_kb + 'KB · JS ' + fl.js_kb + 'KB`');
    md.push('');
    md.push('بر پایهٔ: ' + fl.byExt);
    md.push('');
  }
  const cs = REPORT.configs.map(c => (c.screens || []).reduce((a, x) => a + ((x.info && x.info.contrast && x.info.contrast.checked) || 0), 0));
  md.push('کنتراست: ' + cs.reduce((a, b) => a + b, 0) + ' نامزد با پیکسلِ واقعی داوری شد (در هر صفحه حداکثر ' + CONTRAST_CAP + ' موردِ بدترین).');
  if(BUDGET_FILE) md.push('', 'بودجه: `' + BUDGET_FILE + '` — ' + (REPORT.budget ? REPORT.budget.violations : 'بدون به‌روزرسانی'));
  fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n') + '\n');
  return path.join(OUT, 'report.md');
}

/* ═════════════════════  main  ═════════════════════ */
(async () => {
  log('── بازبینیِ مرورگریِ نورستان ──');
  await startFakeSms();
  await startServer();
  log('  سرور روی 127.0.0.1:' + PORT);
  const puppeteer = await launchChrome();
  const uv = await browser.version();
  REPORT.env = { chrome: uv, node: process.version, widths: WIDTHS, orientations: ORIENT, themes: THEMES,
                 maxGap: MAX_GAP, minTarget: MIN_TARGET, viewportBase: 'deviceScaleFactor 2' };
  log('  ' + uv);
  if(hasFlag('first-load')) { /* همان پیکربندی نخست، شمارشِ درخواست‌ها */ }
  for(const w of WIDTHS) for(const orient of ORIENT) for(const theme of THEMES){
    REPORT.configs.push(await runConfig(puppeteer, w, orient, theme));
  }
  if(hasFlag('lighthouse')) await runLighthouse();
  await browser.close();
  const rp = writeReport();
  await stopServer();
  let budget = null;
  if(BUDGET_FILE){
    const bf = path.resolve(ROOT, BUDGET_FILE);
    let prev = null;
    try{ prev = JSON.parse(fs.readFileSync(bf, 'utf8')); }catch(e){}
    budget = { violations: failCount, at: REPORT.generated, chrome: REPORT.env.chrome, configs: REPORT.configs.length };
    if(prev && typeof prev.violations === 'number' && failCount > prev.violations){
      log('\n✗ بودجه شکسته شد: ' + failCount + ' نقض در برابر ' + prev.violations + ' مجاز (' + BUDGET_FILE + ')');
      failCount = failCount + 1;
    } else if(prev && typeof prev.violations === 'number' && failCount < prev.violations){
      log('\n✓ بودجه ارتقا یافت: ' + prev.violations + ' → ' + failCount + ' — ' + BUDGET_FILE + ' را کم کن');
    }
    if(!prev || failCount <= (prev.violations ?? 0)){ try{ fs.mkdirSync(path.dirname(bf), { recursive: true }); fs.writeFileSync(bf, JSON.stringify(Object.assign({}, prev, budget), null, 1) + '\n'); }catch(e){} }
  }
  REPORT.budget = budget;
  log('\nجمعِ نقض‌ها: ' + failCount + ' در ' + checkCount + ' پیکربندی');
  log('گزارش: ' + rp + ' و ' + path.join(OUT, 'report.json'));
  if(failCount) process.exitCode = 1;
})().catch(async e => {
  console.error('خطای ابزار:', e && e.stack || e);
  try{ if(browser) await browser.close(); }catch(x){}
  await stopServer();
  process.exit(2);
});
