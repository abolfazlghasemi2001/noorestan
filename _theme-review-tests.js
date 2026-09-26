/* Theme-only screenshot review. Dev dependencies: playwright, @sparticuz/chromium.
   Start an HTTP server at BASE_URL (default http://localhost:8080).
   THEME_BASELINE optionally supplies pre-theme index.html; it is fulfilled only for
   the root document, so both versions use identical origin, assets and viewport.
   Outputs are ignored PNGs in screenshots/. No production login bypass is added.
*/
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const baseline = process.env.THEME_BASELINE;
(async () => {
  fs.mkdirSync('screenshots', {recursive:true});
  const bundled = process.env.CHROMIUM_PATH ? null : require('@sparticuz/chromium').default;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || await bundled.executablePath(),
    args: bundled ? bundled.args.filter(x => !x.includes('disable-web-security')) : ['--no-sandbox'],
    headless: true
  });
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',colorScheme:'dark',serviceWorkers:'block'});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let before = false;
    await page.route('**/*', route => {
      const url = route.request().url();
      if(!url.startsWith(BASE + '/')) return route.abort();
      if(url===BASE+'/api/account/me')return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,id:'usr_'+'a'.repeat(20),phone:'09120000000'})});
      if(url.startsWith(BASE+'/api/'))return route.fulfill({status:503,contentType:'application/json',body:'{}'});
      if(before && url === BASE + '/') return route.fulfill({contentType:'text/html; charset=utf-8',body:fs.readFileSync(baseline)});
      return route.continue();
    });
    await page.addInitScript(() => {
      if(window.top !== window) return;
      // Read-only visual fixture; authority is tested by the separate HTTP/WS suite.
      localStorage.clear();
      localStorage.setItem('noorestan_v14', JSON.stringify({_v:15,settings:{onboarded:true},gate:'user',userToken:'a'.repeat(64),userTokenExp:Date.now()+3600000}));
    });
    for(const version of baseline ? ['before','after'] : ['after']) {
      before = version === 'before';
      await page.goto(BASE + '/', {waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>typeof Session==='undefined'||Session.user());
      await page.evaluate(() => {Splash.hide(true);Gate.close();Onboarding.close(true);HomeCarousel.pause('review',true);HomeCarousel.show(0);});
      await page.waitForTimeout(2400);
      await page.evaluate(() => document.fonts.ready);
      for(const theme of ['dark','light']) {
        await page.evaluate(t => Theme.set(t,true), theme);
        for(const [width,height] of [[1440,1000],[390,844]]) {
          await page.setViewportSize({width,height});
          // Fresh document at each size avoids stale software-compositor tiles on resize.
          await page.goto(BASE + '/', {waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>typeof Session==='undefined'||Session.user());
          await page.evaluate(t => {Splash.hide(true);Gate.close();Onboarding.close(true);Theme.set(t,true);HomeCarousel.pause('review',true);HomeCarousel.show(0);},theme);
          await page.waitForTimeout(2400);
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(() => {UI.closeModal();Router.go('home');document.querySelector('#toasts').innerHTML='';});
          await page.waitForTimeout(300);
          assert(await page.evaluate(() => document.body.scrollWidth <= innerWidth+2), `${version} ${theme} ${width}: overflow`);
          await page.screenshot({path:`screenshots/phase2-${version}-${theme}-${width}.png`,animations:'disabled'});
        }
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(() => Theme.set('dark',true));
    for(const route of ['play','quran']) {
      await page.evaluate(() => Router.go('home'));
      await page.click(`[data-foyer-route="${route}"]`);
      assert(await page.locator(`#s-${route}`).evaluate(e => e.classList.contains('active')), `foyer CTA: ${route}`);
    }
    for(const route of ['play','quran','settings','shop']) {
      await page.evaluate(route => {
        UI.closeModal();
        if(route === 'settings'){Router.go('me');Me.tab='settings';Me.render();}
        else if(route === 'shop'){Router.go('me');Shop.open();}
        else Router.go(route);
        document.querySelector('#toasts').innerHTML='';
      }, route);
      await page.waitForTimeout(300);
      await page.screenshot({path:`screenshots/phase2-after-${route}.png`,animations:'disabled'});
    }
    assert.deepEqual(errors, [], 'no browser runtime errors');
    assert(await page.evaluate(() => selfTest().ok), 'built-in selfTest');
    if(baseline) {
      const image = (name, caption) => `<figure><figcaption>${caption}</figcaption><img src="data:image/png;base64,${fs.readFileSync('screenshots/phase2-'+name+'.png').toString('base64')}"></figure>`;
      const style = `@font-face{font-family:V;src:url('${BASE}/assets/fonts/vazirmatn-regular.woff2')}*{box-sizing:border-box}body{margin:0;background:#eeeae0;color:#273d37;font-family:V,Tahoma,sans-serif;padding:28px}h1{margin:0;font-size:25px}p{margin:8px 0 18px;font-size:13px}.grid{display:grid;gap:16px;direction:ltr}.desktop{grid-template-columns:1fr 1fr}.mobile{grid-template-columns:repeat(4,1fr);margin-top:20px}figure{margin:0;min-width:0}figcaption{padding:9px;text-align:center;font-size:13px;direction:rtl}img{display:block;width:100%;border-radius:12px;border:1px solid #c4c6b6}footer{margin-top:20px;font-size:12px;color:#536258}`;
      await page.setViewportSize({width:1440,height:1500});
      await page.setContent(`<html dir="rtl"><head><style>${style}</style></head><body><h1>نورستان · از نمای قبلی به صحنِ روشن</h1><p>تصویر واقعی مرورگر — حساب و اندازه‌های یکسان؛ مقایسهٔ ظاهر نسخهٔ مبنا و نسخهٔ فعلی.</p><section class="grid desktop">${image('before-dark-1440','قبل · دسکتاپ تیره')}${image('after-dark-1440','بعد · دسکتاپ تیره')}</section><section class="grid mobile">${image('before-dark-390','قبل · موبایل تیره')}${image('after-dark-390','بعد · موبایل تیره')}${image('before-light-390','قبل · موبایل روشن')}${image('after-light-390','بعد · موبایل روشن')}</section><footer>این مقایسه تأیید ورود پیامکی، پرداخت یا بازی آنلاین نیست؛ برای آن بخش‌ها گزارش آزمون جداگانه وجود دارد.</footer></body></html>`);
      await page.evaluate(async () => {await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
      await page.screenshot({path:'screenshots/phase2-theme-before-after.png',fullPage:true,animations:'disabled'});
    }
    console.log('PASS: home captures (before only when baseline supplied), dark/light mobile/desktop, both new CTAs, 4 shared-screen captures, no runtime errors, selfTest.');
  } finally {await browser.close();}
})().catch(e => {console.error(e);process.exitCode=1;});
