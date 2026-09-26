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
  addEventListener(t, f){ (global.__on.document[t] = global.__on.document[t] || []).push(f); },
  removeEventListener(){},
  activeElement:null,
  documentElement:{ setAttribute(){}, getAttribute(){ return null; },
    style:{ setProperty(){}, getPropertyValue(){ return ''; }, removeProperty(){} } },
  body: el(), execCommand(){ return true; }, hidden:false };
/* شنونده‌ها ثبت می‌شوند تا بشود رویدادها را دستی انداخت. بی این، رفتار
   «دکمهٔ بازگشت» و «Escape» هرگز سنجیده نمی‌شد. */
global.__on = { window:{}, document:{} };
global.__fire = (where, type, ev = {}) => {
  const l = (global.__on[where] || {})[type] || [];
  for(const f of l.slice()){
    try{ f(Object.assign({ preventDefault(){}, stopPropagation(){}, key:'', shiftKey:false }, ev)); }
    catch(e){ global.__lateErrs.push(e); }
  }
  return l.length;
};
global.window = {
  addEventListener(t, f){ (global.__on.window[t] = global.__on.window[t] || []).push(f); },
  removeEventListener(){},
  crypto:null, isSecureContext:false, isSecureContext_:false
};
global.navigator = { vibrate(){ return true; } };
global.localStorage = { _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; }, removeItem(k){ delete this._d[k]; } };
global.location = { hash:'', replace(){}, href:'http://localhost/' };
/* تاریخچهٔ کمینه ولی *باحالت*: ورودی‌ها را نگه می‌دارد تا بشود رفتار
   «دکمهٔ بازگشت» را سنجید. پیش‌تر استابِ بی‌اثر بود و هر سنجشِ تاریخچه
   بی‌معنا می‌شد. برنامه فقط pushState/replaceState/back را صدا می‌زند.
   back از سرِ فهرست برمی‌گردد و popstate را همگام می‌اندازد — مرورگر
   ناهمگام می‌اندازد، ولی منطق برنامه در هر دو حالت یکی است چون همه‌چیز
   به _swallow و ورودیِ کنونی نگاه می‌کند، نه به زمان‌بندی. */
global.history = (() => {
  let list = [{ state:null, url:'#home' }], i = 0;
  return {
    get length(){ return list.length; },
    get state(){ return list[i].state; },
    pushState(s, _t, url){ list.splice(i + 1); list.push({ state:s, url:url || '' }); i = list.length - 1; },
    replaceState(s, _t, url){ list[i] = { state:s, url:url || '' }; },
    back(){ if(i > 0){ i--; global.__fire('window', 'popstate', { state:list[i].state }); } },
    __list(){ return list.slice(); },
    __i(){ return i; },
    __reset(){ list = [{ state:null, url:'#home' }]; i = 0; }
  };
})();
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
  process.exitCode=1;
  process.stderr.write('\n⚠️ استثنای بی‌گیر (harness): ' +
    ((e && e.stack) || String(e)) + '\n');
};
process.on('uncaughtException', reportLate);
process.on('unhandledRejection', reportLate);

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if(!m) throw new Error('تگ <script> در index.html پیدا نشد');
const test = fs.readFileSync(__dirname + (process.env.LEGACY_TESTS === '1' ? '/_tests.js' : '/_phase2-regression-tests.js'), 'utf8');
eval(m[1] + '\n;\n' + test);
