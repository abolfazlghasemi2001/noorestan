'use strict';
/* ═══════════════════════════════════════════════════════════════════
   آزمونِ سرویس‌ورکر در vm — با فروشگاهِ مجزا برای هر کش.

   چرا آشیانهٔ تازه؟ آشیانهٔ موجود (`loadSW` در `_tests.js`) برای هر نامِ
   کشی یک `Map` واحد برمی‌گرداند؛ در آن، «چیزی در SHELL نشسته ولی از CACHE
   خوانده می‌شود» هرگز دیده نمی‌شود — یعنی دقیقاً همان B1. این‌جا هر نامِ
   کش فروشگاهِ خودش را دارد و ترتیبِ جست‌وجوی `caches.match` هم مثلِ
   مرورگر، ترتیبِ ساخت است.

   شبکه هم ساختگی است: یک نقشهٔ «مسیر → متن فایلِ روی دیسک» که با
   `net.offline = true` قطع می‌شود. پس آفلاینِ واقعی، نه ادعایش.

   اجرای مستقل:  node tests/sw.test.js
   ─────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://noorestan.test';
const SW_SRC = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let passed = 0, failed = 0;
const FAILS = [];
function ok(name, cond, note) {
  if(cond) passed++;
  else { failed++; FAILS.push(name + (note ? '\n      ↳ ' + note : '')); }
}
function section(t){ process.stdout.write('\n── ' + t + '\n'); }

/* ─────────────────────────  ابزارِ فایل‌ها  ───────────────────────── */
function fileFor(pathname){
  let rel = pathname.replace(/^\/+/, '');
  if(rel === '' ) rel = 'index.html';
  else if(rel.endsWith('/')) rel += 'index.html';
  const abs = path.join(ROOT, rel);
  if(!abs.startsWith(ROOT + path.sep) && abs !== ROOT) return null;
  try { return fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : null; }
  catch (e) { return null; }
}

/* ─────────────────────────  اجزای ساختگی  ───────────────────────── */
class Head {
  constructor(init){ this.m = new Map(); if(init) for(const k of Object.keys(init)) this.m.set(k.toLowerCase(), String(init[k])); }
  get(k){ return this.m.has(String(k).toLowerCase()) ? this.m.get(String(k).toLowerCase()) : null; }
  set(k, v){ this.m.set(String(k).toLowerCase(), String(v)); }
  raw(){ const o = {}; for(const [k, v] of this.m) o[k] = v; return o; }
}

