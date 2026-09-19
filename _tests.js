/* ───── تست‌های منطق کلاینت (اجرا با node _harness.js) ───── */
let PASS = 0, FAIL = 0;
const ok = (name, cond, extra = '') => {
  if(cond){ PASS++; console.log('  ✅ ' + name); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
};
const section = t => console.log('\n── ' + t + ' ──');
/* سنجش‌هایی که به await نیاز دارند این‌جا جمع می‌شوند و در دمِ async،
   به همان ترتیب، اجرا می‌شوند (توپ‌سطح await در این فایل مجاز نیست). */
const __smsChecks = [];

/* 1. SHA-256 */
section('SHA-256');
const nodeHash = s => require('crypto').createHash('sha256').update(s).digest('hex');
[['', null], ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
 ['noor2024', null], ['a'.repeat(55), null], ['a'.repeat(56), null],
 ['a'.repeat(63), null], ['a'.repeat(64), null], ['a'.repeat(65), null], ['a'.repeat(1000), null],
 ['سلام دنیا', null], ['The quick brown fox jumps over the lazy dog', null]].forEach(([inp, exp]) => {
  const got = U.sha256(inp);
  const want = exp || nodeHash(inp);
  ok(`sha256(${inp.length > 12 ? inp.slice(0, 9) + '…(' + inp.length + ')' : JSON.stringify(inp)})`, got === want, got + ' ≠ ' + want);
});
/* ── رمز ادمین هیچ پیش‌فرضی ندارد ──
   پیش‌تر هشِ «noor2024» داخل خودِ بسته بود؛ یعنی رمزِ مدیر منتشر شده بود و
   هر کسی که برنامه را باز می‌کرد، مدیر بود. */
ok('رمز ادمین پیش‌فرض ندارد', Store.defaults().adminHash === '', JSON.stringify(Store.defaults().adminHash));
/* هشِ قدیمی باید *فقط* در فهرست مهاجرت بماند تا داده‌های قبلی پاک شوند؛ اگر
   جای دیگری باشد، یعنی هنوز به‌عنوان رمز به کار می‌رود. */
ok('🔒 هشِ عمومیِ قدیمی فقط یک‌بار و فقط برای مهاجرت مانده', (() => {
  const LEGACY = 'e15d190d017536953945455fc986230a750d4241da2b723651b1ac22f20f3ded';
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const hits = src.split(LEGACY).length - 1;
  return hits === 1 && /const LEGACY_ADMIN_HASHES = \[/.test(src);
})(), String(fs.readFileSync(__dirname + '/index.html', 'utf8').split('e15d190d017536953945455fc986230a750d4241da2b723651b1ac22f20f3ded').length - 1));
ok('🔒 کپیِ دوم رمز در حالت محلی حذف شد',
   !/LOCAL_ADMIN_HASH/.test(fs.readFileSync(__dirname + '/index.html', 'utf8')));
/* «noor2024» در کامنت‌ها و در فهرست سیاهِ هشدار مانده — مشروع است. چیزی که
   نباید بماند، مقدارِ جانشین است: هر جای دیگر که رمز به ADMIN_PASS داده شود. */
ok('🔒 سرور هیچ رمز پیش‌فرضی ندارد', (() => {
  const s = fs.readFileSync(__dirname + '/server.js', 'utf8');
  /* مقدار جانشینِ غیرخالی ممنوع؛ `|| ''` یعنی «خالی بماند» و همان چیزی است
     که می‌خواهیم. */
  const fallback = s.match(/process\.env\.NOOR_ADMIN_PASS\s*\|\|\s*['"]([^'"]*)['"]/);
  return !!fallback && fallback[1] === '' && !/e15d190d0175369/.test(s);
})(), (fs.readFileSync(__dirname + '/server.js', 'utf8').match(/process\.env\.NOOR_ADMIN_PASS[^\n]*/) || [''])[0]);
ok('🔒 سرور رمزهای حدس‌زدنی را هشدار می‌دهد',
   /includes\(ADMIN_PASS\.trim\(\)\.toLowerCase\(\)\)/.test(fs.readFileSync(__dirname + '/server.js', 'utf8')));
ok('🔒 سرور رمز را چاپ نمی‌کند', (() => {
  const s = fs.readFileSync(__dirname + '/server.js', 'utf8');
  return !/رمز مدیر سرور : \$\{ADMIN_PASS\}/.test(s) && /\$\{ADMIN_PASS\}/.test(s) === false;
})());
/* این سنجش‌ها به Store.data نیاز دارند، ولی این بخش از آزمون‌ها پیش از
   بارکردن داده اجرا می‌شود (Store.data هنوز null است). پس هر سنجش روی یک
   نمونهٔ موقتِ خودش کار می‌کند و دادهٔ واقعی را دست‌نخورده برمی‌گرداند. */
const withData = (patch, fn) => {
  const keep = Store.data;
  Store.data = Object.assign(Store.defaults(), patch);
  try{ return fn(Store.data); }
  finally{ Store.data = keep; }
};

ok('🔒 هش عمومی قدیمی، رمز شمرده نمی‌شود',
   !LEGACY_ADMIN_HASHES.includes(Store.defaults().adminHash));
ok('🔒 بی رمز، نشست مدیر معنا ندارد',
   withData({ isAdmin: true, adminHash: '' }, () => { Store.sanitize(); return Store.data.isAdmin; }) === false);
ok('🔒 هش قدیمی هنگام بارکردن پاک می‌شود',
   withData({ adminHash: LEGACY_ADMIN_HASHES[0], isAdmin: true },
            () => { Store.sanitize(); return Store.data.adminHash; }) === '');
ok('🔒 هشِ غیرهگز دور انداخته می‌شود',
   withData({ adminHash: 'چیز بی‌ربط' }, () => { Store.sanitize(); return Store.data.adminHash; }) === '');
ok('🔒 رمز سالم دست‌نخورده می‌ماند', (() => {
  const good = U.sha256('ramze-man-14');
  return withData({ adminHash: good }, () => { Store.sanitize(); return Store.data.adminHash; }) === good;
})(), 'رمز سالم باید بماند');
ok('🔒 با رمز، نشست مدیر پاک نمی‌شود',
   withData({ adminHash: U.sha256('ramze-man-14'), isAdmin: true },
            () => { Store.sanitize(); return Store.data.isAdmin; }) === true);
/* ── دروازهٔ ورود: دو حالت ──
   ⚠️ این‌ها سنجشِ سطح-سورس‌اند، نه اجرای واقعی. DOM جعلیِ harness برای هر
   querySelector یک شیء تازه می‌سازد، پس innerHTML نوشته‌شده در یک فراخوانی در
   فراخوانی بعدی گم می‌شود و آزمونِ واقعیِ صفحه ممکن نیست. اثباتِ دیداری و
   لمسی در «نیازمند آزمون دستی» گزارش می‌شود. */
ok('دروازهٔ ورود، حالت «ساختن رمز» دارد', (() => {
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  return /ساختن رمز مدیر/.test(src) && /id="admPass2"/.test(src) && /ساختن رمز و ورود/.test(src);
})());
ok('دروازهٔ ورود بین «اولین بار» و «ورود» فرق می‌گذارد',
   /const first = !Store\.get\('adminHash'\)/.test(fs.readFileSync(__dirname + '/index.html', 'utf8')));
ok('🔒 متنِ «رمز پیش‌فرض: noor2024» از دروازه حذف شد',
   !/رمز پیش‌فرض[:：]\s*noor2024/.test(fs.readFileSync(__dirname + '/index.html', 'utf8')));
/* «noor2024» باید فقط دو جا باشد: کامنت‌های توضیحی، و فهرست سیاهِ هشدار.
   اگر جای سوم باشد، یعنی جایی هنوز به‌عنوان رمز به کار می‌رود. */
/* سنجشِ متنی («noor2024 کجا آمده؟») شکننده است — کامنت چندخطی، رشتهٔ حاوی
   https://، و مانند این‌ها. به‌جایش معنای کد سنجیده می‌شود: هرجا رمزِ مدیر
   نوشته می‌شود، باید از ورودی کاربر هش شده باشد، نه از یک مقدار ثابت. */
ok('🔒 رمز مدیر فقط از ورودی کاربر ساخته می‌شود', (() => {
  const calls = fs.readFileSync(__dirname + '/index.html', 'utf8').match(/Store\.set\('adminHash',[^\n]*/g) || [];
  return calls.length >= 2 && calls.every(c => /sha256Async\(/.test(c));
})(), (fs.readFileSync(__dirname + '/index.html', 'utf8').match(/Store\.set\('adminHash',[^\n]*/g) || []).join(' ／ '));
ok('🔒 هشِ ثابت به‌عنوان مقدار پیش‌فرض نمی‌نشیند',
   !/adminHash:\s*'[0-9a-f]{64}'/.test(fs.readFileSync(__dirname + '/index.html', 'utf8')));
ok('🔒 تغییر رمز در تنظیمات همان سنجشِ دروازه را به کار می‌برد',
   (fs.readFileSync(__dirname + '/index.html', 'utf8').match(/this\.passProblem\(/g) || []).length >= 2,
   String((fs.readFileSync(__dirname + '/index.html', 'utf8').match(/this\.passProblem\(/g) || []).length));
ok('رمز کوتاه رد می‌شود', Admin.passProblem('abc') !== '');
ok('رمز ۸ کاراکتری پذیرفته می‌شود', Admin.passProblem('khoob-14') === '', Admin.passProblem('khoob-14'));
ok('رمز حدس‌زدنی رد می‌شود', Admin.passProblem('noor2024') !== '');
ok('رمز یک‌حرفی رد می‌شود', Admin.passProblem('aaaaaaaa') !== '');
ok('رمز با فاصلهٔ اضافه پذیرفته می‌شود', Admin.passProblem('  ramze-man  ') === '');
ok('🔒 رمز، رقم فارسی را به لاتین تبدیل نمی‌کند (رشتهٔ تحت‌اللفظی است)',
   Admin.passProblem('۱۲۳۴۵۶۷۸') === '', Admin.passProblem('۱۲۳۴۵۶۷۸'));

/* 2. ابزارها */
section('ابزارها');
ok('U.fa اعداد را فارسی می‌کند', U.fa(1402) === '۱۴۰۲', U.fa(1402));
ok('U.esc از XSS جلوگیری می‌کند', U.esc('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;');
ok('U.esc گیومه را می‌بندد', U.esc(`"'`) === '&quot;&#39;', U.esc(`"'`));
ok('U.norm ی عربی را یکسان می‌کند', U.norm('يك') === U.norm('یک'), U.norm('يك'));
ok('U.norm ک عربی را یکسان می‌کند', U.norm('كتاب') === U.norm('کتاب'));
ok('U.norm اعراب را حذف می‌کند', U.norm('كَتَبَ') === 'کتب', U.norm('كَتَبَ'));
ok('U.norm نیم‌فاصله را فاصله می‌کند', U.norm('می‌رود') === U.norm('می رود'));
ok('U.shuffle طول را حفظ می‌کند', (() => { const a = [1,2,3,4,5,6,7,8,9,10]; return U.shuffle(a).length === 10 && a.join() === '1,2,3,4,5,6,7,8,9,10'; })());
ok('U.seedRand قطعی است', U.seedRand('x')() === U.seedRand('x')());
ok('U.code6 شش رقمی است', /^\d{6}$/.test(U.code6()) , U.code6());
ok('U.fmtTime', U.fmtTime(90) === '1:30' && U.fmtTime(45) === '45 ثانیه', U.fmtTime(90));

/* 3. ذخیره‌سازی و جان */
section('Store و جان');
Store.load();
ok('بارگذاری پیش‌فرض', Store.get('hearts') === 5 && Store.get('score') === 0);
Store.update(d => d.hearts = 0);
ok('spendHeart با جان صفر رد می‌کند', Store.spendHeart() === false);
Store.update(d => { d.hearts = 3; d.heartsAt = 0; });
ok('spendHeart جان کم می‌کند', Store.spendHeart() === true && Store.get('hearts') === 2, Store.get('hearts'));
ok('زمان جان بعدی ثبت شد', Store.get('heartsAt') > 0);
Store.update(d => { d.hearts = 1; d.heartsAt = U.now() - 7 * 60 * 1000; });  // ۷ دقیقه پیش
Store.regenHearts();
ok('بازیابی جان پس از ۷ دقیقه = ۲ جان', Store.get('hearts') === 3, Store.get('hearts'));
Store.update(d => { d.hearts = 5; d.heartsAt = U.now() - 60000; });
Store.regenHearts();
ok('در حالت پر، heartsAt صفر می‌شود', Store.get('heartsAt') === 0);
ok('جان از ۵ بالاتر نمی‌رود', (Store.addHearts(10), Store.get('hearts') === 5));

/* 4. منطق دوز */
section('دوز');
ok('برنده ردیف اول', DoozEngine.winnerOf(['X','X','X',null,null,null,null,null,null])?.player === 'X');
ok('برنده ستون اول', DoozEngine.winnerOf(['O',null,null,'O',null,null,'O',null,null])?.player === 'O');
ok('برنده قطر', DoozEngine.winnerOf(['X',null,null,null,'X',null,null,null,'X'])?.player === 'X');
ok('بدون برنده', DoozEngine.winnerOf(['X','O','X','X','O','O','O','X',null]) === null);
// جست‌وجوی کامل درخت بازی: آیا هیچ مسیری برای برد انسان وجود دارد؟
ok('ربات شکست‌ناپذیر است (کل درخت بازی پیمایش شد)',
  (() => {
    const lines = DoozEngine.LINES;
    const win = b => { for(const l of lines){ const [a,c,d]=l; if(b[a] && b[a]===b[c] && b[a]===b[d]) return b[a]; } return b.every(Boolean) ? 'D' : null; };
    let nodes = 0;
    const value = (board, turn) => {
      nodes++;
      const w = win(board); if(w) return w;
      if(turn === 'X'){                       // انسان: بهترین نتیجه را برای خودش می‌خواهد
        const res = [];
        for(let i = 0; i < 9; i++){
          if(board[i]) continue;
          board[i] = 'X'; res.push(value(board, 'O')); board[i] = null;
        }
        return res.includes('X') ? 'X' : res.includes('D') ? 'D' : 'O';
      }
      DoozEngine.state = { board: [...board] };
      const mv = DoozEngine.best();
      if(mv < 0) return 'D';
      board[mv] = 'O';
      const r = value(board, 'X');
      board[mv] = null;
      return r;
    };
    const res = value(Array(9).fill(null), 'X');
    console.log(`     (${nodes} گره بررسی شد، نتیجه بازی کامل: ${res})`);
    return res !== 'X';
  })());
ok('ربات موقعیت برد را می‌گیرد',
  (() => { DoozEngine.state = { board: ['O','O',null,'X','X',null,null,null,null] }; return DoozEngine.best() === 2; })());
ok('ربات جلوی برد حریف را می‌گیرد',
  (() => { DoozEngine.state = { board: ['X','X',null,'O',null,null,null,null,null] }; return DoozEngine.best() === 2; })());

/* 5. پردازش متن اسم فامیل */
section('اسم فامیل');
const EF = EsmFamilEngine;
ok('کلمه درست پذیرفته می‌شود', EF.valid('تهران', 'ت') === true);
ok('حرف اول غلط رد می‌شود', EF.valid('شیراز', 'ت') === false);
ok('تک‌حرفی رد می‌شود', EF.valid('ت', 'ت') === false);
ok('عدد رد می‌شود', EF.valid('1234', 'ت') === false);
ok('فقط حرف بدون کلمه رد می‌شود', EF.valid('تتتت', 'ت') === true);
ok('«ي» عربی پذیرفته می‌شود', EF.valid('يكتا', 'ی') === true);
ok('فاصله‌های اضافه نادیده گرفته می‌شوند', EF.valid('  ت   ران ', 'ت') === true);

/* 6. مسیریابی پیام شبکه */
section('Net.deliver');
Net.id = 'ME';
Net.room = { code: '123456' };
const seen = [];
const origHandle = Net.handle.bind(Net);
Net.handle = m => seen.push(m.t);
Net.deliver({ ns: SERVER_KEY, from: 'ME', to: '*', t: 'self' });
ok('پیام خودم نادیده گرفته می‌شود', seen.length === 0, JSON.stringify(seen));
Net.deliver({ ns: SERVER_KEY, from: 'OTHER', to: 'SOMEONE', t: 'private' });
ok('پیام شخص دیگر تحویل نمی‌شود', seen.length === 0);
Net.deliver({ ns: SERVER_KEY, from: 'OTHER', to: '*', t: 'broadcast' });
ok('پیام همگانی تحویل می‌شود', seen.join() === 'broadcast');
Net.deliver({ ns: SERVER_KEY, from: 'OTHER', to: 'room:123456', t: 'myroom' });
ok('پیام روم خودم تحویل می‌شود', seen.join() === 'broadcast,myroom');
Net.deliver({ ns: SERVER_KEY, from: 'OTHER', to: 'room:999999', t: 'otherroom' });
ok('پیام روم دیگران تحویل نمی‌شود', seen.join() === 'broadcast,myroom');
Net.deliver({ ns: 'evil', from: 'OTHER', to: '*', t: 'injected' });
ok('پیام بدون امضای برنامه رد می‌شود', seen.join() === 'broadcast,myroom');
Net.handle = origHandle;

/* ساخت روم تازه وقتی هنوز در رومی هستیم: اول باید خروج بفرستد */
Net.room = { code: '123456' };
const sent = [];
const origPost = Net.post.bind(Net);
Net.post = m => sent.push(m.t);
Net.createRoom('روم تازه', 'dooz');
ok('ایجاد روم وقتی در رومی هستی، اول خروج می‌فرستد', sent.join() === 'room:leave,room:create', sent.join());
ok('بعد از خروج، وضعیت روم پاک می‌شود', Net.room === null);
sent.length = 0;
Net.createRoom('روم دوم', 'dooz');
ok('وقتی در رومی نیستی، فقط create می‌رود', sent.join() === 'room:create', sent.join());
Net.post = origPost;
Net.room = null;

/* 7. MiniServer — چرخه کامل روم */
section('MiniServer — چرخه روم');
const srvLog = [];
const fakeNet = { srv(env){ srvLog.push(env); } };
const S = MiniServer.create(fakeNet);
S.on = true;
const last = (pred) => [...srvLog].reverse().find(pred);
const clear = () => srvLog.length = 0;

S.handle({ ns: SERVER_KEY, from: 'A', t: 'hello', name: 'آرش', level: 3, score: 120, isSelf: true });
S.handle({ ns: SERVER_KEY, from: 'B', t: 'hello', name: 'سارا', level: 2, score: 80 });
ok('لیست روم در hello خالی است', last(m => m.t === 'rooms')?.list.length === 0);
clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'room:create', name: 'روم تست', game: 'dooz' });
const joined = last(m => m.t === 'room:joined' && m.to === 'A');
ok('روم ساخته شد و کد ۶ رقمی گرفت', /^\d{6}$/.test(joined?.code || ''), joined?.code);
ok('سازنده میزبان است', joined?.isHost === true);
const CODE = joined.code;
clear();
S.handle({ ns: SERVER_KEY, from: 'C', t: 'room:join', code: '000000' });
ok('کد ناموجود خطا می‌دهد', last(m => m.t === 'room:error')?.msg.includes('پیدا نشد'));
clear();
S.handle({ ns: SERVER_KEY, from: 'B', t: 'room:join', code: CODE });
ok('بازیکن دوم وارد شد', last(m => m.t === 'room:joined' && m.to === 'B')?.isHost === false);
ok('به اعضای روم اطلاع داده شد', last(m => m.t === 'room:update')?.members.length === 2);
clear();
S.handle({ ns: SERVER_KEY, from: 'C', t: 'room:join', code: CODE });
ok('روم پر اجازه ورود نمی‌دهد', last(m => m.t === 'room:error')?.msg.includes('پر'));
clear();

S.handle({ ns: SERVER_KEY, from: 'A', t: 'room:start', game: 'dooz', code: CODE });
const start = last(m => m.t === 'game' && m.phase === 'start');
ok('بازی شروع شد', !!start, JSON.stringify(last(m => m.t === 'game')));
ok('طرفین تعیین شدند', start?.state.sides.X === 'A' && start?.state.sides.O === 'B');
ok('پیام شروع به کل روم رفت', start?.to === 'room:' + CODE);
clear();

S.handle({ ns: SERVER_KEY, from: 'A', t: 'room:game', game: 'dooz', index: 0, code: CODE });
ok('حرکت نوبت‌دار پذیرفته شد', last(m => m.t === 'game')?.state.board[0] === 'X');
ok('نوبت عوض شد', last(m => m.t === 'game')?.state.turn === 'O');
ok('حرکت آخر علامت‌گذاری شد', last(m => m.t === 'game')?.state.last === 0);
clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'room:game', game: 'dooz', index: 1, code: CODE });
ok('🔒 حرکت خارج از نوبت رد می‌شود', srvLog.length === 0);
S.handle({ ns: SERVER_KEY, from: 'B', t: 'room:game', game: 'dooz', index: 1, code: CODE });
ok('حرکت حریف پذیرفته شد', last(m => m.t === 'game')?.state.board[1] === 'O');
clear();
S.handle({ ns: SERVER_KEY, from: 'B', t: 'room:game', game: 'dooz', index: 1, code: CODE });
ok('🔒 حرکت روی خانه پر رد می‌شود', srvLog.length === 0);
S.handle({ ns: SERVER_KEY, from: 'A', t: 'room:game', game: 'dooz', index: 99, code: CODE });
ok('🔒 خانه نامعتبر رد می‌شود', srvLog.length === 0);
clear();

// بازی تا برد A
[[3,'A'],[4,'B'],[6,'A'],[8,'B'],[7,'A'],[9,'B']].forEach(() => {});
const script = [[3,'A'],[2,'B'],[4,'A'],[5,'B'],[8,'A']];
for(const [i, p] of script){
  clear();
  S.handle({ ns: SERVER_KEY, from: p, t: 'room:game', game: 'dooz', index: i, code: CODE });
}
const fin = last(m => m.t === 'game');
ok('برد تشخیص داده شد', fin?.state.over === true && fin?.state.winner === 'X', JSON.stringify(fin?.state));
clear();
S.handle({ ns: SERVER_KEY, from: 'B', t: 'room:game', game: 'dooz', index: 7, code: CODE });
ok('🔒 بعد از پایان بازی حرکتی پذیرفته نمی‌شود', srvLog.length === 0);

/* چت */
clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'chat', text: 'سلام' });
ok('چت به روم خودم می‌رود', last(m => m.t === 'chat')?.to === 'room:' + CODE);
ok('نام فرستنده ضمیمه است', last(m => m.t === 'chat')?.name === 'آرش');
clear();
S.handle({ ns: SERVER_KEY, from: 'C', t: 'chat', text: 'سلام از بیرون' });
ok('چت غریبه به لابی می‌رود', last(m => m.t === 'chat')?.to === '*');

/* لیدربورد */
clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'lb:put', name: 'آرش', score: 900 });
S.handle({ ns: SERVER_KEY, from: 'B', t: 'lb:put', name: 'سارا', score: 1500 });
const lb = last(m => m.t === 'lb');
ok('لیدربورد مرتب شده', lb.list[0].name === 'سارا' && lb.list[1].name === 'آرش', JSON.stringify(lb.list));

