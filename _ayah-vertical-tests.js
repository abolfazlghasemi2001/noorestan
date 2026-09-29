/* ═══════════════════════════════════════════════════════════════════
   _ayah-vertical-tests.js — تستِ «حالتِ عمودیِ» بازیِ نورِ آیه‌ها
   (ابزار توسعه؛ بخشی از خودِ برنامه نیست و در زمان اجرا بار نمی‌شود.)

   چه چیزی را قفل می‌کند؟
     • قابِ بازی عمودی است (بلندتر از پهن)، نه نوارِ افقیِ ۱۶/۹.
     • بازکردنِ بازی خودش تمام‌صفحه نمی‌گیرد و هیچ‌جا
       `screen.orientation.lock(...)` صدا زده نمی‌شود — همان چیزی که
       صفحه را افقی می‌کرد و در PWA با `portrait-primary` می‌جنگید.
     • دکمه‌های زیرِ قاب در عرضِ صفحه می‌مانند و صفحه اسکرولِ افقی
       نمی‌گیرد (در عمودی و در افقی).
     • «تمام‌صفحه» فقط با خواستِ کاربر اجرا می‌شود و برچسبش می‌چرخد.
     • «تمرین آفلاین» قاب را جمع می‌کند و همین بازیِ درون‌برنامه‌ای را
       می‌آورد؛ یک دورِ کاملِ «ترتیب آیه» تا صفحهٔ نتیجه اجرا می‌شود.

   اجرا (سرورِ repo باید بالا باشد):
     node _dev-preview.js 8080        # یا: bash start.sh
     AWS_EXECUTION_ENV=AWS_Lambda_nodejs20.x \
     NODE_PATH=$PWD/_shots_env/node_modules \
     BASE_URL=http://localhost:8080 node _ayah-vertical-tests.js

   چرا `AWS_EXECUTION_ENV`؟ کرومیومِ `@sparticuz/chromium` کتابخانه‌های
   مشترکش را فقط وقتی استخراج می‌کند که خودش را در Amazon Linux 2023
   ببیند؛ بی آن، اجرا با «libnspr4.so پیدا نشد» می‌میرد. روی دستگاهی که
   کرومِ سیستمی دارد، همان `CHROMIUM_PATH` کافی است و نیازی به این
   متغیر نیست. عکس‌ها در `tmp/acceptance/` می‌افتند (gitignore شده).
   ═══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('node:fs');
const EMBED = 'https://01a0d7e6-7c4a-76f4-95a4-01c2f9cfcaf5.arena.site/?embed=true';
const BASE = process.env.BASE_URL || 'http://localhost:8080';
fs.mkdirSync('tmp/acceptance', { recursive: true });

/* همان قلمی که بقیهٔ ابزارهای توسعه از آن استفاده می‌کنند؛ اگر در ریشهٔ
   repo نصب نشده باشد، از `_shots_env` برداشته می‌شود. */
function tool(name){
  for(const p of [name, __dirname + '/_shots_env/node_modules/' + name]){
    try{ return require(p); }catch(e){}
  }
  throw new Error(`«${name}» نصب نیست. یک‌بار: cd _shots_env && npm install playwright`);
}

const results = [], errors = [];
function ok(name, value, detail){
  results.push({ name, ok: !!value, detail });
  console.log(`${value ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ': ' + JSON.stringify(detail)}`);
}
const box = () => {
  const shell = document.querySelector('#ayahFrameShell'), row = document.querySelector('.ayah-under');
  const nav = document.querySelector('#nav');
  const r = shell.getBoundingClientRect(), q = row.getBoundingClientRect();
  const nb = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect() : null;
  const limit = nb && nb.height ? nb.top : innerHeight;
  return { frame: { w: Math.round(r.width), h: Math.round(r.height) },
           /* ارتفاعی که انتظار داریم: تا بالای نوارِ پایین، منهای ردیفِ دکمه‌ها
              (همان فرمولِ `AyahEmbed.fit`، با همان کفِ کوتاهِ افقی) */
           expected: Math.max(innerHeight < 560 ? 190 : 320, Math.round(limit - Math.max(0, r.top) - q.height - 14)),
           clamp: Math.round(Math.min(900, Math.max(420, innerHeight - 170))),
           inside: r.left >= -1 && r.right <= innerWidth + 1,
           rowBelow: q.top >= r.bottom - 2,
           rowInside: q.left >= -1 && q.right <= innerWidth + 1,
           rowVisible: q.bottom <= limit + 1,
           overflowX: document.documentElement.scrollWidth - innerWidth,
           inner: [innerWidth, innerHeight] };
};

