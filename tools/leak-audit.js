#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────
   نورستان — سنجشِ نشت (ابزار توسعه؛ منتشر نمی‌شود)
   ─────────────────────────────────────────────────────────────
   چه می‌سنجد؟
     ۱) شمارِ تایمرهای زنده (interval/timeout) پیش و پس از گشتن بین تب‌ها
     ۲) شمارِ شنونده‌های زنده روی window و document
     ۳) شمارِ فریم‌های requestAnimationFrame در طول همان گشتن
     ۴) سرنوشتِ بوم‌ها: FX.dust(true) → FX.dust(false)
     ۵) سرنوشتِ بومِ پرده پس از Splash.hide()  (باید بمیرد)
     ۶) سرنوشتِ غبارِ کاربر پس از Splash.hide() (نباید بمیرد)

   چرا ابزار است و نه سنجش؟ چون شمارشِ «شنوندهٔ زنده» به استابِ
   شبیه‌سازِ مرورگر نیاز دارد و این استاب جایگزینِ مرورگر نیست. عددِ
   آن برای «قبل و بعد»ی فازِ نشت است، نه برای دروازهٔ CI.
   اجرا: node tools/leak-audit.js
   ───────────────────────────────────────────────────────────── */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* ── شمارنده‌ها ── */
const liveIntervals = new Set(), liveTimeouts = new Set();
const listeners = { window: {}, document: {} };
let rafPushed = 0, rafPending = 0;
const real = {
  setInterval: global.setInterval, clearInterval: global.clearInterval,
  setTimeout: global.setTimeout, clearTimeout: global.clearTimeout
};
global.setInterval = (fn, ms, ...a) => { const id = real.setInterval(fn, ms, ...a); liveIntervals.add(id); return id; };
global.clearInterval = id => { liveIntervals.delete(id); try{ real.clearInterval(id); }catch(e){} };
global.setTimeout = (fn, ms, ...a) => { const id = real.setTimeout(fn, ms, ...a); liveTimeouts.add(id); return id; };
global.clearTimeout = id => { liveTimeouts.delete(id); try{ real.clearTimeout(id); }catch(e){} };

/* ساعتِ مجازی: `U.now()` روی `Date.now()` است و انیمیشن‌های کوتاه
   (مثل countUp) تا وقتی k<1 بماند فریم می‌خواهند. اگر ساعت یخ بزند،
   هر انیمیشنِ کوتاه به حلقهٔ بی‌پایان بدل می‌شود و عددِ نشت را کاذب
   بالا می‌برد. پس هر فریمِ پیموده‌شده، ساعت را ۱۶ms جلو می‌برد. */
let vnow = 1e12;
Date.now = () => vnow;
const rafQ = [];
global.requestAnimationFrame = fn => { rafPushed++; rafPending++; rafQ.push(fn); return rafPushed; };
global.cancelAnimationFrame = () => { rafPending = Math.max(0, rafPending - 1); };
global.__drainRaf = (limit = 400) => {
  let n = 0;
  while(rafQ.length && n++ < limit){ vnow += 16; rafPending = Math.max(0, rafPending - 1); const fn = rafQ.shift(); try{ fn(); }catch(e){} }
  return n;
};

/* ── استابِ DOM: گره‌ها واقعی و متمایز، تا رفتار معنادار باشد ──
   عمداً `querySelectorAll` تهی است (مثلِ هارنس) تا «حدِ پایین» بسنجیم:
   هر چیزی که در این حالت هم می‌شماریم، در مرورگر هم هست. */
