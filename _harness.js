// هارنس تست: استاب DOM + اجرای منطق کلاینت در Node
const fs = require('fs');
const path = require('path');
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
  documentElement:{ setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
    style:{ setProperty(){}, getPropertyValue(){ return ''; }, removeProperty(){} } },
  body: el(), execCommand(){ return true; }, hidden:false };
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
  removeEventListener(){}, crypto:null, isSecureContext:false, isSecureContext_:false
};
global.navigator = { vibrate(){ return true; } };
global.localStorage = { _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; }, removeItem(k){ delete this._d[k]; } };
global.location = { hash:'', replace(){}, href:'http://localhost/' };
global.history = (() => {
  let list = [{ state:null, url:'#home' }], i = 0;
  return {
    get length(){ return list.length; }, get state(){ return list[i].state; },
    pushState(s, _t, url){ list.splice(i + 1); list.push({ state:s, url:url || '' }); i = list.length - 1; },
    replaceState(s, _t, url){ list[i] = { state:s, url:url || '' }; },
    back(){ if(i > 0){ i--; global.__fire('window', 'popstate', { state:list[i].state }); } },
    __list(){ return list.slice(); }, __i(){ return i; }, __reset(){ list = [{ state:null, url:'#home' }]; i = 0; }
  };
})();
global.URL.createObjectURL = () => 'blob:x';
global.URL.revokeObjectURL = () => {};
global.Blob = class { constructor(){} };
global.FileReader = class {};
global.BroadcastChannel = undefined;
global.Audio = class {
  constructor(){ this.src = ''; this.paused = true; this.volume = 1; this.playbackRate = 1; this.readyState = 0; }
  addEventListener(){} removeEventListener(){} play(){ this.paused = false; return Promise.resolve(); }
  pause(){ this.paused = true; } load(){} remove(){} closest(){ return null; }
};
const _rafQ = [];
global.requestAnimationFrame = fn => { _rafQ.push(fn); return _rafQ.length; };
global.cancelAnimationFrame = () => {};
let _rafT = 0;
global.__drainRaf = (limit = 4000) => { let n = 0; while(_rafQ.length && n++ < limit){ const fn = _rafQ.shift(); _rafT += 16; try{ fn(_rafT); }catch(e){ console.warn(e); } } return n; };
global.crypto = require('crypto').webcrypto;
global.__lateErrs = [];
const reportLate = e => { global.__lateErrs.push(e); process.exitCode=1; process.stderr.write('\n⚠️ استثنای بی‌گیر (harness): ' + ((e && e.stack) || String(e)) + '\n'); };
process.on('uncaughtException', reportLate);
process.on('unhandledRejection', reportLate);

// index.html اکنون اسکریپت خارجی منتشرشده را بار می‌کند؛ inline legacy هم پشتیبانی می‌شود.
/* نسخهٔ ۱۹: برنامه بیش از یک اسکریپت محلی دارد (باندل اصلی + موتور
   اوقاتِ صلاح + …). هارنس باید همه را به ترتیبِ سند بخواند و پشتِ هم
   eval کند — دقیقاً همان کاری که مرورگر می‌کند و همان قراردادی که
   _shipped.js برای سنجش‌های متنی دارد. پیش‌تر فقط *اولین* اسکریپت
   خوانده می‌شد و هر فایلِ تازه برای تست‌ها نامرئی بود. */
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const external = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(m => m[1]);
const inline = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
const localScripts = external.filter(src => !/^https?:\/\//i.test(src));
const appSource = localScripts.length
  ? localScripts.map(src => fs.readFileSync(path.join(__dirname, src), 'utf8')).join('\n;\n')
  : (inline && inline[1]);
if(!appSource) throw new Error('اسکریپت برنامه در index.html پیدا نشد');
const test = fs.readFileSync(path.join(__dirname, process.env.LEGACY_TESTS === '1' ? '_tests.js' : '_phase2-regression-tests.js'), 'utf8');
eval(appSource + '\n;\n' + test);
