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
 'صحنِ روزانه (نسخهٔ ۱۹ب)','قبله و تنظیماتِ عبادت (نسخهٔ ۱۹ب)'
];
const chunks=titles.map(title=>{const i=headings.findIndex(h=>h[1]===title);if(i<0)throw Error('Missing regression section '+title);return old.slice(headings[i].index,headings[i+1].index);});
eval(chunks.join('\n'));
for(const fn of __smsChecks)await fn();
const crypto=require('node:crypto');const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const dataStart=SRC.indexOf('const DATA = '), topicsStart=SRC.indexOf('const TOPICS = ');
const dataSource=dataStart>=0&&topicsStart>dataStart?SRC.slice(dataStart,topicsStart):'';
/* پایهٔ مقایسه: ابتدا bundle همان کامیت، سپس index تاریخی همان کامیت. */
let before='';
try{before=require('node:child_process').execFileSync('git',['show','456811bfe590d7b4dd62ba2231a2b435bdba0952:assets/app/app-1-3bce8fb8d2.js'],{maxBuffer:8*1024*1024}).toString();}
catch(e){try{before=require('node:child_process').execFileSync('git',['show','456811bfe590d7b4dd4...'],{maxBuffer:8*1024*1024}).toString();}catch(_){}}
const baseStart=before.indexOf('const DATA = '),baseTopics=before.indexOf('const TOPICS = ');
if(dataSource&&baseStart>=0&&baseTopics>baseStart) ok('DATA source unchanged from original repository',hash(dataSource)===hash(before.slice(baseStart,baseTopics)));
else console.log('SKIP baseline DATA: historical reference unavailable');
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
ok('no executable local-room or local-OTP fallback',typeof MiniServer==='undefined'&&typeof Gate.guest==='undefined'&&typeof OTP.code==='undefined');
await new Promise(r=>setTimeout(r,1700));ok('no unhandled timer failures',global.__lateErrs.length===0);
console.log(`RESULT ${PASS} passed, ${FAIL} failed; ${titles.length} preserved regression sections.`);process.exit(FAIL?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