const mkEl = (tag = 'div', id = '') => ({
  tagName: String(tag).toUpperCase(), id, dataset: {}, children: [], parentNode: null,
  isConnected: true, hidden: false, value: '', textContent: '', innerHTML: '', className: '',
  clientWidth: 360, clientHeight: 600, offsetWidth: 360, width: 0, height: 0, scrollTop: 0,
  style: { setProperty(){}, removeProperty(){} },
  classList: { _s: new Set(), add(...c){ c.forEach(x => this._s.add(x)); }, remove(...c){ c.forEach(x => this._s.delete(x)); },
    toggle(c, f){ f === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (f ? this._s.add(c) : this._s.delete(c)); },
    contains(c){ return this._s.has(c); } },
  addEventListener(){}, removeEventListener(){},
  querySelector(){ return null; }, querySelectorAll(){ return []; },
  setAttribute(k, v){ if(k === 'id') this.id = String(v); }, getAttribute(){ return null; }, removeAttribute(){},
  appendChild(c){ c.parentNode = this; this.children.push(c); return c; },
  insertBefore(c, ref){ c.parentNode = this; const i = this.children.indexOf(ref); if(i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; },
  replaceChild(c, old){ this.removeChild(old); return this.appendChild(c); }, cloneNode(){ return mkEl(this.tagName); },
  removeChild(c){ this.children = this.children.filter(x => x !== c); }, hasAttribute(){ return false; },
  remove(){
    /* از گرهٔ پدر هم جدا شود؛ وگرنه #dustBg پس از برداشتن هم پیدا
       می‌شود و اندازه‌گیریِ چرخه‌های روشن/خاموش بی‌معنا می‌شود. */
    if(this.parentNode && this.parentNode.children) this.parentNode.children = this.parentNode.children.filter(x => x !== this);
    this.isConnected = false; this.parentNode = null;
  },
  focus(){}, blur(){}, click(){}, closest(){ return null; }, contains(){ return false; }, matches(){ return false; },
  getBoundingClientRect(){ return { left: 0, top: 0, width: 360, height: 600, right: 360, bottom: 600 }; },
  animate(){ return { finished: Promise.resolve(), cancel(){} }; },
  getContext(){ return { clearRect(){}, beginPath(){}, arc(){}, fill(){}, moveTo(){}, lineTo(){}, stroke(){},
    set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){} }; },
  get firstChild(){ return this.children[0] || null; },
  get childNodes(){ return this.children; },
  get lastChild(){ return this.children[this.children.length - 1] || null; }
});
const fake = new Map();
const getFake = sel => { if(!fake.has(sel)) fake.set(sel, mkEl('div', String(sel).replace(/^#/, ''))); return fake.get(sel); };
const findByDomId = id => {
  const walk = n => { if(!n) return null; if(n.id === id) return n; for(const c of (n.children || [])){ const r = walk(c); if(r) return r; } return null; };
  return walk(global.document.body) || walk(global.document.head);
};
global.document = {
  /* فقط #dustBg و #spDust واقعی‌اند؛ بقیه مثل هارنس همیشه‌موجود شمرده می‌شوند */
  querySelector: sel => {
    const s = String(sel);
    if(s === '#dustBg' || s === '#spDust') return findByDomId(s.slice(1));
    return getFake(s);
  },
  querySelectorAll: () => [], getElementById: id => findByDomId(id), createElement: tag => mkEl(tag),
  addEventListener(t){ listeners.document[t] = (listeners.document[t] || 0) + 1; },
  removeEventListener(t){ listeners.document[t] = Math.max(0, (listeners.document[t] || 1) - 1); },
  activeElement: null, hidden: false, readyState: 'complete', title: '', cookie: '',
  body: mkEl('body', 'body'), head: mkEl('head', 'head'), documentElement: mkEl('html', 'html'),
  fonts: { ready: Promise.resolve() }, createTextNode: t => ({ textContent: t }), execCommand(){ return true; },
  get visibilityState(){ return 'visible'; }
};
global.window = {
  addEventListener(t){ listeners.window[t] = (listeners.window[t] || 0) + 1; },
  removeEventListener(t){ listeners.window[t] = Math.max(0, (listeners.window[t] || 1) - 1); },
  matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
  innerWidth: 360, innerHeight: 640, devicePixelRatio: 1, scrollTo(){}, scrollY: 0,
  crypto: require('crypto').webcrypto, isSecureContext: false
};
/* در نودِ ۲۲ `navigator` فقط خواندنی است، پس با defineProperty می‌نشانیمش. */
Object.defineProperty(global, 'navigator', {
  value: { vibrate(){ return true; }, onLine: false, userAgent: 'stub', language: 'fa' },
  configurable: true, writable: true
});
global.localStorage = { _d: {}, getItem(k){ return this._d[k] ?? null; }, setItem(k, v){ this._d[k] = String(v); },
  removeItem(k){ delete this._d[k]; }, get length(){ return Object.keys(this._d).length; }, key(i){ return Object.keys(this._d)[i]; } };
global.location = { hash: '', replace(){}, href: 'http://localhost/', protocol: 'http:', search: '', host: 'localhost', pathname: '/' };
global.history = { state: null, length: 1, pushState(s){ this.state = s; }, replaceState(s){ this.state = s; }, back(){}, go(){} };
global.URL.createObjectURL = () => 'blob:x'; global.URL.revokeObjectURL = () => {};
global.Blob = class {}; global.FileReader = class {};
global.Audio = class { constructor(){ this.paused = true; this.volume = 1; } addEventListener(){} removeEventListener(){} play(){ return Promise.resolve(); } pause(){} load(){} remove(){} };
global.Image = class { constructor(){ this.width = 10; } addEventListener(){} removeEventListener(){} };
global.fetch = () => Promise.reject(Error('offline'));
global.WebSocket = class { constructor(){ this.readyState = 0; } addEventListener(){} removeEventListener(){} send(){} close(){} };
/* همان داستانِ navigator: crypto هم در نودِ ۲۲ فقط خواندنی است. */
try{ global.crypto = require('crypto').webcrypto; }
catch(e){ Object.defineProperty(global, 'crypto', { value: require('crypto').webcrypto, configurable: true, writable: true }); }
global.Notification = undefined; global.BroadcastChannel = undefined;
const lateErrs = [];
process.on('uncaughtException', e => lateErrs.push(e));

/* ── بار کردنِ همان چیزی که مرورگر بار می‌کند ── */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)]
  .map(m => m[1]).filter(s => !/^https?:/i.test(s));
const src = scripts.map(s => fs.readFileSync(path.join(ROOT, s), 'utf8')).join('\n;\n');

const counts = () => ({
  interval: liveIntervals.size, timeout: liveTimeouts.size, rafPushed, rafPending,
  win: Object.values(listeners.window).reduce((a, b) => a + b, 0),
  doc: Object.values(listeners.document).reduce((a, b) => a + b, 0)
});
const line = (tag, c) =>
  console.log(`  ${tag.padEnd(34)} interval=${String(c.interval).padStart(3)} timeout=${String(c.timeout).padStart(3)}` +
              ` rAF=${String(c.rafPushed).padStart(6)} (درصَف=${String(c.rafPending).padStart(3)}) شنونده: window=${c.win} document=${c.doc}`);
const liveCanvases = () => (global.FX._canvases || []).map(c => `${c.cv && c.cv.id}:${c.live ? 'زنده' : 'مرده'}`);

let FX, Router, Timers, Theme, Splash;
try{
  eval(src + '\n; global.FX = FX; global.Router = Router; global.Timers = Timers; global.Theme = Theme; global.init = init; global.Splash = Splash;');
}catch(e){ console.log('eval خطا:', e.message); process.exit(1); }
FX = global.FX; Router = global.Router; Timers = global.Timers; Theme = global.Theme; Splash = global.Splash;

try{ global.init(); }catch(e){ console.log('init خطا:', e.message); }
global.__drainRaf(200);
console.log('\n── ۱) پس از init ──');
line('init', counts());

const base = counts();
const tabs = ['quran', 'read', 'play', 'online', 'room', 'me', 'notif', 'home'];
let transitions = 0;
for(let round = 0; round < 12; round++){
  for(const t of tabs){
    try{ Router.go(t); }catch(e){}
    global.__drainRaf(60);
    transitions++;
  }
}
console.log(`\n── ۲) پس از ${transitions} گذارِ صفحه (≈ گشتنِ ۶۰ ثانیه‌ای بین تب‌ها) ──`);
line('پس از گشتن', counts());
console.log(`  Timers.page زنده=${Timers.page.size} · Timers.sys زنده=${Timers.sys.size} · خطای بی‌گیر=${lateErrs.length}`);

console.log('\n── ۳) بوم‌ها ──');
/* بومِ پرده را کنار می‌گذاریم تا اندازه‌گیریِ غبار با آن قاطی نشود. */
try{ FX.stopCanvas(document.querySelector('#spDust')); }catch(e){}
global.__drainRaf(120);
const idle = rafPushed;
global.__drainRaf(120);
console.log(`  خط پایه (بی هیچ بومی):     ${rafPushed - idle} فریم در ۱۲۰ فریم → باید ۰ باشد`);
console.log('  پیش از دست‌زدن:            ' + (liveCanvases().join(', ') || '(خالی)'));
FX.dust(true);
const rafBeforeOn = rafPushed;
global.__drainRaf(120);
console.log(`  پس از dust(true):          ${liveCanvases().join(', ')} · ${rafPushed - rafBeforeOn} فریم در ۱۲۰ فریم → باید ~۱۲۰ باشد`);
FX.dust(true);
FX.dust(false);
const rafBeforeIdle = rafPushed;
global.__drainRaf(120);
const rafDelta = rafPushed - rafBeforeIdle;
console.log('  پس از dust(false):         ' + (liveCanvases().join(', ') || '(خالی)'));
console.log(`  فریم‌های تازه در ۱۲۰ فریمِ بعدی: ${rafDelta} → ${rafDelta > 60 ? 'حلقه زنده است (نشت)' : 'حلقه مرده است (درست)'}`);
/* یک بار دیگر همان کار، تا ببینیم فهرست رشد می‌کند یا نه */
const beforeCycles = (FX._canvases || []).length;
for(let i = 0; i < 5; i++){ FX.dust(true); global.__drainRaf(10); FX.dust(false); global.__drainRaf(10); }
console.log(`  پنج بار روشن/خاموش:        ردیف‌های جامانده در _canvases = ${(FX._canvases || []).length - beforeCycles}`);

console.log('\n── ۴) پرده در برابر غبارِ کاربر ──');
Theme.ambient(true);                 // کاربر غبار را روشن می‌کند
global.__drainRaf(20);
console.log('  پس از روشن‌کردنِ غبار:      ' + liveCanvases().join(', '));
try{ Splash.hide(true); }catch(e){ console.log('  Splash.hide خطا: ' + e.message); }
/* همان کاری که Splash.hide پس از ۱۴۰۰ms می‌کند */
try{ FX.stopCanvas(document.querySelector('#spDust')); Theme.paintAmbient(); }catch(e){ console.log('  بازگردانیِ غبار خطا: ' + e.message); }
global.__drainRaf(40);
console.log('  پس از کنار رفتنِ پرده:      ' + liveCanvases().join(', '));
const afterSplash = global.__drainRaf(120);
console.log(`  فریم‌های تازه پس از پرده:   ${afterSplash} در ۱۲۰ فریم → ${afterSplash > 60 ? 'زنده (درست)' : 'کشته (نادرست)'}`);
console.log(`\nخطای بی‌گیرِ پایانی: ${lateErrs.length}`);
process.exit(0);
