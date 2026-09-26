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
const SRC=fs.readFileSync(__dirname+'/index.html','utf8'),__smsChecks=[];
const tryIt=fn=>{try{fn();return 'OK';}catch(e){return e.message;}};
const withData=(patch,fn)=>{const old=Store.data;Store.data=Object.assign(Store.defaults(),patch);try{return fn(Store.data);}finally{Store.data=old;}};
window.scrollTo=()=>{};window.matchMedia=()=>({matches:false,addEventListener(){}});
Store.data=Store.defaults();Store.save();User.ensure();
// Trusted unit-fixture boundary only. UI/server authority itself is tested without these stubs.
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
 'بزرگ‌نمایی — تصویر و نقشه از قاب بیرون نمی‌زنند','مرجعِ قرآنی — هر آیهٔ پرسیده‌شده سند دارد','پوسته — پوستهٔ کلِ برنامه (فاز ۳)','نورِ آیه‌ها و بنر چرخشی خانه'
];
const chunks=titles.map(title=>{const i=headings.findIndex(h=>h[1]===title);if(i<0)throw Error('Missing regression section '+title);return old.slice(headings[i].index,headings[i+1].index);});
// A single eval preserves lexical helpers shared by historical sections.
eval(chunks.join('\n'));
for(const fn of __smsChecks)await fn();
const crypto=require('node:crypto');const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const dataSource=SRC.slice(SRC.indexOf('const DATA = '),SRC.indexOf('const TOPICS = '));
const before=require('node:child_process').execFileSync('git',['show','456811bfe590d7b4dd62ba2231a2b435bdba0952:index.html'],{maxBuffer:8*1024*1024}).toString();
const baseData=before.slice(before.indexOf('const DATA = '),before.indexOf('const TOPICS = '));
ok('DATA source unchanged from original repository',hash(dataSource)===hash(baseData));
ok('Sudoku metadata registered without modifying original DATA source',typeof Games.sudoku==='function'&&DATA.categories.find(c=>c.id==='brain').games.includes('sudoku'));
const sw=fs.readFileSync(__dirname+'/sw.js','utf8');ok('all four SW caches at version 22',['noorestan-22','noorestan-shell-22','noorestan-media-22','noorestan-text-22'].every(k=>sw.includes(k)));
ok('no executable local-room or local-OTP fallback',typeof MiniServer==='undefined'&&typeof Gate.guest==='undefined'&&typeof OTP.code==='undefined');
await new Promise(r=>setTimeout(r,1700));ok('no unhandled timer failures',global.__lateErrs.length===0);
console.log(`RESULT ${PASS} passed, ${FAIL} failed; ${titles.length} preserved regression sections.`);process.exit(FAIL?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
