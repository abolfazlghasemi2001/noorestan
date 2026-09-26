#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   _p1-landscape.js — راستی‌آزماییِ حالتِ افقیِ «نورِ آیه‌ها» (فاز ۱.۲)
   ابزار توسعه، نه بخشی از برنامه.

   چه می‌کند؟
     ۱) سرور نورستان + فرستندهٔ پیامکِ ساختگی + شبیه‌سازِ پوستهٔ میزبان
        (یک بازیِ افقیِ ساختگی با «سؤال» ثابت و ۴ گزینه) بالا می‌آورد.
     ۲) با ویوپورتِ افقیِ موبایل (844×390) وارد می‌شود، AyahEmbed.open()
        را صدا می‌زند و هندسه را می‌سنجد:
        · آیا قاب از ویوپورت بلندتر است (اسکرولِ صفحه)؟
        · آیا fullscreen روی #ayahGame اعمال می‌شود؟
        · آیا گزینه‌های داخلِ بازیِ ساختگی دیده و لمس می‌شوند؟
     ۳) خروجی: screenshots/phase1/landscape-{before,after}.png + report.json

   اجرا:  node _p1-landscape.js [--tag=before] [--port=8831]
   ═══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { spawn, execSync } = require('child_process');

const ROOT = __dirname;
const LW = 844, LH = 390, DPR = 2;   // موبایلِ افقی
const ADMIN_PASS = 'noor-admin-1403';
const PHONE = '09123456789';
const argOf = (n, d) => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').slice(n.length + 3) || d;
const TAG = argOf('tag', 'after');
const PORT = +argOf('port', 8831);
const OUT = path.join(ROOT, 'screenshots/phase1');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SERVERS = [];

/* ── مرورگر ── */
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
  return browser;
}

/* ── پیامکِ ساختگی + بازیِ افقیِ ساختگی ── */
function startMockServices(){
  const hits = [];
  const http = require('http');
  /* بازیِ ساختگیِ افقی: سؤالِ ثابت بالا + ۴ گزینه + دکمهٔ ادامه.
     اگر قابِ والد ارتفاعِ اشتباه بدهد، این چیدمانِ داخلی به‌هم می‌ریزد
     (سؤال روی گزینه‌ها) — دقیقاً همان گزارشِ کاربر. */
  const landPage = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>mock landscape game</title><style>
html,body{margin:0;height:100%;font-family:sans-serif;background:#0e1e33;color:#e9f1fb}
.g{min-height:100%;display:flex;flex-direction:column}
.q{position:sticky;top:0;background:#13283f;border-bottom:2px solid #e9c976;color:#e9c976;
   font-size:20px;text-align:center;padding:14px 10px;z-index:5}
.opts{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px;align-content:center}
.opt{background:#1b3a55;border:1px solid #e9c97666;border-radius:12px;color:#fff;
     font-size:16px;padding:18px 8px;cursor:pointer}
.cta{margin:0 auto 26px;background:#e9c976;color:#12203a;padding:12px 44px;border-radius:14px;
     font-weight:700;font-size:16px;border:0}
.tag{position:fixed;top:8px;left:8px;background:#0009;color:#9fb4d0;font-size:11px;
     padding:4px 8px;border-radius:8px;z-index:9}
.floating-banner{position:fixed;bottom:20px;right:20px;z-index:1000;display:flex;align-items:center;gap:8px;
 background:#101725;color:#fff;border:1px solid #ffffff26;border-radius:10px;padding:10px 14px;font-size:13px}
.floating-banner .fb-badge{background:#4c6ef5;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:700}
</style></head><body>
<div class="g"><div class="q" id="mq">سؤالِ ساختگی: این متن روی گزینه‌ها می‌افتد؟</div>
<div class="opts"><button class="opt">گزینهٔ یک</button><button class="opt">گزینهٔ دو</button><button class="opt">گزینهٔ سه</button><button class="opt">گزینهٔ چهار</button></div>
<button class="cta" id="mcta">ادامه</button></div>
<div class="tag">شبیه‌سازِ محلیِ بازیِ افقی — نه سرور واقعی</div>
<a class="floating-banner" href="#"><span class="fb-badge">Built with Arena</span><span>mock</span></a>
<script>window.__mockGame = { q: 1, opts: 4 };</script>
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
      return res.end(JSON.stringify({ code, hits: hits.length }));
    }
    if(req.url.startsWith('/land')){
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
      return res.end(landPage);
    }
    res.writeHead(404); res.end();
  });
  return new Promise(resolve => srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port, hits })));
}

