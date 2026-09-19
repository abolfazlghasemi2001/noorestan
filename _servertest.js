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
     noid     → ۲۰۰ با بدنهٔ خالی JSON: نه نشانهٔ موفقیت، نه شکست ⇒ نامعلوم
     html     → ۲۰۰ با بدنهٔ HTML (پروکسی راه را عوض کرده) ⇒ نامعلوم
     500      → خطای موقت سرور ⇒ نامعلوم
     slow     → هرگز پاسخ نمی‌دهد ⇒ مسیر «تمام شدن وقت»
     echo     → پاسخش کلید را بازگو می‌کند ⇒ باید از گزارش سرور بیرون بماند */
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
    NOOR_SMS_TIMEOUT: '700'
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
  ok('ظرفیت روم ۸ بازیکن + تماشاچی اعلام می‌شود', health?.spectators === 0 && (await fetch(`http://127.0.0.1:${PORT}/api/rooms`).then(r => r.json())).maxPlayers === 8);
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
  const OTP_BODY = '🌟 نورستان\n🔐 کد تأیید ثبت‌نام شما: 12345\n⏱ اعتبار: ۲ دقیقه\n⚠️ این کد را با کسی به اشتراک نگذارید.';

  const stTxt  = await fetch(API + '/status').then(r => r.text());
  const stJson = JSON.parse(stTxt);
  ok('وضعیت: کلید سرور دیده می‌شود', stJson.configured === true && stJson.on === true, stTxt);
  ok('🔒 وضعیت، شناسهٔ دستگاه را ماسک می‌کند', stJson.device === '…' + SMS_DEVICE.slice(-4) && !stTxt.includes(SMS_DEVICE), stJson.device);
  ok('🔒 کلید در پاسخ وضعیت نیست', !stTxt.includes(SMS_KEY));

  /* ارسال کد — قرارداد کامل درخواست */
  smsHits = [];
  const os1 = await post('/send', { phone: '09121110001', code: '12345' });
  const t1 = await os1.text();
  ok('ارسال کد ⇒ ۲۰۰', os1.status === 200, os1.status + ' ' + t1);
  /* قرارداد پاسخ عوض شده: حالا state و شناسهٔ پیام هم می‌آید. شناسه امن است؛
     چیزی که نباید بیاید، کلید است (سنجش بعدی). */
  ok('پاسخ فقط سه کلید دارد', JSON.stringify(Object.keys(JSON.parse(t1)).sort()) === '["id","state","success"]', t1);
  ok('پاسخ موفق، state=sent دارد', JSON.parse(t1).state === 'sent', t1);
  ok('شناسهٔ پیام به کاربر می‌رسد', JSON.parse(t1).id === 'abc123', t1);
  ok('🔒 کلید در پاسخ نیست', !t1.includes(SMS_KEY));
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
  ok('متن مو‌به‌مو همان قالب کلاینت است', f1.message === OTP_BODY, JSON.stringify(f1.message));
  ok('🔒 کلید در بدنه نیست', !h1.body.includes(SMS_KEY));

  /* تست اتصال */
  smsHits = [];
  const os2 = await post('/send', { phone: '09121110001', test: true });
  ok('🧪 تست ارسال ⇒ ۲۰۰', os2.status === 200);
  const f2 = JSON.parse(smsHits[0].body);
  ok('🧪 متن آزمایشی، کد ندارد', !/\d{5}/.test(f2.message) && f2.message.includes('آزمایش'), JSON.stringify(f2.message));
  ok('🧪 شمارهٔ آزمایشی نرمال‌سازی می‌شود', f2.recipients[0] === '09121110001');

  /* 🔒 دروازهٔ باز نمی‌شود: متن دلخواه کاربر هرگز فرستاده نمی‌شود */
  smsHits = [];
  const evil = await post('/send', { phone: '09121110002', code: '99999', message: 'متن دلخواه مهاجم' });
  ok('بدنهٔ اضافی نادیده گرفته می‌شود', evil.status === 200 && smsHits.length === 1);
  ok('🔒 متن دلخواه هرگز ارسال نمی‌شود', !smsHits[0].body.includes('مهاجم'), smsHits[0].body.slice(0, 120));
  ok('متن همان قالب ثابت است', JSON.parse(smsHits[0].body).message === OTP_BODY.replace('12345', '99999'));

  /* ورودی بد */
  const bads = [
    ['شمارهٔ نامعتبر',        { phone: '0212345678', code: '12345' }],
    ['بدون شماره',            { code: '12345' }],
    ['کد چهاررقمی',           { phone: '09121110003', code: '1234' }],
    ['بدون کد',               { phone: '09121110003' }],
    ['کد شش‌رقمی',            { phone: '09121110003', code: '123456' }]
  ];
  for(const [name, b] of bads){
    const r = await post('/send', b);
    ok('🔒 ' + name + ' ⇒ 400', r.status === 400, r.status);
  }
  const gf = await fetch(API + '/send').then(r => r.status).catch(() => 0);
  ok('🔒 GET روی /send ⇒ 405', gf === 405, gf);

  /* رقم فارسی در بدنه */
  smsHits = [];
  const fa = await post('/send', { phone: '۰۹۱۲۱۱۱۰۰۰۴', code: '۵۴۳۲۱' });
  ok('رقم فارسی پذیرفته و لاتین می‌شود', fa.status === 200 && JSON.parse(smsHits[0].body).recipients[0] === '09121110004');
  ok('کد فارسی هم درست منتقل می‌شود', JSON.parse(smsHits[0].body).message.includes('54321'));

  /* محدودیت نرخ: ۳ پیامک به یک شماره، چهارمی رد */
  const RP = '09121119999';
  const codes = [];
  for(let i = 0; i < 3; i++) codes.push((await post('/send', { phone: RP, code: '1111' + i })).status);
  const os4 = await post('/send', { phone: RP, code: '11113' });
  ok('سه پیامک اول قبول شد', codes.every(s => s === 200), JSON.stringify(codes));
  ok('🔒 پیامک چهارم به همان شماره ⇒ 429', os4.status === 429, os4.status);
  const j4 = await os4.json();
  ok('علت به کاربر گفته می‌شود', typeof j4.error === 'string' && j4.error.length > 5 && j4.success === false, JSON.stringify(j4));

  /* ── سه حالت پاسخ، نه دو حالت ──
     تنها تفاوتِ «نامعلوم» با «نشد» این است که کاربر را از صفحهٔ کد بیرون
     نمی‌کنیم؛ چون پیامک ممکن است رسیده باشد. پس کدِ HTTP باید فرق کند:
     ۲۰۲ برای نامعلوم، ۵۰۲ برای قطعاً نشد. */
  section('پیامک — «نامعلوم» از «نشد» جدا می‌شود');
  const SHAPES = [
    /* شرح                       حالت جعلی   کد HTTP   state      خطا باید باشد؟ */
    ['خطای مستند Invalid API key', 'fail',   502, 'failed',  'Invalid API key'],
    ['۲۰۰ با بدنهٔ خالی',          'noid',   202, 'pending', null],
    ['۲۰۰ با بدنهٔ HTML',          'html',   202, 'pending', null],
    ['۵۰۳ بی بدنه',                '503',    202, 'pending', null],
    ['مهلت تمام‌شده',              'slow',   202, 'pending', null]
  ];
  let phoneSeed = 400;
  for(const [name, mode, wantHttp, wantState, wantErr] of SHAPES){
    smsMode = mode; smsHits = [];
    const r = await post('/send', { phone: '091211' + (10000 + phoneSeed++), code: '54321' });
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

  /* 🔒 اگر سرویس بیرونی کلید را در متن خطا بازگو کند، نباید به کاربر برسد */
  smsMode = 'echo'; smsHits = [];
  const re = await post('/send', { phone: '09121130001', code: '54321' });
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
  A.send({ t: 'hello', name: 'آرش', level: 4, score: 300 });
  B.send({ t: 'hello', name: 'سارا', level: 2, score: 120 });
  C.send({ t: 'hello', name: 'رضا', level: 1, score: 10 });
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
  const lbHttp = await fetch(`http://127.0.0.1:${PORT}/api/leaderboard`).then(r => r.json());
  ok('لیدربورد از HTTP هم خوانده می‌شود', lbHttp[0].score === 9100);

  /* 7. اعلان مدیریتی */
  section('اعلان مدیریتی');
  C.clear(); A.clear();
  C.send({ t: 'admin:broadcast', hash: 'deadbeef', title: 'هک', desc: 'تلاش غیرمجاز' });
  await sleep(250);
  ok('🔒 هش اشتباه رد شد', !A.msgs.some(m => m.t === 'notif'));
  ok('خطا به فرستنده اطلاع داده شد', C.msgs.some(m => m.t === 'room:error'));

  /* هشِ خالی نباید با هشِ خالیِ سرور تطبیق داده شود. اگر دروازه صریحاً بسته
     نباشد، کلاینتی که hash:'' می‌فرستد مدیر می‌شود. */
  C.clear(); A.clear();
  C.send({ t: 'admin:broadcast', hash: '', title: 'خالی', desc: 'تلاش' });
  await sleep(250);
  ok('🔒 هشِ خالی هم رد می‌شود', !A.msgs.some(m => m.t === 'notif'));
  C.clear(); A.clear();

  C.clear(); A.clear(); B.clear();
  C.send({ t: 'admin:broadcast', hash: HASH, title: 'خبر مهم', desc: 'مسابقه امشب' });
  ok('اعلان با هش درست پخش شد', (await A.wait(m => m.t === 'notif' && m.title === 'خبر مهم'))?.desc === 'مسابقه امشب');
  ok('اعلان به همه رسید', !!(await B.wait(m => m.t === 'notif' && m.title === 'خبر مهم')));

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
  const roomsHttp = await fetch(`http://127.0.0.1:${PORT}/api/rooms`).then(r => r.json());
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
  D.send({ t: 'hello', name: 'x'.repeat(500), level: 99999, score: -50 });
  await sleep(300);
  const dl = (await D.wait(m => m.t === 'peers'))?.list.find(p => p.id === D.id);
  ok('نام بلند بریده می‌شود', (dl?.name || '').length <= 20, 'len=' + (dl?.name || '').length);
  ok('سطح نامعتبر اصلاح می‌شود', dl?.level <= 999, 'level=' + dl?.level);
  ok('امتیاز منفی صفر می‌شود', dl?.score === 0, 'score=' + dl?.score);

  const E = new Client('E'); await E.connect();
  E.id = (await E.wait(m => m.t === 'welcome')).id;
  E.clear();
  E.send({ t: 'hello', name: 'E' });
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
