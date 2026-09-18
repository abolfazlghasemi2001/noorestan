#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   _shots.js — اسکرین‌شات همهٔ صفحه‌های نورستان با Puppeteer

   اجرا:
     node _shots.js
     node _shots.js --port=8801 --out=screenshots --all-games
     node _shots.js --admin-pass=noor2024 --keep-anim

   این فایل بخشی از برنامهٔ نورستان نیست. برنامه تک‌فایلی و بی‌وابستگی
   است؛ Puppeteer فقط ابزار توسعه است و در _shots_env/ نصب می‌شود تا
   ریشهٔ برنامه پاک بماند.

   ── چرا صفحه‌ها را با کلیک روی دکمه‌ها عوض نمی‌کنیم؟ ──
   چون بعضی صفحه‌ها (روم، پنل مدیر) به حالتِ درون‌برنامه‌ای نیاز دارند
   که با کلیک ساخته نمی‌شود: روم تا Net.room نباشد چیزی نمی‌کشد، و پنل
   مدیر پشت رمز است. پس مستقیم Router و Games را صدا می‌زنیم و حالت
   لازم را پیش از عکس گرفتن می‌سازیم.

   ── نکتهٔ مهم دربارهٔ page.evaluate ──
   ماژول‌های برنامه با const در سطح بالای یک <script> کلاسیک تعریف شده‌اند.
   چنین ثابت‌هایی در «محیط واژگانی سراسری» می‌نشینند، نه روی window. پس
   window.Router وجود ندارد ولی خودِ Router در evaluate دیده می‌شود.
   به همین دلیل همه‌جا نامِ خالی صدا زده می‌شود، نه window.X.
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/* ── تنظیمات ── */
const W = 390, H = 844;          // ویوپورت موبایل
const WAIT = 600;                // پیش از هر عکس
const DPR = 2;                   // دو برابر، تا متن فارسی خوانا باشد
const ROOT = __dirname;

