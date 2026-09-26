#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   _phase3-shots.js — شواهدِ عینیِ فاز ۳ (ابزار توسعه، نه بخشی از برنامه)

   چه چیزی می‌سازد؟
     ۱) عکسِ «قبل» از نسخهٔ HEAD (worktree موقت) و عکسِ «بعد» از نسخهٔ
        فعلی — از همان صفحه‌ها، همان ویوپورت، همان شرایط.
     ۲) گیفِ اسلایدرِ خانه در حالِ حرکتِ خودکار (فقط نسخهٔ بعد).
     ۳) شاهدِ مُهرِ پوشانندهٔ بنر: پوستهٔ میزبانِ بازی با یک شبیه‌سازِ
        محلیِ همان بنر بازسازی می‌شود (درخواستِ arena.site در مرورگرِ
        آزمون رهگیری و به صفحهٔ محلی هدایت می‌شود) تا معلوم شود مُهر،
        بنرِ گوشهٔ پایین-راست را می‌پوشاند و دکمه‌های اصلی بازی آزادند.

   اجرا:
     node _phase3-shots.js
     node _phase3-shots.js --skip-before --skip-gif

   نکته: PNG/GIF طبق قاعدهٔ مخزن در Git ثبت نمی‌شوند؛ خروجی در
   screenshots/phase3/ می‌نشیند.
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
const BASE_PORT = 8821;

const argOf = (n, d) => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').slice(n.length + 3) || d;
const hasFlag = n => process.argv.includes('--' + n);
const OUT = path.resolve(ROOT, argOf('out', 'screenshots/phase3'));
const SERVERS = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    /* از C.args کامل استفاده نمی‌کنیم: «single-process» با کانتکست‌های
       مستقلِ incognito کنار نمی‌آید و ساختِ تبِ دوم فرو می‌ریزد. */
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
           '--disable-gpu', '--hide-scrollbars', '--mute-audio',
           '--font-render-hinting=none', '--force-color-profile=srgb']
  });
  return { puppeteer, browser };
}

