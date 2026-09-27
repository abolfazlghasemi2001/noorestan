#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   _carousel-evidence.js — شواهدِ عینیِ کاروسل (ابزار توسعه، نه بخشی از برنامه)

   چرا این فایل؟
     گزارشِ باگ می‌گفت «کارت‌های چرخشی حرکت نمی‌کنند». پیش از هر تغییری
     باید معلوم شود *واقعاً* چه چیزی روی صفحه هست. این ابزار همان پنج
     چکِ کنسول را در یک مرورگرِ واقعی (headless Chromium) اجرا می‌کند و
     خروجی را چاپ می‌کند — بدون حدس.

   حالت‌ها:
     node _carousel-evidence.js --diagnose [--root=/path] [--port=8830]
        پنج چکِ کنسول + وضعیتِ اسلایدرِ واقعیِ برنامه
     node _carousel-evidence.js --gif
        گیفِ حرکتِ خودکار و گیفِ کشیدن با اشاره‌گر
     node _carousel-evidence.js --shots [--before=<commit>]
        عکسِ «قبل» از یک کامیت و عکسِ «بعد» از درختِ کاری
     node _carousel-evidence.js            (= هر سه)

   خروجی در screenshots/carousel/ می‌نشیند. PNG/GIF طبق قاعدهٔ مخزن در
   Git ثبت نمی‌شوند (screenshots/*.png در .gitignore است)؛ report.json
   ثبت می‌شود تا ادعاها قابلِ بررسی بمانند.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { spawn, execSync } = require('child_process');

const ROOT = __dirname;
const W = 390, H = 844, DPR = 2;
const ADMIN_PASS = 'noor-admin-1403';
const PHONE = '09123456789';
const SERVERS = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const hasFlag = n => process.argv.includes('--' + n);
const argOf = (n, d) => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').slice(n.length + 3) || d;
const OUT = path.resolve(ROOT, argOf('out', 'screenshots/carousel'));
const PORT = +argOf('port', 8830);
/* کامیتِ پایهٔ این جلسه — همان نسخه‌ای که گزارشِ باگ رویش نوشته شده بود */
const BASE = argOf('before', 'daafa3cc742c1b38f120f12bfabaf7a747ad9313');

/* ═══════════ مرورگر: @sparticuz/chromium + کتابخانه‌های AL2023 ═══════════ */
async function bootstrapChrome(){
  const C = require(path.join(ROOT, '_shots_env/node_modules/@sparticuz/chromium/build/index.js')).default;
  const libDir = path.join(os.tmpdir(), 'noor-al2023');
  const libPath = path.join(libDir, 'lib');
  if(!fs.existsSync(path.join(libPath, 'libnss3.so'))){
    fs.mkdirSync(libDir, { recursive: true });
    const tar = zlib.brotliDecompressSync(
      fs.readFileSync(path.join(ROOT, '_shots_env/node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
    fs.writeFileSync(path.join(libDir, 'a.tar'), tar);
    execSync(`tar -xf ${path.join(libDir, 'a.tar')} -C ${libDir}`);
    fs.unlinkSync(path.join(libDir, 'a.tar'));
  }
  process.env.LD_LIBRARY_PATH = libPath + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : '');
  const exe = await C.executablePath();
  const puppeteer = require(path.join(ROOT, '_shots_env/node_modules/puppeteer'));
  const browser = await puppeteer.launch({
    executablePath: exe, headless: 'shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
           '--disable-gpu', '--hide-scrollbars', '--mute-audio',
           '--font-render-hinting=none', '--force-color-profile=srgb']
  });
  return { puppeteer, browser };
}

/* ═══════════ فرستندهٔ پیامکِ ساختگی ═══════════ */
function startMockSms(){
  const hits = [];
  const http = require('http');
  const srv = http.createServer((req, res) => {
    if(req.method === 'POST' && req.url.startsWith('/sms')){
      let b = ''; req.on('data', x => b += x);
      req.on('end', () => { try{ hits.push(JSON.parse(b)); }catch(e){}
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ success:true, data:{ _id:'fake-sms', status:'pending' } })); });
      return;
    }
    if(req.url === '/last-code'){
      const m = (hits[hits.length - 1] || {}).message || '';
      const code = (m.match(/\b(\d{5})\b/) || [])[1] || '';
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({ code, message: m, hits: hits.length }));
    }
    res.writeHead(404); res.end();
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port })));
}

