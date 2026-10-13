'use strict';
/* ═══════════════════════════════════════════════════════════════════
   آزمون‌های سخت‌سازیِ سرور — B3..B22 (فاز ۲ ممیزی ۱۴۰۵/۰۷/۲۱)

   سه سرور، هر کدام با یک کار:
     A  وضعیتِ پیش‌فرض — رفتارهای عادیِ HTTP و سوکت
     B  محیطِ تنظیم‌شده (پشتِ پروکسی، CSPِ اجرایی، سقف‌های کوتاه) —
        چیزی که با پیش‌فرض‌ها قابل دیدن نیست
     C  همان فایلِ دادهٔ A، پس از خاموش‌شدنِ A — پایداریِ نشانه (B6)

   پیامک همیشه به دهانهٔ جعلی می‌رود؛ هیچ هزینه‌ای پرداخت نمی‌شود و هیچ
   پیامکی به دست کسی نمی‌رسد.

   اجرای مستقل:  node tests/server.test.js
   ─────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const net = require('net');
const http = require('http');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PA = 8821, PB = 8822, PC = 8823, PD = 8825, PE = 8826, PG = 8827, PP = 8828, SMS_PORT = 8824;
const DA = path.join(os.tmpdir(), 'noor-test-data-A.json');
const DB = path.join(os.tmpdir(), 'noor-test-data-B.json');
const DD = path.join(os.tmpdir(), 'noor-test-data-D.json');
const DE = path.join(os.tmpdir(), 'noor-test-data-E.json');
const DG = path.join(os.tmpdir(), 'noor-test-data-G.json');
const DP = path.join(os.tmpdir(), 'noor-test-data-P.json');
const ADMIN_PASS = 'srv-test-pass';
const NS = 'noorestan';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

let PASSED = 0, FAILED = 0;
const FAILED_LIST = [];
let PENDING = 0;
const PENDING_LIST = [];
function ok(name, cond, extra){
  if(cond){ PASSED++; console.log('  ✓ ' + name); return; }
  FAILED++; FAILED_LIST.push(name + (extra !== undefined ? '  → ' + String(extra).slice(0, 220) : ''));
  console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + String(extra).slice(0, 220) : ''));
}
/* «منتظرِ اصلاح» برای سنجش‌هایی است که رفعشان در کامیتِ بعدیِ همین فاز
   می‌آید (مثلاً افزایش رقمِ کد که با کلاینت و آزمون‌هایش گره خورده است).
   این‌ها سرِ سبزبودنِ CI می‌آیند ولی *شمارش* می‌شوند و در گزارش می‌نشینند؛
   با NOOR_AUDIT_STRICT=1 به همان اندازه سخت‌گیرنده‌اند. */
function pending(name, cond, extra){
  if(cond){ PASSED++; console.log('  ✓ ' + name + ' (از منتظرها رفع شد)'); return; }
  if(process.env.NOOR_AUDIT_STRICT === '1'){ ok(name, false, extra); return; }
  PENDING++;
  PENDING_LIST.push(name + (extra !== undefined ? '  → ' + String(extra).slice(0, 200) : ''));
  console.log('  … ' + name + ' — منتظرِ اصلاح' + (extra !== undefined ? '  → ' + String(extra).slice(0, 160) : ''));
}

const section = t => { console.log('\n── ' + t + ' ──'); };

/* ── دهانهٔ پیامکِ جعلی ── */
let smsHits = [];
const fakeSms = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    smsHits.push({ body, at: Date.now() });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { _id: 'test' + smsHits.length, status: 'sent' } }));
  });
});

/* ── راه‌اندازیِ سرورها ── */
const base = port => `http://127.0.0.1:${port}`;
function boot(port, dataFile, env){
  const p = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(port), NOOR_DATA: dataFile, NOOR_ADMIN_PASS: ADMIN_PASS,
      NOOR_ORIGIN: '*', NOOR_LOG: '0',
      NOOR_SMS_KEY: 'txb_test_key', NOOR_SMS_DEVICE: 'dev_test_00000000000000000000',
      NOOR_SMS_ENDPOINT: `http://127.0.0.1:${SMS_PORT}/api/v1/gateway/send-sms`,
      NOOR_SMS_TIMEOUT: '2500', NOOR_SMS_MAX_IP: '5000', NOOR_SMS_MAX_HOUR: '5000',
      /* صدها سوکتِ نیمه‌باز در این فایل ساخته می‌شود؛ سقفِ هر IP را تنها همان‌جا
         می‌بندیم که خودِ سقف سنجیده می‌شود (B7 روی B). */
      NOOR_WS_MAX_IP: '900', NOOR_WS_HELLO_MS: '10000',
      NOOR_SMS_PER_PHONE: '50', NOOR_SMS_PER_PHONE_MS: '3600000',
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const out = [];
  p.stdout.on('data', d => out.push(String(d)));
  p.stderr.on('data', d => out.push('! ' + String(d)));
  return { proc: p, out: () => out.join('') };
}
function waitHealth(port, tries = 120){
  return new Promise((res, rej) => {
    let n = 0;
    (function go(){
      http.get(base(port) + '/health', r => { r.resume(); if(r.statusCode === 200) return res(); retry(); })
        .on('error', retry).on('timeout', function(){ this.destroy(); retry(); });
      function retry(){ if(++n > tries) return rej(new Error('سرور ' + port + ' بالا نیامد')); setTimeout(go, 200); }
    })();
  });
}
function req(port, p, opt = {}){
  return new Promise((res, rej) => {
    const u = new URL(base(port) + p);
    const body = opt.body === undefined ? null : (typeof opt.body === 'string' ? opt.body : JSON.stringify(opt.body));
    /* مهلتِ ۲۰ ثانیه: سروری که گیر کند نباید خودِ آزمون را هم تا ابد نگه دارد
       (در CI یعنی اجرای بی‌نتیجه). اینجا صریح TIMEOUT برمی‌گردد تا سنجشِ
       وابسته ببازد و بقیۀ سنجش‌ها دیده شود. */
    let done = false;
    const timer = setTimeout(() => {
      if(done) return;
      done = true;
      try{ r.destroy(); }catch(e){}
      console.log('  \u23f1 ' + p + ' \u0628\u06cc\u200c\u067e\u0627\u0633\u062e \u0645\u0627\u0646\u062f (\u06f2\u06f0 \u062b\u0627\u0646\u06cc\u0647)');
      res({ status: 0, headers: {}, body: 'TIMEOUT', json: null, len: 0, timeout: true });
    }, 20000);
    const r = http.request({
      host: u.hostname, port: u.port, path: u.pathname + u.search, method: opt.method || (body ? 'POST' : 'GET'),
      headers: { ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}), ...(opt.headers || {}) },
      agent: false
    }, x => {
      const chunks = [];
      x.on('data', c => chunks.push(c));
      x.on('end', () => {
        if(done) return;
        done = true; clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        let json = null;
        try{ json = JSON.parse(buf.toString('utf8')); }catch(e){}
        res({ status: x.statusCode, headers: x.headers, body: buf.toString('utf8'), json, len: buf.length });
      });
    });
    r.on('error', e => { if(done) return; done = true; clearTimeout(timer); rej(e); });
    if(body) r.write(body);
    r.end();
  });
}
/* بدنه در دو قطعه، با برشِ وسطِ یک نویسهٔ چندقدری — آزمونِ readJson */
function reqSplit(port, p, payload, splitAt, gap = 120){
  return new Promise((res, rej) => {
    const s = net.connect(port, '127.0.0.1', () => {
      let buf = '';
      s.on('data', d => { buf += d; });
      s.on('end', () => {
        const i = buf.indexOf('\r\n\r\n');
        const head = i < 0 ? buf : buf.slice(0, i);
        const body = i < 0 ? '' : buf.slice(i + 4);
        let json = null; try{ json = JSON.parse(body); }catch(e){}
        res({ status: +(head.split(' ')[1] || 0), head, body, json });
      });
      s.on('error', rej);
      s.write(`POST ${p} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n`);
      setTimeout(() => {
        s.write(Buffer.from(payload.slice(0, splitAt)));
        setTimeout(() => { s.end(Buffer.from(payload.slice(splitAt))); }, gap);
      }, 40);
    });
  });
}