(async () => {
  const { chromium } = tool('playwright');
  const bundle = process.env.CHROMIUM_PATH ? null : tool('@sparticuz/chromium').default;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || await bundle.executablePath(),
    args: bundle ? bundle.args.filter(x => !x.includes('disable-web-security')) : ['--no-sandbox'],
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
                                             colorScheme: 'dark', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  /* بازیِ بیرونی در تست خوانده نمی‌شود؛ فقط قابش سنجیده می‌شود. */
  await page.route('**/*', route => {
    const url = route.request().url();
    if(url === BASE + '/api/account/me')
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, id: 'usr_' + 'a'.repeat(20), phone: '09120000000' }) });
    if(url.startsWith(BASE + '/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    return url.startsWith(BASE) ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    /* قفلِ جهت پیش از هر چیز شنود می‌شود: بی این، اگر برنامه قفل کند
       هیچ ردی نمی‌ماند و تست بی‌خبر سبز می‌شود. */
    window.__orientLock = [];
    try{
      const o = screen.orientation, orig = o && o.lock && o.lock.bind(o);
      if(o) Object.defineProperty(o, 'lock', { configurable: true,
        value: (...a) => { window.__orientLock.push(a[0]); return orig ? orig(...a) : Promise.reject(Error('lock نیست')); } });
    }catch(e){}
    if(window.top !== window) return;
    localStorage.setItem('noorestan_v14', JSON.stringify({ _v: 15, settings: { onboarded: true }, gate: 'user',
      userToken: 'a'.repeat(64), userTokenExp: Date.now() + 3600000 }));
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof Session !== 'undefined' && Session.user());
  await page.evaluate(() => { Splash.hide(); Onboarding.close(true); Gate.close(); });
  await page.waitForTimeout(500);

  /* ── مسیرِ واقعیِ کاربر: گزینه‌های اصلی باید پیش از قابِ بیرونی دیده شوند ── */
  await page.evaluate(() => { Router.go('home'); HomeCarousel.show(0); });
  await page.click('[data-slide-action="ayahlight"]');
  await page.waitForSelector('.ayah-setup');
  const setup = await page.evaluate(() => {
    const modes = [...document.querySelectorAll('[data-am]')].map(b => {
      const r = b.getBoundingClientRect(), s = getComputedStyle(b);
      return { mode:b.dataset.am, visible:s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0,
               inViewport:r.top >= 0 && r.bottom <= innerHeight };
    });
    const times = [...document.querySelectorAll('[data-sec]')].map(b => {
      const r = b.getBoundingClientRect(), s = getComputedStyle(b);
      return { seconds:b.dataset.sec, visible:s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0,
               inViewport:r.top >= 0 && r.bottom <= innerHeight };
    });
    return { modes, times, hasFrame:!!document.querySelector('#ayahFrame'), start:!!document.querySelector('#ayahStart'),
             external:!!document.querySelector('#ayahExternal') };
  });
  ok('مسیر اصلی، هر سه حالت بازی را بی‌نیاز از iframe نشان می‌دهد',
     setup.modes.length === 3 && setup.modes.every(x => x.visible) && !setup.hasFrame, setup);
  ok('سه زمانِ پرسش و دکمهٔ شروع هم در صفحهٔ انتخاب‌اند',
     setup.times.length === 3 && setup.times.every(x => x.visible) && setup.start && setup.external, setup);
  ok('در موبایل، انتخاب‌ها در همان viewport جا می‌شوند',
     setup.modes.every(x => x.inViewport) && setup.times.every(x => x.inViewport), setup);
  await page.screenshot({ path: 'tmp/acceptance/ayah-options-390.png', animations: 'disabled' });

  /* روی گوشیِ ۳۲۰×۵۶۸ تزئینات جمع می‌شوند تا حالت‌ها، توضیحِ کوتاه، زمان‌ها
     و دو کنش زیرِ نوارِ ثابت نمانند. */
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(160);
  const compact = await page.evaluate(() => {
    const nav = document.querySelector('#nav'), nr = nav.getBoundingClientRect();
    const bound = el => { const r=el.getBoundingClientRect(); return {top:Math.round(r.top),bottom:Math.round(r.bottom),inside:r.top>=0&&r.bottom<=nr.top+1}; };
    return {
      modes:[...document.querySelectorAll('[data-am]')].map(b=>({mode:b.dataset.am,...bound(b),description:bound(b.querySelector('small'))})),
      times:[...document.querySelectorAll('[data-sec]')].map(b=>({seconds:b.dataset.sec,...bound(b)})),
      start:bound(document.querySelector('#ayahStart')),
      external:bound(document.querySelector('#ayahExternal')),
      progressHidden:document.querySelector('#pgProgWrap').classList.contains('hide'),
      navTop:Math.round(nr.top)
    };
  });
  ok('در ۳۲۰×۵۶۸ سه حالت، سه زمان و دکمه‌ها بالای نوارِ ثابت دیده می‌شوند',
     compact.modes.length===3&&compact.modes.every(x=>x.inside&&x.description.inside)&&compact.times.length===3&&compact.times.every(x=>x.inside)&&compact.start.inside&&compact.external.inside&&compact.progressHidden,
     compact);
  await page.screenshot({ path: 'tmp/acceptance/ayah-options-320.png', animations: 'disabled' });
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(160);
  const compact360 = await page.evaluate(() => {
    const nav=document.querySelector('#nav'), nr=nav.getBoundingClientRect();
    const bound=el=>{const r=el.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),inside:r.top>=0&&r.bottom<=nr.top+1};};
    return {
      modes:[...document.querySelectorAll('[data-am]')].map(b=>({mode:b.dataset.am,...bound(b),description:bound(b.querySelector('small'))})),
      times:[...document.querySelectorAll('[data-sec]')].map(b=>({seconds:b.dataset.sec,...bound(b)})),
      start:bound(document.querySelector('#ayahStart')), external:bound(document.querySelector('#ayahExternal')),
      progressHidden:document.querySelector('#pgProgWrap').classList.contains('hide'), navTop:Math.round(nr.top)
    };
  });
  ok('در ۳۶۰×۶۴۰ همهٔ حالت‌ها، توضیح‌ها و زمان‌ها بالای نوار جا می‌شوند',
     compact360.modes.length===3&&compact360.modes.every(x=>x.inside&&x.description.inside)&&compact360.times.length===3&&compact360.times.every(x=>x.inside)&&compact360.start.inside&&compact360.external.inside&&compact360.progressHidden,
     compact360);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(160);

  /* نسخهٔ embed اختیاری است؛ آن را جداگانه می‌آزماییم. */
  await page.click('#ayahExternal');
  await page.waitForSelector('#ayahFrame');
  await page.waitForTimeout(900);

  const m = await page.evaluate(box);
  const extra = await page.evaluate(() => ({
    fullscreen: !!document.fullscreenElement,
    locks: window.__orientLock.slice(),
    sub: document.querySelector('#pgSub').textContent,
    expand: document.querySelector('#ayahExpand').textContent.trim(),
    src: document.querySelector('#ayahFrame').getAttribute('src'),
    orient: !!document.querySelector('.ayah-orient'),
    blockingMask: !!document.querySelector('#ayahBannerMask,.ayah-banner-mask')
  }));

  ok('قابِ بازی عمودی است (بلندتر از پهن)', m.frame.h > m.frame.w, m.frame);
  /* ارتفاع دقیقاً متناسب با جای واقعی: تا بالای نوارِ پایین، منهای ردیفِ
     دکمه‌ها. اگر اندازه‌گیریِ JS کار نکند، همان کلampِ CSS می‌ماند و این
     سنجش می‌افتد — یعنی «اندازه‌گیریِ واقعی» واقعاً آزموده می‌شود. */
  ok('ارتفاعِ قاب از روی چیدمانِ واقعی حساب شده',
     m.frame.h >= 320 && Math.abs(m.frame.h - m.expected) <= 3 && m.frame.h !== m.clamp,
     { ...m.frame, clamp: m.clamp, expected: m.expected, view: m.inner });
  ok('قاب در عرضِ صفحه می‌ماند و اسکرولِ افقی نمی‌سازد', m.inside && m.overflowX <= 1, { inside: m.inside, overflowX: m.overflowX });
  ok('دکمه‌های بازی زیرِ قاب‌اند و از عرض بیرون نمی‌زنند', m.rowBelow && m.rowInside);
  ok('دکمه‌های بازی بی اسکرول و بیرون از نوارِ پایین دیده می‌شوند', m.rowVisible,
     { rowBottom: Math.round(m.rowBottom || 0), inner: m.inner });
  ok('بازکردنِ بازی خودش تمام‌صفحه نمی‌گیرد', !extra.fullscreen);
  ok('هیچ قفلِ جهتی صدا زده نشد', extra.locks.length === 0, extra.locks);
  ok('زیرعنوان حالتِ عمودی را می‌گوید', /عمودی/.test(extra.sub) && !/افقی/.test(extra.sub), extra.sub);
  ok('راهنمای چرخاندنِ گوشی نیست', extra.orient);
  ok('برچسبِ دکمه «تمام‌صفحه» است', extra.expand === 'تمام\u200cصفحه', extra.expand);
  ok('قاب همان بازیِ embed را می‌آورد', extra.src === EMBED, extra.src);
  ok('هیچ کارتِ پوشاننده روی بازی یا گزینه‌هایش نیست', !extra.blockingMask, extra.blockingMask);
  await page.screenshot({ path: 'tmp/acceptance/ayah-vertical-390.png', animations: 'disabled' });

  /* ── تمام‌صفحه با خواستِ کاربر، بی قفلِ جهت ── */
  const big = await page.evaluate(async () => {
    await AyahEmbed.expand(); await new Promise(r => setTimeout(r, 200));
    return { full: (document.fullscreenElement && document.fullscreenElement.id) || null,
             label: document.querySelector('#ayahExpand').textContent.trim(),
             locks: window.__orientLock.slice(), supported: !!document.querySelector('#ayahGame').requestFullscreen };
  });
  ok('تمام‌صفحه فقط با خواستِ کاربر اجرا می‌شود', big.supported ? big.full === 'ayahGame' : big.full === null, big);
  ok('تمام‌صفحه جهتِ صفحه را قفل نمی‌کند', big.locks.length === 0, big.locks);
  ok('برچسبِ دکمه با وضعیت می‌چرخد', !big.supported || big.label === 'خروج از تمام\u200cصفحه', big.label);
  await page.screenshot({ path: 'tmp/acceptance/ayah-vertical-fullscreen.png', animations: 'disabled' });
  await page.evaluate(async () => { await AyahEmbed.expand(); await new Promise(r => setTimeout(r, 200)); });
  ok('خروج از تمام‌صفحه هم بی قفلِ جهت است', await page.evaluate(() => !document.fullscreenElement && window.__orientLock.length === 0));

  /* ── نمای افقی: قاب باید در عرض بماند، نه اینکه صفحه را بشکند ── */
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  const land = await page.evaluate(box);
  ok('در افقی هم قاب از عرض بیرون نمی‌زند', land.inside && land.overflowX <= 1, land);
  /* در گوشیِ افقیِ کوتاه (۸۴۴×۳۹۰) سربرگِ چسبان و سرصفحه جمع می‌شوند تا
     قابِ عمودی و ردیفِ دکمه‌ها با هم جا شوند و کاربر اسکرول نکند. */
  const chrome = await page.evaluate(() => ({
    top: getComputedStyle(document.querySelector('.top')).display,
    phead: getComputedStyle(document.querySelector('.phead')).display
  }));
  ok('در افقیِ کوتاه قاب و دکمه‌ها با هم جا می‌شوند',
     land.frame.h >= 190 && land.rowVisible && chrome.top === 'none' && chrome.phead === 'none',
     { ...land, chrome });
  await page.screenshot({ path: 'tmp/acceptance/ayah-vertical-844x390.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);

  /* ── تمرینِ آفلاین: همان بازی، بدونِ اینترنت — یک دورِ کامل ── */
  await page.click('#ayahOffline');
  await page.waitForSelector('.ayah-stage');
  ok('تمرینِ آفلاین قابِ بیرونی را جمع می‌کند', await page.locator('#ayahFrame').count() === 0);
  await page.evaluate(() => { AyahLight.mode = 'order'; AyahLight.start(); });
  for(let i = 0; i < 10; i++){
    const count = await page.locator('[data-word]').count();
    for(let n = 0; n < count; n++) await page.locator(`[data-word="${n}"]`).click();   /* ترتیبِ درستِ مصحف */
    await page.locator('#ayahCheck').click();
    await page.locator('.ayah-actions .btn.ok').click();
    await page.waitForTimeout(80);
  }
  ok('یک دورِ کاملِ بازی در مرورگر تا نتیجه اجرا شد',
     await page.evaluate(() => AyahLight.right === 10 && !!document.querySelector('.ayah-result')));
  await page.screenshot({ path: 'tmp/acceptance/ayah-vertical-offline-result.png', animations: 'disabled' });

  /* ── قابِ دیررس: راهنمای جایگزین باید خودش را نشان بدهد ──
     درخواستِ بازیِ بیرونی آویزان می‌ماند (نه پاسخ می‌گیرد، نه رد می‌شود)،
     پس رویدادِ `load` هرگز نمی‌آید — همان حالتی که کاربر با اینترنتِ کند
     یا میزبانِ در‌دسترس‌نبودن می‌بیند. */
  await page.route('**/*', route => route.request().url().startsWith('https://01a0d7e6-')
    ? undefined : route.fallback());
  await page.evaluate(() => { Router.go('home'); HomeCarousel.show(0); });
  await page.click('[data-slide-action="ayahlight"]');
  await page.waitForSelector('.ayah-setup');
  await page.click('#ayahExternal');
  await page.waitForSelector('#ayahFrame');
  const slow = await page.waitForFunction(() => !!document.querySelector('#ayahFrameStatus')?.classList.contains('slow'),
                                          null, { timeout: 13000 }).then(() => true).catch(() => false);
  ok('اگر قابِ بازی دیر برسد، راهنمای تمرینِ آفلاین برجسته می‌شود',
     slow && await page.evaluate(() => document.querySelector('#ayahOffline').classList.contains('ok')));
  await page.screenshot({ path: 'tmp/acceptance/ayah-vertical-late-frame.png', animations: 'disabled' });

  ok('هیچ خطای زمانِ اجرا در مرورگر نبود', errors.length === 0, errors);
  await browser.close();
  fs.writeFileSync('tmp/acceptance/ayah-vertical-results.json', JSON.stringify(results, null, 2));
  const failed = results.filter(x => !x.ok).length;
  console.log(`RESULT ${results.length - failed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