/* ═══════════ سرورِ نورستان برای یک ریشهٔ مشخص ═══════════ */
function startServer(root, port, smsPort, dataFile){
  try{ execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { shell: '/bin/bash' }); }catch(e){}
  const proc = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1',
           NOOR_DATA: dataFile, NOOR_ADMIN_PASS: ADMIN_PASS,
           NOOR_SMS_KEY: 'test-key', NOOR_SMS_DEVICE: 'test-device',
           NOOR_SMS_ENDPOINT: `http://127.0.0.1:${smsPort}/sms`,
           NOOR_SMS_MAX_PHONE: '500', NOOR_SMS_MAX_IP: '500', NOOR_SMS_MAX_HOUR: '1000' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  proc.stdout.on('data', d => out += d); proc.stderr.on('data', d => out += d);
  Object.defineProperty(proc, '__out', { get(){ return out; } });
  SERVERS.push(proc);
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = async () => {
      if(proc.exitCode !== null) return reject(new Error('server died\n' + out));
      try{
        const r = await fetch(`http://127.0.0.1:${port}/index.html`, { method:'HEAD', signal: AbortSignal.timeout(1200) });
        if(r.ok) return resolve(proc);
      }catch(e){}
      if(Date.now() - t0 > 25000) return reject(new Error('server not up\n' + out));
      setTimeout(poll, 300);
    };
    poll();
  });
}

/* ═══════════ کمک‌کارهای صفحه ═══════════ */
async function newPage(browser, { mobile = true, scheme = 'dark' } = {}){
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  /* برنامه تا وقتی کاربر خودش پوسته را انتخاب نکرده، رنگِ سامانه را دنبال
     می‌کند (Theme.followSystem). پیش‌فرضِ مرورگرِ آزمون «روشن» است، پس بی
     این خط همهٔ عکس‌ها روشن درمی‌آمدند؛ بقیهٔ ابزارهای مخزن هم تاریک می‌گیرند. */
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR, isMobile: mobile, hasTouch: mobile });
  const logs = [];
  const noise = t => /Failed to load resource|net::|ERR_|WebSocket|favicon|arena\.site/i.test(t);
  page.on('console', m => { if((m.type() === 'error' || m.type() === 'warning') && !noise(m.text())) logs.push({ k:m.type(), t:m.text() }); });
  page.on('pageerror', e => logs.push({ k:'exception', t:e.message }));
  page.ctx = ctx;
  page.logs = logs;
  return page;
}

async function dismissSplash(page){
  for(let i = 0; i < 40; i++){
    const gone = await page.evaluate(() => { const s = document.querySelector('#splash'); return !s || getComputedStyle(s).display === 'none' || getComputedStyle(s).visibility === 'hidden'; }).catch(() => true);
    if(gone) return true;
    if(i === 1) await page.evaluate(() => { const b = document.querySelector('#spSkip'); if(b) b.click(); }).catch(() => {});
    await sleep(260);
  }
  return false;
}

let _phoneSeq = 1000;
function nextPhone(){ return '0912' + String(_phoneSeq++).padStart(7, '0'); }

async function loginBySms(page, base, mockPort, phone = null){
  const ph = phone || nextPhone();
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(900);
  await dismissSplash(page);
  await page.waitForSelector('#gtPhone', { timeout: 15000 });
  await page.waitForSelector('#gtSend:not([disabled])', { timeout: 25000 });
  await page.evaluate(() => { const i = document.querySelector('#gtPhone'); if(i) i.value = ''; });
  await page.type('#gtPhone', ph, { delay: 12 });
  await page.click('#gtSend');
  let sendErr = '';
  try{
    await page.waitForSelector('#gtCode', { timeout: 12000 });
  }catch(e){
    sendErr = await page.evaluate(() => (document.querySelector('#gtMsg') || {}).textContent || '').catch(() => '');
    throw new Error('مرحلهٔ کد باز نشد؛ پیام: ' + sendErr);
  }
  let code = '', last = {};
  for(let i = 0; i < 25 && !code; i++){
    await sleep(300);
    try{
      const r = await fetch(`http://127.0.0.1:${mockPort}/last-code`, { signal: AbortSignal.timeout(1200) });
      last = await r.json();
      code = last.code || '';
    }catch(e){}
  }
  if(!code){
    SERVERS.filter(Boolean).forEach(pr => console.log('   [server log]', (pr.__out || '').split('\n').slice(-6).join(' | ')));
    throw new Error('کد پیامکی از فرستندهٔ ساختگی نیامد — hits=' + (last.hits ?? '?'));
  }
  await page.type('#gtCode', code, { delay: 15 });
  await page.click('#gtOk');
  await page.waitForFunction(() => document.body.dataset.role === 'user', { timeout: 15000 });
  /* راهنمای آغاز پس از نخستین ورود می‌آید — تا آخر می‌رویم */
  for(let i = 0; i < 24; i++){
    const onb = await page.evaluate(() => !!document.querySelector('#onb:not(.hide)')).catch(() => false);
    if(!onb) break;
    await page.evaluate(() => { const b = document.querySelector('#onbNext') || document.querySelector('#onb button.btn'); if(b) b.click(); }).catch(() => {});
    await sleep(320);
  }
  await sleep(500);
}