function makeEnv(opts = {}){
  const net = {
    offline: false,
    /* مسیر → بدنه؛ null یعنی «پاسخِ خطا» */
    map: new Map(),
    /* مسیرهایی که باید نصب را بشکنند (شبیه‌سازی ۴۰۴ برای فایلِ هسته) */
    broken: new Set(opts.broken || []),
    fetches: []
  };
  class Resp {
    constructor(body, init = {}){
      this._b = body == null ? '' : String(body);
      this.status = init.status === undefined ? 200 : init.status;
      this.headers = new Head(init.headers);
      this.type = init.type || (this.status === 0 ? 'error' : 'basic');
      this.ok = this.status >= 200 && this.status < 300;
      this._used = false;
    }
    clone(){
      if(this._used) throw new TypeError('body already used');
      return new Resp(this._b, { status: this.status, headers: this.headers.raw(), type: this.type });
    }
    async text(){ this._used = true; return this._b; }
    async json(){ this._used = true; return JSON.parse(this._b); }
    static error(){ return new Resp('', { status: 0, type: 'error' }); }
  }
  class Req {
    constructor(input, init = {}){
      const src = typeof input === 'string' ? { url: input } : input;
      this.url = new URL(src.url, ORIGIN + '/sw.js').href;
      this.method = init.method || src.method || 'GET';
      this.mode = init.mode || src.mode || 'cors';
      this.destination = init.destination !== undefined ? init.destination : (src.destination || '');
      this.cache = init.cache || src.cache || '';
      this.headers = new Head(init.headers || (src.headers && src.headers.raw ? src.headers.raw() : null));
    }
  }
  const strip = k => k.replace(/[?#].*$/, '');
  const keyOf = (u, ignoreSearch) => { const x = new URL(u, ORIGIN + '/sw.js'); return ignoreSearch ? x.origin + x.pathname : x.href; };

  const stores = new Map();       /* نام → Map(کلید → {body,status,headers,type}) */
  const order = [];               /* ترتیبِ ساخت، برای caches.match */
  function store(name){
    if(!stores.has(name)){ stores.set(name, new Map()); order.push(name); }
    return stores.get(name);
  }
  class Cache {
    constructor(name){ this.name = name; }
    get _m(){ return store(this.name); }
    _pick(e, want, ignoreSearch){
      for(const [k, v] of e){
        const kk = ignoreSearch ? strip(k) : k;
        if(kk === want) return new Resp(v.body, { status: v.status, headers: v.headers, type: v.type });
      }
      return undefined;
    }
    async match(reqOrUrl, o = {}){
      const want = keyOf(urlOf(reqOrUrl), !!o.ignoreSearch);
      return this._pick(this._m, want, !!o.ignoreSearch) || null;
    }
    async put(reqOrUrl, res){
      if(!(res instanceof Resp)) throw new TypeError('put: not a response');
      if(res.status !== 200) throw new TypeError('Caches.put() received a response with status ' + res.status);
      if(res._used) throw new TypeError('Caches.put() body already used');
      this._m.set(keyOf(urlOf(reqOrUrl), false), { body: res._b, status: res.status, headers: res.headers.raw(), type: res.type });
    }
    async add(reqOrUrl){
      const r = new Req(reqOrUrl, { cache: 'reload' });
      const res = await fetchImpl(r);
      if(!res.ok) throw new TypeError('Cache.add() received a response with status ' + res.status);
      return this.put(r, res);
    }
    async addAll(list){ for(const it of list) await this.add(it); }
    async delete(reqOrUrl){ return this._m.delete(keyOf(urlOf(reqOrUrl), false)); }
    async keys(){ return [...this._m.keys()]; }
  }
  const urlOf = x => (typeof x === 'string' ? x : x.url);
  const opened = new Map();
  const caches = {
    async open(name){ if(!opened.has(name)) opened.set(name, new Cache(name)); store(name); return opened.get(name); },
    async match(reqOrUrl, o = {}){
      const want = keyOf(urlOf(reqOrUrl), !!(o && o.ignoreSearch));
      for(const n of order){ const hit = stores.get(n) && Cache.prototype._pick.call({ _m: stores.get(n) }, want, !!(o && o.ignoreSearch)); if(hit) return hit; }
      return undefined;
    },
    async keys(){ return [...stores.keys()]; },
    async delete(name){ const had = stores.delete(name); const i = order.indexOf(name); if(i >= 0) order.splice(i, 1); opened.delete(name); return had; }
  };

  async function fetchImpl(input){
    const req = input instanceof Req ? input : new Req(input);
    net.fetches.push(req.url);
    if(net.offline) throw new TypeError('Failed to fetch (offline)');
    const u = new URL(req.url);
    if(u.origin !== ORIGIN){
      const ext = (opts.external || new Map()).get(u.href);
      if(ext === undefined) throw new TypeError('external refused: ' + u.href);
      return new Resp(ext.body, { headers: ext.headers, type: ext.type || 'basic' });
    }
    if(net.broken.has(u.pathname)) throw new TypeError('simulated failure: ' + u.pathname);
    let body = net.map.has(u.pathname) ? net.map.get(u.pathname) : fileFor(u.pathname);
    if(body === null || body === undefined) return new Resp('not found', { status: 404 });
    return new Resp(body, { headers: { 'content-type': ct(u.pathname) } });
  }

  const listeners = {};
  const ctl = { skipWaiting: 0, claims: 0, notifications: [], windows: [], preloadDisabled: 0 };
  const self = {
    addEventListener(type, fn){ (listeners[type] = listeners[type] || []).push(fn); },
    skipWaiting: async () => { ctl.skipWaiting++; },
    clients: {
      async matchAll(){ return []; },
      async claim(){ ctl.claims++; },
      async openWindow(url){ ctl.windows.push(url); return null; }
    },
    registration: {
      navigationPreload: { async disable(){ ctl.preloadDisabled++; } },
      async showNotification(title, o){ ctl.notifications.push({ title, o }); }
    }
  };

  const sandbox = {
    self, caches, Request: Req, Response: Resp, URL, console,
    fetch: (i) => fetchImpl(i),
    location: { origin: ORIGIN, href: ORIGIN + '/', protocol: 'https:' },
    setTimeout, clearTimeout, Promise, JSON, Math, TextEncoder, TextDecoder
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SW_SRC, sandbox, { filename: 'sw.js' });

  const ev = (props = {}) => {
    const e = Object.assign({ _pend: [], _errors: [], _respond: null, waitUntilCalls: 0 }, props);
    e.waitUntil = p => { e.waitUntilCalls++; e._pend.push(Promise.resolve(p).catch(err => { e._errors.push(err); })); };
    e.respondWith = p => { e._respond = p; };
    e.flush = async () => {
      for(let i = 0; i < 12; i++){
        const batch = e._pend.splice(0);
        if(!batch.length && !i) { await new Promise(r => setImmediate(r)); continue; }
        await Promise.all(batch.map(p => p.then(() => {}, () => {})));
        await new Promise(r => setImmediate(r));
        if(!e._pend.length) break;
      }
    };
    return e;
  };
  async function dispatch(type, e){
    for(const fn of (listeners[type] || [])){ const r = fn(e); if(r) e._pend.push(Promise.resolve(r).catch(err => e._errors.push(err))); }
    await e.flush();
    return e;
  }
  return { net, caches, ctl, ev, dispatch, sandbox, Resp, Req,
    eval: src => vm.runInContext(src, sandbox),
    entries: name => [...(stores.get(name) || new Map()).keys()],
    has: (name, p) => { const k = new URL(p, ORIGIN + '/sw.js').href; const m = stores.get(name); return !!m && (m.has(k) || m.has(k.replace(/[?#].*$/, '')) || [...m.keys()].some(x => x.replace(/[?#].*$/, '') === k.replace(/[?#].*$/, ''))); },
    reset(){ stores.clear(); order.length = 0; opened.clear(); }
  };
}
const ct = p => /\.css$/.test(p) ? 'text/css' : /\.js$/.test(p) ? 'text/javascript' : /\.html$/.test(p) ? 'text/html' :
  /\.json$/.test(p) ? 'application/json' : /\.svg$/.test(p) ? 'image/svg+xml' : 'application/octet-stream';

/* ─────────────────────────  سنجه‌ها  ───────────────────────── */
async function main(){
  const env0 = makeEnv();
  const PRECACHE = env0.eval('PRECACHE'), OPTIONAL = env0.eval('OPTIONAL'), GAME_FILES = env0.eval('GAME_FILES');
  const MAX_TEXT = env0.eval('MAX_TEXT');
  const CACHE = env0.eval('CACHE'), SHELL = env0.eval('SHELL');
  const MAX_SHELL = (() => { try { return env0.eval('MAX_SHELL'); } catch (e) { return undefined; } })();

  /* ۱) B1 — پیش‌ذخیره باید از همان کشی سرو شود که در آن نشسته است */
  section('B1 — پیش‌ذخیرهٔ /assets/ از همان‌جا سرو می‌شود (آفلاین)');
  {
    const env = makeEnv();
    const ins = env.ev(); await env.dispatch('install', ins);
    ok('install بدون خطا', ins._errors.length === 0, ins._errors[0] && String(ins._errors[0]));
    const asset = PRECACHE.find(p => /\/assets\/app\/style-.*\.css$/.test(p)) || PRECACHE.find(p => /\/assets\//.test(p));
    env.net.offline = true;
    const e = env.ev({ request: new env.Req(asset.replace(/^\.\//, '/')) });
    await env.dispatch('fetch', e);
    let res = null, err = null;
    try { res = e._respond ? await e._respond : null; } catch (ex) { err = ex; }
    const body = res && res.status === 200 ? await res.text() : '';
    ok('B1 درخواستِ آفلاینِ ' + asset + ' با ۲۰۰ از کش برمی‌گردد',
      !!res && res.status === 200 && body.length > 100,
      res ? 'وضعیت ' + res.status : ('پاسخ داده نشد: ' + (err || 'بدون respondWith')));
  }

  /* ۲) B2 — نبودِ یک فایلِ هسته باید نصب را بشکند */
  section('B2 — شکستِ فایلِ هسته، نصب را می‌شکند و skipWaiting نمی‌کند');
  {
    const core = '/assets/app/' + (fs.readdirSync(path.join(ROOT, 'assets/app')).find(f => /^app-1-.*\.js$/.test(f)) || 'app-1-x.js');
    const env = makeEnv({ broken: [core] });
    const e = env.ev();
    await env.dispatch('install', e);
    ok('B2 نصب با فایلِ هستۀ شکسته خطا می‌دهد', e._errors.length > 0, 'بدون خطا نصب شد');
    ok('B2 در شکست، skipWaiting صدا زده نمی‌شود', env.ctl.skipWaiting === 0, 'skipWaiting=' + env.ctl.skipWaiting);
  }
  {
    const env = makeEnv({ broken: ['/assets/images/promo/night.svg'] });   /* OPTIONAL — مجاز */
    const e = env.ev(); await env.dispatch('install', e);
    ok('B2 شکستِ فایلِ اختیاری نصب را نمی‌شکند', e._errors.length === 0 && env.ctl.skipWaiting === 1,
      e._errors[0] && String(e._errors[0]));
  }

  /* ۳) B16 — تازه‌سازی در waitUntil، بی آلودگیِ SHELL، با trim */
  section('B16 — تازه‌سازیِ پس‌زمینه در waitUntil / SHELL فقط پوسته');
  {
    const env = makeEnv();
    const ins = env.ev(); await env.dispatch('install', ins);
    const asset = PRECACHE.find(p => /\/assets\//.test(p));
    env.net.map.set(asset.replace(/^\.\//, '/'), '/* نسخهٔ تازهٔ برگهٔ سبک */');
    const e = env.ev({ request: new env.Req(asset.replace(/^\.\//, '/')) });
    await env.dispatch('fetch', e);
    if(e._respond) { try { await e._respond; } catch (x) {} }
    await e.flush();
    ok('B16 شاخهٔ دارایی‌ها یک کارِ پس‌زمینه به waitUntil می‌سپارد', e.waitUntilCalls > 0,
      'waitUntilCalls=' + e.waitUntilCalls + ' — تازه‌سازی بی waitUntil با کُشتنِ SW نیمه‌کاره می‌ماند');

    /* /health نباید در SHELL بشیند */
    const env2 = makeEnv();
    const ins2 = env2.ev(); await env2.dispatch('install', ins2);
    env2.net.map.set('/health', JSON.stringify({ ok: true, uptime: 12 }));
    const h = env2.ev({ request: new env2.Req('/health') });
    await env2.dispatch('fetch', h);
    if(h._respond) { try { await h._respond; } catch (x) {} }
    await h.flush();
    ok('B16 پاسخِ /health در SHELL کش نمی‌شود', !env2.has(SHELL, '/health'), 'در SHELL پیدا شد');
    /* SHELL باید سقف داشته باشد */
    const env3 = makeEnv();
    const ins3 = env3.ev(); await env3.dispatch('install', ins3);
    const before = env3.entries(SHELL).length;
    for(let i = 0; i < 140; i++){
      const p = '/shell-flood-' + i + '.html';
      env3.net.map.set(p, '<!doctype html><title>' + i + '</title>');
      const e3 = env3.ev({ request: new env3.Req(p) });
      await env3.dispatch('fetch', e3);
      if(e3._respond) { try { await e3._respond; } catch (x) {} }
    }
    const after = env3.entries(SHELL).length;
    ok('B16 پاشیدن ۱۴۰ مسیرِ غیرپوسته، SHELL را بی‌سقف بزرگ نمی‌کند',
      after <= (MAX_SHELL || 60), 'SHELL از ' + before + ' به ' + after + ' رسید (MAX_SHELL=' + (MAX_SHELL ?? 'ندارد') + ')');
  }

  /* ۴) B21 — پیامِ clear، سقفِ کش متن، نشانیِ پوش */
  section('B21 — clear فقط کشِ داده / MAX_TEXT با ترجمه‌ها / نشانیِ پوش');
  {
    const env = makeEnv();
    const ins = env.ev(); await env.dispatch('install', ins);
    /* چند فایلِ داده در کش‌های دیگر بگذار */
    const m = env.ev();
    await env.dispatch('message', Object.assign(m, { data: { t: 'clear' }, source: null }));
    ok('B21 «پاک کردن حافظه» پوسته را نمی‌سوزاند (SHELL دست‌نخورده)',
      env.entries(SHELL).length > 0, 'SHELL خالی شد — آفلاین می‌میرد');
    ok('B21 کشِ دارایی‌ها (CACHE) هم با clear پاک نمی‌شود',
      env.entries(CACHE).length > 0, 'CACHE خالی شد');
  }
  {
    const bundle = fs.readFileSync(path.join(ROOT, 'assets/app/' + fs.readdirSync(path.join(ROOT, 'assets/app')).find(f => /^app-1-.*\.js$/.test(f))), 'utf8');
    const tr = (bundle.match(/const TRANSLATIONS = \[[\s\S]*?\];/) || [''])[0];
    const nTr = (tr.match(/id: *'fa\./g) || []).length;
    const raw = (bundle.match(/const QURAN_RAW = '([^']*)'/) || ['', ''])[1];
    const nSurah = raw ? raw.split(',').length : 0;
    ok('B21 MAX_text پوششِ همهٔ ' + nSurah + ' سوره × ' + nTr + ' ترجمه را دارد',
      MAX_TEXT >= nSurah * nTr, 'MAX_TEXT=' + MAX_TEXT + ' در برابر ' + nSurah + '×' + nTr + '=' + (nSurah * nTr));
  }
  {
    const env = makeEnv();
    const e = env.ev({ data: { json: () => ({ title: 'ت', body: 'ب', url: 'https://evil.test/x' }) } });
    await env.dispatch('push', e);
    const n = env.ctl.notifications[0];
    const u = n && n.o && n.o.data && n.o.data.url;
    ok('B21 نشانیِ بی‌خاستگاه در اعلان رد می‌شود', typeof u === 'string' && u.startsWith('/') && !u.includes('evil.test'),
      'url=' + u);
  }
  ok('B21 فایلِ README در پیش‌ذخیرهٔ OPTIONAL نیست', !OPTIONAL.some(p => /README/.test(p)),
    OPTIONAL.filter(p => /README/.test(p)).join(','));

  /* ۵) نگهبان‌هایِ بازنگشتی — چیزهایی که رفع نباید بشکند */
  section('نگهبان — رفتاری که رفعِ B1..B21 نباید تغییر دهد');
  {
    const env = makeEnv();
    const ins = env.ev(); await env.dispatch('install', ins);
    env.net.offline = true;
    const e = env.ev({ request: new env.Req('/anything-not-cached.html', { mode: 'navigate' }) });
    await env.dispatch('fetch', e);
    const res = await e._respond;
    ok('ناوبریِ آفلاین به صفحهٔ آفلاین می‌افتد', res && res.status === 200 && /html/i.test(res.headers.get('content-type') || ''),
      res ? 'وضعیت ' + res.status : 'بی‌پاسخ');
  }
  {
    const env = makeEnv();
    const ins = env.ev(); await env.dispatch('install', ins);
    const e = env.ev({ request: new env.Req('/api/leaderboard') });
    await env.dispatch('fetch', e);
    ok('مسیر /api/* به سرویس‌ورکر پاسخ نمی‌دهد (عبورِ مستقیم)', e._respond === null, 'respondWith صدا زده شد');
    const e2 = env.ev({ request: new env.Req('/assets/audio/x.mp3', { destination: 'audio', mode: 'no-cors' }) });
    await env.dispatch('fetch', e2);
    ok('قاعدهٔ isMedia دست‌نخورده: صوت بی respondWith می‌ماند', e2._respond === null, 'respondWith صدا زده شد');
    const act = env.ev(); await env.dispatch('activate', act);
    ok('activate کش‌های ناشناخته را می‌بَرد و claim می‌کند',
      act._errors.length === 0 && env.ctl.claims === 1 && env.ctl.preloadDisabled === 1);
  }

  console.log('\nRESULT sw: ' + passed + ' passed, ' + failed + ' failed');
  if(failed){ console.log(FAILS.map((f, i) => '  ✗ ' + (i + 1) + '. ' + f).join('\n')); process.exitCode = 1; }
}

main().catch(e => { console.error('crash:', e && e.stack || e); process.exit(2); });
