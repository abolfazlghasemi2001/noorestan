/* تست یکپارچه سرور: دو+ کلاینت WebSocket واقعی روی شبکه */
const { spawn } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const path = require('path');

const PORT = 8799;
const DATA = path.join(__dirname, '_srvtest-data.json');
const PASS = 'test-pass-123';
const HASH = crypto.createHash('sha256').update(PASS).digest('hex');
const NS = 'noorestan';

/* ── textbee جعلی ──
   هیچ پیامک واقعی نمی‌رود. سرورِ برنامه با NOOR_SMS_ENDPOINT به همین
   سرورِ کوچک بسته می‌شود، پس هر درخواستی که قرار بود به textbee برود
   این‌جا گرفته و بازرسی می‌شود — هم قراردادِ درخواست سنجیده می‌شود، هم
   اینکه کلید از دست دستگاه بیرون نمی‌رود، و هم هزینه‌ای پرداخت نمی‌شود. */
const SMS_KEY    = 'txb_SERVERKEY_must_not_leak';
const SMS_DEVICE = 'dev_server_6aadc9c779e3d1b79f0bb06f';
const FAKE_PORT  = 8801;
/* حالت‌ها:
     ok       → همان قرارداد مستند textbee: { success:true, data:{ _id, status } }
     fail     → خطای مستند: { success:false, message:'Invalid API key' }  (HTTP 401)
     noid     → ۲۰۰ با `{}`: بدنهٔ JSON ولی بی هیچ نشانه ⇒ پذیرفته (sent)
     html     → ۲۰۰ با بدنهٔ HTML (پروکسی راه را عوض کرده) ⇒ نامعلوم
     503      → خطای موقت سرور ⇒ نامعلوم
     slow     → هرگز پاسخ نمی‌دهد ⇒ مسیر «تمام شدن وقت»
     echo     → پاسخش کلید را بازگو می‌کند ⇒ باید از گزارش سرور بیرون بماند
     statusonly → ۲۰۰ با فقط `data.status` ⇒ پذیرفته (sent)
     msgonly    → ۲۰۰ با فقط `message` ⇒ پذیرفته (sent)
     emptydata  → ۲۰۱ با `{data:{}}` ⇒ پذیرفته (sent)
     badstatus  → `success:true` ولی `status:'failed'` ⇒ رد (failed)
     faildata   → ۴۰۰ با `error` ⇒ رد، با همان علت */
let   smsMode    = 'ok';
let   smsHits    = [];
const fakeSms = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    smsHits.push({ url: req.url, method: req.method, headers: req.headers, body });
    if(smsMode === 'slow') return;                      // بی پاسخ، تا وقت تمام شود
    if(smsMode === 'fail'){
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Invalid API key' }));
    }
    if(smsMode === 'noid'){
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{}');
    }
    if(smsMode === 'html'){
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<html><body>502 Bad Gateway از پروکسی</body></html>');
    }
    if(smsMode === '503'){
      /* بی بدنه: نه نشانهٔ موفقیت، نه شکست ⇒ باید «نامعلوم» شود، نه «نشد» */
      res.writeHead(503);
      return res.end();
    }
    if(smsMode === 'echo'){
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'کلید شما ' + SMS_KEY + ' نامعتبر است' }));
    }
    /* ── شکل‌های واقعیِ پاسخِ textbee ──
       اینها از یک نصبِ زنده گرفته شده‌اند، نه از مستندات: پیامک می‌رسید ولی
       سرور «نمی‌دانم» می‌گفت. هیچ‌کدام `success:true` و `_id` را با هم
       نداشتند، پس از صافیِ پیشین رد می‌شدند. */
    if(smsMode === 'statusonly'){        // فقط data.status — بی _id و بی success
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: { status: 'pending' } }));
    }
    if(smsMode === 'msgonly'){           // پیامِ کامیابی، بی هیچ میدانِ دیگری
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'SMS sent successfully' }));
    }
    if(smsMode === 'emptydata'){         // ۲xx با JSONِ خالی
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: {} }));
    }
    if(smsMode === 'badstatus'){         // متناقض: success:true ولی وضعیت failed
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, data: { _id: 'x9', status: 'failed' } }));
    }
    if(smsMode === 'faildata'){          // شکستِ صریح با کلیدِ error
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Invalid recipients' }));
    }
    if(smsMode === 'emptyok'){           // ۲۰۰ با بدنهٔ کاملاً تهی
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end();
    }
    /* پاسخِ *راستین* textbee، عیناً از یک نصبِ زنده. هیچ `success`ی در ریشه
       نیست، `data.status` هم نیست، و شناسه `smsBatchId` نام دارد. */
    if(smsMode === 'real'){
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: {
        success: true,
        message: 'SMS added to queue for processing',
        smsBatchId: '6aaee39579e3d1b79fc1d770',
        recipientCount: 1
      } }));
    }
    if(smsMode === 'realfail'){          // همان ساختار، ولی شکست درونِ data
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: {
        success: false, message: 'Invalid recipients' } }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { _id: 'abc123', status: 'pending' } }));
  });
});
fakeSms.listen(FAKE_PORT, '127.0.0.1');

let PASSED = 0, FAILED = 0;
const ok = (n, c, e = '') => { if(c){ PASSED++; console.log('  ✅ ' + n); } else { FAILED++; console.log('  ❌ ' + n + (e ? '  → ' + e : '')); } };
const section = t => console.log('\n── ' + t + ' ──');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── کلاینت ساده ── */
class Client {
  constructor(tag){
    this.tag = tag; this.inbox = []; this.lastState = null;
    this.id = 'c' + tag + '-' + Math.random().toString(36).slice(2, 8);
  }
  connect(){
    return new Promise((res, rej) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
      const to = setTimeout(() => rej(new Error('connect timeout ' + this.tag)), 5000);
      this.ws.onopen = () => { clearTimeout(to); res(); };
      this.ws.onerror = e => { clearTimeout(to); rej(new Error('ws error ' + this.tag)); };
      this.ws.onmessage = ev => {
        let m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
        if(m.t === 'game' && m.phase === 'start') this.lastState = m.state || null;   // بازی تازه
        else if(m.t === 'game' && m.state) this.lastState = m.state;                  // آخرین وضعیت تخته
        this.inbox.push(m);
        if(this._waiters) this._waiters = this._waiters.filter(w => !w(m));
      };
    });
  }
  send(obj){ this.ws.send(JSON.stringify({ ns: NS, from: this.id, to: '*', ...obj })); }
  /* شمار خانه‌های پر — برای سنجش «حرکت انجام شد یا نه» بدون تکیه بر زمان‌بندی پیام‌ها */
  filled(){ return this.lastState ? this.lastState.board.filter(Boolean).length : 0; }
  /** منتظر پیامی با شرط مشخص */
  wait(pred, ms = 3000){
    const found = this.inbox.find(pred);
    if(found) return Promise.resolve(found);
    return new Promise(res => {
      const t = setTimeout(() => { this._waiters = (this._waiters || []).filter(w => w !== fn); res(null); }, ms);
      const fn = m => { if(pred(m)){ clearTimeout(t); res(m); return true; } return false; };
      this._waiters = this._waiters || [];
      this._waiters.push(fn);
    });
  }
  clear(){ this.inbox.length = 0; }
  get msgs(){ return this.inbox; }
}

/* ── پاکسازی سرورهای سرگردان ──
   اگر اجرای پیشین نیمه‌کاره بمیرد، سرور تست روی همین پورت زنده می‌ماند و
   اجرای بعدی بی‌خبر به سرورِ کهنه وصل می‌شود و نتیجهٔ تست‌ها دروغ می‌شود.
   پس اول هر پردازنده‌ای را که با همین پورت و همین فایل داده بالا آمده می‌کشیم. */
function killStale(){
  let killed = 0;
  let pids = [];
  try{ pids = require('fs').readdirSync('/proc').filter(f => /^\d+$/.test(f)); }catch(e){ return 0; }
  for(const pid of pids){
    if(+pid === process.pid) continue;
    let env = '';
    try{ env = require('fs').readFileSync(`/proc/${pid}/environ`, 'utf8'); }catch(e){ continue; }
    if(!env.includes('PORT=' + PORT + '\0')) continue;
    if(!env.includes('_srvtest-data.json')) continue;       // فقط سرورهای همین تست
    try{ process.kill(+pid, 'SIGKILL'); killed++; }catch(e){}
  }
  return killed;
}
const stale = killStale();
if(stale) console.log(`(⚠️ ${stale} سرور سرگردان از اجرای قبل کشته شد)`);

