/* Current regression entry used by _harness.js. Existing content/game/economy
   assertions are reused verbatim from _tests.js rather than deleted.
   Retired contracts (guest login, local OTP, MiniServer, local admin) are NOT
   expected to pass; their replacement authority tests are in
   _phase2-integration-tests.js (real HTTP/WS + optional actual browser).
   The original entire historical suite remains runnable with LEGACY_TESTS=1.
*/
(async()=>{
let PASS=0,FAIL=0;
const ok=(name,cond,extra='')=>{cond?PASS++:FAIL++;console.log((cond?'PASS ':'FAIL ')+name+(cond?'':' '+extra));};
const section=t=>console.log('\n'+t);
/* منبعِ منتشرشده، در سه نمایِ جدا. چرا سه تا؟ چون پس از شکستنِ سند به
   `assets/app/*`، یک رشتهٔ واحد هم برای سنجش‌های کد لازم است و هم برای
   سنجش‌های استایل و هم برای سنجش‌های خودِ HTML؛ پیش‌تر همه از
   `index.html` می‌خواندند و پس از آن جابه‌جایی کور شده بودند (و با
   `.match(...)[1]` روی نال، هارنس را نیمه‌کاره می‌کشتند). */
const _shipped=require('./_shipped.js');
const SRC=_shipped.source(), CSS=_shipped.css(), DOC=_shipped.document(), __smsChecks=[];
const tryIt=fn=>{try{fn();return 'OK';}catch(e){return e.message;}};
const withData=(patch,fn)=>{const old=Store.data;Store.data=Object.assign(Store.defaults(),patch);try{return fn(Store.data);}finally{Store.data=old;}};
window.scrollTo=()=>{};window.matchMedia=()=>({matches:false,addEventListener(){}});
Store.data=Store.defaults();Store.save();User.ensure();
Session.allow=()=>true;Session.user=()=>true;Session.admin=()=>false;Session.restore=async()=>false;
PaidAccount.refresh=async()=>null;global.fetch=()=>Promise.reject(Error('unit offline'));
init();
const old=fs.readFileSync(__dirname+'/_tests.js','utf8');
const headings=[...old.matchAll(/^section\('([^']+)'\);/gm)];
const titles=[
 'ابزارها','Store و جان','دوز','اسم فامیل','تصویرسازی قرآنی (Art)','دادهٔ قرآن کریم',
 'قاریان و منبع صدا','پیوند بازی «سفر سوره‌ها» با تلاوت','فونت‌های فارسی و نستعلیق','آیهٔ روز','ترجمه‌های فارسی','حافظهٔ متن قرآن','مصحف‌نما (خواندن)',
 'کیفیت دادهٔ بازی‌ها','آزمون معارف (QuizPick)','بانک‌های معارف شیعی','نهج‌البلاغه','بانک ساختهٔ زمان اجرا — سفر سوره‌ها','موتورهای تازه — حدیث‌یاب، چهارده معصوم، نجوا',
 'selfTest درون برنامه','مسیر «همه بازی‌ها»','ذخیرهٔ خودکار وضعیت بازی','دشواری سازگار','کیف سکه','فروشگاه','پوستهٔ کویر','زنجیره','چهرک','راهنمای شناور','تازه‌وارد','مأموریت هفتگی','سکه از راه‌های واقعی',
 'القاب چهارده معصوم — از منبع، بی پاسخِ دوگانه','محتوا — بازرسِ ساختاری، صفر ایراد','دوز — پاداش به برندهٔ واقعی می‌رسد، و فقط یک بار','بازی‌ها — قفل‌های بازمانده و پاداشِ چندباره',
 'آیهٔ کامل — دنبالهٔ آیه نمایش داده می‌شود','نوارِ پیشرفت — سؤالِ جاری شمرده می‌شود','حلقهٔ پیشرفتِ #s-play — SVG جای نوارِ خطی','سفرِ سوره‌ها — شمارش یکتا و نشانِ پایان','پیام‌های کوتاه (toast) — بستن، سقفِ دو، و متنِ ایمن',
 'بزرگ‌نمایی — تصویر و نقشه از قاب بیرون نمی‌زنند','مرجعِ قرآنی — هر آیهٔ پرسیده‌شده سند دارد','پوسته — پوستهٔ کلِ برنامه (فاز ۳)','نورِ آیه‌ها و بنر چرخشی خانه',
 /* نسخهٔ ۱۹الف: موتور اوقات نماز، قبله، تبدیل قمری و کلیدهای عبادتِ
    Store. همان بخش‌هایی که در _tests.js اضافه شدند — این‌جا فهرست
    می‌شوند تا `node _harness.js` (مسیرِ پیش‌فرضِ CI) هم آنها را اجرا
    کند، نه فقط LEGACY_TESTS=1. */
 'موتور اوقات و قبله (نسخهٔ ۱۹الف)','تبدیل قمری و مناسبت‌ها (نسخهٔ ۱۹الف)','Store — کلیدهای عبادت و کلیدِ ناشناس (نسخهٔ ۱۹الف)',
 /* نسخهٔ ۱۹ب: صحنِ روزانه رویِ خانه، دفترچهٔ نماز با سقفِ روزانه،
    قبله و بخشِ «عبادتِ روزانه» در تنظیمات. */
 'صحنِ روزانه (نسخهٔ ۱۹ب)','قبله و تنظیماتِ عبادت (نسخهٔ ۱۹ب)',
 /* نسخهٔ ۲۱ (جایگزینِ ۱۹د): صفحهٔ مستقلِ «عبادت»، تبِ ششم، حذفِ
    «عصر» و «عشا» از اوقات و یادآورها، ستونِ عمودیِ بخش‌ها جای کاروسل،
    متنِ کاملِ ادعیه با منابع و قبله‌نمای واقعی. */
 'صفحهٔ عبادت (نسخهٔ ۲۱)',
 /* نسخهٔ ۱۹: ورد و تسبیح و ختم، کارتِ رمضان، اذانِ محلی و
    مأموریت‌های عبادت. */
 'ذکر و تسبیح و ورد (نسخهٔ ۱۹)','ختم و رمضان (نسخهٔ ۱۹)','اذانِ محلی و مأموریت‌ها (نسخهٔ ۱۹)'
];
const chunks=titles.map(title=>{const i=headings.findIndex(h=>h[1]===title);if(i<0)throw Error('Missing regression section '+title);return old.slice(headings[i].index,headings[i+1].index);});
eval(chunks.join('\n'));
for(const fn of __smsChecks)await fn();
const crypto=require('node:crypto');const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const dataStart=SRC.indexOf('const DATA = '), topicsStart=SRC.indexOf('const TOPICS = ');
const dataSource=dataStart>=0&&topicsStart>dataStart?SRC.slice(dataStart,topicsStart):'';
/* پایهٔ مقایسه: باندلِ همان کامیتی که این فایل را ساخت.
   `0aac0df` کامیتِ «Split inline CSS and JavaScript from index.html» است —
   همان کامیتی که `assets/app/app-1-3bce8fb8d2.js` را با همین نامِ
   محتوا-هش‌دار پدید آورد. بلوکِ DATA از آن روز تا امروز بایت‌به‌بایت
   یکی است (پیش از این سنجش، با دست بررسی شد)، پس این مرجع واقعاً
   «محتوا دست‌نخورده مانده» را می‌سنجد.
   کامیتِ پیشین (456811bf…) وجود دارد ولی در آن روزها هنوز سندی به نام
   `assets/app/app-1-3bce8fb8d2.js` نبود؛ `git show` شکست می‌خورد و
   پشتیبانش هم رشتهٔ نامعتبرِ `456811bfe590d7b4dd4...` بود. نتیجه: سنجش
   بی‌صدا SKIP می‌شد و دروازه، سبزِ دروغ می‌داد. */
let before='';
try{before=require('node:child_process').execFileSync('git',['show','0aac0df:assets/app/app-1-3bce8fb8d2.js'],{maxBuffer:8*1024*1024}).toString();}
catch(e){ before=''; }
const baseStart=before.indexOf('const DATA = '),baseTopics=before.indexOf('const TOPICS = ');
/* کامیتِ مرجع باید حل شود. پیش‌تر اگر `git show` شکست می‌خورد، سنجش
   بی‌صدا به SKIP می‌رفت و سبزِ دروغ می‌داد. حالا همان شکست، خودش یک
   سنجشِ قرمز است: سکوت در دروازه، جای خطا را نمی‌گیرد. */
ok('baseline commit resolves (DATA reference)', !!before,
  'git show 0aac0df:assets/app/app-1-3bce8fb8d2.js — اگر clone تُنُک است: git fetch --unshallow (CI: fetch-depth: 0)');
if(dataSource&&baseStart>=0&&baseTopics>baseStart) ok('DATA source unchanged from original repository',hash(dataSource)===hash(before.slice(baseStart,baseTopics)));
else ok('DATA source unchanged from original repository', false, 'baseline block missing');

/* ── رگرسیونِ نشتِ بوم (فاز ۱) ──
   پیش از رفع، `FX.dust(false)` فقط گره را از DOM برمی‌داشت و حلقهٔ
   requestAnimationFrame روی همان بوم تا ابد می‌چرخید؛ `Splash.hide` هم
   برای مردنِ بوم‌ها در آرایهٔ درونیِ FX دست می‌برد و هر بومِ زندهٔ دیگری
   (غبارِ روشنِ کاربر) را با پرده می‌کشت. این سنجش هر دو را می‌گیرد. */
const fakeCanvas = (id) => ({
  id, clientWidth:320, clientHeight:480, width:0, height:0, isConnected:true,
  getContext: () => ({ clearRect(){}, beginPath(){}, arc(){}, fill(){}, moveTo(){}, lineTo(){}, stroke(){}, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){} }),
  remove(){ this.isConnected = false; }
});
const liveCanvases = () => (FX._canvases || []).filter(c => c.live).map(c => (c.cv && c.cv.id) || '?');
{
  const cv = fakeCanvas('dustBg');
  FX.canvas(cv, { count:5, link:0 });
  ok('بومِ تازه در فهرستِ FX زنده است', liveCanvases().includes('dustBg'));
  const saved$ = U.$;
  try{
    U.$ = (sel, root) => (sel === '#dustBg' ? cv : saved$(sel, root));
    FX.dust(false);
  }finally{ U.$ = saved$; }
  ok('FX.dust(false) حلقهٔ rAF را می‌کُشد', !liveCanvases().includes('dustBg'), 'زنده‌ها: ' + liveCanvases().join(','));
  ok('FX.dust(false) گره را از DOM برمی‌دارد', cv.isConnected === false);
  ok('فهرستِ بوم‌ها پس از خاموش‌کردن پاک می‌شود', !(FX._canvases || []).some(c => c.cv === cv));
}
{
  const a = fakeCanvas('aDust'), b = fakeCanvas('bDust');
  FX.canvas(a, { count:3, link:0 }); FX.canvas(b, { count:3, link:0 });
  const hasStop = typeof FX.stopCanvas === 'function';
  ok('stopCanvas فقط بومِ خواسته‌شده را می‌کُشد', (() => {
    if(!hasStop) return false;
    FX.stopCanvas(a);
    return !liveCanvases().includes('aDust') && liveCanvases().includes('bDust');
  })(), 'زنده‌ها: ' + liveCanvases().join(','));
  ok('stopAllCanvases همهٔ بوم‌ها را می‌کُشد',
    typeof FX.stopAllCanvases === 'function' && (FX.stopAllCanvases(), liveCanvases().length === 0),
    'زنده‌ها: ' + liveCanvases().join(','));
}
/* هیچ‌جا بیرون از خودِ FX نباید در آرایهٔ درونیِ بوم‌ها دست ببرد؛ وگرنه
   دوباره همان باگِ «پرده همه را می‌کُشد» یا «گزنده نه» برمی‌گردد.
   مرزِ FX با نخستین `const ` پس از آن پیدا می‌شود. */
ok('همهٔ ارجاع‌های _canvases داخلِ خودِ FX مانده‌اند', (() => {
  const start = SRC.indexOf('const FX = {');
  if(start < 0) return false;
  const end = SRC.indexOf('\nconst ', start + 10);
  const fxBlock = SRC.slice(start, end < 0 ? undefined : end);
  return (SRC.match(/_canvases/g) || []).length === (fxBlock.match(/_canvases/g) || []).length;
})());
ok('پرده فقط بومِ خودش را می‌کُشد (نه بومِ کاربر)',
  /FX\.stopCanvas\(U\.\$\('#spDust'\)\)/.test(SRC) && !/FX\.stopAllCanvases\(\)/.test(SRC.slice(SRC.indexOf('hide(byUser)'), SRC.indexOf('hide(byUser)') + 2500)));
/* پرده پشت سرِ خودش غبارِ کاربر را دوباره سرِ کار می‌آورد؛ وگرنه بومِ
   زنده‌ی «غبار طلایی» پس از کنار رفتنِ پرده یخ می‌زد. */
ok('پس از پرده، غبارِ کاربر دوباره سرِ کار می‌آید',
  /FX\.stopCanvas\(U\.\$\('#spDust'\)\)[\s\S]{0,200}Theme\.paintAmbient\(\)/.test(SRC));
{
  const cv = fakeCanvas('dustBg');
  FX.canvas(cv, { count:4, link:0 });
  const saved$ = U.$;
  try{
    U.$ = (sel, root) => (sel === '#dustBg' ? cv : saved$(sel, root));
    FX.stopCanvas(cv);                       // مثلِ کاری که پرده می‌کند روی بومِ خودش
    FX.dust(true);                           // کاربر غبار را روشن نگه داشته
  }finally{ U.$ = saved$; }
  ok('dust(true) روی گرهِ مرده حلقه را دوباره راه می‌اندازد', liveCanvases().includes('dustBg'), 'زنده‌ها: ' + liveCanvases().join(','));
  FX.stopAllCanvases();
}
ok('Sudoku metadata registered without modifying original DATA source',typeof Games.sudoku==='function'&&DATA.categories.find(c=>c.id==='brain').games.includes('sudoku'));
const sw=fs.readFileSync(__dirname+'/sw.js','utf8');/* شمارهٔ کش در متنِ سنجش نوشته نمی‌شود: با هر نسخه بالا می‌رود و نوشتنِ
   عدد یعنی سنجش با هر بالابردنِ درست هم قرمز می‌شود. چیزی که باید
   درست بماند این است که چهار کش هم‌شماره باشند — نه شمارهٔ خودشان. */
ok('all five SW caches share one version', (() => {
  const ver = (sw.match(/const CACHE = 'noorestan-(\d+)'/) || [])[1];
  if(!ver) return false;
  return ['noorestan-','noorestan-shell-','noorestan-media-','noorestan-text-','noorestan-games-']
    .every(p => sw.includes(p + ver));
})(), (sw.match(/const CACHE = '[^']*'/) || [''])[0]);
/* برگهٔ سبکِ تازه باید پیش‌ذخیره شود، وگرنه نصبِ آفلاین صفحهٔ ورودِ
   کهنه را نشان می‌دهد. */
ok('auth.css is precached with the shell', sw.includes("'./assets/styles/auth.css'"));

/* ═══════════════════════════════════════════════════════════════════
   فاز ۲ — معماری اطلاعات: یک دروازه برای هر بخش.
   سنجش‌های این بخش تازه‌اند (در `_tests.js` جای زنده‌ای نداشتند) و
   به مسیرِ زندهٔ CI می‌آیند، نه به بخش‌های مرده.
   ═══════════════════════════════════════════════════════════════════ */

/* ── گامِ ۵: «من» با چهار تب — رکوردها و نشان‌ها یکی شدند ──
   پنج تب، دو تای‌شان یک چیز را دو نیم می‌کردند: «رکوردها» و «نشان‌ها».
   حالا «دستاوردها» هر دو را دارد (اول رکوردها، بعد نشان‌ها) و مقدارِ
   قدیمیِ `records`/`badges` هم بی‌خطا به همان می‌رسد. */
section('«من» — چهار تب با دستاوردها (فاز ۲، گامِ ۵)');
{
  const tabs = [...DOC.matchAll(/data-metab="([a-z]+)"/g)].map(m => m[1]);
  const labels = [...DOC.slice(DOC.indexOf('id="meTabs"'), DOC.indexOf('id="meBody"'))
    .matchAll(/<i data-ic="[^"]+"><\/i>\s*([^<]+?)\s*<\/button>/g)].map(m => m[1].trim());
  ok('«من» دقیقاً چهار تب دارد', tabs.length === 4, tabs.join());
  ok('چهار تب: پروفایل | آمار | دستاوردها | تنظیمات',
     tabs.join() === 'profile,stats,achievements,settings' && labels.join('|') === 'پروفایل|آمار|دستاوردها|تنظیمات',
     labels.join('|'));
  ok('تب‌های جداگانهٔ رکوردها و نشان‌ها دیگر وجود ندارند',
     !tabs.includes('records') && !tabs.includes('badges'));
  ok('میان‌برهای پروفایل به یک خانه می‌رسند (مأموریت/نشان/رکورد جدا نشد)',
     !/#pfMissions|#pfBadges|#pfRecords/.test(SRC) && /#pfShop/.test(SRC) && /#pfSettings/.test(SRC));
  /* رندرِ تب با پوشاندنِ U.$ — همان روشی که سنجش‌های بوم به کار می‌برند. */
  const body = (tab, legacy) => {
    const box = { innerHTML:'', onclick:null, textContent:'', value:'',
      classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
      style:{}, dataset:{}, setAttribute(){}, getAttribute(){ return null; } };
    const s$ = U.$;
    U.$ = (sel, root) => (sel === '#meBody' ? box : s$(sel, root));
    try{ Me.tab = legacy; Me.render(); } finally { U.$ = s$; }
    return { html: box.innerHTML, tab: Me.tab };
  };
  const ach = body('achievements', 'achievements');
  ok('دستاوردها هر دو بخش را دارد: رکوردها و نشان‌ها',
     ach.html.includes('رکوردهای شخصی') && ach.html.includes('نشان‌های من'),
     ach.html.slice(0, 80));
  ok('اول رکوردها می‌آید، بعد نشان‌ها',
     ach.html.indexOf('رکوردهای شخصی') < ach.html.indexOf('نشان‌های من'));
  ok('لیدربورد و شمارشِ نشان‌ها گم نشده‌اند',
     ach.html.includes('لیدربورد') && ach.html.includes(`از ${U.fa(DATA.badges.length)}`));
  const leg = body('records', 'records');
  ok('مقدارِ قدیمیِ records به دستاوردها نگاشت می‌شود',
     leg.tab === 'achievements' && leg.html.includes('نشان‌های من'));
  const leg2 = body('badges', 'badges');
  ok('مقدارِ قدیمیِ badges هم به دستاوردها نگاشت می‌شود',
     leg2.tab === 'achievements' && leg2.html.includes('رکوردهای شخصی'));
  ok('سه تبِ دیگر بی‌خطا رندر می‌شوند',
     ['profile', 'stats', 'settings'].every(t => {
       try{ const r = body(t, t); return typeof r.html === 'string' && r.html.length > 50; }
       catch(e){ return false; }
     }));
  Me.tab = 'profile';
}

/* ── گامِ ۳: صحن، بی دروازهٔ دوم ──
   صحن پیش‌تر دو دکمهٔ فویه، چهار دکمهٔ بنر، کلیکِ سربرگ و سه میان‌بر داشت
   که همه به بخش‌هایی می‌بردند که تبِ پایین هم دارد. حالا محتوای صحن
   می‌ماند و ناوبری‌اش فقط تبِ پایین است. */
section('صحن — بی دروازهٔ دوم (فاز ۲، گامِ ۳)');
{
  const home = DOC.slice(DOC.indexOf('id="s-home"'), DOC.indexOf('id="s-online"'));
  const promo = DOC.slice(DOC.indexOf('class="promo-panels"'), DOC.indexOf('class="slider-controls"'));
  ok('ویژگیِ مسیرِ دو دکمهٔ فویه رفته', !/data-foyer-route/.test(SRC));
  ok('چهار دکمهٔ بنرِ چرخشی رفته‌اند', !/data-slide-action/.test(SRC));
  ok('بنرها به محتوای بی‌عمل تبدیل شده‌اند، نه حذف',
     (DOC.match(/class="promo-panel[" ]/g) || []).length === 4 &&
     DOC.includes('نورِ آیه‌ها') && DOC.includes('تلاوت آیه‌به‌آیه') && !/<button/.test(promo));
  ok('کلیکِ سربرگِ صحن دیگر به تلاوت نمی‌برد', !/art\.onclick/.test(SRC));
  ok('میان‌برهای سه‌گانهٔ صحن (تلاوت/بازی/محفل) رفته‌اند',
     !/data-sc-short/.test(SRC) && !/sc-short/.test(SRC + CSS));
  ok('«همه»ی دسته‌ها دیگر دروازه نیست، ولی کاروسلِ دسته‌ها مانده',
     !/data-cat-all/.test(SRC) && /DATA\.categories\.map\(cat => catCarouselHtml/.test(SRC) && /#cats/.test(SRC));
  ok('در صحن هیچ ویژگیِ ناوبریِ تازه‌ای نمانده',
     !/data-(foyer-route|slide-action|sc-short|cat-all)=/.test(home) && !/data-nav=/.test(home));
  /* نسخهٔ ۱۹د: تبِ ششمِ «عبادت» اضافه شد — سه بخشِ بالاییِ صحن به آن
     صفحه منتقل شدند، پس نوارِ پایین حالا شش دروازه دارد و همان‌جا هم
     تنها دروازه می‌ماند. */
  ok('تبِ پایین تنها دروازهٔ شش بخش است', (DOC.match(/class="navi/g) || []).length === 6);
  ok('هیچ دروازهٔ دومی در صحن و عبادت نیست',
     (() => {
       const home = DOC.slice(DOC.indexOf('id="s-home"'), DOC.indexOf('id="s-ebadat"'));
       const eb = DOC.slice(DOC.indexOf('id="s-ebadat"'), DOC.indexOf('id="s-online"'));
       return !/data-nav=/.test(home + eb) && !/Router\.go\(/.test(home + eb);
     })());
}

/* ── گامِ ۲: تلاوتِ یکپارچه — یک گزینشگرِ قاری ──
   پیش از رفع، سه راه برای عوض‌کردنِ قاری بود: شبکهٔ همیشه‌بازِ صفحه
   (`#qReciters`)، پنجرهٔ گزینشگرِ دومی (`#qRecPick` → ReciterUI) و برگهٔ
   پایین‌کشِ نوارِ پخش. تنها برگه می‌ماند و پیش‌نمایشِ ۵ ثانیه‌ایِ دومی
   به آن منتقل می‌شود تا قابلیت گم نشود. */
section('تلاوتِ یکپارچه — یک گزینشگرِ قاری (فاز ۲، گامِ ۲)');
{
  ok('شبکهٔ قاریان از صفحهٔ تلاوت رفته',
     !DOC.includes('id="qReciters"') && !SRC.includes('#qReciters'));
  ok('گزینشگرِ دومِ قاری رفته', !DOC.includes('id="qRecPick"') && !SRC.includes('#qRecPick'));
  ok('ReciterUI کامل برداشته شده و ارجاعی نمانده',
     typeof ReciterUI === 'undefined' && !/ReciterUI/.test(SRC));
  ok('دروازه‌های مصحف‌نما و پلِ بازگشتِ آن رفته‌اند',
     ['qOpenReader', 'qOpenReader2', 'readToQuran']
       .every(id => !DOC.includes(`id="${id}"`) && !SRC.includes(`#${id}`)));
  /* تنها گزینشگر: برگهٔ پایین‌کش — یک پیاده‌سازی، چند درگاه. */
  ok('تنها یک پیاده‌سازیِ برگهٔ قاری هست', (SRC.match(/reciterSheet\(\)\{/g) || []).length === 1);
  ok('کارتِ صفحهٔ تلاوت و نوارِ پخش هر دو به همان برگه می‌رسند',
     /#qRecOpen'\)[\s\S]{0,80}this\.reciterSheet\(\)/.test(SRC) &&
     /rb\.onclick = \(\) => this\.reciterSheet\(\)/.test(SRC));
  ok('تنظیمات و رجیستری هم به برگه می‌رسند، نه به گزینشگرِ حذف‌شده',
     /#setReciters'\)\.onclick = \(\) => QuranUI\.reciterSheet\(\)/.test(SRC) &&
     /reciters:\s*\(\)\s*=>\s*QuranUI\.reciterSheet\(\)/.test(SRC));
  /* پیش‌نمایشِ ۵ ثانیه‌ای: از دومی به برگه منتقل شده است. */
  ok('برگهٔ قاری دکمهٔ شنیدنِ نمونه دارد', /data-prev="\$\{i\}"/.test(SRC));
  ok('نمونه پس از ۵ ثانیه یا با پایانِ فایل می‌ایستد',
     /setTimeout\(stop, 5000\)/.test(SRC) && /onended = stop/.test(SRC));
  ok('زدنِ ▶ فقط می‌شنود و انتخاب نمی‌کند', /closest\('\[data-prev\]'\)/.test(SRC));
  ok('نمونه از منبعِ صوتیِ خودِ برنامه می‌آید (آیةالکرسی = سراسری ۲۶۲)',
     /QSOURCES\[0\]\.url\(r, 2, 255\)/.test(SRC) && QURAN[1].offset + 255 === 262);
  ok('بستنِ پنجره، نمونه را هم می‌بندد', /UI\.onClose|onClose\s*=\s*\(\)\s*=>/.test(SRC) &&
     /stopRecPreview\(\)/.test(SRC));
  /* زیرتب‌های شنیدن/خواندن: یک گزینشگر، دو نما. */
  ok('زیرتبِ شنیدن/خواندن در هر دو صفحه هست',
     (DOC.match(/data-qtab="listen"/g) || []).length === 2 &&
     (DOC.match(/data-qtab="read"/g) || []).length === 2);
  ok('کلیکِ زیرتب از یک جا سیم‌کشی می‌شود و به روتِ کانونی می‌رود',
     /U\.\$\$\('\[data-qtab\]'\)[\s\S]{0,140}Router\.go\(b\.dataset\.qroute\)/.test(SRC));
  ok('وضعیتِ زیرتب با صفحه هم‌گام است',
     /\[data-qtab\][\s\S]{0,160}classList\.toggle\('on'/.test(SRC));
  ok('روتِ read مستقل مانده و همان صفحهٔ مصحف است', Router.screens.read === 's-read');
}

/* ── گامِ ۶: روت‌های قدیمی، نگاشتِ صریح ──
   روت‌های تبِ پایین همیشه کار می‌کردند، ولی `#salah` و `#wird` فقط با
   واپس‌رویِ «ناشناس → خانه» می‌رسیدند: اگر روزی کسی همان واپس‌روی را
   دست می‌زد، لینکِ قدیمیِ کارتِ نصب بی‌صدا می‌شکست. حالا نگاشتِ صریح
   است و هر شش روتِ قدیمی سنجشِ زنده دارند. */
section('روت‌های قدیمی — نگاشتِ صریح (فاز ۲، گامِ ۶)');
{
  const olds = ['home', 'quran', 'play', 'online', 'me', 'read', 'salah', 'wird', 'ebadat'];
  ok('نگاشتِ صریحِ روت‌ها هست', typeof ROUTE_ALIASES === 'object' && ROUTE_ALIASES !== null);
  ok('هر شش روتِ قدیمی به یک صفحهٔ واقعی می‌رسند',
     olds.every(r => !!Router.screens[Router.resolve(r)]),
     olds.filter(r => !Router.screens[Router.resolve(r)]).join());
  /* نسخهٔ ۱۹د: اوقات و ذکر از صحن به صفحهٔ عبادت رفتند، پس همان نگاشتِ
     صریح حالا به آن صفحه می‌رسد. */
  ok('#salah و #wird صریحاً به صفحهٔ عبادت نگاشت شده‌اند (نه واپس‌رویِ ناشناس)',
     ROUTE_ALIASES.salah === 'ebadat' && Router.resolve('salah') === 'ebadat' &&
     Router.resolve('wird') === 'ebadat' && Router.screens.ebadat === 's-ebadat');
  ok('#read صفحهٔ مستقلِ خودش را نگه داشته', ROUTE_ALIASES.read === undefined && Router.screens.read === 's-read');
  ok('روتِ ناشناس دست‌نخورده می‌ماند تا واپس‌رویِ خانه بگیرد',
     Router.resolve('چنین‌روتی‌نیست') === 'چنین‌روتی‌نیست');
  ok('Router.go با نامِ قدیمی، پشته و نشانی را روی صفحهٔ درست می‌نشاند', (() => {
     const n = Router.stack.length;
     Router.go('salah');
     const cur = Router.stack[Router.stack.length - 1];
     const url = history.__list()[history.__list().length - 1].url;
     Router.go('home');
     return cur === 'ebadat' && url === '#ebadat' && Router.stack.length >= n;
  })());
}

/* ── گامِ ۱: نوارِ بالا فقط نشان و زنگِ اعلان ──
   پیش از رفع: `#btnQuran` و `#btnNet` دو دروازهٔ دوم به تلاوت و محفل
   بودند و نوارِ بالا سه دکمه داشت. حالا تنها دروازهٔ هر بخش، تبِ
   پایین است و نوارِ بالا فقط اعلان را باز می‌کند. */
section('نوارِ بالا — تنها یک دروازه (فاز ۲، گامِ ۱)');
{
  const topStart = DOC.indexOf('<div class="top">');
  const topEnd = DOC.indexOf('id="s-home"');
  const top = (topStart >= 0 && topEnd > topStart) ? DOC.slice(topStart, topEnd) : '';
  const iconBtns = (top.match(/class="iconbtn"/g) || []).length;
  ok('نوارِ بالا فقط یک دکمهٔ آیکنی دارد', iconBtns === 1, `${iconBtns} دکمه`);
  ok('دکمهٔ تلاوتِ نوارِ بالا رفته', !DOC.includes('id="btnQuran"'));
  ok('دکمهٔ شبکهٔ نوارِ بالا رفته', !DOC.includes('id="btnNet"'));
  /* قاعدهٔ ۷ (بی‌صاحب نماندنِ شناسه): هیچ هندلری در باندل به شناسه‌های
     حذف‌شده اشاره نمی‌کند. `Router.go('quran')` و `Router.go('online')`
     سرِ جایشان هستند — آن‌ها دروازهٔ تبِ پایین‌اند و این سنجش فقط
     دنبالِ دکمه‌های مردهٔ نوارِ بالاست. */
  ok('هیچ هندلرِ بی‌صاحبی برای شناسه‌های حذف‌شده نمانده',
     !/#btnQuran|#btnNet/.test(SRC), (SRC.match(/#btnQ(uran)?|#btnNet/g) || []).slice(0, 3).join());
  ok('زنگِ اعلان تنها دروازهٔ نوارِ بالا و وصل است',
     /U\.\$\('#btnNotif'\)\.onclick = \(\) => Router\.go\('notif'\)/.test(SRC));
  /* وضعیتِ شبکه گم نشده؛ فقط ناوبری‌اش رفته: چیپِ صحن و چیپِ محفل. */
  ok('وضعیتِ شبکه در صحن و محفل می‌ماند، بی دروازه',
     DOC.includes('id="cNet"') && DOC.includes('id="netState"') &&
     !/U\.\$\('#cNet'\)\.onclick|U\.\$\('#netState'\)\.onclick/.test(SRC));
  ok('نشانِ نورستان در نوارِ بالا مانده', /class="brand"/.test(top));
}
/* ── گامِ ۴: بازی — کاتالوگِ خالص، فیلترِ مهارت، مأموریت و رکورد ──
   پیش از رفع، «کاتالوگِ بازی» عملاً منوی دومی برای کلِ برنامه بود: از ۲۸
   کاشیِ دیدنی، ۱۱ تای‌شان دروازهٔ بخشِ دیگر (پروفایل، فروشگاه، محفل،
   قاریان…). مأموریت‌های امروز هم در صحن بود و در «من» میان‌بر داشت — دو
   خانه برای یک محتوا. حالا کاتالوگ فقط بازیِ واقعی دارد، دو نوارِ فیلتر
   (دسته + مهارت) گرفته و مأموریت/رکورد یک خانه دارند: همین برگه. */
section('بازی — کاتالوگِ خالص، فیلترِ مهارت، مأموریت و رکورد (فاز ۲، گامِ ۴)');
{
  const GATES = ['recite','online-lobby','friends','daily','missions','profile','stats',
    'badges','leaderboard','settings','collection','shop','bookmarks','reciters','onboarding'];
  const REAL = ['ayahlight','surah','scramble','quiz','exam','nahj','hadith','imams','dua',
    'meaning','speed','iran','match','memory','dooz','esmfamil','sudoku',
    'ayah-builder','hadith-rush','noor-pairs','tree'];
  const SKILL_IDS = ['memory','speed','accuracy','word','knowledge','maaref'];
  /* برگهٔ بازی را همان‌طور که کاربر می‌بیند می‌گیریم: خروجیِ paint را در
     یک جعبهٔ ساختگی می‌ریزیم — همان روشی که سنجش‌های بوم به کار می‌برند. */
  const box = { innerHTML:'', onclick:null, textContent:'', value:'', hidden:false, dataset:{},
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    style:{}, setAttribute(){}, getAttribute(){ return null; }, addEventListener(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; } };
  const s$ = U.$;
  let html = '';
  try{ U.$ = (sel, root) => (sel === '#pgBody' ? box : s$(sel, root)); Launcher.paint(); html = box.innerHTML; }
  finally{ U.$ = s$; }
  /* فقط کاشی‌های کاتالوگ (`#gameGrid`) — نوارِ پیشنهادهای سریع هم
     `data-game` دارد ولی کاتالوگ نیست. */
  const grid = html.slice(Math.max(html.indexOf('id="gameGrid"'), 0), html.indexOf('id="gameEmpty"'));
  const tiles = [...grid.matchAll(/data-game="([^"]+)"/g)].map(m => m[1]);
  const tags  = [...grid.matchAll(/<button[^>]*data-game="[^"]+"[^>]*>/g)].map(m => m[0]);
  const bar   = html.slice(Math.max(html.indexOf('id="skillFilter"'), 0), html.indexOf('id="gameGrid"'));
  const skillBtns = [...bar.matchAll(/data-skill="([a-z]+)"/g)].map(m => m[1]);
  const home = DOC.slice(DOC.indexOf('id="s-home"'), DOC.indexOf('id="s-online"'));
  ok('کاتالوگ فقط بازیِ واقعی دارد، بی هیچ دروازهٔ بخشِ دیگر',
     tiles.length >= REAL.length - 1 && tiles.every(id => !GATES.includes(id)),
     `${tiles.length} کاشی؛ دروازه‌ها: ` + tiles.filter(id => GATES.includes(id)).join());
  ok('فهرستِ خالصِ کاتالوگ یک منبع دارد',
     typeof catalogIds === 'function' && typeof HIDDEN_FROM_CATALOG === 'object' &&
     GATES.every(g => HIDDEN_FROM_CATALOG.has(g)) &&
     catalogIds().slice().sort().join() === tiles.slice().sort().join(),
     typeof catalogIds === 'function' ? catalogIds().length + ' شناسه' : 'catalogIds نیست');
  ok('سه بازیِ مستقل، سودوکو و درختِ دانش در کاتالوگ مانده‌اند',
     ['ayah-builder','hadith-rush','noor-pairs','sudoku','tree'].every(id => tiles.includes(id)),
     ['ayah-builder','hadith-rush','noor-pairs','sudoku','tree'].filter(id => !tiles.includes(id)).join());
  /* قاعدهٔ «هر بخش یک دروازه»: خودِ برگهٔ بازی هیچ ناوبریِ میان‌بخشی ندارد. */
  const lz = SRC.indexOf('const Launcher = {');
  const paintAt = SRC.indexOf('paint(){', lz);
  ok('برگهٔ بازی هیچ `Router.go` به بخشِ دیگر ندارد',
     paintAt > lz && !/Router\.go\(/.test(SRC.slice(paintAt, SRC.indexOf('12. LEVEL', paintAt))));
  ok('هر کاشیِ کاتالوگ یک مهارت دارد و مهارتش با نقشه یکی است',
     typeof SKILLS === 'object' && tags.length === tiles.length && tiles.length > 0 &&
     tiles.every(id => !!SKILLS[id]) &&
     tags.every(t => new RegExp(`data-skill="${SKILLS[t.match(/data-game="([^"]+)"/)[1]]}"`).test(t)),
     tags.filter(t => !/data-skill="/.test(t)).length + ' کاشیِ بی‌مهارت');
  ok('نقشهٔ مهارت‌ها و دستهٔ نمایشی بیرونِ DATA و کامل‌اند',
     typeof CATALOG_CATS === 'object' && typeof CATALOG_CAT === 'object' &&
     SKILL_IDS.every(s => Object.values(SKILLS).includes(s)) &&
     tiles.every(id => !!CATALOG_CAT[id]) &&
     Object.keys(CATALOG_CAT).every(id => !GATES.includes(id)));
  ok('دو نوارِ فیلتر: دسته (بی «حساب من») و مهارت',
     /data-filter="all"/.test(html) && skillBtns.includes('all') &&
     SKILL_IDS.every(s => skillBtns.includes(s)) &&
     !/data-filter="account"/.test(html) &&
     typeof SKILL_LABELS === 'object' && SKILL_IDS.every(s => {
       const l = (SKILL_LABELS || []).find(x => x.id === s);
       return !!l && bar.includes(l.title);
     }),
     skillBtns.join());
  ok('مأموریت‌های امروز یک خانه دارند: برگهٔ بازی، نه صحن',
     !DOC.includes('id="homeMissCard"') && !/#homeMiss|#missCnt|#missOpen/.test(SRC) &&
     !/id="homeMissCard"|#homeMiss/.test(DOC + CSS) &&
     html.includes('id="pgMissions"') && /class="miss[ "]/ .test(html));
  ok('میان‌برِ نصبِ «مأموریت‌های امروز» به همان خانهٔ تازه می‌رسد',
     /"url": "\.\/#play"/.test(require('fs').readFileSync(__dirname + '/manifest.json', 'utf8')));
  ok('میان‌برِ دومِ مأموریت در «من» هم برداشته شد',
     !/#setMissions|#pfMissions/.test(SRC) && /id="pgMissAll"/.test(html));
  ok('مأموریت‌ها بی‌نشان نشده‌اند: شمارش و راهِ برگهٔ کامل هست',
     /id="pgMissCnt"/.test(html) && /id="pgMissAll"/.test(html));
  ok('نوارِ «رکوردهای من» بالای کاتالوگ است',
     html.includes('id="pgRecords"') && html.indexOf('id="pgRecords"') < html.indexOf('id="gameGrid"') &&
     /رکوردهای من/.test(html));
  ok('«آیهٔ روز» به تصمیمِ تو در صحن ماند', home.includes('id="daily"') && DOC.includes('id="daily"'));
  ok('صفحهٔ بازی هنوز با روتِ #play بالا می‌آید', Router.screens.play === 's-play' && tryIt(() => Router.go('play')) === 'OK');
}

/* ── گامِ ۷: نسخهٔ کشِ سرویس‌ورکر ──
   پوسته عوض شد (سند + باندل + CSS)، پس بی بالا بردنِ نسخهٔ کش، کاربرِ
   نصب‌شده نسخهٔ کهنه را از کش می‌دید. هر پنج کش باید با هم بالا بروند،
   وگرنه یک لایه کهنه می‌ماند. */
section('نسخهٔ کشِ سرویس‌ورکر (فاز ۲، گامِ ۷)');
{
  const sw = fs.readFileSync(__dirname + '/sw.js', 'utf8');
  const vers = [...sw.matchAll(/const (?:CACHE|SHELL|MEDIA|TEXT|GAMES)\s*=\s*'noorestan(?:-shell|-media|-text|-games)?-(\d+)'/g)].map(m => m[1]);
  const n = Number(vers[0]);
  ok('پنج کشِ سرویس‌ورکر یک نسخه دارند',
     vers.length === 5 && vers.every(v => v === vers[0]), vers.join());
  ok('نسخهٔ کش برای تغییرِ پوستهٔ فاز ۲ بالا رفته', n >= 41, vers[0]);
  ok('باندل و CSS هنوز در فهرستِ پیش‌ذخیره‌اند',
     /'\.\/assets\/app\/app-1-3bce8fb8d2\.js'/.test(sw) && /'\.\/assets\/app\/style-1-fd30642d4f\.css'/.test(sw));
}

ok('no executable local-room or local-OTP fallback',typeof MiniServer==='undefined'&&typeof Gate.guest==='undefined'&&typeof OTP.code==='undefined');
await new Promise(r=>setTimeout(r,1700));ok('no unhandled timer failures',global.__lateErrs.length===0);
console.log(`RESULT ${PASS} passed, ${FAIL} failed; ${titles.length} preserved regression sections.`);process.exit(FAIL?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