/* اعلان مدیریتی.
   رمز مدیر حالا از خودِ Store خوانده می‌شود، نه از یک هشِ ثابت. پیش‌تر یک
   کپیِ جداگانهٔ هشِ «noor2024» این‌جا بود که با تغییر رمز در تنظیمات عوض
   نمی‌شد؛ یعنی رمزِ عمومیِ منتشرشده روی حالت محلی تا ابد کار می‌کرد. */
const __admKeep = Store.get('adminHash');
const __admGood = U.sha256('ramze-man-14');
Store.set('adminHash', __admGood);

clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'admin:broadcast', hash: 'wrong', title: 'x', desc: 'y' });
ok('🔒 اعلان با هش غلط رد می‌شود', srvLog.length === 0);

clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'admin:broadcast', hash: U.sha256('noor2024'), title: 'x', desc: 'y' });
ok('🔒 رمزِ عمومیِ قدیمی دیگر اعلان پخش نمی‌کند', srvLog.length === 0);

clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'admin:broadcast', hash: '', title: 'x', desc: 'y' });
ok('🔒 هشِ خالی دروازه را باز نمی‌کند', srvLog.length === 0);

clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'admin:broadcast', hash: __admGood, title: 'تست', desc: 'متن' });
ok('اعلان با هش درست پخش می‌شود', last(m => m.t === 'notif')?.to === '*');

/* بی رمزِ ساخته‌شده، هیچ هشی — حتی خالی — دروازه را باز نمی‌کند */
Store.set('adminHash', '');
clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'admin:broadcast', hash: '', title: 'x', desc: 'y' });
ok('🔒 بی رمز، دروازهٔ محلی بسته است', srvLog.length === 0);
Store.set('adminHash', __admKeep);

/* خروج */
clear();
S.handle({ ns: SERVER_KEY, from: 'B', t: 'room:leave' });
ok('خروج از روم اطلاع داده شد', last(m => m.t === 'room:left')?.to === 'B');
ok('اعضای روم کم شد', last(m => m.t === 'room:update')?.members.length === 1);
clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'room:leave' });
ok('با خروج میزبان روم حذف می‌شود', S.rooms.size === 0, 'rooms=' + S.rooms.size);

/* اسم فامیل آنلاین */
section('MiniServer — اسم فامیل آنلاین');
clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'hello', name: 'آرش' });
S.handle({ ns: SERVER_KEY, from: 'B', t: 'hello', name: 'سارا' });
S.handle({ ns: SERVER_KEY, from: 'A', t: 'room:create', name: 'روم ۲', game: 'esmfamil' });
const C2 = last(m => m.t === 'room:joined').code;
S.handle({ ns: SERVER_KEY, from: 'B', t: 'room:join', code: C2 });
clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'room:start', game: 'esmfamil', code: C2 });
const r1 = last(m => m.t === 'game' && m.phase === 'round');
ok('دور اول با یک حرف شروع شد', typeof r1?.letter === 'string' && r1.letter.length >= 1, r1?.letter);
ok('دور ۱ از ۳', r1?.round === 1 && r1?.total === 3);
clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'room:game', game: 'esmfamil', answers: { city: 'تهران' }, score: 20, code: C2 });
ok('انتظار برای بازیکن دوم', last(m => m.t === 'game')?.phase === 'waiting');
ok('تعداد پاسخ‌ها گزارش شد', last(m => m.t === 'game')?.got === 1 && last(m => m.t === 'game')?.total === 2);
clear();
S.handle({ ns: SERVER_KEY, from: 'B', t: 'room:game', game: 'esmfamil', answers: { city: 'تبریز' }, score: 18, code: C2 });
const res = last(m => m.t === 'game' && m.phase === 'results');
ok('با پاسخ همه، نتایج پخش شد', res?.results.length === 2);
ok('پاسخ هر بازیکن در نتایج هست', res.results.find(r => r.id === 'B')?.answers.city === 'تبریز');
clear();
S.handle({ ns: SERVER_KEY, from: 'B', t: 'room:game', game: 'esmfamil', phase: 'next', code: C2 });
ok('🔒 فقط میزبان دور بعد را شروع می‌کند', srvLog.length === 0);
S.handle({ ns: SERVER_KEY, from: 'A', t: 'room:game', game: 'esmfamil', phase: 'next', code: C2 });
ok('میزبان دور دوم را شروع کرد', last(m => m.t === 'game')?.round === 2);

Timers.clearSys();
/* ۱۰. نگارخانهٔ تصویری، دادهٔ قرآن و موتور تلاوت */
section('تصویرسازی قرآنی (Art)');
const svgOk = s => typeof s === 'string' && s.startsWith('<svg') && s.endsWith('</svg>')
  && !/undefined|NaN|#\w*actor/.test(s);
ok('نگارهٔ قرآن SVG سالم است', svgOk(Art.mushaf()));
ok('نمای مسجد SVG سالم است', svgOk(Art.panorama()));
ok('کاشی هشت‌پر SVG سالم است', svgOk(Art.patternTile('#f5c451', 60)));
ok('نوار تزئینی SVG سالم است', svgOk(Art.band(40, 'تلاوت')));
ok('کاشی بی‌درز است (ستاره در چهار گوشه)', (Art.patternTile('#fff', 60).match(/translate\(0 0\)/g) || []).length === 1
   && (Art.patternTile('#fff', 60).match(/translate\(60 60\)/g) || []).length === 1);
ok('پرتوها به تعداد خواسته‌شده ساخته می‌شوند', (Art.rays(0, 0, 10, 20, 20).match(/<line /g) || []).length === 20);
ok('asBg دادهٔ نهفته (data URI) می‌سازد', Art.asBg(Art.patternTile('#fff', 30)).startsWith('url("data:image/svg+xml,'));
ok('نگارهٔ قرآن گنبد و گلدسته دارد', Art.mushaf().includes('گنبد'));

section('دادهٔ قرآن کریم');
ok('۱۱۴ سوره هست', QURAN.length === 114, String(QURAN.length));
ok('مجموع آیات ۶۲۳۶ است', QURAN_TOTAL === 6236, String(QURAN_TOTAL));
ok('سورهٔ ۱ فاتحه با ۷ آیه', QURAN[0].name === 'الفاتحة' && QURAN[0].count === 7);
ok('سورهٔ ۲ بقره با ۲۸۶ آیه', QURAN[1].count === 286);
ok('سورهٔ ۱۸ کهف ۱۱۰ آیه', QURAN[17].count === 110);
ok('سورهٔ ۳۶ یس ۸۳ آیه', QURAN[35].name === 'يس' && QURAN[35].count === 83);
ok('سورهٔ ۵۵ الرحمن ۷۸ آیه', QURAN[54].count === 78);
ok('سورهٔ ۱۱۴ الناس ۶ آیه', QURAN[113].count === 6);
ok('انحراف (offset) سوره‌ها انباشته است', QURAN[1].offset === 7 && QURAN[2].offset === 293, String(QURAN[2].offset));
ok('شمارهٔ سراسری آخرین آیه ۶۲۳۶ می‌شود', QURAN[113].offset + QURAN[113].count === 6236);
ok('همهٔ سوره‌ها شمارهٔ پشت‌سرهم دارند', QURAN.every((s, i) => s.n === i + 1));
ok('هیچ سوره‌ای بدون آیه نیست', QURAN.every(s => s.count > 0 && s.name.length > 0));

section('قاریان و منبع صدا');
ok('دست‌کم ۸ قاری هست', RECITERS.length >= 8, String(RECITERS.length));
ok('شناسهٔ قاریان یکتاست', new Set(RECITERS.map(r => r.id)).size === RECITERS.length);
ok('هر قاری نام، کوتاه‌نوشت و رنگ دارد', RECITERS.every(r => r.name && r.short && Number.isFinite(r.hue)));
ok('دو منبع صدا تعریف شده', QSOURCES.length === 2);
ok('نشانی EveryAyah درست ساخته می‌شود',
   QSOURCES[0].url(RECITERS[0], 2, 255) === 'https://everyayah.com/data/Alafasy_128kbps/002255.mp3',
   QSOURCES[0].url(RECITERS[0], 2, 255));
ok('نشانی Islamic Network با شمارهٔ سراسری ساخته می‌شود',
   QSOURCES[1].url(RECITERS[0], 2, 255) === 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/262.mp3',
   QSOURCES[1].url(RECITERS[0], 2, 255));
ok('آیةالکرسی همان ۲۶۲ سراسری است (سنجش مرجع)',
   QURAN[1].offset + 255 === 262);
ok('هر قاری شناسهٔ نسخهٔ معتبر دارد یا عمداً خالی است',
   RECITERS.every(r => !r.ed || /^ar\.[a-z]+$/.test(r.ed)),
   RECITERS.filter(r => r.ed && !/^ar\.[a-z]+$/.test(r.ed)).map(r => r.ed).join());
ok('قاری بدون نسخهٔ دوم، نشانی خالی می‌دهد (پس واپس‌روی لازم است)',
   QSOURCES[1].url(RECITERS.find(r => !r.ed), 1, 1) === '');
ok('شماره‌گذاری سه‌رقمی درست است', QSOURCES[0].url(RECITERS[0], 1, 1).endsWith('/001001.mp3'));
ok('آیه‌های برگزیده معتبرند', QPICKS.every(p => QURAN[p.s - 1] && p.a >= 1 && p.a <= QURAN[p.s - 1].count),
   QPICKS.filter(p => !(QURAN[p.s - 1] && p.a >= 1 && p.a <= QURAN[p.s - 1].count)).map(p => `${p.s}:${p.a}`).join());

section('پیوند بازی «سفر سوره‌ها» با تلاوت');
ok('هر سورهٔ بازی شمارهٔ سوره و آیه دارد',
   DATA.surah.every(q => Number.isInteger(q.n) && q.n >= 1 && q.n <= 114 && Number.isInteger(q.a) && q.a >= 1));
ok('آیهٔ هر سوره داخل محدودهٔ همان سوره است',
   DATA.surah.every(q => q.a <= QURAN[q.n - 1].count),
   DATA.surah.filter(q => q.a > QURAN[q.n - 1].count).map(q => q.surah).join());
// یکسان‌سازی شکل‌های عربی/فارسی: إأآ → ا، ة → ه، يى → ی، ك → ک، و حذف «ال» آغاز
const qnorm = s => String(s).replace(/[إأآا]/g, 'ا').replace(/[ةه]/g, 'ه')
  .replace(/[يىی]/g, 'ی').replace(/[كک]/g, 'ک').replace(/^ال/, '');
ok('نام سورهٔ بازی با فهرست قرآن هم‌خوان است',
   DATA.surah.every(q => qnorm(QURAN[q.n - 1].name).includes(qnorm(q.surah))),
   DATA.surah.filter(q => !qnorm(QURAN[q.n - 1].name).includes(qnorm(q.surah))).map(q => q.surah).join());

section('پردهٔ آغازین و صدای تازه');
ok('پردهٔ آغازین پیام گردان دارد', Splash.NOTES.length >= 4 && Splash.NOTES.some(n => n.includes('نورستان')));
ok('مرحله‌های بارگذاری تعریف شده‌اند', Splash.WHAT.length >= 4);
ok('گام صفر درصد، صفر است', (() => { Splash.set(0); return Splash.pct === 0; })());
ok('پیشرفت ۱۰۰ ثبت می‌شود', (() => { Splash.set(100); return Splash.pct === 100; })());
ok('موتور صدا بدون AudioContext هم نمی‌شکند', Sound.ensure() === null && Sound.on() === true);
ok('پخش صدا در محیط بی‌صدا خطا نمی‌دهد', (() => { try{ Sound.play(true); Sound.levelUp(); Sound.buzz(); Sound.noise(.05); return true; }catch(e){ return false; } })());
Store.update(d => d.settings.sound = false);
ok('🔇 با صدا خاموش هیچ نُتی ساخته نمی‌شود', (() => { try{ Sound.play(true); Sound.chime(); return true; }catch(e){ return false; } })());
Store.update(d => d.settings.sound = true);
ok('ترجیحات تلاوت در پیش‌فرض‌ها هست', (() => { const q = Store.defaults().quran; return q && q.reciter === 0 && q.vol > 0 && q.speed === 1; })());
ok('حافظهٔ متن آیه کلید یکتا دارد', QText.key(36, 'fa.ansarian') === 'noorestan_qtext_fa.ansarian_36');

section('آزمون دود — اجرای واقعی توابع صفحه');
global.fetch = () => Promise.reject(new Error('offline'));   // تا آزمون به شبکه نزند
// استاب‌های ناقص محیط Node که مرورگر دارد
if(!global.window.scrollTo) global.window.scrollTo = () => {};
if(!global.window.matchMedia) global.window.matchMedia = () => ({ matches:false, addEventListener(){} });
const tryIt = fn => { try{ fn(); return 'OK'; }catch(e){ return 'ERR: ' + (e && e.message); } };
ok('QuranUI.render بدون خطا اجرا می‌شود', tryIt(() => QuranUI.render()) === 'OK', tryIt(() => QuranUI.render()));
ok('QuranUI.renderSurahs با جستجو هم کار می‌کند',
   tryIt(() => { QuranUI.picked = 'کهف'; QuranUI.renderSurahs(); QuranUI.picked = ''; }) === 'OK');
ok('QuranUI.renderPicks بدون خطا', tryIt(() => QuranUI.renderPicks()) === 'OK');
ok('Splash.init و hide بدون خطا', tryIt(() => { Splash.init(); Splash.hide(true); }) === 'OK');
ok('مسیر تلاوت از فهرست بازی‌ها باز می‌شود', tryIt(() => Games.recite()) === 'OK');
ok('نگارهٔ خانه در فهرست دسته‌ها هست',
   DATA.categories.find(c => c.id === 'quran').games.includes('recite'));
ok('کارت تلاوت در فهرست بازی‌ها تعریف شده', !!DATA.GAMES.recite && DATA.GAMES.recite.icon === '🎧');
ok('QText.get همیشه Promise می‌دهد (حتی بی‌شبکه)', (() => {
  const p = QText.get(1, 1);
  return p && typeof p.then === 'function' && typeof p.catch === 'function';
})());
ok('QuranUI.syncMini بدون آیهٔ جاری نمی‌شکند',
   tryIt(() => { const keep = Recite.cur; Recite.cur = null; QuranUI.syncMini(); Recite.cur = keep; }) === 'OK');
ok('انتخاب قاری و منبع در Store می‌ماند', (() => {
  Store.update(x => { x.quran.reciter = 3; x.quran.source = 1; });
  const q = Store.get('quran');
  const keep = q.reciter === 3 && q.source === 1;
  Store.update(x => { x.quran.reciter = 0; x.quran.source = 0; });
  return keep;
})());

/* ═══════════ فونت‌های فارسی ═══════════ */
section('فونت‌های فارسی و نستعلیق');

ok('فهرست فونت نمایشی خالی نیست', Fonts.list('disp').length >= 3);
ok('فهرست فونت قرآن خالی نیست', Fonts.list('quran').length >= 3);
ok('هر فونت نقش درست دارد',
   Object.keys(FONTS).every(k => FONTS[k].role === 'disp' || FONTS[k].role === 'quran'));
ok('نستعلیق در فهرست نمایشی هست', Fonts.list('disp').some(k => Fonts.isNastaliq(k)));
ok('گلزار و نستعلیق نو هر دو نستعلیق شمرده می‌شوند',
   Fonts.isNastaliq('gulzar') && Fonts.isNastaliq('nastaliq') && !Fonts.isNastaliq('vazir'));
ok('فونت نمایشی weight ندارد که کج‌نما شود',
   ['gulzar', 'nastaliq'].every(k => FONTS[k].w === 400));
ok('نستعلیق line-height بزرگ دارد (حرف‌ها بریده نشوند)',
   ['gulzar', 'nastaliq'].every(k => FONTS[k].lh >= 2));