/* ── راه‌اندازی سرور ── */
const srv = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
  env: {
    ...process.env, PORT: String(PORT), NOOR_ADMIN_PASS: PASS, NOOR_DATA: DATA, NOOR_ORIGIN: '*',
    /* پیامک: به textbee جعلیِ بالا وصل می‌شود، نه به textbee واقعی */
    NOOR_SMS_KEY: SMS_KEY,
    NOOR_SMS_DEVICE: SMS_DEVICE,
    NOOR_SMS_ENDPOINT: `http://127.0.0.1:${FAKE_PORT}/api/v1/gateway/send-sms`,
    /* مسیر «تمام شدن وقت» با ۳۰ ثانیه سنجیده نمی‌شود؛ ۷۰۰ میلی‌ثانیه کافی است
       تا همان کد اجرا شود. */
    NOOR_SMS_TIMEOUT: '700',
    /* سقف‌های ساعتی این‌جا بالا برده می‌شوند، وگرنه این آزمون‌ها خودشان سقفِ
       هر نشانی (۲۰ در ساعت) را پر می‌کنند و از آن به بعد هر درخواستِ تازه
       ۴۲۹ می‌گیرد — یعنی آزمون به‌جای سنجیدنِ منطق، سقف را می‌سنجد.
       سقفِ هر شماره (۳) دست‌نخورده می‌ماند چون آزمونِ خودش را دارد. */
    NOOR_SMS_MAX_IP: '2000',
    NOOR_SMS_MAX_HOUR: '5000'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let srvOut = '';
srv.stdout.on('data', d => { srvOut += d.toString(); });
srv.stderr.on('data', d => { srvOut += d.toString(); });

const cleanup = () => {
  try{ srv.kill('SIGKILL'); }catch(e){}
  try{ fakeSms.close(); }catch(e){}
  try{ require('fs').unlinkSync(DATA); }catch(e){}
};

(async () => {
  /* به‌جای خوابِ ثابت، تا آماده شدن واقعی سرور صبر کن */
  let up = false;
  for(let i = 0; i < 40 && !up; i++){
    if(srv.exitCode !== null) break;
    up = await fetch(`http://127.0.0.1:${PORT}/health`).then(r => r.ok).catch(() => false);
    if(!up) await sleep(200);
  }
  if(!up){ console.log('سرور بالا نیامد:\n' + srvOut); cleanup(); process.exit(1); }

  /* 1. HTTP */
  section('HTTP');
  const health = await fetch(`http://127.0.0.1:${PORT}/health`).then(r => r.json()).catch(() => null);
  ok('/health پاسخ می‌دهد', health?.ok === true, JSON.stringify(health));
  ok('نسخه گزارش می‌شود', health?.version === '15.0');
  ok('آمار تماشاچی در health گزارش می‌شود', Number.isInteger(health?.spectators), JSON.stringify({ spectators: health?.spectators }));
  /* از وقتی /api/rooms احرازی شد، بی‌نشانه 401 می‌دهد؛ خواندنِ با نشانه
     پایین‌تر (پس از ورودِ پیامکی) سنجیده می‌شود. */
  const roomsNoAuth = await fetch(`http://127.0.0.1:${PORT}/api/rooms`);
  ok('🔒 فهرست روم بدون نشانه 401 می‌دهد', roomsNoAuth.status === 401, 'status=' + roomsNoAuth.status);
  const page = await fetch(`http://127.0.0.1:${PORT}/`).then(r => r.text()).catch(() => '');
  ok('صفحه برنامه سرو می‌شود', page.includes('نورستان') && page.includes('<script>'), 'len=' + page.length);
  const bad = await fetch(`http://127.0.0.1:${PORT}/../../etc/passwd`).then(r => r.status).catch(() => 0);
  ok('🔒 پیمایش مسیر مسدود است', bad === 404 || bad === 403, 'status=' + bad);

  /* 1.5 پیامک — پروکسی سرور */
  section('پیامک — پروکسی سرور (textbee جعلی)');
  const API = `http://127.0.0.1:${PORT}/api/otp`;
  const post = (path, body, opt = {}) => fetch(API + path, {
    method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body), ...opt
  });
  /* کد حالا روی سرور ساخته می‌شود، پس متن پیش‌بینی‌شدنی نیست؛ فقط قالبش
     سنجیده می‌شود و اینکه کدِ داخلش پنج‌رقمی است. */
  const OTP_SHAPE = /^🌟 نورستان\n🔐 کد تأیید ثبت‌نام شما: (\d{5})\n⏱ اعتبار: ۲ دقیقه\n⚠️ این کد را با کسی به اشتراک نگذارید\.$/;

  const stTxt  = await fetch(API + '/status').then(r => r.text());
  const stJson = JSON.parse(stTxt);
  ok('وضعیت: کلید سرور دیده می‌شود', stJson.configured === true && stJson.on === true, stTxt);
  ok('🔒 وضعیت، شناسهٔ دستگاه را ماسک می‌کند', stJson.device === '…' + SMS_DEVICE.slice(-4) && !stTxt.includes(SMS_DEVICE), stJson.device);
  ok('🔒 کلید در پاسخ وضعیت نیست', !stTxt.includes(SMS_KEY));

  /* ── ساختِ کد روی سرور ──
     کلاینت دیگر کد نمی‌فرستد؛ فقط شماره را می‌گوید. کد اینجا ساخته می‌شود و
     هرگز به کلاینت نمی‌رود — نه در پاسخ، نه در لاگ. */
  smsHits = [];
  const os1 = await post('/request', { phone: '09121110001' });
  const t1 = await os1.text();
  ok('درخواستِ کد ⇒ ۲۰۰', os1.status === 200, os1.status + ' ' + t1);
  const j1 = JSON.parse(t1);
  ok('پاسخ جز کلیدهای شناخته‌شده چیزی ندارد',
     JSON.stringify(Object.keys(j1).sort()) === '["id","len","state","success","ttl"]',
     JSON.stringify(Object.keys(j1)));
  ok('پاسخ موفق، state=sent دارد', j1.state === 'sent', t1);
  ok('شناسهٔ پیام به کاربر می‌رسد', j1.id === 'abc123', t1);
  ok('🔒 خودِ کد در پاسخ نیست', !/\d{5}/.test(t1.replace(/\d{5,}/g, '')), t1);
  ok('طولِ کد اعلام می‌شود', j1.len === 5, t1);
  ok('اعتبار اعلام می‌شود', j1.ttl === 120000, t1);
  ok('درخواست به بیرون رفت', smsHits.length === 1, 'hits=' + smsHits.length);

  const h1 = smsHits[0] || { headers:{}, body:'{}' };
  ok('مقصد، همان endpoint تنظیم‌شده است', h1.url === '/api/v1/gateway/send-sms', h1.url);
  ok('متد POST است', h1.method === 'POST');
  ok('🔑 کلید در هدر x-api-key می‌رود', h1.headers['x-api-key'] === SMS_KEY);
  ok('نوع محتوا JSON است', String(h1.headers['content-type'] || '').includes('application/json'));
  const f1 = JSON.parse(h1.body);
  ok('بدنه دقیقاً سه کلید دارد', JSON.stringify(Object.keys(f1).sort()) === '["deviceId","message","recipients"]', JSON.stringify(Object.keys(f1)));
  ok('deviceId همان دستگاه ثبت‌شده است', f1.deviceId === SMS_DEVICE);
  ok('recipients آرایه است', Array.isArray(f1.recipients) && f1.recipients.length === 1 && f1.recipients[0] === '09121110001', JSON.stringify(f1.recipients));
  ok('متن، همان قالبِ ثابت است', OTP_SHAPE.test(f1.message), JSON.stringify(f1.message));
  ok('🔒 کلید در بدنه نیست', !h1.body.includes(SMS_KEY));

  /* ── بررسیِ کد ── */
  const C1 = (() => { const m = JSON.parse(smsHits[0].body).message.match(OTP_SHAPE); return m ? m[1] : ''; })();
  ok('کدِ پنج‌رقمی در پیامک ساخته شد', /^\d{5}$/.test(C1), C1);

  const vBad = await post('/verify', { phone: '09121110001', code: C1 === '00000' ? '11111' : '00000' });
  ok('🔒 کدِ اشتباه رد می‌شود', vBad.status === 401, vBad.status);
  const vBadJ = await vBad.json();
  ok('و تعدادِ تلاشِ مانده گفته می‌شود', vBadJ.left === 2, JSON.stringify(vBadJ));

  const vOk = await post('/verify', { phone: '09121110001', code: C1, userId: 'usr_' + 'a1b2c3d4e5'.repeat(2) });
  const vOkJ = await vOk.json();
  ok('کدِ درست پذیرفته می‌شود', vOk.status === 200 && vOkJ.success === true, JSON.stringify(vOkJ));
  ok('و نشانهٔ نشستِ کاربر می‌آید', /^[0-9a-f]{64}$/.test(vOkJ.token || ''), JSON.stringify(vOkJ).slice(0,120));
  ok('🔒 نشانه، خودِ کد نیست', vOkJ.token !== C1);
  /* شناسه را سرور می‌سازد (userId ارسالی نادیده گرفته می‌شود) و در
     ورودهای بعدیِ همان شماره پایدار می‌ماند — پایین‌تر سنجیده می‌شود. */
  ok('شناسهٔ کاربر در سرور ساخته می‌شود', /^usr_[0-9a-f]{20}$/.test(vOkJ.id || ''), vOkJ.id);
  const roomsHttp0 = await fetch(`http://127.0.0.1:${PORT}/api/rooms`,
    { headers: { Authorization: 'Bearer ' + vOkJ.token } }).then(r => r.json());
  ok('فهرست روم با نشانهٔ کاربر خوانده می‌شود', Array.isArray(roomsHttp0.rooms), JSON.stringify(roomsHttp0).slice(0, 120));
  ok('نخستین ورودِ این شماره، first=true دارد', vOkJ.first === true, JSON.stringify(vOkJ).slice(0, 140));

  /* ── پیامکِ خوش‌آمدگویی (۱۷.۱ بخش ۴) ──
     پس از نخستین ورودِ موفق می‌رود، و فقط یک بار. عمداً *پس* از پاسخ
     فرستاده می‌شود تا کندیِ textbee ورودِ کاربر را معطل نکند؛ پس آزمون هم
     باید کمی صبر کند. */
  const seenWelcome = () => smsHits.find(x => String(x.body || '').includes('خوش آمدید')) || null;
  let wh = null;
  for(let i = 0; i < 80 && !wh; i++){ wh = seenWelcome(); if(!wh) await sleep(50); }
  ok('پیامکِ خوش‌آمدگویی پس از نخستین ورود رفت', !!wh, 'hits=' + smsHits.length);
  if(wh){
    const wb = JSON.parse(wh.body);
    ok('خوش‌آمد به همان شماره می‌رود',
       Array.isArray(wb.recipients) && wb.recipients[0] === '09121110001', JSON.stringify(wb.recipients));
    ok('خوش‌آمد شناسهٔ کاربر را در متن دارد',
       String(wb.message).includes(vOkJ.id), String(wb.message).slice(0, 90));
    ok('🔒 متنِ خوش‌آمد الگو (pattern) ندارد — متنِ مستقیم است',
       !/pattern|\{\{/.test(String(wb.message)), String(wb.message).slice(0, 60));
    ok('🔒 کلید در بدنهٔ خوش‌آمد نیست', !wh.body.includes(SMS_KEY));
    ok('خوش‌آمد به همان endpoint و دستگاه می‌رود',
       wh.url === '/api/v1/gateway/send-sms' && wb.deviceId === SMS_DEVICE && wh.method === 'POST');
    ok('🔒 کد تأیید در خوش‌آمد نیست', !/\d{5}/.test(String(wb.message).replace(vOkJ.id, '').replace('۱۵ بازی', '')),
       String(wb.message).slice(0, 120));
    ok('متنِ خوش‌آمد خطِ «نورستان» را در پایان دارد', /\nنورستان$/.test(String(wb.message)));
  }

  /* «یک بار برای همیشه» روی شمارهٔ جداگانه سنجیده می‌شود.
     اگر همین ۰۹۱۲۱۱۱۰۰۰۱ را دو بار وارد کنیم، سهمِ سه‌تاییِ پیامکِ آن
     شماره پیش از آزمونِ پیامکِ مدیریتی تمام می‌شود و آن آزمونِ کهنه
     بی‌ربط به کارِ ما می‌شکند. پس شمارهٔ تازه‌ای می‌گیریم و همان
     شماره را دو بار وارد می‌کنیم — دقیقاً همان چیزی که باید سنجیده شود. */
  const WPH = '09121110088';
  smsHits = [];
  const rp3 = await post('/request', { phone: WPH });
  const C3 = (() => { const m = JSON.parse(smsHits[0].body || '{}').message.match(OTP_SHAPE); return m ? m[1] : ''; })();
  const v3 = await post('/verify', { phone: WPH, code: C3, userId: 'usr_' + 'bb'.repeat(10) });
  const v3j = await v3.json();
  ok('شمارهٔ تازه پذیرفته می‌شود', rp3.status === 200 && v3.status === 200, rp3.status + '/' + v3.status);
  ok('نخستین ورودِ شمارهٔ تازه، first=true دارد', v3j.first === true, JSON.stringify(v3j).slice(0, 120));
  let wh3 = null;
  for(let i = 0; i < 80 && !wh3; i++){ wh3 = seenWelcome(); if(!wh3) await sleep(50); }
  ok('شمارهٔ تازه خوش‌آمدِ خودش را می‌گیرد',
     !!wh3 && JSON.parse(wh3.body).recipients[0] === WPH,
     wh3 ? wh3.body.slice(0, 100) : 'hits=' + smsHits.length);

  /* بار دوم: همان شماره، کدِ تازه — و هیچ خوش‌آمدگوییِ دومی */
  smsHits = [];
  const rp2 = await post('/request', { phone: WPH });
  ok('کدِ تازه برای همان شماره صادر می‌شود', rp2.status === 200, rp2.status);
  const C2 = (() => { const m = JSON.parse(smsHits[0].body).message.match(OTP_SHAPE); return m ? m[1] : ''; })();
  const v2 = await post('/verify', { phone: WPH, code: C2, userId: 'usr_' + 'bb'.repeat(10) });
  const v2j = await v2.json();
  ok('ورودِ دومِ همان شماره پذیرفته می‌شود', v2.status === 200 && v2j.success === true, JSON.stringify(v2j).slice(0, 120));
  ok('ورودِ دوم دیگر «نخستین بار» نیست', v2j.first === false, JSON.stringify(v2j).slice(0, 120));
  ok('شناسه در ورودِ دومِ همان شماره پایدار می‌ماند', v2j.id === v3j.id && /^usr_/.test(v2j.id || ''), v3j.id + ' / ' + v2j.id);
  await sleep(500);
  ok('🔒 خوش‌آمدگویی بارِ دوم فرستاده نمی‌شود', !seenWelcome(), 'hits=' + smsHits.length);

  /* ارسالِ ناموفق: ورود باید بی‌خیال ادامه یابد، و نشانِ «خوش‌آمد رفت»
     نباید بخورد — وگرنه یک قطعیِ گذرا خوش‌آمدگویی را برای همیشه می‌سوزاند.

     «نشان نخورد» را از پاسخِ HTTP نمی‌شود فهمید (خوش‌آمد پشتِ پاسخ
     می‌رود)؛ پس با یک کلاینتِ واقعی وارد می‌شویم و کارنامهٔ خودِ کاربر را
     می‌پرسیم — همان پیامی که پروفایل در برنامه از آن می‌خواند. */
  const FPH = '09121110099', FID = 'usr_' + 'cc'.repeat(10);
  smsHits = [];
  const rp5 = await post('/request', { phone: FPH });
  const C5 = (() => { const m = JSON.parse(smsHits[0].body || '{}').message.match(OTP_SHAPE); return m ? m[1] : ''; })();
  smsMode = 'fail';                 // کد گرفته شد؛ حالا textbee خراب می‌شود
  const v5 = await post('/verify', { phone: FPH, code: C5, userId: FID });
  const v5j = await v5.json();
  await sleep(700);
  smsMode = 'ok';
  ok('🔒 خرابیِ خوش‌آمدگویی جلوی ورود را نمی‌گیرد',
     v5.status === 200 && v5j.success === true, v5.status + ' ' + JSON.stringify(v5j).slice(0, 110));
  ok('و نشانهٔ نشست هم می‌آید', /^[0-9a-f]{64}$/.test(v5j.token || ''));
  ok('تلاشِ خوش‌آمد انجام شد ولی ناموفق ماند',
     smsHits.filter(x => String(x.body || '').includes('خوش آمدید')).length === 1, 'hits=' + smsHits.length);

  const W1 = new Client('W1');
  await W1.connect();
  W1.id = (await W1.wait(m => m.t === 'welcome')).id;
  W1.clear();
  W1.send({ t: 'hello', ns: NS, name: 'آزمون', userId: FID, userToken: v5j.token });
  const me5 = await W1.wait(m => m.t === 'me', 3000);
  ok('کارنامهٔ کاربر به خودش می‌رسد', !!me5 && me5.id === v5j.id, JSON.stringify(me5));
  ok('🔒 و هیچ شناسهٔ نشستی در آن نیست',
     !!me5 && !Object.keys(me5).some(k => /token|hash|salt|code/i.test(k)), JSON.stringify(me5));
  ok('🔒 خوش‌آمدِ ناموفق نشانِ «رفته» نمی‌خورد', !!me5 && me5.welcomed === false, JSON.stringify(me5));

  /* ورودِ بعدیِ همان شماره با textbee سالم: خوش‌آمد این بار می‌رود.
     یعنی فرصتِ دوباره سوخته نشده. */
  smsHits = [];
  const rp6 = await post('/request', { phone: FPH });
  const C6 = (() => { const m = JSON.parse(smsHits[0].body || '{}').message.match(OTP_SHAPE); return m ? m[1] : ''; })();
  const v6 = await post('/verify', { phone: FPH, code: C6, userId: FID });
  ok('ورودِ بعدیِ همان شماره پذیرفته می‌شود', rp6.status === 200 && v6.status === 200, rp6.status + '/' + v6.status);
  let wh6 = null;
  for(let i = 0; i < 80 && !wh6; i++){ wh6 = seenWelcome(); if(!wh6) await sleep(50); }
  ok('🔒 خوش‌آمدِ ناموفق، فرصتِ دوباره را نمی‌سوزاند',
     !!wh6 && JSON.parse(wh6.body).recipients[0] === FPH,
     wh6 ? wh6.body.slice(0, 100) : 'hits=' + smsHits.length);
  /* و نشانش زنده روی پروفایل می‌نشیند، بی آنکه کاربر دوباره وصل شود. */
  const me6 = await W1.wait(m => m.t === 'me' && m.welcomed === true, 2000);
  ok('و نشانِ «رفت» زنده به پروفایلِ کاربر می‌رسد', !!me6, JSON.stringify(W1.msgs.slice(-2)));
  /* این کلاینت کارش تمام است. اگر باز بماند، در سنجش‌های «حضور» یک نفر
     اضافه می‌شود و آزمون‌های بی‌ربطِ بعدی می‌شکنند. */
  try{ W1.ws.close(); }catch(e){}
  await sleep(200);

  /* یک‌بارمصرف: همان کد دوباره کار نمی‌کند */
  const vAgain = await post('/verify', { phone: '09121110001', code: C1 });
  ok('🔒 کد یک‌بارمصرف است', vAgain.status === 410, vAgain.status);

  /* بی کدِ درخواست‌شده، بررسی معنا ندارد */
  const vNone = await post('/verify', { phone: '09121117777', code: '12345' });
  ok('🔒 بی درخواستِ کد، بررسی رد می‌شود', vNone.status === 410, vNone.status);

  /* تست اتصال */
  smsHits = [];
  const os2 = await post('/send', { phone: '09121110001', test: true });
  ok('🧪 تست ارسال ⇒ ۲۰۰', os2.status === 200);
  const f2 = JSON.parse(smsHits[0].body);
  ok('🧪 متن آزمایشی، کد ندارد', !/\d{5}/.test(f2.message) && f2.message.includes('آزمایش'), JSON.stringify(f2.message));
  ok('🧪 شمارهٔ آزمایشی نرمال‌سازی می‌شود', f2.recipients[0] === '09121110001');

  /* 🔒 دروازهٔ باز نمی‌شود: هیچ متنی از کاربر به سرویس بیرونی نمی‌رود.
     چه در مسیر آزمایشی، چه با بدنهٔ اضافی. */
  smsHits = [];
  const evil = await post('/send', { phone: '09121110002', test: true, message: 'متن دلخواه مهاجم' });
  ok('🧪 بدنهٔ اضافی نادیده گرفته می‌شود', evil.status === 200 && smsHits.length === 1, String(evil.status));
  ok('🔒 متن دلخواه هرگز ارسال نمی‌شود', !smsHits[0].body.includes('مهاجم'), smsHits[0].body.slice(0, 120));
  ok('🧪 متن همان قالب ثابت است', JSON.parse(smsHits[0].body).message.includes('آزمایش'));

  /* ورودی بد */
  const bads = [
    ['شمارهٔ نامعتبر',        '/request', { phone: '0212345678' }],
    ['بدون شماره',            '/request', {}],
    ['شمارهٔ کوتاه',          '/verify',  { phone: '0912111', code: '12345' }],
    ['کد چهاررقمی',           '/verify',  { phone: '09121110003', code: '1234' }],
    ['کد شش‌رقمی',            '/verify',  { phone: '09121110003', code: '123456' }]
  ];
  for(const [name, path, b] of bads){
    const r = await post(path, b);
    ok('🔒 ' + name + ' ⇒ 400', r.status === 400, name + ' → ' + r.status);
  }
  const gf = await fetch(API + '/request').then(r => r.status).catch(() => 0);
  ok('🔒 GET روی /request ⇒ 405', gf === 405, gf);

  /* 🔒 مسیرِ قدیمی که کدِ *کلاینت* را می‌فرستاد بسته شده.
     بی این، هر کسی می‌توانست هر شماره‌ای را با متنِ دلخواه — از جمله «کد
     تأیید: …» — بمباران کند. */
  smsHits = [];
  const legacy = await post('/send', { phone: '09121115555', code: '12345' });
  ok('🔒 /send دیگر کدِ کلاینت را نمی‌فرستد', legacy.status === 400, legacy.status);
  ok('🔒 و هیچ پیامکی هم به بیرون نرفت', smsHits.length === 0, 'hits=' + smsHits.length);

  /* رقم فارسی در بدنه */
  smsHits = [];
  smsHits = [];
  const fa = await post('/request', { phone: '۰۹۱۲۱۱۱۰۰۰۴' });
  ok('رقم فارسی پذیرفته و لاتین می‌شود', fa.status === 200 && JSON.parse(smsHits[0].body).recipients[0] === '09121110004');
  ok('کدِ فارسی هم درست در متن می‌نشیند', /کد تأیید ثبت‌نام شما: \d{5}/.test(JSON.parse(smsHits[0].body).message));

  /* محدودیت نرخ: ۳ پیامک به یک شماره، چهارمی رد */
  const RP = '09121119999';
  const codes = [];
  for(let i = 0; i < 3; i++) codes.push((await post('/request', { phone: RP })).status);
  const os4 = await post('/request', { phone: RP });
  ok('سه پیامک اول قبول شد', codes.every(s => s === 200), JSON.stringify(codes));
  ok('🔒 پیامک چهارم به همان شماره ⇒ 429', os4.status === 429, os4.status);
  const j4 = await os4.json();
  ok('علت به کاربر گفته می‌شود', typeof j4.error === 'string' && j4.error.length > 5 && j4.success === false, JSON.stringify(j4));

  /* ── سه حالت پاسخ، نه دو حالت ──
     تنها تفاوتِ «نامعلوم» با «نشد» این است که کاربر را از صفحهٔ کد بیرون
     نمی‌کنیم؛ چون پیامک ممکن است رسیده باشد. پس کدِ HTTP باید فرق کند:
     ۲۰۲ برای نامعلوم، ۵۰۲ برای قطعاً نشد، ۲۰۰ برای «رفت».

     باگِ C3 درست همین‌جا بود: بدنهٔ سالمِ textbee شکلِ مستندشده را نداشت،
     پس «نمی‌دانم» می‌گفتیم در حالی که پیامک رسیده بود. حالا هر پاسخِ ۲xx
     که *بدنهٔ JSON* داشته باشد پذیرفته می‌شود؛ بدنهٔ HTML یا خالی همچنان
     «نامعلوم» است چون از دهانهٔ textbee نیامده. */
  section('پیامک — «رفت» از «نامعلوم» از «نشد» جدا می‌شود');
  const SHAPES = [
    /* شرح                       حالت جعلی   کد HTTP   state      خطا باید باشد؟ */
    ['خطای مستند Invalid API key', 'fail',   502, 'failed',  'Invalid API key'],
    /* `{}` بدنهٔ JSON است، پس پاسخ از دهانه آمده — نه صفحهٔ HTML پروکسی.
       پذیرفتنش همان رفعِ باگِ C3 است: پیامک می‌رسید ولی «⏳» نشان می‌دادیم. */
    ['۲۰۰ با JSONِ خالی',          'noid',   200, 'sent',    null],
    ['۲۰۰ با بدنهٔ HTML',          'html',   202, 'pending', null],
    ['۵۰۳ بی بدنه',                '503',    202, 'pending', null],
    ['مهلت تمام‌شده',              'slow',   202, 'pending', null],
    /* ── شکل‌های واقعی که باگ را ساختند ── */
    ['۲۰۰ با فقط data.status',      'statusonly', 200, 'sent', null],
    ['۲۰۰ با فقط message',          'msgonly',    200, 'sent', null],
    /* ۲۰۱ خودِ textbee است؛ پاسخِ ما به کلاینت همیشه ۲۰۰ در حالتِ «رفت» است */
    ['۲۰۱ با data خالی',            'emptydata',  200, 'sent', null],
    ['success:true ولی status=failed', 'badstatus', 502, 'failed', 'textbee وضعیتِ «failed» را گزارش کرد'],
    ['۴۰۰ با error',                'faildata',   502, 'failed', 'Invalid recipients'],
    ['۲۰۰ با بدنهٔ تهی',            'emptyok',    200, 'sent',   null],
    /* پاسخِ راستین textbee: success درونِ data، شناسه smsBatchId */
    ['پاسخِ راستین textbee',        'real',       200, 'sent',   null],
    ['شکست درونِ data',             'realfail',   502, 'failed', 'textbee درخواست را نپذیرفت']
  ];
  let phoneSeed = 400;
  for(const [name, mode, wantHttp, wantState, wantErr] of SHAPES){
    smsMode = mode; smsHits = [];
    const r = await post('/request', { phone: '091211' + (10000 + phoneSeed++) });
    const txt = await r.text();
    smsMode = 'ok';
    const j = JSON.parse(txt);
    ok(`${name} ⇒ HTTP ${wantHttp}`, r.status === wantHttp, r.status + ' ' + txt);
    ok(`${name} ⇒ state=${wantState}`, j.state === wantState, txt);
    ok(`${name} ⇒ success درست است`, j.success === (wantState === 'sent'), txt);
    if(wantErr) ok(`${name} ⇒ علت گفته می‌شود`, j.error === wantErr, JSON.stringify(j.error));
    if(wantState === 'pending')
      ok(`${name} ⇒ کاربر بیرون رانده نمی‌شود`, j.pending === true, txt);
    ok(`🔒 ${name} ⇒ کلید در پاسخ نیست`, !txt.includes(SMS_KEY), txt);
  }

  /* ── شناسهٔ پیگیری ──
     «رفت» گفتن کافی نیست: بی شناسه، نه می‌شود پیگیری کرد و نه در لاگ
     فهمید کدام پیامک کدام است. پاسخِ راستین، شناسه را در `data.smsBatchId`
     می‌گذارد — نه در `_id` که کدِ پیشین می‌گشت. */
  smsMode = 'real'; smsHits = [];
  const rReal = await post('/request', { phone: '09121116001' });
  const jReal = JSON.parse(await rReal.text());
  smsMode = 'ok';
  ok('شناسهٔ پیگیریِ textbee گم نمی‌شود',
     jReal.id === '6aaee39579e3d1b79fc1d770', JSON.stringify(jReal));

  /* 🔒 اگر سرویس بیرونی کلید را در متن خطا بازگو کند، نباید به کاربر برسد */
  smsMode = 'echo'; smsHits = [];
  const re = await post('/request', { phone: '09121130001' });
  const te = await re.text();
  smsMode = 'ok';
  ok('🔒 خطای بازگوکنندهٔ کلید، کلید را به کاربر نمی‌رساند', !te.includes(SMS_KEY), te);
  ok('🔒 ولی خودِ خطا بی‌صدا پاک نمی‌شود', /نامعتبر/.test(te), te);
  ok('🔒 جای کلید، نشانهٔ جانشین می‌نشیند', te.includes('«کلید»'), te);

  /* پیش‌پرواز مرورگر */
  const op = await fetch(API + '/send', { method: 'OPTIONS' });
  ok('OPTIONS پیش‌پرواز پاسخ می‌دهد', op.status === 204 || op.status === 200, op.status);
  ok('🔒 پیش‌پرواز فقط Content-Type را مجاز می‌کند (نه کلید)',
     /content-type/i.test(op.headers.get('access-control-allow-headers') || '') &&
     !/x-api-key/i.test(op.headers.get('access-control-allow-headers') || ''),
     op.headers.get('access-control-allow-headers'));

  /* کاربرِ چهارم برای A: ماندگار است و در بخشِ «حذف» دست‌نخورده می‌ماند؛
     vOkJ همان قربانیِ آزمون‌های مسدود/حذف است و A نباید با توکنِ او جلو برود
     (حذف، نشست‌ها و اتصالِ صاحبش را هم می‌بندد). */
  smsHits = [];
  const rpA = await post('/request', { phone: '09121110077' });
  const CA = (() => { const m = JSON.parse(smsHits[0].body || '{}').message.match(OTP_SHAPE); return m ? m[1] : ''; })();
  const vA = await post('/verify', { phone: '09121110077', code: CA });
  const vAj = await vA.json();
  ok('کاربرِ ماندگارِ A ساخته شد',
     rpA.status === 200 && vA.status === 200 && vAj.success === true && /^usr_[0-9a-f]{20}$/.test(vAj.id || ''));

  /* 2. اتصال و حضور */
  section('اتصال و حضور');
  const A = new Client('A'); await A.connect();
  const B = new Client('B'); await B.connect();
  const C = new Client('C'); await C.connect();
  const welcome = await A.wait(m => m.t === 'welcome');
  ok('پیام welcome بلافاصله می‌آید', !!welcome?.id, JSON.stringify(welcome));
  ok('شناسه را سرور تعیین می‌کند', /^u-[0-9a-f]{10}$/.test(welcome?.id || ''), welcome?.id);
  A.id = welcome.id;                                  // کلاینت باید شناسه سرور را بپذیرد
  const wb = await B.wait(m => m.t === 'welcome');
  B.id = wb.id;
  const wc = await C.wait(m => m.t === 'welcome');
  C.id = wc.id;
  ok('شناسه‌ها یکتا هستند', new Set([A.id, B.id, C.id]).size === 3);
  A.clear(); B.clear(); C.clear();
  /* هر سه با نشانهٔ واقعیِ سه شمارهٔ ثبت‌شدهٔ بالا وارد می‌شوند؛ وگرنه
     سرور auth:error می‌دهد و وصل را می‌بندد. نام‌ها در کارنامه ثبت‌اند. */
  A.send({ t: 'hello', name: 'آرش', level: 4, score: 300, userToken: vAj.token });
  B.send({ t: 'hello', name: 'سارا', level: 2, score: 120, userToken: v3j.token });
  C.send({ t: 'hello', name: 'رضا', level: 1, score: 10, userToken: v5j.token });
  await sleep(400);
  const peers = await A.wait(m => m.t === 'peers' && m.list?.length === 3 && m.list.some(p => p.name === 'سارا'));
  ok('هر سه نفر در لیست حضور هستند', peers?.list.length === 3, 'got ' + peers?.list.length);
  ok('شناسه سرور در لیست حضور دیده می‌شود', peers?.list.some(p => p.id === A.id));
  ok('نام‌ها درست منتقل شدند', peers?.list.some(p => p.name === 'سارا') && peers?.list.some(p => p.name === 'آرش'));
  ok('همه، لیست روم خالی گرفتند', (await A.wait(m => m.t === 'rooms'))?.list.length === 0);

  /* 3. ساخت و ورود به روم */
  section('روم');
  A.clear(); B.clear(); C.clear();
  A.send({ t: 'room:create', name: 'اتاق آرش', game: 'dooz' });
  const j = await A.wait(m => m.t === 'room:joined');
  ok('روم ساخته شد', /^\d{6}$/.test(j?.code || ''), j?.code);
  ok('سازنده میزبان است', j?.isHost === true);
  const CODE = j.code;
  C.clear();
  C.send({ t: 'room:join', code: '000000' });
  ok('کد نامعتبر خطا می‌دهد', (await C.wait(m => m.t === 'room:error'))?.msg.includes('پیدا نشد'));
  C.clear();
  B.clear();
  B.send({ t: 'room:join', code: CODE });
  ok('ورود با کد درست', (await B.wait(m => m.t === 'room:joined'))?.code === CODE);
  ok('میزبان از ورود باخبر شد', (await A.wait(m => m.t === 'room:update'))?.members.length === 2);
  /* نسخهٔ ۱۵: روم تا ۸ بازیکن می‌پذیرد و نفرات بعدی تماشاچی می‌شوند */
  A.clear(); C.clear();
  C.send({ t: 'room:join', code: CODE });
  const cj = await C.wait(m => m.t === 'room:joined');
  ok('روم تا ۸ بازیکن می‌پذیرد', cj?.code === CODE && cj?.max === 8,
     JSON.stringify({ code: cj?.code, max: cj?.max }));
  ok('عضو سوم بازیکن است، نه تماشاچی', cj?.spectator === false);
  ok('میزبان از عضو سوم باخبر شد', (await A.wait(m => m.t === 'room:update'))?.members.length === 3);

  C.send({ t: 'room:leave' });
  await C.wait(m => m.t === 'room:left');
  await sleep(200);

  /* تماشاچی با درخواست صریح */
  A.clear(); C.clear();
  C.send({ t: 'room:spectate', code: CODE });
  const spJoined = await C.wait(m => m.t === 'room:joined');
  ok('👁 ورود با حالت تماشاچی', spJoined?.spectator === true, JSON.stringify(spJoined?.spectator));
  ok('👁 سرور حالت تماشاچی را اعلام می‌کند', !!(await C.wait(m => m.t === 'spectate')));
  ok('👁 میزبان تماشاچی را در فهرست می‌بیند',
     (await A.wait(m => m.t === 'room:update'))?.members.some(m => m.spectator === true));
  A.clear();
  C.send({ t: 'room:game', game: 'dooz', index: 4 });
  await sleep(220);
  ok('🔒 تماشاچی نمی‌تواند حرکت کند', !A.msgs.some(m => m.t === 'game'));
  C.send({ t: 'room:leave' });
  await C.wait(m => m.t === 'room:left');
  await sleep(220);

  /* 4. بازی دوز سمت سرور */
  section('دوز سرور-محور');
  A.clear(); B.clear();
  A.send({ t: 'room:start', game: 'dooz' });
  const st = await A.wait(m => m.t === 'game' && m.phase === 'start');
  ok('بازی شروع شد', !!st);
  ok('طرفین تعیین شدند', st?.state.sides.X === A.id && st?.state.sides.O === B.id);
  ok('حریف هم پیام شروع را گرفت', !!(await B.wait(m => m.t === 'game' && m.phase === 'start')));

  A.clear(); B.clear();
  A.send({ t: 'room:game', game: 'dooz', index: 4 });
  let upd = await B.wait(m => m.t === 'game' && m.phase === 'state');
  ok('حرکت به حریف رسید', upd?.state.board[4] === 'X', JSON.stringify(upd?.state.board));
  ok('نوبت چرخید', upd?.state.turn === 'O');

  /* این سه سنجش «آخرین وضعیت تخته» را می‌بینند، نه وجود پیام تازه —
     چون پیام حرکت قبلی ممکن است با تأخیر برسد و سنجش را دروغ کند. */
  A.clear(); B.clear();
  A.send({ t: 'room:game', game: 'dooz', index: 0 });   // خارج از نوبت
  await sleep(250);
  ok('🔒 حرکت خارج از نوبت نادیده گرفته شد', A.filled() === 1 && A.lastState?.turn === 'O',
     'filled=' + A.filled() + ' turn=' + A.lastState?.turn);

  B.send({ t: 'room:game', game: 'dooz', index: 9 });   // خانه نامعتبر
  await sleep(250);
  ok('🔒 خانه خارج از تخته نادیده گرفته شد', B.filled() === 1, 'filled=' + B.filled());

  A.send({ t: 'room:game', game: 'dooz', index: 4 });   // خانه پرشده
  await sleep(250);
  ok('🔒 خانه پرشده را دوباره نمی‌توان پر کرد', A.filled() === 1, 'filled=' + A.filled());

  B.send({ t: 'room:game', game: 'dooz', index: 0 });
  await sleep(250);
  ok('حرکت مجاز حریف پذیرفته شد', A.filled() === 2 && A.lastState?.board[0] === 'O',
     JSON.stringify(A.lastState?.board));

  // A: 4, سپس 2,5,8 → برد قطری X در 4,8,0? مسیر: X=4,2,6 و O=0,1,3
  const seq = [[2, A], [1, B], [6, A], [3, B], [8, A]];   // X: 4,2,6,8 → قطر 4-8 با 0؟ نه. مسیر برد: 2,4,6 ستون
  // بازنشانی: از اول بازی تازه
  A.clear(); B.clear();
  A.send({ t: 'room:start', game: 'dooz' });
  await A.wait(m => m.t === 'game' && m.phase === 'start');
  await sleep(150);
  const moves = [[0, A], [3, B], [1, A], [4, B], [2, A]];   // X: 0,1,2 → ردیف اول
  for(const [i, who] of moves){ who.send({ t: 'room:game', game: 'dooz', index: i }); await sleep(180); }
  const fin = await A.wait(m => m.t === 'game' && m.state?.over);
  ok('پایان بازی اعلام شد', fin?.state.over === true);
  ok('برنده درست تشخیص داده شد', fin?.state.winner === 'X', 'winner=' + fin?.state.winner);
  ok('حرکت آخر مشخص است', fin?.state.last === 2);
  A.clear();
  A.send({ t: 'room:game', game: 'dooz', index: 5 });
  await sleep(250);
  ok('🔒 بعد از پایان، حرکتی پذیرفته نمی‌شود', !A.msgs.some(m => m.t === 'game'));

  /* 5. جداکردن چت */
  section('چت');
  A.clear(); B.clear(); C.clear();
  A.send({ t: 'chat', text: 'سلام به روم' });
  ok('چت روم به هم‌رومی می‌رسد', (await B.wait(m => m.t === 'chat' && m.text === 'سلام به روم'))?.name === 'آرش');
  ok('🔒 بیرون‌رومی چت روم را نمی‌بیند', !C.msgs.some(m => m.t === 'chat' && m.text === 'سلام به روم'));
  A.clear(); B.clear(); C.clear();
  C.send({ t: 'chat', text: 'سلام لابی' });
  ok('چت لابی به آدم‌های لابی می‌رسد', !!(await C.wait(m => m.t === 'chat' && m.text === 'سلام لابی')));
  await sleep(250);
  ok('🔒 چت لابی به داخل روم نشت نمی‌کند', !A.msgs.some(m => m.t === 'chat' && m.text === 'سلام لابی') && !B.msgs.some(m => m.t === 'chat' && m.text === 'سلام لابی'));

  /* 6. لیدربورد */
  section('لیدربورد');
  A.clear();
  A.send({ t: 'lb:put', name: 'آرش', score: 4200 });
  B.send({ t: 'lb:put', name: 'سارا', score: 9100 });
  const lb = await A.wait(m => m.t === 'lb' && m.list?.some(x => x.name === 'سارا'));
  ok('رکوردها ذخیره شدند', lb.list.find(x => x.name === 'سارا')?.score === 9100);
  ok('مرتب‌سازی نزولی', lb.list[0].name === 'سارا');
  const lbHttp = await fetch(`http://127.0.0.1:${PORT}/api/leaderboard`,
    { headers: { Authorization: 'Bearer ' + vOkJ.token } }).then(r => r.json());
  ok('لیدربورد از HTTP هم خوانده می‌شود', lbHttp[0].score === 9100);

  /* 7. اعلان مدیریتی — با *نشانهٔ نشست*، نه با هش.
     پیش‌تر کلاینت هشِ رمز را می‌فرستاد؛ یعنی هش بدلِ رمز شده بود و هر که
     می‌دیدش مدیر می‌شد. حالا سرور نشانه می‌دهد و همان را می‌سنجد. */
  section('اعلان مدیریتی');
  C.clear(); A.clear();
  C.send({ t: 'admin:broadcast', hash: HASH, title: 'هک', desc: 'تلاش غیرمجاز' });
  await sleep(250);
  ok('🔒 هش — حتی هشِ درست — دیگر دروازه را باز نمی‌کند',
     !A.msgs.some(m => m.t === 'notif'));

  C.clear(); A.clear();
  C.send({ t: 'admin:broadcast', token: 'deadbeef', title: 'هک', desc: 'تلاش غیرمجاز' });
  await sleep(250);
  ok('🔒 نشانهٔ بی‌شکل رد می‌شود', !A.msgs.some(m => m.t === 'notif'));

  const zeros = '0'.repeat(64);
  C.clear(); A.clear();
  C.send({ t: 'admin:broadcast', token: zeros, title: 'خالی', desc: 'تلاش' });
  await sleep(250);
  ok('🔒 نشانهٔ ۶۴ رقمیِ ساختگی هم رد می‌شود', !A.msgs.some(m => m.t === 'notif'));

  /* ورودِ درست */
  const login = await fetch(`http://127.0.0.1:${PORT}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pass: PASS })
  }).then(r => r.json());
  ok('ورودِ مدیر نشانه می‌دهد', login.success === true && /^[0-9a-f]{64}$/.test(login.token || ''),
     JSON.stringify(login).slice(0, 120));
  ok('و نشانه، رمز نیست', login.token !== PASS && login.token !== HASH);
  const token = login.token;
  const ADM = new Client('ADM'); await ADM.connect();
  ADM.id = (await ADM.wait(m => m.t === 'welcome')).id;
  ADM.clear();
  ADM.send({ t: 'hello', adminToken: token });
  ok('اتصالِ مدیر با نشانه احراز می‌شود',
     (await ADM.wait(m => m.t === 'authenticated'))?.role === 'admin');

  ADM.clear(); A.clear(); B.clear();
  ADM.send({ t: 'admin:broadcast', token, title: 'خبر مهم', desc: 'مسابقه امشب' });
  ok('اعلان با نشانهٔ درست پخش شد', (await A.wait(m => m.t === 'notif' && m.title === 'خبر مهم'))?.desc === 'مسابقه امشب');
  ok('اعلان به همه رسید', !!(await B.wait(m => m.t === 'notif' && m.title === 'خبر مهم')));

  /* رمزِ اشتباه نشانه نمی‌دهد، و پاسخش با رمزِ درست یکی نیست */
  const badLogin = await fetch(`http://127.0.0.1:${PORT}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pass: 'not-the-pass' })
  });
  ok('🔒 رمزِ اشتباه نشانه نمی‌گیرد', badLogin.status === 401);

  const who = await fetch(`http://127.0.0.1:${PORT}/api/admin/whoami`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  }).then(r => r.json());
  ok('نشانه با whoami تأیید می‌شود', who.success === true && who.admin === true);

  /* باطل‌کردن: نشانه نباید بعد از خروج کار کند */
  C.clear(); A.clear();
  await fetch(`http://127.0.0.1:${PORT}/api/admin/logout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  const who2 = await fetch(`http://127.0.0.1:${PORT}/api/admin/whoami`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  }).then(r => r.json());
  ok('🔒 نشانهٔ باطل‌شده دیگر معتبر نیست', who2.admin === false);

  /* اتصالِ *تازه* با نشانهٔ باطل‌شده: سرور باید از نو بسنجد، نه اینکه
     به وضعیتِ اتصالِ قبلی تکیه کند. */
  const ADMdead = new Client('ADMdead'); await ADMdead.connect();
  ADMdead.id = (await ADMdead.wait(m => m.t === 'welcome')).id;
  ADMdead.clear();
  ADMdead.send({ t: 'hello', adminToken: token });
  ok('🔒 اتصالِ تازه با نشانهٔ باطل‌شده احراز نمی‌شود',
     !!(await ADMdead.wait(m => m.t === 'auth:error')));
  ADMdead.send({ t: 'admin:broadcast', token, title: 'دوباره', desc: 'بعد از خروج' });
  await sleep(250);
  ok('🔒 نشانهٔ باطل‌شده دوباره راه نمی‌دهد',
     !A.msgs.some(m => m.t === 'notif' && m.title === 'دوباره'));

  /* ── دفترِ کاربران ──
     کاربر با شماره‌اش شناخته می‌شود، و سرور تنها مرجعی است که این نگاشت را
     دارد: شناسه از کلاینت می‌آید ولی تا وقتی پیامک تأیید نشود به شماره
     بسته نمی‌شود. */
  section('دفترِ کاربران — فهرست، مسدود، حذف');
  const admin2fast = await fetch(`http://127.0.0.1:${PORT}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pass: PASS })
  });
  ok('🔒 پس از رمزِ اشتباه، ورودِ فوریِ دوباره محدود می‌شود', admin2fast.status === 429, admin2fast.status);
  await sleep(1300);
  const admin2 = await fetch(`http://127.0.0.1:${PORT}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pass: PASS })
  }).then(r => r.json());
  ok('پس از پایانِ مهلت، ورودِ درستِ دوباره موفق است', admin2.success === true);
  const token2 = admin2.token;
  const ADM2 = new Client('ADM2'); await ADM2.connect();
  ADM2.id = (await ADM2.wait(m => m.t === 'welcome')).id;
  ADM2.clear();
  ADM2.send({ t: 'hello', adminToken: token2 });
  ok('اتصالِ دومِ مدیر هم احراز می‌شود',
     (await ADM2.wait(m => m.t === 'authenticated'))?.role === 'admin');

  const U1 = new Client('U1'); await U1.connect();
  U1.id = (await U1.wait(m => m.t === 'welcome')).id;
  U1.clear();
  U1.send({ t: 'hello', ns: 'noorestan', name: 'زهرا', level: 2, score: 40,
            userId: vOkJ.id, userToken: vOkJ.token });
  ok('کاربر با نشانهٔ تأییدشده وارد می‌شود', !!(await U1.wait(m => m.t === 'peers')));

  ADM2.clear();
  ADM2.send({ t: 'admin:users', token: token2 });
  const ul = await ADM2.wait(m => m.t === 'admin:users');
  const row1 = (ul.list || []).find(u => u.id === vOkJ.id);
  ok('فهرستِ کاربران به مدیر می‌رسد', !!ul && Array.isArray(ul.list), JSON.stringify(ul).slice(0, 80));
  ok('و کاربرِ واردشده در آن هست', !!row1, JSON.stringify((ul.list || []).map(u => u.id)));
  ok('با شماره‌اش', row1 && row1.phone === '09121110001', row1 && row1.phone);
  ok('و آنلاین شمرده می‌شود', row1 && row1.online === true);
  ok('🔒 و هیچ نشانه‌ای در فهرست نیست',
     !JSON.stringify(ul).includes(vOkJ.token) && !/token/.test(JSON.stringify(ul)),
     JSON.stringify(ul).slice(0, 160));

  /* غیرمدیر فهرست را نمی‌گیرد */
  U1.clear();
  U1.send({ t: 'admin:users' });
  await sleep(250);
  ok('🔒 کاربرِ عادی فهرستِ کاربران را نمی‌گیرد',
     !U1.msgs.some(m => m.t === 'admin:users'));

  /* هش روی اتصالی که *هرگز* مدیر نشده (اتصالِ مدیر، ADM2 است و U1
     کاربرِ عادی) — نه فهرست می‌دهد نه کنشی انجام می‌شود. */
  U1.clear();
  U1.send({ t: 'admin:users', hash: HASH });
  await sleep(250);
  ok('🔒 هشِ درست روی اتصالِ غیرمدیر هم دروازه را باز نمی‌کند',
     !U1.msgs.some(m => m.t === 'admin:users'));
  U1.clear();
  U1.send({ t: 'admin:user:delete', hash: HASH, id: vOkJ.id });
  await sleep(250);
  ADM2.clear(); ADM2.send({ t: 'admin:users', token: token2 });
  ok('🔒 و هیچ کنشی هم با هش انجام نمی‌شود',
     ((await ADM2.wait(m => m.t === 'admin:users')).list || []).some(u => u.id === vOkJ.id));

  /* ── مسدودکردن ── */
  U1.clear(); ADM2.clear();
  ADM2.send({ t: 'admin:user:block', token: token2, id: vOkJ.id });
  const kick = await U1.wait(m => m.t === 'notif', 3000);
  ok('کاربرِ آنلاین بی‌درنگ بیرون می‌رود', !!kick && /مسدود/.test(kick.desc || ''), JSON.stringify(kick));
  const ul2 = await ADM2.wait(m => m.t === 'admin:users');
  const row2 = (ul2.list || []).find(u => u.id === vOkJ.id);
  ok('و در فهرست مسدود علامت می‌خورد', row2 && row2.blocked === true);
  ok('و آفلاین می‌شود', row2 && row2.online === false);

  /* کاربرِ مسدود، با همان نشانهٔ معتبر هم راه نمی‌یابد */
  const U2 = new Client('U2'); await U2.connect();
  U2.id = (await U2.wait(m => m.t === 'welcome')).id;
  U2.clear();
  U2.send({ t: 'hello', ns: 'noorestan', name: 'زهرا', userId: vOkJ.id, userToken: vOkJ.token });
  const kick2 = await U2.wait(m => m.t === 'notif', 3000);
  ok('🔒 کاربرِ مسدود با نشانهٔ معتبر هم رد می‌شود', !!kick2 && /بسته/.test(kick2.title || ''),
     JSON.stringify(kick2));

  /* آزادکردن دوباره راه می‌دهد */
  ADM2.clear();
  ADM2.send({ t: 'admin:user:unblock', token: token2, id: vOkJ.id });
  ok('آزادکردن در فهرست دیده می‌شود',
     ((await ADM2.wait(m => m.t === 'admin:users')).list || []).find(u => u.id === vOkJ.id)?.blocked === false);
  const U3 = new Client('U3'); await U3.connect();
  U3.id = (await U3.wait(m => m.t === 'welcome')).id;
  U3.clear();
  U3.send({ t: 'hello', ns: 'noorestan', name: 'زهرا', userId: vOkJ.id, userToken: vOkJ.token });
  ok('پس از آزادکردن، همان نشانه دوباره راه می‌دهد',
     !!(await U3.wait(m => m.t === 'peers')) && !U3.msgs.some(m => m.t === 'notif' && /بسته/.test(m.title)));

  /* ── پیامکِ مدیریتی ── */
  smsHits = [];
  ADM2.clear();
  ADM2.send({ t: 'admin:user:sms', token: token2, id: vOkJ.id, text: 'خوش آمدی' });
  const smsRes = await ADM2.wait(m => m.t === 'admin:user:sms', 3000);
  ok('نتیجهٔ پیامکِ مدیریتی به مدیر می‌رسد', !!smsRes && smsRes.state === 'sent', JSON.stringify(smsRes));
  ok('و پیامک واقعاً به همان شماره رفت', smsHits.length === 1 &&
     JSON.parse(smsHits[0].body).recipients[0] === '09121110001');
  ok('با متنِ مدیر در آن', JSON.parse(smsHits[0].body).message.includes('خوش آمدی'));
  ADM2.clear();
  ADM2.send({ t: 'admin:user:sms', token: token2, id: vOkJ.id, text: '' });
  ok('متنِ خالی فرستاده نمی‌شود', (await ADM2.wait(m => m.t === 'admin:user:err'))?.msg.includes('خالی'));
  ok('و هیچ پیامکِ تازه‌ای نرفت', smsHits.length === 1, 'hits=' + smsHits.length);

  /* ── حذف ── */
  ADM2.clear();
  ADM2.send({ t: 'admin:user:delete', token: token2, id: vOkJ.id });
  const ul3 = await ADM2.wait(m => m.t === 'admin:users');
  ok('کاربرِ حذف‌شده از فهرست می‌رود',
     !(ul3.list || []).some(u => u.id === vOkJ.id), JSON.stringify(ul3.list));
  const U4 = new Client('U4'); await U4.connect();
  U4.id = (await U4.wait(m => m.t === 'welcome')).id;
  U4.clear();
  U4.send({ t: 'hello', ns: 'noorestan', name: 'زهرا', userId: vOkJ.id, userToken: vOkJ.token });
  ok('🔒 نشانهٔ کاربرِ حذف‌شده بی‌ارزش است',
     !!(await U4.wait(m => m.t === 'auth:error')) && !U4.msgs.some(m => m.t === 'peers'));
  ok('و شناسهٔ او دیگر کسی را به کاربرِ ثبت‌شده وصل نمی‌کند', (() => {
    const src = require('fs').readFileSync(__dirname + '/server.js', 'utf8');
    return /userTokens\.delete\(tok\)/.test(src) && /userById\.delete\(rec\.id\)/.test(src);
  })());
  for(const cl of [U1, U2, U3, U4]){ try{ cl.ws && cl.ws.close(); }catch(e){} }

  /* ── رمز مدیر: نه پیش‌فرض، نه در لاگ ──
     پیش‌تر مقدار جانشین «noor2024» بود و همان را در بنر هم چاپ می‌کرد؛ یعنی
     رمزِ مدیر در مخزن عمومی منتشر می‌شد. */
  section('رمز مدیر — نه پیش‌فرض، نه در لاگ');
  ok('🔒 رمز در بنر سرور چاپ نمی‌شود', !srvOut.includes(PASS), srvOut.split('\n').filter(l => /رمز/.test(l)).join(' ／ '));
  ok('بنر می‌گوید رمز از کجاست', /NOOR_ADMIN_PASS/.test(srvOut));

  /* سرور دوم، عمداً بی NOOR_ADMIN_PASS: باید بالا بیاید ولی پنل مدیرش بسته باشد */
  {
    const PORT2 = PORT + 1, DATA2 = path.join(__dirname, `_srvtest-noadmin.json`);
    const s2 = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      env: { ...process.env, PORT: String(PORT2), NOOR_DATA: DATA2, NOOR_ORIGIN: '*' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out2 = '';
    s2.stdout.on('data', d => { out2 += d.toString(); });
    s2.stderr.on('data', d => { out2 += d.toString(); });
    try{
      let up2 = false;
      for(let i = 0; i < 40 && !up2; i++){
        if(s2.exitCode !== null) break;
        up2 = await fetch(`http://127.0.0.1:${PORT2}/health`).then(r => r.ok).catch(() => false);
        if(!up2) await sleep(200);
      }
      ok('بی NOOR_ADMIN_PASS هم سرور بالا می‌آید (پنل می‌خوابد، سرور نه)', up2);
      ok('🔒 بنر هشدار می‌دهد که رمز تنظیم نشده', /تنظیم نشده/.test(out2), out2.split('\n').filter(l => /رمز/.test(l)).join(' ／ '));
      /* فقط همین یک خط می‌تواند نام رمز را داشته باشد؛ باید «تنظیم نشده» بگوید و
         هیچ توکنی چاپ نکند. NOOR_ADMIN_PASS نامِ متغیر است، نه رمز. */
      const adminLine = out2.split('\n').find(l => /رمز مدیر سرور/.test(l)) || '';
      ok('🔒 و هیچ رمزی چاپ نمی‌شود',
         /تنظیم نشده/.test(adminLine) && !/[A-Za-z0-9]{6,}/.test(adminLine.replace(/NOOR_ADMIN_PASS/g, '')),
         adminLine);

      /* با سوکت واقعی: هیچ هشی — نه خالی نه حدسی — مدیر نمی‌شود */
      const probe = await new Promise(resolve => {
        const ws = new WebSocket(`ws://127.0.0.1:${PORT2}`);
        const seen = [];
        const t0 = Date.now();
        ws.onopen = () => {
          ws.send(JSON.stringify({ t: 'hello', ns: 'noorestan', name: 'کاوشگر', level: 1, score: 0 }));
        };
        ws.onmessage = e => {
          let m = null; try{ m = JSON.parse(e.data); }catch(_){}
          if(m && m.t === 'welcome') ws.send(JSON.stringify({ t: 'admin:broadcast', hash: '', title: 'خالی', desc: 'x' }));
          if(m && m.t === 'notif') seen.push(m);
          if(Date.now() - t0 > 1500){ try{ ws.close(); }catch(_){} resolve(seen); }
        };
        ws.onerror = () => resolve(seen);
        setTimeout(() => { try{ ws.close(); }catch(_){} resolve(seen); }, 2500);
      });
      ok('🔒 بی رمزِ سرور، هشِ خالی اعلان پخش نمی‌کند', probe.length === 0, JSON.stringify(probe));
    }finally{
      try{ s2.kill('SIGKILL'); }catch(e){}
      try{ require('fs').unlinkSync(DATA2); }catch(e){}
    }
  }

  /* ── NOOR_DEBUG_SMS: بدنهٔ خام در لاگ می‌نشیند، ولی هرگز با کلید ──
     این خطِ تازه‌ای است که *خودمان* به لاگ اضافه کردیم، پس باید سنجیده شود:
     اگر textbee کلید را در پاسخش بازگو کند، صافی باید بگیردش. سرورِ جدا
     لازم است چون این متغیر هنگامِ راه‌اندازی خوانده می‌شود. */
  section('🔍 عیب‌یابیِ پیامک — خام در لاگ، بی کلید');
  {
    /* ۸۸۰۱ دهانهٔ textbee جعلی است و ۸۸۰۰ سرورِ دوم؛ این یکی جای خالی می‌خواهد */
    const PORT3 = PORT + 5, DATA3 = path.join(__dirname, `_srvtest-debug.json`);
    const s3 = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      env: { ...process.env, PORT: String(PORT3), NOOR_DATA: DATA3, NOOR_ORIGIN: '*',
             NOOR_ADMIN_PASS: PASS,
             NOOR_SMS_KEY: SMS_KEY, NOOR_SMS_DEVICE: SMS_DEVICE,
             NOOR_SMS_ENDPOINT: `http://127.0.0.1:${FAKE_PORT}/api/v1/gateway/send-sms`,
             NOOR_SMS_MAX_IP: '2000', NOOR_SMS_MAX_HOUR: '5000',
             NOOR_DEBUG_SMS: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out3 = '';
    s3.stdout.on('data', d => { out3 += d.toString(); });
    s3.stderr.on('data', d => { out3 += d.toString(); });
    try{
      let up3 = false;
      for(let i = 0; i < 40 && !up3; i++){
        if(s3.exitCode !== null) break;
        up3 = await fetch(`http://127.0.0.1:${PORT3}/health`).then(r => r.ok).catch(() => false);
        if(!up3) await sleep(200);
      }
      ok('سرورِ عیب‌یابی بالا می‌آید', up3);
      smsMode = 'echo'; smsHits = [];
      const rd = await fetch(`http://127.0.0.1:${PORT3}/api/otp/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '09121140001' })
      });
      smsMode = 'ok';
      await rd.text();
      let dbg = '';
      for(let i = 0; i < 40 && !dbg; i++){
        dbg = out3.split('\n').find(l => l.includes('textbee خام')) || '';
        if(!dbg) await sleep(50);
      }
      ok('بدنهٔ خام در لاگ ثبت می‌شود', !!dbg, out3.split('\n').slice(-4).join(' ／ '));
      ok('🔒 ولی کلید در آن لاگ نیست', !out3.includes(SMS_KEY));
      ok('🔒 و نشانهٔ جانشین جایش نشسته', /«کلید»/.test(dbg), dbg.slice(0, 160));
    }finally{
      try{ s3.kill('SIGKILL'); }catch(e){}
      try{ require('fs').unlinkSync(DATA3); }catch(e){}
    }
  }

  /* 8. خروج و پاکسازی */
  section('خروج و پاکسازی');
  B.clear(); A.clear();
  B.send({ t: 'room:leave' });
  ok('خروج اطلاع داده شد', !!(await B.wait(m => m.t === 'room:left')));
  ok('میزبان از کاهش اعضا باخبر شد', (await A.wait(m => m.t === 'room:update'))?.members.length === 1);
  A.clear();
  A.send({ t: 'room:create', name: 'روم جدید', game: 'esmfamil' });     // هنوز در روم قبلی است
  ok('🔒 ساخت روم دوم بدون خروج رد می‌شود', (await A.wait(m => m.t === 'room:error'))?.msg.includes('خارج شو'));
  A.clear();
  A.send({ t: 'room:leave' });                                          // رفتار کلاینت: اول خروج، بعد ساخت
  A.send({ t: 'room:create', name: 'روم جدید', game: 'esmfamil' });
  ok('میزبان بعد از خروج می‌تواند روم جدید بسازد', /^\d{6}$/.test((await A.wait(m => m.t === 'room:joined'))?.code || ''));
  A.send({ t: 'room:leave' });
  await sleep(300);
  const roomsHttp = await fetch(`http://127.0.0.1:${PORT}/api/rooms`,
    { headers: { Authorization: 'Bearer ' + vAj.token } }).then(r => r.json());
  ok('روم خالی از سرور پاک شد', roomsHttp.rooms.length === 0, JSON.stringify(roomsHttp.rooms));

  /* 9. اسم فامیل آنلاین */
  section('اسم فامیل آنلاین');
  A.clear(); B.clear();
  A.send({ t: 'room:create', name: 'اسم فامیل', game: 'esmfamil' });
  const c2 = (await A.wait(m => m.t === 'room:joined')).code;
  B.send({ t: 'room:join', code: c2 });
  await sleep(300);
  A.clear();
  A.send({ t: 'room:start', game: 'esmfamil' });
  const r1 = await A.wait(m => m.t === 'game' && m.phase === 'round');
  ok('دور اول شروع شد', r1?.round === 1 && r1?.total === 3 && typeof r1.letter === 'string');
  B.clear();
  B.send({ t: 'room:game', game: 'esmfamil', answers: { city: 'تهران' }, score: 25 });
  ok('انتظار برای بازیکن دوم', (await A.wait(m => m.t === 'game' && m.phase === 'waiting'))?.got === 1);
  A.clear();
  A.send({ t: 'room:game', game: 'esmfamil', answers: { city: 'تبریز' }, score: 22 });
  const res = await A.wait(m => m.t === 'game' && m.phase === 'results');
  ok('نتایج برای همه پخش شد', res?.results?.length === 2);
  ok('🔒 بازیکن غیرمیزبان نمی‌تواند دور بعد را شروع کند', (() => {
    B.send({ t: 'room:game', game: 'esmfamil', phase: 'next' });
    return true;
  })());
  await sleep(300);
  ok('دور هنوز ۱ است', !B.msgs.some(m => m.t === 'game' && m.phase === 'round' && m.round === 2));
  A.clear();
  A.send({ t: 'room:game', game: 'esmfamil', phase: 'next' });
  ok('میزبان دور دوم را شروع کرد', (await A.wait(m => m.t === 'game' && m.phase === 'round'))?.round === 2);

  /* 10. محدودیت‌ها */
  section('محدودیت‌ها و امنیت');
  const D = new Client('D'); await D.connect();
  D.id = (await D.wait(m => m.t === 'welcome')).id;
  D.clear();
  /* با نشانهٔ معتبر (همان کاربرِ ماندگار، اتصالِ دوم) — وگرنه hello به
     auth:error می‌رسد و peers هرگز نمی‌آید. */
  D.send({ t: 'hello', name: 'x'.repeat(500), level: 99999, score: -50, userToken: vAj.token });
  await sleep(300);
  const dl = (await D.wait(m => m.t === 'peers'))?.list.find(p => p.id === D.id);
  ok('نام بلند بریده می‌شود', (dl?.name || '').length <= 20, 'len=' + (dl?.name || '').length);
  ok('سطح نامعتبر اصلاح می‌شود', dl?.level <= 999, 'level=' + dl?.level);
  ok('امتیاز منفی صفر می‌شود', dl?.score === 0, 'score=' + dl?.score);

  const E = new Client('E'); await E.connect();
  E.id = (await E.wait(m => m.t === 'welcome')).id;
  E.clear();
  E.send({ t: 'hello', name: 'E', userToken: vAj.token });
  await sleep(200);
  E.clear();
  for(let i = 0; i < 60; i++) E.send({ t: 'hb' });
  await sleep(400);
  ok('🔒 محدودیت نرخ فعال است', E.msgs.some(m => m.t === 'room:error' && m.msg.includes('سرعت')), JSON.stringify(E.msgs.slice(0, 3)));

  const F = new Client('F'); await F.connect();
  F.ws.send('این JSON نیست');
  await sleep(200);
  ok('ورودی نامعتبر سرور را نمی‌کشد', (await fetch(`http://127.0.0.1:${PORT}/health`).then(r => r.json())).ok === true);

  /* 11. وابستگی صفر */
  section('استقلال');
  const src = require('fs').readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  ok('هیچ require خارجی‌ای ندارد', !/require\(['"][^'"]*(ws|socket\.io|express)['"]\)/.test(src));
  ok('هیچ node_modules لازم نیست', !require('fs').existsSync(path.join(__dirname, 'node_modules')));

  await sleep(200);
  if(FAILED && process.env.NOOR_TEST_LOG) console.log('\n── log سرور ──\n' + srvOut);
  console.log(`\n── نتیجه ──\n  ${PASSED} تست موفق، ${FAILED} ناموفق`);
  cleanup();
  process.exit(FAILED ? 1 : 0);
})().catch(e => { console.error('💥', e); cleanup(); process.exit(1); });