function argOf(name, dflt){
  const hit = process.argv.find(a => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : dflt;
}
const hasFlag = name => process.argv.includes('--' + name);

const OUT = path.resolve(ROOT, argOf('out', 'screenshots'));
const PORT = +argOf('port', 8799);
const ADMIN_PASS = argOf('admin-pass', 'noor2024');
const ALL_GAMES = hasFlag('all-games');
const KEEP_ANIM = hasFlag('keep-anim');

/* ═══════════════ یافتن Puppeteer ═══════════════
   سه جا را می‌گردیم: نصب محلی پروژه، نصب _shots_env، و نصب سراسری. */
function loadPuppeteer(){
  const tries = [
    ['puppeteer', () => require('puppeteer')],
    ['_shots_env', () => require(path.join(ROOT, '_shots_env/node_modules/puppeteer'))],
    ['_shots', () => require(path.join(ROOT, 'node_modules/puppeteer'))]
  ];
  const errs = [];
  for(const [where, fn] of tries){
    try{ return { where, mod: fn() }; }
    catch(e){ errs.push(`${where}: ${e.code || e.message}`); }
  }
  console.error('\n❌ Puppeteer نصب نیست.');
  console.error('   جاهایی که گشتم:');
  for(const e of errs) console.error('     • ' + e);
  console.error('\n   نصب:');
  console.error('     cd ' + ROOT + '/_shots_env && npm install');
  console.error('   یا اگر جای دیگری داری:');
  console.error('     node _shots.js        (اگر puppeteer سراسری نصب باشد پیدا می‌شود)');
  console.error('\n   راهنمای کامل و فهرست URLها: screenshots/README.md\n');
  process.exit(2);
}
const { where: PUP_WHERE, mod: puppeteer } = loadPuppeteer();

/* ═══════════════ فهرست عکس‌ها ═══════════════
   هر قلم: [نامِ فایل، توضیح فارسی، تابعی که در مرورگر اجرا می‌شود]

   ترتیب عمداً با ترتیب خواسته‌شده یکی است: صفحه‌ها، بعد بازی‌ها، بعد
   تلاوت، بعد مودال‌ها، و آخر سر حالت اشکال‌زدایی که به بارگذاری تازه
   با ?debug=1 نیاز دارد. */
const SHOTS = [
  ['01-home',    'خانه',            null],
  ['02-online',  'محفل',            () => { Router.go('online'); }],
  ['03-notif',   'اعلان',           () => { Router.go('notif'); }],
  ['04-admin',   'پنل مدیر',        null],   // جداگانه، چون ورود لازم دارد
  ['05-room',    'روم',             null],   // جداگانه، چون حالت لازم دارد
  ['06-quiz',    'سوالات قرآنی',     () => { Games.quiz(); }],
  ['07-surah',   'سفر سوره‌ها',      () => { Games.surah(); }],
  ['08-scramble','پازل حروف',        () => { Games.scramble(); }],
  ['09-memory',  'حافظه',            () => { Games.memory(); }],
  ['10-match',   'تطبیق',            () => { Games.match(); }],
  ['11-dooz',    'دوز',              () => { Games.dooz(); }],
  ['12-esmfamil','اسم فامیل',        () => { Games.esmfamil(); }],
  ['13-iran',    'اطلاعات ایران',    () => { Games.iran(); }],
  ['14-meaning', 'معنی کلمه',        () => { Games.meaning(); }],
  ['15-speed',   'سرعت نور',         () => { Games.speed(); }],
  ['16-quran',   'تلاوت قرآن',       () => { Games.recite(); }],
  ['17-modal-settings',    'تنظیمات',   () => { Games.settings(); }],
  ['18-modal-stats',       'آمار',      () => { Games.stats(); }],
  ['19-modal-badges',      'نشان‌ها',    () => { Games.badges(); }],
  ['20-modal-leaderboard', 'رکوردها',   () => { Games.leaderboard(); }]
  /* ۲۱ در ادامه و پس از بارگذاری تازه با ?debug=1 افزوده می‌شود */
];

/* بازی‌های دیگرِ لانچر که در فهرست بالا نیستند. با --all-games می‌آیند.
   چرا جدا؟ چون کاربر ۹ بازی را نام برد و گفت «۱۰ بازی»؛ به‌جای حدس‌زدن
   که دهمی کدام است، همهٔ باقی را پشت یک پرچم گذاشتم. */
const EXTRA_GAMES = ['hadith','imams','dua','nahj','exam','daily','collection','tree','missions'];

/* ── ابزارها ── */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');

/* ═══════════════ سرور محلی ═══════════════
   چرا server.js خودِ برنامه را بالا می‌آوریم و نه یک سرور ایستای ساده؟
   چون صفحهٔ «محفل» و «روم» به WebSocket همان سرور وصل می‌شوند؛ با یک
   سرور ایستای ساده، آن دو صفحه در حالت قطع نشان داده می‌شوند و عکس
   بی‌ارزش می‌شود. */
function startServer(){
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', d => { out += d; });
    proc.on('error', reject);

    const t0 = Date.now();
    const poll = async () => {
      if(proc.exitCode !== null)
        return reject(new Error('سرور با کد ' + proc.exitCode + ' بست.\n' + out.trim()));
      try{
        const r = await fetch(`http://127.0.0.1:${PORT}/index.html`,
          { method: 'HEAD', signal: AbortSignal.timeout(1500) });
        if(r.ok) return resolve(proc);
      }catch(e){ /* هنوز بالا نیامده */ }
      if(Date.now() - t0 > 20000)
        return reject(new Error('سرور در ۲۰ ثانیه بالا نیامد.\n' + out.trim()));
      setTimeout(poll, 300);
    };
    poll();
  });
}