const shot = async (page, dir, name) => {
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, name + '.png');
  await page.screenshot({ path: target });
  console.log(`  ✓ ${path.relative(ROOT, target)}  ${(fs.statSync(target).size / 1024).toFixed(0)}KB`);
  return target;
};

/* ═══════════ پنج چکِ کنسول ═══════════
   دقیقاً همان‌هایی که در گزارشِ باگ خواسته شده بود — به‌علاوهٔ بررسیِ
   اسلایدرِ واقعیِ برنامه، چون ممکن است نامِ جزء در گزارش با نامِ واقعیِ
   کد یکی نباشد و همین خودش علتِ «کار نمی‌کند» باشد. */
async function diagnose(page, label){
  return await page.evaluate(label => {
    const out = { label };
    /* چک ۱ — آیا کلاس تعریف شده؟ */
    out.check1 = {
      typeofCategoryCarousel: typeof CategoryCarousel,
      typeofHomeCarousel: typeof HomeCarousel,
      typeofInitAllCarousels: typeof window.initAllCarousels,
      typeofInitCarousels: typeof window.initCarousels
    };
    /* چک ۲ — آیا کلاس روی DOM اعمال شده؟ */
    out.check2 = [...document.querySelectorAll('.category-carousel')].map(el => ({
      hasTrack: !!el.querySelector('.carousel-track'),
      slideCount: el.querySelectorAll('.slide').length,
      hasInstance: !!el.__carousel,
      inlineTransform: el.querySelector('.carousel-track')?.style.transform || '(none)',
      id: el.id || '(no id)'
    }));
    out.check2Count = document.querySelectorAll('.category-carousel').length;
    /* چک ۳ — آیا autoplay کار می‌کند؟ (هم‌زمان، نه با انتظار) */
    const track = document.querySelector('.carousel-track');
    out.check3 = {
      trackFound: !!track,
      transformNow: track ? track.style.transform : '(no .carousel-track in DOM)',
      current: track && track.closest('.category-carousel')?.__carousel
        ? track.closest('.category-carousel').__carousel.current : null
    };
    /* چک ۴ — آیا CSS اعمال شده؟ */
    if(track){
      const cs = getComputedStyle(track);
      out.check4 = {
        transition: cs.transition,
        transform: cs.transform,
        overflowParent: getComputedStyle(track.parentElement).overflow,
        displayTrack: cs.display
      };
    }else{
      out.check4 = '(no .carousel-track — nothing to measure)';
    }
    /* اسلایدرِ واقعیِ برنامه.
       نکته: `const HomeCarousel` در اسکریپتِ کلاسیک، ویژگیِ window نیست
       (فقط در دامنهٔ واژگانیِ سراسری می‌نشیند)، پس `window.HomeCarousel`
       همیشه undefined می‌داد و گزارش «ready: null» می‌شد. با شناسهٔ ساده
       و نگهبانِ typeof می‌خوانیمش. */
    const HC = typeof HomeCarousel !== 'undefined' ? HomeCarousel : null;
    const hs = document.querySelector('#homeSlider');
    out.homeSlider = hs ? {
      panels: hs.querySelectorAll('.promo-panel').length,
      dots: hs.querySelectorAll('[data-dot]').length,
      activeIndex: [...hs.querySelectorAll('.promo-panel')].findIndex(p => p.classList.contains('is-active')),
      ready: HC ? HC.ready : null,
      index: HC ? HC.index : null,
      timer: HC ? HC.timer : null,
      pauses: HC ? [...HC.pauses] : [],
      homeScreenActive: !!document.querySelector('#s-home')?.classList.contains('active')
    } : '(no #homeSlider)';
    out.carousels = [...document.querySelectorAll('.category-carousel')].map(el => {
      const c = el.__carousel;
      return {
        cat: el.dataset.cat || '(no data-cat)',
        slides: el.querySelectorAll('.slide').length,
        dots: el.querySelectorAll('.carousel-dots .dot').length,
        current: c ? c.current : null,
        autoplayTimer: c ? (c.timer != null) : null,
        paused: c ? c.paused : null,
        visible: !!el.offsetParent
      };
    });
    return out;
  }, label);
}

/* چک ۳ِ واقعی: پنج ثانیه صبر و دوباره اندازه‌گیری */
async function diagnoseAutoplay(page, ms = 5600){
  const before = await page.evaluate(() => {
    const t = document.querySelector('.carousel-track');
    const h = document.querySelector('#homeSlider');
    return {
      carouselTrack: t ? t.style.transform : null,
      carouselIdxs: [...document.querySelectorAll('.category-carousel')].map(e => e.__carousel?.current ?? null),
      homeIdx: (typeof HomeCarousel !== 'undefined' ? HomeCarousel.index : null),
      homeActive: h ? [...h.querySelectorAll('.promo-panel')].findIndex(p => p.classList.contains('is-active')) : null
    };
  });
  await sleep(ms);
  const after = await page.evaluate(() => {
    const t = document.querySelector('.carousel-track');
    const h = document.querySelector('#homeSlider');
    return {
      carouselTrack: t ? t.style.transform : null,
      carouselIdxs: [...document.querySelectorAll('.category-carousel')].map(e => e.__carousel?.current ?? null),
      homeIdx: (typeof HomeCarousel !== 'undefined' ? HomeCarousel.index : null),
      homeActive: h ? [...h.querySelectorAll('.promo-panel')].findIndex(p => p.classList.contains('is-active')) : null
    };
  });
  return { ms, before, after, changed: JSON.stringify(before) !== JSON.stringify(after) };
}