function startServer(root, port, smsPort, dataFile){
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
  SERVERS.push(proc);
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = async () => {
      if(proc.exitCode !== null) return reject(new Error('server died'));
      try{
        const r = await fetch(`http://127.0.0.1:${port}/index.html`, { method:'HEAD', signal: AbortSignal.timeout(1200) });
        if(r.ok) return resolve(proc);
      }catch(e){}
      if(Date.now() - t0 > 20000) return reject(new Error('server not up'));
      setTimeout(poll, 300);
    };
    poll();
  });
}

async function newPage(browser){
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: LW, height: LH, deviceScaleFactor: DPR,
    isMobile: true, hasTouch: true, isLandscape: true });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const logs = [];
  const noise = t => /Failed to load resource|net::|ERR_|WebSocket|favicon|arena\.site/i.test(t);
  page.on('console', m => { if((m.type()==='error'||m.type()==='warning') && !noise(m.text())) logs.push({k:m.type(), t:m.text()}); });
  page.on('pageerror', e => logs.push({ k:'exception', t:e.message }));
  page.ctx = ctx; page.logs = logs;
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

async function loginBySms(page, base, mockPort){
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(900);
  await dismissSplash(page);
  await page.waitForSelector('#gtSend:not([disabled])', { timeout: 25000 });
  await page.evaluate(() => { const i = document.querySelector('#gtPhone'); if(i) i.value = ''; });
  await page.type('#gtPhone', PHONE, { delay: 12 });
  await page.click('#gtSend');
  await page.waitForSelector('#gtCode', { timeout: 12000 });
  let code = '';
  for(let i = 0; i < 25 && !code; i++){
    await sleep(300);
    try{
      const r = await fetch(`http://127.0.0.1:${mockPort}/last-code`, { signal: AbortSignal.timeout(1200) });
      code = (await r.json()).code || '';
    }catch(e){}
  }
  if(!code) throw new Error('کد پیامکی نیامد');
  await page.type('#gtCode', code, { delay: 15 });
  await page.click('#gtOk');
  await page.waitForFunction(() => document.body.dataset.role === 'user', { timeout: 15000 });
  await sleep(500);
  for(let i = 0; i < 24; i++){
    const onb = await page.evaluate(() => !!document.querySelector('#onb.on')).catch(() => false);
    if(!onb) break;
    await page.evaluate(() => { const b = document.querySelector('#onbNext'); if(b) b.click(); }).catch(() => {});
    await sleep(320);
  }
}