/* ═══════════ فرستندهٔ پیامکِ ساختگی + شبیه‌سازِ پوستهٔ میزبانِ بازی ═══════════ */
function startMockServices(){
  const hits = [];
  const http = require('http');
  /* صفحهٔ شبیه‌ساز: همان بنرِ ثابتِ پایین-راستِ پوستهٔ میزبان + صحنهٔ سادهٔ بازی.
     عمداً برچسب «شبیه‌سازِ محلی» بالای صفحه هست تا این شاهد، واقعی‌نما نباشد. */
  const shellPage = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>نورِ آیه‌ها | بازی قرآنی سه‌بعدی</title><style>
html,body{margin:0;height:100%;font-family:sans-serif}
.scene{position:fixed;inset:0;background:linear-gradient(180deg,#0e1e33,#123047 55%,#1c4a3f);color:#dfe9f5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.scene .arch{width:140px;height:190px;border:2px solid #e9c976aa;border-radius:70px 70px 8px 8px;display:grid;place-items:center;color:#e9c976;font-size:15px;text-align:center;line-height:2}
.cta{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:#e9c976;color:#12203a;padding:12px 34px;border-radius:14px;font-weight:700;font-size:16px}
.tag{position:fixed;top:10px;left:10px;background:#0008;color:#9fb4d0;font-size:11px;padding:4px 8px;border-radius:8px}
/* ── بازسازیِ دقیقِ بنر پوستهٔ میزبان (طبق سورس واقعی) ── */
.floating-banner{position:fixed;bottom:20px;right:20px;z-index:1000;display:flex;align-items:center;gap:8px;background:#101725;color:#fff;border:1px solid #ffffff26;border-radius:10px;padding:10px 14px;font-size:13px;text-decoration:none;box-shadow:0 8px 24px #0008}
.floating-banner .fb-badge{background:#4c6ef5;color:#fff;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:700}
</style></head><body>
<div class="scene"><div class="arch">نامهٔ نور<br>ترتیب آیه</div><div>سؤال ۳ از ۱۰</div></div>
<button class="cta">ادامه</button>
<div class="tag">شبیه‌سازِ محلیِ پوستهٔ میزبان — نه سرور واقعی</div>
<a class="floating-banner" href="#"><span class="fb-badge">Built with Arena</span><span>Content is user-generated and unverified</span></a>
</body></html>`;
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
    if(req.url.startsWith('/shell')){
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      return res.end(shellPage);
    }
    res.writeHead(404); res.end();
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port, hits })));
}

/* ═══════════ سرورِ نورستان برای یک ریشهٔ مشخص ═══════════ */
function startServer(root, port, smsPort, dataFile){
  /* پیش‌پرواز: اگر مانعی روی پورت هست (سِروِرِ کهنهٔ اجرای قبل) پایین بیاور */
  try{ execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { shell: '/bin/bash' }); }catch(e){}
  const proc = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1',
           NOOR_DATA: dataFile, NOOR_ADMIN_PASS: ADMIN_PASS,
           NOOR_SMS_KEY: 'test-key', NOOR_SMS_DEVICE: 'test-device',
           NOOR_SMS_ENDPOINT: `http://127.0.0.1:${smsPort}/sms`,
           NOOR_SMS_MAX_IP: '500', NOOR_SMS_MAX_HOUR: '1000' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  proc.stdout.on('data', d => out += d); proc.stderr.on('data', d => out += d);
  proc.__out = ''; Object.defineProperty(proc, '__out', { get(){ return out; } });
  SERVERS.push(proc);
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = async () => {
      if(proc.exitCode !== null) return reject(new Error('server died\n' + out));
      try{
        const r = await fetch(`http://127.0.0.1:${port}/index.html`, { method:'HEAD', signal: AbortSignal.timeout(1200) });
        if(r.ok) return resolve(proc);
      }catch(e){}
      if(Date.now() - t0 > 20000) return reject(new Error('server not up\n' + out));
      setTimeout(poll, 300);
    };
    poll();
  });
}

/* ═══════════ کمک‌کارهای صفحه ═══════════ */
async function newPage(browser, { mobile = true } = {}){
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR, isMobile: mobile, hasTouch: mobile });
  const logs = [];
  const noise = t => /Failed to load resource|net::|ERR_|WebSocket|favicon|arena\.site/i.test(t);
  page.on('console', m => { if((m.type()==='error'||m.type()==='warning') && !noise(m.text())) logs.push({k:m.type(), t:m.text()}); });
  page.on('pageerror', e => logs.push({ k:'exception', t:e.message }));
  page.ctx = ctx;
  page.logs = logs;
  return page;
}

async function dismissSplash(page){
  /* پردهٔ آغازین تا کامل کنار نرود (۱.۴s انیمیشن خروج + حذف از DOM)
     هر کلیک را می‌بلعد؛ پس صبر می‌کنیم تا واقعاً برداشته شود. */
  for(let i = 0; i < 40; i++){
    const gone = await page.evaluate(() => { const s = document.querySelector('#splash'); return !s || getComputedStyle(s).display === 'none' || getComputedStyle(s).visibility === 'hidden'; }).catch(() => true);
    if(gone) return true;
    if(i === 1) await page.evaluate(() => { const b = document.querySelector('#spSkip'); if(b) b.click(); }).catch(() => {});
    await sleep(260);
  }
  return false;
}

/* ورود واقعی با پیامک (از طریق دروازهٔ خود برنامه) */
async function loginBySms(page, base, mockPort){
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(900);
  await dismissSplash(page);
  await page.waitForSelector('#gtPhone', { timeout: 15000 });
  /* دکمهٔ ارسال تا آماده‌شدنِ پیامکِ سرور غیرفعال است — منتظر می‌مانیم */
  await page.waitForSelector('#gtSend:not([disabled])', { timeout: 25000 });
  await page.evaluate(() => { const i = document.querySelector('#gtPhone'); if(i) i.value = ''; });
  await page.type('#gtPhone', PHONE, { delay: 12 });
  await page.click('#gtSend');
  /* منتظرِ رفتن به مرحلهٔ کد — با گزارشِ وضعیت برای ردگیری */
  let sendErr = '';
  try{
    await page.waitForSelector('#gtCode', { timeout: 12000 });
  }catch(e){
    sendErr = await page.evaluate(() => (document.querySelector('#gtMsg')||{}).textContent || '').catch(() => '');
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
    SERVERS.filter(Boolean).forEach(pr => console.log('   [server log]', (pr.__out||'').split('\n').slice(-6).join(' | ')));
    throw new Error('کد پیامکی از فرستندهٔ ساختگی نیامد — hits=' + (last.hits ?? '?'));
  }
  await page.waitForSelector('#gtCode', { timeout: 10000 });
  await page.type('#gtCode', code, { delay: 15 });
  await page.click('#gtOk');
  await page.waitForFunction(() => document.body.dataset.role === 'user', { timeout: 15000 });
  await sleep(500);
}

const shot = async (page, dir, name) => {
  const target = path.join(dir, name + '.png');
  await page.screenshot({ path: target });
  console.log(`  ✓ ${path.relative(ROOT, target)}  ${(fs.statSync(target).size/1024).toFixed(0)}KB`);
  return target;
};

/* ═══════════ یک مجموعهٔ کامل از عکس‌ها برای یک ریشه ═══════════ */
async function suite(browser, label, root, port, mockPort, opts = {}){
  const dir = path.join(OUT, label);
  fs.mkdirSync(dir, { recursive: true });
  const base = `http://127.0.0.1:${port}/index.html`;
  const report = { label, shots: [], errors: [] };
  console.log(`\n── مجموعهٔ «${label}» از ${base}`);

  /* ۰۱ — صفحهٔ ورود (بدون هیچ نشستی) */
  {
    const page = await newPage(browser);
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1100); await dismissSplash(page); await sleep(300);
    await shot(page, dir, '01-gate');
    report.errors.push(...page.logs);
    await page.ctx.close();
  }

  /* صفحه‌های کاربرِ واردشده — یک نشستِ واقعی با پیامک */
  const page = await newPage(browser);
  await loginBySms(page, base, mockPort);
  /* راهنمای آغاز پس از نخستین ورود می‌آید — تا آخر می‌رویم */
  for(let i = 0; i < 24; i++){
    const onb = await page.evaluate(() => !!document.querySelector('#onb:not(.hide)')).catch(() => false);
    if(!onb) break;
    await page.evaluate(() => { const b = document.querySelector('#onbNext') || document.querySelector('#onb button.btn'); if(b) b.click(); }).catch(() => {});
    await sleep(320);
  }
  const nav = async fn => { await page.evaluate(() => { try{ UI.closeModal(); }catch(e){} }); await fn(); await sleep(650); };

  await page.evaluate(() => { try{ Router.go('home', true); }catch(e){} try{ HomeCarousel.pause('user', true); }catch(e){} });
  await sleep(750);
  await shot(page, dir, '02-home');

  await nav(async () => page.evaluate(() => Games.settings()));
  await shot(page, dir, '03-settings');

  await nav(async () => page.evaluate(() => Games.shop()));
  await shot(page, dir, '04-shop');

  await nav(async () => page.evaluate(() => Router.go('me')));
  await shot(page, dir, '05-me');

  await nav(async () => page.evaluate(() => { document.querySelector('#pgBody').innerHTML = ''; Router.go('play'); Launcher.open(); }));
  await shot(page, dir, '06-play');

  await nav(async () => page.evaluate(() => Router.go('online')));
  await shot(page, dir, '07-online');

  await nav(async () => page.evaluate(() => Router.go('quran')));
  await shot(page, dir, '08-quran');

  /* ۰۹ — صفحهٔ ورودِ مدیر از مسیر #admin (تنها مسیر).
     تغییرِ هشِ تنها، سند را دوباره بار نمی‌کند؛ با reloadِ واقعی، همان
     مسیری که کاربرِ واقعی می‌رود (بارگذاریِ نشانیِ مستقیم) آزمایش می‌شود:
     Session.restore → تأیید سرور → در نبود توکنِ مدیر، صفحهٔ #alog. */
  await page.goto(base + '#admin', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1100); await dismissSplash(page);
  await page.waitForSelector('#adminPassword', { timeout: 20000 });
  await sleep(600);
  const alogOpen = await page.evaluate(() => !document.querySelector('#alog')?.classList.contains('hide'));
  if(!alogOpen) await page.evaluate(() => { try{ AdminLogin.open(); }catch(e){} });
  await sleep(500);
  await shot(page, dir, '09-admin-login');

  /* ۱۰ — پنل مدیریت پس از ورود موفق */
  await page.waitForSelector('#adminPassword', { timeout: 10000 });
  await page.type('#adminPassword', ADMIN_PASS, { delay: 10 });
  await page.click('#adminSignIn');
  await page.waitForFunction(() => document.querySelector('#s-admin')?.classList.contains('active') &&
                                       !document.querySelector('#adminMain')?.classList.contains('hide'), { timeout: 15000 });
  await sleep(700);
  await shot(page, dir, '10-admin-panel');
  report.errors.push(...page.logs);
  await page.ctx.close();
  return report;
}

/* ═══════════ گیفِ اسلایدر خانه — حرکتِ خودکار ═══════════ */
async function sliderGif(browser, root, port, mockPort){
  const dir = OUT; fs.mkdirSync(dir, { recursive: true });
  const base = `http://127.0.0.1:${port}/index.html`;
  console.log('\n── گیفِ اسلایدر (حرکت خودکار)');
  const page = await newPage(browser);
  await loginBySms(page, base, mockPort);
  await page.evaluate(() => { try{ Router.go('home', true); }catch(e){} });
  await sleep(700);
  const clip = await page.evaluate(() => {
    const r = document.querySelector('#homeSlider').getBoundingClientRect();
    return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y - 6),
             width: Math.min(390, r.width + 12), height: r.height + 12 };
  });
  /* کلید توقفِ خودکار را رها می‌کنیم تا چرخش از سر بگیرد */
  await page.evaluate(() => { try{ HomeCarousel.pause('user', false); HomeCarousel.paintPause(); HomeCarousel.schedule(); }catch(e){} });
  const FRAMES = 46, STEP = 220;
  const gifenc = require(path.join(ROOT, '_shots_env/node_modules/gifenc'));
  const { GIFEncoder, quantize, applyPalette } = gifenc;
  const gif = GIFEncoder();
  const started = Date.now();
  for(let f = 0; f < FRAMES; f++){
    const buf = await page.screenshot({ clip, type: 'png' });
    const { PNG } = require(path.join(ROOT, '_shots_env/node_modules/pngjs'));
    if(!PNG) throw new Error('pngjs در دسترس نیست');
    const img = PNG.sync.read(buf);
    /* نیم‌اندازه برای حجم کمتر */
    const w2 = Math.floor(img.width / 2), h2 = Math.floor(img.height / 2);
    const data = Buffer.alloc(w2 * h2 * 3);
    for(let y = 0; y < h2; y++) for(let x = 0; x < w2; x++){
      const si = (y * 2 * img.width + x * 2) * 4, di = (y * w2 + x) * 3;
      data[di] = img.data[si]; data[di+1] = img.data[si+1]; data[di+2] = img.data[si+2];
    }
    const palette = quantize(data, 200, { format: 'rgb444' });
    const idx = applyPalette(data, palette, 'rgb444');
    gif.writeFrame(idx, w2, h2, { palette, delay: STEP });
  }
  gif.finish();
  const target = path.join(dir, 'slider-autoplay.gif');
  fs.writeFileSync(target, gif.bytes());
  console.log(`  ✓ ${path.relative(ROOT, target)}  ${(fs.statSync(target).size/1024).toFixed(0)}KB  (${FRAMES} فریم، ${(Date.now()-started)/1000|0}s)`);
  /* index پس از گیف — برای گزارش */
  const idxLog = await page.evaluate(() => HomeCarousel.index);
  console.log(`  · ایندکسِ اسلاید در پایان گیف: ${idxLog} (باید > 0 باشد یعنی چرخش رخ داده)`);
  await page.ctx.close();
  return idxLog;
}