function printDiagnose(d, ap){
  const L = [];
  const p = s => { L.push(s); console.log(s); };
  p(`\n════ چک‌های کنسول — «${d.label}» ════`);
  p(`چک ۱  typeof CategoryCarousel      = ${JSON.stringify(d.check1.typeofCategoryCarousel)}`);
  p(`      typeof HomeCarousel          = ${JSON.stringify(d.check1.typeofHomeCarousel)}`);
  p(`      typeof initAllCarousels      = ${JSON.stringify(d.check1.typeofInitAllCarousels)}`);
  p(`چک ۲  document.querySelectorAll('.category-carousel').length = ${d.check2Count}`);
  d.check2.forEach((c, i) => p(`      [${i}] hasTrack=${c.hasTrack} slideCount=${c.slideCount} hasInstance=${c.hasInstance} inlineTransform=${c.inlineTransform}`));
  p(`چک ۳  transform لحظه‌ایِ .carousel-track = ${JSON.stringify(d.check3.transformNow)}`);
  p(`      پس از ${ap.ms}ms: ${JSON.stringify(ap.after)}`);
  p(`      پیش از آن:        ${JSON.stringify(ap.before)}`);
  p(`      تغییر کرد؟ ${ap.changed ? '✅ بله' : '❌ خیر'}`);
  p(`چک ۴  ${typeof d.check4 === 'string' ? d.check4 : JSON.stringify(d.check4, null, 6).split('\n').join('\n      ')}`);
  p(`      اسلایدرِ واقعیِ برنامه (#homeSlider): ${JSON.stringify(d.homeSlider)}`);
  return L.join('\n');
}

/* ═══════════ گیف‌ها ═══════════ */
function gifEncoder(){
  const gifenc = require(path.join(ROOT, '_shots_env/node_modules/gifenc'));
  const { PNG } = require(path.join(ROOT, '_shots_env/node_modules/pngjs'));
  return { gifenc, PNG };
}

async function recordGif(page, clip, { frames, step, file, note, onFrame }){
  const { GIFEncoder, quantize, applyPalette } = gifEncoder().gifenc;
  const { PNG } = gifEncoder();
  const gif = GIFEncoder();
  const t0 = Date.now();
  for(let f = 0; f < frames; f++){
    /* حرکتِ واقعی هم‌زمان با ضبط — برای گیفِ کشیدن، انگشت باید در فریم‌ها
       جلو برود، وگرنه فقط یک عکسِ ثابتِ تکراری می‌شود. */
    if(onFrame) await onFrame(f);
    const buf = await page.screenshot({ clip, type: 'png' });
    const img = PNG.sync.read(buf);
    /* gifenc در حالت rgb444 روی همین بافر یک Uint32Array می‌سازد، پس طولش
       باید بر ۴ بخش‌پذیر باشد: w2*h2*3 % 4 === 0 یعنی w2 و h2 هر دو زوج.
       با برشِ عرض/ارتفاع به مضربِ ۴ و نمونه‌گیری هر ۲ پیکسل، این تضمین
       می‌شود — پیش‌تر با یک clip با عرضِ فرد، RangeError می‌داد. */
    const w2 = Math.max(2, Math.floor(img.width / 4) * 2);
    const h2 = Math.max(2, Math.floor(img.height / 4) * 2);
    const data = Buffer.alloc(w2 * h2 * 3);
    for(let y = 0; y < h2; y++) for(let x = 0; x < w2; x++){
      const si = (y * 2 * img.width + x * 2) * 4, di = (y * w2 + x) * 3;
      data[di] = img.data[si]; data[di + 1] = img.data[si + 1]; data[di + 2] = img.data[si + 2];
    }
    const palette = quantize(data, 200, { format: 'rgb444' });
    const idx = applyPalette(data, palette, 'rgb444');
    gif.writeFrame(idx, w2, h2, { palette, delay: step });
    if(step) await sleep(step);
  }
  gif.finish();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, gif.bytes());
  console.log(`  ✓ ${path.relative(ROOT, file)}  ${(fs.statSync(file).size / 1024).toFixed(0)}KB  (${frames} فریم، ${(Date.now() - t0) / 1000 | 0}s)${note ? ' — ' + note : ''}`);
  return file;
}