/* ═══════════════ اجرا ═══════════════ */
(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  console.log('\n📸 نورستان — اسکرین‌شات');
  console.log(`   Puppeteer از: ${PUP_WHERE}`);
  console.log(`   ویوپورت: ${W}×${H} @${DPR}x   انتظار پیش از هر عکس: ${WAIT}ms`);
  console.log(`   خروجی: ${OUT}\n`);

  let server = null;
  let browser = null;
  const done = [];      // عکس‌های موفق
  const failed = [];    // شکست‌ها
  const logs = [];      // خطاهای کنسول، به تفکیک صفحه

  try{
    server = await startServer();
    console.log(`✓ سرور روی http://127.0.0.1:${PORT}`);

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', '--disable-gpu',
        '--hide-scrollbars', '--mute-audio',
        '--font-render-hinting=none'
      ]
    });
    console.log('✓ مرورگر باز شد\n');

    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });

    /* خطاهای کنسول را جمع می‌کنیم. قاعدهٔ خودِ پروژه «صفر خطای Console»
       است، پس این گزارش صرفاً تزئینی نیست — عدم تطابق را نشان می‌دهد.
       خطاهای شبکه (API قرآن، فونت) عمداً نادیده‌اند: در محیط بسته
       اجتناب‌ناپذیرند و ربطی به سلامت رندر ندارند. */
    let current = '(هیچ)';
    const isNetNoise = t =>
      /Failed to load resource|net::ERR|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|WebSocket|favicon/i.test(t);
    page.on('console', m => {
      if(m.type() === 'error' || m.type() === 'warning'){
        const t = m.text();
        if(!isNetNoise(t)) logs.push({ shot: current, kind: m.type(), text: t });
      }
    });
    page.on('pageerror', e => logs.push({ shot: current, kind: 'exception', text: e.message }));

    /* انیمیشن‌ها را می‌خوابانیم تا عکس‌ها یک‌تکرار باشند. این کار روی
       *منطق* برنامه اثری ندارد؛ فقط CSS را ثابت می‌کند. */
    if(!KEEP_ANIM){
      await page.evaluateOnNewDocument(() => {
        const s = document.createElement('style');
        s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
      });
    }

    const base = `http://127.0.0.1:${PORT}/index.html`;

    const shoot = async (file, label, fn, { fresh = false, url = base } = {}) => {
      current = file;
      const target = path.join(OUT, file + '.png');
      try{
        if(fresh) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if(fn){
          /* بازگشت به خانه پیش از هر صفحه، تا پشتهٔ مسیر انبار نشود */
          await page.evaluate(() => { try{ Router.go('home'); }catch(e){} });
          await sleep(120);
          await page.evaluate(fn);
        }
        await sleep(WAIT);
        await page.screenshot({ path: target });
        const kb = (fs.statSync(target).size / 1024).toFixed(0);
        done.push({ file, label, kb });
        console.log(`  ✓ ${file}.png  ${kb}KB  — ${label}`);
      }catch(e){
        failed.push({ file, label, why: e.message.split('\n')[0] });
        console.log(`  ✗ ${file}.png  — ${label}  (${e.message.split('\n')[0]})`);
      }
    };

    /* ── بار نخست ── */
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(900);   // فرصت برای بالا آمدن پوسته، راهنما و زنجیره

    /* ── ۰۱ خانه ── */
    await shoot('01-home', 'خانه', null);

    /* ── ۰۲ و ۰۳ ── */
    for(const [file, label, fn] of SHOTS.slice(1, 3)) await shoot(file, label, fn);

    /* ── ۰۴ پنل مدیر ──
       اگر رمز درست باشد پنل واقعی کشیده می‌شود؛ وگرنه دروازهٔ ورود.
       هر دو حالت عکس گرفتنی است، پس شکست‌خوردنِ ورود، عکس را باطل نمی‌کند. */
    current = '04-admin';
    let adminState = 'دروازهٔ ورود';
    try{
      await page.evaluate(async () => { Router.go('admin'); });
      await sleep(400);
      const okLogin = await page.evaluate(async pass => {
        if(typeof Store === 'undefined' || typeof U === 'undefined') return false;
        const hash = await U.sha256Async(pass);
        if(hash !== Store.get('adminHash')) return false;
        Store.set('isAdmin', true);
        Router._render('admin');
        Admin.render();
        return true;
      }, ADMIN_PASS);
      if(okLogin) adminState = 'پنل باز (ورود موفق)';
    }catch(e){ /* دروازه می‌ماند */ }
    await shoot('04-admin', 'پنل مدیر', null);

    /* ── ۰۵ روم ──
       renderRoom() اگر Net.room نباشد بی‌درنگ برمی‌گردد. پس یک روم
       نمونه می‌سازیم تا صفحه واقعاً کشیده شود. */
    current = '05-room';
    let roomState = 'روم نمونه';
    try{
      await page.evaluate(() => {
        Net.room = {
          name: 'محفل دوستان',
          code: '482913',
          game: 'dooz',
          host: Net.id,
          spectator: false,
          members: [
            { id: Net.id,                     name: Store.get('playerName') || 'تو', active: true },
            { id: 'demo-2', name: 'زهرا',   active: true },
            { id: 'demo-3', name: 'محمد',   active: false },
            { id: 'demo-4', name: 'حسین',   active: false },
            { id: 'demo-5', name: 'فاطمه',  active: false }
          ]
        };
        Router.go('room');
        if(typeof renderRoom === 'function') renderRoom();
      });
    }catch(e){ roomState = 'شکست: ' + e.message.split('\n')[0]; }
    await shoot('05-room', 'روم', null);

    /* ── ۰۶ تا ۲۰ ── */
    for(const [file, label, fn] of SHOTS.slice(5)) await shoot(file, label, fn);

    /* ── بازی‌های دیگر، اختیاری ── */
    if(ALL_GAMES){
      let n = SHOTS.length + 1;
      for(const g of EXTRA_GAMES){
        const nm = (await page.evaluate(id => (DATA.GAMES[id] || {}).name || id, g).catch(() => g));
        await shoot(`${pad(n)}-game-${g}`, `بازی: ${nm}`, new Function(`Games['${g}']();`));
        n++;
      }
    }

    /* ── ۲۱ اشکال‌زدایی ──
       با بارگذاری تازه و ?debug=1، چون Debug.want() در زمان پارس خوانده
       می‌شود و تزریق بعدی همان حالت را نمی‌سازد. */
    await shoot('21-debug', 'حالت اشکال‌زدایی (?debug=1)', null,
      { fresh: true, url: base + '?debug=1' });

    /* ═══════════ گزارش ═══════════ */
    console.log('\n' + '─'.repeat(58));
    console.log(`✅ موفق: ${done.length}    ❌ ناموفق: ${failed.length}`);
    console.log(`📁 پوشه: ${OUT}`);
    console.log(`   پنل مدیر: ${adminState}   |   روم: ${roomState}`);

    if(failed.length){
      console.log('\nشکست‌ها:');
      for(const f of failed) console.log(`  ✗ ${f.file} — ${f.label}: ${f.why}`);
    }

    if(logs.length){
      console.log(`\n⚠️ خطاهای کنسول (${logs.length}) — قاعدهٔ پروژه «صفر خطای Console» است:`);
      const seen = new Set();
      for(const l of logs){
        const k = l.shot + '|' + l.text;
        if(seen.has(k)) continue;
        seen.add(k);
        console.log(`  • [${l.shot}] ${l.kind}: ${l.text.slice(0, 160)}`);
      }
    }else{
      console.log('\n✓ هیچ خطای کنسولی ثبت نشد.');
    }
    console.log('');
    process.exitCode = failed.length ? 1 : 0;

  }catch(e){
    console.error('\n❌ خطای کلی: ' + e.message);
    if(/Failed to launch|No such file|error while loading shared|not found/i.test(e.message)){
      console.error('\n   احتمالاً کرومِ Puppeteer روی این دستگاه اجرا نمی‌شود.');
      console.error('   راهنما: screenshots/README.md');
    }
    process.exitCode = 1;
  }finally{
    if(browser) await browser.close().catch(() => {});
    if(server && server.exitCode === null){ server.kill('SIGTERM'); }
    await sleep(300);
  }
})();