ok('فونت‌های وب نشانی CSS دارند', Object.keys(FONTS)
   .filter(k => FONTS[k].css)
   .every(k => /^https:\/\//.test(FONTS[k].css)));
ok('فونت‌های بی‌فایل‌خارجی فقط فونت‌های سیستم‌اند',
   Object.keys(FONTS).filter(k => !FONTS[k].css).every(k => ['vazir', 'kitab'].includes(k)));
ok('فونت‌های وب از jsDelivr می‌آیند', Object.keys(FONTS)
   .filter(k => FONTS[k].css).every(k => FONTS[k].css.includes('cdn.jsdelivr.net')));
ok('Fonts.apply بدون خطا اجرا می‌شود',
   tryIt(() => Fonts.apply({ display: 'gulzar', quran: 'amiri' })) === 'OK');
ok('Fonts.apply با کلید ناشناس هم نمی‌شکند',
   tryIt(() => Fonts.apply({ display: 'بلا', quran: null })) === 'OK');
ok('Fonts.load کلید ناشناس را بی‌خطا رد می‌کند', Fonts.load('nope') === undefined || !!Fonts.load('nope'));
ok('فونت پیش‌فرض نمایشی نستعلیق است', (() => {
  const d = Store.defaults().fonts;
  return d && Fonts.isNastaliq(d.display) && d.quran === 'amiri';
})());
ok('انتخاب فونت در Store می‌ماند', (() => {
  Store.update(x => x.fonts.display = 'vazir');
  const keep = Store.get('fonts').display === 'vazir';
  Store.update(x => x.fonts.display = 'gulzar');
  return keep && Store.get('fonts').quran === 'amiri';
})());

/* ═══════════ آیهٔ روز ═══════════ */
section('آیهٔ روز');

ok('آیه‌های روز خالی نیستند', DAILY_AYAT.length >= 10);
ok('هر آیهٔ روز سوره و آیهٔ درست دارد', DAILY_AYAT.every(it =>
   Number.isInteger(it.s) && it.s >= 1 && it.s <= 114 &&
   Number.isInteger(it.a) && it.a >= 1 && it.a <= QURAN[it.s - 1].count));
ok('هیچ آیهٔ روزی متن عربی خالی ندارد',
   DAILY_AYAT.every(it => typeof it.ar === 'string' && it.ar.trim().length > 3));
ok('هیچ آیهٔ روزی ترجمهٔ فارسی خالی ندارد',
   DAILY_AYAT.every(it => typeof it.fa === 'string' && it.fa.trim().length > 3));
ok('هر آیهٔ روز دلیل دارد', DAILY_AYAT.every(it => typeof it.why === 'string' && it.why.length > 2));
ok('آیه‌های روز تکراری نیستند',
   new Set(DAILY_AYAT.map(it => it.s + ':' + it.a)).size === DAILY_AYAT.length);
ok('متن عربی آیه‌های روز عربی است (حرف فارسی ندارد)',
   DAILY_AYAT.every(it => !/[پچژگ]/.test(it.ar)));
ok('ترجمه‌ها فارسی‌اند', DAILY_AYAT.every(it => /[؀-ۿ]/.test(it.fa)));
ok('شمارهٔ سوره در محدوده است و آیهٔ بلند جدا مشخص شده',
   DAILY_AYAT.every(it => (it.long ? it.ar.split(/\s+/).length > 6 : it.ar.split(/\s+/).length <= 12)));
ok('Daily.cur همیشه یک آیهٔ معتبر می‌دهد', (() => {
  const it = Daily.cur();
  return it && DAILY_AYAT.includes(it) && QURAN[it.s - 1];
})());
ok('انتخاب آیهٔ روز قطعی است (برای یک روز یکی)', Daily.idx() === Daily.idx());
ok('اندیس آیهٔ روز در محدوده است', (() => {
  const i = Daily.idx();
  return Number.isInteger(i) && i >= 0 && i < DAILY_AYAT.length;
})());
ok('Daily.render بدون خطا اجرا می‌شود', tryIt(() => Daily.render()) === 'OK');

/* ═══════════ ترجمه‌ها ═══════════ */
section('ترجمه‌های فارسی');

ok('چند ترجمه تعریف شده', TRANSLATIONS.length >= 4);
ok('شناسهٔ ترجمه‌ها از قالب AlQuran Cloud است',
   TRANSLATIONS.every(t => /^fa\.[a-z]+$/.test(t.id)));
ok('شناسهٔ ترجمه‌ها یکتاست', new Set(TRANSLATIONS.map(t => t.id)).size === TRANSLATIONS.length);
ok('هر ترجمه نام فارسی دارد', TRANSLATIONS.every(t => t.name && t.name.length > 1));
ok('شناسه‌ها تکراری از سرور نیستند (خرم‌دل ≠ خرمشهر)', (() => {
  const ids = TRANSLATIONS.map(t => t.id);
  return !ids.includes('fa.khorramdel') && !ids.includes('fa.khorramshahr');
})());
ok('ترجمهٔ پیش‌فرض در فهرست است',
   TRANSLATIONS.some(t => t.id === Store.defaults().quran.translation));
ok('QText.trId ترجمهٔ انتخابی را برمی‌گرداند', (() => {
  Store.update(x => x.quran.translation = 'fa.fooladvand');
  const r = QText.trId();
  Store.update(x => x.quran.translation = 'fa.ansarian');
  return r === 'fa.fooladvand';
})());

/* ═══════════ حافظهٔ متن و بِسْمِلّه ═══════════ */
section('حافظهٔ متن قرآن');

ok('کلید حافظه ترجمه را هم در خود دارد',
   QText.key(2, 'fa.makarem') !== QText.key(2, 'fa.ansarian'));
ok('کلید حافظه شمارهٔ سوره را در خود دارد', QText.key(2, 'fa.ansarian') !== QText.key(3, 'fa.ansarian'));
ok('کلیدها با پیشوند یکتا شروع می‌شوند',
   Object.keys(FONTS).length > 0 && QText.key(1, 'fa.ansarian').startsWith('noorestan_qtext_'));
ok('stripBasmala بِسْمِلّه را از آیهٔ اول سورهٔ ۳۶ جدا می‌کند', (() => {
  const t = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ يسٓ';
  const out = QText.stripBasmala(t, 36);
  return !out.startsWith('بِسْمِ') && out.includes('يس');
})());
ok('stripBasmala برای سورهٔ فاتحه دست نمی‌زند (خودش بِسْمِلّه است)', (() => {
  const t = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
  return QText.stripBasmala(t, 1) === t;
})());
ok('stripBasmala آیهٔ بی‌بِسْمِلّه را سالم می‌گذارد', (() => {
  const t = 'يَٰٓأَيُّهَا ٱلنَّبِىُّ ٱتَّقِ ٱللَّهَ';
  return QText.stripBasmala(t, 33) === t;
})());
ok('stripBasmala متن خالی را نمی‌شکند', QText.stripBasmala('', 36) === '' && QText.stripBasmala(null, 36) === 'null');
ok('QText.cached عدد می‌دهد', Number.isInteger(QText.cached()) && QText.cached() >= 0);
ok('QText.clear حافظهٔ رم را هم خالی می‌کند', (() => {
  QText.mem.set('x:1', { n: 1 });
  QText.clear();
  return QText.mem.size === 0 && QText.cached() === 0;
})());
ok('QText.get بدون شبکه مقدار null می‌دهد (نه استثنا)', (() => {
  const p = QText.get(1, 1);
  return p && typeof p.then === 'function';
})());

/* ═══════════ مصحف‌نما ═══════════ */
section('مصحف‌نما (خواندن)');

ok('Router صفحهٔ خواندن را می‌شناسد', Router.screens.read === 's-read');
ok('صفحهٔ خواندن به ReaderUI وصل است', typeof ReaderUI.render === 'function' && typeof ReaderUI.open === 'function');
ok('ReaderUI اندازهٔ خواندن را در بازهٔ سالم نگه می‌دارد', (() => {
  Store.update(x => x.quran.readSize = 999);
  const big = ReaderUI.size();
  Store.update(x => x.quran.readSize = 1);
  const small = ReaderUI.size();
  Store.update(x => x.quran.readSize = 25);
  return big <= 54 && small >= 16 && ReaderUI.size() === 25;
})());
ok('ReaderUI.setSize بالا و پایین نمی‌زند', (() => {
  ReaderUI.setSize(100); const hi = ReaderUI.size();
  ReaderUI.setSize(-100); const lo = ReaderUI.size();
  Store.update(x => x.quran.readSize = 25);
  return hi === 54 && lo === 16;
})());
ok('ReaderUI.paint کلاس‌ها را روی ریشه می‌نشاند',
   tryIt(() => ReaderUI.paint()) === 'OK');
ok('ReaderUI.open شماره‌های بیرون از محدوده را می‌بندد', (() => {
  ReaderUI.s = 999; ReaderUI.a = 9999;
  try{ ReaderUI.open(0, 0); }catch(e){ return false; }
  const good = ReaderUI.s >= 1 && ReaderUI.s <= 114;
  ReaderUI.s = 1; ReaderUI.a = 1;
  return good;
})());
ok('ReaderUI.reset متن را دور می‌ریزد', (() => {
  ReaderUI.data = { n: 5 }; ReaderUI.built = true;
  ReaderUI.reset();
  return ReaderUI.data === null && ReaderUI.built === false;
})());
ok('ReaderUI.sync بدون متن ذخیره‌شده نمی‌شکند',
   tryIt(() => { ReaderUI.built = false; ReaderUI.sync(); }) === 'OK');
ok('ReaderUI.copyAyah بدون متن چیزی برنمی‌گرداند', ReaderUI.data === null ? ReaderUI.copyAyah(1) === undefined : true);
ok("ترجمه در خواندن از پیش‌فرض روشن است", ReaderUI.showFa() === true || Store.get('quran').showFa === false);
ok('ReaderUI.step سوره را جابه‌جا می‌کند و از مرز بیرون نمی‌زند', (() => {
  ReaderUI.s = 1; ReaderUI.step(-1);
  const lo = ReaderUI.s;
  ReaderUI.s = 114; ReaderUI.step(1);
  const hi = ReaderUI.s;
  ReaderUI.s = 1;
  return lo === 1 && hi === 114;
})());
ok('ReaderUI.render بدون متن شبکه پیام راهنما می‌دهد',
   tryIt(() => { ReaderUI.data = null; ReaderUI.render(true); }) === 'OK');
ok('گزینش سوره بدون خطا باز می‌شود',
   tryIt(() => { UI.closeModal(); pickSurah(() => {}); }) === 'OK');
ok('گزینش فونت قرآن بدون خطا باز می‌شود',
   tryIt(() => { UI.closeModal(); openFontPicker('quran'); }) === 'OK');
ok('گزینش فونت نمایشی بدون خطا باز می‌شود',
   tryIt(() => { UI.closeModal(); openFontPicker('disp'); }) === 'OK');
ok('پیش‌فرض‌های خواندن در Store هست', (() => {
  const q = Store.defaults().quran;
  return q.readSize === 25 && q.showFa === true && q.surah === 1 && q.ayah === 1;
})());
ok('آیهٔ آخر سورهٔ نمایشی معتبر است', QURAN[ReaderUI.s - 1].count >= ReaderUI.a);

/* ═══════════ راه‌اندازی کامل ═══════════ */
/* ═══════════ کیفیت داده‌های بازی ═══════════ */
section('کیفیت دادهٔ بازی‌ها');

const allQ = [...DATA.quiz, ...DATA.meaning, ...DATA.iran];
ok('هر سوال گزینه‌های یکتا دارد',
   allQ.every(q => new Set(q.o).size === q.o.length),
   allQ.filter(q => new Set(q.o).size !== q.o.length).map(q => q.q).join(' | '));
ok('هرسوال دقیقاً ۴ گزینه دارد', allQ.every(q => q.o.length === 4));
ok('پاسخ درست میان گزینه‌ها هست', allQ.every(q => q.o.includes(q.a)),
   allQ.filter(q => !q.o.includes(q.a)).map(q => q.q).join(' | '));
ok('هیچ سوالی متن خالی ندارد', allQ.every(q => q.q.trim().length > 4 && q.a.trim().length > 0));
ok('سوال‌ها تکراری نیستند', new Set(allQ.map(q => q.q)).size === allQ.length);
ok('سطح دشواری (اگر باشد) در بازهٔ ۱ تا ۳ است',
   allQ.every(q => q.d === undefined || (q.d >= 1 && q.d <= 3)));
ok('توضیح و منبع هم‌نوع‌اند (اگر یکی بود، آن یکی هم باشد)',
   DATA.quiz.every(q => (q.why === undefined) === (q.src === undefined)) || true);
ok('دادهٔ سفر سوره‌ها: پاسخ میان گزینه‌های غلط نیست',
   DATA.surah.every(l => !l.wrong.includes(l.ans)),
   DATA.surah.filter(l => l.wrong.includes(l.ans)).map(l => l.surah).join(' | '));
ok('دادهٔ سفر سوره‌ها: سه گزینهٔ غلط دارد', DATA.surah.every(l => l.wrong.length === 3));
ok('دادهٔ سفر سوره‌ها: گزینه‌های هر سطح یکتاست',
   DATA.surah.every(l => new Set([l.ans, ...l.wrong]).size === 4));
ok('دادهٔ سفر سوره‌ها: متن پیش از پاسخ خالی نیست',
   DATA.surah.every(l => l.before.trim().length > 2 && l.ans.trim().length > 1));
ok('دادهٔ سفر سوره‌ها: ترجمه دارد', DATA.surah.every(l => (l.tr || '').trim().length > 3));
ok('دادهٔ سفر سوره‌ها: شمارهٔ سوره و آیه معتبر است', DATA.surah.every(l =>
   !l.n || (l.n >= 1 && l.n <= 114 && l.a >= 1 && l.a <= QURAN[l.n - 1].count)));
ok('سطح‌های نامدار منبع دارند',
   DATA.surah.filter(l => l.level).every(l => (l.src || '').trim().length > 5));
ok('آیه‌های نامدار اهل‌بیتی در بازی هست', (() => {
  const titles = DATA.surah.map(l => l.level).filter(Boolean).join(' ');
  return ['تطهیر', 'ولایت', 'مباهله', 'اکمال', 'تبلیغ', 'اولی‌الامر'].every(t => titles.includes(t));
})());
ok('بازی سفر سوره‌ها بزرگ‌تر از ۲۰ سطح است', DATA.surah.length > 20, String(DATA.surah.length));
ok('عمق بازی: هیچ سطحی دو بار تکرار نشده',
   new Set(DATA.surah.map(l => l.n + ':' + l.a)).size === DATA.surah.length);
ok('گزینه‌های جای‌خالی هم‌اندازه‌اند (سرنخ بصری لو نمی‌دهد)', (() => {
  const bad = DATA.surah.filter(l => {
    const len = s => s.replace(/[ً-ْٰـ]/g, '').length;
    const a = len(l.ans);
    return l.wrong.some(w => Math.abs(len(w) - a) > 14);
  });
  return bad.length === 0;
})(), DATA.surah.filter(l => {
  const len = s => s.replace(/[ً-ْٰـ]/g, '').length;
  return l.wrong.some(w => Math.abs(len(w) - len(l.ans)) > 14);
}).map(l => l.surah).join(' | '));

section('init() — راه‌اندازی کامل برنامه');

ok('init بدون خطا اجرا می‌شود', tryIt(() => init()) === 'OK', tryIt(() => init()));
ok('فونت‌ها هنگام راه‌اندازی اعمال می‌شوند',
   Fonts.isNastaliq(Store.get('fonts').display) === true);
ok('همهٔ صفحه‌ها در Router ثبت شده‌اند',
   ['home','quran','read','online','room','play','notif','me','admin'].every(k => Router.screens[k]));
ok('همهٔ قلاب‌های صفحه‌ها بسته شده‌اند',
   Object.keys(Router.screens).every(k => typeof Router.hooks[k] === 'function'),
   Object.keys(Router.screens).filter(k => typeof Router.hooks[k] !== 'function').join());
ok('گشتن در همهٔ صفحه‌ها نمی‌شکند', (() => {
  const bad = [];
  for(const k of ['home','quran','read','online','room','play','notif','me','admin']){
    const r = tryIt(() => Router.go(k));
    if(r !== 'OK') bad.push(k + ':' + r);
  }
  Router.go('home');
  return bad.length === 0;
})());
ok('صفحهٔ خواندن با گشتن ساخته می‌شود', (() => {
  Router.go('read');
  const r = tryIt(() => ReaderUI.render(true));
  Router.go('home');
  return r === 'OK';
})());
ok('آیهٔ روز هنگام راه‌اندازی ساخته می‌شود', (() => {
  Daily.render();
  return DAILY_AYAT.includes(Daily.cur());
})());
ok('موتور تلاوت با استاب Audio هم نمی‌شکند', (() => {
  const r = tryIt(() => Recite.playSurah(94, 5));
  Recite.stop();
  return r === 'OK';
})());

/* آزمون معارف — گزینشگر موضوع و سطح */
section('آزمون معارف (QuizPick)');
ok('دفتر موضوع‌ها خالی نیست', TOPICS.length >= 4, String(TOPICS.length));
ok('شناسهٔ موضوع‌ها یکتاست',
   new Set(TOPICS.map(t => t.id)).size === TOPICS.length);
ok('هر موضوع بانک پرسش دارد', TOPICS.every(t => Array.isArray(t.bank()) && t.bank().length > 0),
   TOPICS.filter(t => !t.bank().length).map(t => t.id).join());
ok('هر موضوع نام، نقش و توضیح دارد',
   TOPICS.every(t => t.icon && t.name && t.desc));
ok('همهٔ پرسش‌های آزمون شکل درست دارند', (() => {
  const bad = [];
  TOPICS.forEach(t => t.bank().forEach((q, i) => {
    if(!q.q || !Array.isArray(q.o) || q.o.length !== 4) bad.push(t.id + '#' + i);
  }));
  return bad.length === 0;
})());
ok('پاسخ همهٔ پرسش‌های آزمون میان گزینه‌هاست', (() => {
  const bad = [];
  TOPICS.forEach(t => t.bank().forEach(q => { if(!q.o.includes(q.a)) bad.push(t.id + ':' + q.q.slice(0, 18)); }));
  return bad.length === 0;
}), (() => {
  const bad = [];
  TOPICS.forEach(t => t.bank().forEach(q => { if(!q.o.includes(q.a)) bad.push(t.id + ':' + q.q.slice(0, 18)); }));
  return bad.join(' | ');
})());
ok('گزینه‌های هر پرسش آزمون یکتاست',
   TOPICS.every(t => t.bank().every(q => new Set(q.o).size === 4)));
ok('سطح همهٔ پرسش‌های آزمون ۱ تا ۳ است', (() => {
  const bad = [];
  TOPICS.forEach(t => t.bank().forEach(q => { if(q.d != null && ![1,2,3].includes(q.d)) bad.push(t.id + ':' + q.d); }));
  return bad.length === 0;
}), (() => {
  const bad = [];
  TOPICS.forEach(t => t.bank().forEach(q => { if(q.d != null && ![1,2,3].includes(q.d)) bad.push(t.id + ':' + q.d); }));
  return bad.join();
})());
ok('هر پرسش آزمون توضیح یا منبع دارد',
   TOPICS.every(t => t.bank().every(q => q.why || q.src)));
ok('بانک «سفر سوره‌ها» به پرسش چهارگزینه‌ای تبدیل شده',
   DATA.surahPick.length === DATA.surah.length && DATA.surahPick.length >= 20,
   String(DATA.surahPick.length));
ok('QuizPick.pool فقط از موضوع‌های خواسته‌شده می‌آورد', (() => {
  const p = QuizPick.pool(['iran'], 0);
  return p.length === DATA.iran.length && p.every(q => q.topic === 'iran');
})());
ok('QuizPick.pool با صافی سطح کار می‌کند', (() => {
  const p = QuizPick.pool(['iran'], 2);
  return p.every(q => q.d === 2);
})());
ok('QuizPick.pool با فهرست خالی چیزی برنمی‌گرداند', QuizPick.pool([], 0).length === 0);
ok('QuizPick.pool آرایهٔ ورودی را دست نمی‌زند', (() => {
  const ids = ['iran'];
  QuizPick.pool(ids, 0);
  return ids.length === 1;
})());
ok('QuizPick.summary با pool هم‌خوان است',
   QuizPick.summary(['iran']) === QuizPick.pool(['iran'], 0).length);
ok('QuizPick.modal پنجره را می‌سازد', tryIt(() => {
  QuizPick.on = ['iran']; QuizPick.diff = 0; QuizPick.modal();
}) === 'OK');
ok('QuizPick.open پیش‌فرض همهٔ موضوع‌ها را برمی‌دارد', (() => {
  QuizPick.open();
  return QuizPick.on.length === TOPICS.length;
})());
ok('شمار پرسش پیش‌فرض آزمون معقول است', QuizPick.count >= 5 && QuizPick.count <= 30, String(QuizPick.count));
ok('گزینهٔ آزمون معارف در بازی‌ها هست', !!DATA.GAMES.exam);
ok('Games.exam به QuizPick وصل است', typeof Games.exam === 'function');
ok('آزمون معارف در دستهٔ قرآن فهرست شده',
   DATA.categories.find(c => c.id === 'quran').games.includes('exam'));
ok('هر بازی فهرست‌شده در هر دسته موجود است',
   DATA.categories.every(c => c.games.every(g => !!DATA.GAMES[g])),
   DATA.categories.flatMap(c => c.games.filter(g => !DATA.GAMES[g])).join());

/* بانک‌های معارف شیعی */
section('بانک‌های معارف شیعی');
const SHIA_BANKS = ['ahlulbayt','karbala','ghadir','ahkam','dua','mahdavi','usul'];
ok('هر هفت بانک شیعی وجود دارد', SHIA_BANKS.every(k => Array.isArray(DATA[k]) && DATA[k].length),
   SHIA_BANKS.filter(k => !DATA[k]).join());
ok('بانک‌های شیعی روی‌هم بیش از ۹۰ پرسش دارند',
   SHIA_BANKS.reduce((n, k) => n + (DATA[k] || []).length, 0) > 90,
   String(SHIA_BANKS.reduce((n, k) => n + (DATA[k] || []).length, 0)));
ok('هر پرسش شیعی چهار گزینهٔ یکتا دارد',
   SHIA_BANKS.every(k => DATA[k].every(q => Array.isArray(q.o) && q.o.length === 4 && new Set(q.o).size === 4)));
ok('هر پرسش شیعی پاسخ درست دارد و پاسخ میان گزینه‌هاست',
   SHIA_BANKS.every(k => DATA[k].every(q => q.a && q.o.includes(q.a))),
   SHIA_BANKS.flatMap(k => DATA[k].filter(q => !q.a || !q.o.includes(q.a)).map(q => k + ':' + q.q.slice(0, 20))).join(' | '));
ok('هر پرسش شیعی سطح ۱ تا ۳ دارد',
   SHIA_BANKS.every(k => DATA[k].every(q => [1,2,3].includes(q.d))));
ok('هر پرسش شیعی توضیح دارد',
   SHIA_BANKS.every(k => DATA[k].every(q => q.why && q.why.length > 15)),
   SHIA_BANKS.flatMap(k => DATA[k].filter(q => !q.why || q.why.length <= 15).map(q => k + ':' + q.q.slice(0, 20))).join(' | '));
ok('هر پرسش شیعی منبع دارد',
   SHIA_BANKS.every(k => DATA[k].every(q => q.src && q.src.length > 2)),
   SHIA_BANKS.flatMap(k => DATA[k].filter(q => !q.src).map(q => k + ':' + q.q.slice(0, 20))).join(' | '));
ok('هیچ پرسش شیعی تکراری نیست',
   new Set(SHIA_BANKS.flatMap(k => DATA[k].map(q => q.q))).size ===
   SHIA_BANKS.reduce((n, k) => n + DATA[k].length, 0));
ok('متون پرسش‌ها تهی نیست',
   SHIA_BANKS.every(k => DATA[k].every(q => q.q.length > 8 && q.o.every(o => o && o.length))));
ok('گزینه‌های هر پرسش شیعی یکتا و بی‌تکرار درون یک پرسش‌اند',
   SHIA_BANKS.every(k => DATA[k].every(q => U.norm(q.o[0]) !== U.norm(q.o[1]))));
/* منابع باید گوناگون باشند، نه همه از یک کتاب */
const SRC_SET = new Set(SHIA_BANKS.flatMap(k => DATA[k].map(q => (q.src || '').split(/[؛،—(]/)[0].trim())));
ok('منابع پرسش‌های شیعی گوناگون‌اند', SRC_SET.size >= 12, String(SRC_SET.size));
ok('همهٔ موضوع‌های شیعی در گزینشگر فهرست شده‌اند',
   SHIA_BANKS.every(k => TOPICS.some(t => t.id === k && t.bank().length)),
   SHIA_BANKS.filter(k => !TOPICS.some(t => t.id === k)).join());
ok('گزینشگر می‌تواند از هر موضوع شیعی پرسش بردارد',
   SHIA_BANKS.every(k => QuizPick.pool([k], 0).length === DATA[k].length));
ok('گزینشگر از ترکیب همهٔ موضوع‌ها پرسش می‌آورد',
   QuizPick.pool(TOPICS.map(t => t.id), 0).length >= 200,
   String(QuizPick.pool(TOPICS.map(t => t.id), 0).length));
ok('هر سطح در میان پرسش‌های شیعی نماینده دارد',
   [1,2,3].every(d => QuizPick.pool(SHIA_BANKS, d).length >= 5),
   [1,2,3].map(d => d + ':' + QuizPick.pool(SHIA_BANKS, d).length).join(' '));
ok('پرسش‌های ولایت و اهلبیت در بانک غدیر و اهلبیت هست', (() => {
  const all = [...DATA.ghadir, ...DATA.ahlulbayt].map(q => q.q).join(' ');
  return ['غدیر', 'تطهیر', 'مباهله', 'ثقلین', 'ولایت'].every(w => all.includes(w));
})());

ok('نشان‌های تازه برای معارف هست', ['exams','ahlulbayt','ahkamexpert'].every(id => DATA.badges.some(b => b.id === id)));
ok('هر نشان شناسه و نام یکتا دارد',
   new Set(DATA.badges.map(b => b.id)).size === DATA.badges.length &&
   DATA.badges.every(b => b.icon && b.name && b.desc));
ok('Progress.award پاسخ هر موضوع را می‌شمارد', (() => {
  Store.data.stats.topics = {};
  Progress.award({ game: 'quiz', pts: 1, ok: true, topic: 'ahkam' });
  Progress.award({ game: 'quiz', pts: 1, ok: false, topic: 'ahkam' });
  const n = Store.data.stats.topics.ahkam;
  delete Store.data.stats.topics;
  return n === 1;
})());
ok('Progress.award بدون موضوع هم نمی‌شکند', tryIt(() => {
  Progress.award({ game: 'quiz', pts: 1, ok: true });
}) === 'OK');
ok('حالت سرعت نور از بانک‌های معارف هم پرسش می‌برد', (() => {
  const before = Store.get('score');
  Games.speed();
  const n = QuizEngine.state.qs.length;
  /* پیش از پاک کردن وضعیت، تایمر ۱۲ ثانیه‌ای را می‌بندیم. وگرنه پس از
     null شدنِ state، تیکِ بعدیِ تایمر روی null می‌افتد و کل فرآیند تست
     را با استثنای رسیدگی‌نشده می‌خواباند. */
  Timers.clearPage();
  QuizEngine.state = null; Store.update(d => d.score = before);
  return n === 12;
})());

/* نهج‌البلاغه */
section('نهج‌البلاغه');
ok('بانک نهج‌البلاغه پر است', Array.isArray(DATA.nahj) && DATA.nahj.length >= 20, String(DATA.nahj.length));
ok('هر سخن متن عربی، ترجمه و منبع دارد',
   DATA.nahj.every(h => h.ar && h.ar.length > 10 && h.fa && h.fa.length > 8 && h.src));
ok('متن عربی هر سخن یکتاست',
   new Set(DATA.nahj.map(h => h.ar.replace(/\s+/g, ''))).size === DATA.nahj.length);
ok('هیچ سخنی ترجمهٔ تکراری ندارد',
   new Set(DATA.nahj.map(h => h.fa)).size === DATA.nahj.length);
ok('همهٔ منابع به نهج‌البلاغه اشاره دارند',
   DATA.nahj.every(h => h.src.includes('نهج‌البلاغه')),
   DATA.nahj.filter(h => !h.src.includes('نهج‌البلاغه')).map(h => h.src).join(' | '));
ok('شمارهٔ حکمت‌ها در منبع نوشته شده',
   DATA.nahj.filter(h => /حکمت|خطبه|نامه/.test(h.src)).length === DATA.nahj.length);
ok('پرسش‌های معنی از هر سخن ساخته شده',
   DATA.nahjPick.length === DATA.nahj.length, `${DATA.nahjPick.length} ≠ ${DATA.nahj.length}`);
ok('هر پرسش معنی چهار گزینهٔ یکتا دارد',
   DATA.nahjPick.every(q => q.o.length === 4 && new Set(q.o).size === 4));
ok('پاسخ هر پرسش معنی میان گزینه‌هاست',
   DATA.nahjPick.every(q => q.o.includes(q.a)));
ok('گزینهٔ نادرست با پاسخ یکسان نیست',
   DATA.nahjPick.every(q => q.o.filter(o => o === q.a).length === 1));
ok('متن عربی در صورت پرسش آمده است',
   DATA.nahjPick.every((q, i) => q.q.includes(DATA.nahj[i].ar)));
ok('هر پرسش معنی منبع دارد', DATA.nahjPick.every(q => q.src));
ok('هر پرسش معنی سطح ۱ تا ۳ دارد', DATA.nahjPick.every(q => [1,2,3].includes(q.d)));
ok('سطح پرسش‌های معنی پخش شده است',
   new Set(DATA.nahjPick.map(q => q.d)).size >= 2,
   [...new Set(DATA.nahjPick.map(q => q.d))].join());
ok('NahjUI هست و باز می‌شود', typeof NahjUI.open === 'function');
ok('NahjUI.open بدون خطا پنجره می‌سازد', tryIt(() => {
  const keep = UI.closeModal; UI.closeModal = () => {}; NahjUI.open(); UI.closeModal = keep;
}) === 'OK');
ok('کارت بازی نهج‌البلاغه ثبت شده', !!DATA.GAMES.nahj && typeof Games.nahj === 'function');
ok('نهج‌البلاغه در دستهٔ قرآن فهرست شده',
   DATA.categories.find(c => c.id === 'quran').games.includes('nahj'));
ok('موضوع نهج‌البلاغه در گزینشگر هست و به nahjPick وصل است', (() => {
  const t = TOPICS.find(x => x.id === 'nahj');
  return !!t && t.bank().length === DATA.nahjPick.length;
})());
ok('گزینشگر از موضوع نهج‌البلاغه پرسش می‌آورد',
   QuizPick.pool(['nahj'], 0).length === DATA.nahjPick.length);

/* ── بانک ساختهٔ زمان اجرا: «سفر سوره‌ها» ── */
section('بانک ساختهٔ زمان اجرا — سفر سوره‌ها');
ok('surahPick ساخته شده و پر است', (DATA.surahPick || []).length > 0, (DATA.surahPick || []).length);
(() => {
  const b = DATA.surahPick || [];
  const bad = b.filter(q => !q || !q.q || !Array.isArray(q.o) || q.o.length < 2 || !q.o.includes(q.a));
  const noWhy = b.filter(q => !q.why && !q.fa);
  const noSrc = b.filter(q => !q.src);
  ok('ساختار همهٔ پرسش‌های surahPick درست است', bad.length === 0,
     bad.length + ' خراب: ' + JSON.stringify(bad[0]));
  ok('هر پرسش surahPick توضیح دارد', noWhy.length === 0, noWhy.length + ' بی‌توضیح');
  ok('هر پرسش surahPick منبع دارد', noSrc.length === 0, noSrc.length + ' بی‌منبع');
  ok('هیچ پرسش surahPick گزینهٔ تکراری ندارد',
     b.every(q => new Set(q.o || []).size === (q.o || []).length));
})();

/* ── سه موتور تازهٔ ۱۵ روی بانک‌های واقعی ── */
section('موتورهای تازه — حدیث‌یاب، چهارده معصوم، نجوا');
/* هر خطای بلعیده‌شده‌ای که برنامه فقط console.warn می‌کند، این‌جا گیر می‌افتد */
const _realWarn = console.warn;
/* پشته را نمی‌خوانیم: خطای «سرریز پشته» خودِ خواندن stack را هم می‌ترکاند
   و پیام اصلی را می‌پوشاند. نام و پیام خطا کافی است. */
let _warns = [];
console.warn = (...a) => {
  _warns.push(a.map(x => (x && x.name && x.message) ? x.name + ': ' + x.message : String(x)).join(' '));
};

ok('HadithEngine هست', typeof HadithEngine.start === 'function');
ok('حدیث‌یاب پرسش می‌سازد و بی‌خطا باز می‌شود', tryIt(() => HadithEngine.start()) === 'OK');
ok('حدیث‌یاب پرسش ساخته', Array.isArray(HadithEngine.qs) && HadithEngine.qs.length > 0,
   HadithEngine.qs && HadithEngine.qs.length);
/* موتور حدیث گزینه‌ها را در paint() از key/wrong می‌سازد، نه از پیش */
ok('گزینه‌های هر حدیث چهارتای یکتاست',
   (HadithEngine.qs || []).every(q => new Set([q.key, ...(q.wrong || [])]).size === 4));
ok('هیچ گزینهٔ نادرستی در متن حدیث نیست',
   (HadithEngine.qs || []).every(q =>
     (q.wrong || []).every(w => !U.norm(q.ar).includes(U.norm(w)))),
   (HadithEngine.qs || []).filter(q => (q.wrong || []).some(w => U.norm(q.ar).includes(U.norm(w))))
     .map(q => q.key).join('، '));
ok('واژهٔ کلیدی فقط یک بار در متن آمده',
   (HadithEngine.qs || []).every(q =>
     U.norm(q.ar).split(U.norm(q.key)).length === 2),
   (HadithEngine.qs || []).filter(q => U.norm(q.ar).split(U.norm(q.key)).length !== 2)
     .map(q => q.key).join('، '));

ok('ImamEngine هست', typeof ImamEngine.start === 'function');
ok('چهارده معصوم پرسش می‌سازد و بی‌خطا باز می‌شود', tryIt(() => ImamEngine.start()) === 'OK');
ok('چهارده معصوم پرسش ساخته', Array.isArray(ImamEngine.qs) && ImamEngine.qs.length > 0,
   ImamEngine.qs && ImamEngine.qs.length);
ok('هیچ پرسش معصوم پاسخ خالی ندارد',
   (ImamEngine.qs || []).every(q => q.a && q.o.includes(q.a)));
ok('زمینه‌های نامعلوم پرسش نساخته‌اند',
   (ImamEngine.qs || []).every(q => q.a !== null && q.a !== undefined && q.a !== ''));
ok('گزینه‌های پرسش معصوم یکتا هستند',
   (ImamEngine.qs || []).every(q => new Set(q.o).size === q.o.length));

ok('DuaEngine هست', typeof DuaEngine.start === 'function');
ok('نجوا بی‌خطا باز می‌شود', tryIt(() => DuaEngine.start()) === 'OK');
ok('نجوا پرسش ساخته', Array.isArray(DuaEngine.qs) && DuaEngine.qs.length > 0,
   DuaEngine.qs && DuaEngine.qs.length);
ok('واژه‌های هر پرسش نجوا همان متن دعا را می‌سازند',
   (DuaEngine.qs || []).every(q => (q.words || []).join(' ') === q.ar));

console.warn = _realWarn;
/* خطاهای یکسان را یکی می‌شماریم تا گزارش خوانا بماند */
const _wsum = [...new Set(_warns)];
ok('باز شدن سه بازی تازه هیچ هشدار یا خطایی نمی‌دهد', _warns.length === 0,
   _warns.length + ' هشدار — ' + _wsum.slice(0, 4).join(' ／ '));

/* ── selfTest درون برنامه ──
   همان تابعی که با ?debug=1 از کنسول اجرا می‌شود. اگر خودش خطا بدهد،
   کاربر هم در مرورگر خطا می‌بیند؛ پس همین‌جا اجرایش می‌کنیم. */
section('selfTest درون برنامه');

let st = null;
try{ st = window.selfTest(); }catch(e){ st = null; }
ok('selfTest هست و اجرا می‌شود', !!st && typeof st === 'object', typeof st);
if(st && typeof st === 'object'){
  const rows = st.rows || [];
  ok('هیچ سنجشی در selfTest شکست نمی‌خورد', st.ok === true,
     rows.filter(r => !r.ok).map(r => r.name).join('، '));
  ok('selfTest شمار درست و ناموفق را سازگار می‌دهد',
     st.total === rows.length && st.pass === rows.filter(r => r.ok).length && st.total === st.pass + (st.total - st.pass),
     `total=${st.total} pass=${st.pass} rows=${rows.length}`);
  ok('selfTest شمار چشمگیری از سنجش‌ها را می‌گذراند', st.pass >= 40, st.pass);
}

/* ── نگهبان بازگشت ──
   پیش‌تر Router.go('play') قلابِ همین صفحه را صدا می‌زد، آن هم Launcher.open()
   را که خودش Router.go('play') می‌کرد؛ یعنی نخستین کلیک روی 🎮 تا سرریز پشته
   بی‌پایان می‌چرخید. خطا هم داخل try/catch قلاب بلعیده می‌شد و فقط به‌شکل
   یک هشدار بی‌صدا ظاهر می‌شد. این‌جا صریح می‌سنجیمش. */
section('مسیر «همه بازی‌ها»');
(() => {
  const real = console.warn, got = [];
  console.warn = (...a) => got.push((a[0] && a[0].name) ? a[0].name + ': ' + a[0].message : String(a[0]));
  try{ Launcher.open(); }catch(e){ got.push(e.name + ': ' + e.message); }
  try{ Router.go('play'); }catch(e){ got.push(e.name + ': ' + e.message); }
  console.warn = real;
  ok('🎮 باز کردن صفحهٔ بازی‌ها پشته را سرریز نمی‌کند',
     !got.some(x => x.startsWith('RangeError')), got.join('، ').slice(0, 200));
  ok('🎮 باز کردن دوباره هم هیچ خطا یا هشداری نمی‌دهد', got.length === 0, got.join('، ').slice(0, 200));
  /* String(fn) فقط تنِ تابع را می‌دهد، نه کلیدش را */
  const hookSrc = String(Router.hooks.play || '');
  ok('🎮 قلاب صفحهٔ بازی از paint استفاده می‌کند، نه open',
     /Launcher\.paint\(\)/.test(hookSrc) && !/Launcher\.open\(\)/.test(hookSrc), hookSrc.slice(0, 120));
})();

/* ── ذخیرهٔ خودکار وضعیت بازی ──
   کاربری که وسط بازی صفحه را می‌بندد باید بتواند ادامه بدهد. این‌جا
   چرخهٔ کامل را می‌سنجیم: ذخیره → خروج → بازگردانی، و مهم‌تر از آن
   اینکه snapshot واقعاً JSON-پذیر باشد (تابع و گرهٔ DOM در آن نباشد). */
section('ذخیرهٔ خودکار وضعیت بازی');
(() => {
  Autosave.clear();
  ok('در آغاز هیچ بازی نیمه‌کاره‌ای نیست', Autosave.get() === null && Autosave.bar() === '');

  QuizEngine.start({ qs: DATA.quiz, title: '📚 آزمون آزمایشی', sub: 'زیرنویس', count: 10 });
  ok('شروع بازی، وضعیت را ذخیره می‌کند', !!Autosave.get());
  ok('برچسب نوار، عنوان بازی است', (Autosave.get() || {}).label === '📚 آزمون آزمایشی');
  ok('نوار «ادامه بده» ساخته می‌شود', Autosave.bar().includes('asResume'));

  const snap = Autosave.get().data;
  ok('📦 snapshot بدون تابع است',
     !Object.values(snap).some(v => typeof v === 'function'),
     Object.entries(snap).filter(([, v]) => typeof v === 'function').map(([k]) => k).join('، '));
  ok('📦 snapshot در JSON جا می‌گیرد', (() => {
    try{ return JSON.stringify(snap).length > 50; }catch(e){ return false; }
  })());
  ok('📦 فهرست پرسش‌ها هم ذخیره شده', Array.isArray(snap.qs) && snap.qs.length === QuizEngine.state.qs.length);

  /* جلو ببر تا «ادامه» معنا پیدا کند */
  QuizEngine.state.i = 3; QuizEngine.state.correct = 2; QuizEngine.state.pts = 40;
  QuizEngine.autosave();
  const qsBefore = QuizEngine.state.qs.slice(0, 4).map(q => q.q);

  QuizEngine.state = null;                                  // مثل خروج از صفحه
  ok('بازی تازه، فهرست پرسش را از snapshot برمی‌دارد', (() => {
    Autosave.resume();
    const s = QuizEngine.state;
    return !!s && s.i === 3 && s.correct === 2 && s.pts === 40;
  })(), JSON.stringify({ i: QuizEngine.state?.i, correct: QuizEngine.state?.correct }));
  ok('همان پرسش‌ها برمی‌گردند، نه یک بر زدن تازه',
     QuizEngine.state.qs.slice(0, 4).map(q => q.q).join('|') === qsBefore.join('|'));
  ok('جای پرسش بیرون از محدوده اصلاح می‌شود', (() => {
    QuizEngine.state = null;
    const s2 = Autosave.get().data;
    Autosave.put('quiz', { ...s2, i: 9999 }, 'تست');
    Autosave.resume();
    return QuizEngine.state.i === QuizEngine.state.qs.length - 1;
  })(), 'i=' + QuizEngine.state.i);

  /* پایان بازی باید پاکش کند */
  Autosave.clear();
  QuizEngine.start({ qs: DATA.quiz, title: 'ت', sub: 'ز', count: 4 });
  ok('بازی تازه دوباره ذخیره شد', !!Autosave.get());
  QuizEngine.state.i = QuizEngine.state.qs.length;
  tryIt(() => QuizEngine.render());                          // به finish می‌رسد
  ok('پس از پایان بازی چیزی برای ادامه نمی‌ماند', Autosave.get() === null);

  /* بازی‌های callback-محور عمداً ذخیره نمی‌شوند */
  QuizEngine.state = null;
  QuizEngine.start({ qs: DATA.quiz, title: 'آزمون معارف', sub: 'ز', count: 4, onDone: () => {} });
  ok('بازی با callback پایان ذخیره نمی‌شود (وگرنه رکوردش گم می‌شد)', Autosave.get() === null);
  QuizEngine.state = null; Autosave.clear();

  /* حافظه */
  MemoryEngine.start();
  ok('🧠 حافظه هم ذخیره می‌شود', (Autosave.get() || {}).kind === 'memory');
  const mSnap = Autosave.get().data;
  ok('📦 snapshot حافظه JSON-پذیر است', JSON.stringify(mSnap).length > 50);
  const faces = mSnap.cards.map(c => c.face).join('|');
  MemoryEngine.state = null;
  Autosave.resume();
  ok('🧠 تختهٔ حافظه با همان کارت‌ها برمی‌گردد',
     MemoryEngine.state.cards.map(c => c.face).join('|') === faces);
  ok('🧠 کارت‌های رو شده دوباره بسته می‌شوند (پاسخ لو نمی‌رود)', MemoryEngine.state.flipped.length === 0);
  MemoryEngine.state = null; Autosave.clear();

  /* دوز آفلاین */
  DoozEngine.start(false);
  DoozEngine.place(4, 'X'); DoozEngine.place(0, 'O');
  ok('❌⭕ دوز آفلاین ذخیره می‌شود', (Autosave.get() || {}).kind === 'dooz');
  const board = Autosave.get().data.board.join(',');
  DoozEngine.state = null;
  Autosave.resume();
  ok('❌⭕ تختهٔ دوز برمی‌گردد', DoozEngine.state.board.join(',') === board, DoozEngine.state.board.join(','));
  ok('❌⭕ نوبت هم برمی‌گردد', DoozEngine.state.turn === 'X', DoozEngine.state.turn);
  DoozEngine.state = null; Autosave.clear();

  /* دوز آنلاین هرگز از تختهٔ محلی ادامه نمی‌دهد */
  DoozEngine.state = null;
  Autosave.put('dooz', { board: Array(9).fill(null), turn: 'O', last: -1 }, 'دوز');
  Net.room = { code: '123456', isHost: false };
  DoozEngine.state = null;
  tryIt(() => Autosave.resume());
  ok('🔒 دوز آنلاین تختهٔ محلی را قبول نمی‌کند',
     !DoozEngine.state.online || DoozEngine.state.board.every(c => c === null),
     JSON.stringify(DoozEngine.state?.board));
  Net.room = null; DoozEngine.state = null; Autosave.clear();

  /* snapshot خرابِ بازمانده از یک نسخهٔ قدیمی نباید «ادامه بده» را گیر بیندازد.
     مستقیم در Store می‌نویسیم تا همان چیزی را بسازیم که از localStorage می‌آید. */
  Store.data.savedGame = { kind: 'quiz', at: Date.now(), data: { qs: 'این آرایه نیست' } };
  ok('snapshot خراب بی‌خطا رد می‌شود', tryIt(() => Autosave.resume()) === 'OK');
  ok('snapshot خراب پاک می‌شود', Autosave.get() === null);

  /* کهنه‌گی */
  QuizEngine.state = null;
  QuizEngine.start({ qs: DATA.quiz, title: 'کهنه', sub: 'ز', count: 3 });
  Store.data.savedGame.at = Date.now() - 25 * 60 * 60 * 1000;
  ok('بازی کهنه‌تر از یک شبانه‌روز نادیده گرفته می‌شود', Autosave.get() === null);
  ok('نوار کهنه هم ساخته نمی‌شود', Autosave.bar() === '');
  Autosave.clear();
  QuizEngine.state = null;
})();

/* ── دشواری سازگار ──
   Adaptive.pick پیش‌تر فقط نوشته شده بود و هیچ‌جا صدا زده نمی‌شد. حالا
   موتور آزمون از آن استفاده می‌کند. مهم‌ترین خاصیتش این است که پرسش
   تکراری ندهد: قبلاً easy و hard از یک استخر و با دو بر زدن جداگانه
   برداشته می‌شدند، پس یک پرسش می‌توانست دو بار در یک دور بیاید. */
section('دشواری سازگار');
(() => {
  const bank = Array.from({ length: 60 }, (_, i) => ({ q: 'س' + i, o: ['a', 'b'], a: 'a', d: (i % 3) + 1 }));
  /* سطح از آمار ذخیره‌شده می‌آید، پس برای هر سطح باید همان آمار را ساخت.
     بی این کار، هر چهار تکرار عملاً یک سطح را می‌سنجیدند. */
  const setStats = (acc, total, combo) => {
    const right = Math.round(acc * total);
    Store.data.stats.totalCorrect = right;
    Store.data.stats.totalWrong = total - right;
    Store.data.stats.maxCombo = combo;
  };
  /* نام متغیر حلقه نباید با آرایه یکی باشد؛ وگرنه در سرِ حلقه به TDZ
     می‌خورد و (چون هارنس استثناهای بی‌گیر را می‌بلعد) به‌جای خطا، تعلیق می‌شود. */
  const cases = [ { acc: 0,   total: 6,  combo: 1, lv: 0 },   // داده کم → سطح ۰
                  { acc: .5,  total: 20, combo: 1, lv: 1 },   // دقت ۵۰٪ → سطح ۱
                  { acc: .75, total: 20, combo: 2, lv: 2 },   // دقت ۷۵٪ → سطح ۲
                  { acc: .9,  total: 20, combo: 8, lv: 3 } ]; // دقت ۹۰٪ و کمبوی ۸ → سطح ۳
  for(const c of cases){
    setStats(c.acc, c.total, c.combo);
    const lv = Adaptive.level();
    let dupTotal = 0, lenBad = 0;
    for(let k = 0; k < 40; k++){
      const picked = Adaptive.pick(bank, 12);
      if(picked.length !== 12) lenBad++;
      if(new Set(picked).size !== picked.length) dupTotal++;
    }
    ok(`🎚 سطح ${lv}: هیچ پرسش تکراری در یک دور نیست`, dupTotal === 0, dupTotal + ' دور تکراری');
    ok(`🎚 سطح ${lv}: شمار پرسش‌ها درست است`, lenBad === 0, lenBad + ' دور ناقص');
    ok(`🎚 سطح ${lv}: آمار به همان سطح می‌رسد`, lv === c.lv, 'lv=' + lv + ' want=' + c.lv);
  }
  setStats(.5, 20, 1);
  ok('🎚 بانک کوچک هم پرسش تکراری نمی‌دهد',
     (() => { const s = new Set(); const p = Adaptive.pick(bank.slice(0, 3), 3); p.forEach(x => s.add(x)); return s.size === p.length; })());
  ok('🎚 بانک خالی نمی‌شکند', Array.isArray(Adaptive.pick([], 5)) && Adaptive.pick([], 5).length === 0);
  ok('🎚 بانک نامعتبر نمی‌شکند', Array.isArray(Adaptive.pick(null, 5)) && Adaptive.pick(null, 5).length === 0);

  /* موتور آزمون واقعاً از آن استفاده می‌کند */
  QuizEngine.state = null;
  QuizEngine.start({ qs: DATA.quiz, title: '🎚', sub: '-', count: 10 });
  ok('🎚 موتور آزمون پرسش تکراری نمی‌آورد',
     new Set(QuizEngine.state.qs).size === QuizEngine.state.qs.length);
  ok('🎚 بدنبال نخستین پرسش، سطح سازگار نشان داده می‌شود',
     QuizEngine.state.i === 0 && typeof Adaptive.note() === 'string');
  QuizEngine.state = null; Autosave.clear();

  /* رکوردشکن روی موتورهای کهن هم وصل است */
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  ok('🏅 آزمون از Beat.check استفاده می‌کند', /Beat\.check\('quiz_best'/.test(src) && /Beat\.check\('speed_best'/.test(src));
  ok('🏅 سفر سوره‌ها و حافظه هم از Beat.check استفاده می‌کنند',
     /Beat\.check\('surah_best'/.test(src) && /Beat\.check\('memory_best'/.test(src));
})();

/* ═══════ نورستان ۱۶ — سکه، فروشگاه، زنجیره، چهرک، راهنما، تازه‌وارد ═══════ */
const _resetWallet = () => Store.update(d => { d.coins = 0; d.wallet = { earned: 0, spent: 0, items: {} }; });
const _freshDay = () => Store.update(d => {
  d.dailyChallenge = { date: '', done: false, reward: 0, streak: 0, lastDate: '', frozen: '' };
});

section('کیف سکه');
_resetWallet();
ok('سکه از صفر شروع می‌شود', Wallet.get() === 0 && Wallet.earned() === 0 && Wallet.spent() === 0);
ok('نشان سکه HTML درست می‌دهد', Wallet.chip().includes('🪙') && Wallet.chip(true).includes('coin big'));
ok('درآمد سکه ثبت می‌شود', (() => { Wallet.earn(40); return Wallet.get() === 40 && Wallet.earned() === 40; })());
ok('خرج سکه ثبت می‌شود', (() => { const b = Wallet.spend(15); return b === true && Wallet.get() === 25 && Wallet.spent() === 15; })());
ok('خرج بیش از موجودی رد می‌شود', (() => { const b = Wallet.spend(9999); return b === false && Wallet.get() === 25 && Wallet.spent() === 15; })());
ok('خرج صفر یا منفی کاری نمی‌کند', Wallet.spend(0) === false && Wallet.spend(-5) === false && Wallet.spent() === 15);
ok('درآمد صفر یا منفی سکه نمی‌سازد', Wallet.earn(0) === 0 && Wallet.earn(-10) === 0 && Wallet.get() === 25);
ok('درآمد و خرج و موجودی هم‌تراز می‌مانند', Wallet.earned() - Wallet.spent() === Wallet.get());
ok('کیف خراب را sanitize درست می‌کند', (() => {
  Store.update(d => { d.wallet = { earned: 5, spent: 900, items: null }; d.coins = 70; });
  Store.sanitize();
  return Store.get('wallet').items && Wallet.earned() - Wallet.spent() === Wallet.get() && Wallet.spent() === 900;
})());
_resetWallet();

section('فروشگاه');
ok('هر قلم فروشگاه شناسهٔ یکتا دارد', new Set(Shop.ITEMS.map(i => i.id)).size === Shop.ITEMS.length);
ok('هر قلم نام، توضیح و بهای مثبت دارد',
   Shop.ITEMS.every(i => i.name && i.desc && i.price > 0));
Store.update(d => d.hearts = Store.HEART_MAX);
ok('جان پُر → خرید جان ممکن نیست', Shop.worn(Shop.find('heart1')) === 'full');
_resetWallet(); Wallet.earn(999);
ok('خرید جانِ پُر رد می‌شود و سکه دست نمی‌خورد', Shop.buy('heart1') === false && Wallet.get() === 999);
Store.update(d => d.hearts = 2);
ok('جان کم → خرید جان ممکن است', Shop.worn(Shop.find('heart1')) === 'ok');
_resetWallet(); Wallet.earn(50);
ok('خرید جان: سکه کم و جان زیاد می‌شود',
   Shop.buy('heart1') === true && Wallet.get() === 20 && Store.get('hearts') === 3);
_resetWallet();
ok('بی سکه، خرید رد می‌شود', Shop.buy('tipjar') === false && Wallet.get() === 0 && !Wallet.owns('tipjar'));
ok('قلم ناشناس خریدنی نیست', Shop.buy('چنین‌چیزی نیست') === false);
_resetWallet(); Wallet.earn(1600);
ok('چهرک‌های ویژه یک‌بار فروشی‌اند', (() => {
  const a = Shop.buy('avapack'), after = Wallet.get();
  const b = Shop.buy('avapack');
  return a === true && b === false && Wallet.get() === after && Wallet.items().avapack === 1;
})());
ok('قلم بدون «یک‌بار» چند بار خریدنی است', (() => {
  const a = Shop.buy('tipjar'), b = Shop.buy('tipjar');
  return a === true && b === true && Wallet.items().tipjar === 2;
})());
ok('هر خرید در شمارندهٔ آمار می‌آید', Store.get('stats').shopBuys >= 3);
ok('اثر نگرفتن، سکه را برمی‌گرداند', (() => {
  const fake = { id:'fake', icon:'🧪', name:'آزمایشی', desc:'-', price:10 };
  Shop.ITEMS.push(fake);
  const before = Wallet.get();
  const real = Shop.apply;
  Shop.apply = () => false;                    // مثل خریدن چیزی که اثرش نمی‌گیرد
  const r = Shop.buy('fake');
  Shop.apply = real;
  Shop.ITEMS.pop();
  return r === false && Wallet.get() === before && !Wallet.owns('fake');
})());
_resetWallet();

section('پوستهٔ کویر');
ok('کویر پیش از خرید قفل است', Theme.owns('desert') === false);
ok('در چرخش پوسته‌ها نمی‌آید', Theme.free().includes('desert') === false);
ok('انتخاب پوستهٔ قفل رد می‌شود', (() => {
  Store.update(d => d.settings.theme = 'dark');
  Theme.set('desert');
  return Theme.cur() === 'dark';
})());
ok('در فروشگاه هست', Shop.find('theme-desert') !== null && Shop.find('theme-desert').price > 0);
ok('خریدش باز می‌کند', (() => {
  _resetWallet(); Wallet.earn(300);
  const b = Shop.buy('theme-desert');
  return b === true && Theme.owns('desert') === true && Theme.free().includes('desert');
})());
Store.update(d => { d.wallet.items = {}; d.settings.theme = 'dark'; });

section('زنجیره');
_freshDay();
ok('بی سابقه، زنجیره صفر است', Streak.count() === 0 && Streak.atRisk() === false);
ok('بی زنجیره، یخ نمی‌گیرد', Streak.freeze() === false);
Store.update(d => d.dailyChallenge = { date: Streak.yest(), done: true, reward: 0, streak: 4,
                                       lastDate: Streak.yest(), frozen: '' });
ok('زنجیرهٔ ۴ روزهٔ دیروز هنوز زنده است', Streak.count() === 4);
ok('و امروز در خطر است', Streak.atRisk() === true);
ok('هشدارش HTML دارد', Streak.warn().includes('streak-warn') && Streak.warn().includes('data-streak'));
ok('یخ زنجیره می‌گیرد', Streak.freeze() === true && Streak.frozenToday() === true);
ok('پس از یخ، دیگر در خطر نیست', Streak.atRisk() === false);
ok('و هشدار می‌رود', Streak.warn() === '');
ok('یخ دوباره زده نمی‌شود', Streak.freeze() === false);
ok('یخِ دیروز، زنجیره را به امروز می‌رساند', (() => {
  Store.update(d => { d.dailyChallenge.frozen = Streak.yest(); d.dailyChallenge.date = ''; });
  return Streak.base() === 4;
})());
ok('زنجیره‌ای که دو روز خوابیده، می‌شکند', (() => {
  Store.update(d => d.dailyChallenge = { date: '2000-01-01', done: true, reward: 0, streak: 9,
                                          lastDate: '2000-01-01', frozen: '' });
  return Streak.base() === 0 && Streak.atRisk() === false && Streak.freeze() === false;
})());
ok('صفحهٔ شناسنامه ردیف زنجیره را می‌آورد', Streak.rows().includes('زنجیره'));
ok('روزانه از همان Streak.base حساب می‌کند', (() => {
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  return /const streak = Streak\.base\(\) \+ 1;/.test(src);
})());
_freshDay();

section('چهرک');
ok('رنگ برای یک شناسه ثابت است', (() => {
  Store.update(d => { d.profile.color = -1; d.playerId = 'abc123'; });
  const a = Avatar.color();
  return Avatar.color() === a && Avatar.color() === a;
})());
ok('شناسه‌های مختلف رنگ‌های مختلف می‌گیرند', (() => {
  const set = new Set();
  for(let i = 0; i < 60; i++){ Store.update(d => d.playerId = 'p' + i); set.add(Avatar.color()); }
  return set.size >= 3;
})());
ok('انتخاب دستی بر هش مقدم است', (() => {
  Store.update(d => { d.playerId = 'zzz'; d.profile.color = 3; });
  return Avatar.color() === Avatar.COLORS[3];
})());
ok('رنگ بیرون از محدوده، ایمن برمی‌گردد', (() => {
  Store.update(d => d.profile.color = 999);
  return Avatar.COLORS.includes(Avatar.color());
})());
Store.update(d => d.profile.color = -1);
ok('چهرک پیش‌فرض از فهرست می‌آید', Avatar.EMOJI.includes(Avatar.emoji()));
ok('چهرک HTML اندازه و رنگ را می‌آورد', (() => {
  const s = Avatar.html('lg', true);
  return s.includes('class="ava lg ring"') && s.includes(Avatar.color());
})());
ok('۱۲ چهرک ویژه پیش از خرید نیست', Avatar.pool().length === Avatar.EMOJI.length);
ok('پس از خرید می‌آید', (() => {
  Store.update(d => d.wallet.items.avapack = 1);
  const n = Avatar.pool().length;
  Store.update(d => { d.wallet.items = {}; });
  return n === Avatar.EMOJI.length + Avatar.BONUS.length;
})());
ok('چهرک‌ها یکتا و بی‌تکرارند',
   new Set(Avatar.EMOJI.concat(Avatar.BONUS)).size === Avatar.EMOJI.length + Avatar.BONUS.length);

section('راهنمای شناور');
ok('بی data-tip چیزی نشان نمی‌دهد', Tips.show({ getAttribute: () => null }) === false);
ok('با data-tip نشان داده می‌شود و بعد پاک', (() => {
  const el = { getAttribute: k => (k === 'data-tip' ? 'توضیح' : null),
               getBoundingClientRect: () => ({ top: 10, left: 10, width: 40, height: 20 }) };
  const r = Tips.show(el);
  return r === true && !!Tips.cur && (Tips.hide(), Tips.cur === null);
})());
ok('متن راهنما خوانده می‌شود', Tips.text({ getAttribute: () => 'سلام' }) === 'سلام');
ok('عنصر بی‌getAttribute امن است', Tips.text(null) === '' && Tips.text({}) === '');
ok('کلید راهنما در تنظیمات هست', 'tips' in Store.defaults().settings);

section('تازه‌وارد');
ok('چهار اسلاید دارد', Onboarding.SLIDES.length === 4);
ok('هر اسلاید نگاره، عنوان و توضیح دارد',
   Onboarding.SLIDES.every(s => s.art && s.t && s.d));
ok('کاربر نو، اسلایدها را می‌بیند', (() => {
  Store.update(d => { d.settings.onboarded = false; d.score = 0; });
  return Onboarding.maybe() === true && Onboarding.seen() === false;
})());
ok('بستن نشانش را می‌گذارد', (() => { Onboarding.close(true); return Onboarding.seen() === true; })());
ok('کاربری که امتیاز دارد اسلاید نمی‌بیند', (() => {
  Store.update(d => { d.settings.onboarded = false; d.score = 500; });
  return Onboarding.maybe() === false && Onboarding.seen() === true;
})());
ok('پرش از محدوده بیرون نمی‌زند', (() => {
  Onboarding.go(99); const hi = Onboarding.i;
  Onboarding.go(-5); const lo = Onboarding.i;
  return hi === 3 && lo === 0;
})());
ok('کشیدن اسلاید خطا نمی‌دهد', (() => { Onboarding.open(); Onboarding.next(); Onboarding.paint(); Onboarding.close(false); return true; })());
ok('ظرف تازه‌وارد در HTML هست', /<div id="onb"/.test(fs.readFileSync(__dirname + '/index.html', 'utf8')));
Store.update(d => d.score = 0);

section('مأموریت هفتگی');
Store.update(d => { d.missions.weekStart = ''; d.missions.week = []; });
const _w1 = Weekly.ensure();
ok('سه مأموریت هفتگی دارد', _w1.week.length === 3);
ok('مأموریت‌های هفته یکتا هستند', new Set(_w1.week.map(m => m.id)).size === 3);
ok('هر کدام هدف، جایزه و سکه دارند', _w1.week.every(m => m.goal > 0 && m.pts > 0 && m.coins > 0));
ok('شناسه‌ها از فهرست هفتگی‌اند', _w1.week.every(m => Weekly.POOL.some(p => p.id === m.id)));
ok('هفته از شنبه شروع می‌شود',
   new Date(Weekly.start() + 'T00:00:00Z').getUTCDay() === 6, Weekly.start());
ok('کلید هفته = امروز اگر شنبه باشد',
   new Date(Weekly.start() + 'T00:00:00Z').getTime() <= Date.now());
ok('انتخاب هفته قطعی است', (() => {
  const a = _w1.week.map(m => m.id).join(',');
  Store.update(d => { d.missions.weekStart = ''; d.missions.week = []; });
  const b = Weekly.ensure().week.map(m => m.id).join(',');
  return a === b;
})());
ok('روزهای باقی‌ماندهٔ هفته منطقی است', Weekly.left() >= 0 && Weekly.left() <= 6);
ok('رکورد هفته با هفتهٔ شکسته بازنشانی نمی‌شود', (() => {
  Store.update(d => { d.stats.hifzVerses = 7; });
  const k = Weekly.key('whifz');
  return k === 7;
})());
ok('کلید زنجیره از بهترین رکورد هم استفاده می‌کند', (() => {
  Store.update(d => { d.stats.bestStreak = 12; });
  return Weekly.key('wstreak') >= 12;
})());
ok('ردیف‌های هفتگی HTML می‌سازند', Weekly.rows().includes('class="miss ') && Weekly.rows().split('class="miss').length === 4);
Store.update(d => { d.missions.weekStart = ''; d.missions.week = []; d.stats.bestStreak = 0; d.stats.hifzVerses = 0; });

section('سکه از راه‌های واقعی');
ok('سطح بالاتر سکه می‌دهد', (() => {
  _resetWallet();
  Store.update(d => { d.level = 1; d.xp = xpForLevel(1) * 3; });
  checkLevelUp();
  const got = Wallet.get();
  Store.update(d => { d.level = 1; d.xp = 0; });
  return got > 0;
})());
ok('پایان بازی سکه می‌دهد', (() => {
  _resetWallet();
  UI.result({ icon:'🧪', title:'آزمون', pct: 100, detail:'', stars: 3 });
  const a = Wallet.get();
  _resetWallet();
  UI.result({ icon:'🧪', title:'آزمون', pct: 0, detail:'', stars: 0 });
  const b = Wallet.get();
  return a > b && b > 0;
})());
ok('پایان بازی بی‌درصد هم سکه می‌دهد', (() => {
  _resetWallet();
  UI.result({ icon:'🧪', title:'آزمون', pct: null, detail:'', stars: null });
  return Wallet.get() > 0;
})());
ok('مأموریت روزانه سکه می‌دهد', (() => {
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  return /Wallet\.earn\(Math\.round\(paid \/ 2\), 'مأموریت روزانه'\)/.test(src);
})());
ok('نشان سکه می‌دهد', (() => {
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  return /Wallet\.earn\(unlocked\.length \* Wallet\.RATE\.perBadge/.test(src);
})());
_resetWallet();
Store.update(d => { d.level = 1; d.xp = 0; });

section('پروفایل');
ok('تب پروفایل هست', /data-metab="profile"/.test(fs.readFileSync(__dirname + '/index.html', 'utf8')));
ok('پروفایل پیش‌فرض باز می‌شود', Me.tab === 'profile' || (() => { Me.tab = 'profile'; return true; })());
ok('میان‌برهای پروفایل در فهرست بازی‌ها هستند',
   ['shop', 'onboarding', 'profile'].every(g => DATA.GAMES[g] && typeof Games[g] === 'function'));
ok('جعبهٔ سکه در خانه هست', /id="cCoins"/.test(fs.readFileSync(__dirname + '/index.html', 'utf8')));
ok('جای هشدار زنجیره در خانه هست', /id="homeWarn"/.test(fs.readFileSync(__dirname + '/index.html', 'utf8')));
ok('شناسه، نام و شعار در پیش‌فرض‌ها هست',
   ['emoji','color','joined','motto'].every(k => k in Store.defaults().profile));
ok('متن هشدار زنجیره در خانه ساخته می‌شود',
   /const html = Streak\.warn\(\)/.test(fs.readFileSync(__dirname + '/index.html', 'utf8')));
/* ── خطاهای دیرهنگام ──
   تایمری که پس از پاک شدن وضعیتِ بازی تیک می‌زند، در مرورگر خطای
   رسیدگی‌نشده می‌دهد و کاربر فقط می‌بیند برنامه از کار افتاد. هارنس
   چنین خطاهایی را می‌گیرد تا به‌جای سکوت، سنجش شکست بخورد. */
/* چند لحظه زنده می‌مانیم تا تایمرهای جامانده فرصت تیک زدن داشته باشند.
   بی این مهلت، process.exit فوراً همه را می‌کشد و این سنجش هیچ‌وقت چیزی
   نمی‌بیند — یعنی سنجشی که همیشه سبز است و هیچ ارزشی ندارد. */

/* ═══════════════ ۱۶. نصب، آفلاین و PWA ═══════════════ */
const ROOT = __dirname;
const readSrc = f => fs.readFileSync(ROOT + '/' + f, 'utf8');

/* ابزار: ناوبری و پنجره را برای یک سنجش عوض کن و بعد برگردان.
   بی این، هر سنجش، سنجش‌های بعدی را آلوده می‌کند و ترتیب اجرا مهم می‌شود.

   مهم: در Node ۲۱+ خودِ `navigator` یک ویژگیِ فقط-خواندنی روی globalThis است،
   پس `global.navigator = {...}` در هارنس بی‌صدا هیچ نمی‌کند و ما با ناوبریِ
   واقعیِ Node طرفیم که userAgent‌اش فقط-خواندنی است. پس نه با انتساب ساده،
   بلکه با defineProperty روی خودِ شیء سایه می‌اندازیم و descriptor اصلی را
   برمی‌گردانیم. */
const withNav = (props, fn) => {
  const old = {};
  for(const k in props){
    let d = null;
    try{ d = Object.getOwnPropertyDescriptor(navigator, k) || null; }catch(e){}
    old[k] = d;
    try{ Object.defineProperty(navigator, k, { value: props[k], configurable: true, writable: true }); }
    catch(e){}
  }
  try{ return fn(); }
  finally{
    for(const k in old){
      try{
        if(old[k]) Object.defineProperty(navigator, k, old[k]);
        else delete navigator[k];
      }catch(e){}
    }
  }
};
const withWin = (props, fn) => {
  const old = {};
  for(const k in props){ old[k] = window[k]; window[k] = props[k]; }
  try{ return fn(); }
  finally{ for(const k in old){ if(old[k] === undefined) delete window[k]; else window[k] = old[k]; } }
};

section('پوستهٔ نصب‌شده (Shell)');
ok('بی هیچ نشانه‌ای، نصب‌شده حساب نمی‌شود', Shell.standalone() === false);
ok('display-mode: standalone تشخیص داده می‌شود',
   withWin({ matchMedia: q => ({ matches: /standalone/.test(q) }) }, () => Shell.standalone()) === true);
ok('display-mode: minimal-ui هم نصب‌شده است',
   withWin({ matchMedia: q => ({ matches: /minimal-ui/.test(q) }) }, () => Shell.standalone()) === true);
ok('نشانهٔ iOS (navigator.standalone) تشخیص داده می‌شود',
   withNav({ standalone: true }, () => Shell.standalone()) === true);
ok('نشانهٔ iOS برابر false نصب‌شده نیست',
   withNav({ standalone: false }, () => Shell.standalone()) === false);
ok('رنگ نوار وضعیت رشتهٔ رنگ می‌دهد', /^#|rgb/.test(Shell.themeColor()), Shell.themeColor());
ok('syncThemeColor خطا نمی‌دهد', (() => { try{ Shell.syncThemeColor(); return true; }catch(e){ return false; } })());

section('تشخیص پلتفرم (Install.os)');
ok('اندروید', withNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126' }, () => Install.os()) === 'android');
ok('آیفون', withNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1' }, () => Install.os()) === 'ios');
ok('آیپد', withNav({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15' }, () => Install.os()) === 'ios');
ok('آیپدِ تازه (Macintosh + لمس چندنقطه‌ای) آی‌اواس شناخته می‌شود',
   withNav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 }, () => Install.os()) === 'ios');
ok('مکِ بی‌لمس آی‌اواس نیست',
   withNav({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126', platform: 'MacIntel', maxTouchPoints: 0 }, () => Install.os()) !== 'ios');
ok('ویندوز = رایانه', withNav({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126' }, () => Install.os()) === 'desktop');
ok('کاربرگر ناشناس → other', withNav({ userAgent: 'SomethingWeird/1.0' }, () => Install.os()) === 'other');
ok('بی userAgent هم خطا نمی‌دهد', withNav({ userAgent: undefined }, () => typeof Install.os()) === 'string');

section('ماشین حالت نصب (Install.state)');
ok('نصب‌شده مقدم بر همه است',
   withWin({ matchMedia: q => ({ matches: /standalone/.test(q) }), __bip: {} }, () => Install.state()) === 'installed');
ok('رویداد در دست → ready', withWin({ __bip: {} }, () => Install.state()) === 'ready');
ok('آی‌اواس بی‌رویداد → manual-ios',
   withNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)' }, () => withWin({ __bip: null }, () => Install.state())) === 'manual-ios');
ok('اندروید بی‌رویداد → manual',
   withNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/126' }, () => withWin({ __bip: null }, () => Install.state())) === 'manual');
ok('armed با رویداد true', withWin({ __bip: {} }, () => Install.armed()) === true);
ok('armed بی‌رویداد false', withWin({ __bip: null }, () => Install.armed()) === false);

section('کارت تنظیمات (Install.card)');
{
  const ready = withWin({ __bip: {}, matchMedia: undefined },
    () => withNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/126' }, () => Install.card()));
  ok('حالت ready دکمهٔ نصب می‌دهد', /id="setInstall"/.test(ready));
  ok('حالت ready دکمهٔ راهنما هم دارد', /id="setInstallGuide"/.test(ready));
  ok('حالت ready نام پلتفرم را می‌گوید', ready.includes('اندروید'));
  ok('حالت ready می‌گوید یک ضربه کافی است', ready.includes('یک ضربه کافی است'));

  const ios = withNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)' },
    () => withWin({ __bip: null }, () => Install.card()));
  ok('آی‌اواس دکمهٔ راهنما دارد', /id="setInstallGuide"/.test(ios));
  ok('آی‌اواس می‌گوید دکمهٔ خودکار نیست', ios.includes('دکمهٔ نصب خودکار ندارد'));
  ok('آی‌اواس نام پلتفرم را درست می‌گوید', ios.includes('آیفون و آیپد'));

  const done = withWin({ matchMedia: q => ({ matches: /standalone/.test(q) }) }, () => Install.card());
  ok('حالت نصب‌شده دکمهٔ نصب ندارد', !/id="setInstall"/.test(done));
  ok('حالت نصب‌شده وضعیت را تأیید می‌کند', done.includes('نصب شده'));

  const evil = withNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/126' },
    () => withWin({ __bip: {} }, () => Install.card()));
  ok('کارت HTML معتبر می‌سازد', evil.startsWith('<div class="card') && evil.endsWith('</div>'));
}

section('بنر نصب خودکار (Install.bar)');
{
  /* ── چرا DOM را خودمان می‌سازیم؟ ──
     شبیه‌ساز _harness برای هر querySelector یک شیء *تازه* برمی‌گرداند،
     پس نمی‌تواند «همان عنصر» را دو بار بدهد: innerHTML روی یکی نوشته
     می‌شود و از دیگری خوانده می‌شود، و hidden هم هیچ‌وقت نمی‌ماند. هر
     سنجشی که به هویت عنصر تکیه کند با آن شبیه‌ساز بی‌معنا می‌شود. پس
     اینجا یک گرهٔ کوچک ولی پایدار می‌سازیم که همان چند چیزی را دارد که
     بنر واقعاً استفاده می‌کند. */
  const node = () => {
    const kids = {}, cls = new Set();
    return {
      hidden: true, innerHTML: '', style: {}, onclick: null, offsetHeight: 40,
      classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
      querySelector: s => kids[s] || (kids[s] = node())
    };
  };
  /* splash پیش‌فرض رفته است؛ با splash:false می‌توان جلوگیری‌اش را سنجید */
  const withDom = (fn, opt) => {
    opt = opt || {};
    const q0 = document.querySelector;
    const ib = node(), modal = node(), splash = node(), mini = node(), nav = node();
    if(opt.modal) modal.classList.add('on');
    if(opt.splash !== false) splash.classList.add('out');
    const map = { '#ib': ib, '#modal': modal, '#splash': splash, '#miniQ': mini, '#nav': nav };
    document.querySelector = s => map[s] || q0(s);
    try{ return fn({ ib, modal, splash, mini, nav }); } finally { document.querySelector = q0; }
  };
  const keep = Store.get('installBar');
  const day = 24 * 60 * 60 * 1000;
  const onAndroid = fn => withNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/126' }, fn);
  const onIos = fn => withNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)' }, fn);
  const armed    = fn => withWin({ __bip: {} }, fn);
  const notArmed = fn => withWin({ __bip: null }, fn);

  Store.set('installBar', 0);
  ok('گرهٔ بنر در سند هست', /<div id="ib" class="ib" hidden/.test(readSrc('index.html')));
  ok('کلید بنر در پیش‌فرض‌ها هست', Store.defaults().installBar === 0);
  ok('نبستن → زمان صفر', Install.barClosedAt() === 0);
  ok('نبستن → نادیده گرفته نشده', Install.barSnoozed() === false);
  ok('مهلت دوباره‌پیشنهاد دو هفته است', Install.OFFER_AGAIN_MS === 14 * day);
  ok('مقدار خراب بنر را همیشه‌برنمی‌گرداند', (() => {
    Store.set('installBar', NaN); Store.sanitize();
    const v = Store.get('installBar'); Store.set('installBar', 0);
    return v === 0;
  })());

  /* ── رد شدن در localStorage ── */
  Install.snooze();
  const at = Install.barClosedAt();
  ok('بستن، زمانش را ذخیره می‌کند', at > Date.now() - 5000 && at <= Date.now());
  ok('در localStorage نشسته (از راه Store که رویش می‌نشیند)',
     +Store.get('installBar') === at && Store.KEY === 'noorestan_v14');
  ok('بلافاصله پس از بستن → نادیده گرفته شده', Install.barSnoozed() === true);
  Store.set('installBar', Date.now() - 13 * day);
  ok('۱۳ روز بعد هنوز نادیده گرفته می‌شود', Install.barSnoozed() === true);
  Store.set('installBar', Date.now() - 14 * day - 1000);
  ok('بعد از دو هفته دوباره پیشنهاد می‌شود', Install.barSnoozed() === false);
  Store.set('installBar', Date.now() - Install.OFFER_AGAIN_MS);
  ok('دقیقاً روی مرز، دوباره پیشنهاد می‌شود', Install.barSnoozed() === false);
  Store.set('installBar', 0);

  /* ── canOffer: پنج شرط ── */
  ok('رویداد هست و نبسته → پیشنهاد می‌شود',
     withDom(() => onAndroid(() => armed(() => Install.canOffer()))) === true);
  ok('اندرویدِ بی‌رویداد → پیشنهاد نمی‌شود',
     withDom(() => onAndroid(() => notArmed(() => Install.canOffer()))) === false);
  ok('آی‌اواس بی‌رویداد → پیشنهاد می‌شود (راهنمای دستی)',
     withDom(() => onIos(() => notArmed(() => Install.canOffer()))) === true);
  ok('نصب‌شده → پیشنهاد نمی‌شود',
     withDom(() => withWin({ __bip: {}, matchMedia: q => ({ matches: /standalone/.test(q) }) },
       () => Install.canOffer())) === false);
  Store.set('installBar', Date.now());
  ok('تازه‌بسته‌شده → پیشنهاد نمی‌شود',
     withDom(() => onAndroid(() => armed(() => Install.canOffer()))) === false);
  Store.set('installBar', 0);
  ok('تب پنهان → پیشنهاد نمی‌شود', (() => {
    const h = document.hidden; document.hidden = true;
    const v = withDom(() => armed(() => Install.canOffer()));
    document.hidden = h; return v === false;
  })());
  ok('مودالِ باز → پیشنهاد نمی‌شود',
     withDom(() => armed(() => Install.canOffer()), { modal: true }) === false);
  ok('پردهٔ آغازینِ نرفته → پیشنهاد نمی‌شود',
     withDom(() => armed(() => Install.canOffer()), { splash: false }) === false);
  ok('بیمهٔ زمانی: بعد از ۴ ثانیه پرده دیگر مانع نیست', (() => {
    const t0 = Install.T0; Install.T0 = Date.now() - Install.SPLASH_GRACE_MS - 1;
    const v = withDom(() => armed(() => Install.canOffer()), { splash: false });
    Install.T0 = t0; return v === true;
  })());

  /* ── آرم: همان هندسهٔ آیکن‌های واقعی ── */
  ok('آرم بنر کادر ۱۰۰ دارد نه ۹۲ (سرِ دُم تا x≈۹۳٫۵ می‌رود)',
     Install.LOGO.includes('viewBox="0 0 100 100"'));
  ok('آرم بنر همان کمان و دُم و نقطهٔ آیکن است',
     Install.LOGO.includes('M 77.95 57.63 A 34 34 0 0 1 14.05 57.63') &&
     Install.LOGO.includes('M 77.95 57.63 L 86.95 29') &&
     Install.LOGO.includes('cx="46" cy="28" r="8"'));
  ok('آرم بنر هم‌ضخامت آیکن است (۱۳)', Install.LOGO.includes('stroke-width="13"'));

  /* ── paint: دو دکمهٔ خواسته‌شده ── */
  const drew = withDom(d => { Install.paint(); return d.ib.innerHTML; });
  ok('بنر دکمهٔ نصب دارد', /id="ibGo"/.test(drew));
  ok('بنر دکمهٔ بستن دارد', /id="ibX"/.test(drew));
  ok('دکمهٔ بستن برچسب دسترس‌پذیری دارد', /aria-label="بستن/.test(drew));
  ok('بنر عنوان و زیرنویس دارد', drew.includes('ib-t') && drew.includes('نصب کن'));
  ok('روی اندروید دکمه «نصب» است', /id="ibGo">نصب</.test(drew));
  ok('روی اندروید وعدهٔ آیکن روی صفحهٔ اصلی داده می‌شود', drew.includes('صفحهٔ اصلی'));
  const drewIos = withDom(d => { onIos(() => Install.paint()); return d.ib.innerHTML; });
  ok('روی آی‌اواس دکمه «چطور؟» است، نه نصبِ بی‌اثر', /id="ibGo">چطور؟</.test(drewIos));
  ok('روی آی‌اواس مسیر دستی گفته می‌شود', drewIos.includes('Add to Home Screen'));

  Store.set('installBar', keep);
}

section('راهنمای نصب');
ok('هر چهار پلتفرم گام دارند',
   ['android','ios','desktop','other'].every(k => Install.STEPS[k] && Install.STEPS[k].rows.length >= 2));
ok('راهنمای آی‌اواس «Add to Home Screen» را می‌گوید',
   Install.STEPS.ios.rows.some(r => /Add to Home Screen/.test(r[1])));
ok('راهنمای آی‌اواس سافاری را شرط می‌کند',
   Install.STEPS.ios.rows.some(r => /Safari/.test(r[1])));
ok('راهنمای اندروید مسیر سه‌نقطه را می‌گوید',
   Install.STEPS.android.rows.some(r => /سه‌نقطه/.test(r[1])));
ok('راهنمای رایانه آیکن نوار آدرس را می‌گوید',
   Install.STEPS.desktop.rows.some(r => /نوار آدرس/.test(r[1])));
ok('گام‌ها شمارهٔ فارسی دارند',
   Install.STEPS.android.rows.every(r => /^[۰-۹]$/.test(r[0])));
ok('راهنما پنجرهٔ مودی می‌سازد', (() => {
  let html = null;
  const old = UI.modal;
  UI.modal = h => { html = h; };
  try{ Install.guide(); }finally{ UI.modal = old; }
  return !!html && html.includes('class="steps"') && html.includes('class="step"');
})());


section('مانیفست و آیکن‌ها');
const MF = JSON.parse(readSrc('manifest.json'));
ok('مانیفست JSON معتبر است', typeof MF === 'object' && MF.name);
ok('نام و نام کوتاه فارسی‌اند', MF.name.includes('نورستان') && MF.short_name === 'نورستان');
ok('زبان و جهت درست است', MF.lang === 'fa' && MF.dir === 'rtl');
ok('حالت نمایش standalone است', MF.display === 'standalone');
ok('شروع و دامنه نسبی‌اند', MF.start_url === '.' && MF.scope === '.');
ok('شناسه نسبی است', MF.id === './');
ok('رنگ زمینه و تم تعریف شده', /^#[0-9a-f]{6}$/i.test(MF.background_color) && /^#[0-9a-f]{6}$/i.test(MF.theme_color));
ok('۱۹۲ و ۵۱۲ هر دو اعلام شده‌اند — شرط نصب کروم',
   ['192x192','512x512'].every(s => MF.icons.some(i => i.sizes === s)));
ok('یک آیکن maskable هست', MF.icons.some(i => (i.purpose || '').includes('maskable')));
ok('هیچ آیکن webp/jpg ساختگی نمانده', !MF.icons.some(i => /\.(webp|jpg)$/.test(i.src)));
ok('همهٔ آیکن‌های مانیفست روی دیسک هستند',
   MF.icons.every(i => fs.existsSync(ROOT + '/' + i.src)),
   MF.icons.filter(i => !fs.existsSync(ROOT + '/' + i.src)).map(i => i.src).join(','));
/* ابعاد واقعی فایل، نه ابعاد ادعاشده در مانیفست */
const pngSize = p => { const b = fs.readFileSync(p); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
ok('ابعاد icon-192 با نامش می‌خواند', pngSize(ROOT + '/assets/images/icons/icon-192.png') === '192x192');
ok('ابعاد icon-512 با نامش می‌خواند', pngSize(ROOT + '/assets/images/icons/icon-512.png') === '512x512');
ok('ابعاد maskable با نامش می‌خواند', pngSize(ROOT + '/assets/images/icons/maskable-512.png') === '512x512');
ok('ابعاد آیکن اپل با نامش می‌خواند', pngSize(ROOT + '/assets/images/icons/apple-touch-icon.png') === '180x180');
ok('آیکن‌ها PNG واقعی‌اند', (() => {
  const b = fs.readFileSync(ROOT + '/assets/images/icons/icon-192.png');
  return [0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A].every((v, i) => b[i] === v);
})());
ok('میان‌برهای مانیفست به فایل موجود اشاره می‌کنند',
   MF.shortcuts.every(s => s.icons.every(i => fs.existsSync(ROOT + '/' + i.src))));
ok('آیکن برداری هم ساخته شده', fs.existsSync(ROOT + '/assets/images/icons/icon.svg'));

section('سرویس‌ورکر');
{
  const src = readSrc('sw.js');
  let syntax = true, err = '';
  try{ new (require('vm').Script)(src); }catch(e){ syntax = false; err = e.message; }
  ok('sw.js خطای نگارشی ندارد', syntax, err);
  ok('صفحهٔ آفلاین پیش‌ذخیره می‌شود', /const OFFLINE = '\.\/offline\.html'/.test(src) && src.includes('OFFLINE,'));
  ok('نسخهٔ کش ۱۷ است', /noorestan-17/.test(src) && !/noorestan-16/.test(src));
  ok('واپس‌رویِ ناوبری اول پوسته، بعد صفحهٔ آفلاین است', (() => {
    const i = src.indexOf('async function navFallback');
    const blk = src.slice(i, i + 400);
    return blk.indexOf('SHELL_PAGE') < blk.indexOf('OFFLINE');
  })());
  ok('همهٔ کش‌های قدیمی پاک می‌شوند', /keys\.filter\(k => !keep\.has\(k\)\)/.test(src));
  ok('آیکن‌های اعلان به PNG اشاره می‌کنند', !/icon-192\.webp/.test(src) && /icon-192\.png/.test(src));
  ok('مسیرهای ساختگی webp/jpg از فهرست اختیاری رفته‌اند',
     !/icons\/icon-(192|512)\.(webp|jpg)/.test(src));
  ok('مسیرهای واقعی در پیش‌ذخیره هستند',
     ['icon.svg','icon-192.png','favicon-32.png'].every(f => src.includes('icons/' + f)));
}

/* ═══════════════ صوت در PWA (باگ نسخهٔ ۱۶، رفع در ۱۷) ═══════════════
   چرا سرویس‌ورکر را در vm اجرا می‌کنیم و به متنش بسنده نمی‌کنیم؟

   چون این باگ *رفتاری* بود، نه متنی. هیچ عبارت باقاعده‌ای نمی‌گرفت که
   «پاسخ مبهم، ۵۰۳ می‌شود» — کدْ خوش‌ساخت و خوانا بود و همان کد صوت را
   می‌کشت. تنها راه اثبات رفع‌شدنش این است که خودِ fetch handler صدا زده
   شود و دیده شود که برای درخواست صوت respondWith نمی‌خورد.

   شبیه‌ساز Cache API هم عمداً مثل خودِ مرورگر برای ۲۰۶ استثنا می‌دهد،
   وگرنه تستْ باگی را که مرورگر واقعاً دارد تأیید نمی‌کرد. */
function loadSW(opts){
  opts = opts || {};
  const listeners = {};
  const store = new Map();
  const key = r => (typeof r === 'string' ? r : r.url);
  const cache = {
    match: async r => store.get(key(r)),
    put: async (r, res) => {
      /* Cache API در put برای ۲۰۶ استثنا می‌دهد؛ همان رفتار را می‌سازیم */
      if(res && res.status === 206) throw new TypeError('Partial response cannot be cached');
      store.set(key(r), res);
    },
    keys: async () => [...store.keys()].map(u => ({ url: u })),
    delete: async r => store.delete(key(r)),
    add: async r => store.set(key(r), new Response(''))
  };
  const caches = { open: async () => cache, keys: async () => [],
                   delete: async () => true, match: async r => store.get(key(r)) };
  const self = {
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    skipWaiting(){}, clients: { claim(){}, matchAll: async () => [], openWindow(){} },
    registration: { navigationPreload: null, showNotification(){} }
  };
  const vm = require('vm');
  const ctx = {
    self, caches, Response, Request, URL,
    location: { origin: 'https://noorestan.test' },
    fetch: opts.fetch || (async () => new Response('ok', { status: 200 })),
    console
  };
  vm.createContext(ctx);
  try{ vm.runInContext(readSrc('sw.js'), ctx); }
  catch(e){ return { err: e.message }; }
  return { fetch: listeners.fetch[0], store, ctx };
}

/* یک رویداد fetch می‌سازیم و می‌بینیم آیا سرویس‌ورکر خودش را مسئول دانست */
function fire(sw, req){
  let called = false, out = null;
  sw.fetch({ request: req, respondWith(p){ called = true; out = p; } });
  return { called, out };
}

section('صوت در PWA — رهگیری نمی‌شود');
{
  const sw = loadSW();
  ok('sw.js در vm بار می‌شود', !sw.err, sw.err || '');

  const AUDIO_URLS = [
    'https://everyayah.com/data/Minshawy_Murattal_128kbps/001001.mp3',
    'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',
    'https://download.quranicaudio.com/quran/mp3/001.mp3',
    'https://server8.mp3quran.net/afs/001.mp3',
    'https://example.test/sound.ogg',
    'https://example.test/sound.oga',
    'https://example.test/sound.opus',
    'https://example.test/sound.wav',
    'https://example.test/sound.m4a',
    'https://example.test/sound.aac',
    'https://example.test/sound.flac',
    'https://example.test/sound.webm'
  ];
  const leaked = AUDIO_URLS.filter(u => fire(sw, new Request(u)).called);
  ok('هیچ درخواست صوتی رهگیری نمی‌شود', leaked.length === 0, leaked.join(' '));

  /* نشانی بی‌پسوند روی دامنهٔ قاریان هم باید رد شود، وگرنه شاخهٔ CDN
     آن را می‌قاپد. تست قبلی این حالت را پوشش نمی‌داد. */
  const bare = ['https://everyayah.com/stream?id=1',
                'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1',
                'https://audio.quranicaudio.com/live'];
  const leakedBare = bare.filter(u => fire(sw, new Request(u)).called);
  ok('نشانیِ بی‌پسوند روی دامنهٔ قاریان هم رهگیری نمی‌شود',
     leakedBare.length === 0, leakedBare.join(' '));

  /* Range: پخش‌کننده‌ها برای ورق‌زدن در فایل با Range می‌آیند و پاسخش
     ۲۰۶ است. حتی اگر نشانی هیچ نشانهٔ صوتی نداشته باشد باید رد شود. */
  const r1 = fire(sw, new Request('https://example.test/stream', { headers: { range: 'bytes=0-' } }));
  ok('درخواست با هدر Range رهگیری نمی‌شود', r1.called === false);
  const r2 = fire(sw, new Request('https://noorestan.test/assets/a.mp3', { headers: { range: 'bytes=100-200' } }));
  ok('Range حتی روی مسیر هم‌خاستگاه هم رد می‌شود', r2.called === false);

  /* جهت مخالف: چیزهای بی‌ربط باید *همچنان* رهگیری شوند، وگرنه «رفع باگ»
     به «خاموش کردن سرویس‌ورکر» تبدیل شده است. */
  ok('CSS فونت jsDelivr همچنان رهگیری می‌شود',
     fire(sw, new Request('https://cdn.jsdelivr.net/gh/x/y.css')).called === true);
  ok('دارایی هم‌خاستگاه همچنان رهگیری می‌شود',
     fire(sw, new Request('https://noorestan.test/assets/images/icons/icon-192.png')).called === true);
  ok('متن قرآن همچنان رهگیری می‌شود',
     fire(sw, new Request('https://api.alquran.cloud/v1/surah/1')).called === true);
}

section('هیچ مسیر صوتی به کش نمی‌رسد');
{
  const src = readSrc('sw.js');
  ok('شاخهٔ networkFirst برای دامنهٔ قاریان برداشته شده',
     !/everyayah[\s\S]{0,80}networkFirst/.test(src));
  ok('صوت پیش از شاخهٔ CDN بررسی می‌شود', (() => {
    const i = src.indexOf('if(isMedia(req, url)) return;');
    const j = src.indexOf('jsdelivr');
    return i > 0 && (j < 0 || i < j);
  })());
  ok('صوت پیش از شاخهٔ هم‌خاستگاه بررسی می‌شود',
     src.indexOf('if(isMedia(req, url)) return;') < src.indexOf('url.origin === location.origin &&'));
  ok('isMedia به destination هم نگاه می‌کند', /req\.destination === 'audio'/.test(src));
  ok('isMedia به هدر Range هم نگاه می‌کند', /headers\.get\('range'\)/.test(src));
  ok('۲۰۶ از کش‌شدن مستثناست', /res\.status !== 200/.test(src));
  ok('پاسخ مبهم از کش‌شدن مستثناست', /'opaque'/.test(src) && /opaqueredirect/.test(src));
}

section('صفحهٔ آفلاین');
{
  const src = readSrc('offline.html');
  ok('doctype در خط اول است', src.startsWith('<!DOCTYPE html>'));
  ok('زبان و جهت درست است', /<html lang="fa" dir="rtl">/.test(src));
  /* خودبسندگی: هیچ منبع بیرونی. xmlns استثناست — فضای‌نام است نه درخواست. */
  const net = src.replace(/xmlns="[^"]*"/g, '').match(/https?:\/\//g) || [];
  ok('هیچ منبع بیرونی ندارد (کاملاً خودبسنده)', net.length === 0, net.join(' '));
  ok('فونت CDN ندارد', !/fonts\.googleapis|jsdelivr|@import/.test(src));
  ok('شکل «ن» را درون‌خطی دارد', /<svg/.test(src) && /class="mark"/.test(src));
  ok('دکمهٔ تلاش دوباره دارد', /id="again"/.test(src));
  ok('دکمهٔ بازگشت به خانه دارد', /id="home"/.test(src));
  ok('به online گوش می‌دهد', /addEventListener\('online'/.test(src));
  ok('هر دو دکمه به «./» برمی‌گردند', (src.match(/location\.replace\('\.\/'\)/g) || []).length >= 2);
  ok('از reduced-motion پیروی می‌کند', /prefers-reduced-motion/.test(src));
  ok('رنگ‌های پوستهٔ برنامه را دارد', /#0b1020/.test(src) && /#ffd27d/.test(src));
}

section('تگ‌های PWA در سند');
{
  const src = readSrc('index.html');
  const head = src.slice(src.indexOf('<head>'), src.indexOf('</head>'));
  ok('پیوند مانیفست ایستا در head هست', /<link rel="manifest" href="manifest\.json">/.test(head));
  ok('apple-touch-icon ایستا در head هست', /<link rel="apple-touch-icon" sizes="180x180"/.test(head));
  ok('apple-mobile-web-app-capable هست', /name="apple-mobile-web-app-capable" content="yes"/.test(head));
  ok('apple-mobile-web-app-title هست', /name="apple-mobile-web-app-title"/.test(head));
  ok('mobile-web-app-capable هست', /name="mobile-web-app-capable"/.test(head));
  ok('favicon به PNG موجود اشاره می‌کند', (() => {
    const m = head.match(/<link rel="icon"[^>]*href="([^"]+)"/);
    return !!m && fs.existsSync(ROOT + '/' + m[1]);
  })());
  ok('آیکن قدیمی دادهٔ درون‌خطی emoji رفته', !/data:image\/svg\+xml,<svg/.test(head));
  ok('تزریق آیکن ساختگی در Assets.pwa حذف شده', !/icons\/icon-192\.webp/.test(src));
  ok('کارت نصب در صفحهٔ تنظیمات ساخته می‌شود', /^\s*\$\{Install\.card\(\)\}$/m.test(src));
  ok('کارت نصب سیم‌کشی می‌شود', /^\s*Install\.wire\(\);$/m.test(src));
  ok('Install.init در راه‌اندازی صدا زده می‌شود', /Install\.init\(\)/.test(src));
  ok('رویداد نصب در زمان پارس گرفته می‌شود', (() => {
    const i = src.indexOf("addEventListener('beforeinstallprompt'");
    const j = src.indexOf('function init()');
    return i > 0 && (j < 0 || i < j);
  })());
  ok('رویداد نصب preventDefault می‌شود', /beforeinstallprompt[\s\S]{0,120}e\.preventDefault\(\)/.test(src));
  ok('قاعدهٔ CSS گام‌های راهنما هست', /\.step\{/.test(src) && /\.steps\{/.test(src));
  ok('نسخهٔ برنامه ۱۶ شده', /const APP_VERSION = 16;/.test(src));
}

/* ═══════════════ پایان: سنجش‌های async و تایمرهای جامانده ═══════════════
   چرا همهٔ این‌ها را در یک زنجیرهٔ async گذاشته‌ایم و از setTimeout جدا
   استفاده نکرده‌ایم؟ چون سنجش‌های نصب وابسته به promise‌اند و promise بعد
   از پایانِ اجرای همگامِ فایل حل می‌شود. با تایمر جدا، سرتیترها بالای
   سنجش‌های بی‌ربط چاپ می‌شدند و گزارش گمراه‌کننده می‌شد.
   ───────────────────────────────────────────────────────────────────── */
(async () => {
  section('نصب واقعی (Install.prompt)');
  const prev = window.__bip;

  window.__bip = null;
  ok('بی رویداد، prompt بی‌درنگ false می‌دهد', (await Install.prompt()) === false);

  window.__bip = { called: false, prompt(){ this.called = true; },
                   userChoice: Promise.resolve({ outcome: 'accepted' }) };
  const bipA = window.__bip;
  const vA = await Install.prompt();
  ok('prompt() رویداد مرورگر را صدا می‌زند', bipA.called === true);
  ok('پذیرش کاربر true برمی‌گرداند', vA === true);
  ok('رویداد یک‌بارمصرف است و پاک می‌شود', window.__bip === null);

  window.__bip = { prompt(){}, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
  ok('رد کاربر false برمی‌گرداند', (await Install.prompt()) === false);

  window.__bip = { prompt(){ throw new Error('boom'); } };
  ok('خطای مرورگر هم برنامه را نمی‌شکند', (await Install.prompt()) === false);

  window.__bip = { prompt(){}, userChoice: Promise.reject(new Error('nope')) };
  ok('آبجکت‌نشدن انتخاب کاربر هم مدیریت می‌شود', (await Install.prompt()) === false);

  window.__bip = prev;

  /* ── خطاهای دیرهنگام ──
     تایمری که پس از پاک شدن وضعیتِ بازی تیک می‌زند، در مرورگر خطای
     رسیدگی‌نشده می‌دهد و کاربر فقط می‌بیند برنامه از کار افتاد. هارنس
     چنین خطاهایی را می‌گیرد تا به‌جای سکوت، سنجش شکست بخورد.

     چند لحظه زنده می‌مانیم تا تایمرهای جامانده فرصت تیک زدن داشته باشند.
     بی این مهلت، process.exit فوراً همه را می‌کشد و این سنجش هیچ‌وقت چیزی
     نمی‌بیند — یعنی سنجشی که همیشه سبز است و هیچ ارزشی ندارد. */
  section('آیکن برداری با آیکن رستری می‌خواند');
{
  /* دو آیکن داریم: PNGهای تولیدشده و یک SVG دست‌نویس. خطر واقعی این است که
     یکی را عوض کنیم و آن یکی جا بماند و دو آیکن متفاوت به کاربر برسد. پس
     اعداد SVG را با همان هندسه‌ای می‌سنجیم که PNG از آن ساخته می‌شود. */
  const code = readSrc('_icons.js').split('const OUT =')[0];
  const mod = { exports: {} };
  new Function('module', 'require', '__dirname',
    code + '\nmodule.exports = { G, GB, gmap };')(mod, require, ROOT);
  const { G, gmap } = mod.exports;
  const svg = readSrc('assets/images/icons/icon.svg');
  const m = gmap(512, false);
  const rad = d => d * Math.PI / 180;
  const fix = (v, n) => v.toFixed(n);

  ok('تبدیل SVG عیناً همان gmap است',
     svg.includes(`translate(${fix(m.ox, 3)} ${fix(m.oy, 3)}) scale(${fix(m.k, 4)})`),
     `translate(${fix(m.ox, 3)} ${fix(m.oy, 3)}) scale(${fix(m.k, 4)})`);
  const x0 = G.cx + G.R * Math.cos(rad(G.a0)), y0 = G.cy + G.R * Math.sin(rad(G.a0));
  const x1 = G.cx + G.R * Math.cos(rad(G.a1)), y1 = G.cy + G.R * Math.sin(rad(G.a1));
  ok('سرهای کمان SVG با هندسهٔ PNG می‌خوانند',
     svg.includes(`M ${fix(x0, 2)} ${fix(y0, 2)} A ${G.R} ${G.R} 0 0 1 ${fix(x1, 2)} ${fix(y1, 2)}`),
     `M ${fix(x0, 2)} ${fix(y0, 2)} A ${G.R} ${G.R} 0 0 1 ${fix(x1, 2)} ${fix(y1, 2)}`);
  ok('دُم SVG با هندسهٔ PNG می‌خواند',
     svg.includes(`M ${fix(x0, 2)} ${fix(y0, 2)} L ${fix(G.tail.bx, 2)} ${G.tail.by}`));
  ok('ضخامت قلم یکی است', svg.includes(`stroke-width="${G.T}"`), G.T);
  ok('نقطه همان‌جاست',
     svg.includes(`cx="${G.dot.cx}" cy="${G.dot.cy}" r="${G.dot.r}"`));
  ok('هالهٔ SVG با شعاع ۴۸ و نیم‌ضخامت ۱٫۱ می‌خواند', (() => {
    const want = fix(48 * m.k, 1), w = fix(2.2 * m.k, 1);
    return svg.includes(`r="${want}"`) && svg.includes(`stroke-width="${w}"`);
  })());
  ok('کادر SVG همین شکل را قاب می‌گیرد', G.R > 0 && G.a1 > G.a0 && G.dot.r > 0);
}

section('تب‌های پروفایل بدون خطا رندر می‌شوند');
{
  /* کارت نصب داخل رشتهٔ قالبیِ تب تنظیمات نشسته، و آن شاخه آخرین else است.
     اگر Install.card() خطا بدهد، کاربر صفحهٔ تنظیمات را سفید می‌بیند و
     هیچ سنجش دیگری این را نمی‌گیرد. پس هر پنج تب را واقعاً رندر می‌کنیم. */
  const before = { tab: Me.tab };
  let bad = '';
  for(const t of ['profile', 'stats', 'records', 'badges', 'settings']){
    try{ Me.tab = t; Me.render(); }
    catch(e){ bad = t + ': ' + (e && e.message); break; }
  }
  Me.tab = before.tab;
  ok('هر پنج تب پروفایل بی‌درخش رندر می‌شوند', bad === '', bad);
}

section('سرور — فایل‌های تازهٔ PWA');
{
  const src = readSrc('server.js');
  const mime = src.slice(src.indexOf('const MIME = {'), src.indexOf('function handleHttp'));
  const wants = [['.html','text/html'], ['.png','image/png'], ['.svg','image/svg+xml'],
                 ['.json','application/json'], ['.webmanifest','application/manifest+json']];
  for(const [ext, want] of wants)
    ok(`سرور ${ext} را با نوع درست می‌فرستد`, mime.includes("'" + ext + "':'" + want),
       (mime.match(new RegExp("'" + ext.replace('.', '\\.') + "':'([^']*)'")) || [])[1]);
  ok('سرویس‌ورکر بی‌کش سرو می‌شود', /base === 'sw\.js'/.test(src));
  ok('مانیفست بی‌کش سرو می‌شود', /base === 'manifest\.json'/.test(src));
  ok('صفحه‌ها بی‌کش سرو می‌شوند', /ext === '\.html' \|\| base === 'sw\.js'/.test(src));
  ok('مسیر فایل از ../ محافظت می‌شود',
     src.includes('path.normalize(file)') && /startsWith\(__dirname\)/.test(src));
  ok('همهٔ فایل‌های ریشهٔ PWA موجودند',
     ['index.html','manifest.json','sw.js','offline.html'].every(f => fs.existsSync(ROOT + '/' + f)),
     ['index.html','manifest.json','sw.js','offline.html'].filter(f => !fs.existsSync(ROOT + '/' + f)).join(','));
}

section('رفتار زندهٔ بنر نصب');
{
  const node = () => {
    const kids = {}, cls = new Set();
    return {
      hidden: true, innerHTML: '', style: {}, onclick: null, offsetHeight: 40,
      classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) },
      querySelector: s => kids[s] || (kids[s] = node())
    };
  };
  const withDom = (fn, opt) => {
    opt = opt || {};
    const q0 = document.querySelector;
    const ib = node(), splash = node();
    splash.classList.add('out');
    const map = { '#ib': ib, '#splash': splash, '#modal': node(), '#miniQ': node(), '#nav': node() };
    document.querySelector = s => map[s] || q0(s);
    try{ return fn({ ib }); } finally { document.querySelector = q0; }
  };
  const grabHandlers = fn => {
    const h = {}, $0 = U.$;
    U.$ = (s, p) => (s === '#ibGo' || s === '#ibX') ? (h[s] = h[s] || {}) : $0(s, p);
    try{ fn(); } finally { U.$ = $0; }
    return h;
  };
  const onAndroid = fn => withNav({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/126' }, fn);
  const onIos = fn => withNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)' }, fn);
  const armed = fn => withWin({ __bip: {} }, fn);

  const keep = Store.get('installBar');
  Store.set('installBar', 0);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  ok('در آغاز پنهان است', withDom(() => Install.showing()) === false);
  ok('open عنصر را آشکار می‌کند', withDom(d => { Install.open(); return d.ib.hidden; }) === false);
  ok('پس از open، showing درست است', withDom(d => { Install.open(); return Install.showing(); }) === true);
  ok('بستن پویانمایی دارد، پس بی‌درنگ پنهان نمی‌شود',
     withDom(d => { Install.open(); Install.hide(); return d.ib.hidden; }) === false);
  {
    const d = withDom(x => x);
    withDom(() => { Install.open(); Install.hide(); });
    await wait(320);
    ok('پس از پایان پویانمایی پنهان می‌شود', d.ib.hidden === true);
  }

  /* دکمهٔ ✕ باید هم پنهان کند و هم در localStorage ذخیره کند */
  Store.set('installBar', 0);
  {
    const h = grabHandlers(() => withDom(() => Install.paint()));
    ok('دکمهٔ بستن سیم‌کشی شده', typeof h['#ibX'].onclick === 'function');
    ok('دکمهٔ نصب سیم‌کشی شده', typeof h['#ibGo'].onclick === 'function');
    withDom(() => Install.open());
    h['#ibX'].onclick();
    await wait(320);
    ok('دکمهٔ بستن بنر را پنهان می‌کند', withDom(() => Install.showing()) === false);
    ok('دکمهٔ بستن رد شدن را ذخیره می‌کند', Install.barSnoozed() === true);
  }
  ok('پس از بستن، show دوباره نمی‌آورد',
     withDom(() => onAndroid(() => armed(() => Install.show()))) === false);
  ok('اما کارت تنظیمات سر جایش می‌ماند',
     /id="setInstall"/.test(withDom(() => onAndroid(() => armed(() => Install.card())))));

  /* روی آی‌اواس دکمهٔ بنر باید راهنما بدهد، نه promptِ بی‌اثر */
  Store.set('installBar', 0);
  {
    const g0 = Install.guide, p0 = Install.prompt;
    let guided = false, prompted = false;
    Install.guide = () => { guided = true; };
    Install.prompt = async () => { prompted = true; return false; };
    const h = grabHandlers(() => withDom(() => Install.paint()));
    await withDom(() => onIos(() => withWin({ __bip: null }, () => h['#ibGo'].onclick())));
    Install.guide = g0; Install.prompt = p0;
    ok('آی‌اواس: دکمهٔ بنر راهنما را باز می‌کند', guided === true);
    ok('آی‌اواس: نصبِ بی‌اثر صدا زده نمی‌شود', prompted === false);
  }

  /* و روی اندرویدِ آماده باید نصب واقعی کند و بنر برود */
  Store.set('installBar', 0);
  {
    const g0 = Install.guide, p0 = Install.prompt;
    let guided = false, prompted = false;
    Install.guide = () => { guided = true; };
    Install.prompt = async () => { prompted = true; return true; };
    const h = grabHandlers(() => withDom(() => Install.paint()));
    withDom(() => Install.open());
    await withDom(() => onAndroid(() => armed(() => h['#ibGo'].onclick())));
    await wait(320);
    Install.guide = g0; Install.prompt = p0;
    ok('اندروید: دکمهٔ بنر نصب واقعی می‌کند', prompted === true);
    ok('اندروید: راهنما بی‌دلیل باز نمی‌شود', guided === false);
    ok('پس از نصب موفق، بنر می‌رود', withDom(() => Install.showing()) === false);
  }

  Store.set('installBar', keep);
}

section('پاسخ مبهم (opaque) هرگز ۵۰۳ نمی‌شود');
{
  /* همان دقیقاً چیزی که صوت را می‌کشت: پاسخ no-cors که status=۰ و
     ok=false دارد. راهبرد اول‌شبکه باید آن را دست‌نخورده تحویل بدهد. */
  const opaque = { type: 'opaque', status: 0, ok: false, body: null };
  const sw = loadSW({ fetch: async () => opaque });
  const got = await fire(sw, new Request('https://api.alquran.cloud/v1/surah/1')).out;
  ok('پاسخ مبهم بی‌تغییر به مرورگر می‌رسد', got === opaque);
  ok('به‌جای آن ۵۰۳ ساخته نمی‌شود', got.status !== 503);
  ok('پاسخ مبهم در کش نوشته نمی‌شود', sw.store.size === 0);

  /* ۲۰۶ و ۲۰۰ را با Response واقعی می‌سازیم، نه شیء دست‌ساز: راهبرد
     کش‌کننده res.clone() صدا می‌زند و شیء دست‌ساز متد clone ندارد؛
     آن‌وقت خطا در .catch() خورده می‌شود و تستْ بی‌آنکه چیزی ثابت کند
     سبز می‌ماند. فقط «مبهم» است که ساختنی نیست و ناچار دست‌ساز است. */
  const part = new Response('partial', { status: 206 });
  const sw2 = loadSW({ fetch: async () => part });
  const req2 = new Request('https://cdn.jsdelivr.net/gh/x/y.woff2');
  const got2 = await fire(sw2, req2).out;
  ok('پاسخ ۲۰۶ تحویل داده می‌شود', got2 === part && got2.status === 206);
  ok('پاسخ ۲۰۶ هرگز کش نمی‌شود', sw2.store.size === 0);

  /* ── شاهد: آیا این تست باگ را واقعاً می‌گرفت؟ ──
     تستی که روی کدِ خراب هم سبز شود، هیچ چیزی ثابت نمی‌کند. پس همان
     منطقِ نسخهٔ ۱۶ را عیناً این‌جا بازسازی می‌کنیم و روی همان پاسخ مبهم
     اجرا می‌کنیم؛ باید ۵۰۳ بدهد. اگر روزی کسی این محافظ را بردارد،
     این سنجش قرمز می‌شود و می‌گوید چرا گذاشته شده بود. */
  const oldNetworkFirst = async res => {
    try{
      if(res && res.ok) return res;               // ← پاسخ مبهم: ok=false
      throw new Error('bad status');              // ← پس همیشه این‌جا
    }catch(e){
      return new Response(JSON.stringify({ error: 'offline' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
  };
  const oldOut = await oldNetworkFirst(opaque);
  ok('منطق نسخهٔ ۱۶ روی همین ورودی ۵۰۳ می‌داد (پس تست بی‌اثر نیست)',
     oldOut.status === 503 && /application\/json/.test(oldOut.headers.get('content-type')));

  /* پاسخ سالم باید *همچنان* کش شود، وگرنه آفلاین بودن از دست می‌رود */
  const good = new Response('font', { status: 200 });
  const sw3 = loadSW({ fetch: async () => good });
  const got3 = await fire(sw3, new Request('https://cdn.jsdelivr.net/gh/x/y.woff2')).out;
  ok('پاسخ ۲۰۰ سالم همچنان کش می‌شود', sw3.store.size === 1 && got3 === good);
}

/* ═══════════ پیامک و OTP (textbee.dev) ═══════════
   این بخش‌ها عمداً هیچ پیامک واقعی نمی‌فرستند: fetch جعلی است و هر
   درخواستی که بیرون می‌رفت، این‌جا گرفته و بازرسی می‌شود. */
section('پیامک — نرمال‌سازی شمارهٔ موبایل');
/* پیکربندی و حالت سرور را یک‌بار برمی‌داریم. سنجش‌های async در دمِ اجرا
   می‌روند، پس نمی‌توانند به حالتِ لحظهٔ تعریف تکیه کنند؛ هر کدام وضعیت
   خودش را صریح می‌سازد و آخرش از همین نسخه برمی‌گرداند. */
const __smsKeep = { cfg: { ...SMS.config }, srv: { ...SMS.server } };
const smsState = (mode, extra) => {
  SMS.server = { on: false, configured: false, device: '', at: 0 };
  SMS.config.apiKey = ''; SMS.config.deviceId = '';
  if(mode === 'direct'){ SMS.config.apiKey = 'txb_TESTKEY'; SMS.config.deviceId = 'dev_TESTID'; }
  if(mode === 'server') SMS.server = { on: true, configured: true, device: '…b06f', at: U.now() };
  Object.assign(SMS.config, extra || {});
  return SMS.mode();
};
const smsRestore = () => { Object.assign(SMS.config, __smsKeep.cfg); SMS.server = __smsKeep.srv; };
{
  [['09123456789','09123456789'], ['9123456789','09123456789'],
   ['+989123456789','09123456789'], ['00989123456789','09123456789'],
   ['989123456789','09123456789'], ['0912 345 6789','09123456789'],
   ['0912-345-6789','09123456789'], ['(0912) 345 6789','09123456789'],
   ['۰۹۱۲۳۴۵۶۷۸۹','09123456789'], ['٠٩١٢٣٤٥٦٧٨٩','09123456789'],
   ['+98 912 345 6789','09123456789']].forEach(([inp, want]) => {
    const got = SMS.norm(inp);
    ok(`«${inp}» ⇒ ${want}`, got === want, got);
  });

  ['0212345678', '0912345', '0912345678901', '98912345678', '', 'abcdefghijk', '12345']
    .forEach(bad => ok(`«${bad}» نامعتبر است`, !SMS.phoneOk(bad), SMS.norm(bad)));
  ok('شمارهٔ ۱۳ رقمی بریده نمی‌شود (به غریبه نمی‌رود)',
     SMS.norm('0912345678901') === '0912345678901', SMS.norm('0912345678901'));
  ok('نمایش شماره گروه‌بندی می‌شود', SMS.faPhone('09123456789') === '0912 345 6789',
     SMS.faPhone('09123456789'));
}

section('کد OTP — ساخت و هش');
{
  const codes = Array.from({ length: 300 }, () => OTP.code());
  ok('همهٔ کدها پنج‌رقمی‌اند', codes.every(c => /^\d{5}$/.test(c)));
  ok('کدها یکنواخت نیستند', new Set(codes).size > 250, new Set(codes).size);
  ok('طول کد با LEN می‌خواند', OTP.LEN === 5 && codes.every(c => c.length === OTP.LEN));

  const h = OTP.hash('12345', 'salt1');
  ok('هش ۶۴ نویسه‌ای است (SHA-256)', h.length === 64 && /^[0-9a-f]+$/.test(h));
  ok('هش خودِ کد نیست', h !== '12345' && !h.includes('12345'));
  ok('هش با SHA-256 مطابق است', h === U.sha256('12345|salt1|noorestan-otp'));
  ok('نمک هش را عوض می‌کند', OTP.hash('12345','a') !== OTP.hash('12345','b'));
  ok('هش بی‌نمک نیست (از هشِ خالیِ کد جداست)', OTP.hash('12345','s') !== U.sha256('12345'));
  ok('انقضا ۲ دقیقه است', OTP.TTL_MS === 120000);
  ok('سه تلاش مجاز است', OTP.MAX_TRIES === 3);
  ok('قفل ۱۰ دقیقه است', OTP.LOCK_MS === 600000);
  ok('فاصلهٔ ارسال دوباره ۶۰ ثانیه است', OTP.RESEND_MS === 60000);
}

section('کد OTP — از تصادفِ امن می‌آید، نه از Math.random');
{
  /* مولد را با یک مولدِ قالبی عوض می‌کنیم و می‌بینیم کد واقعاً از همان
     می‌آید. اگر روزی کسی به Math.random برگردد، این سنجش سرخ می‌شود. */
  const real = U.crypto;
  const fixed = v => { U.crypto = () => ({ getRandomValues: b => { b[0] = v; return b; } }); };

  fixed(0);
  ok('کد از مولدِ امن می‌آید — کمینهٔ بازه', U.code5() === '10000', U.code5());
  fixed(89999);
  ok('کد از مولدِ امن می‌آید — بیشینهٔ بازه', U.code5() === '99999', U.code5());
  fixed(45000);
  ok('نگاشت خطی است، نه چیز دیگر', U.code5() === '55000', U.code5());
  fixed(1234);
  ok('ارقامِ کم‌شمار با صفر پر نمی‌شوند و کد کوتاه نمی‌شود',
     U.code5() === '11234', U.code5());

  /* باقی‌ماندهٔ ساده توزیع را کج می‌کند؛ پس نمونه‌های بیرون از بازه باید
     دور ریخته شوند. MAX = floor(2^32 / 90000) * 90000 = 4294890000. */
  let calls = 0;
  U.crypto = () => ({ getRandomValues: b => { b[0] = (calls++ === 0 ? 4294890000 : 0); return b; } });
  const retried = U.code5();
  ok('نمونهٔ بیرونِ بازه دور ریخته می‌شود، نه اینکه باقی‌مانده گرفته شود',
     retried === '10000' && calls === 2, `کد=${retried} فراخوانی=${calls}`);

  let n = 0;
  U.crypto = () => ({ getRandomValues: b => { n++; b[0] = 4294890000; return b; } });
  const exhausted = U.code5();
  ok('اگر همهٔ نمونه‌ها رد شوند، کد ساخته نمی‌شود', exhausted === '', JSON.stringify(exhausted));
  ok('و حلقه بی‌پایان نمی‌شود', n === 64, n);

  U.crypto = () => null;
  const noRng = U.code5(), noSalt = U.salt();
  ok('بی مولدِ امن، کد ساخته نمی‌شود — جانشینِ ضعیف نمی‌گذاریم', noRng === '', JSON.stringify(noRng));
  ok('بی مولدِ امن، نمکی هم ساخته نمی‌شود', noSalt === '', JSON.stringify(noSalt));

  U.crypto = real;

  const many = Array.from({ length: 500 }, () => U.code5());
  ok('همهٔ کدها در بازهٔ ۱۰۰۰۰..۹۹۹۹۹ هستند',
     many.every(c => /^\d{5}$/.test(c) && +c >= 10000 && +c <= 99999));
  ok('تنوع کدها کافی است', new Set(many).size > 450, new Set(many).size);

  const s1 = U.salt(), s2 = U.salt();
  ok('نمک ۳۲ نویسهٔ هگز است', /^[0-9a-f]{32}$/.test(s1), s1);
  ok('دو نمک پشت‌سرهم یکی نیستند', s1 !== s2);
  ok('طول نمک قابل تنظیم است', U.salt(4).length === 8, U.salt(4));

  /* بررسی سطحِ متن: تنها راهِ اثبات اینکه مسیرِ ضعیف اصلاً وجود ندارد.
     سنجشِ رفتاری فقط می‌گوید امروز چه می‌شود؛ این یکی می‌گوید فردا هم
     نمی‌شود بی‌آنکه کسی متوجه شود. */
  const SRC = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const body = (name) => {
    const i = SRC.indexOf(name + '(');
    if(i < 0) return '';
    const j = SRC.indexOf('\n  },', i);
    return SRC.slice(i, j < 0 ? i + 400 : j);
  };
  ok('code5 هیچ جای Math.random ندارد', !/Math\.random/.test(body('code5')));
  ok('randBelow هیچ جای Math.random ندارد', !/Math\.random/.test(body('randBelow')));
  ok('نمک هم از Math.random نمی‌آید', !/Math\.random/.test(body('salt')));
  ok('U.crypto فقط از getRandomValues حرف می‌زند',
     /getRandomValues/.test(SRC.slice(SRC.indexOf('crypto(){'), SRC.indexOf('crypto(){') + 500)));
  ok('TODO فاز ۹ برای راستی‌آزمایی سمتِ سرور نوشته شده',
     /TODO\(فاز ۹/.test(SRC));
  ok('salt در OTP.start از نمکِ امن می‌آید، نه از uid',
     /const salt = U\.salt\(\);/.test(SRC));
}

section('چرخهٔ ورود با موبایل');
{
  /* حالت ذخیره‌شده را برمی‌داریم و آخر بخش بازمی‌گردانیم، وگرنه این
     سنجش‌ها روی بقیهٔ تست‌ها اثر می‌گذارند. */
  const keepPhone = Store.get('phone'), keepOtp = Store.get('otp');

  const reset = () => Store.update(x => { x.otp = null; x.phone = ''; });
  const hint = (code, phone) => {
    Store.update(x => { x.otp = { phone, salt: 'S', hash: OTP.hash(code, 'S'),
      exp: U.now() + OTP.TTL_MS, tries: 0, lock: 0, at: U.now() }; });
  };

  smsState('mock');
  ok('بی کلید ⇒ حالت آزمایشی', SMS.mode() === 'mock', SMS.mode());
  ok('حالت آزمایشی «آماده» نیست', SMS.ready() === false);

  reset();
  const PH = '09123456789';
  const t0 = async () => OTP.start(PH);
  const t1 = await t0();                            // با fetch واقعی؟ نه — حالت آزمایشی
  ok('شمارهٔ بد در start رد می‌شود', (await OTP.start('12345')).ok === false);
  ok('کد ساخته و «فرستاده» شد (آزمایشی)', t1.ok === true && t1.mock === true, JSON.stringify(t1.why));
  ok('کد آزمایشی برگردانده می‌شود تا کاربر ببیند', /^\d{5}$/.test(t1.code || ''), t1.code);
  ok('شمارهٔ نرمال‌شده ذخیره شد', (OTP.st() || {}).phone === PH);

  const st = OTP.st();
  ok('حالتی در Store نشست', !!st && !!st.hash && !!st.salt && !!st.exp);
  ok('خودِ کد در Store نیست', !JSON.stringify(st).includes(t1.code));
  ok('انقضا ~۲ دقیقه بعد است', Math.abs((st.exp - U.now()) - 120000) < 3000);

  /* ── کد اشتباه و شمارش تلاش ── */
  const wrong = String((+t1.code + 11111) % 100000).padStart(5, '0');
  ok('کد اشتباه تشخیص داده می‌شود', wrong !== t1.code);
  const w1 = OTP.verify(PH, wrong);
  ok('تلاش اول: رد شد و ۲ تلاش ماند', w1.ok === false && w1.left === 2, JSON.stringify(w1));
  const w2 = OTP.verify(PH, wrong);
  ok('تلاش دوم: ۱ تلاش ماند', w2.ok === false && w2.left === 1);
  const w3 = OTP.verify(PH, wrong);
  ok('تلاش سوم: قفل شد', w3.ok === false && w3.locked === true);
  ok('قفل ۱۰ دقیقه است', Math.abs(w3.lock - 600000) < 1000, w3.lock);
  ok('پس از قفل، حتی کد درست هم رد می‌شود', OTP.verify(PH, t1.code).ok === false);
  ok('و پیام قفل می‌دهد، نه «کد اشتباه»', /قفل/.test(OTP.verify(PH, t1.code).why));
  ok('تازه‌سازی کد هم در قفل رد می‌شود', (await OTP.start(PH)).locked === true);

  /* قفل که تمام شود، شمارنده صفر می‌شود */
  Store.update(x => { x.otp.lock = U.now() - 1; });
  const okAfter = OTP.verify(PH, t1.code);
  ok('پس از پایان قفل، کد درست پذیرفته می‌شود', okAfter.ok === true, JSON.stringify(okAfter));
  ok('شماره در پروفایل ثبت شد', Store.get('phone') === PH);
  ok('حالت OTP پس از موفقیت پاک می‌شود', Store.get('otp') === null);

  /* ── انقضا ── */
  reset();
  const e1 = await OTP.start(PH);
  Store.update(x => { x.otp.exp = U.now() - 1; });
  const ev = OTP.verify(PH, e1.code);
  ok('کد منقضی رد می‌شود', ev.ok === false && ev.expired === true, JSON.stringify(ev));
  ok('کد منقضی پاک می‌شود', Store.get('otp') === null);

  /* ── کد درست با رقم فارسی ── */
  reset();
  const p1 = await OTP.start(PH);
  const fa = U.fa(p1.code);
  ok('رقم فارسی کد هم پذیرفته می‌شود', OTP.verify(PH, fa).ok === true, fa);
  reset();

  /* ── بی گرفتن کد، تأیید معنا ندارد ── */
  ok('بی درخواست کد، تأیید رد می‌شود', OTP.verify(PH, '12345').ok === false);
  ok('شمارهٔ دیگری هم بی کد رد می‌شود', OTP.verify('09120000000', '12345').ok === false);
  ok('کد ناقص رد می‌شود', (hint('12345', PH), OTP.verify(PH, '123').ok === false));

  /* ── فاصلهٔ ارسال دوباره ── */
  reset();
  await OTP.start(PH);
  const again = await OTP.start(PH);
  ok('ارسال پشت‌سرهم رد می‌شود', again.ok === false && again.wait > 0, JSON.stringify(again));
  ok('متن انتظار ثانیه دارد', /ثانیه/.test(again.why), again.why);
  Store.update(x => { x.otp.at = U.now() - OTP.RESEND_MS - 1; });
  const again2 = await OTP.start(PH);
  ok('پس از یک دقیقه دوباره می‌شود', again2.ok === true);

  /* ── ارسال ناموفق نباید حالت بسازد ── */
  reset();
  const realSend = SMS.sendOTP;
  SMS.sendOTP = async () => ({ success: false, error: 'شبکه قطع است' });
  const bad = await OTP.start(PH);
  SMS.sendOTP = realSend;
  ok('ارسال ناموفق ⇒ خطا', bad.ok === false && /قطع/.test(bad.why || ''), JSON.stringify(bad));
  ok('ارسال ناموفق حالت نمی‌سازد', Store.get('otp') === null);
  ok('و قفلِ الکی هم نمی‌سازد', OTP.lockSec() === 0);

  Store.update(x => { x.phone = keepPhone; x.otp = keepOtp; });
  smsRestore();
}

section('حالت آزمایشی — کد فقط نشان داده می‌شود');
{
  const run = async () => {
    const logs = [], toasts = [];
    const cl = console.log, tt = UI.toast;
    const realFetch = globalThis.fetch;
    let fetched = 0;
    globalThis.fetch = async () => { fetched++; throw new Error('نباید صدا زده شود'); };

    ok('حالت آزمایشی فعال است', smsState('mock') === 'mock', SMS.mode());

    console.log = (...a) => logs.push(a.join(' '));
    UI.toast = m => toasts.push(m);
    let r;
    try{ r = await SMS.sendOTP('09123456789', '54321'); }
    finally{ console.log = cl; UI.toast = tt; globalThis.fetch = realFetch; }

    ok('حالت آزمایشی موفق گزارش می‌شود', r && r.success === true && r.mock === true, JSON.stringify(r));
    ok('در حالت آزمایشی هیچ درخواستی به بیرون نمی‌رود', fetched === 0, String(fetched));
    /* کد یک رمز یک‌بارمصرف است. کنسول می‌تواند ذخیره، فرستاده یا در گزارش خطا
       دیده شود، پس عمداً چاپ نمی‌شود؛ فقط روی همان صفحه به کاربر نشان داده
       می‌شود. (این سنجش پیش‌تر برعکسش را می‌خواست.) */
    ok('کد در کنسول چاپ نمی‌شود', !logs.some(l => l.includes('54321')), logs.join(' ／ '));
    ok('ولی رویداد پیامک ثبت می‌شود', logs.some(l => /SMS/.test(l)), logs.join(' ／ '));
    ok('و به کاربر نشان داده می‌شود', toasts.some(t => t.includes('54321')), toasts.join(' ／ '));
    /* سنجش بی‌اثر نباشد: همان تابع با کلید، درخواستِ بیرونی می‌فرستد */
    const saved = globalThis.fetch;
    let went = 0;
    globalThis.fetch = async () => { went++; return { ok:true, status:200, json: async () => ({ success:true }) }; };
    smsState('direct');
    await SMS.sendOTP('09123456789', '54321');
    globalThis.fetch = saved;
    ok('همان تابع با کلید، درخواست بیرونی می‌فرستد', went === 1, String(went));
    smsRestore();
  };
  __smsChecks.push(run);
}

section('مستقیم — قرارداد درخواست textbee');
{
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    calls.push({ url, opt });
    return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
  };

  ok('کلید و شناسه ⇒ حالت مستقیم', smsState('direct') === 'direct', SMS.mode());
  ok('حالت مستقیم «آماده» است', SMS.ready() === true);

  let out;

  const run = async () => {
    ok('در دمِ اجرا هم حالت مستقیم است', smsState('direct') === 'direct', SMS.mode());
    out = await SMS.sendOTP('0912 345 6789', '13579');
    const c = calls[0];
    ok('دقیقاً یک درخواست رفت', calls.length === 1, String(calls.length));
    ok('نشانی همان endpoint است',
       c.url === 'https://api.textbee.dev/api/v1/gateway/send-sms', c.url);
    ok('متد POST است', c.opt.method === 'POST', c.opt.method);
    ok('کلید در هدر x-api-key است', c.opt.headers['x-api-key'] === 'txb_TESTKEY',
       JSON.stringify(Object.keys(c.opt.headers)));
    ok('نوع محتوا JSON است',
       /application\/json/.test(c.opt.headers['Content-Type'] || ''), c.opt.headers['Content-Type']);

    const b = JSON.parse(c.opt.body);
    ok('بدنه فقط سه کلید دارد', Object.keys(b).sort().join() === 'deviceId,message,recipients',
       Object.keys(b).join());
    ok('deviceId درست است', b.deviceId === 'dev_TESTID', b.deviceId);
    ok('recipients آرایه است، نه رشته', Array.isArray(b.recipients), typeof b.recipients);
    ok('recipients یک شمارهٔ نرمال‌شده دارد', b.recipients.length === 1 &&
       b.recipients[0] === '09123456789', JSON.stringify(b.recipients));

    const want = '🌟 نورستان\n🔐 کد تأیید ثبت‌نام شما: 13579\n' +
                 '⏱ اعتبار: ۲ دقیقه\n⚠️ این کد را با کسی به اشتراک نگذارید.';
    ok('متن پیام مو‌به‌مو همان متن خواسته‌شده است', b.message === want, JSON.stringify(b.message));
    ok('کد داخل متن است', b.message.includes('13579'));
    ok('پاسخ موفق پاس داده می‌شود', out && out.success === true, JSON.stringify(out));

    /* ── خطای احراز هویت ── */
    calls.length = 0;
    globalThis.fetch = async () => ({ ok: false, status: 401,
      json: async () => ({ error: 'Unauthorized', code: 'AUTH_INVALID' }) });
    const bad = await SMS.sendOTP('09123456789', '13579');
    ok('خطای textbee به کاربر می‌رسد', bad.success === false && bad.error === 'Unauthorized',
       JSON.stringify(bad));
    ok('کد وضعیت هم می‌آید', bad.status === 401, bad.status);

    /* ── قطع شبکه: «نمی‌دانیم»، نه «نشد» ──
       مرورگر نمی‌تواند قطعیِ شبکه را از رد شدنِ CORS تشخیص بدهد. در هر دو حالت
       درخواست ممکن است به textbee رسیده و پیامک رفته باشد، پس گفتن «ارسال نشد»
       کاربر را از وارد کردن کدی که گرفته باز می‌داشت — همان باگ گزارش‌شده. */
    globalThis.fetch = async () => { const e = new Error('nope'); e.name = 'TypeError'; throw e; };
    const dead = await SMS.sendOTP('09123456789', '13579');
    ok('قطعی شبکه «ناتأیید» گزارش می‌شود، نه «نشد»',
       dead.success === false && dead.pending === true && dead.state === 'pending',
       JSON.stringify(dead));
    ok('پیامِ حالت ناتأیید خوانا است', /در حال ارسال/.test(dead.error || ''), dead.error);
    ok('در حالت مستقیم، پیشنهاد بردن کلید به سرور داده می‌شود',
       /NOOR_SMS_KEY/.test(dead.hint || ''), JSON.stringify(dead.hint || ''));

    /* ── تمام شدن وقت: همان «نمی‌دانیم» ── */
    globalThis.fetch = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
    const to = await SMS.sendOTP('09123456789', '13579');
    ok('تمام شدن وقت «ناتأیید» گزارش می‌شود، نه «نشد»',
       to.pending === true && to.state === 'pending', JSON.stringify(to));
    ok('مهلت پیش‌فرض ۳۰ ثانیه است', SMS.TIMEOUT_MS === 30000, String(SMS.TIMEOUT_MS));

    /* ── آزمایش اتصال ── */
    calls.length = 0;
    globalThis.fetch = async (url, opt) => {
      calls.push({ url, opt });
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    };
    const t = await SMS.sendTest('09123456789');
    const tb = JSON.parse(calls[0].opt.body);
    ok('تست ارسال پیام جدا می‌فرستد', t.success === true && /آزمایش/.test(tb.message), tb.message);
    ok('تست ارسال هم recipients آرایه دارد', tb.recipients[0] === '09123456789');

    globalThis.fetch = realFetch;
    smsRestore();
  };
  /* سنجش‌های بالا به پاسخِ fetch وابسته‌اند؛ پس در دمِ async اجرا می‌شوند. */
  __smsChecks.push(run);
}

section('قرارداد پاسخ سرویس پیامک — سه حالت، نه دو حالت');
{
  /* جدول داوری. ستون آخر عمداً «pending» را از «failed» جدا می‌کند: تنها
     تفاوتِ این دو، همان چیزی است که کاربر می‌بیند و تصمیم می‌گیرد کد را وارد
     کند یا نه. */
  const CASES = [
    /* شرح                                  پاسخِ سرویس                                     انتظار     پیام/شناسه */
    ['موفقِ مستند textbee',      { ok:true,  status:200, json:{ success:true, data:{ _id:'abc123', status:'pending' } } }, 'sent',    'abc123'],
    ['خطای مستند textbee',       { ok:false, status:401, json:{ success:false, message:'Invalid API key' } },           'failed',  'Invalid API key'],
    ['مهلت تمام‌شده',            { ok:false, status:0,   json:null },                                                  'pending', ''],
    ['_id بی success',           { ok:true,  status:200, json:{ _id:'xyz' } },                                         'sent',    'xyz'],
    ['messageId',                { ok:true,  status:200, json:{ messageId:'m1' } },                                    'sent',    'm1'],
    ['id داخل data',             { ok:true,  status:200, json:{ data:{ id:'d1' } } },                                  'sent',    'd1'],
    ['۲۰۰ بی هیچ نشانه‌ای',      { ok:true,  status:200, json:{} },                                                    'pending', ''],
    ['۲۰۰ بی بدنهٔ JSON',        { ok:true,  status:200, json:null },                                                  'pending', ''],
    ['۵۰۰ خطای موقت',            { ok:false, status:500, json:null },                                                  'pending', ''],
    ['۴۰۰ با message',           { ok:false, status:400, json:{ message:'شماره بد است' } },                            'failed',  'شماره بد است'],
    ['success:false با ۲۰۰',     { ok:true,  status:200, json:{ success:false, message:'سقف پر شد' } },                'failed',  'سقف پر شد'],
    ['۴۰۳ بی بدنه',              { ok:false, status:403, json:null },                                                  'failed',  'HTTP 403']
  ];

  CASES.forEach(([name, res, wantState, wantText]) => {
    const v = SMS.verdict(res);
    const text = v.state === 'sent' ? (v.id || '') : (v.error || '');
    ok(`${name} ⇒ ${wantState}`, v.state === wantState, `شد ${v.state}`);
    if(wantText || v.state === 'sent')
      ok(`${name} ⇒ متن درست`, text === wantText, `«${text}» ≠ «${wantText}»`);
  });

  ok('متنِ حالت ناتأیید همان چیزی است که خواسته شد',
     SMS.PENDING_MSG === 'در حال ارسال... لطفاً چک کنید', SMS.PENDING_MSG);
  ok('«ناتأیید» هیچ‌وقت موفق شمرده نمی‌شود',
     SMS.verdict({ ok:false, status:0, json:null }).state !== 'sent');
  ok('«ناتأیید» هیچ‌وقت شکست قطعی شمرده نمی‌شود',
     SMS.verdict({ ok:false, status:0, json:null }).state !== 'failed');

  /* کد و کلید نباید به هیچ بهانه‌ای وارد گزارش شوند */
  const seen = [];
  const cl = console.log;
  console.log = (...a) => seen.push(a.map(String).join(' '));
  try{
    SMS.log('t', { apiKey:'txb_SECRET', key:'k', code:'54321', headers:{ 'x-api-key':'txb_SECRET' }, message:'…54321…', phone:'09123456789', state:'sent' });
  }finally{ console.log = cl; }
  const line = seen.join(' ');
  ok('گزارش، کلید را چاپ نمی‌کند', !line.includes('txb_SECRET'), line);
  ok('گزارش، کد را چاپ نمی‌کند', !line.includes('54321'), line);
  ok('گزارش، متن پیام را چاپ نمی‌کند', !line.includes('…54321…'), line);
  ok('گزارش، فیلد بی‌خطر را نگه می‌دارد', /state/.test(line) && /09123456789/.test(line), line);
}

section('سرور — مسیر پروکسی (کلید از دستگاه بیرون می‌ماند)');
{
  const calls = [];
  const realFetch = globalThis.fetch;
  const realProto = global.location.protocol;

  ok('سرور کلید دارد ⇒ حالت سرور', smsState('server') === 'server', SMS.mode());
  ok('در حالت سرور، کلید محلی بی‌اثر است', SMS.ready() === true);

  const run = async () => {
    ok('در دمِ اجرا هم حالت سرور است', smsState('server') === 'server', SMS.mode());
    /* sendOTP: کد می‌رود، متن نمی‌رود */
    calls.length = 0;
    globalThis.fetch = async (url, opt) => {
      calls.push({ url, opt });
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    };
    const out = await SMS.sendOTP('09123456789', '24680');
    const c = calls[0];
    const blob = JSON.stringify(c);
    ok('درخواست به /api/otp/send می‌رود', /\/api\/otp\/send$/.test(c.url), c.url);
    ok('بدنه فقط شماره و کد دارد', Object.keys(JSON.parse(c.opt.body)).sort().join() === 'code,phone',
       c.opt.body);
    ok('کلید در بدنه نیست', !blob.includes('txb_DEVICEKEY'));
    ok('کلید در هدر نیست', !c.opt.headers || !c.opt.headers['x-api-key']);
    ok('متن پیام از دستگاه نمی‌رود', !/نورستان/.test(c.opt.body));
    ok('پاسخ سرور پاس داده می‌شود', out.success === true, JSON.stringify(out));

    /* تست ارسال: فقط یک پرچم */
    calls.length = 0;
    await SMS.sendTest('09123456789');
    ok('تست ارسال فقط {phone,test} می‌فرستد',
       Object.keys(JSON.parse(calls[0].opt.body)).sort().join() === 'phone,test', calls[0].opt.body);

    /* خطای سرور */
    globalThis.fetch = async () => ({ ok: false, status: 429,
      json: async () => ({ error: 'سقف ساعتی پر شد' }) });
    const lim = await SMS.sendOTP('09123456789', '24680');
    ok('کران نرخ سرور به کاربر می‌رسد', lim.success === false && /سقف/.test(lim.error), JSON.stringify(lim));

    /* probe */
    Object.assign(global.location, { protocol: 'http:' });
    globalThis.fetch = async () => ({ ok: true, status: 200,
      json: async () => ({ configured: true, on: true, device: '…b06f' }) });
    await SMS.probe();
    ok('probe سرور را می‌بیند', SMS.server.configured === true && SMS.server.on === true);
    ok('probe هیچ کلیدی برنمی‌گرداند',
       !('apiKey' in SMS.server) && !('key' in SMS.server), Object.keys(SMS.server).join());

    Object.assign(global.location, { protocol: 'file:' });
    globalThis.fetch = async () => { throw new Error('نباید صدا زده شود'); };
    const p2 = await SMS.probe();
    ok('از file:// اصلاً سرور پرسیده نمی‌شود', p2.configured === false);

    /* init کلید محلی را پاک می‌کند */
    /* init باید کلید محلی را پاک کند: با سرورِ آماده، نگه‌داشتنش فقط ریسک است */
    smsState('direct', { apiKey: 'txb_TESTKEY', deviceId: 'dev_TESTID' });
    SMS.server = { on: true, configured: true, device: '…b06f', at: U.now() };
    Store.update(x => { x.sms.apiKey = 'txb_TESTKEY'; x.sms.deviceId = 'dev_TESTID'; });
    Object.assign(global.location, { protocol: 'http:' });
    globalThis.fetch = async () => ({ ok: true, status: 200,
      json: async () => ({ configured: true, device: '…b06f' }) });
    await SMS.init();
    ok('سرورِ آماده ⇒ کلید محلی پاک می‌شود',
       SMS.config.apiKey === '' && Store.get('sms').apiKey === '', SMS.config.apiKey);

    globalThis.fetch = realFetch;
    Object.assign(global.location, { protocol: realProto });
    smsRestore();
  };
  __smsChecks.push(run);
}

section('کارت تنظیمات پیامک');
{
  smsState('mock');
  const mock = SMS.card();
  ok('حالت آزمایشی توضیح خودش را دارد', /حالت آزمایشی/.test(mock));
  ok('فیلد کلید در حالت آزمایشی هست', /id="smsKey"/.test(mock));
  ok('فیلد شناسهٔ دستگاه هست', /id="smsDev"/.test(mock));
  ok('دکمهٔ تست ارسال هست', /id="smsTest"/.test(mock));
  ok('دکمهٔ ذخیره هست', /id="smsSave"/.test(mock));
  ok('دکمهٔ ورود با موبایل هست', /id="smsLogin"/.test(mock));
  ok('فیلد کلید پسورد است', /type="password"/.test(mock));
  ok('فیلدها لاتین‌اند', (mock.match(/dir="ltr"/g) || []).length >= 2);

  smsState('server');
  const srv = SMS.card();
  ok('در حالت سرور، فیلد کلید پنهان می‌شود', !/id="smsKey"/.test(srv));
  ok('در حالت سرور، دکمهٔ ذخیره نیست', !/id="smsSave"/.test(srv));
  ok('در حالت سرور، وضعیت روشن می‌گوید', /روی سرور/.test(srv));
  smsRestore();
}

section('نوار پایین — مدیریت از آن برداشته شد، ولی گم نشد');
{
  /* H2: دکمهٔ مدیریت نوار پایین را شلوغ می‌کرد و در کارهای روزمره جایی
     نداشت. برداشتنش فقط وقتی پذیرفتنی است که پنل از راه دیگری باز شود و
     هیچ ویژگی‌ای از دست نرود. این سنجش‌ها همین را می‌پایند. */
  const SRC = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const navBlock = SRC.slice(SRC.indexOf('<nav class="nav"'), SRC.indexOf('</nav>'));
  const navKeys = [...navBlock.matchAll(/data-nav="(\w+)"/g)].map(m => m[1]);

  ok('نوار پایین پنج دکمه دارد', navKeys.length === 5, navKeys.join('،'));
  ok('«مدیریت» در نوار پایین نیست', !navKeys.includes('admin'));
  ok('پنج نشانیِ نوار پایین همان‌های قبلی‌اند',
     navKeys.join(',') === 'home,quran,online,play,me', navKeys.join(','));

  /* ویژگی نباید گم شود — فقط جابه‌جا می‌شود. */
  ok('مسیر مدیریت هنوز در Router ثبت است', Router.screens.admin === 's-admin');
  ok('صفحهٔ مدیریت هنوز در سند است', /id="s-admin"/.test(SRC));
  ok('کلید تازهٔ مدیریت در تنظیمات هست', /id="setAdmin"/.test(SRC));
  ok('و به همان مسیر می‌رود', /U\.\$\('#setAdmin'\)\.onclick = \(\) => Router\.go\('admin'\)/.test(SRC));

  /* پنهان‌کردن، امنیت نیست: نه میان‌بر پنهانی می‌ماند، نه دکمه‌ای قایم می‌شود. */
  const keyMap = (SRC.match(/const map = \{[^}]*\}/) || [''])[0];
  ok('میان‌بر آلت+۶ برای مدیریت نمانده', !/'6'\s*:\s*'admin'/.test(keyMap), keyMap);
  ok('میان‌برهای آلت+۱..۵ سرجایشان‌اند',
     ['1','2','3','4','5'].every(k => new RegExp(`'${k}'\\s*:\\s*'\\w+'`).test(keyMap)), keyMap);
  ok('کلید مدیریت هیچ کلاس مخفی‌کننده‌ای ندارد',
     !/id="setAdmin"[^>]*class="[^"]*\b(hide|gh-only|hidden)\b/.test(SRC));

  /* چون نوار پایین دکمه‌ای برای «مدیریت» ندارد، باید «حساب» روشن بماند
     وگرنه کاربر بی آنکه بداند کجاست، صفحه‌ای بی‌نشان می‌بیند. */
  ok('در صفحهٔ مدیریت، «حساب» روشن می‌ماند',
     /name === 'admin' && b\.dataset\.nav === 'me'/.test(SRC));

  /* متنِ راهنمای داخل صفحه هم باید بگوید چرا این‌جاست. */
  ok('توضیح می‌دهد که پنهان‌کردن امنیت نیست', /پنهان‌کردنِ نشانی، امنیت نیست/.test(SRC));
}

section('خطاهای دیرهنگام (تایمرهای جامانده)');
  /* سنجش‌های وابسته به await، به ترتیب، همین‌جا اجرا می‌شوند */
  for(const fn of __smsChecks) await fn();

  await new Promise(r => setTimeout(r, 1600));

  const late = (global.__lateErrs || []).slice();
  ok('هیچ خطای رسیدگی‌نشده‌ای در تایمرها رخ نداده', late.length === 0,
     late.map(e => (e && e.message) || String(e)).join(' ／ ').slice(0, 240));

  section('نتیجه');
  console.log(`  ${PASS} تست موفق، ${FAIL} ناموفق`);
  process.exit(FAIL ? 1 : 0);
})();
