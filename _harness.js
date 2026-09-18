// هارنس تست: استاب DOM + اجرای منطق کلاینت در Node
const fs = require('fs');
const el = () => ({
  addEventListener(){}, querySelector(){ return el(); }, querySelectorAll(){ return []; },
  classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  style:{}, setAttribute(){}, getAttribute(){ return null; }, appendChild(){}, remove(){},
  children:[], firstChild:null, innerHTML:'', value:'', textContent:'', disabled:false,
  focus(){}, closest(){ return null; }, dataset:{}
});
global.document = { querySelector:()=>el(), querySelectorAll:()=>[], createElement:()=>el(),
  addEventListener(){},
  documentElement:{ setAttribute(){}, getAttribute(){ return null; },
    style:{ setProperty(){}, getPropertyValue(){ return ''; }, removeProperty(){} } },
  body: el(), execCommand(){ return true; }, hidden:false };
global.window = { addEventListener(){}, crypto:null, isSecureContext:false, isSecureContext_:false };
global.navigator = { vibrate(){ return true; } };
global.localStorage = { _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; }, removeItem(k){ delete this._d[k]; } };
global.location = { hash:'', replace(){}, href:'http://localhost/' };
global.history = { pushState(){}, replaceState(){}, back(){} };
global.URL.createObjectURL = () => 'blob:x';
global.URL.revokeObjectURL = () => {};
global.Blob = class { constructor(){} };
global.FileReader = class {};
global.BroadcastChannel = undefined;
// مرورگر HTMLAudioElement دارد، Node ندارد — استاب کمینه تا موتور تلاوت خطا ندهد
global.Audio = class {
  constructor(){ this.src = ''; this.paused = true; this.volume = 1; this.playbackRate = 1; this.readyState = 0; }
  addEventListener(){} removeEventListener(){} play(){ this.paused = false; return Promise.resolve(); }
  pause(){ this.paused = true; } load(){} remove(){} closest(){ return null; }
};
/* مرورگر rAF را ناهمگام صدا می‌زند. استاب همگامِ پیشین هر حلقهٔ انیمیشنی را
   به «سرریز پشته» می‌کشاند و خطاهایی می‌ساخت که در مرورگر هرگز رخ نمی‌دهند.
   پس صف می‌کنیم و در پایان کار، پشت‌سرهم و بی‌عمق اجرا می‌کنیم. */
const _rafQ = [];
global.requestAnimationFrame = fn => { _rafQ.push(fn); return _rafQ.length; };
global.cancelAnimationFrame = () => {};
let _rafT = 0;
global.__drainRaf = (limit = 4000) => {
  let n = 0;
  while(_rafQ.length && n++ < limit){
    const fn = _rafQ.shift();
    _rafT += 16;
    try{ fn(_rafT); }catch(e){ console.warn(e); }
  }
  return n;
};
global.crypto = require('crypto').webcrypto;

// اسکریپت برنامه مستقیماً از خود index.html بیرون کشیده می‌شود
/* خطاهای دیرهنگامِ تایمرها و پرامیسی که هیچ‌کس نمی‌گیرد — بی این‌ها
   فرآیند تست بی‌صدا می‌مرد و علتش پیدا نمی‌شد.

   مهم: خطا را *بی‌درنگ* چاپ می‌کنیم، نه فقط در پایان. اگر خطای بی‌گیر رخ
   دهد و بعدش یک تایمر دوره‌ای زنده بماند، فرآیند به‌جای مردن «تعلیق»
   می‌شود و تا پایان هیچ‌وقت نمی‌رسد؛ در آن حالت گزارشِ پایانی هرگز
   چاپ نمی‌شد و فقط یک تایم‌اوت بی‌توضیح می‌ماند. */
global.__lateErrs = [];
const reportLate = e => {
  global.__lateErrs.push(e);
  process.stderr.write('\n⚠️ استثنای بی‌گیر (harness): ' +
    ((e && e.stack) || String(e)) + '\n');
};
process.on('uncaughtException', reportLate);
process.on('unhandledRejection', reportLate);

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if(!m) throw new Error('تگ <script> در index.html پیدا نشد');
const test = fs.readFileSync(__dirname + '/_tests.js', 'utf8');
eval(m[1] + '\n;\n' + test);