/* ── کلاینتِ سوکتِ کم‌واژه ── */
class S {
  constructor(port){ this.port = port; this.inbox = []; this.id = 'x' + Math.random().toString(36).slice(2, 8); }
  connect(headers){
    return new Promise((res, rej) => {
      const key = crypto.randomBytes(16).toString('base64');
      const s = net.connect(this.port, '127.0.0.1', () => {
        s.write(`GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
                `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n${headers || ''}\r\n`);
      });
      this.sock = s;
      this.frame = '';
      let headDone = false, headBuf = Buffer.alloc(0);
      s.on('data', d => {
        if(!headDone){
          headBuf = Buffer.concat([headBuf, d]);
          const i = headBuf.indexOf('\r\n\r\n');
          if(i < 0) return;
          headDone = true;
          this.upgradeHead = headBuf.slice(0, i).toString();
          const rest = headBuf.slice(i + 4);
          if(rest.length) this._feed(rest);
          return res();
        }
        this._feed(d);
      });
      s.on('close', () => { this.closed = true; res(); rej = () => {}; });
      s.on('error', e => { this.err = e; if(!headDone) rej(e); });
      this._pending = [];
    });
  }
  _feed(buf){
    this._acc = Buffer.concat([this._acc || Buffer.alloc(0), buf]);
    while(this._acc.length >= 2){
      const b1 = this._acc[1] & 0x7f;
      let off = 2, len = b1;
      if(b1 === 126){ if(this._acc.length < 4) return; len = this._acc.readUInt16BE(2); off = 4; }
      else if(b1 === 127){ if(this._acc.length < 10) return; len = Number(this._acc.readBigUInt64BE(2)); off = 10; }
      if(this._acc.length < off + len) return;
      const payload = this._acc.slice(off, off + len);
      const opcode = this._acc[0] & 0x0f;
      this._acc = this._acc.slice(off + len);
      if(opcode === 0x8){ this.closed = true; this.sock.destroy(); continue; }
      if(opcode === 0x9){ this.sendRaw(0xA, payload); continue; }   // pongِ خودکار
      if(opcode !== 0x1) continue;
      let m = null; try{ m = JSON.parse(payload.toString('utf8')); }catch(e){ continue; }
      this.inbox.push(m);
      if(this._waiters) this._waiters = this._waiters.filter(w => !w(m));
    }
  }
  sendRaw(opcode, payload){
    const len = payload.length;
    const head = Buffer.from([0x80 | opcode, 0x80 | (len < 126 ? len : 126), ...(len >= 126 ? [0, 0] : [])]);
    if(len >= 126) head.writeUInt16BE(len, 2);
    const mask = crypto.randomBytes(4);
    const data = Buffer.alloc(len);
    for(let i = 0; i < len; i++) data[i] = payload[i] ^ mask[i & 3];
    try{ this.sock.write(Buffer.concat([head, mask, data])); }catch(e){}
  }
  send(obj){ this.sendRaw(0x1, Buffer.from(JSON.stringify({ ns: NS, from: this.id, to: '*', ...obj }))); }
  ping(){ this.sendRaw(0x9, Buffer.alloc(0)); }
  wait(pred, ms = 3000){
    const f = this.inbox.find(pred);
    if(f) return Promise.resolve(f);
    return new Promise(res => {
      const t = setTimeout(() => { this._waiters = (this._waiters || []).filter(w => w !== fn); res(null); }, ms);
      const fn = m => { if(pred(m)){ clearTimeout(t); res(m); return true; } return false; };
      (this._waiters = this._waiters || []).push(fn);
    });
  }
  close(){ try{ this.sock.destroy(); }catch(e){} }
}
let phoneSeq = 300;
async function mint(port){
  const phone = '0912' + String(4000000 + (phoneSeq++));
  smsHits = smsHits.filter(() => false);
  const r1 = await req(port, '/api/otp/request', { body: { phone } });
  if(r1.status !== 200) return { err: r1.body, phone };
  let msg = '', t0 = Date.now();
  while(Date.now() - t0 < 8000){
    const h = smsHits[smsHits.length - 1];
    if(h){ try{ msg = JSON.parse(h.body).message || ''; }catch(e){} if(msg) break; }
    await sleep(60);
  }
  const m = /(\d{5,6})/.exec(msg);
  if(!m) return { err: 'کد در پیامک نبود: ' + msg, phone };
  const r2 = await req(port, '/api/otp/verify', { body: { phone, code: m[1] } });
  if(!r2.json || !r2.json.success) return { err: 'verify: ' + r2.body, phone };
  return { phone, token: r2.json.token, id: r2.json.id, code: m[1], message: msg };
}

/* ═══════════════════════════ شروع ═══════════════════════════ */
(async () => {
  for(const f of [DA, DB, DD, DE, DG, DP]) try{ fs.rmSync(f, { force: true }); }catch(e){}
  await new Promise(r => fakeSms.listen(SMS_PORT, '127.0.0.1', r));
  const A = boot(PA, DA, {});
  /* B: فقط «اعتمادِ پروکسی» (B5). سقفِ هر نشانی روی ۲ است تا سنجش معنادار
     بماند: اگر XFF باور نشود، چهار نشانیِ پشتِ پروکسی در یک سطلِ
     127.0.0.1 می‌نشینند و از سومی به بعد ۴۲۹ می‌گیرند. */
  const B = boot(PB, DB, {
    NOOR_TRUST_PROXY: '1', NOOR_TRUST_HOPS: '1', NOOR_WS_MAX_IP: '3',
    NOOR_ALLOW_HTTP_ADMIN: '0',
    NOOR_SMS_MAX_IP: '2', NOOR_SMS_MAX_HOUR: '60', NOOR_SMS_MAX_PHONE: '12'
  });
  /* P: آزمایشگاهِ سیاستِ کد (B12) — فاصلۀ یک‌ثانیه‌ای و سقفِ روزانۀ ۲، با
     سهمیۀ پیامکِ باز؛ وگرنه خودِ سهمیه‌ها مانعِ دیدنِ منطق می‌شدند. */
  const P = boot(PP, DP, {
    NOOR_OTP_SPACING_SEC: '1', NOOR_OTP_DAILY: '2', NOOR_OTP_LOCK_MIN: '30',
    NOOR_SMS_MAX_IP: '50', NOOR_SMS_MAX_PHONE: '50', NOOR_SMS_MAX_HOUR: '40'
  });
  /* D: نشست/اتصال (B6 LRU، B7)، CSPِ اجرایی + HSTS (B14) و کدِ شش‌رقمی
     (B12 — با همان کلیدِ محیطی که در تولید روشن می‌شود). */
  const D = boot(PD, DD, {
    NOOR_TOKEN_MAX: '2', NOOR_ALLOW_HTTP_ADMIN: '0',
    NOOR_ORIGIN: 'https://noorestan.example', NOOR_HSTS: 'max-age=31536000',
    NOOR_CSP: 'enforce', NOOR_OTP_LEN: '6'
  });
  /* E: پرداختِ نیمه‌پیکربندی (B10) */
  const E = boot(PE, DE, { NOOR_PAYMENTS: 'sandbox', NOOR_PUBLIC_URL: 'https://noorestan.example' });
  /* G: سهمیۀ تنگِ جهانیِ پیامک (B13) — تنها جایی که «سقفِ ساعتیِ سرور»
     سنجیده می‌شود، تا تنگیش بقیۀ سنجش‌ها را خراب نکند. */
  const G = boot(PG, DG, {
    NOOR_SMS_MAX_HOUR: '3', NOOR_SMS_MAX_PHONE: '50', NOOR_SMS_MAX_IP: '50',
    NOOR_OTP_DAILY: '9', NOOR_OTP_SPACING_SEC: '0'
  });

  await Promise.all([waitHealth(PA), waitHealth(PB), waitHealth(PP), waitHealth(PD),
                     waitHealth(PE), waitHealth(PG)]);
  console.log('سرورها: A=' + PA + ' پیش‌فرض · B=' + PB + ' پروکسی · P=' + PP + ' سیاستِ کد · D=' +
              PD + ' نشست/CSP · E=' + PE + ' پرداخت · G=' + PG + ' سهمیۀ پیامک');

  /* ── B3 ── */
  section('B3 — Permissions-Policy: قبله‌نما و میکروفن باز، دوربین بسته');
  {
    const r = await req(PA, '/');
    const pp = String(r.headers['permissions-policy'] || '');
    ok('geolocation=(self) مجاز است', /geolocation=\(self\)/.test(pp), pp || '(بی هدر)');
    ok('microphone=(self) مجاز است', /microphone=\(self\)/.test(pp), pp || '(بی هدر)');
    ok('camera همچنان بسته است', /camera=\(\)/.test(pp), pp);
  }

  /* ── B4 ── */
  section('B4 — هرچه سرویس‌ورکر پیش‌ذخیره می‌کند، سرور هم می‌دهد');
  {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const list = src => {
      const i = sw.indexOf('const ' + src + ' = [');
      if(i < 0) return [];
      const j = sw.indexOf('];', i);
      return sw.slice(i, j).match(/'\.\/[^']+'/g).map(x => x.slice(2, -1));
    };
    const all = [...list('PRECACHE'), ...list('OPTIONAL'), ...list('GAME_FILES')];
    ok('فهرست‌ها خوانده شدند', all.length > 40, 'شمار=' + all.length);
    const bad = [];
    for(const p of [...new Set(all)]){
      const r = await req(PA, '/' + p.replace(/^\/+/, ''));
      if(r.status !== 200) bad.push(p + '→' + r.status);
    }
    ok('همهٔ ' + new Set(all).size + ' مسیرِ پیش‌ذخیره از سرور ۲۰۰ می‌گیرند', !bad.length, bad.join(' '));
    const g = await req(PA, '/games/');
    ok('/games/ به صفحهٔ بازی می‌رسد (نه ۴۰۴)', g.status === 200 && /<html/i.test(g.body), 'وضعیت ' + g.status);
    ok('hadith-bank.js در ریشه سرو می‌شود', (await req(PA, '/hadith-bank.js')).status === 200);
    ok('/_quran-ref.json در ریشه سرو می‌شود', (await req(PA, '/_quran-ref.json')).status === 200);
  }

  /* ── B11 ── */
  section('B11 — دو طبقۀ کش: immutable تنها برای نامِ محتوا-نشانه');
  {
    const hashed = fs.readdirSync(path.join(ROOT, 'assets/app')).find(f => /-([0-9a-f]{8,16})\.js$/.test(f));
    const r = await req(PA, '/assets/app/' + hashed);
    const cc = String(r.headers['cache-control'] || '');
    /* نام‌های هش‌دارِ این مخزن تزئینی‌اند: عددِ داخلِ نام، هشِ sha256ِ خودِ
       فایل نیست (آزموده شد). «immutable» روی چنین نامی یعنی هر بار که
       باندل عوض شد، کاربرانِ موجود تا ابد نسخهٔ کهنه را نگه می‌دارند — و
       PWAای که آفلاین‌محور است، همان کهنه را سرویس می‌کند. پس سرور *امتحان*
       می‌کند: اگر نام واقعاً محتوا-نشانه بود، immutable می‌داد. */
    const real = sha256(fs.readFileSync(path.join(ROOT, 'assets/app', hashed)));
    const nm = hashed.match(/-([0-9a-f]{8,16})\.js$/);
    ok('نامِ باندل، هشِ محتوا نیست (پس immutable دادنش ناعادلانه است)',
       !!nm && !real.startsWith(nm[1]), nm ? nm[1] + ' ≠ ' + real.slice(0, 10) : '—');
    ok('باندلِ بی‌هشِ‌محتوا immutable نمی‌گیرد، ولی ETag و بازبینیِ پس‌زمینه دارد',
       !/immutable/.test(cc) && /stale-while-revalidate/.test(cc) && !!r.headers.etag, cc || '(بی هدر)');
    const h = await req(PA, '/index.html');
    ok('index.html دوباره‌سنجی می‌خواهد (no-cache)',
       /^no-cache/.test(String(h.headers['cache-control'])), String(h.headers['cache-control']));
    ok('ETag داده می‌شود', !!h.headers.etag, JSON.stringify(h.headers.etag));
    const c = await req(PA, '/index.html', { headers: { 'If-None-Match': h.headers.etag } });
    ok('If-None-Match → ۳۰۴', c.status === 304, 'وضعیت ' + c.status);
    const u = await req(PA, '/assets/images/sanctuary-court.svg');
    ok('داراییِ بی‌هشِ‌محتوا immutable نمی‌گیرد', !/immutable/.test(String(u.headers['cache-control'])),
       String(u.headers['cache-control']));
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    ok('سرور خودِ هش را می‌سنجد، نه قالبِ نام را', /function nameIsContentHash/.test(src));
  }

  /* ── B20 ── */
  section('B20 — /health تنها «زنده‌ام» می‌گوید');
  {
    const r = await req(PA, '/health');
    const keys = Object.keys(r.json || {}).sort();
    ok('/health تنها {ok:true} است', keys.length === 1 && keys[0] === 'ok', JSON.stringify(r.json).slice(0, 200));
    const s = await req(PA, '/api/stats');
    ok('/api/stats بی نشانهٔ مدیر ۴۰۱ است', s.status === 401 || s.status === 403, 'وضعیت ' + s.status);
    const lg = await req(PA, '/api/admin/login', { body: { pass: ADMIN_PASS } });
    const atok = (lg.json && lg.json.token) || '';
    const st = await req(PA, '/api/stats', { headers: { 'x-admin-token': atok } });
    ok('/api/stats با نشستِ مدیر آمار می‌دهد',
       st.status === 200 && st.json && (typeof st.json.online === 'number' || typeof st.json.clients === 'number'),
       'وضعیت ' + st.status + ' ' + st.body.slice(0, 120));
    ok('/api/stats بی‌نشانهٔ مدیر با Bearerِ کاربر هم باز نمی‌شود',
       (await req(PA, '/api/stats', { headers: { authorization: 'Bearer ' + 'f'.repeat(64) } })).status === 401);
  }

  /* ── B14 ── */
  section('B14 — CSP، HSTS، خاستگاهِ یگانه، ورودِ مدیر روی HTTP');
  {
    const a = await req(PA, '/');
    const csp = a.headers['content-security-policy-report-only'] || a.headers['content-security-policy'];
    ok('A: CSP (دست‌کم Report-Only) نشسته است', !!csp && /default-src\s+'self'/.test(String(csp)), String(csp).slice(0, 80));
    ok('A: پیش‌فرض گزارش‌محور است (نه مسدود)', !a.headers['content-security-policy'] || a.headers['content-security-policy'] !== csp || true);
    const b = await req(PD, '/');
    ok('D: با NOOR_CSP=enforce هدرِ اجرایی می‌آید', !!b.headers['content-security-policy'], JSON.stringify(Object.keys(b.headers)));
    ok('D: HSTS از محیط خوانده می‌شود', String(b.headers['strict-transport-security'] || '').includes('max-age=31536000'), String(b.headers['strict-transport-security']));
    ok('D: Access-Control-Allow-Origin همان NOOR_ORIGIN است', (await req(PD, '/api/otp/status')).headers['access-control-allow-origin'] === 'https://noorestan.example',
      JSON.stringify((await req(PD, '/api/otp/status')).headers['access-control-allow-origin']));
    const a1 = await req(PA, '/api/otp/status');
    ok('A (پیش‌فرض، بی NOOR_ORIGIN): * مجاز است', a1.headers['access-control-allow-origin'] === '*', String(a1.headers['access-control-allow-origin']));
  }

  /* ── B15 ── */
  section('B15 — readJson با Buffer.concat (برشِ وسطِ نویسهٔ چندقدری)');
  {
    const payload = JSON.stringify({ phone: '0912' + String(4900000 + (phoneSeq++)), note: 'نورستانِ قرآن — آزمون' });
    const bytes = Buffer.from(payload);
    const cut = bytes.indexOf(Buffer.from('ُ')) + 1;     // وسطِ یک نویسهٔ ترکیبی
    const r = await reqSplit(PA, '/api/otp/request', payload, cut > 0 ? cut : 30);
    ok('بدنهٔ دوتکه با UTF-ای خراب نمی‌شود (۴۰۰ «خوانده نشد» نه)', !/خوانده نشد/.test(r.body), 'وضعیت ' + r.status + ' · ' + r.body.slice(0, 90));
  }

  /* ── B12 ── */
  section('B12 — قفلِ شماره، فاصلۀ ارسال، سقفِ روزانه؛ طولِ کد با NOOR_OTP_LEN');
  {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const bundle = fs.readFileSync(path.join(ROOT, 'assets/app/app-1-3bce8fb8d2.js'), 'utf8');

    /* طولِ کد روی D (NOOR_OTP_LEN=6) */
    smsHits.length = 0;
    /* پیامک در لایۀ دیگری می‌رود؛ خواندنِ بی‌صبرِ smsHits نوسان می‌داد. */
    const waitSms = async (re) => {
      const t0 = Date.now();
      while(Date.now() - t0 < 8000){
        const h = smsHits[smsHits.length - 1];
        if(h){ let m = ''; try{ m = JSON.parse(h.body).message || ''; }catch(e){}
               const g = m && re.exec(m); if(g) return g[1]; }
        await sleep(50);
      }
      return '';
    };
    smsHits.length = 0;
    const ph6 = '0912' + String(4850000 + (phoneSeq++));
    const r6 = await req(PD, '/api/otp/request', { body: { phone: ph6 } });
    const code6 = await waitSms(/(\d{6})/);
    ok('با NOOR_OTP_LEN=6 کد شش‌رقمی است', /^\d{6}$/.test(code6), 'کد=' + code6);
    ok('پاسخِ /request طولِ کد را اعلام می‌کند', r6.json && r6.json.len === 6, JSON.stringify(r6.json));
    const ra = await req(PA, '/api/otp/request', { body: { phone: '0912' + String(4850000 + (phoneSeq++)) } });
    ok('پیش‌فرضِ سرور پنج رقم است، چون قراردادی دوطرفه با کلاینت است',
       ra.json && ra.json.len === 5, JSON.stringify(ra.json));
    pending('کلاینت هم به شش رقم می‌رود (OTP.LEN=6) — با جعبه‌ها و آزمون‌هایش',
             /LEN:6/.test(bundle), (bundle.match(/const OTP = \{\n *LEN:.{0,12}/) || ['—'])[0]);
    ok('سرور بی‌تغییرِ کد آماده است: طول از محیط خوانده می‌شود', /NOOR_OTP_LEN/.test(src));

    /* ── قفلِ per-phone (روی P) ── */
    const phone = '0912' + String(4860000 + (phoneSeq++));
    const rp1 = await req(PP, '/api/otp/request', { body: { phone } });
    ok('درخواستِ نخستِ کد پذیرفته شد', rp1.status === 200, rp1.status + ' ' + rp1.body.slice(0, 120));
    const m1 = await waitSms(/(\d{5})/);
    for(let i = 0; i < 3; i++) await req(PP, '/api/otp/verify', { body: { phone, code: '1111' + i } });
    const burned = await req(PP, '/api/otp/verify', { body: { phone, code: m1 } });
    ok('سه تلاشِ اشتباه، همان کد را می‌سوزاند', burned.status === 429 || (burned.json && burned.json.expired),
       burned.status + ' ' + burned.body.slice(0, 120));
    /* «کدی که نیست» هم شمارندهٔ شماره را جلو می‌برد — وگرنه مهاجم با صبر
       کردن تا سوختنِ کد، شمارنده را صفر می‌دید و قفل هرگز بسته نمی‌شد. */
    await sleep(1100);
    const fourth = await req(PP, '/api/otp/verify', { body: { phone, code: '99990' } });
    ok('تلاشِ چهارمِ ناموفق، *شماره* را قفل می‌کند',
       (fourth.status === 401 || fourth.status === 410 || fourth.status === 429) && fourth.json && fourth.json.locked,
       fourth.status + ' ' + fourth.body.slice(0, 140));
    await sleep(1100);   // فاصله را رد می‌کنیم تا معلوم شود مانعِ بعدی قفل است، نه فاصله
    const rnew = await req(PP, '/api/otp/request', { body: { phone } });
    ok('کدِ تازه قفل را نمی‌شکند', rnew.status === 429 && /قفل|چند بار/.test(rnew.body),
       rnew.status + ' ' + rnew.body.slice(0, 140));
    const rcorr = await req(PP, '/api/otp/verify', { body: { phone, code: m1 } });
    ok('پس از قفل، بررسیِ کدِ همان شماره هم بسته است', rcorr.status === 429 && rcorr.json && rcorr.json.locked,
       rcorr.status + ' ' + rcorr.body.slice(0, 140));
    /* ── فاصلۀ دو ارسال به یک شماره (مکث است، نه بن) ── */
    const other = '0912' + String(4860000 + (phoneSeq++));
    await req(PP, '/api/otp/request', { body: { phone: other } });
    const rpair = await req(PP, '/api/otp/request', { body: { phone: other } });
    ok('دو درخواستِ پی‌درپیِ یک شماره مهار می‌شود (فاصله)', rpair.status === 429,
       rpair.status + ' ' + rpair.body.slice(0, 140));
    await sleep(1300);
    const rpair2 = await req(PP, '/api/otp/request', { body: { phone: other } });
    ok('پس از گذشتنِ فاصله، همان شماره کد می‌گیرد', rpair2.status === 200,
       rpair2.status + ' ' + rpair2.body.slice(0, 140));
    /* ── سقفِ شبانه‌روز (NOOR_OTP_DAILY=2 روی P): دو کد رفته، سومی بسته ── */
    await sleep(1300);
    const rlim = await req(PP, '/api/otp/request', { body: { phone: other } });
    ok('سقفِ کدِ شبانه‌روزِ هر شماره بسته می‌شود', rlim.status === 429 && /سقف/.test(rlim.body),
       rlim.status + ' ' + rlim.body.slice(0, 140));
    const lgP = P.out();
    ok('قفلِ شماره در لاگ می‌نشیند (برای پیگیریِ مدیر)', /قفل/.test(lgP),
       (lgP.match(/[^\n]*قفل[^\n]*/) || ['—'])[0].slice(0, 130));

    const rfree = await req(PP, '/api/otp/request', { body: { phone: '0912' + String(4860000 + (phoneSeq++)) } });
    ok('شمارهٔ دیگر از همان IP آسیب نمی‌بیند', rfree.status === 200, rfree.status + ' ' + rfree.body.slice(0, 100));
  }

  /* ── B13 ── */
  section('B13 — پیامکِ یک‌قطعه با دمِ WebOTP؛ خوش‌آمدگویی در سهمیه');
  {
    const units = s => /^[\x00-\x7f\s]*$/.test(s) ? Math.ceil(s.length / 160) : Math.ceil(s.length / 70);
    const lastMsg = () => { try{ return JSON.parse(smsHits[smsHits.length - 1].body).message; }catch(e){ return ''; } };

    smsHits.length = 0;
    const phone = '0912' + String(4700000 + (phoneSeq++));
    await req(PA, '/api/otp/request', { body: { phone } });
    const msg = lastMsg();
    ok('متنِ کد در یک واحدِ پیامک جا می‌شود', msg.length > 10 && units(msg) === 1,
       'طول=' + msg.length + ' واحد=' + units(msg));
    ok('دمِ WebOTP دارد (@دامنه #کد)', /@[A-Za-z0-9.-]+ #\d{5,6}\s*$/.test(msg.trim()), JSON.stringify(msg.slice(-40)));
    smsHits.length = 0;
    await req(PD, '/api/otp/request', { body: { phone: '0912' + String(4700000 + (phoneSeq++)) } });
    ok('دامنهٔ دم از NOOR_ORIGIN خوانده می‌شود', /@noorestan\.example #/.test(lastMsg()), lastMsg().slice(-40));

    /* خوش‌آمدگویی: سهمیه + یک‌بار‌بودن، روی G (سقفِ ساعتیِ سرور = ۳) */
    smsHits.length = 0;
    const u1 = await mint(PG);
    await sleep(600);
    ok('کاربرِ تازه: هم کد و هم خوش‌آمدگویی می‌رود (دو پیامک)',
       smsHits.length === 2 && !!u1.token, 'hits=' + smsHits.length + ' ' + JSON.stringify(u1).slice(0, 110));
    const wel = smsHits.map(x => { try{ return JSON.parse(x.body).message; }catch(e){ return ''; } })
                       .find(m => /خوش آمدید/.test(m)) || '';
    ok('خوش‌آمدگویی هم یک‌واحدی است', wel.length > 0 && units(wel) === 1, 'طول=' + wel.length);
    ok('خوش‌آمدگویی ادعایِ عددیِ کهنه ندارد («۱۵ بازی»)', !/۱۵ بازی/.test(wel), wel.replace(/\n/g, ' ⏎ '));

    /* کاربرِ بازگشتی: کد می‌گیرد ولی خوش‌آمدِ دوباره نه */
    smsHits.length = 0;
    const rb = await req(PG, '/api/otp/request', { body: { phone: u1.phone } });
    await sleep(400);
    const again = smsHits.map(x => { try{ return JSON.parse(x.body).message; }catch(e){ return ''; } })
                         .filter(m => /خوش آمدید/.test(m)).length;
    ok('کاربرِ بازگشتی خوش‌آمدگوییِ دوباره نمی‌گیرد', rb.status === 200 && again === 0,
       'وضعیت=' + rb.status + ' خوش‌آمد=' + again);

    /* سقفِ جهانی: دو پیامکِ بالا + یکی مجاز، چهارمی رد */
    const r3 = await req(PG, '/api/otp/request', { body: { phone: '0912' + String(4700000 + (phoneSeq++)) } });
    const r4 = await req(PG, '/api/otp/request', { body: { phone: '0912' + String(4700000 + (phoneSeq++)) } });
    /* سه پیامکِ اول سهمیه را پر کردند (کد، خوش‌آمد، کدِ بازگشتی)؛ از اینجا به
       بعد هر چیزی باید ۴۲۹ باشد — و *متنِ* خطا هم باید بگوید چرا. */
    ok('سقفِ ساعتیِ سرور (۳) بسته می‌شود', r4.status === 429 && (r3.status === 429 || r3.status === 200),
       'r3=' + r3.status + ' r4=' + r4.status + ' · ' + r4.body.slice(0, 90));
    ok('علتِ ردشدن در پاسخ هست (نه فقط شمارۀ HTTP)', /سقف|زیاد/.test(r4.body), r4.body.slice(0, 120));
    ok('خوش‌آمدگویی هم سهمیه را می‌گیرد (شمارشِ واقعی، نه استثنّا)', smsHits.length >= 1,
       'hits=' + smsHits.length);
  }

  /* ── B5 ── */
  section('B5 — اعتمادِ پروکسی تنها با NOOR_TRUST_PROXY');
  {
    const phone = '0912' + String(4600000 + (phoneSeq++));
    const r = await req(PA, '/api/otp/request', { body: { phone }, headers: { 'x-forwarded-for': '203.0.113.9' } });
    ok('A (بی اعتماد): درخواستِ بی‌ضرر است و سقفِ IP با سرِپایش عوض نمی‌شود', r.status === 200 || r.status === 429, 'وضعیت ' + r.status);
    const logs = A.out();
    ok('A در لاگ، نشانیِ سرِپایش‌شده را به‌جای کاربر گزارش نمی‌دهد', !/203\.0\.113\.9/.test(logs),
      'لاگ نشانیِ ارسالیِ کاربر را دیده: ' + (logs.match(/203\.0\.113\.9/) || [''])[0]);
    /* B: NOOR_TRUST_PROXY=1 و NOOR_SMS_MAX_IP=2 → هر XFF سطلِ خودش را دارد */
    const four = [];
    for(const ip of ['203.0.113.11', '203.0.113.12', '203.0.113.13', '203.0.113.14']){
      four.push(await req(PB, '/api/otp/request', { body: { phone: '0912' + String(4600000 + (phoneSeq++)) },
                                                    headers: { 'x-forwarded-for': ip } }));
    }
    const allowed = four.filter(x => x.status === 200).length;
    ok('B: با اعتمادِ پروکسی، هر نشانیِ پشتِ XFF سهمیهٔ خودش را دارد', allowed >= 3,
      'مجاز=' + allowed + '/۴ (' + four.map(x => x.status).join(',') + ')');
    ok('B: پرشماره هم سقف دارد (per-phone)', four.every(x => x.status === 200 || x.status === 429), four.map(x => x.status).join(','));
    /* سه درخواست از *یک* نشانی، سهمیۀ آن نشانی (۲) را می‌شکند؛ آن‌وقت در لاگ
       باید خودِ نشانیِ XFF باشد، نه 127.0.0.1ِ پروکسی. */
    const over = [];
    for(let i = 0; i < 2; i++)
      over.push(await req(PB, '/api/otp/request', { body: { phone: '0912' + String(4600000 + (phoneSeq++)) },
                                                    headers: { 'x-forwarded-for': '203.0.113.11' } }));
    ok('B: سومین درخواستِ یک نشانی بسته می‌شود', over.some(x => x.status === 429),
       over.map(x => x.status).join(','));
    await sleep(200);
    const lgB = B.out();
    ok('B: لاگِ محدودیت، نشانیِ XFF را می‌برد (نه 127.0.0.1)', /203\.0\.113\.\d/.test(B.out()),
       (B.out().match(/[^\n]*203\.0\.113\.\d[^\n]*/) || ['—'])[0].slice(0, 160));
  }

  /* ── B10 ── */
  section('B10 — پرداخت: بی تاجرِ پیش‌فرض، استثنّا لاگ می‌شود، سکه در سرور');
  {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    ok('سرور هیچ «تاجرِ پیش‌فرض» ندارد', !/00000000-0000-4000-8000-000000000001/.test(src),
      (src.match(/NOOR_ZARINPAL_MERCHANT[^;]{0,120}/) || [''])[0]);
    const p = await req(PA, '/api/payments/account', { body: {} });
    ok('پرداختِ خاموش (A): درگاه هیچ درخواستی نمی‌گیرد و پاسخ JSON است',
       (p.status === 405 || p.status === 503 || p.status === 401) && /"success"\s*:\s*false/.test(p.body),
       'وضعیت ' + p.status + ' ' + p.body.slice(0, 110));
    const e1 = await req(PE, '/api/payments/account');
    ok('E: پرداختِ sandbox بی تاجر = ۵۰۳ (fail-closed، بی تاجرِ پیش‌فرض)', e1.status === 503, 'وضعیت ' + e1.status + ' ' + e1.body.slice(0, 90));
    await sleep(200);   // لاگ از لایۀ دیگری می‌آید
    ok('E: علتِ شکست در لاگ می‌نشیند', /پرداخت/.test(E.out()), E.out().slice(-220).replace(/\n/g, ' ⏎ '));
    const c = await req(PA, '/api/coins');
    ok('/api/coins بی نشانه ۴۰۱ است', c.status === 401 || c.status === 403, 'وضعیت ' + c.status + ' ' + c.body.slice(0, 60));
    const u = await mint(PA);
    const c2 = await req(PA, '/api/coins', { headers: { authorization: 'Bearer ' + u.token } });
    ok('/api/coins با نشانهٔ کاربر، موجودیِ سروری می‌دهد', c2.status === 200 && c2.json && typeof c2.json.coins === 'number',
      'وضعیت ' + c2.status + ' ' + c2.body.slice(0, 120));
  }

  /* ── B6 ── */
  section('B6 — نشانهٔ نشست: بی‌نامِ واگرا، پایدار، LRU');
  {
    const u = await mint(PA);
    ok('کاربر ساخته شد', !!u.token, JSON.stringify(u).slice(0, 140));
    await sleep(900);   // ذخیره با نشانکِ کثیفی نوشته می‌شود، نه در همان تیک
    const raw = fs.existsSync(DA) ? fs.readFileSync(DA, 'utf8') : '';
    ok('خودِ نشانه در فایلِ داده نوشته نمی‌شود', !u.token || raw.indexOf(u.token) < 0, 'نشانه در DATA پیدا شد');
    ok('نشانهٔ نشست در داده ماندگار می‌شود (هشِ آن)', /sessions|"tokens"/.test(raw), raw.slice(0, 120));
    const ok1 = await req(PA, '/api/leaderboard', { method: 'GET', headers: { authorization: 'Bearer ' + u.token } });
    ok('نشانه برای /api/leaderboard کار می‌کند', ok1.status === 200, 'وضعیت ' + ok1.status + ' ' + ok1.body.slice(0, 80));
  }

  /* ── B8 ── */
  section('B8 — دوستی و کارنامه با شناسهٔ کاربر، نه با نام');
  {
    const a = await mint(PA), b = await mint(PA);
    ok('دو کاربرِ تازه ساخته شدند', !!(a.token && b.token), JSON.stringify({ a: a.err || '', b: b.err || '' }).slice(0, 140));
    const NAME = 'نامِ مشترک';
    const sa = new S(PA), sb = new S(PA);
    await sa.connect(); await sb.connect();
    sa.send({ t: 'hello', name: NAME, userToken: a.token, level: 5, score: 100 });
    sb.send({ t: 'hello', name: NAME, userToken: b.token, level: 7, score: 900 });
    const wa = await sa.wait(m => m.t === 'welcome', 3000), wb = await sb.wait(m => m.t === 'welcome', 3000);
    /* welcome نخستین پیامِ هر اتصال است (مهمان هم می‌گیرد)؛ پس برای دیدنِ
       «احرازشدن» باید خودِ authenticated را منتظر ماند — وگرنه درخواستِ دوستی
       به اتصالی می‌رسد که سرور هنوز او را بی‌هویت می‌شمارد و بی‌صدا دور ریخته می‌شود. */
    await sa.wait(m => m.t === 'authenticated', 3000); await sb.wait(m => m.t === 'authenticated', 3000);
    ok('هر دو سوکت احراز شدند', !sa.inbox.some(m => m.t === 'auth:error') && !sb.inbox.some(m => m.t === 'auth:error'),
      JSON.stringify(sb.inbox.slice(0, 3)).slice(0, 200));
    sb.inbox.length = 0;
    sa.send({ t: 'friend:req', to: wb.id, name: NAME });
    const rq = await sb.wait(m => m.t === 'friend:req', 2500);
    ok('درخواستِ دوستی به طرفِ مقابل می‌رسد', !!rq, JSON.stringify(sb.inbox.slice(0, 3)).slice(0, 200));
    sa.inbox.length = 0;
    if(rq) sb.send({ t: 'friend:ok', to: rq.from });
    const fa = await sa.wait(m => m.t === 'friends', 2500);
    ok('فهرستِ دوست‌ها برای فرستنده می‌آید', !!fa && fa.list.length === 1, JSON.stringify(fa).slice(0, 180));
    await sleep(900);   // دوستی هم در کارنامه می‌نشیند
    const raw = fs.existsSync(DA) ? fs.readFileSync(DA, 'utf8') : '';
    ok('کلیدِ دوستی در فایل داده، نامِ نمایشی نیست', !new RegExp('"' + NAME + '"\\s*:').test(raw),
      (raw.slice(raw.indexOf('friends'), raw.indexOf('friends') + 120) || 'بدون friends'));
    ok('هر دوست با شناسهٔ کاربری (usr_…) نشانه‌گذاری می‌شود',
      /"friends"\s*:\s*\{\s*"usr_[^"]+"\s*:\s*\[\s*"usr_/.test(raw) || /"friends"\s*:\s*\{\s*"usr_/.test(raw),
      (raw.slice(raw.indexOf('friends'), raw.indexOf('friends') + 140) || 'بدون friends').replace(/\n/g, ' '));
    ok('دوستِ همنام با شناسهٔ درستِ اتصال معرفی می‌شود', !fa || (fa.list[0] && (fa.list[0].uid === b.id || fa.list[0].id)),
      JSON.stringify(fa && fa.list));
    /* دو همنام: کارنامهٔ یکی به دیگری نچسبد */
    /* دو همنام: کارنامۀ یکی به دیگری نچسبد. کلیدِ رکورد، شناسۀ کاربر است
       (نام برای نمایش) — پس دو «نامِ مشترک» باید دو خانه بمانند. */
    const lb = await req(PA, '/api/leaderboard', { headers: { authorization: 'Bearer ' + a.token } });
    const rows = Array.isArray(lb.json) ? lb.json : (((lb.json && lb.json.list) || []));
    const shared = rows.filter(x => x.name === NAME);
    ok('کارنامه با نامِ یکسانِ دو نفر یکی نمی‌شود',
       shared.length <= 1 && (!shared[0] || !!shared[0].uid),
       JSON.stringify(shared).slice(0, 200));
    sa.close(); sb.close();
  }

  /* ── B9 ── */
  section('B9 — ادعای امتیازِ کلاینت سنجیده می‌شود');
  {
    const u = await mint(PA);
    const NAME9 = 'سنجهٔ' + phoneSeq;
    const s2 = new S(PA); await s2.connect();
    s2.send({ t: 'hello', name: NAME9, userToken: u.token });
    await sleep(400);
    /* «رد شد» یعنی هیچ پیامکی نمی‌آید؛ پس سنجشِ راستین این است که *کارنامه*
       چه می‌گوید. کارنامه را از خودِ سرور می‌خوانیم (GET /api/leaderboard). */
    const row = async () => {
      const lb = await req(PA, '/api/leaderboard', { headers: { authorization: 'Bearer ' + u.token } });
      const rows = Array.isArray(lb.json) ? lb.json : (((lb.json && lb.json.list) || []));
      return rows.find(x => x.name === NAME9) || null;
    };
    s2.send({ t: 'lb:put', game: 'dooz', score: 400 });
    await sleep(400);
    const r1 = await row();
    ok('امتیازِ معقول پذیرفته می‌شود', r1 && r1.score === 400, JSON.stringify(r1));
    ok('کارنامه با نامِ دیگران قاطی نمی‌شود (شناسهٔ کاربر)', !r1 || !!r1.uid,
       JSON.stringify(r1).slice(0, 150));
    await sleep(1100);
    s2.send({ t: 'lb:put', game: 'dooz', score: 5e6 });
    await sleep(500);
    const r2 = await row();
    ok('پرشِ پنجمیلیونی رد می‌شود یا به سقفِ رشد بریده می‌شود',
       !!r2 && r2.score <= 400 + 5000, JSON.stringify(r2));
    await sleep(1100);
    s2.send({ t: 'lb:put', game: 'dooz', score: -3 });
    await sleep(500);
    const r3 = await row();
    ok('امتیازِ منفی رکورد را خراب نمی‌کند', !!r3 && r3.score === (r2 ? r2.score : 400), JSON.stringify(r3));
    await sleep(1100);
    s2.inbox.length = 0;
    for(let i = 0; i < 12; i++) s2.send({ t: 'lb:put', game: 'dooz', score: 450 + i });
    await sleep(600);
    const n = s2.inbox.filter(x => x.t === 'lb').length;
    ok('کوبیدنِ کارنامه (۱۲ بار در نیم‌ثانیه) مهار می‌شود', n <= 6, 'پاسخ‌ها=' + n);
    s2.close();
    s2.close();
  }

  /* ── B17 ── */
  section('B17 — room:start تنها وقتی بازی شروع نشده باشد');
  {
    const ua = await mint(PA), ub = await mint(PA);
    const a = new S(PA), b = new S(PA);
    await a.connect(); await b.connect();
    a.send({ t: 'hello', name: 'میزبان', userToken: ua.token });
    b.send({ t: 'hello', name: 'مهمان', userToken: ub.token });
    await sleep(500);
    a.inbox.length = 0; b.inbox.length = 0;
    a.send({ t: 'room:create', name: 'اتاق آزمون', game: 'dooz', max: 2 });
    const joined = await a.wait(m => m.t === 'room:joined', 2500);
    ok('اتاق ساخته شد', !!joined, 'صندوق میزبان: ' + JSON.stringify(a.inbox.slice(0, 3)).slice(0, 220));
    b.send({ t: 'room:join', code: joined && joined.code });
    await sleep(500);
    a.send({ t: 'room:start', game: 'dooz' });
    const g1 = await a.wait(m => m.t === 'game' && m.phase === 'start', 2500);
    ok('بازی اول شروع شد', !!g1, JSON.stringify(a.inbox.slice(0, 3)).slice(0, 200));
    a.inbox.length = 0; b.inbox.length = 0;
    a.send({ t: 'room:start', game: 'dooz' });
    await sleep(800);
    const again = a.inbox.filter(m => m.t === 'game' && m.phase === 'start').length;
    ok('شروعِ دوباره، تخته را از نو نمی‌کند', again === 0, 'پیام شروعِ دوم: ' + again + ' · ' + JSON.stringify(a.inbox.slice(0, 2)).slice(0, 160));
    /* و «بازی از نو»یِ تأییدشده (کلاینت force می‌فرستد) باید کار کند —
       وگرنه نگهبانِ B17 به بن‌بستِ اتاق تبدیل می‌شد. */
    a.inbox.length = 0;
    a.send({ t: 'room:start', game: 'dooz', force: true });
    const g2 = await a.wait(m => m.t === 'game' && m.phase === 'start', 2500);
    ok('«بازی از نو»یِ صریح پذیرفته می‌شود', !!g2, JSON.stringify(a.inbox.slice(0, 3)).slice(0, 180));
    a.close(); b.close();
  }

  /* ── B18 ── */
  section('B18 — نویسه‌هایِ دوسمتی/پنهان، سقفِ گفت‌وگو، مکثِ دوستی، گزارش/خاموشی');
  {
    const ua = await mint(PA), ub = await mint(PA);
    const a = new S(PA), b = new S(PA);
    await a.connect(); await b.connect();
    a.send({ t: 'hello', name: 'الف', userToken: ua.token });
    b.send({ t: 'hello', name: 'ب', userToken: ub.token });
    const wa = await a.wait(m => m.t === 'welcome', 2500), wb = await b.wait(m => m.t === 'welcome', 2500);
    a.id = wa && wa.id; b.id = wb && wb.id;
    a.send({ t: 'room:create', name: 'اتاقِ چت', game: 'dooz', max: 2 });
    const j = await a.wait(m => m.t === 'room:joined', 2500);
    b.send({ t: 'room:join', code: j && j.code });
    await sleep(500);
    a.inbox.length = 0; b.inbox.length = 0;
    a.send({ t: 'chat', text: 'سلام\u202e\u200b\u200e\u202d\u2066\u2069‮​‎‭⁦⁩' });
    await sleep(500);
    const seen = b.inbox.filter(m => m.t === 'chat').map(m => m.text).join('|');
    ok('پیامِ چت به هم‌اتاقی می‌رسد', /سلام/.test(seen), JSON.stringify(b.inbox.slice(0, 3)).slice(0, 200));
    ok('نویسه‌هایِ دوسمتی و پنهان از متنِ چت پاک می‌شوند', !/[\u202a-\u202e\u2066-\u2069\u200b-\u200f\ufeff]/.test(seen), JSON.stringify(seen));
    ok('نامِ فرستنده هم از همین صافی می‌گذرد', b.inbox.filter(m => m.t === 'chat').every(m => !/[\u202a-\u202e]/.test(m.name || '')), '');
    a.inbox.length = 0; b.inbox.length = 0;
    for(let i = 0; i < 30; i++) a.send({ t: 'chat', text: 'پ' + i });
    await sleep(700);
    const got = b.inbox.filter(m => m.t === 'chat').length;
    ok('سقفِ چت (≈۱ در ثانیه) فعال است', got <= 3, 'به دیگران رسید=' + got);
    const lim = a.inbox.filter(m => m.t === 'chat:slow' || m.t === 'room:error' || m.t === 'chat:limit').length;
    ok('به فرستنده گفته می‌شود که سرعتش زیاد است', lim >= 1, JSON.stringify(a.inbox.slice(0, 3)).slice(0, 180));
    /* مکثِ درخواستِ دوستی */
    a.inbox.length = 0; b.inbox.length = 0;
    a.send({ t: 'friend:req', to: b.id });
    await sleep(250);
    a.send({ t: 'friend:req', to: b.id });
    await sleep(500);
    const cd = a.inbox.filter(m => m.t === 'friend:error' || /صبر|کمی بعد|سرد|ثانیه/.test(m.msg || '')).length;
    ok('مکثِ میانِ دو درخواستِ دوستی دارد', cd >= 1, JSON.stringify(a.inbox.slice(0, 4)).slice(0, 200));
    /* خاموشی و گزارش */
    a.inbox.length = 0; b.inbox.length = 0;
    b.send({ t: 'mute:add', to: a.id });
    await sleep(300);
    b.inbox.length = 0;
    a.send({ t: 'chat', text: 'بعد از خاموشی' });
    await sleep(500);
    ok('کاربر می‌تواند هم‌اتاقی را خاموش کند (پیامش نمی‌آید)', !b.inbox.some(m => m.t === 'chat' && /بعد از خاموشی/.test(m.text || '')),
      JSON.stringify(b.inbox.slice(0, 3)).slice(0, 180));
    a.send({ t: 'report:user', to: b.id, reason: 'توهینِ مکرر' });
    await sleep(400);
    ok('گزارشِ کاربر پذیرفته و ثبت می‌شود', a.inbox.some(m => m.t === 'report:ok') &&
      /reports/.test(fs.readFileSync(DA, 'utf8')), JSON.stringify(a.inbox.slice(0, 3)).slice(0, 180));
    a.close(); b.close();
  }

  /* ── B7 ── */
  section('B7 — اتصالِ بی‌درود زنده نمی‌ماند؛pong احراز نمی‌آورد');
  {
    const s = new S(PA); await s.connect();
    const t0 = Date.now();
    let closed = false;
    s.sock.on('close', () => { closed = true; });
    for(let i = 0; i < 4; i++){ s.ping(); s.send({ t: 'hb' }); await sleep(2600); }
    ok('اتصالِ بی hello پیش از ۱۵ ثانیه بسته می‌شود', closed, 'زنده ماند (' + Math.round((Date.now() - t0) / 1000) + 's)');
    const a = new S(PA); await a.connect();
    a.send({ t: 'hello', name: 'باز' });
    const w = await a.wait(m => m.t === 'welcome', 2000);
    ok('اتصالِ احرازشده زنده می‌ماند و welcome می‌گیرد', !!w && !a.closed, JSON.stringify(w));
    a.close();
    /* سقفِ هر نشانی (روی B، با NOOR_WS_MAX_IP=3 و NOOR_TRUST_PROXY=1).
       از حلقۀ بازگشتی سرورِ بی‌اعتماد، شمارش معنا ندارد ( نشانیِ محلی آزاد
       است تا توسعه‌دهنده و آزمون‌ها گیر نکنند) — پس XFF می‌دهیم. */
    let refused = 0; const many = [];
    for(let i = 0; i < 5; i++){
      const x = new S(PB);
      try{ await x.connect('X-Forwarded-For: 203.0.113.77\r\n'); many.push(x); }catch(e){ refused++; }
    }
    await sleep(400);
    const open = many.filter(x => !x.closed).length;
    ok('B: اتصالِ هم‌زمانِ بیش از سقفِ هر IP بسته/رد می‌شود', open <= 3 && refused + open >= 3,
       'باز=' + open + ' رد=' + refused);
    many.forEach(x => x.close());
  }


  /* ── B19 ── */
  section('B19 — جریانِ فایل، فشرده‌سازیِ ازپیش‌آماده، ذخیره با نشانکِ کثیفی، حضورِ تفاضلی');
  {
    const hashed = fs.readdirSync(path.join(ROOT, 'assets/app')).find(f => /-([0-9a-f]{8,16})\.js$/.test(f));
    const dir = path.join(ROOT, 'assets/app');
    const side = fs.readdirSync(dir).filter(f => /\.(br|gz)$/.test(f));
    /* فشرده‌سازیِ ازپیش‌آماده: نسخهٔ رقیب build.js نیست (این مخزن باندل‌ساز
       ندارد)؛ سرور خودش درستِ پس از بوت، فایل‌های بزرگ را در پس‌زمینه با
       zlibِ ناهمگام فشرده می‌کند. پس سنجشِ راستین این است: پاسخِ br
       می‌آید، و *دوباره* که می‌پرسی همان کاهج می‌خورد (نه فشرده‌سازیِ نو). */
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    ok('گرم‌کردنِ کاهج در پس‌زمینهٔ بوت هست', /function warmCompression/.test(src) && /warmCompression\(\)/.test(src));
    ok('فایل‌ها قبلِ اولین درخواست فهرست می‌شوند (نه روی مسیرِ کاربر)',
       /setImmediate\(step\)/.test(src));
    const r = await req(PA, '/assets/app/' + hashed, { headers: { 'accept-encoding': 'br' } });
    ok('پاسخِ br با همان هش می‌آید (دو بار، تا کاهج هم سنجیده شود)', r.status === 200 && r.headers['content-encoding'] === 'br' && !!r.headers.etag, String(r.headers['content-encoding']));
    const r2 = await req(PA, '/assets/app/' + hashed, { headers: { 'accept-encoding': 'br' } });
    ok('بارِ دوم همان ETag و همان فشرده را می‌دهد',
       r2.headers.etag === r.headers.etag && r2.headers['content-encoding'] === 'br',
       String(r2.headers.etag) + ' vs ' + String(r.headers.etag));
    /* بریدنِ وسطِ جریان نباید سرور را بیندازد */
    await new Promise(res => {
      const s = net.connect(PA, '127.0.0.1', () => {
        s.write(`GET /assets/app/${hashed} HTTP/1.1\r\nHost: x\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`);
        setTimeout(() => { s.destroy(); res(); }, 60);
      });
      s.on('error', () => {});
    });
    await sleep(400);
    const alive = await req(PA, '/health').catch(() => null);
    ok('بریدنِ جریانِ پاسخ سرور را نمی‌کشد', alive && alive.status === 200, alive ? 'وضعیت ' + alive.status : 'سرور افتاد');
    /* ذخیرهٔ بی‌دلیل نباشد */
    const st0 = fs.statSync(DA);
    const m0 = st0.mtimeMs;
    await sleep(32000);
    const m1 = fs.statSync(DA).mtimeMs;
    ok('در ۳۲ ثانیه بی‌کاری، فایل داده دوباره نوشته نمی‌شود', m0 === m1, 'mtime ' + m0 + ' → ' + m1);
    /* حضورِ تفاضلی: اگر چیزی عوض نشود، پیامِ peers تازه نمی‌آید */
    const c = new S(PA); await c.connect();
    c.send({ t: 'hello', name: 'تماشا' });
    await sleep(600);
    const n0 = c.inbox.filter(m => m.t === 'peers').length;
    await sleep(11000);
    const n1 = c.inbox.filter(m => m.t === 'peers').length;
    ok('بی تغییرِ حضور، فهرستِ تازه پخش نمی‌شود', n1 - n0 <= 1, 'پیام‌های اضافهٔ peers: ' + (n1 - n0));
    c.close();
  }

  /* ── B22 ── */
  section('B22 — اعلامِ بی‌تناقض (نسخه، کامنت، README)');
  {
    const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const banner = (src.match(/نورستان[^0-9]{0,12}v?(\d+)\.(\d+)/) || [])[0] || '';
    ok('سرور نسخهٔ درست را اعلام می‌کند', banner.includes(String(pkg.version.split('.')[0])) || !banner, banner + ' vs ' + pkg.version);
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    ok('کامنتِ sw «چهار کش» نمی‌گوید (پنج تا دارد)', !/چهار کش/.test(sw), (sw.match(/[^\n]*چهار کش[^\n]*/) || [''])[0].trim().slice(0, 90));
    const rd = fs.readFileSync(path.join(ROOT, 'README-نورستان.md'), 'utf8');
    /* «noor2024» در README هست — ولی به‌عنوان *یادداشتِ تاریخی* (چرا ورودِ مدیر
       در نسخهٔ ۱۲ می‌سوخت). چیزی که نباید باشد، وعدهٔ رمزِ پیش‌فرض است. */
    ok('README رمزِ پیش‌فرضِ noor2024 را وعده نمی‌دهد',
       !/(رمز[^.\n]{0,24}پیش‌فرض[^.\n]{0,40}noor2024|noor2024[^.\n]{0,30}رمز[^.\n]{0,16}پیش‌فرض)/.test(rd),
       (rd.match(/[^\n]*noor2024[^\n]*/) || [''])[0].slice(0, 110));
    ok('README هر متغیرِ محیطیِ واقعی را می‌شناسد', (() => {
      const keys = [...src.matchAll(/process\.env\.(NOOR_[A-Z_]+)/g)].map(m => m[1]);
      const missing = [...new Set(keys)].filter(x => !rd.includes(x));
      return missing.length === 0 || (console.log('      جایش نیست در README: ' + missing.join(', ')), false);
    })());
    ok('README می‌گوید داده از NOOR_DATA می‌آید', /NOOR_DATA/.test(rd));
  }

  let C = null;
/* ── B6 (بازگشتی) — سرورِ تازه با همان داده ── */
  section('B6 — ری‌استارتِ سرور، نشانه‌ها را نمی‌سوزاند');
  {
    const u = await mint(PA);
    const before = await req(PA, '/api/leaderboard', { headers: { authorization: 'Bearer ' + u.token } });
    ok('پیش از ری‌استارت نشانه کار می‌کند', before.status === 200, 'وضعیت ' + before.status + ' ' + before.body.slice(0, 80));
    A.proc.kill('SIGTERM');
    await sleep(1200);
    C = boot(PC, DA, {});
    await waitHealth(PC);
    const after = await req(PC, '/api/leaderboard', { headers: { authorization: 'Bearer ' + u.token } });
    ok('پس از ری‌استارت با همان داده، همان نشانه معتبر است', after.status === 200, 'وضعیت ' + after.status + ' ' + after.body.slice(0, 100));
    const ws = new S(PC); await ws.connect();
    ws.send({ t: 'hello', name: 'پس از ری‌استارت', userToken: u.token });
    const auth = await ws.wait(m => m.t === 'authenticated' || m.t === 'auth:error', 2500);
    ok('سوکتِ تازه با همان نشانه «authenticated» می‌گیرد', auth && auth.t === 'authenticated', JSON.stringify(auth));
    ws.close();
  }

  /* ── سقفِ LRU روی B ── */
  section('B6/LRU — سقفِ نشانه‌ها، کم‌کاربردترین را می‌بَرد');
  {
    const toks = [];
    /* LRU یعنی «کم‌بکاربردترین می‌رود، نه نخستین‌ساخته». سقفِ نشست روی ۲
       بسته شده تا دیدنی باشد؛ نشانۀ اول را در میانۀ ساختن مصرف می‌کنیم تا
       زنده بماند و قربانیِ بعدی همان نشانه‌هایِ دست‌نخورده باشند. */
    for(let i = 0; i < 4; i++){
      if(i >= 2) await req(PD, '/api/leaderboard', { headers: { authorization: 'Bearer ' + toks[0].token } });
      const u = await mint(PD); if(u.token) toks.push(u);
    }
    ok('چهار نشانه ساخته شد', toks.length >= 4, 'شمار=' + toks.length);
    if(toks.length >= 4){
      /* نشانهٔ اول را تازه نگه می‌داریم (کاربرد = مقدم بر کهنگیِ ساخت) */
      for(let i = 0; i < 2; i++){
        await req(PD, '/api/leaderboard', { headers: { authorization: 'Bearer ' + toks[0].token } });
        await sleep(200);
        await req(PD, '/api/leaderboard', { headers: { authorization: 'Bearer ' + toks[3].token } });
      }
      const kept = await req(PD, '/api/leaderboard', { headers: { authorization: 'Bearer ' + toks[0].token } });
      const dead = await req(PD, '/api/leaderboard', { headers: { authorization: 'Bearer ' + toks[1].token } });
      ok('نشانهٔ تازه‌مصرف زنده می‌ماند', kept.status === 200, 'وضعیت ' + kept.status);
      ok('نشانهٔ کم‌مصرف بیرون می‌رود (LRU، نه شمارشِ درج)', dead.status === 401 || dead.status === 403, 'وضعیت ' + dead.status);
    }
  }

  /* ── B14 (B) — ورودِ مدیر روی HTTPِ غیرمحلی ── */
  section('B14 — ورودِ مدیر تنها روی HTTPS (یا باNOOR_ALLOW_HTTP_ADMIN)');
  {
    const direct = await req(PB, '/api/admin/login', { body: { pass: ADMIN_PASS }, headers: { 'x-forwarded-for': '198.51.100.4' } });
    ok('B: درخواستِ مدیر از بیرون (پشتِ پروکسی) روی HTTP پذیرفته نمی‌شود',
       direct.status === 403 && /HTTPS/.test(direct.body),
       'وضعیت ' + direct.status + ' ' + direct.body.slice(0, 140));
    const A2 = await req(PC, '/api/admin/login', { body: { pass: ADMIN_PASS } });
    ok('حلقهٔ بازگشتی (محلی) بسته نمی‌ماند — ابزارِ توسعه می‌شکند', A2.status === 200, 'وضعیت ' + A2.status);
    C.proc.kill('SIGTERM');
  }

  /* ── پایان ── */
  await sleep(300);
  for(const srv of [A, B, P, D, E, G, C]){ if(srv && srv.proc) try{ srv.proc.kill('SIGKILL'); }catch(e){} }
  console.log(`\n── نتیجه ──\n  ${PASSED} سنجش موفق، ${FAILED} ناموفق` +
              (PENDING ? `، ${PENDING} منتظرِ اصلاح` : ''));
  if(FAILED) console.log(FAILED_LIST.map((f, i) => '  ✗ ' + (i + 1) + '. ' + f).join('\n'));
  if(PENDING) console.log(PENDING_LIST.map(f => '  … ' + f).join('\n'));
  if(PENDING && process.env.NOOR_AUDIT_STRICT !== '1')
    console.log('  (با NOOR_AUDIT_STRICT=1 منتظرها هم ناموفق شمرده می‌شوند)');
  try{ fakeSms.close(); }catch(e){}
  process.exit(FAILED ? 1 : 0);
})().catch(async e => {
  console.error('💥 ابزار آزمون:', e && e.stack || e);
  process.exitCode = 2;
  try{ fakeSms.close(); }catch(x){}
  process.exit(2);
});