/* ═══════════ شاهدِ مُهرِ پوشانندهٔ بنر ═══════════ */
async function bannerMaskProof(browser, root, port, mockPort){
  const dir = OUT;
  const base = `http://127.0.0.1:${port}/index.html`;
  console.log('\n── شاهدِ مُهرِ پوشانندهٔ بنر (شبیه‌سازِ محلیِ پوسته)');
  const page = await newPage(browser);
  await page.setRequestInterception(true);
  page.on('request', req => {
    if(/arena\.site/.test(req.url())) return req.continue({ url: `http://127.0.0.1:${mockPort}/shell` });
    req.continue();
  });
  await loginBySms(page, base, mockPort);
  await page.evaluate(() => { try{ AyahEmbed.open(); }catch(e){ console.warn(e); } });
  await sleep(1800);
  /* تمام‌صفحه‌شدن در هدلس ممکن است رد شود؛ مُهر را روی خودِ قاب سنجیده‌ایم
     چون بنرِ میزبان هم نسبت به قاب سنجیده می‌شود. */
  await shot(page, dir, '11-banner-mask');
  const maskInfo = await page.evaluate(() => {
    const m = document.querySelector('#ayahBannerMask');
    const f = document.querySelector('#ayahFrame');
    const banner = f && f.contentDocument ? f.contentDocument.querySelector('.floating-banner') : null;
    if(!m || !f) return null;
    const r = m.getBoundingClientRect(), fr = f.getBoundingClientRect();
    /* بنرِ واقعیِ پوسته اگر در قاب بود، کجاشدنش را نسبت به قاب می‌سنجیم */
    let coversBannerPoint = null;
    if(banner){
      const br = banner.getBoundingClientRect();
      const bx = fr.left + br.right - 60, by = fr.top + br.bottom - 24;
      coversBannerPoint = bx >= r.left && bx <= r.right && by >= r.top && by <= r.bottom;
    }else{
      const bx = fr.right - 60, by = fr.bottom - 30;
      coversBannerPoint = bx >= r.left && bx <= r.right && by >= r.top && by <= r.bottom;
    }
    return { w: Math.round(r.width), h: Math.round(r.height),
             anchor: 'frame-bottom-right', coversBannerPoint };
  });
  console.log('  · هندسهٔ مُهر:', JSON.stringify(maskInfo));
  await page.ctx.close();
  return maskInfo;
}