/* ── سنجشِ هندسه ── */
async function measure(page, label){
  return page.evaluate((label) => {
    const shell = document.querySelector('#ayahFrameShell');
    const frame = document.querySelector('#ayahFrame');
    const game = document.querySelector('#ayahGame');
    const sr = shell ? shell.getBoundingClientRect() : null;
    const fr = frame ? frame.getBoundingClientRect() : null;
    /* قاب کراس‌اوریجین است (همان واقعیتِ تولید): DOM داخل خوانده
       نمی‌شود. آنچه از بیرون قابلِ سنجشِ قطعی است: ابعادِ ویوپورت‌ای که
       بازی می‌بیند (= rect قاب)، نبودِ اسکرولِ صفحه، و جای مُهر. */
    const gameW = frame ? frame.clientWidth : null;
    const gameH = frame ? frame.clientHeight : null;
    const mask = document.querySelector('#ayahBannerMask');
    const mr = mask ? mask.getBoundingClientRect() : null;
    const maskOk = !!(mr && sr && mr.width > 40 && mr.height > 30 &&
      Math.abs(mr.right - sr.right) <= 2 && Math.abs(mr.bottom - sr.bottom) <= 2);
    /* عمیق‌ترین عناصرِ در-جریان: چه چیزی تهِ صفحه را پایین می‌کشد؟
       (fixedها نویزند و در scrollHeight نقشی ندارند) */
    const deep = [...document.body.querySelectorAll('*')]
      .map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        const cls = (el.className && el.className.baseVal === undefined) ? String(el.className).split(' ').slice(0, 2).join('.') : '';
        const p = el.parentElement;
        return { b: Math.round(r.bottom), pos: cs.position, disp: cs.display,
                 t: el.tagName + (el.id ? '#' + el.id : '') + '.' + cls,
                 par: p ? (p.tagName + (p.id ? '#' + p.id : '')) : '-' }; })
      .filter(x => x.b > window.innerHeight + 2 && x.pos !== 'fixed' && x.disp !== 'none')
      .sort((a, b2) => b2.b - a.b).slice(0, 8);
    const appPad = getComputedStyle(document.querySelector('#app')).paddingBottom;
    const playR = document.querySelector('#s-play')?.getBoundingClientRect();
    const bodyR = document.querySelector('#pgBody')?.getBoundingClientRect();
    return { label,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      deep, appPad,
      playBottom: playR ? Math.round(playR.bottom) : null,
      bodyBottom: bodyR ? Math.round(bodyR.bottom) : null,
      fullscreenEl: document.fullscreenElement ? (document.fullscreenElement.id || document.fullscreenElement.tagName) : null,
      theater: document.body.classList.contains('ayah-theater'),
      pageScroll: document.documentElement.scrollHeight > window.innerHeight + 2,
      scrollH: document.documentElement.scrollHeight,
      shell: sr ? { w: Math.round(sr.width), h: Math.round(sr.height),
                    top: Math.round(sr.top), bottom: Math.round(sr.bottom) } : null,
      gameViewport: (gameW != null) ? `${gameW}x${gameH}` : null,
      shellFits: sr ? (sr.bottom <= window.innerHeight + 2) : null,
      maskOk,
      expandLabel: (document.querySelector('#ayahExpand') || {}).textContent || null };
  }, label);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mock = await startMockServices();
  console.log(`✓ سرویس‌های ساختگی روی :${mock.port}`);
  const proc = await startServer(ROOT, PORT, mock.port, path.join(os.tmpdir(), `p1-land-${TAG}-data.json`));
  console.log(`✓ سرور روی :${PORT}`);
  const browser = await bootstrapChrome();
  console.log('✓ مرورگر باز شد (844×390 افقی)');
  const base = `http://127.0.0.1:${PORT}/index.html`;
  const report = { tag: TAG, viewport: `${LW}x${LH}`, steps: [], errors: [] };
  try{
    const page = await newPage(browser);
    await page.setRequestInterception(true);
    page.on('request', req => {
      if(/arena\.site/.test(req.url())) return req.continue({ url: `http://127.0.0.1:${mock.port}/land` });
      req.continue();
    });
    await loginBySms(page, base, mock.port);
    console.log('✓ ورود انجام شد');
    await page.evaluate(() => { try{ AyahEmbed.open(); }catch(e){} });
    await sleep(2000);
    report.steps.push(await measure(page, 'after-open'));
    await page.screenshot({ path: path.join(OUT, `landscape-${TAG}.png`) });
    console.log(`✓ عکس: screenshots/phase1/landscape-${TAG}.png`);
    /* تلاشِ دوم برای تمام‌صفحه با ژستِ کاربر (کلیک واقعی) */
    try{
      await page.evaluate(() => document.querySelector('#ayahExpand')?.scrollIntoView({ block: 'center' }));
      await sleep(300);
      await page.click('#ayahExpand');
      await sleep(1200);
      report.steps.push(await measure(page, 'after-expand-click'));
    }catch(e){ report.expandClickError = String(e).slice(0, 200); }
    /* خروج از تمام‌صفحه و اندازه‌گیریِ دوباره */
    try{
      await page.evaluate(() => { if(document.fullscreenElement) document.exitFullscreen(); });
      await sleep(800);
      report.steps.push(await measure(page, 'after-exit'));
      await page.screenshot({ path: path.join(OUT, `landscape-${TAG}-noFS.png`) });
    }catch(e){}
    /* سناریوی شکستِ تمام‌صفحه: غیرفعال‌کردنِ requestFullscreen و بازکردنِ
       دوباره — باید تئاتر بنشیند و قاب در دید بگنجد. */
    try{
      await page.evaluate(() => {
        try{ AyahEmbed.cleanup(); }catch(e){}
        Element.prototype.requestFullscreen = function(){ return Promise.reject(new Error('mock-denied')); };
        try{ AyahEmbed.open(); }catch(e){}
      });
      await sleep(1500);
      report.steps.push(await measure(page, 'theater-fallback'));
      await page.screenshot({ path: path.join(OUT, `landscape-${TAG}-theater.png`) });
      await page.evaluate(() => { try{ AyahEmbed.cleanup(); }catch(e){} });
    }catch(e){ report.theaterError = String(e).slice(0, 200); }
    /* بازیِ آفلاینِ داخلی (AyahLight) در افقی: هم‌مبدأست، پس هم‌پوشانیِ
       واقعیِ سؤال/گزینه‌ها را می‌توان سنجید. */
    try{
      for(const mode of ['order', 'missing', 'surah']){
        await page.evaluate((m) => {
          AyahLight.mode = m; AyahLight.seconds = 45; AyahLight.start();
        }, mode);
        await sleep(600);
        const r = await page.evaluate(() => {
          const stage = document.querySelector('.ayah-stage');
          if(!stage) return { error: 'no-stage' };
          /* هر عنصرِ fixed/sticky داخل صحنه که بتواند روی گزینه‌ها بیفتد */
          const overlays = [...stage.querySelectorAll('*')].filter(el => {
            const p = getComputedStyle(el).position;
            return p === 'fixed' || p === 'sticky';
          }).length;
          /* هم‌پوشانیِ خواهرهای مستقیمِ برد */
          const kids = [...(document.querySelector('.ayah-board')?.children || [])]
            .map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
          let overlap = false;
          for(let i = 0; i < kids.length && !overlap; i++)
            for(let j = i + 1; j < kids.length && !overlap; j++){
              const a = kids[i], b = kids[j];
              overlap = !(a.bottom <= b.top + 1 || b.bottom <= a.top + 1);
            }
          return { overlays, childOverlap: overlap };
        });
        report['offline-' + mode] = r;
      }
      await page.screenshot({ path: path.join(OUT, `landscape-${TAG}-offline.png`) });
    }catch(e){ report.offlineError = String(e).slice(0, 200); }
    report.errors.push(...page.logs);
    await page.ctx.close();
  } finally {
    fs.writeFileSync(path.join(OUT, `report-${TAG}.json`), JSON.stringify(report, null, 2));
    await browser.close().catch(() => {});
    proc.kill(); mock.srv.close();
  }
  console.log(JSON.stringify(report.steps.map(s => ({ label: s.label,
    fs: s.fullscreenEl, theater: s.theater, pageScroll: s.pageScroll, scrollH: s.scrollH,
    shellH: s.shell && s.shell.h, gameViewport: s.gameViewport,
    shellFits: s.shellFits, maskOk: s.maskOk, expand: s.expandLabel,
    appPad: s.appPad, playBottom: s.playBottom, bodyBottom: s.bodyBottom, deep: s.deep })), null, 1));
  console.log('offline-overlap: ' + JSON.stringify({
    order: report['offline-order'], missing: report['offline-missing'], surah: report['offline-surah'] }));
  const errs = report.errors.filter(e => !/arena\.site|net::|ERR_|Failed to fetch|Failed to load resource/i.test(e.t));
  console.log(`── خطاهای کنسول (غیرشبکه‌ای): ${errs.length}`);
  errs.slice(0, 8).forEach(e => console.log(`  • [${e.k}] ${e.t.slice(0, 160)}`));
})().catch(e => { console.error('❌', e); process.exit(1); });