/* وضعیتِ زندهٔ هر دو کاروسل — برای وقتی که چیزی «حرکت نکرد»، تا معلوم شود
   تایمر نگرفته شده یا دروازه‌ای (pause/hidden/reduced) جلوی آن را گرفته. */
async function motionState(page){
  return await page.evaluate(() => ({
    hidden: document.hidden,
    vis: document.visibilityState,
    reduced: (typeof FX !== 'undefined' && FX.reduced) || null,
    dataMotion: document.documentElement.getAttribute('data-motion'),
    homeActive: !!document.querySelector('#s-home')?.classList.contains('active'),
    home: typeof HomeCarousel !== 'undefined' ? {
      ready: HomeCarousel.ready, index: HomeCarousel.index,
      timer: HomeCarousel.timer != null, pauses: [...HomeCarousel.pauses]
    } : null,
    cats: [...document.querySelectorAll('.category-carousel')].map(e => ({
      cat: e.dataset.cat, current: e.__carousel?.current ?? null,
      timer: (e.__carousel?.timer ?? null) != null,
      pauses: e.__carousel ? [...e.__carousel.pauses] : null,
      visible: e.__carousel?.visible() ?? null,
      slides: e.__carousel?.count ?? null,
      transform: e.querySelector('.carousel-track')?.style.transform || ''
    }))
  }));
}

/* کادرِ عکس. سه نکته:
   - `scroll:false` وقتی خودِ صدازننده پیش‌تر اسکرول کرده است؛
   - مختصاتِ صحیح و بریده به ویوپورت، چون `captureBeyondViewport:false`
     کادرِ بیرونِ صفحه را به «ارتفاعِ صفر» و خطای پروتکل تبدیل می‌کند؛
   - کمینهٔ ۲ پیکسل، تا یک کادرِ لبه‌ای هم خطا ندهد. */
/* ── نرخِ فریم ──
   rAF را در خودِ صفحه می‌شماریم. عددِ مرورگرِ بی‌سرِ روی این ماشین،
   ادعایِ ۶۰FPS روی یک گوشیِ واقعی نیست؛ فقط نشان می‌دهد حلقهٔ رندر
   در حینِ گذارِ کاروسل و کشیدن، عقب نمی‌ماند و فریمِ پرت ندارد. */
async function measureFps(page, ms = 4000){
  return await page.evaluate(ms => new Promise(res => {
    const ts = [];
    const t0 = performance.now();
    const finish = () => {
      if(ts.length < 3) return res({ frames: ts.length, note: 'اندازه‌گیری نشد' });
      const deltas = [];
      for(let i = 1; i < ts.length; i++) deltas.push(ts[i] - ts[i-1]);
      const sorted = deltas.slice().sort((a, b) => a - b);
      const span = (ts[ts.length-1] - ts[0]) / 1000;
      res({ frames: ts.length,
            seconds: +span.toFixed(2),
            fps: Math.round(ts.length / Math.max(.001, span)),
            medianFrameMs: +sorted[Math.floor(sorted.length / 2)].toFixed(2),
            p95FrameMs: +sorted[Math.floor(sorted.length * .95)].toFixed(2),
            worstFrameMs: +sorted[sorted.length - 1].toFixed(2),
            droppedOver32ms: deltas.filter(d => d > 32).length });
    };
    const loop = t => { ts.push(t); if(performance.now() - t0 < ms) requestAnimationFrame(loop); else finish(); };
    requestAnimationFrame(loop);
  }), ms);
}

/* کادرِ عکس، در *مختصاتِ مطلقِ صفحه*.
   `Page.captureScreenshot` با `captureBeyondViewport` (پیش‌فرض) کادر را
   نسبت به کلِ صفحه می‌سنجد، نه نسبت به ویوپورت. پیش‌تر کادر را پس از
   `scrollIntoView` از روی `getBoundingClientRect` (ویوپورت‌نسبی) می‌گرفتیم
   و نتیجه عکسی از بالای صفحه بود، نه از خودِ کاروسل. جمعِ `scrollY` همین
   یک خط، تفاوتِ «شاهدِ درست» و «شاهدِ بی‌ربط» است. */
async function clipOf(page, sel, pad = 8){
  return await page.evaluate((sel, pad) => {
    const el = document.querySelector(sel);
    if(!el) return null;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.round(r.x + window.scrollX - pad));
    const y = Math.max(0, Math.round(r.y + window.scrollY - pad));
    const w = Math.round(r.width + pad * 2);
    const h = Math.round(r.height + pad * 2);
    if(w < 2 || h < 2) return null;
    return { x, y, width: w, height: h };
  }, sel, pad);
}