/* ═══════════ اجرا ═══════════ */
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mock = await startMockServices();
  console.log(`✓ سرویس‌های ساختگی روی :${mock.port}`);

  /* worktree موقتِ HEAD برای عکسِ «قبل» */
  let beforeRoot = null, beforeProc = null;
  if(!hasFlag('skip-before')){
    /* «قبل» = کامیتِ پایهٔ این جلسه (43ceb64، سرِ main) — همان جایی که
       تغییرهای این فاز هنوز اعمال نشده‌اند. */
    beforeRoot = '/tmp/p3-before';
    try{ execSync(`git worktree remove --force ${beforeRoot} 2>/dev/null || true`, { cwd: ROOT, shell: '/bin/bash' }); }catch(e){}
    execSync(`git worktree add ${beforeRoot} 43ceb64`, { cwd: ROOT, stdio: 'pipe' });
    beforeProc = await startServer(beforeRoot, BASE_PORT, mock.port, path.join(os.tmpdir(), 'p3-before-data.json'));
    console.log(`✓ سرورِ «قبل» روی :${BASE_PORT}`);
  }
  const afterPort = BASE_PORT + 1;
  const afterProc = await startServer(ROOT, afterPort, mock.port, path.join(os.tmpdir(), 'p3-after-data.json'));
  console.log(`✓ سرورِ «بعد» روی :${afterPort}`);

  const { browser } = await bootstrapChrome();
  console.log('✓ مرورگر باز شد');

  const reports = {};
  try{
    if(beforeProc) reports.before = await suite(browser, 'before', beforeRoot, BASE_PORT, mock.port);
    if(!hasFlag('skip-after')) reports.after = await suite(browser, 'after', ROOT, afterPort, mock.port);
    if(!hasFlag('skip-gif') && !hasFlag('skip-mask')){
      reports.sliderIndex = await sliderGif(browser, ROOT, afterPort, mock.port);
      reports.mask = await bannerMaskProof(browser, ROOT, afterPort, mock.port);
    }
  } finally {
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(reports, null, 2));
    const errs = [
      ...Object.values(reports).flatMap(r => r && r.errors ? r.errors : [])
    ].filter(e => !/arena\.site|net::|ERR_|Failed to fetch|Failed to load resource/i.test(e.t));
    console.log(`\n── خطاهای کنسول (غیرشبکه‌ای): ${errs.length}`);
    errs.slice(0, 12).forEach(e => console.log(`  • [${e.k}] ${e.t.slice(0, 180)}`));
    await browser.close().catch(() => {});
    if(beforeProc) beforeProc.kill(); afterProc.kill(); mock.srv.close();
    try{ if(beforeRoot) execSync(`git worktree remove --force ${beforeRoot}`, { cwd: ROOT, stdio: 'pipe' }); }catch(e){}
    console.log('\nتمام شد. خروجی: ' + OUT);
  }
})().catch(e => { console.error('❌', e); process.exit(1); });