/* ═══════════ بدنهٔ اصلی ═══════════ */
(async () => {
  const wantDiagnose = hasFlag('diagnose') || (!hasFlag('gif') && !hasFlag('shots'));
  const wantGif = hasFlag('gif') || (!hasFlag('diagnose') && !hasFlag('shots'));
  const wantShots = hasFlag('shots') || (!hasFlag('diagnose') && !hasFlag('gif'));

  fs.mkdirSync(OUT, { recursive: true });
  const mock = await startMockSms();
  const report = { base: BASE, port: PORT, at: new Date().toISOString() };

  const afterProc = await startServer(ROOT, PORT, mock.port, path.join(os.tmpdir(), 'carousel-after-data.json'));
  console.log(`✓ سرورِ «بعد» (درختِ کاری) روی :${PORT}`);
  const { browser } = await bootstrapChrome();
  console.log('✓ مرورگر باز شد');

  let beforeRoot = null, beforeProc = null;
  try{
    /* ── «قبل»: همان کامیتِ پایه، در worktree موقت ── */
    if(wantDiagnose || wantShots){
      beforeRoot = path.join(os.tmpdir(), 'carousel-before');
      try{ execSync(`git worktree remove --force ${beforeRoot} 2>/dev/null || true`, { cwd: ROOT, shell: '/bin/bash' }); }catch(e){}
      execSync(`git worktree add ${beforeRoot} ${BASE}`, { cwd: ROOT, stdio: 'pipe' });
      beforeProc = await startServer(beforeRoot, PORT + 1, mock.port, path.join(os.tmpdir(), 'carousel-before-data.json'));
      console.log(`✓ سرورِ «قبل» (${BASE.slice(0, 7)}) روی :${PORT + 1}`);
    }

    /* ═══ تشخیص ═══ */
    if(wantDiagnose){
      report.diagnose = {};
      for(const [label, root, port] of [['before', beforeRoot, PORT + 1], ['after', ROOT, PORT]]){
        if(!root) continue;
        const page = await newPage(browser);
        await loginBySms(page, `http://127.0.0.1:${port}/index.html`, mock.port);
        await page.evaluate(() => { try{ Router.go('home', true); }catch(e){} });
        await sleep(900);
        const d = await diagnose(page, label);
        const ap = await diagnoseAutoplay(page);
        report.diagnose[label] = { ...d, autoplay: ap, consoleErrors: page.logs };
        printDiagnose(d, ap);
        console.log(`چک ۵  خطاهای کنسول: ${page.logs.length}`);
        page.logs.slice(0, 10).forEach(e => console.log(`        • [${e.k}] ${e.t.slice(0, 160)}`));
        await page.ctx.close();
      }
    }

    /* ═══ عکس‌ها ═══ */
    if(wantShots){
      for(const [label, root, port] of [['before', beforeRoot, PORT + 1], ['after', ROOT, PORT]]){
        if(!root) continue;
        const page = await newPage(browser);
        await loginBySms(page, `http://127.0.0.1:${port}/index.html`, mock.port);
        await page.evaluate(() => { try{ Router.go('home', true); }catch(e){} try{ HomeCarousel.pause('user', true); }catch(e){} });
        await sleep(1000);
        /* تمام‌صفحه: خانه از خوش‌آمد تا مأموریت‌ها، در یک عکس. چون ارتفاعش
           زیاد است، یک عکسِ هم‌اندازهٔ ویوپورت هم می‌گیریم که بدونِ کوچک‌کردن
           خوانا بماند. */
        await shot(page, path.join(OUT, label), '01-home-top');
        /* برشِ خودِ کاروسل *پیش از* عکسِ تمام‌صفحه: fullPage متریکِ دستگاه
           را موقتاً به بلندایِ کلِ صفحه می‌برد و پس از آن، عکسِ بریده با
           کادرِ داخلِ ویوپورت خطای «ارتفاعِ صفر» می‌دهد. */
        const clip = await clipOf(page, '.category-carousel');
        if(clip){
          await page.screenshot({ path: path.join(OUT, label, '03-carousel.png'), clip });
          console.log(`  ✓ ${path.relative(ROOT, path.join(OUT, label, '03-carousel.png'))}  (برشِ کاروسل)`);
        }
        fs.mkdirSync(path.join(OUT, label), { recursive: true });
        const full = path.join(OUT, label, '02-home-full.png');
        /* تمام‌صفحه در DPR=2 نزدیکِ ۲٫۳MB می‌شد؛ با DPR=1 هم خواناست و
           یک‌چهارمِ حجم. عکس‌های ویوپورتی بالا همان DPR=2 را دارند. */
        await page.setViewport({ width: W, height: H, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        await sleep(350);
        await page.screenshot({ path: full, fullPage: true });
        console.log(`  ✓ ${path.relative(ROOT, full)}  ${(fs.statSync(full).size / 1024).toFixed(0)}KB  (تمام‌صفحه)`);
        await page.ctx.close();
      }
    }

    /* ═══ پوستهٔ روشن: همان بخش‌های تازه، با پوستهٔ دیگر ═══
       قاعده‌های کاروسل از متغیرهای CSS می‌آیند؛ این عکس ثابت می‌کند که
       طلایی/خط/سایه در پوستهٔ روشن هم خوانا می‌مانند. */
    if(wantShots){
      const page = await newPage(browser, { scheme: 'light' });
      await loginBySms(page, `http://127.0.0.1:${PORT}/index.html`, mock.port);
      await page.evaluate(() => { try{ Router.go('home', true); }catch(e){} try{ HomeCarousel.pause('user', true); }catch(e){} });
      await sleep(900);
      const clip = await clipOf(page, '#homeQuickStats');
      const clip2 = await clipOf(page, '.category-carousel');
      if(clip && clip2){
        const both = { x: Math.min(clip.x, clip2.x), y: clip.y,
                       width: Math.max(clip.width, clip2.width),
                       height: (clip2.y + clip2.height) - clip.y };
        await page.screenshot({ path: path.join(OUT, 'after', '04-light-theme.png'), clip: both });
        console.log(`  ✓ ${path.relative(ROOT, path.join(OUT, 'after', '04-light-theme.png'))}  (پوستهٔ روشن)`);
      }
      report.consoleErrorsLight = page.logs;
      await page.ctx.close();
    }

    /* ═══ گیف‌ها ═══ */
    if(wantGif){
      const page = await newPage(browser);
      await loginBySms(page, `http://127.0.0.1:${PORT}/index.html`, mock.port);
      await page.evaluate(() => { try{ Router.go('home', true); }catch(e){} });
      await sleep(900);

      /* ۱) حرکتِ خودکارِ اسلایدرِ بنر خانه */
      const sliderClip = await clipOf(page, '#homeSlider');
      console.log('  · پیش از گیفِ اسلایدر:', JSON.stringify(await motionState(page)));
      if(sliderClip){
        await page.evaluate(() => { try{ HomeCarousel.pause('user', false); HomeCarousel.paintPause(); HomeCarousel.schedule(); }catch(e){} });
        const i0 = await page.evaluate(() => HomeCarousel.index);
        await recordGif(page, sliderClip, { frames: 40, step: 220,
          file: path.join(OUT, 'home-slider-autoplay.gif') });
        const i1 = await page.evaluate(() => HomeCarousel.index);
        report.homeSliderAutoplay = { indexBefore: i0, indexAfter: i1, moved: i0 !== i1 };
        console.log(`  · ایندکسِ اسلایدر: ${i0} → ${i1}`);
      }

      /* ۲) حرکتِ خودکارِ کاروسلِ دسته‌ها */
      const catClip = await clipOf(page, '.category-carousel');
      console.log('  · کادرِ کاروسل:', JSON.stringify(catClip), 'ویوپورت:', JSON.stringify(await page.evaluate(() => ({
        vw: window.innerWidth, vh: window.innerHeight, sy: window.scrollY,
        docH: document.documentElement.scrollHeight,
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
        rect: (r => ({ x:r.x, y:r.y, w:r.width, h:r.height }))(document.querySelector('.category-carousel').getBoundingClientRect())
      }))));
      console.log('  · پیش از گیفِ کاروسل:', JSON.stringify(await motionState(page)));
      if(catClip){
        const s0 = await page.evaluate(() => [...document.querySelectorAll('.category-carousel')].map(e => e.__carousel?.current ?? null));
        await recordGif(page, catClip, { frames: 44, step: 200,
          file: path.join(OUT, 'category-carousel-autoplay.gif') });
        const s1 = await page.evaluate(() => [...document.querySelectorAll('.category-carousel')].map(e => e.__carousel?.current ?? null));
        report.stateAfterCategoryGif = await motionState(page);
        console.log('  · پس از گیفِ کاروسل:', JSON.stringify(report.stateAfterCategoryGif));
        report.categoryAutoplay = { currentBefore: s0, currentAfter: s1, moved: JSON.stringify(s0) !== JSON.stringify(s1) };
        console.log(`  · current کاروسل‌ها: ${JSON.stringify(s0)} → ${JSON.stringify(s1)}`);

        /* ۳) کشیدن با اشاره‌گر — ضبط هم‌زمان با خودِ کشیدن.
           پیش از اندازه‌گیری، کاروسل را دوباره وسطِ ویوپورت می‌آوریم و
           مطمئن می‌شویم واقعاً داخل کادر است؛ عکس‌های قبلی می‌توانند
           اسکرول را جابه‌جا کنند و آن‌وقت mouse روی عنصرِ دیگری می‌نشیند. */
        const box = await page.evaluate(() => {
          const el = document.querySelector('.category-carousel');
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height,
                   vh: window.innerHeight, vw: window.innerWidth };
        });
        await sleep(400);
        if(box.y < 0 || box.y + box.height > box.vh) throw new Error('کاروسل داخل ویوپورت نیست: ' + JSON.stringify(box));
        /* کادرِ گیفِ کشیدن باید *پس از* این اسکرول گرفته شود؛ کادرِ گیفِ
           حرکتِ خودکار به اسکرولِ پیشین تعلق داشت و حالا بیرونِ صفحه بود. */
        const dragClip = await clipOf(page, '.category-carousel', 8);
        if(!dragClip) throw new Error('کادرِ کاروسل برای گیفِ کشیدن به دست نیامد');
        const y = box.y + box.height / 2;
        const c0 = await page.evaluate(() => document.querySelector('.category-carousel').__carousel?.current);
        /* حرکتِ خودکار را می‌خوابانیم تا تنها چیزی که در گیف می‌جنبد، انگشتِ ماست */
        await page.evaluate(() => {
          document.querySelectorAll('.category-carousel').forEach(e => e.__carousel?.pause?.(true));
        });
        const STEPS = 22, TRAVEL = box.width * .62;
        const startX = box.x + box.width * .78;
        await page.mouse.move(startX, y);
        /* چه چیزی زیرِ نشانگر است؟ اگر اسلاید نباشد، کشیدن بی‌اثر می‌ماند
           و گیف «کار نمی‌کند» را نشان می‌دهد بی آن‌که علتش معلوم باشد. */
        const hit = await page.evaluate(([x, yy]) => {
          const e = document.elementFromPoint(x, yy);
          return e ? (e.className && String(e.className)) + ' <' + e.tagName + '>' : '(none)';
        }, [startX, y]);
        console.log('  · زیرِ نشانگر:', hit);
        await page.mouse.down();
        await recordGif(page, dragClip, {
          frames: STEPS + 8, step: 0,
          file: path.join(OUT, 'category-carousel-drag.gif'),
          note: 'کشیدن زنده با اشاره‌گر',
          onFrame: async f => {
            if(f <= STEPS){
              await page.mouse.move(startX - TRAVEL * f / STEPS, y);
              await sleep(24);
            }else if(f === STEPS + 1){
              await page.mouse.up();          // رهاکردن و فنر/اینرسی
              await sleep(120);
            }else{
              await sleep(120);               // دیدنِ گذارِ ۸۰۰ms پس از رهاکردن
            }
          }
        });
        await sleep(1000);
        const c1 = await page.evaluate(() => document.querySelector('.category-carousel').__carousel?.current);
        console.log('  · پس از کشیدن:', JSON.stringify(await motionState(page)));
        report.drag = { currentBefore: c0, currentAfter: c1, moved: c0 !== c1 };
        console.log(`  · کشیدن: current ${c0} → ${c1} ${c0 !== c1 ? '✅' : '❌'}`);
      }else{
        report.categoryAutoplay = '(no .category-carousel in DOM)';
        console.log('  · .category-carousel در DOM نیست — گیفی ساخته نشد');
      }
      /* نرخِ فریم در سه حالت: بی‌کار، حینِ حرکتِ خودکار، حینِ کشیدن */
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      const cc = await clipOf(page, '.category-carousel');
      report.fpsIdle = await measureFps(page, 3000);
      console.log('  · FPS بی‌کار (کاروسل روی صفحه):', JSON.stringify(report.fpsIdle));
      if(cc){
        await page.evaluate(() => { try{ document.querySelector('.category-carousel').__carousel.go(2); }catch(e){} });
        report.fpsTransition = await measureFps(page, 1200);
        console.log('  · FPS حینِ گذارِ ۸۰۰ms:', JSON.stringify(report.fpsTransition));
        const b = await page.evaluate(() => {
          const r = document.querySelector('.category-carousel').getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
        const yy = b.y + b.height / 2;
        await page.mouse.move(b.x + b.width * .7, yy);
        await page.mouse.down();
        const dragging = (async () => {
          for(let i = 1; i <= 40; i++){
            await page.mouse.move(b.x + b.width * .7 - (b.width * .5 * Math.sin(i / 40 * Math.PI * 2)), yy);
            await sleep(16);
          }
        })();
        report.fpsDrag = await measureFps(page, 2500);
        await dragging;
        await page.mouse.up();
        console.log('  · FPS حینِ کشیدنِ پیوسته:', JSON.stringify(report.fpsDrag));
      }
      report.consoleErrors = page.logs;
      await page.ctx.close();
    }
  } finally {
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log('\n── report.json نوشته شد: ' + path.relative(ROOT, path.join(OUT, 'report.json')));
    await browser.close().catch(() => {});
    SERVERS.forEach(p => { try{ p.kill(); }catch(e){} });
    mock.srv.close();
    if(beforeRoot){ try{ execSync(`git worktree remove --force ${beforeRoot}`, { cwd: ROOT, stdio: 'pipe' }); }catch(e){} }
    console.log('تمام شد. خروجی: ' + path.relative(ROOT, OUT));
    setTimeout(() => process.exit(0), 300);
  }
})().catch(e => { console.error('❌', e); SERVERS.forEach(p => { try{ p.kill(); }catch(x){} }); process.exit(1); });
