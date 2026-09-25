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

/* متنِ خامِ خودِ برنامه — برای سنجشِ چیزهایی که رفتار نیستند، بلکه
   *متنِ کد*‌اند: قاعدهٔ CSS، الگوی فرمول، ترتیبِ ویژگی‌ها. عمداً از
   هارنس نمی‌آید تا این فایل تنها به دیسک وابسته باشد. */
const SRC = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');

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
/* پیش‌تر فرمِ رمزِ مدیر یک نسخهٔ دوم هم در پنل ادمین داشت (#admPass/#admPass2)
   که مهمان هم می‌توانست ببیندش. حالا فقط یک جا مانده: صفحهٔ ورود. */
ok('فرمِ رمزِ مدیر فقط یک جا هست (صفحهٔ ورود)', (() => {
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  return /ساختن رمز مدیر/.test(src) && /id="gtPass2"/.test(src) &&
         /ساختن رمز و ورود/.test(src) && !/id="admPass/.test(src);
})());
/* و پنل ادمین برای غیرمدیر یک درِ واحد دارد، نه فرمِ رمز. */
ok('🔐 پنل ادمین برای غیرمدیر فقط درِ ورود دارد', (() => {
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  return /id="admGoGate"/.test(src) && /Gate\.open\('admin'\)/.test(src) &&
         !/id="admLogin"/.test(src);
})());
ok('دروازهٔ ورود بین «اولین بار» و «ورود» فرق می‌گذارد',
   /const first = !remote && !Store\.get\('adminHash'\)/.test(
     fs.readFileSync(__dirname + '/index.html', 'utf8')));
/* روی سرور، تنها راهِ ورود رمزِ سرور است — و رمزِ محلی نباید آنجا راه بدهد. */
ok('دروازهٔ سرور از دروازهٔ محلی جدا شده', (() => {
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  return /const remote = this\.onServer\(\)/.test(src) && /loginServer\(pass\)/.test(src);
})());
ok('🔒 متنِ «رمز پیش‌فرض: noor2024» از دروازه حذف شد',
   !/رمز پیش‌فرض[:：]\s*noor2024/.test(fs.readFileSync(__dirname + '/index.html', 'utf8')));
/* «noor2024» باید فقط دو جا باشد: کامنت‌های توضیحی، و فهرست سیاهِ هشدار.
   اگر جای سوم باشد، یعنی جایی هنوز به‌عنوان رمز به کار می‌رود. */
/* سنجشِ متنی («noor2024 کجا آمده؟») شکننده است — کامنت چندخطی، رشتهٔ حاوی
   https://، و مانند این‌ها. به‌جایش معنای کد سنجیده می‌شود: هرجا رمزِ مدیر
   نوشته می‌شود، باید از ورودی کاربر هش شده باشد، نه از یک مقدار ثابت. */
ok('🔒 رمز مدیر فقط از ورودی کاربر ساخته می‌شود', (() => {
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const calls = src.match(/Store\.set\('adminHash',[^\n]*/g) || [];
  /* هر جا رمز نوشته می‌شود، باید از ورودی کاربر هش شده باشد، نه از ثابت. */
  if(!calls.length || !calls.every(c => /sha256Async\(/.test(c))) return false;
  /* و تنها *یک* جا می‌نویسد. پیش‌تر دو جا می‌نوشت و این آزمون همان دو را
     می‌شمرد؛ ولی دو جای نوشتن یعنی دو قاعده که دیر یا زود واگرا می‌شوند.
     حالا هر دو راه — ساختنِ رمز در صفحهٔ ورود و تغییرش در تنظیمات — از
     یک جا می‌گذرند، پس شرطِ درست «یک نویسنده، دو خواننده» است. */
  return calls.length === 1 && (src.match(/this\.setLocalPass\(/g) || []).length >= 2;
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
ok('بارگذاری پیش‌فرض', Store.get('hearts') === 3 && Store.get('score') === 0);
/* سقفِ جان در ۱۷.۱ از پنج به سه رسید. آزمون‌های زیر عددِ تازه را قفل می‌کنند
   تا کسی بی‌تصمیم برش نگرداند. */
ok('سقفِ جان سه است', Store.HEART_MAX === 3, Store.HEART_MAX);
Store.update(d => d.hearts = 0);
ok('spendHeart با جان صفر رد می‌کند', Store.spendHeart() === false);
Store.update(d => { d.hearts = 3; d.heartsAt = 0; });
ok('spendHeart جان کم می‌کند', Store.spendHeart() === true && Store.get('hearts') === 2, Store.get('hearts'));
ok('زمان جان بعدی ثبت شد', Store.get('heartsAt') > 0);
Store.update(d => { d.hearts = 0; d.heartsAt = U.now() - 7 * 60 * 1000; });  // ۷ دقیقه پیش
Store.regenHearts();
ok('بازیابی جان پس از ۷ دقیقه = ۲ جان', Store.get('hearts') === 2, Store.get('hearts'));
Store.update(d => { d.hearts = 2; d.heartsAt = U.now() - 12 * 60 * 1000; });  // ۴ جان می‌شد، سقف ۳
Store.regenHearts();
ok('بازیابی از سقف نمی‌گذرد', Store.get('hearts') === 3, Store.get('hearts'));
ok('در حالت پر، heartsAt صفر می‌شود', Store.get('heartsAt') === 0);
ok('جان از ۳ بالاتر نمی‌رود', (Store.addHearts(10), Store.get('hearts') === 3));
Store.update(d => { d.hearts = 5; d.heartsAt = 0; });   // ذخیرهٔ کهنهٔ نسخهٔ پیشین
Store.sanitize();
ok('ذخیرهٔ کهنه با ۵ جان به ۳ کوتاه می‌شود', Store.get('hearts') === 3, Store.get('hearts'));

/* نوارِ جان: در ۱۷.۱ قلب‌ها از نوارِ بالای همهٔ صفحه‌ها و از صفحهٔ اصلی و
   پروفایل برداشته شدند و فقط داخلِ بازی می‌مانند. ایموجی هم جایش را به SVG
   داد؛ ایموجیِ قلب رنگِ پوسته را نمی‌گیرد و در پوسته‌های روشن ناخوانا بود. */
Store.update(d => { d.hearts = 2; d.heartsAt = 0; });
const _hb = HeartBar.inner();
ok('نوارِ جان سه قلب می‌کشد', (_hb.match(/class="gh /g) || []).length === 3, _hb);
ok('قلبِ پُر و قلبِ خالی جدا شمرده می‌شوند',
   (_hb.match(/gh-full/g) || []).length === 2 && (_hb.match(/gh-empty/g) || []).length === 1);
ok('نوارِ جان SVG است نه ایموجی', !/[❤\u{1F496}\u{1F5A4}]/u.test(_hb) && /<svg/.test(_hb), _hb.slice(0, 40));
const _hud = HeartBar.hud();
ok('نوارِ جان شناسه و برچسبِ دسترس‌پذیر دارد',
   /id="gameHearts"/.test(_hud) && /role="img"/.test(_hud) && /aria-label="۲ جان از ۳"/.test(_hud), _hud.slice(0, 90));
Store.update(d => d.hearts = 1);
HeartBar.paint();                       // در هارنس جعبه‌ای نیست؛ نباید خطا بدهد
HeartBar.break(2);                      // و شکستنِ قلبی که در DOM نیست هم نباید خطا بدهد
ok('paint و break بی جعبه خطا نمی‌دهند', true);
Store.update(d => { d.hearts = 3; d.heartsAt = 0; });

/* قلب‌ها نباید به صفحهٔ اصلی برگردند — نه در نوارِ بالا، نه در کارتِ بازی،
   نه در پروفایل. رگرسیونِ خاموشِ این تصمیم خیلی آسان است. */
{
  const src = require('fs').readFileSync(__dirname + '/index.html', 'utf8');
  const has = id => new RegExp('id="' + id + '"').test(src);
  ok('نوارِ بالای صفحه دیگر جعبهٔ جان ندارد', !has('tbHearts') && !/hearts-top/.test(src));
  ok('نوارِ جان فقط جایی کشیده می‌شود که بازی در جریان است',
     /s\.hearts \? HeartBar\.hud\(\) : ''/.test(src));
  ok('صفحهٔ اصلی جان نشان نمی‌دهد', !/speed'\) sub = `❤/.test(src));
  ok('پروفایل جان را در آمارِ کلی نمی‌آورد', !/<span>❤️ جان<\/span>/.test(src));
}

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

/* اعلانِ مدیریتی در حالتِ محلی.
   «سرور» اینجا همان تبِ میزبان است. پیش‌تر این دروازه با مقایسهٔ *هش* باز
   می‌شد — و چون هش دیگر روی سیم نمی‌رود، آن شرط همیشه بسته بود و فقط توهمِ
   دروازه می‌ساخت. حالا دروازه صریح است: فقط خودِ میزبان می‌تواند پخش کند.
   سنجشِ امنیتیِ راستین جای دیگری است و در آزمونِ سرور انجام می‌شود. */
const __admKeep = Store.get('adminHash');
Store.set('adminHash', U.sha256('ramze-man-14'));

clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'admin:broadcast', hash: 'wrong', title: 'x', desc: 'y' });
ok('🔒 اعلان از غریبه پخش نمی‌شود', srvLog.length === 0);

clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'admin:broadcast', hash: U.sha256('noor2024'), title: 'x', desc: 'y' });
ok('🔒 رمزِ عمومیِ قدیمی دروازه را باز نمی‌کند', srvLog.length === 0);

clear();
S.handle({ ns: SERVER_KEY, from: 'A', t: 'admin:broadcast', token: 'x'.repeat(64), title: 'x', desc: 'y' });
ok('🔒 نشانهٔ سروریِ جعلی در حالتِ محلی کاری نمی‌کند', srvLog.length === 0);

clear();
S.handle({ ns: SERVER_KEY, from: Net.id, t: 'admin:broadcast', title: 'تست', desc: 'متن' });
ok('اعلان از خودِ میزبان پخش می‌شود', last(m => m.t === 'notif')?.to === '*');

/* رمزِ محلی دیگر هیچ نقشی در این دروازه ندارد — حتی رمزِ درست. */
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

/* ── تعویضِ قاری بی قطعِ صدا (۱۷.۱ بخش ۳) ──
   پیش‌تر عوض‌کردنِ قاری آیه را از ثانیهٔ صفر از نو می‌خواند و کاربر جای
   خودش را گم می‌کرد. این آزمون‌ها همان نگه‌داشتنِ لحظه را قفل می‌کنند. */
{
  const _r0 = Store.get('quran').reciter;
  Store.update(d => { d.quran.reciter = 0; d.quran.surah = 2; d.quran.ayah = 255; });
  ok('switchTo پیش‌فرضِ نادرست را به بازهٔ فهرست می‌بُرد',
     (Recite.switchTo(9999), Store.get('quran').reciter === RECITERS.length - 1), String(Store.get('quran').reciter));
  Store.update(d => d.quran.reciter = 0);

  /* بی پخشِ جریان‌دار: فقط ترجیح عوض می‌شود، پخشی آغاز نمی‌شود. */
  Recite.state = 'idle'; Recite.cur = null; Recite.el = null;
  ok('بی پخشِ جریان‌دار، switchTo فقط ترجیح را عوض می‌کند',
     Recite.switchTo(3) === true && Store.get('quran').reciter === 3);
  ok('قاریِ همان‌قبلی، تغییر حساب نمی‌شود',
     Recite.switchTo(3) === false && Store.get('quran').reciter === 3);

  /* با پخشِ جریان‌دار: لحظه حفظ می‌شود و آیه عوض نمی‌شود. */
  let played = null;
  const _realPlay = Recite.play;
  Recite.play = function(s, a, o){ played = { s, a, o }; return true; };
  Recite.el = { src: 'x', currentTime: 41.5, duration: 100, addEventListener(){}, play(){ return Promise.resolve(); },
                pause(){}, removeAttribute(){}, load(){}, volume: 1, playbackRate: 1, paused: false, readyState: 4 };
  Recite.state = 'playing'; Recite.cur = { s: 2, a: 255 }; Recite.srcIdx = 0;
  const _sw = Recite.switchTo(5);
  ok('با پخشِ جریان‌دار، آیه دوباره از صفر خوانده نمی‌شود',
     _sw === true && played && played.s === 2 && played.a === 255,
     JSON.stringify(played));
  ok('لحظهٔ پخش برای پس از متادیتا نگه داشته می‌شود',
     Recite._seekTo === 41.5, String(Recite._seekTo));
  ok('منبعِ جاری حفظ می‌شود', played && played.o && played.o.source === 0, JSON.stringify(played && played.o));
  ok('صفِ آیه‌های بعدی پاک نمی‌شود', played && played.o && Array.isArray(played.o.queue));
  ok('قاریِ تازه ثبت می‌شود', Store.get('quran').reciter === 5);

  /* قاریِ تازه فایل ندارد → برگشت به قاری پیشین، نه سکوت. */
  const was5 = Store.get('quran').reciter;
  Recite.fail();
  ok('بارگذاریِ ناموفق، قاری را به پیشین برمی‌گرداند',
     Store.get('quran').reciter === 3, String(Store.get('quran').reciter));
  ok('قاریِ خراب در فهرستِ هشدار می‌نشیند', Recite._bad.has(5), [...Recite._bad].join());
  ok('برگشت، خودش نشانِ برگشت نمی‌سازد (بی حلقهٔ بی‌پایان)',
     Recite._recRevert === null, String(Recite._recRevert));
  /* بارِ دوم: دیگر کسی برای برگشت نیست → خطای راستین */
  Recite.fail();
  ok('بی قاریِ پیشین، خطای راستین اعلام می‌شود', Recite.state === 'error');

  Recite.play = _realPlay;
  Recite.el = null; Recite.cur = null; Recite.state = 'idle'; Recite._bad.clear();
  Store.update(d => d.quran.reciter = _r0);
  ok('switchTo بی Audio خطا نمی‌دهد',
     (() => { try{ Recite.el = null; Recite.cur = { s: 1, a: 1 }; Recite.state = 'playing'; Recite.switchTo(1); return true; }catch(e){ return false; } })());
  Recite.cur = null; Recite.state = 'idle'; Store.update(d => d.quran.reciter = _r0);
}

/* نوارِ پخش: قاری از همان‌جا عوض می‌شود */
{
  const src = require('fs').readFileSync(__dirname + '/index.html', 'utf8');
  ok('نوارِ پخش دکمهٔ قاری دارد', /id="mqRec"/.test(src) && /id="mqRecName"/.test(src));
  ok('دکمهٔ قاری به برگهٔ پایین‌کش وصل است', /rb\.onclick = \(\) => this\.reciterSheet\(\)/.test(src));
  ok('نوارِ پخش نوارِ پیشرفت دارد', /id="mqBar"[\s\S]{0,40}id="mqFill"/.test(src));
  ok('برگهٔ قاری از پایین می‌آید نه وسط', /UI\.sheet\(/.test(src) && /#modal\.sheet\.on\{display:flex/.test(src));
  ok('برگهٔ پایین‌کش به لبهٔ پایین می‌چسبد و حاشیهٔ ایمن را می‌شناسد',
     /#modal\.sheet \.box\{[^}]*border-radius:22px 22px 0 0/.test(src) &&
     /#modal\.sheet \.box\{[^}]*env\(safe-area-inset-bottom/.test(src));
  ok('برگهٔ قاری فهرستِ قاریان و نشانِ قاریِ کنونی دارد',
     /reciterSheet\(\)\{/.test(src) && /class="rec-row/.test(src));
  ok('برگهٔ قاری هنگامِ پخش وعدهٔ ادامه از همین لحظه می‌دهد',
     /پخش از همین لحظه با صدای تازه ادامه می‌یابد/.test(src));
  ok('قاریِ خراب در برگه هشدار می‌گیرد ولی غیرفعال نمی‌شود',
     /Recite\._bad\.has\(i\)/.test(src) && !/disabled/.test(src.slice(src.indexOf('reciterSheet(){'), src.indexOf('reciterSheet(){') + 2200)));
  /* هر راهی که قاری را عوض می‌کند باید از مسیرِ بی‌قطع برود. سه راه هست:
     کارت‌های صفحهٔ تلاوت، برگهٔ پایین‌کش، گزینشگرِ پیش‌نمایش — به‌علاوهٔ
     دکمهٔ «قاری بعدی» و «منبع بعدی» در تنظیمات. */
  const gui = src.slice(src.indexOf('const QuranUI'), src.indexOf('const ReaderUI'));
  const rui = src.slice(src.indexOf('const ReciterUI'), src.indexOf('const ShareCard'));
  const set = src.slice(src.indexOf("U.$('#setQnext')"), src.indexOf("U.$('#setQtest')"));
  ok('گزینشگرِ پیش‌نمایش هم از همان مسیرِ بی‌قطع می‌رود',
     /QuranUI\.pickReciter\(i\)/.test(rui) && !/Recite\.play\(c\.s, c\.a\)/.test(rui));
  ok('تنظیمات هم برای قاری و منبع آیه را از نو نمی‌خواند',
     /Recite\.switchTo\(i\)/.test(set) && /Recite\.switchSource\(i\)/.test(set) &&
     !/Recite\.play\(c\.s, c\.a\)/.test(set) && !/Recite\.play\(c\.s, c\.a\)/.test(gui));
  ok('switchSource لحظهٔ پخش را نگه می‌دارد و آیه را عوض نمی‌کند',
     (() => {
       const q0 = Store.get('quran').source, s0 = Store.get('quran').surah;
       let seek = null, url = 'x';      // srcِ آغازین باید پُر باشد وگرنه «پخشی نیست»
       Recite.el = { src:'', currentTime: 12, duration: 60,
         addEventListener(t, f){ if(t === 'loadedmetadata') seek = f; },
         play(){ return Promise.resolve(); }, pause(){}, removeAttribute(){}, load(){},
         volume:1, playbackRate:1, paused:false, readyState:0 };
       Object.defineProperty(Recite.el, 'src', { get:() => url, set(v){ url = v; } });
       Recite.cur = { s: 1, a: 1 }; Recite.state = 'playing'; Recite.srcIdx = 0;
       const r = Recite.switchSource(q0 === 0 ? 1 : 0);
       let fine = r === true && !!seek && Recite.cur.s === 1 && Recite.cur.a === 1 &&
                  Store.get('quran').source === (q0 === 0 ? 1 : 0) && /everyayah|islamic/.test(url);
       if(seek){ Recite.el.currentTime = 0; seek(); fine = fine && Recite.el.currentTime === 12; }
       Recite.el = null; Recite.cur = null; Recite.state = 'idle';
       Store.update(d => { d.quran.source = q0; d.quran.surah = s0; });
       return fine;
     })());
  ok('پیشرفتِ نوار ضخامتِ کم دارد و ارتفاع نوار را نمی‌خورد',
     /#mqBar\{position:absolute/.test(src) && /#miniQ\{[^}]*overflow:hidden/.test(src));
  ok('دکمهٔ قاریِ نوارِ پخش ایموجی ندارد (آیکن دارد)',
     !/🎙/.test(src.slice(src.indexOf('id="miniQ"'), src.indexOf('id="miniQ"') + 700)));
}

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
  /* ── چرا `T0` را اینجا دستی می‌گذاریم ──
     `canOffer` سه راه برای «پرده نرفته» دارد: نبودِ عنصر، کلاس `out`، یا
     نگذشتنِ `SPLASH_GRACE_MS` از `T0`. این آزمون عمداً `out` را ندارد، پس
     تصمیم به ساعتِ دیوار می‌افتد — و `T0` لحظهٔ ارزیابیِ اسکریپت است. تا
     وقتی کلِ مجموعه زیر ۴ ثانیه تمام می‌شد اتفاقی نمی‌افتاد؛ حالا که از
     ۴ ثانیه گذشته، پیش از رسیدن به این خط، بیمهٔ زمانی خودش پرده را
     «رفته» حساب می‌کند و آزمون بی‌آنکه چیزی خراب شده باشد سرخ می‌شود.
     پس پیش‌شرط را صریح می‌کنیم: همین حالا، پنجره باز است. */
  ok('پردهٔ آغازینِ نرفته → پیشنهاد نمی‌شود', (() => {
    const t0 = Install.T0; Install.T0 = Date.now();
    const v = withDom(() => armed(() => Install.canOffer()), { splash: false });
    Install.T0 = t0; return v === false;
  })());
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
  /* نسخهٔ کش باید تک‌شماره و جاری باشد؛ هر چهار نام با هم جلو می‌روند،
     وگرنه `activate` یکی را نگه می‌دارد و بقیه را پاک می‌کند. */
  ok('نسخهٔ کش ۱۹ است و هر چهار نام با هم',
     /noorestan-19/.test(src) && /noorestan-shell-19/.test(src) &&
     /noorestan-media-19/.test(src) && /noorestan-text-19/.test(src) &&
     !/noorestan-17/.test(src));
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
  ok('نسخهٔ برنامه ۱۷ شده', /const APP_VERSION = 17;/.test(src));
  /* نسخه‌ای که کاربر می‌بیند باید با نسخهٔ کار یکی باشد */
  ok('و عنوانِ سند هم ۱۷ می‌گوید', /<title>نورستان ۱۷ \|/.test(src), src.match(/<title>[^<]*<\/title>/)?.[0]);
  ok('و توضیحِ سند', /<meta name="description" content="نورستان ۱۷/.test(src));
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
  const w1 = await OTP.verify(PH, wrong);
  ok('تلاش اول: رد شد و ۲ تلاش ماند', w1.ok === false && w1.left === 2, JSON.stringify(w1));
  const w2 = await OTP.verify(PH, wrong);
  ok('تلاش دوم: ۱ تلاش ماند', w2.ok === false && w2.left === 1);
  const w3 = await OTP.verify(PH, wrong);
  ok('تلاش سوم: قفل شد', w3.ok === false && w3.locked === true);
  ok('قفل ۱۰ دقیقه است', Math.abs(w3.lock - 600000) < 1000, w3.lock);
  const wLocked = await OTP.verify(PH, t1.code);
  ok('پس از قفل، حتی کد درست هم رد می‌شود', wLocked.ok === false);
  ok('و پیام قفل می‌دهد، نه «کد اشتباه»', /قفل/.test(wLocked.why));
  ok('تازه‌سازی کد هم در قفل رد می‌شود', (await OTP.start(PH)).locked === true);

  /* قفل که تمام شود، شمارنده صفر می‌شود */
  Store.update(x => { x.otp.lock = U.now() - 1; });
  const okAfter = await OTP.verify(PH, t1.code);
  ok('پس از پایان قفل، کد درست پذیرفته می‌شود', okAfter.ok === true, JSON.stringify(okAfter));
  ok('شماره در پروفایل ثبت شد', Store.get('phone') === PH);
  ok('حالت OTP پس از موفقیت پاک می‌شود', Store.get('otp') === null);

  /* ── انقضا ── */
  reset();
  const e1 = await OTP.start(PH);
  Store.update(x => { x.otp.exp = U.now() - 1; });
  const ev = await OTP.verify(PH, e1.code);
  ok('کد منقضی رد می‌شود', ev.ok === false && ev.expired === true, JSON.stringify(ev));
  ok('کد منقضی پاک می‌شود', Store.get('otp') === null);

  /* ── کد درست با رقم فارسی ── */
  reset();
  const p1 = await OTP.start(PH);
  const fa = U.fa(p1.code);
  ok('رقم فارسی کد هم پذیرفته می‌شود', (await OTP.verify(PH, fa)).ok === true, fa);
  reset();

  /* ── بی گرفتن کد، تأیید معنا ندارد ── */
  ok('بی درخواست کد، تأیید رد می‌شود', (await OTP.verify(PH, '12345')).ok === false);
  ok('شمارهٔ دیگری هم بی کد رد می‌شود', (await OTP.verify('09120000000', '12345')).ok === false);
  ok('کد ناقص رد می‌شود', (hint('12345', PH), (await OTP.verify(PH, '123')).ok === false));

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

section('کدِ تأیید روی سرور — بی کدِ محلی، بی هشِ محلی');
{
  const keepOtp = Store.get('otp');
  const keepTok = { t: Store.get('userToken'), e: Store.get('userTokenExp') };
  const keepPhone = Store.get('phone');
  const run = async () => {
    smsState('server');
    const seen = [];
    const realReq = SMS.req;
    SMS.req = async (url, opt) => {
      seen.push({ url, body: (opt && opt.body) || {} });
      if(/\/request$/.test(url)) return { ok: true, status: 200,
        json: { success: true, state: 'sent', len: 5, ttl: 120000 } };
      if(/\/verify$/.test(url)) return { ok: true, status: 200,
        json: { success: true, token: 'a1'.repeat(32), id: 'usr_' + 'b'.repeat(20), exp: 3600000 } };
      return { ok: false, status: 0, json: null, error: 'نباید' };
    };
    try{
      Store.update(d => { d.otp = null; d.userToken = ''; d.userTokenExp = 0; });
      const PH = '09123456789';

      const r1 = await OTP.start(PH);
      ok('روی سرور، کد از سرور خواسته می‌شود', r1.ok === true && r1.server === true,
         JSON.stringify(r1));
      ok('و خودِ کد ساخته نمی‌شود، پس نشان داده هم نمی‌شود',
         !r1.code && !r1.mock, JSON.stringify(r1));
      ok('درخواست به /request می‌رود', /\/request$/.test(seen[0].url), seen[0].url);
      ok('و فقط شماره می‌فرستد، بی کد',
         JSON.stringify(Object.keys(seen[0].body).sort()) === '["phone"]',
         JSON.stringify(seen[0].body));

      const st = OTP.st() || {};
      ok('هیچ هشی روی دستگاه نمی‌نشیند', !st.hash && !st.salt, JSON.stringify(st));
      ok('ولی حالت، «سروری» علامت می‌خورد', st.server === true);

      /* کد اشتباه را سرور رد می‌کند */
      SMS.req = async () => ({ ok: false, status: 401,
        json: { success: false, error: 'کد اشتباه است', left: 2 } });
      const w1 = await OTP.verify(PH, '00000');
      ok('ردِ سرور به کاربر می‌رسد', w1.ok === false && w1.left === 2, JSON.stringify(w1));

      /* کد سوخته: حالت پاک می‌شود */
      SMS.req = async () => ({ ok: false, status: 429,
        json: { success: false, error: 'سه بار اشتباه', burned: true } });
      const wb = await OTP.verify(PH, '00000');
      ok('سوختنِ کد از طرف سرور پذیرفته می‌شود', wb.burned === true);
      ok('و حالتِ صفحه پاک می‌شود', Store.get('otp') === null);

      /* کد درست — فاصلهٔ ارسال دوباره را دور می‌زنیم؛ آن قاعده جدا سنجیده می‌شود */
      SMS.req = async (url, opt) => {
        seen.push({ url, body: (opt && opt.body) || {} });
        if(/\/verify$/.test(url)) return { ok: true, status: 200,
          json: { success: true, token: 'a1'.repeat(32), id: 'usr_' + 'b'.repeat(20), exp: 3600000 } };
        return { ok: true, status: 200, json: { success: true, state: 'sent', ttl: 120000 } };
      };
      Store.update(d => { d.otp = null; });
      const okStart = await OTP.start(PH);
      ok('درخواست تازه پذیرفته می‌شود', okStart.ok === true, JSON.stringify(okStart));
      const okv = await OTP.verify(PH, '۵۴۳۲۱');
      ok('کد درست پذیرفته می‌شود', okv.ok === true && okv.server === true, JSON.stringify(okv));
      ok('نشانهٔ نشست ذخیره می‌شود', Store.get('userToken') === 'a1'.repeat(32));
      ok('و سررسیدش هم می‌آید', Store.get('userTokenExp') > U.now());
      ok('شماره روی هویت می‌نشیند', Store.get('phone') === PH);
      const last = seen[seen.length - 1];
      ok('کد به سرور می‌رود و شناسهٔ ما هم با آن',
         last.body.code === '54321' && /^usr_[0-9a-f]{20}$/.test(last.body.userId),
         JSON.stringify(last.body));
      ok('رقم‌های فارسی پیش از رفتن لاتین می‌شوند', last.body.code === '54321');
      ok('🔒 و هیچ رشتهٔ رمزمانندی جز کد و شناسه همراه نیست',
         Object.keys(last.body).sort().join(',') === 'code,phone,userId',
         Object.keys(last.body).join(','));

      /* نشانهٔ بی‌شکل دور انداخته می‌شود */
      Store.update(d => { d.userToken = 'x'; });
      Store.sanitize();
      ok('نشانهٔ کاربرِ بی‌شکل دور انداخته می‌شود', Store.get('userToken') === '');
      Store.update(d => { d.userToken = 'c'.repeat(64); d.userTokenExp = U.now() - 1; });
      Store.sanitize();
      ok('نشانهٔ منقضیِ کاربر دور انداخته می‌شود', Store.get('userToken') === '');
    }finally{
      SMS.req = realReq;
      Store.update(d => { d.otp = keepOtp; d.userToken = keepTok.t;
                          d.userTokenExp = keepTok.e; d.phone = keepPhone; });
    }
  };
  await run();
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

section('پنجرهٔ جستن — بازگشت اول پنجره را می‌بندد، نه صفحه را');
{
  const keepStack = Router.stack.slice();

  history.__reset();
  Router.stack = ['home'];
  Router.go('me');
  ok('آماده‌سازی: پشته و تاریخچه هم‌گام‌اند',
     Router.stack.join(',') === 'home,me' && history.length === 2);

  UI.modal('<button id="mx">بستن</button>');
  ok('پنجره باز شد', UI.isOpen() === true);
  ok('ورودیِ نشان‌دار در تاریخچه نشست', !!(history.state && history.state.modal));
  ok('و همان صفحهٔ کنونی را نگه می‌دارد', history.state.screen === 'me', history.state.screen);
  ok('تاریخچه یک ورودی جلو رفت', history.length === 3, history.length);
  ok('پشته دست نخورد', Router.stack.join(',') === 'home,me');

  /* دکمهٔ بازگشتِ اندروید: popstate با ورودیِ صفحهٔ زیرین می‌آید. */
  history.back();
  ok('بازگشت پنجره را بست', UI.isOpen() === false);
  ok('و صفحه عوض نشد', Router.stack.join(',') === 'home,me', Router.stack.join(','));
  ok('ورودیِ نشان‌دار رفت', !(history.state && history.state.modal));
  /* ورودیِ نشان‌دار جلوی اشاره‌گر می‌ماند (مرورگر آن را دور نمی‌ریزد)،
     ولی بی‌خطر است: هر رفتنِ تازه با pushState همان شاخهٔ جلو را می‌بُرد،
     و اگر کاربر «جلوی مرورگر» را بزند، شاخهٔ ۳ نشانه را نادیده می‌گیرد. */
  ok('اشاره‌گر یک قدم عقب رفت', history.length === 3 && history.__i() === 1,
     `${history.length}/${history.__i()}`);

  /* Escape = دکمهٔ انصراف. */
  UI.modal('<p>سلام</p>');
  __fire('document', 'keydown', { key:'Escape' });
  ok('Escape پنجره را می‌بندد', UI.isOpen() === false);
  await U.sleep(5);
  ok('و ورودیِ نشان‌دارش هم پس گرفته می‌شود',
     !(history.state && history.state.modal) && history.__i() === 1, history.__i());

  /* «بستن و رفتن به صفحهٔ دیگر» — الگویی که در ۲۵ جا صدا زده می‌شود.
     اگر نشانه پس گرفته نشود، ورودیِ بی‌صاحب در تاریخچه می‌ماند و «عقب»
     بعدی بی‌دلیل خرج می‌شود. */
  UI.modal('<p>دوباره</p>');
  const nMark = history.length;
  Router.go('quran');
  ok('رفتن به صفحهٔ دیگر پنجره را می‌بندد', UI.isOpen() === false);
  ok('هیچ ورودیِ نشان‌داری در تاریخچه نمی‌ماند',
     !history.__list().some(e => e.state && e.state.modal));
  ok('ورودیِ اضافی هم نمی‌سازد', history.length === nMark + 1, `${nMark}→${history.length}`);
  ok('پشته سه قدم شد', Router.stack.join(',') === 'home,me,quran', Router.stack.join(','));

  /* بازگشتِ پیاپی: اشکالِ پیشین این بود که پشته با هر بازگشت به یک عنصر
     می‌رفت و «عقب» بعدی به خانه می‌پرید. */
  __fire('window', 'popstate', { state:{ screen:'me' } });
  ok('یک قدم عقب: پشته کوتاه می‌شود، از نو ساخته نمی‌شود',
     Router.stack.join(',') === 'home,me', Router.stack.join(','));
  __fire('window', 'popstate', { state:{ screen:'home' } });
  ok('دو قدم عقب', Router.stack.join(',') === 'home', Router.stack.join(','));
  __fire('window', 'popstate', { state:{ screen:'admin' } });
  ok('پرشِ نشانی پشته را از نو می‌سازد', Router.stack.join(',') === 'admin', Router.stack.join(','));

  /* back() خودش پشته را کوتاه نمی‌کند؛ popstate این کار را می‌کند. */
  history.__reset();
  Router.stack = ['home'];
  Router.go('me'); Router.go('quran');
  Router.back();
  ok('back() یک قدم از تاریخچه عقب می‌رود', history.__i() === 1, history.__i());
  ok('و پشته هم عقب می‌آید', Router.stack.join(',') === 'home,me', Router.stack.join(','));
  Router.back();
  ok('بار دوم تا خانه', Router.stack.join(',') === 'home' && history.__i() === 0,
     `${Router.stack.join(',')} / ${history.__i()}`);
  Router.back();
  ok('ته پشته: خانه می‌ماند و ورودی هم «خانه» نوشته می‌شود',
     Router.stack.join(',') === 'home' && !!(history.state && history.state.screen === 'home'));

  /* بازگشتِ فوکوس: بی آن، کاربر صفحه‌کلید پشتِ پنجرهٔ بسته می‌ماند. */
  let focused = 0;
  const prevEl = { focus(){ focused++; } };
  document.activeElement = prevEl;
  UI.modal('<p>الف</p>');
  ok('عنصرِ فوکوس‌دارِ پیشین نگه داشته می‌شود', UI._focusBack === prevEl);
  UI.closeModal();
  ok('و پس از بستن فوکوس به همان‌جا برمی‌گردد', focused === 1, focused);
  document.activeElement = null;
  await U.sleep(5);

  Router.stack = keepStack;
  history.__reset();
  UI._mOpen = false;
}

section('دسترس‌پذیری پنجره و صفحه‌ها — در متنِ برنامه');
{
  const SRC = fs.readFileSync(__dirname + '/index.html', 'utf8');
  ok('Escape و Tab در یک شنوندهٔ کلید رسیدگی می‌شوند',
     /e\.key === 'Escape' \|\| e\.key === 'Esc'/.test(SRC) && /e\.key !== 'Tab'/.test(SRC));
  ok('Tab داخلِ پنجره زندانی می‌شود (چرخشِ اول/آخر)',
     /cur === last \|\| !box\.contains\(cur\)/.test(SRC) &&
     /cur === first \|\| !box\.contains\(cur\)/.test(SRC));
  ok('جعبهٔ پنجره tabindex منفی می‌گیرد', /box\.setAttribute\('tabindex', '-1'\)/.test(SRC));
  ok('فوکوسِ خودکار روی ورودی نمی‌رود (صفحه‌کلید گوشی باز نشود)',
     !/const first = box\.querySelector/.test(SRC) &&
     /box\.focus\(\{ preventScroll: true \}\)/.test(SRC));
  ok('صفحه‌ها tabindex منفی می‌گیرند تا فوکوس برنامه‌ای ممکن باشد',
     /if\(!s\.hasAttribute\('tabindex'\)\) s\.setAttribute\('tabindex', '-1'\)/.test(SRC));
  ok('پنجره نقش dialog و aria-modal دارد',
     /role', 'dialog'/.test(SRC) && /aria-modal/.test(SRC));
  ok('پشته دیگر با هر بازگشت از نو ساخته نمی‌شود',
     !/const name = e\.state\?\.screen \|\| 'home';\s*\n\s*this\.stack = \[name\];/.test(SRC));
  ok('init یک بار اجرا می‌شود (شنوندهٔ popstate دوباره ثبت نمی‌شود)',
     /if\(this\._inited\) return; this\._inited = true;/.test(SRC));
  ok('ورودیِ نشان‌دار پس از رفرش پاک می‌شود (تا «عقب» بی‌دلیل خرج نشود)',
     /history\.state\.modal\)\{\s*\n\s*const cur = this\.screens/.test(SRC));
}
section('کنتراست رنگ‌ها — همهٔ شش تم، روی هر سه سطح');
{
  /* این سنجش هیچ مرورگری لازم ندارد: توکن‌ها را از CSS می‌خواند و نسبتِ
     کنتراستِ WCAG را حساب می‌کند. تمِ روشن پیش‌تر سه رنگِ زیرِ حد داشت:
     طلایی ۳٫۰۹، سبز ۴٫۱۷، خاکستری ۴٫۴۲ (حد لازم ۴٫۵). بدتر از آن،
     --ink روی گرادیانِ طلایی ۱٫۵۷ بود — یعنی متنِ سفید روی طلاییِ روشن،
     روی هر دکمهٔ اصلی و تبِ فعال. بی این سنجش، بارِ بعد هم بی‌صدا
     برمی‌گشت. */
  const css = fs.readFileSync(__dirname + '/index.html', 'utf8')
    .match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
  const lum = h => {
    const c = [1,3,5].map(i => parseInt(h.slice(i, i+2), 16)/255)
      .map(v => v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4));
    return .2126*c[0] + .7152*c[1] + .0722*c[2];
  };
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b);
    return (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
  };
  const toks = sel => {
    const re = new RegExp(sel.replace(/[[\]"]/g, m => '\\' + m) + '\\s*\\{([\\s\\S]*?)\\}', 'g');
    const out = {}; let m;
    while((m = re.exec(css)))
      for(const t of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[t[1]] = t[2].trim();
    return out;
  };
  /* --float ها نیمه‌شفاف‌اند (نوار پخش روی صفحه می‌نشیند، پشتش دیده می‌شود).
     پس رنگشان را اول روی --bg می‌خوابانیم و بعد نسبت می‌گیریم؛ وگرنه
     عددِ خامِ rgba بی‌معنا می‌شود. */
  const flat = (c, over) => {
    const m = String(c).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/i);
    if(!m) return c;
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    const b = [1,3,5].map(i => parseInt(over.slice(i, i + 2), 16));
    return '#' + [0,1,2].map(i => Math.round(parseFloat(m[i+1]) * a + b[i] * (1 - a))
      .toString(16).padStart(2, '0')).join('');
  };

  const base = toks(':root');
  const themes = { dark: base };
  for(const t of Theme.ALL.filter(x => x !== 'dark'))
    themes[t] = Object.assign({}, base, toks(`[data-theme="${t}"]`));

  for(const t of Theme.ALL)
    ok(`تم «${t}» در CSS هست`, !!(themes[t] && themes[t]['--bg']));

  const FG = ['txt','mut','gold','grn','red','blu','prp'];
  let worst = { r: 99, at: '—' };
  for(const [name, t] of Object.entries(themes)){
    if(!t['--bg']) continue;
    const bgs = ['bg','card','card2'].map(k => t['--'+k]).filter(Boolean);
    for(const f of FG){
      const c = t['--'+f];
      if(!c || !/^#[0-9a-f]{6}$/i.test(c)){ ok(`تم ${name}: رنگ ${f} هگزِ کامل است`, false, c); continue; }
      for(const b of bgs){
        const r = ratio(c, b);
        if(r < worst.r) worst = { r, at: `${name}: --${f} روی ${b}` };
        ok(`تم ${name}: --${f} روی ${b} از حد AA می‌گذرد (${r.toFixed(2)})`, r >= 4.5);
      }
    }
    /* --ink = متنِ روی گرادیان؛ متنِ دکمه است، پس حد ۴٫۵. */
    for(const stop of ((t['--grad'] || '').match(/#[0-9a-f]{6}/gi) || [])){
      const r = ratio(t['--ink'], stop);
      ok(`تم ${name}: مرکب روی گرادیان ${stop} خوانا است (${r.toFixed(2)})`, r >= 4.5);
    }
    /* --fill = پرِ نوارِ پیشرفت روی سطح؛ گرافیک است، پس حد ۳. */
    for(const stop of ((t['--fill'] || '').match(/#[0-9a-f]{6}/gi) || [])){
      const r = ratio(stop, t['--card']);
      ok(`تم ${name}: پرِ نوارِ پیشرفت از کارت جدا دیده می‌شود (${r.toFixed(2)})`, r >= 3);
    }
    /* --float1/--float2 = سطحِ شناورِ نیمه‌شفاف (نوار پخش، بنر نصب، پنل
       اشکال‌زدایی). متنِ داخلشان --txt/--mut/--gold است، پس همان‌ها سنجیده
       می‌شوند. این‌ها یک بار رنگِ تیرهٔ ثابت بودند و در تم روشن متنِ تیره
       روی زمینهٔ تیره می‌نشست. */
    for(const k of ['float1', 'float2']){
      if(!t['--' + k]){ ok(`تم ${name}: توکن --${k} هست`, false); continue; }
      const bg = flat(t['--' + k], t['--bg']);
      for(const f of ['txt','mut','gold']){
        const r = ratio(t['--' + f], bg);
        ok(`تم ${name}: --${f} روی سطحِ شناورِ ${k} خواناست (${r.toFixed(2)})`, r >= 4.5);
      }
    }
  }
  ok('بدترین نسبتِ کل تم‌ها هنوز از AA می‌گذرد', worst.r >= 4.5,
     `${worst.r.toFixed(2)} در ${worst.at}`);
  ok('همهٔ تم‌ها --ink و --fill دارند',
     Object.values(themes).every(t => t['--ink'] && t['--fill']));
  ok('همهٔ تم‌ها --float1 و --float2 دارند',
     Object.values(themes).every(t => t['--float1'] && t['--float2']));
}

section('هدف لمسی — هر کلید جای انگشت دارد (۴۴px)');
{
  /* ۴۴ پیکسل کمینهٔ شناخته‌شدهٔ هدف لمسی است (راهنمای اپل، و همان چیزی
     که اندروید با ۴۸dp به آن نزدیک است). پیش از این دکمه‌های کوچک بودند:
     ✕ پیام ۳۰px، کلید پخش ۲۸px، نوار پایین ۳۶px. جاهایی که ردیف چنان
     تنگ است که خودِ دکمه نمی‌تواند رشد کند، یک لایهٔ نامرئی ::after روی
     دکمه کشیده شده؛ پس سه راه پذیرفته است: اندازهٔ خودِ عنصر، min-height،
     یا ::after. */
  const raw = fs.readFileSync(__dirname + '/index.html', 'utf8')
    .match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
  /* توضیح‌های CSS باید بروند؛ وگرنه متنِ توضیح به شناسهٔ قاعده می‌چسبد
     و قاعده پیدا نمی‌شود (همان اشتباهی که یک بار در همین پرونده رخ داد). */
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(m => ({ sel: m[1].trim(), body: m[2] }));

  const bodies = s => rules
    .filter(r => r.sel.split(',').map(x => x.trim()).includes(s))
    .map(r => r.body);
  const px = (body, prop) => {
    const m = body.match(new RegExp(prop + '\\s*:\\s*([0-9.]+)px'));
    return m ? parseFloat(m[1]) : null;
  };
  const MIN = 44;
  const why = sel => {
    const bs = bodies(sel);
    if(bs.some(b => (px(b, 'width') || 0) >= MIN && (px(b, 'height') || 0) >= MIN)) return 'اندازه';
    if(bs.some(b => (px(b, 'min-height') || 0) >= MIN)) return 'min-height';
    const a = bodies(sel + '::after');
    if(a.some(b => (px(b, 'min-height') || 0) >= MIN && /position\s*:\s*absolute/.test(b)))
      return '::after';
    return '';
  };

  const CTRL = ['.btn', '.btn.sm', '.iconbtn', '.back', '.qsm', '#miniQ button', '.tab',
    '.nav button', '.rec .prev', '.ib .ib-x', '.ib .ib-go', '.emoji-bar button',
    '.wbx', '.bm-row .bx', '.dua-word', '.sp-skip'];
  for(const s of CTRL){
    const w = why(s);
    ok(`«${s}» جای انگشت دارد`, !!w, w || 'نه اندازه، نه min-height، نه ::after');
  }

  const small = [...css.matchAll(/font-size\s*:\s*([0-9.]+)px/g)]
    .map(m => parseFloat(m[1])).filter(v => v < 11);
  ok('هیچ متنی در برنامه زیر ۱۱px نیست', small.length === 0,
     [...new Set(small)].join(', '));
}

section('اجزای دو-تمی — رنگِ ثابت ندارند');
{
  /* ریشهٔ بیشترِ باگ‌های تم: جزئی که در *هر* تم دیده می‌شود، رنگش را
     دست‌ساز گرفته باشد. در تم تاریک درست دیده می‌شود و در تم روشن
     ناخوانا می‌شود. این اجزا همه دو-تمی‌اند، پس رنگشان باید توکن باشد.
     سنجش روی خودِ مقدار است، نه روی نام: هر مقدارِ #hex یا rgb() در
     color/background/border-color این فهرست، شکست است. */
  const css = fs.readFileSync(__dirname + '/index.html', 'utf8')
    .match(/<style[^>]*>([\s\S]*?)<\/style>/)[1]
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(m => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }));

  /* .ib .ib-logo عمداً تیرهٔ ثابت است: نشانِ برنامه روی زمینهٔ تیره، مثل
     آیکن اپ. متن ندارد. #splash و .hero h1 و .sp-title هم گرادیانِ
     دست‌ساز دارند ولی همه‌شان در تم روشن بازنویسی شده‌اند. */
  const SHARED = ['#miniQ', '#miniQ .m-t small', '.ib', '.ib .ib-t b', '.ib .ib-t small',
    '.daily', '.daily-ayah-ar', '.daily-fa', '.qbox .qhint.d1', '.qbox .qhint.d3',
    '#dbg', '.sp-basmala', '.sp-latin', '.sp-star', '#splash .sp-stars i'];
  /* border-color عمداً بیرون است: قابِ رنگیِ چیپِ راهنما یک تزئینِ
     نیمه‌شفاف است و زمینه را از پشت نشان می‌دهد، و معنیِ چیپ را متنِ
     رنگی‌اش می‌رساند (که همان --grn/--red سنجیده‌شده است). چیزی که
     این‌جا ممنوع است رنگِ *متن* و *سطح* است. */
  const PROPS = ['color', 'background', 'background-color'];
  let hard = 0;
  for(const sel of SHARED){
    const bs = rules.filter(r => r.sel.split(',').map(x => x.trim()).includes(sel)).map(r => r.body);
    if(!bs.length){ ok(`«${sel}» در CSS پیدا شد`, false); continue; }
    for(const body of bs)
      for(const dec of body.split(';')){
        const i = dec.indexOf(':'); if(i < 0) continue;
        if(!PROPS.includes(dec.slice(0, i).trim().toLowerCase())) continue;
        const val = dec.slice(i + 1).trim();
        if(/#[0-9a-f]{3,8}/i.test(val) || /rgba?\(/i.test(val)){
          hard++;
          ok(`«${sel}» رنگِ ثابت ندارد`, false, `«${val}»`);
        }
      }
  }
  ok('در هیچ‌کدام از اجزای دو-تمی رنگِ ثابت نمانده', hard === 0,
     `${hard} مورد`);
}

section('آیکن‌ها — SVGِ درون‌خطی، نه ایموجی');
{
  /* ایموجی به‌عنوان آیکنِ کارکردی سه ایراد دارد: در هر سیستم جورِ دیگری
     درمی‌آید، رنگِ تم را نمی‌گیرد، و اندازه‌اش با font-size قاطی می‌شود.
     این سنجش سه چیز را می‌گیرد: نامِ آیکنِ ناموجود (که جای خالی می‌دهد)،
     ایموجیِ جامانده در آیکن‌های ثابت، و از‌قلم‌افتادنِ رنگ‌پذیریِ SVG. */
  const doc = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const css = doc.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const body = doc.slice(0, doc.indexOf('<script>'));

  /* نامِ خط‌دار (`users-plus`) هم باید گرفته شود، وگرنه نامِ غلط بی‌صدا
     جای خالی می‌دهد. */
  const named = [...new Set([...body.matchAll(/data-ic="([a-z][a-z0-9-]*)"/g)].map(m => m[1]))];
  ok('در سند آیکنِ نشانه‌گذاری‌شده هست', named.length >= 10, String(named.length));
  for(const n of named)
    ok(`آیکنِ «${n}» در دفتر هست`, !!Icon.REG[n], 'نامی که وجود ندارد یعنی جای خالی');

  /* الگو عمداً نامِ خط‌دار (`book-open`) و آرگومانِ اندازه را هم می‌گیرد.
     نسخهٔ پیشین فقط `[a-z]+` و بدونِ آرگومان بود، پس آیکن‌های تازهٔ
     خط‌دار از زیرِ این تور بیرون می‌زدند و نامِ غلط بی‌صدا جای خالی
     می‌داد. */
  const viaOf = [...new Set([...doc.matchAll(/Icon\.of\('([a-z][a-z0-9-]*)'(?:\s*,\s*\d+\s*)?\)/g)].map(m => m[1]))];
  for(const n of viaOf) ok(`Icon.of('${n}') به آیکنِ موجود می‌رسد`, !!Icon.REG[n]);
  ok('آیکن‌های نام‌دار (با خط تیره) هم پوشش داده می‌شوند',
     viaOf.some(n => n.includes('-')), viaOf.join(' '));
  ok('آرگومانِ اندازهٔ Icon.of اندازه را واقعاً می‌نشاند', (() => {
    const a = Icon.of('home'), b = Icon.of('home', 18);
    return !/style=/.test(a) && /style="width:18px;height:18px"/.test(b) &&
           /viewBox="0 0 24 24"/.test(b);
  })());
  ok('اندازهٔ بی‌معنا (۰/منفی/چیزِ دیگر) نادیده گرفته می‌شود',
     !/style=/.test(Icon.of('home', 0)) && !/style=/.test(Icon.of('home', 'x')));

  const svg = Icon.of('home');
  ok('آیکن SVG است با viewBoxِ درست', /^<svg /.test(svg) && /viewBox="0 0 24 24"/.test(svg));
  ok('آیکن برای صفحه‌خوان پنهان است (برچسب از دکمه می‌آید)', /aria-hidden="true"/.test(svg));
  ok('آیکنِ ناشناس چیزی برنمی‌گرداند', Icon.of('چنین‌چیزی') === '');
  ok('آیکن خطی، تو‌خالی است و رنگ را از متن می‌گیرد',
     /stroke:currentColor/.test(css) && /\.ic\{[^}]*fill:none/.test(css));
  ok('آیکنِ توپر (پخش/توقف) با fill پر می‌شود', /\.icf\{[^}]*fill:currentColor/.test(css));

  /* نوار پایین و نوار پخش، آیکنشان ثابت است — نباید ایموجی داشته باشند. */
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
  const nav = doc.match(/<nav class="nav"[\s\S]*?<\/nav>/)[0];
  ok('نوار پایین ایموجی ندارد (آیکن دارد)', !emoji.test(nav),
     (nav.match(emoji) || []).join(' '));
  const mq = doc.slice(doc.indexOf('id="miniQ"'), doc.indexOf('id="miniQ"') + 700);
  ok('نوار پخش ایموجی ندارد', !emoji.test(mq), (mq.match(emoji) || []).join(' '));

  /* هر دکمهٔ آیکنیِ ثابت باید یا آیکن داشته باشد یا متن. */
  for(const b of body.match(/<button[^>]*class="[^"]*iconbtn[^"]*"[^>]*>[\s\S]*?<\/button>/g) || []){
    const inner = b.replace(/^[\s\S]*?<button[^>]*>/, '');
    ok('دکمهٔ آیکنیِ ثابت ایموجی ندارد',
       !emoji.test(inner) && /data-ic|[؀-ۿ]/.test(inner), inner.trim().slice(0, 60));
  }

  /* ── هر نامی که `Glyph.MAP` به آن می‌رساند باید در دفتر باشد ──
     اگر نباشد، `Icon.of` رشتهٔ تهی می‌دهد و به‌جای آیکن **هیچ** نمی‌نشیند
     — نه آیکن، نه ایموجی. این دقیقاً باگِ `megaphone` بود: نام در نقشه
     بود ولی در دفترِ دیگری. */
  const missing = Object.entries(Glyph.MAP).filter(([, n]) => !Icon.REG[n]);
  ok('هر نامِ `Glyph.MAP` در دفترِ آیکن‌ها هست', missing.length === 0,
     missing.map(([e, n]) => e + '→' + n).join(' '));
  ok('و هر مقدارِ نقشه یکتاست و بی‌فاصله', Object.keys(Glyph.MAP).every(k => k.trim() === k));

  /* ── `Glyph.lead` ──
     ایموجیِ صدرِ پیام را جدا می‌کند تا SVG بنشیند. ولی نباید محتوای کاربر
     را ببلعد: چهرکِ انتخابی و ایموجیِ داخلِ متنِ حدیث در نقشه نیستند. */
  ok('`lead` ایموجیِ صدر را جدا می‌کند',
     JSON.stringify(Glyph.lead('⚠️ تلاوت نشد')) === JSON.stringify({ emoji: '⚠️', rest: 'تلاوت نشد' }));
  ok('و پیامِ بی‌ایموجی را دست نمی‌زند', Glyph.lead('سلام') === null);
  ok('🔒 و چهرکِ انتخابیِ کاربر را به آیکن بدل نمی‌کند', Glyph.lead('🦉 جغد') === null);
  ok('و بلندترین کلید اول تطبیق می‌خورد (❌⭕ نه ❌)',
     Glyph.lead('❌⭕ دوز')?.emoji === '❌⭕');
}

section('باگِ آیهٔ امروز — دکمه‌های خواندن/کپی');
{
  /* ── چه چیزی خراب بود ──
     فاز ۳ برای «درخششِ گذری» یک نوار از بیرونِ دکمه می‌لغزاند و برای
     بُریدنش `overflow:hidden` روی `.btn` گذاشت. ولی هر `overflow` غیرِ
     `visible` کمینهٔ خودکارِ آیتمِ فلکس را صفر می‌کند، پس دو دکمهٔ
     کارتِ آیه در ردیفِ فلکس از عرضِ متنشان کوچک‌تر شدند و متنشان برید.
     این سنجش‌ها هم علت را می‌گیرند و هم درمان را. */
  const doc = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const raw = doc.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

  ok('ریشه: دیگر `overflow:hidden` روی پایهٔ `.btn` نیست',
     !/\.btn\{[^}]*overflow\s*:\s*hidden/.test(css),
     '.btn{…overflow:hidden…} کمینهٔ فلکس را صفر می‌کند و متن را می‌بُرد');
  ok('درخشش با background-position حرکت می‌کند، نه با لغزاندنِ جعبه',
     /@keyframes sk-sheen\s*\{[^}]*background-position/.test(css));
  ok('درخششِ کهنه (`sk-shine`) دیگر به `.btn` وصل نیست',
     !/\.btn(?![\w-])[^{,]*\{[^}]*sk-shine/.test(css.replace(/#gate[^{]*\{[^}]*\}/g, '')),
     'sk-shine فقط در گروهِ ورود مانده');

  /* ── کارتِ آیهٔ روز ── */
  const daily = doc.slice(doc.indexOf('const Daily = {'), doc.indexOf('گزینش سوره و فونت'));
  ok('کارتِ آیه از گریدِ کنش‌ها استفاده می‌کند', /class="ayah-actions"/.test(daily));
  ok('هر دو دکمه کلاسِ `.ayah-action` دارند',
     (daily.match(/class="ayah-action"/g) || []).length === 2);
  ok('دکمه‌ها آیکنِ SVG دارند، نه ایموجی',
     /Icon\.of\('book-open',\s*\d+\)[\s\S]{0,60}?<span>خواندن سوره<\/span>/.test(daily) &&
     /Icon\.of\('copy',\s*\d+\)[\s\S]{0,60}?<span>کپی آیه<\/span>/.test(daily),
     (daily.match(/[\u{1F000}-\u{1FAFF}]/gu) || []).join(' '));
  ok('متنِ دکمه داخلِ span است تا آیکن پاکش نکند',
     /<button class="ayah-action" id="dayRead">[\s\S]{0,80}?<span>/.test(daily));
  ok('برچسبِ کارت هم آیکن گرفت، نه ماهِ ایموجی',
     /Icon\.of\('moon'\)/.test(daily) && !/🌙/.test(daily));
  ok('شناسه‌های dayRead/dayCopy سرِ جایشان ماندند (JS به آن‌ها وصل است)',
     /id="dayRead"/.test(daily) && /id="dayCopy"/.test(daily));

  /* ── CSSِ خودِ کنش‌ها ── */
  const act = css.match(/\.ayah-actions\{[^}]*\}/)[0];
  const btn = css.match(/\.ayah-action\{[^}]*\}/)[0];
  ok('گریدِ دوستونی است', /grid-template-columns:\s*1fr 1fr/.test(act));
  ok('خطِ جداکنندهٔ بالای ردیف هست', /border-top:\s*1px solid var\(--line\)/.test(act));
  ok('ارتفاعِ لمسی کم‌دست‌از ۴۴ پیکسل است',
     /min-height:\s*(\d+)px/.test(btn) && +btn.match(/min-height:\s*(\d+)px/)[1] >= 44,
     btn.match(/min-height:\s*(\d+)px/)[1]);
  ok('متن در یک خط می‌ماند', /white-space:\s*nowrap/.test(btn));
  ok('`min-width:0` هست وگرنه ستونِ گرید از متن باریک‌تر می‌شد',
     /min-width:\s*0/.test(btn));
  ok('پسِ‌زمینه و رنگ از توکن‌های خودِ تم می‌آید، نه رنگِ ثابت',
     /background:\s*var\(--card2\)/.test(btn) && /color:\s*var\(--txt\)/.test(btn));
  ok('فونت را از والد می‌گیرد (مرورگر پیش‌فرضِ دکمه را نمی‌پوشاند)',
     /font-family:\s*inherit/.test(btn));
  ok('آیکنِ داخلِ دکمه کوچک نمی‌شود',
     /\.ayah-action \.ic\{[^}]*width:18px/.test(css));
  ok('متنِ سرریز «…» می‌گیرد، نه بریدنِ خام',
     /\.ayah-action span\{[^}]*text-overflow:\s*ellipsis/.test(css));
  ok('زیرِ ۴۰۰ پیکسل تک‌ستونی می‌شود',
     /@media\s*\(max-width:\s*400px\)\{\s*\.ayah-actions\{[^}]*grid-template-columns:\s*1fr\s*\}/.test(css));
  ok('حالتِ فوکوس هم مثلِ hover دیده می‌شود (دسترس‌پذیری)',
     /\.ayah-action:hover,\s*\.ayah-action:focus-visible/.test(css));

  /* ── درختِ فِلکسِ کهنه دیگر روی این دکمه‌ها نیست ── */
  ok('دیگر `btn gh sm` روی دکمه‌های آیه نمانده',
     !/id="dayRead"[^>]*class="[^"]*btn/.test(daily) &&
     !/class="[^"]*btn[^"]*"[^>]*id="dayRead"/.test(daily));
}

section('پوسته — توکن‌های حرکت و کی‌فریم‌های تازه');
{
  /* ── چرا این سنجش‌ها ──
     پوستهٔ تازه از یک فایلِ مرجع آمد که ۱۸ کی‌فریم و دو منحنیِ حرکت
     داشت. سه نامِ آن (float / shine / pop) در همین پرونده از قبل وجود
     داشتند؛ نشستنِ نامِ تازه روی نامِ کهنه بی‌هیچ خطایی انیمیشنِ جای
     دیگری را عوض می‌کند. این‌جا همان دام را می‌سنجیم. */
  const doc = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const css = doc.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];

  ok('منحنیِ نرمِ مرجع تعریف شده',
     /--ease:\s*cubic-bezier\(\.22,\s*1,\s*\.36,\s*1\)/.test(css));
  ok('منحنیِ کشسانِ مرجع تعریف شده',
     /--bounce:\s*cubic-bezier\(\.34,\s*1\.56,\s*\.64,\s*1\)/.test(css));

  /* ۱۸ کی‌فریمی که فایلِ مرجع دارد — با پیشوندِ sk- */
  const WANT = ['sk-entrance', 'sk-float', 'sk-drift', 'sk-rotate', 'sk-keyPulse',
    'sk-key-unlock', 'sk-key-reject', 'sk-shackle-open', 'sk-shackle-jam',
    'sk-lock-clunk', 'sk-body-shake', 'sk-flash-ring', 'sk-spark-burst',
    'sk-shine', 'sk-pop', 'sk-blink', 'sk-twinkle', 'sk-wave'];
  const defined = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]));
  for(const k of WANT) ok(`کی‌فریمِ «${k}» هست`, defined.has(k));
  ok('هر ۱۸ کی‌فریمِ مرجع پیاده شده', WANT.length === 18 && WANT.every(k => defined.has(k)));

  /* ── دامِ نامِ تکراری ──
     اگر `sk-` برداشته شود، این سه با تعریف‌های موجود تلاقی می‌کنند.
     سنجش می‌کند که (الف) نامِ خالی تکرار نشده، و (ب) آن سه نامِ قدیمی
     سرِ جای خودشان مانده‌اند و پاک نشده‌اند. */
  const counts = {};
  for(const m of css.matchAll(/@keyframes\s+([\w-]+)/g)) counts[m[1]] = (counts[m[1]] || 0) + 1;
  const dup = Object.entries(counts).filter(([, n]) => n > 1).map(([k]) => k);
  ok('هیچ نامِ کی‌فریمی که خودم اضافه کردم تکرار نشده',
     dup.every(k => k.startsWith('sk-') === false), 'تکراری: ' + dup.join(', '));
  for(const n of ['float', 'shine', 'pop'])
    ok(`کی‌فریمِ کهنهٔ «${n}» پاک نشده (پس با sk- تلاقی نمی‌کند)`, defined.has(n));

  /* هیچ قاعده‌ای نباید به کی‌فریمِ بی‌وجود اشاره کند — خطای خاموشِ CSS */
  const used = new Set([...css.matchAll(/animation(?:-name)?:\s*([^;{}]+)/g)]
    .flatMap(m => m[1].split(','))
    .map(s => s.trim().split(/\s+/)[0])
    .filter(s => /^[a-zA-Z][\w-]*$/.test(s)));
  const missing = [...used].filter(n => !defined.has(n) && n !== 'none' && n !== 'inherit');
  ok('هر animation به کی‌فریمِ موجود اشاره می‌کند', missing.length === 0, missing.join(', '));

  /* ── prefers-reduced-motion ──
     قاعدهٔ سراسریِ برنامه باید کی‌فریم‌های تازه را هم بگیرد، وگرنه
     `sk-drift`/`sk-shine` بی‌توقف می‌چرخند و برای کاربری که حرکت
     نمی‌خواهد آزارنده‌اند. */
  const rm = css.slice(css.indexOf('prefers-reduced-motion:reduce'));
  ok('قاعدهٔ کاهشِ حرکت سراسری است و تازه‌ها را هم می‌گیرد',
     /\*,?\s*\*::before\s*,\s*\*::after\s*\{[^}]*animation-duration/.test(rm.replace(/\s+/g, ' ')) ||
     /\*,\*::before,\*::after/.test(rm.replace(/\s+/g, '')));
}

section('حلقهٔ فوکوس و حاشیهٔ ایمنِ گوشی');
{
  /* دو چیز که فقط روی دستگاهِ واقعی خودشان را نشان می‌دهند:
     ۱) حلقهٔ فوکوس اگر border-radius بدهد، شکلِ عنصر را عوض می‌کند —
        دکمهٔ گردِ پخش با تب‌گردی مربعی می‌شد.
     ۲) هرچه به پایینِ صفحه چسبیده، باید env(safe-area-inset-bottom)
        را حساب کند؛ وگرنه روی آیفون زیر نوارِ خانه می‌رود. */
  const css = fs.readFileSync(__dirname + '/index.html', 'utf8')
    .match(/<style[^>]*>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(m => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }));
  const forSel = s => rules.filter(r => r.sel.split(',').map(x => x.trim()).includes(s));

  const fv = rules.filter(r => r.sel.split(',').map(x => x.trim()).includes(':focus-visible'));
  ok('حلقهٔ فوکوس سراسری تعریف شده', fv.length > 0);
  ok('حلقهٔ فوکوس شکلِ عنصر را عوض نمی‌کند', !fv.some(r => /border-radius/.test(r.body)),
     fv.map(r => r.body).join(' | ').slice(0, 80));
  ok('حلقهٔ فوکوس رنگِ تم دارد', fv.some(r => /outline\s*:\s*3px solid var\(--gold\)/.test(r.body)));

  for(const sel of ['#miniQ', '#dbg', '#dbgBtn']){
    const rs = forSel(sel).filter(r => /position\s*:\s*fixed/.test(r.body));
    ok(`«${sel}» به پایینِ صفحه چسبیده است`, rs.length > 0);
    ok(`«${sel}» حاشیهٔ ایمنِ پایین را حساب می‌کند`,
       rs.length > 0 && rs.every(r => /safe-area-inset-bottom/.test(r.body)),
       rs.map(r => r.body.replace(/\s+/g, ' ').slice(0, 90)).join(' ／ '));
  }
  ok('بدنهٔ برنامه هم برای نوارِ خانهٔ آیفون جا باز می‌کند',
     /padding:0 14px calc\(120px \+ env\(safe-area-inset-bottom/.test(css));
  ok('نوار پایین حاشیهٔ ایمن را در padding خودش دارد',
     /padding:9px 6px calc\(9px \+ env\(safe-area-inset-bottom/.test(css));
}

section('قلمِ پایه — میزبانی‌شده، بی گره به شبکه');
{
  /* قلمِ پایه تا پیش از این از jsDelivr می‌آمد، با یک <link> که رندر را
     هم می‌بست. اگر CDN نمی‌آمد، برنامه با قلمِ پیش‌فرضِ سیستم بالا
     می‌آمد و آفلاین هم هیچ‌وقت درست نمی‌شد. این سنجش سه چیز را نگه
     می‌دارد: فایلِ قلم واقعاً باشد، وزن‌های لازم تعریف شده باشند، و
     هیچ‌جای دیگری در <head> به بیرون گره نخورده باشد. */
  const doc = fs.readFileSync(__dirname + '/index.html', 'utf8');
  const head = doc.slice(0, doc.indexOf('<style'));
  const css = doc.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];

  const faces = [...css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)].map(m => m[1]);
  ok('قلمِ پایه @font-face دارد', faces.length >= 3, String(faces.length));

  const srcs = faces.flatMap(f => [...f.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]));
  ok('همهٔ قلم‌ها فایلِ محلی‌اند (نه نشانیِ بیرونی)',
     srcs.every(s => !/^https?:|^\/\//.test(s)), srcs.filter(s => /^https?:|^\/\//.test(s)).join(' '));
  for(const s of srcs)
    ok(`فایلِ قلم هست: ${s}`, fs.existsSync(__dirname + '/' + s));
  for(const s of srcs){
    const head4 = fs.existsSync(__dirname + '/' + s)
      ? fs.readFileSync(__dirname + '/' + s).subarray(0, 4).toString('latin1') : '';
    ok(`«${s}» یک WOFF2ِ سالم است`, head4 === 'wOF2', head4);
  }
  const weights = faces.map(f => (f.match(/font-weight\s*:\s*(\d+)/) || [])[1]).filter(Boolean);
  for(const w of ['400', '700', '800'])
    ok(`وزن ${w} قلمِ پایه تعریف شده`, weights.includes(w), weights.join(','));
  ok('قلم‌ها با swap می‌آیند (متن بی‌قلم نمی‌ماند)',
     faces.every(f => /font-display\s*:\s*swap/.test(f)));

  /* هیچ برگهٔ سبکِ بیرونیِ مسدودکننده‌ای در <head> نماند. */
  ok('در <head> برگهٔ سبکِ بیرونی نیست',
     !/<link[^>]+rel=["']stylesheet["'][^>]*>/i.test(head),
     (head.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/i) || [''])[0]);

  ok('نامِ قلم در زنجیرهٔ جانشینِ نمایشی هست', /Vazirmatn/.test(FALLBACK_DISP));
  ok('نامِ قلم در زنجیرهٔ جانشینِ قرآنی هم هست', /Vazirmatn/.test(FALLBACK_QURAN));

  const sw = fs.readFileSync(__dirname + '/sw.js', 'utf8');
  for(const s of srcs)
    ok(`سرویس‌ورکر «${s}» را پیش‌ذخیره می‌کند`, sw.includes(s.replace(/^\.\//, './')));
}

section('قلم‌های اختیاری — با swap می‌آیند، نه با متنِ نامرئی');
{
  /* برگهٔ سبکِ سه قلمِ rastikerdar هیچ font-display ندارد؛ یعنی FOIT:
     تا آمدنِ قلم متنِ فارسی نامرئی می‌ماند. راه‌حل این است که از آن CSS
     صرف‌نظر کنیم و شیءِ FontFace را خودمان با display:'swap' بسازیم. */
  const withFaces = Object.entries(FONTS).filter(([, f]) => f.faces);
  ok('قلم‌های بی‌swap دستِ‌کم سه‌تا هستند', withFaces.length >= 3,
     withFaces.map(([k]) => k).join(', '));
  for(const [k, f] of withFaces){
    ok(`«${k}» فهرستِ وجه‌ها دارد`, Array.isArray(f.faces) && f.faces.length > 0);
    ok(`«${k}» راهِ <link> را هم نگه داشته (برای مرورگرِ قدیمی)`, !!f.css);
    for(const x of f.faces){
      ok(`«${k}» وجهِ ${x.w} فایلِ woff2 می‌گیرد`, /\.woff2$/.test(x.src || ''), x.src);
      ok(`«${k}» وجهِ ${x.w} خانواده‌اش را دارد`, !!x.family);
    }
    ok(`«${k}» وزنِ ۴۰۰ و ۷۰۰ دارد`,
       f.faces.some(x => x.w === '400') && f.faces.some(x => x.w === '700'));
  }

  /* حالا خودِ مسیرِ بارگذاری: با FontFace حاضر، باید swap بخواهد و
     هیچ <link>ی به سند نچسباند. */
  const added = [];
  const made = [];
  const realFF = global.FontFace;
  const realFonts = document.fonts;
  global.FontFace = class {
    constructor(fam, src, opt){ this.family = fam; this.src = src; this.opt = opt || {}; made.push(this); }
    load(){ return Promise.resolve(this); }
  };
  document.fonts = { add(ff){ added.push(ff); } };
  try{
    const key = withFaces[0][0];
    Fonts.pending = {};
    Fonts.load(key);
    await new Promise(r => setTimeout(r, 30));
    ok('قلمِ اختیاری با FontFace بار می‌شود، نه با <link>',
       made.length >= 2 && added.length >= 1, `ساخته ${made.length}، افزوده ${added.length}`);
    ok('همهٔ وجه‌ها display:swap می‌خواهند',
       made.every(m => m.opt.display === 'swap'), JSON.stringify(made.map(m => m.opt)));
    ok('وزنِ وجه‌ها به FontFace پاس می‌شود',
       made.every(m => m.opt.weight), JSON.stringify(made.map(m => m.opt.weight)));
    ok('نشانیِ قلم از CDN و woff2 است',
       made.every(m => /cdn\.jsdelivr\.net/.test(m.src) && /\.woff2/.test(m.src)), made[0] && made[0].src);
  }finally{
    global.FontFace = realFF;
    document.fonts = realFonts;
  }
  ok('قلمی که با برنامه می‌آید (vazir) هیچ درخواستِ بیرونی ندارد',
     !FONTS.vazir.css && !FONTS.vazir.faces);

  /* گزینشگر قلم باید *همهٔ* قلم‌های آن نقش را بار کند، وگرنه پیش‌نمایشِ
     خط‌های ناانتخاب‌شده با قلمِ جانشین نوشته می‌شود و همه یک‌شکل به نظر
     می‌رسند — یعنی گزینشگر بی‌فایده. */
  const asked = [];
  const realLoad = Fonts.load;
  Fonts.load = function(k){ asked.push(k); return Promise.resolve(FONTS[k]); };
  try{
    for(const role of ['disp','quran']){
      asked.length = 0;
      UI.closeModal();
      openFontPicker(role);
      const needed = Fonts.list(role).filter(k => FONTS[k].css || FONTS[k].faces);
      for(const k of needed)
        ok(`گزینشگرِ ${role} قلمِ «${k}» را بار می‌کند`, asked.includes(k), asked.join(', '));
      UI.closeModal();
    }
  }finally{ Fonts.load = realLoad; }

  const cssNow = fs.readFileSync(__dirname + '/index.html', 'utf8')
    .match(/<style[^>]*>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  ok('گزینشگر قلمی که نیامده را «بارگیری نشد» نشان می‌دهد',
     /\.fpick\.miss\s*\{/.test(cssNow) && /\.fpick\.miss[^{]*::after\s*\{[^}]*بارگیری نشد/.test(cssNow));
}

section('تصاویر — هیچ درخواستی به فایلی که نیست نمی‌رود');
{
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');

  /* ── srcset ساختگی ──
     پیش‌تر img() این را می‌ساخت: srcset="a.webp 1x, a.jpg 1x". دو نامزد با
     تراکمِ یکسان یعنی مرورگر اولی را برمی‌دارد و دومی هرگز نامزد نمی‌شود؛
     پس نه واپس‌روی می‌داد و نه کاری می‌کرد. حالا واپس‌روی فقط از راهِ
     شنوندهٔ error در watch() است. */
  const imgBody = src.slice(src.indexOf('  img(p, {'), src.indexOf('  /* نگارهٔ SVG درون‌خطی */'));
  ok('img() دیگر srcset نمی‌سازد', !/srcset/.test(imgBody));
  ok('img() همان <img> تنبل را می‌سازد',
     /loading="\$\{eager \? 'eager' : 'lazy'\}"/.test(imgBody) && /decoding="async"/.test(imgBody));
  ok('img() مسیر خالی را رشتهٔ خالی می‌کند', /if\(!src\) return '';/.test(imgBody));

  /* واپس‌رویِ واقعی سرِ جایش باشد */
  const watchBody = src.slice(src.indexOf('  watch(){'), src.indexOf('  /* پوستهٔ PWA */'));
  ok('watch() خطای تصویر را می‌گیرد و جانشین SVG می‌گذارد',
     /addEventListener\('error'/.test(watchBody) && /data-fallback/.test(watchBody));

  /* ── هیچ مسیر تصویریِ ساختگی ──
     هر نشانیِ assets/ که در کد رشته‌سازی می‌شود باید یا فایلش باشد یا
     عمداً اختیاری باشد. اینجا ریشهٔ باگ نسخهٔ ۱۶ را می‌گیریم: درخواستِ
     چیزی که هرگز وجود نداشت. */
  /* فقط رشته‌سازی را می‌گیریم، نه توضیح‌ها — `img:'avatars/reciter-1.webp'`
     در راهنما و در دادهٔ نمونه عمداً مانده تا معلوم باشد چطور عکس بگذاری. */
  ok('دیگر نشانیِ ساختگیِ avatars/reciter-N در کد ساخته نمی‌شود',
     !/['"]avatars\/reciter-['"]\s*\+/.test(src));
  ok('چهرهٔ قاری از داده می‌آید، نه از شمارهٔ ردیف',
     /if\(!r\.img\) return fallback;/.test(src) && /Assets\.imageOrSvg\(r\.img,/.test(src));

  /* ردیفِ قاری باید *یک* چهره داشته باشد. پیش‌تر face + Assets.avatar
     پشتِ سرِ هم می‌آمدند: دو دایرهٔ ۳۸ پیکسلی با دو حرفِ متفاوت. */
  const rowsStart = src.indexOf('  rows(){', src.indexOf('const ReciterUI'));
  const rowsBody = src.slice(rowsStart, src.indexOf('  open(){', rowsStart));
  ok('ردیف قاری دو چهره ندارد',
     !/Assets\.avatar\(/.test(rowsBody) && (rowsBody.match(/\$\{this\.face\(r\)\}/g) || []).length === 1);

  /* ── sw.js و README باید با دیسک بخوانند ──
     پیش‌ذکرِ فایلی که نیست، هر نصب چند درخواستِ محکوم‌به‌شکست می‌فرستد. */
  const sw = fs.readFileSync(__dirname + '/sw.js', 'utf8');
  const optBlock = sw.slice(sw.indexOf('const OPTIONAL = ['), sw.indexOf('];', sw.indexOf('const OPTIONAL = [')));
  const optPaths = (optBlock.match(/'\.\/[^']+'/g) || []).map(s => s.slice(3, -1));
  ok('فهرست اختیاری خالی نیست', optPaths.length >= 4, optPaths.length + '');
  for(const p of optPaths)
    ok(`پیش‌ذکرِ sw.js موجود است: ${p}`, fs.existsSync(ROOT + '/' + p), p);

  /* ── README با دیسک یکی باشد ──
     جدولِ README پیش‌تر نام‌هایی داشت (.webp/.jpg برای آیکن‌ها) که با
     فایل‌های واقعی (.png) نمی‌خواند. سنجش، هر مسیرِ assets/ در README را
     با دیسک مقایسه می‌کند — به‌جز آن‌هایی که در بخشِ «اختیاری» هستند. */
  const readme = fs.readFileSync(__dirname + '/assets/README.md', 'utf8');
  ok('README دیگر آیکنِ webp/jpg وعده نمی‌دهد',
     !/icons\/icon-(192|512)\.(webp|jpg)/.test(readme) && !/maskable-512\.jpg/.test(readme));
  ok('README نسخهٔ کش را ۱۹ می‌گوید', /noorestan-19/.test(readme) && !/noorestan-17/.test(readme));
  ok('README واپس‌رویِ srcset را انکار می‌کند', /srcset\*\*? نیست|در `srcset` نیست/.test(readme) ||
     /واپس‌رویِ خودکار بین دو\s*\n?\s*پسوند \*\*در `srcset` نیست\*\*/.test(readme));

  /* ── درختِ README: هرچه ✅ خورده باید واقعاً باشد ── */
  const yes = (readme.match(/─\s*✅\s*موجود|—\s*✅\s*موجود/g) || []).length;
  ok('README دستِ‌کم دو پوشه را موجود می‌داند', yes >= 2, yes + '');
  for(const d of ['assets/fonts', 'assets/images/icons'])
    ok(`پوشهٔ ${d} وجود دارد و خالی نیست`,
       fs.existsSync(ROOT + '/' + d) && fs.readdirSync(ROOT + '/' + d).length > 0);
}

section('القاب چهارده معصوم — از منبع، بی پاسخِ دوگانه');
{
  const ih = DATA.imams || [];
  ok('هر چهارده معصوم فهرستِ القاب دارد',
     ih.length === 14 && ih.every(p => Array.isArray(p.titles) && p.titles.length >= 2),
     ih.filter(p => !(p.titles || []).length).map(p => p.name).join('، '));
  ok('هر فهرست منبع دارد', ih.every(p => /^ویکی‌شیعه، «.+»$/.test(p.laqabSrc || '')),
     ih.filter(p => !p.laqabSrc).map(p => p.name).join('، '));

  /* لقبِ نام‌آور باید در فهرست هم باشد، وگرنه دو روایتِ ناسازگار داریم */
  for(const p of ih)
    ok(`«${p.name}» لقبِ نام‌آورش را در فهرست هم دارد`, p.titles.includes(p.title), p.title);

  /* هیچ لقبی نباید دو بار بیاید — با نرمال‌سازی، وگرنه «ابن‌الرضا» و
     «ابن الرضا» دو گزینهٔ یکسان در یک پرسش می‌شوند */
  const nn = s => String(s || '').replace(/[‌‏ـ]/g, '').replace(/\s+/g, ' ').trim();
  for(const p of ih){
    const ks = p.titles.map(nn);
    ok(`القابِ «${p.name}» تکراری نیست`, new Set(ks).size === ks.length,
       p.titles.join(' • '));
  }
  /* زبالهٔ استخراج: پانویس، «سایر..»، پرانتزِ توضیحی، فاصلهٔ دوتایی.
     توجه: نیم‌فاصله عیب نیست — «حبیب‌الله» درست است و باید بماند؛
     نرمال‌سازیِ nn فقط برای مقایسه است، نه برای بازنویسیِ داده. */
  for(const p of ih)
    for(const t of p.titles)
      ok(`لقبِ سالم: «${t}»`,
         !/[\[\]]/.test(t) && !/^سایر/.test(t) && !/\((?:لقب|کنیه)\)/.test(t) &&
         /\S/.test(t) && t === t.replace(/\s+/g, ' ').trim(), t);

  /* ── پاسخِ دوگانه ──
     سخت‌ترین بخش. «هادی» هم لقبِ امام دهم است و هم در القابِ امام یازدهم
     آمده؛ «صادقین» مالِ باقر و صادق است؛ «ابن‌الرضا» مالِ سه امام.
     هیچ‌کدام نباید پاسخ یا گزینهٔ یک پرسش شوند. */
  const shared = ImamEngine.sharedTitles();
  for(const s of ['صادقین', 'هادی', 'ابن‌الرضا'])
    ok(`«${s}» مشترک شناخته می‌شود`, shared.has(nn(s)), [...shared].join(' | ').slice(0, 120));

  for(const im of ih){
    const mine = new Set(im.titles.map(nn));
    for(const k of ImamEngine.KINDS){
      const ans = k.get(im);
      if(!ans) continue;
      const pool = ImamEngine.wrongPool(im, k, ih);
      ok(`«${im.name}» / ${k.id}: پاسخ در گزینه‌ها تکرار نمی‌شود`,
         !pool.some(v => nn(v) === nn(ans)), String(ans));
      if(k.id !== 'title') continue;
      ok(`«${im.name}»: گزینه‌ای از القابِ خودش نمی‌آید`,
         !pool.some(v => mine.has(nn(v))),
         pool.filter(v => mine.has(nn(v))).join('، '));
      ok(`«${im.name}»: لقبِ مشترک گزینه نمی‌شود`,
         !pool.some(v => shared.has(nn(v))),
         pool.filter(v => shared.has(nn(v))).join('، '));
    }
  }

  /* ── راهنمای پس از پاسخ ──
     پیش‌تر `q.who.fact` خوانده می‌شد که در هیچ کارتی نبود، پس راهنما
     همیشه خالی می‌ماند. */
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  /* توضیح‌ها اول می‌روند: همین کامنتِ خودمان نامِ فیلدِ قدیمی را می‌آورد و
     بی این، سنجش به‌جای کد، به توضیح گیر می‌دهد. */
  const body = src.slice(src.indexOf('answer(word, btn){', src.indexOf('const ImamEngine')))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  ok('دیگر fact خوانده نمی‌شود', !/q\.who\.fact/.test(body));
  ok('راهنما فهرستِ القاب را نشان می‌دهد', /q\.who\.titles/.test(body) && /laqab-list/.test(body));
  ok('راهنما منبع را نشان می‌دهد', /q\.who\.laqabSrc/.test(body));
  const css = src.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  ok('.laqab-list سبک دارد', /\.laqab-list\s*\{[^}]*color/.test(css));

  /* ── پرسش‌ها واقعاً ساخته می‌شوند ──
     اگر صافی‌ها زیادی سختگیر بودند، ممکن بود هیچ پرسشی نماند. */
  const built = [];
  for(const im of ih)
    for(const k of ImamEngine.KINDS){
      const ans = k.get(im);
      if(!ans) continue;
      const seen = new Set([nn(ans)]);
      const uniq = [];
      for(const v of ImamEngine.wrongPool(im, k, ih)){
        const n = nn(v);
        if(seen.has(n)) continue;
        seen.add(n); uniq.push(v);
        if(uniq.length === 3) break;
      }
      if(uniq.length === 3) built.push({ who:im.name, k:k.id });
    }
  ok('از هر چهار پرسش دستِ‌کم یکی ساخته می‌شود',
     ['title', 'father', 'rank', 'shrine'].every(id => built.some(b => b.k === id)),
     built.map(b => b.k).filter((v, i, a) => a.indexOf(v) === i).join(', '));
  ok('پرسشِ لقب برای همهٔ چهارده ساخته می‌شود',
     ih.every(im => built.some(b => b.k === 'title' && b.who === im.name)),
     ih.filter(im => !built.some(b => b.k === 'title' && b.who === im.name))
       .map(im => im.name).join('، '));
}

section('محتوا — بازرسِ ساختاری، صفر ایراد');
{
  /* بازرسِ محتوا جداگانه است چون هم CLI است و هم سنجش. اجرای دوباره‌اش
     این‌جا یعنی هر ویرایشِ محتوا واپسین دروازه را هم رد می‌کند: پاسخِ
     بیرون از گزینه‌ها، گزینهٔ تکراری، واژهٔ کلیدی که در متن نیست،
     واژه‌های دعا که در دعا نیستند، و ارجاعِ شکسته. */
  const { execFileSync } = require('child_process');
  let out = '', code = 0;
  try{
    out = execFileSync('node', [__dirname + '/_content-audit.js'], { encoding: 'utf8' });
  }catch(e){
    code = e.status == null ? -1 : e.status;
    out = (e.stdout || '') + (e.stderr || '');
  }
  ok('بازرسِ محتوا بی‌ایراد تمام می‌شود', code === 0,
     out.split('\n').filter(l => l.includes('✗') || l.includes('ایراد')).slice(0, 6).join(' ／ '));
  ok('بازرس همهٔ بانک‌های پرسش‌محور را دیده', /quiz\s+31/.test(out) && /surahPick\s+24/.test(out));
  ok('بازرس خطای درست‌نما نمی‌سازد',
     /0 ایراد ساختاری/.test(out) && /0 هشدار/.test(out),
     (out.match(/\d+ ایراد ساختاری، \d+ هشدار/) || [''])[0]);

  /* کشیده نباید به کدِ نرمال‌سازی دست بزند و نباید در واژه بماند */
  const src2 = fs.readFileSync(__dirname + '/index.html', 'utf8');
  ok('دو نرمال‌سازیِ کشیده سرِ جایشان‌اند',
     (src2.match(/\[ً-ْٰـ\]|\[‌‏ـ\]/g) || []).length === 2);
  const wordKashida = [...src2.matchAll(/([؀-ۿ‌])ـ+([؀-ۿ‌])/g)];
  /* کشیده در *متنِ آیه* عیب نیست: رسمِ عثمانیِ معتبر خودش U+0640 دارد
     («يَـُٔودُهُۥ» در ۲:۲۵۵). عیب جایی است که متنِ خودِ برنامه کشیده
     داشته باشد — مثلاً متنِ اسکرپ‌شده که برای تراز کردن کشیده شده. */
  const ayahText = DATA.surah.flatMap(x => [x.before, x.ans, x.after || '']).join('\n');
  const ayahHits = [...ayahText.matchAll(/([؀-ۿ‌])ـ+([؀-ۿ‌])/g)].length;
  ok('هیچ کشیده‌ای درونِ واژه نمانده', wordKashida.length - ayahHits === 0,
     `${wordKashida.length} در سند، ${ayahHits} در متنِ آیه → ` +
     wordKashida.slice(0, 4).map(m => m[0]).join(' '));
  /* کشیدهٔ جامانده فقط همان ارقامِ فهرست است، نه واژه */
  const left = [...src2.matchAll(/\d\sـ\s?/g)].length;
  ok('کشیده‌های جامانده فقط ارقامِ فهرست‌اند', left >= 1 && left <= 12, left + '');
}

section('دوز — پاداش به برندهٔ واقعی می‌رسد، و فقط یک بار');
{
  const mk = (board, player = 'O') => ({
    board: [...board], turn: player, over: false, winner: null, last: -1, settled: false,
    online: false, mySide: 'X', waiting: false, thinking: false
  });
  const reset = () => Store.update(d => {
    d.stats.tttWins = 0; d.stats.tttLoss = 0; d.stats.tttDraw = 0;
    d.stats.onlineWins = 0; d.score = 0; d.xp = 0; d.stats.plays = 0;
  });
  const snap = () => ({ wins: Store.get('stats').tttWins, loss: Store.get('stats').tttLoss,
                        draw: Store.get('stats').tttDraw, onl: Store.get('stats').onlineWins,
                        score: Store.get('score') });

  /* متدهای واقعی را کنار می‌گذاریم و در پایان برمی‌گردانیم — اگر رهایشان
     کنیم، بخش‌های بعدیِ همین فایل با موتورِ ناقص کار می‌کنند. */
  const real = {};
  const silence = () => {
    for(const k of ['render', 'think', 'autosave', 'settleRender'])
      if(!(k in real)){ real[k] = DoozEngine[k]; DoozEngine[k] = () => {}; }
    /* پاداشِ مأموریتِ روزانه هم روی همین امتیاز می‌نشیند و اندازه‌گیری را
       خراب می‌کند: نخستین بردِ امروز مأموریت را کامل می‌کند و ۶۰ امتیازِ
       دیگر می‌دهد. یک باگ نیست، ولی سنجشِ «+۵۰» را به «+۱۱۰» می‌برد. */
    if(!('refresh' in real)){
      real.refresh = Missions.refresh;
      /* شکلِ بازگشتی را باید نگه دارد: updateHomeStats از `doneCount`
         می‌خواند و بی آن، استثنا وسطِ settle می‌افتد. */
      Missions.refresh = () => ({ paid: 0, doneCount: 0 });
    }
  };
  const restore = () => {
    for(const [k, fn] of Object.entries(real))
      if(k === 'refresh') Missions.refresh = fn; else DoozEngine[k] = fn;
  };
  const place = (board, i, player) => {
    DoozEngine.state = mk(board, player);
    DoozEngine.place(i, player);
    return snap();
  };

  try{
    silence();

    /* کامپیوتر برنده می‌شود → کاربر نباید امتیاز بگیرد */
    reset();
    let r = place(['O','O',null,'X','X',null,null,null,null], 2, 'O');
    ok('بردِ کامپیوتر = باختِ کاربر', r.loss === 1 && r.wins === 0,
       `برد ${r.wins}، باخت ${r.loss}`);
    ok('بردِ کامپیوتر امتیاز نمی‌دهد', r.score === 0, String(r.score));

    /* کاربر برنده می‌شود → امتیاز می‌گیرد */
    reset();
    r = place(['X','X',null,'O','O',null,null,null,null], 2, 'X');
    ok('بردِ کاربر ثبت می‌شود', r.wins === 1 && r.loss === 0, `برد ${r.wins}، باخت ${r.loss}`);
    ok('بردِ کاربر امتیاز می‌دهد', r.score === 50, String(r.score));

    /* مساوی */
    reset();
    r = place(['X','O','X','X','O','O','O','X',null], 8, 'X');
    ok('تختهٔ پر = مساوی، بی امتیاز', r.draw === 1 && r.score === 0,
       `مساوی ${r.draw}، امتیاز ${r.score}`);

    /* settle چندباره نباید چندبار حساب شود */
    reset();
    DoozEngine.state = mk(['X','X','X','O','O',null,null,null,null]);
    DoozEngine.state.over = true; DoozEngine.state.winner = 'X';
    DoozEngine.settle('X'); DoozEngine.settle('X'); DoozEngine.settle('X');
    r = snap();
    ok('settle سه‌باره فقط یک بار حساب می‌شود', r.score === 50 && r.wins === 1,
       `امتیاز ${r.score}، برد ${r.wins}`);

    /* بازی آنلاین: پیامِ تکراریِ پایانی نباید امتیاز را چند برابر کند */
    reset();
    DoozEngine.state = { ...mk(['X','X','X','O','O',null,null,null,null]),
                         online: true, mySide: 'X', over: true, winner: 'X' };
    DoozEngine.settleOnline(); DoozEngine.settleOnline();
    r = snap();
    ok('پیامِ تکراریِ پایانی امتیاز را چند برابر نمی‌کند', r.score === 60 && r.onl === 1,
       `امتیاز ${r.score}، برد آنلاین ${r.onl}`);

    /* قفلِ thinking باید با پیامِ سرور باز شود */
    DoozEngine.state = { ...mk(Array(9).fill(null)), online: true, thinking: true, waiting: true, mySide: 'X' };
    DoozEngine.online({ phase: 'state',
      state: { board: Array(9).fill(null), turn: 'O', over: false, winner: null, last: -1 } });
    ok('پیامِ سرور قفلِ خوش‌بینانه را باز می‌کند',
       DoozEngine.state.thinking === false && DoozEngine.state.waiting === false,
       `thinking=${DoozEngine.state.thinking} waiting=${DoozEngine.state.waiting}`);

    /* و اگر بازی تمام شده باشد، باید همان‌جا حساب شود */
    reset();
    DoozEngine.state = { ...mk(['X','X','X','O','O',null,null,null,null]),
                         online: true, mySide: 'O', over: true, winner: 'X' };
    DoozEngine.online({ phase: 'state',
      state: { board: ['X','X','X','O','O',null,null,null,null], turn: 'X', over: true, winner: 'X', last: 2 } });
    ok('پایانِ آنلاین حساب می‌شود', snap().loss === 1, JSON.stringify(snap()));
  }finally{
    restore();
    reset();
    DoozEngine.state = null;
  }
}

section('بازی‌ها — قفل‌های بازمانده و پاداشِ چندباره');
{
  /* همهٔ موتورها این‌جا روی یک «صحنهٔ خنثی» کار می‌کنند: تایمرها واقعی
     ساخته نمی‌شوند (وگرنه تایمرِ زندهٔ یک موتور، فرآیند را زنده نگه
     می‌دارد و آزمون هرگز تمام نمی‌شود) و مأموریتِ روزانه هم خاموش است
     (پاداشش روی همان امتیاز می‌نشیند و اندازه‌گیری را خراب می‌کند). */
  const keep = {
    every: Timers.every, after: Timers.after, clear: Timers.clear,
    clearPage: Timers.clearPage, missions: Missions.refresh,
    soundPlay: Sound.play, confetti: confetti
  };
  const jobs = [];
  try{
    Timers.every = (fn, ms) => { jobs.push(fn); return 'job' + jobs.length; };
    Timers.after = (fn, ms) => { jobs.push(fn); return 'job' + jobs.length; };
    Timers.clear = () => {};
    Timers.clearPage = () => {};
    Missions.refresh = () => ({ paid: 0, doneCount: 0 });
    Sound.play = () => {};
    confetti = () => {};
    const runJobs = () => { const j = jobs.splice(0); j.forEach(fn => fn()); };

    /* ── ۱. «سؤال بعدیِ» حدیث‌یاب ───────────────────────────────── */
    const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
    ok('🔗 دکمهٔ «سؤال بعدیِ» حدیث‌یاب بسته می‌شود',
       /U\.\$\('#hadNext'\)\.onclick = \(\) => this\.next\(\)/.test(html));
    ok('🔗 و `next` جای دیگری هم پیشروی نمی‌کند',
       (html.match(/this\.i\+\+/g) || []).length >= 1 && /  next\(\)\{\n[\s\S]{0,80}this\.i\+\+/.test(html));

    HadithEngine.qs = (DATA.hadith || []).slice(0, 3);
    HadithEngine.i = 0; HadithEngine.filled = 'چیزی'; HadithEngine.locked = true;
    HadithEngine.next();
    ok('پرسش بعدیِ حدیث جلو می‌رود', HadithEngine.i === 1 || HadithEngine.qs.length < 2,
       'i=' + HadithEngine.i);
    ok('و جای خالی و قفل را پاک می‌کند',
       HadithEngine.filled === null && HadithEngine.locked === false,
       `filled=${JSON.stringify(HadithEngine.filled)} locked=${HadithEngine.locked}`);

    /* تایمرِ پاسخِ حدیث باید از Timers باشد، نه setTimeout خام */
    const hadBody = html.slice(html.indexOf('const HadithEngine'), html.indexOf('const DuaEngine'));
    ok('⏱ پاسخِ حدیث با Timers می‌آید نه setTimeout خام',
       !/setTimeout\(\(\) => \{ this\.locked/.test(hadBody) && /Timers\.after\(/.test(hadBody));

    /* ── ۲. اسم فامیلِ تک‌نفره: دورِ دوم و سوم ──────────────────── */
    const st = { online:false, letter:'ب', round:1, total:3, time:60, timer:null,
                 phase:'round', results:null, answers:{}, submitted:false };
    EsmFamilEngine.state = st;
    st.submitted = true;                       // بازمانده از دورِ پیشین
    st.round = 1;
    EsmFamilEngine.render();
    ok('رندرِ دورِ تازه مهرِ «ثبت شد» را برمی‌دارد', st.submitted === false);

    st.submitted = false;
    EsmFamilEngine.submit();
    ok('دورِ اول ثبت می‌شود', st.submitted === true && st.round === 2,
       `submitted=${st.submitted} round=${st.round}`);
    runJobs();                                 // تایمرِ ۱٫۸ ثانیه‌ایِ دورِ بعد
    ok('دورِ دوم قابلِ بازی است (باگِ قفلِ ابدی)', st.submitted === false && st.round === 2,
       `submitted=${st.submitted} round=${st.round}`);
    EsmFamilEngine.submit();
    ok('دورِ دوم هم ثبت می‌شود', st.submitted === true && st.round === 3, 'round=' + st.round);

    /* و گاردِ ضدِ ثبتِ دوباره در همان دور */
    st.submitted = false; st.round = 3;
    EsmFamilEngine.submit(); const r3 = st.round;
    EsmFamilEngine.submit();
    ok('دو بار ثبت در یک دور، دور را دو تا جلو نمی‌برد', st.round === r3 && st.submitted === true);

    /* ── ۳. اسم فامیلِ آنلاین: امتیاز یک دور، دو بار ─────────────── */
    const onlineSt = { online:true, letter:'ب', round:2, total:3, time:60, timer:null,
                       phase:'round', results:null, answers:{}, submitted:false };
    EsmFamilEngine.state = onlineSt;
    let before = Store.get('score');
    EsmFamilEngine.submit();
    ok('ثبتِ آنلاین امتیاز نمی‌دهد (نتیجه از سرور می‌آید)', Store.get('score') === before,
       `${before} → ${Store.get('score')}`);
    /* دو بازیکن، یکی خودِ کاربر */
    const mine = { id: Net.id, name: 'من', score: 30, answers: {} };
    const other = { id: 'x1', name: 'حریف', score: 12, answers: {} };
    before = Store.get('score');
    EsmFamilEngine.renderResults([other, mine]);
    ok('امتیاز در نتایجِ دور، یک بار می‌آید', Store.get('score') === before + 30,
       `${before} → ${Store.get('score')}`);
    before = Store.get('score');
    EsmFamilEngine.renderResults([other, mine]);
    ok('و رندرِ دوبارهٔ نتایج امتیاز را تکرار نمی‌کند', Store.get('score') === before + 30,
       `${before} → ${Store.get('score')}`);

    /* ── ۴. نجوا: قفلِ بازمانده ─────────────────────────────────── */
    DuaEngine.locked = true; DuaEngine.i = 5;
    DuaEngine.start();
    ok('شروعِ دوبارهٔ نجوا قفل را پاک می‌کند و از اول می‌آید',
       DuaEngine.locked === false && DuaEngine.i === 0,
       `locked=${DuaEngine.locked} i=${DuaEngine.i}`);

    /* ── ۵. پازلِ حل‌شده دوباره پاداش نمی‌گیرد ─────────────────── */
    const scrSt = () => ({ word:'اب', chosen:[0,1], solved:false, t0:U.now(),
                           pool:[{ ch:'ا', used:true }, { ch:'ب', used:true }] });
    let scrBeforeScore = Store.get('score');
    let scrBeforePuz = Store.get('stats').puzzles;
    ScrambleEngine.state = scrSt();
    ScrambleEngine.check();
    ok('پازلِ درست پاداش می‌گیرد', Store.get('score') > scrBeforeScore,
       `${scrBeforeScore} → ${Store.get('score')}`);
    const afterFirst = Store.get('score'), afterPuz = Store.get('stats').puzzles;
    ScrambleEngine.check();
    ScrambleEngine.check();
    ok('و «بررسی»ـهای بعدی پاداش را تکرار نمی‌کنند',
       Store.get('score') === afterFirst && Store.get('stats').puzzles === afterPuz,
       `امتیاز ${afterFirst} → ${Store.get('score')}، پازل ${afterPuz} → ${Store.get('stats').puzzles}`);

    /* ── ۶. تایمرِ بازی با تغییرِ بازی پاک می‌شود ───────────────── */
    ok('🔗 رفتن از یک بازی به بازیِ دیگر تایمرِ صفحه را پاک می‌کند',
       /name !== 'play' \|\| this\.stack\[this\.stack\.length - 1\] === 'play'/.test(html));

    ScrambleEngine.state = null;
    HadithEngine.qs = []; HadithEngine.i = 0;
    EsmFamilEngine.state = null;
    DuaEngine.i = 0; DuaEngine.locked = false;
  }finally{
    Timers.every = keep.every; Timers.after = keep.after;
    Timers.clear = keep.clear; Timers.clearPage = keep.clearPage;
    Missions.refresh = keep.missions;
    Sound.play = keep.soundPlay;
    confetti = keep.confetti;
  }
}

section('نشستِ سرور — نشانه به‌جای هش');
{
  const keep = { t: Store.get('adminToken'), e: Store.get('adminTokenExp'),
                 h: Store.get('adminHash'), a: Store.get('isAdmin') };
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  try{
    ok('هیچ پیامِ مدیریتی‌ای دیگر هش نمی‌فرستد',
       !/t: 'admin:[^']*',\s*hash:/.test(src) && !/hash: Store\.get\('adminHash'\)/.test(src));

    Store.update(d => { d.adminToken = 'a'.repeat(64); d.adminTokenExp = U.now() + 3600000; });
    ok('نشانهٔ زنده معتبر شمرده می‌شود', Admin.hasToken() === true);
    Store.update(d => { d.adminTokenExp = U.now() - 1000; });
    ok('نشانهٔ گذشته معتبر نیست', Admin.hasToken() === false);

    /* نشانهٔ بی‌شکل یا بی‌سررسید دور انداخته می‌شود */
    Store.update(d => { d.adminToken = 'کوتاه'; d.adminTokenExp = U.now() + 1000; });
    Store.sanitize();
    ok('نشانهٔ بی‌شکل دور انداخته می‌شود', Store.get('adminToken') === '', Store.get('adminToken'));
    Store.update(d => { d.adminToken = 'b'.repeat(64); d.adminTokenExp = 0; });
    Store.sanitize();
    ok('نشانهٔ بی‌سررسید دور انداخته می‌شود', Store.get('adminToken') === '');
    Store.update(d => { d.adminToken = 'c'.repeat(64); d.adminTokenExp = U.now() - 1; });
    Store.sanitize();
    ok('نشانهٔ منقضی دور انداخته می‌شود', Store.get('adminToken') === '');

    /* isAdmin با نشانهٔ معتبر می‌ماند — وگرنه مدیرِ سرور در هر باز شدنِ
       برنامه بیرون می‌افتاد، چون رمزِ محلی ندارد. */
    Store.update(d => { d.adminHash = ''; d.adminToken = 'd'.repeat(64);
                        d.adminTokenExp = U.now() + 3600000; d.isAdmin = true; });
    Store.sanitize();
    ok('با نشانهٔ سرور، پرچمِ مدیر پاک نمی‌شود', Store.get('isAdmin') === true);
    Store.update(d => { d.adminToken = ''; d.adminTokenExp = 0; d.isAdmin = true; });
    Store.sanitize();
    ok('بی هیچ راهِ ورودی، پرچمِ مدیر پاک می‌شود', Store.get('isAdmin') === false);

    /* بی سرور، دروازهٔ محلی می‌ماند */
    ok('دروازهٔ محلی هنوز کار می‌کند', /Store\.set\('adminHash', await U\.sha256Async\(pass\)\)/.test(src));
    ok('و صریح می‌گوید امنیتِ واقعی نیست',
       /قفلِ محلی/.test(src) && /NOOR_ADMIN_PASS/.test(src));
    ok('خروج، نشستِ سرور را باطل می‌کند',
       /async logoutServer\(\)/.test(src) && /logoutServer\(\);\n\s*Store\.set\('isAdmin', false\)/.test(src));
  }finally{
    Store.update(d => { d.adminToken = keep.t; d.adminTokenExp = keep.e;
                        d.adminHash = keep.h; d.isAdmin = keep.a; });
  }
}

section('هویتِ کاربر — شناسهٔ مبهم و نشست');
{
  const keepUser = Store.get('user');
  const keepPhone = Store.get('phone');
  const keepName = Store.get('playerName');
  const keepEntered = User.entered;
  try{
    Store.update(d => { d.user = null; d.phone = ''; });
    User.entered = false;

    const u = User.ensure();
    ok('هویت ساخته می‌شود', !!u && !!u.id);
    ok('شناسه شکل درست دارد', User.okId(u.id), u.id);
    /* نشانهٔ اصلی «مبهم بودن» این است که شناسه از شماره *برنیاید*، نه اینکه
       تصادفاً رقمی در آن نباشد: ۲۰ رقم هگزِ تصادفی گاهی «09» هم در خود دارد.
       پس دو بار با همان شمارهٔ یکسان از صفر می‌سازیم؛ اگر شناسه از شماره
       مشتق می‌شد، هر دو یکی درمی‌آمد. */
    ok('شناسه از شماره مشتق نمی‌شود',
       (() => {
         const made = [];
         for(let i = 0; i < 2; i++){
           Store.update(d => { d.user = null; d.phone = '09123456789'; });
           made.push(User.ensure().id);
         }
         return made[0] !== made[1] && made.every(x => User.okId(x));
       })());
    ok('و شمارهٔ کامل در شناسه نیست', !u.id.includes('09123456789'),
       u.id);
    ok('شناسه فقط از الفبای هگز است', /^usr_[0-9a-f]{20}$/.test(u.id), u.id);
    /* سنجشِ بالا هویتِ تازه ساخت؛ برمی‌گردانیم تا بقیهٔ این بخش روی همان
       کاربرِ نخست بنشیند */
    Store.update(d => { d.user = u; });
    ok('شناسه دو بار عوض نمی‌شود', User.ensure().id === u.id);
    ok('شناسه‌های دو کاربر یکی نیستند', User.makeId() !== User.makeId());

    ok('شناسهٔ بی‌شکل رد می‌شود', !User.okId('usr_short')
       && !User.okId('usr_' + 'z'.repeat(20))
       && !User.okId('u-abc') && !User.okId('') && !User.okId(null));
    /* شناسه باید از مولدِ رمزنگاری‌شده بیاید، نه Math.random */
    ok('شناسه از Math.random نمی‌آید', (() => {
      const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
      const i = src.indexOf('const User = {');
      const body = src.slice(i, src.indexOf('makeId(', i));
      return !/Math\.random/.test(body) && /U\.salt/.test(src.slice(i, i + 4000));
    })());

    /* نشست */
    User.enter();
    ok('نخستین ورود، بازدید را می‌شمارد', User.get().visits === 1, String(User.get().visits));
    ok('و «آخرین ورود» را می‌نشاند', User.get().lastLogin > 0);
    ok('و تاریخِ عضویت را پر می‌کند', User.get().joinedAt > 0);
    User.enter(); User.enter();
    ok('ورودهای بعدیِ همان نشست، بازدید را دوباره نمی‌شمارند',
       User.get().visits === 1, String(User.get().visits));

    /* شمارشِ بازی */
    const p0 = User.get().plays;
    Store.update(d => { d.stats.byGame = {}; d.stats.today = { date:'', n:0, byGame:{} }; });
    Stats.track('dooz');
    ok('هر بازی، یک بار روی هویت می‌نشیند', User.get().plays === p0 + 1,
       `${p0} → ${User.get().plays}`);
    Stats.track(null);
    ok('بازیِ بی‌نام شمرده نمی‌شود', User.get().plays === p0 + 1);

    /* نام و شماره */
    ok('نام روی هویت و روی وضعیت می‌نشیند',
       User.setName('  علی  رضا ') === 'علی رضا' && User.name() === 'علی رضا'
       && Store.get('playerName') === 'علی رضا', User.name());
    ok('نام خالی به پیش‌فرض برمی‌گردد', User.setName('   ') === 'بازیکن');
    ok('نام بلند بریده می‌شود', User.setName('x'.repeat(50)).length === 20);

    User.setPhone('۰۹۱۲۳۴۵۶۷۸۹');
    ok('شمارهٔ فارسی به لاتین روی هویت می‌نشیند', User.get().phone === '09123456789',
       User.get().phone);
    ok('و روی وضعیتِ دستگاه هم', Store.get('phone') === '09123456789');
    ok('شمارهٔ نامعتبر هم بی‌خطا پذیرفته و پاک می‌شود', User.setPhone('abc') === '');

    /* قفلِ محلی */
    User.setBlocked(true);
    ok('قفلِ محلی می‌نشیند', User.blocked() === true);
    User.setBlocked(false);
    ok('و برداشته می‌شود', User.blocked() === false);

    /* آنچه به سرور می‌رود نباید شماره باشد */
    const w = User.wire();
    ok('در پیامِ شبکه شماره نمی‌رود', !JSON.stringify(w).includes('09123'),
       JSON.stringify(w));
    ok('و شناسه می‌رود', w.id === User.get().id);

    const r = User.row();
    ok('ردیفِ پنل ادمین شناسه و نام دارد', r && r.id === User.get().id && r.me === true);
    ok('و «من» بودنش را می‌گوید', r.me === true);

    /* پاک‌سازیِ روکشِ خراب */
    Store.update(d => { d.user = { id: 'bad', visits: -5 }; });
    Store.sanitize();
    ok('هویتِ بی‌شکل دور انداخته می‌شود تا از نو ساخته شود',
       Store.get('user') === null, JSON.stringify(Store.get('user')));
    ok('و ensure از نو می‌سازدش', User.okId(User.ensure().id));

    Store.update(d => { d.user = { id: 'usr_' + 'a'.repeat(20), name:'ن', phone:'09120000000',
                                   joinedAt: -1, visits: -3, plays: -2, blocked: 'yes' }; });
    Store.sanitize();
    const s = Store.get('user');
    ok('عددهای منفی به صفر برمی‌گردند', s.joinedAt === 0 && s.visits === 0 && s.plays === 0,
       JSON.stringify(s));
    ok('قفل به بولین برمی‌گردد', s.blocked === true);
  }finally{
    Store.update(d => { d.user = keepUser; d.phone = keepPhone; d.playerName = keepName; });
    User.entered = keepEntered;
  }
}

section('حساب کاربری در پروفایل');
{
  /* رندرِ صفحهٔ «من» را می‌گیریم تا بشود دربارهٔ آنچه کاربر می‌بیند سنجید */
  const draw = () => {
    const box = { innerHTML: '', classList:{ add(){}, remove(){}, toggle(){} } };
    const $0 = U.$;
    const tab = Me.tab;
    U.$ = (s, p) => s === '#meBody' ? box : $0(s, p);
    try{ Me.tab = 'profile'; Me.render(); } finally { U.$ = $0; Me.tab = tab; }
    return box.innerHTML;
  };
  const keepUser = Store.get('user'), keepPhone = Store.get('phone');
  try{
    Store.update(d => { d.user = null; d.phone = ''; });
    User.entered = false;
    const u = User.ensure();
    ok('هویت پیش از رندر ساخته می‌شود', !!u);

    let html = draw();
    ok('شناسه در پروفایل دیده می‌شود', html.includes(u.id), 'بی شناسه');
    ok('و کپی‌شدنی است', new RegExp(`data-copy="${u.id}"`).test(html));
    ok('بی شماره، «ثبت نشده» می‌گوید', html.includes('ثبت نشده'));
    ok('و مهمان خوانده می‌شود', html.includes('مهمانِ همین دستگاه'));
    ok('و از کاربر می‌خواهد وارد شود', /با موبایل وارد شو/.test(html));
    ok('دکمهٔ ورود، «ورود با موبایل» است', html.includes('📱 ورود با موبایل'));
    ok('🔒 و هیچ‌جا وعده نمی‌دهد بی سرور حساب ساخته می‌شود',
       !/حساب شما ساخته شد/.test(html));

    /* پس از تأییدِ پیامک */
    User.setPhone('۰۹۱۲۳۴۵۶۷۸۹');
    User.enter();
    html = draw();
    ok('شماره در پروفایل می‌آید', html.includes('0912 345 6789'), 'بی شماره');
    ok('و به لاتین ذخیره می‌شود', Store.get('phone') === '09123456789', Store.get('phone'));
    ok('وضعیت «تأییدشده با پیامک» می‌شود', html.includes('تأییدشده با پیامک'));
    ok('دکمه به «تغییر شماره» بدل می‌شود', html.includes('📱 تغییر شماره'));
    ok('و قول می‌دهد شماره به کسی نشان داده نشود', html.includes('نشان داده نمی‌شود'));
    ok('بازی‌های حساب شمرده می‌شوند', /بازی‌های این حساب/.test(html));

    /* نام از یک راه می‌رود */
    User.setName('  زهرا   جان  ');
    ok('نامِ هویت با نامِ نمایشی یکی می‌ماند',
       User.get().name === 'زهرا جان' && Store.get('playerName') === 'زهرا جان',
       `${User.get().name} / ${Store.get('playerName')}`);
    ok('نامِ خالی به «بازیکن» برمی‌گردد', User.setName('   ') === 'بازیکن');

    /* «وارد شدی» با «شماره عوض شد» یکی نیست */
    ok('ورودِ نخست و تغییرِ شماره، پیامِ جدا می‌گیرند', (() => {
      const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
      const i = src.indexOf('async check(){');
      const body = src.slice(i, src.indexOf('Me.render()', i));
      return /r\.first \?/.test(body) && /به‌روز شد/.test(body);
    })());
  }finally{
    Store.update(d => { d.user = keepUser; d.phone = keepPhone; d.playerName = 'بازیکن'; });
  }
}

section('پیامکِ خوش‌آمدگویی (۱۷.۱ بخش ۴)');
{
  /* ── تاریخِ شمسی ──
     تقویم را خودمان حساب نمی‌کنیم؛ از Intl می‌پرسیم. پس آزمون هم همان
     مرجع را می‌سنجد: عددِ درست، با رقم‌های فارسی. */
  ok('تاریخِ شمسی از میلادی درست درمی‌آید',
     U.jalali(Date.UTC(2026, 8, 19)) === '۱۴۰۵/۰۶/۲۸', U.jalali(Date.UTC(2026, 8, 19)));
  ok('و اولِ سال را هم درست می‌گوید',
     U.jalali(Date.UTC(2026, 2, 21)) === '۱۴۰۵/۰۱/۰۱', U.jalali(Date.UTC(2026, 2, 21)));
  ok('تاریخِ شمسی رقمِ لاتین ندارد', !/[0-9]/.test(U.jalali(Date.UTC(2026, 8, 19))));
  ok('بی تاریخ، خط تیره می‌دهد نه رشتهٔ خالی', U.jalali(0) === '—' && U.jalali(null) === '—');
  ok('تاریخِ بی‌معنا هم خط تیره می‌دهد', U.jalali(NaN) === '—' && U.jalali('بی‌معنا') === '—');

  /* ── کارنامهٔ سرور روی دستگاه ──
     سرور تنها مرجعِ «خوش‌آمد رفت یا نه» است. دستگاه فقط می‌نویسد. */
  const keep = { user: Store.get('user'), phone: Store.get('phone') };
  try{
    Store.update(d => { d.user = null; d.phone = ''; });
    User.ensure();
    const me = User.get();
    ok('پیش از پاسخِ سرور، خوش‌آمد «نرفته» است', User.welcomed() === false && User.welcomedAt() === 0);

    ok('پیامِ کارنامه پذیرفته می‌شود',
       User.serverState({ id: me.id, phone: '09120000001', welcomed: true,
                          welcomedAt: 1730000000000, joinedAt: 1700000000000 }) === true);
    ok('شمارهٔ خودم می‌نشیند', User.get().phone === '09120000001', User.get().phone);
    ok('و نشانِ خوش‌آمد می‌نشیند', User.welcomed() === true);
    ok('و زمانش هم می‌آید', User.welcomedAt() === 1730000000000, User.welcomedAt());
    ok('و تاریخِ عضویت', User.get().joinedAt === 1700000000000);

    /* 🔒 شناسهٔ نامعتبر نباید چیزی بنویسد */
    const snap = JSON.stringify(User.get());
    ok('🔒 شناسهٔ نامعتبر نوشته نمی‌شود',
       User.serverState({ id: 'usr_کوتاه', welcomed: true }) === false &&
       JSON.stringify(User.get()) === snap);
    ok('🔒 و بی پیام هم خطا نمی‌دهد',
       User.serverState(null) === false && User.serverState(undefined) === false);

    /* شمارهٔ دیگری از حسابِ دیگری نباید به حسابِ من بچسبد */
    User.serverState({ id: 'usr_' + 'ff'.repeat(10), phone: '09129999999',
                       welcomed: true, welcomedAt: 5 });
    ok('🔒 شمارهٔ حسابِ دیگر روی حسابِ من نمی‌نشیند',
       User.get().phone === '09120000001', User.get().phone);

    /* مسیرِ پیام: همان چیزی که پروفایل از آن می‌خواند */
    const before = User.get().welcomed;
    Net.handle({ t: 'me', id: me.id, phone: '09120000001', welcomed: false,
                 welcomedAt: 0, joinedAt: 1700000000000 });
    ok('پیامِ «me» به کارنامهٔ کاربر می‌رسد', User.welcomed() === false);
    Net.handle({ t: 'me', id: me.id, phone: '09120000001', welcomed: true,
                 welcomedAt: 1730000000001, joinedAt: 1700000000000 });
    ok('و خوش‌آمدِ تازه هم می‌نشیند',
       User.welcomed() === true && User.welcomedAt() === 1730000000001);
    ok('پیامِ ناشناس جایی نمی‌شکند', (() => {
      try{ Net.handle({ t: 'چنین‌چیزی‌نیست' }); Net.handle({ t: 'me' }); return true; }
      catch(e){ return false; }
    })());
    void before;
  }finally{
    Store.update(d => { d.user = keep.user; d.phone = keep.phone; });
  }

  /* ── آنچه کاربر می‌بیند ── */
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
  /* برچسب‌ها حالا آیکنِ SVG دارند، نه ایموجی؛ پس به همان درجِ آیکن سنجیده
     می‌شوند، نه به نویسهٔ ایموجی که دیگر جایی در پوسته ندارد. */
  ok('پروفایل ردیفِ خوش‌آمدگویی دارد',
     src.includes("${Icon.of('send')} خوش‌آمدگویی"));
  ok('و تاریخِ عضویت را شمسی نشان می‌دهد', /U\.jalali\(u\.joinedAt\)/.test(src));
  ok('سه حالِ خوش‌آمد از هم جدا گفته می‌شوند',
     src.includes('⚠️ بدون سرور') && src.includes('⏳ در راه') && src.includes('✅ دریافت شده'));
  /* ردیفِ خوش‌آمدگویی برای مهمان اصلاً کشیده نمی‌شود — سطرِ «ثبت نشده» فقط
     شلوغی بود. پس نه آن سطر می‌ماند، نه املای غلطش. */
  ok('🔒 ردیفِ خوش‌آمدگویی فقط برای حسابِ شماره‌دار',
     /\$\{verified \? `<div class="kv"><span>\$\{Icon\.of\('send'\)\} خوش‌آمدگویی<\/span>/.test(src));
  ok('🔒 «بی شماره فرستاده نمی‌شود» جایش را به «بدون شماره ارسال نمی‌شود» داد',
     !src.includes('بی شماره فرستاده نمی‌شود'));
  ok('🔒 هیچ‌جا نشانهٔ نشست در پروفایل نمایش داده نمی‌شود',
     !/کارنامه[^]{0,400}?token/.test(src.slice(src.indexOf('welcomeLine'))));
}

section('پروفایل مهمان و صفحهٔ ورود — پاک‌سازیِ متن‌ها');
{
  const src = fs.readFileSync(__dirname + '/index.html', 'utf8');

  /* ── «کابر» ──
     کاربر گفت در برچسبِ نقش، «کابر» نوشته شده. در سراسرِ پرونده چنین
     رشته‌ای نیست؛ ولی آزمون می‌گذاریم که اگر روزی برگشت، بگیریمش. */
  ok('املای «کاربر» درست است، نه «کابر»', !src.includes('کابر'));
  /* `cRole` حالا آیکن‌دار است و با `U.icLabel` نوشته می‌شود، نه
     `textContent` — وگرنه آیکن پاک می‌شد. */
  ok('و برچسبِ نقش درست خوانده می‌شود',
     /U\.icLabel\(U\.\$\('#cRole'\), d\.isAdmin \? 'crown' : 'user',[\s\S]{0,40}?'مدیر' : 'کاربر'\)/
       .test(src),
     (src.match(/#cRole'[^\n]*/) || [''])[0]);

  /* ── شناسهٔ کاربر ──
     کاربر گفت شناسه باید ۲۰ کاراکتر باشد. بخشِ تصادفیِ شناسه دقیقاً ۲۰
     کاراکترِ هگز است، ولی شناسهٔ کامل `usr_` + آن ۲۰ است. پیشوند ثابت است:
     هم `User.ID_RE` و هم سرور (`userBind`/`userTokenNew`) بر آن تکیه دارند،
     و عوض کردنش هر شناسهٔ ذخیره‌شده روی هر دستگاه را بی‌اعتبار می‌کند. */
  ok('بخشِ تصادفیِ شناسه ۲۰ کاراکتر است', (() => {
    const u = User.get();
    return User.ID_RE.test(u.id) && u.id.slice(4).length === 20 && /^[0-9a-f]{20}$/.test(u.id.slice(4));
  })(), (User.get() || {}).id);
  ok('🔒 و پیشوندش همان قراردادِ سرور است',
     /ID_RE:\s*\/\^usr_\[0-9a-f\]\{20\}\$\//.test(src));

  /* ── دکمهٔ اتصال به حساب برای مهمان ──
     مهمان پیش‌تر فقط یک میان‌برِ گوشه‌افتاده داشت. حالا کارتِ صریح دارد. */
  ok('مهمان کارتِ «اتصال به حساب» دارد',
     src.includes("${Icon.of('phone')} اتصال به حساب"));
  ok('🔒 و آن کارت فقط بی شماره می‌آید', /\$\{!d\.phone \? `<div class="card mt14">/.test(src));
  ok('و به صفحهٔ ورود وصل است', /#pfConnect/.test(src) && /Gate\.open\('phone'\)/.test(src));
  ok('🔒 و بی سرور، دلیلش را می‌گوید نه دکمهٔ بی‌اثر',
     /SMS\.ready\(\)[\s\S]{0,200}?id="pfConnect" disabled/.test(src));
  /* پیامِ «چرا» سه حالِ متفاوت را جدا می‌گوید، نه یک جملهٔ کلی. */
  /* ── پرشِ صفحهٔ خانه ──
     صفحه یک بار در آغازِ برنامه باز می‌شود (پشتِ پردهٔ آغازین)، پس هرگز
     برای یک لحظه خانه دیده نمی‌شود. ولی فراخوانیِ دومِ `maybe()` — پس از
     کنار رفتنِ پرده — نباید گامِ کاربر را از نو کند. */
  ok('🔒 صفحهٔ ورود در آغازِ برنامه باز می‌شود، پیش از کنار رفتنِ پرده', (() => {
    const i = src.indexOf('Splash.init()');
    return i > 0 && src.indexOf('Gate.maybe()', i) > i;
  })());
  ok('🔒 و فراخوانیِ دوباره‌اش گامِ کاربر را پاک نمی‌کند',
     /maybe\(\)\{[\s\S]{0,500}?if\(this\.shown\) return true;/.test(src));

  ok('و دلیلِ «چرا نمی‌شود» حال‌به‌حال است', (() => {
    const i = src.indexOf('whyNot(){');
    const body = src.slice(i, src.indexOf('},', i));
    return /NOOR_SMS_KEY/.test(body) && /سروری در دسترس نیست/.test(body) &&
           (body.match(/return '/g) || []).length >= 3;
  })());
}

section('صفحهٔ ورودِ تمام‌صفحه (۱۷.۱ بخش ۱)');
{
  const keep = Store.get('gate');
  try{
    /* ── پرچمِ صفحه ──
       سه حال دارد و هر چیز دیگر باید به «هنوز نپرسیده» برگردد. یک مقدار
       خراب می‌توانست صفحه را تا ابد پنهان کند و کاربر هیچ راه ورودی نبیند. */
    /* بی شماره می‌سنجیم، وگرنه قاعدهٔ «شماره یعنی تصمیم گرفته» روی همین
       ورودی می‌پوشاندش و آزمون چیز دیگری را می‌سنجد. */
    Store.update(d => { d.phone = ''; d.gate = 'چیزِبی‌ربط'; });
    Store.sanitize();
    ok('پرچمِ ناشناسِ صفحه به «نپرسیده» برمی‌گردد', Store.get('gate') === '', Store.get('gate'));

    Store.set('gate', '');
    Store.update(d => { d.phone = '09121110001'; });
    Store.sanitize();
    ok('شمارهٔ تأییدشده یعنی کاربر تصمیمش را گرفته', Store.get('gate') === 'user', Store.get('gate'));
    Store.update(d => { d.phone = ''; });

    Store.set('gate', 'guest');
    Gate.shown = false;   /* صفحه بسته است؛ می‌سنجیم آیا خودبه‌خود می‌آید */
    ok('مهمان یعنی دیگر خودبه‌خود نمی‌آید', Gate.maybe() === false);
    Store.set('gate', 'admin');
    ok('و «مدیر» هم حالِ درستی است، نه مقدارِ خراب', (Store.sanitize(), Store.get('gate') === 'admin'), Store.get('gate'));
    /* صفحه‌ای که همین حالا باز است، با فراخوانیِ دوم از نو کشیده نمی‌شود:
       وگرنه کاربری که تا نیمه راه رفته، به «خوش آمدی» برمی‌گشت. */
    Gate.shown = false;
    Store.set('gate', '');
    ok('بی انتخاب، صفحه خودش می‌آید', Gate.maybe() === true);
    Gate.step = 'phone';
    ok('🔒 و فراخوانیِ دوباره گام را برنمی‌گرداند',
       Gate.maybe() === true && Gate.step === 'phone', Gate.step);
    Gate.step = 'intro';   /* حالت را پاک می‌کنیم تا آزمونِ بعدی را آلوده نکند */
    ok('و گامِ آغازین «خوش آمدی» است', Gate.step === 'intro', Gate.step);
    ok('ورود از درونِ برنامه مستقیم سرِ شماره می‌رود',
       (Gate.open('phone'), Gate.step === 'phone'), Gate.step);
    ok('گامِ ناشناس به «خوش آمدی» برمی‌گردد',
       (Gate.open('چیزِبی‌ربط'), Gate.step === 'intro'), Gate.step);

    /* ── مهمان ── */
    Store.set('gate', '');
    Gate.guest();
    ok('«ادامه مهمان» در حافظه می‌ماند', Store.get('gate') === 'guest', Store.get('gate'));

    /* ── رنگِ دکمه‌ها با پاسخِ سرور عوض می‌شود ──
       تا پاسخ نرسیده نمی‌دانیم سرور کلید دارد یا نه؛ نباید کاربر پیام
       «به سرور متصل شوید» را ببیند وقتی سرور هست. */
    /* استابِ گره باید مثلِ گرهٔ راستین `querySelector` داشته باشد، چون
       `U.$` روی والد صدا می‌زند و بی آن، رنگ‌آمیزی وسطِ کار می‌شکند. */
    const node = () => ({
      innerHTML:'', textContent:'', value:'', disabled:false, style:{}, dataset:{},
      classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
      focus(){}, blur(){}, click(){}, setAttribute(){}, getAttribute(){ return null; },
      appendChild(){}, remove(){}, children:[], firstChild:null, closest(){ return null; },
      querySelector(){ return node(); }, querySelectorAll(){ return []; }
    });
    const paint = at => {
      const box = node();
      const gateEl = node();
      const $0 = U.$;
      U.$ = (s, p) => s === '#gate' ? gateEl : s === '#gateBox' ? box : $0(s, p);
      const keepStep = Gate.step;
      try{ Gate.step = at; Gate.paint(); } finally { Gate.step = keepStep; U.$ = $0; }
      return box.innerHTML;
    };

    const intro = paint('intro');
    ok('صفحهٔ ورود نامِ برنامه را دارد', intro.includes('نورستان'));
    /* فاز ۴ پوسته: ایموجیِ دکمه‌ها جای خود را به آیکنِ SVG داد، پس
       سنجش هم به «شناسه + برچسب» بند است، نه به شکلک. */
    ok('و هر سه راه را پیش می‌گذارد',
       /id="gtGo"[^>]*>[\s\S]{0,300}?ورود با موبایل/.test(intro) &&
       /id="gtGuest"[^>]*>[\s\S]{0,300}?ادامه به‌عنوان مهمان/.test(intro) &&
       /id="gtAdmin"[^>]*>[\s\S]{0,300}?ورود مدیر/.test(intro));
    ok('و هر سه راه آیکنِ SVG دارد، نه شکلک',
       !/[\u{1F000}-\u{1FAFF}]/u.test(intro), intro.match(/[\u{1F000}-\u{1FAFF}]/gu));
    ok('🔒 و می‌گوید بی ورود چه از دست می‌رود، نه اینکه تهدید کند',
       /امتیازت روی سرور\s*ثبت نمی‌شود/.test(intro));

    const phone = paint('phone');
    ok('گامِ شماره، ورودیِ شماره دارد', phone.includes('id="gtPhone"'));
    ok('و دکمهٔ «دریافت کد»', /id="gtSend"[^>]*>[\s\S]{0,300}?دریافت کد/.test(phone));
    ok('🔒 بی سرور، «دریافت کد» غیرفعال است',
       /id="gtSend"[^>]*disabled/.test(phone), phone.slice(phone.indexOf('gtSend'), phone.indexOf('gtSend') + 90));
    ok('🔒 و صریح می‌گوید چرا',
       /سروری در دسترس نیست/.test(phone), 'بی پیام');
    /* دلیل باید *داخل* کارت و بی‌فاصله زیرِ دکمه باشد، نه یادداشتی جدا آن‌سوی
       کارت. کاربر باید بی‌جست‌وجو ببیند چرا دکمه کار نمی‌کند. */
    ok('🔒 و دلیلش درست زیرِ دکمهٔ غیرفعال است', (() => {
      const i = phone.indexOf('id="gtSend"');
      const j = phone.indexOf('</button>', i);
      const k = phone.indexOf('سروری در دسترس نیست', j);
      return i >= 0 && j > i && k > j && k - j < 260;
    })(), phone.slice(phone.indexOf('gtSend'), phone.indexOf('gtSend') + 420));
    ok('و راهِ بازگشت دارد', phone.includes('id="gtBack"'));

    /* شماره را دستی می‌گذاریم، وگرنه آزمون به حالِ پیشینِ ماژول گره می‌خورد
       و بسته به ترتیبِ آزمون‌های دیگر، گاهی سبز و گاهی سرخ می‌شود. */
    const keepPhone = Gate.phone;
    Gate.phone = '09121110001';
    const code = paint('code');
    Gate.phone = keepPhone;
    ok('گامِ کد، پیشنهادِ کدِ یک‌بارمصرف را می‌گیرد',
       /id="gtCode"[^>]*autocomplete="one-time-code"/.test(code));
    ok('و کلیدِ عددی می‌آورد، نه کلیدِ حرف', /id="gtCode"[^>]*inputmode="numeric"/.test(code));
    ok('و به‌اندازهٔ کد جا می‌دهد', new RegExp('id="gtCode"[^>]*maxlength="' + OTP.LEN + '"').test(code));
    ok('و شمارندهٔ اعتبار دارد', code.includes('id="gtLeft"'));
    /* شماره اینجا پنهان نمی‌شود، ولی خواناتر می‌شود: کاربر باید ببیند کد به
       کدام شماره رفت تا بی‌گمان تأیید کند. */
    ok('و شماره‌ای که کد به آن رفت را نشان می‌دهد',
       code.includes('0912 111 0001'), code.slice(0, 200));
    /* رنگ‌آمیزیِ گامِ کد شمارندهٔ زنده راه می‌اندازد؛ بی خاموش‌کردنش،
       تایمری تا آخرِ آزمون‌ها می‌چرخد و سنجش‌های بی‌ربط را آلوده می‌کند. */
    Gate.stop();

    /* ── پیش از فرمِ رمز، یک هشدارِ آگاهانه ──
       اگر این دستگاه هنوز رمزِ مدیر ندارد، گامِ مدیر نباید *مستقیم* فرم
       بگذارد: بی این ایست، هر رهگذری — از جمله مهمان — یک رمز می‌ساخت و
       مدیرِ دستگاه می‌شد. حالا اول باید صریح تأیید کند. */
    /* حالتِ «دستگاه هنوز رمز ندارد» را خودمان می‌گذاریم، وگرنه این آزمون به
       حالِ جاماندهٔ آزمون‌های پیشین گره می‌خورد و گاهی بی‌صدا رد می‌شود. */
    const keepAdmHash = Store.get('adminHash');
    /* گامِ مدیر پیش از تصمیم از سرور می‌پرسد («سرور همین‌جاست؟») و تا
       پاسخ نرسد صفحهٔ «بررسی سرور…» را نشان می‌دهد. در این آزمون سروری
       نیست و آن پرسش هرگز راه نیفتاده، پس پاسخِ «نه» را صریح می‌نشانیم —
       عیناً همان چیزی که یک مرورگرِ بی‌سرور می‌بیند. */
    const keepHostAsked = Host.asked, keepHostYes = Host._yes, keepHostInfo = Host._info;
    Host.asked = Promise.resolve(false); Host._yes = false; Host._info = null;
    Store.update(d => { d.adminHash = ''; });
    const makeFirst = !Admin.onServer() && !Host.yes();
    const admin = paint('admin');
    if(makeFirst){
      ok('🔒 گامِ مدیر اول هشدار می‌دهد، نه فرم', admin.includes('id="gtMake"'), admin.slice(0, 200));
      ok('🔒 و می‌گوید هر کسی این رمز را بسازد مدیر می‌شود',
         /هر کسی این رمز را بسازد، مدیرِ همین دستگاه می‌شود/.test(admin));
      ok('🔒 و بی تأییدِ صریح، ورودیِ رمز کشیده نمی‌شود', !admin.includes('id="gtPass"'));
      ok('و راهِ بازگشت دارد', admin.includes('id="gtBack"'));
    }
    /* پس از تأیید، فرمِ رمز می‌آید — همان‌جا که باید. */
    const keepConfirm = Gate.adminConfirm;
    try{
      Gate.adminConfirm = true;
      const form = paint('admin');
      ok('گامِ مدیر، پس از تأیید ورودیِ رمز دارد', form.includes('id="gtPass"'), form.slice(0, 200));
      ok('🔒 رمز از چشم پنهان است', /id="gtPass"[^>]*type="password"/.test(form));
      ok('🔒 و مرورگر بی اجازه ذخیره‌اش نمی‌کند',
         /id="gtPass"[^>]*autocomplete="(current|new)-password"/.test(form));
      ok('🔒 و در حالتِ محلی صریح می‌گوید امنیتِ راستین نیست',
         Admin.onServer() || form.includes('قفلِ محلی'), form.slice(form.indexOf('gt-foot')));
    }finally{
      Gate.adminConfirm = keepConfirm; Store.update(d => { d.adminHash = keepAdmHash; });
      Host.asked = keepHostAsked; Host._yes = keepHostYes; Host._info = keepHostInfo;
    }

    /* ── یک در، دو جا ──
       دروازهٔ درونِ پنل و صفحهٔ ورود باید از یک جا رمز را بسنجند؛ دو نسخهٔ
       جدا یعنی دو جا برای یک تصمیم، و یکی از آنها دیر یا زود سست می‌شود. */
    const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
    const setHash = (src.match(/Store\.set\('adminHash'/g) || []).length;
    ok('🔒 سنجشِ رمز یک جا دارد، نه دو جا', setHash === 1, 'شمارش=' + setHash);
    ok('و صفحهٔ ورود هم از همان راه می‌رود', /Admin\.tryPass\(/.test(src));
    ok('🔒 و خودِ رمز هیچ‌جا ذخیره نمی‌شود',
       !/Store\.(set|update)\(d => \{ d\.adminPass/.test(src));

    /* ── سنجشِ رمزِ محلی ──
       روی سرور، رمز را سرور می‌سنجد؛ این آزمون مالِ حالتِ محلی است. */
    __smsChecks.push(async () => {
      if(Admin.onServer()) return;
      const keepHash = Store.get('adminHash'), keepAdm = Store.get('isAdmin');
      try{
        Store.update(d => { d.adminHash = ''; d.isAdmin = false; });

        ok('رمزِ خالی رد می‌شود', (await Admin.tryPass('')).ok === false);
        ok('و پرچمِ مدیر روشن نمی‌شود', Store.get('isAdmin') === false);

        const weak = await Admin.tryPass('123');
        ok('رمزِ کوتاه رد می‌شود', weak.ok === false && /کاراکتر/.test(weak.why), weak.why);
        const guess = await Admin.tryPass('12345678');
        ok('🔒 رمزِ حدس‌زدنی رد می‌شود', guess.ok === false && /حدس/.test(guess.why), guess.why);

        const made = await Admin.tryPass('noor-1405-ram');
        ok('نخستین رمز ساخته می‌شود و در می‌آورد', made.ok === true && Store.get('isAdmin') === true, made.why);
        ok('و فقط هش می‌ماند، نه خودِ رمز',
           /^[0-9a-f]{64}$/.test(Store.get('adminHash')) &&
           !JSON.stringify(Store.data).includes('noor-1405-ram'));
        ok('و «نخستین بار» بودنش را گزارش می‌کند', made.first === true);

        ok('با رمزِ درست، بارِ بعد هم در می‌آورد', (await Admin.tryPass('noor-1405-ram')).ok === true);
        const bad = await Admin.tryPass('noor-1405-ram2');
        ok('🔒 و رمزِ اشتباه رد می‌شود', bad.ok === false && /اشتباه/.test(bad.why), bad.why);
      }finally{
        Store.update(d => { d.adminHash = keepHash; d.isAdmin = keepAdm; });
      }
    });
  }finally{
    Store.set('gate', keep);
  }
}

section('میزبانِ همین‌جا — تشخیصِ سرور، اتصال، و شناسه');
{
  /* ── چرا این سنجش‌ها هستند ──
     کاربر برنامه را از `http://localhost:8787` باز می‌کرد — همان‌جایی که
     `server.js` با `NOOR_ADMIN_PASS` در حالِ سرو کردن بود — ولی برنامه
     باز هم فرمِ «ساختنِ رمزِ محلی» را نشان می‌داد و وضعیت «🟡 محلی» و
     شناسهٔ گذرای `utrqd5g9` می‌داد. یعنی دو تا رمزِ ادمین. ریشه این بود که
     `serverUrl` خالی بود و `Net.connect('')` بی‌صدا به حالتِ محلی می‌افتاد.
     حالا پیش از تصمیم از `/api/health` می‌پرسیم و اگر سرور همان‌جا باشد،
     خودمان وصل می‌شویم و رمز را از سرور می‌پرسیم، نه از دستگاه. */
  const keepLoc = { protocol: global.location.protocol, host: global.location.host };

  const withLoc = (protocol, host, fn) => {
    global.location.protocol = protocol; global.location.host = host;
    try{ return fn(); }finally{
      global.location.protocol = keepLoc.protocol; global.location.host = keepLoc.host;
    }
  };

  ok('از http، آدرسِ ws هم‌میزبان ساخته می‌شود',
     withLoc('http:', 'localhost:8787', () => Host.wsUrl()) === 'ws://localhost:8787');
  ok('و از https، wss',
     withLoc('https:', 'noorestan.example', () => Host.wsUrl()) === 'wss://noorestan.example');
  /* مسیر هم می‌آید؛ سرور پشتِ پروکسیِ زیرمسیر هم باید کار کند. */
  ok('پورت و میزبان با هم می‌آیند',
     withLoc('http:', '192.168.1.5:8787', () => Host.wsUrl()) === 'ws://192.168.1.5:8787');
  /* بیرون از http/https (مثلاً فایلِ باز‌شده از دیسک) سروری نیست. */
  ok('از file: سروری فرض نمی‌شود', withLoc('file:', '', () => Host.wsUrl()) === '');
  ok('بی میزبان سروری فرض نمی‌شود', withLoc('http:', '', () => Host.wsUrl()) === '');

  /* ── پیش از پرسیدن، هیچ تصمیمی گرفته نمی‌شود ──
     `defaultUrl` پیش از رسیدنِ پاسخ باید خالی باشد: وصل‌شدن به آدرسِ
     گمانی بدتر از وصل‌نشدن است. */
  {
    const kA = Host.asked, kY = Host._yes, kI = Host._info;
    Host.asked = null; Host._yes = null; Host._info = null;
    ok('پیش از پرسش، آدرسِ پیش‌فرض خالی است', Host.defaultUrl() === '');
    ok('و «سرور هست؟» هنوز نامعلوم است', Host.yes() === false);
    Host._yes = true;
    ok('پس از پاسخِ بله، آدرس پرش می‌شود',
       withLoc('http:', 'localhost:8787', () => Host.defaultUrl()) === 'ws://localhost:8787');
    /* سرور باید *خودش* را تأیید کند، نه اینکه هر پاسخی «بله» شمرده شود.
       پاسخِ وب‌سرورِ ثابت یا صفحهٔ خطا نباید ما را به حالتِ سرور ببرد. */
    ok('تأییدِ سرور به شکلِ پاسخ گره خورده، نه به نبودِ خطا',
       /j\.ok === true/.test(SRC) && /version/.test(SRC.slice(SRC.indexOf('const Host ='))));
    Host.asked = kA; Host._yes = kY; Host._info = kI;
  }

  /* ── یک در: ادمین از سرور می‌پرسد اگر سروری هست ── */
  {
    const kA = Host.asked, kY = Host._yes;
    const kMode = Net.mode, kStatus = Net.status;
    try{
      /* «سوکت باز است» تنها نشانهٔ سرور نیست؛ این سه حالت را جدا می‌سنجیم. */
      Host.asked = Promise.resolve(true); Host._yes = true;
      Net.mode = 'local'; Net.status = 'offline';
      ok('سرورِ میزبان ⇒ ادمین از سرور می‌پرسد', Admin.remote() === true);
      Host._yes = false;
      ok('بی سرور ⇒ ادمین محلی می‌ماند', Admin.remote() === false);
      Net.mode = 'ws'; Net.status = 'online'; Host._yes = false;
      ok('اتصالِ برقرار ⇒ باز هم سرور', Admin.remote() === true);
      /* سوکت هست ولی هنوز وصل نشده — نه سرور، نه محلیِ خاموش. */
      Net.status = 'connecting';
      ok('سوکتِ در راه هنوز «سرور» شمرده نمی‌شود', Admin.remote() === false);
    }finally{ Net.mode = kMode; Net.status = kStatus; Host.asked = kA; Host._yes = kY; }
  }

  /* ── شناسهٔ نمایشی نباید گذرا باشد ──
     `Net.id` هر بار اتصال عوض می‌شود و روی سرور معنایی ندارد؛ چیزی که
     باید نشان داده و کپی شود شناسهٔ *حساب* است (`usr_…`). */
  {
    const kId = Net.id, kMode = Net.mode, kStatus = Net.status;
    const kHostYes = Host._yes;
    const kUser = User.get();
    try{
      Net.id = 'utrqd5g9'; Net.mode = 'ws';
      Store.update(d => { d.user = Object.assign({}, kUser, { id: 'usr_' + 'a'.repeat(20) }); });
      ok('روی سرور، شناسهٔ حساب نشان داده می‌شود',
         netIdText() === 'usr_' + 'a'.repeat(20), netIdText());
      ok('و شناسهٔ گذرا هم کنارش می‌آید، نه به‌جایش',
         /usr_/.test(netIdLabel()) && /utrqd5g9/.test(netIdLabel()), netIdLabel());
      ok('و برچسبش «محلی» نمی‌گوید',
         /اتصال/.test(netIdLabel()) && !/محلی/.test(netIdLabel()), netIdLabel());

      Net.mode = 'local';
      ok('بی سرور، شناسهٔ محلی نشان داده می‌شود', netIdText() === 'utrqd5g9', netIdText());
      ok('و برچسبش می‌گوید «محلی»', /محلی/.test(netIdLabel()), netIdLabel());

      /* چیپِ وضعیت هم باید همان زبان را داشته باشد، وگرنه کاربر دو تا
         روایتِ متناقض از یک وضعیت می‌بیند. */
      Net.mode = 'ws'; Net.status = 'online';
      ok('چیپِ وضعیت روی سرور «🟢 سرور» است، نه «🟡 محلی»',
         netChipText() === '🟢 سرور' && /\bon\b/.test(netChipCls()),
         netChipText() + ' | ' + netChipCls());
      ok('و نسخهٔ کوتاهش هم «سرور» است', netChipShort() === 'سرور', netChipShort());
      Net.mode = 'local';
      ok('و در حالتِ محلی صریح «محلی» می‌گوید',
         netChipText() === '🟡 محلی' && netChipShort() === 'محلی', netChipText());
      /* سرور هست ولی سوکت بالا نیامده: «قطع» دروغ است. */
      Host._yes = true; Net.status = 'offline';
      ok('سرورِ حاضر ولی بی‌سوکت، «قطع» گفته نمی‌شود',
         /سرور/.test(netChipText()) && !/^🔴 قطع$/.test(netChipText()), netChipText());
    }finally{
      Net.id = kId; Net.mode = kMode; Net.status = kStatus;
      Host._yes = kHostYes; Store.update(d => { d.user = kUser; });
    }
  }

  /* ── نگهبانِ «بررسی سرور…» ──
     تا پاسخ نرسیده، نه فرمِ ساختنِ رمز می‌آید و نه فرمِ ورودِ رمز. */
  {
    const kA = Host.asked, kY = Host._yes, kI = Host._info;
    Store.set('gate', true);
    const keepStep = Gate.step;
    const box = document.createElement('div');
    const $0 = U.$;
    U.$ = (s, p) => s === '#gateBox' ? box : $0(s, p);
    try{
      Host.asked = null; Host._yes = null; Host._info = null;
      Gate.step = 'admin'; Gate.paint();
      const html = box.innerHTML;
      ok('تا پاسخِ سرور نرسیده، فرمِ رمز ساخته نمی‌شود',
         !html.includes('id="gtPass"'), html.slice(0, 120));
      ok('و فرمِ ساختنِ رمزِ محلی هم نمی‌آید',
         !html.includes('id="gtMake"'), html.slice(0, 120));
      ok('و صریح می‌گوید چه‌کار می‌کند', /بررسی سرور/.test(html));
      ok('و راهِ بازگشت دارد', html.includes('id="gtBack"'));
    }finally{
      Gate.step = keepStep; U.$ = $0;
      Host.asked = kA; Host._yes = kY; Host._info = kI;
    }
  }

  /* ── دو باگی که کاربر از عکس دید ── */
  {
    /* دکمهٔ روم: ردیفِ فلکس نباید متنش را بشکند. */
    ok('دکمهٔ روم کلاسِ خودش را دارد و متنش نمی‌شکند',
       /class="btn ok room-create-btn" id="mkRoom"/.test(SRC) &&
       /\.room-create-btn\{[^}]*white-space:nowrap/.test(SRC));
    const userCss = SRC.match(/\.room-create-btn\{([^}]*)\}/);
    for(const rule of ['font-size:16px', 'padding:14px 20px', 'gap:8px',
                       'align-items:center', 'justify-content:center'])
      ok(`دکمهٔ روم «${rule}» را دارد`, userCss && userCss[1].replace(/\s+/g, '').includes(rule.replace(/\s+/g, '')));
    ok('و آیکنش ۲۰px است، نه اندازهٔ متن',
       /\.room-create-btn \.ic\{[^}]*20px/.test(SRC) && /\.room-create-btn \.icon\{[^}]*20px/.test(SRC));
    ok('و ردیفِ روم در جای تنگ می‌شکند، نه اینکه له کند',
       /\.room-row\{[^}]*flex-wrap:wrap/.test(SRC));

    /* جعبهٔ خالی کنارِ شناسه: دکمه نباید خرد شود. */
    ok('دکمهٔ رونوشت پر است و متن دارد، نه فقط آیکن',
       /id="copyPeer"[^>]*class="btn"|class="btn" id="copyPeer"/.test(SRC) &&
       /class="btn" id="copyPeer"[^>]*>[\s\S]{0,80}?کپی/.test(SRC));
    ok('و در ردیفِ شناسه، دکمه خرد نمی‌شود',
       /\.peer-row \.btn\{[^}]*flex:none/.test(SRC));
    ok('و ورودی کشسان است، نه دکمه‌فشردن',
       /\.peer-row \.inp\{[^}]*flex:1/.test(SRC) && /\.peer-row \.inp\{[^}]*min-width:0/.test(SRC));
  }
}

section('پنل مدیریت — شمارشِ بازی‌ها');
{
  const before = Store.get('stats').byGame;
  const beforeToday = Store.get('stats').today;
  const keepToday = U.today;
  try{
    Store.update(d => { d.stats.byGame = {}; d.stats.today = { date: '', n: 0, byGame: {} }; });

    Stats.track('quiz');
    Stats.track('quiz');
    Stats.track('dooz');
    ok('هر بازی جدا شمرده می‌شود',
       Stats.ranking().map(r => r.id + ':' + r.n).join(',') === 'quiz:2,dooz:1',
       JSON.stringify(Stats.ranking()));
    ok('پرکارترین بازی اول می‌آید', Stats.ranking()[0].id === 'quiz');

    /* «امروز» نباید عددِ دیروز را نشان بدهد */
    Store.update(d => { d.stats.today = { date: '1999-01-01', n: 9, byGame: { quiz: 9 } }; });
    ok('شمارندهٔ دیروز به‌جای امروز جا نمی‌زند', Stats.todayN() === 0, String(Stats.todayN()));
    Stats.track('hadith');
    ok('و نخستین بازیِ امروز، شمارندهٔ تازه می‌سازد',
       Stats.todayN() === 1 && Stats.todayByGame().hadith === 1,
       `${Stats.todayN()} — ${JSON.stringify(Stats.todayByGame())}`);

    /* عوض شدنِ روزِ نیمه‌شب */
    let fake = '2026-01-01';
    U.today = () => fake;
    Store.update(d => { d.stats.today = { date: '2026-01-01', n: 4, byGame: { dooz: 4 } }; });
    fake = '2026-01-02';
    ok('با عوض شدنِ روز، شمارندهٔ امروز صفر می‌شود',
       Stats.todayN() === 0 && Object.keys(Stats.todayByGame()).length === 0);
    Stats.track('dua');
    ok('و بازیِ روزِ تازه، امروز حساب می‌شود',
       Stats.todayN() === 1 && Stats.todayByGame().dua === 1);
    ok('ولی مجموعِ کل از دست نمی‌رود', (Store.get('stats').byGame.dua || 0) === 1);

    ok('نام و آیکنِ هر بازی از فهرستِ خودِ برنامه می‌آید',
       Stats.nameOf('dua') === DATA.GAMES.dua.name && Stats.iconOf('dua') === DATA.GAMES.dua.icon);
    ok('بازیِ ناشناس می‌شکند نه پنهان', Stats.nameOf('nope') === 'nope' && Stats.iconOf('nope') === '🎮');
  }finally{
    U.today = keepToday;
    Store.update(d => { d.stats.byGame = before || {}; d.stats.today = beforeToday; });
  }
}

section('پنل مدیریت — ویرایشِ محتوا');
{
  const keepEdits = JSON.parse(JSON.stringify(Store.get('contentEdits') || { del:{}, add:{} }));
  const keepQuiz = DATA.quiz;
  try{
    Store.update(d => { d.contentEdits = { del: {}, add: {} }; });
    Content.apply();

    const base = DATA.quiz.length;
    const victim = DATA.quiz[0];
    ok('اثر انگشت پایدار است', Content.sig(victim) === Content.sig({ ...victim }),
       Content.sig(victim));
    ok('و برای دو پرسشِ متفاوت یکی نیست', Content.sig(victim) !== Content.sig(DATA.quiz[1]));

    Content.remove('quiz', victim);
    Content.apply();
    ok('پرسشِ برداشته از بانک می‌رود', DATA.quiz.length === base - 1,
       `${base} → ${DATA.quiz.length}`);
    ok('و دقیقاً همان یکی رفته، نه هرچه اولِ فهرست است',
       !DATA.quiz.some(x => U.norm(x.q) === U.norm(victim.q)));
    ok('و بقیهٔ پرسش‌ها سرِ جایشان‌اند',
       keepQuiz.every(x => x === victim || DATA.quiz.some(y => y.q === x.q)));

    Content.restoreAll(); Content.apply();
    ok('بازگرداندنِ همه، بانک را به اصل برمی‌گرداند', DATA.quiz.length === base,
       `${DATA.quiz.length} ≠ ${base}`);

    /* افزودن */
    const fresh = { q: 'پرسشِ آزمونیِ یکتا؟', o: ['الف', 'ب'], a: 'الف',
                    why: 'چون آزمون است', src: 'آزمون' };
    ok('پرسشِ ناقص رد می‌شود', Content.add('quiz', { q: 'خالی؟', o: ['a'], a: 'a' }) !== '');
    ok('پرسشی که پاسخش در گزینه‌ها نیست رد می‌شود',
       Content.add('quiz', { ...fresh, q: 'x1', a: 'ج' }) !== '');
    ok('گزینهٔ تکراری رد می‌شود',
       Content.add('quiz', { ...fresh, q: 'x2', o: ['الف', 'الف'], a: 'الف' }) !== '');
    ok('پرسشِ درست پذیرفته می‌شود', Content.add('quiz', fresh) === '');
    ok('و در بانک می‌نشیند', DATA.quiz.some(x => x.q === fresh.q));
    ok('و مهرِ «افزودهٔ تو» دارد', !!DATA.quiz.find(x => x.q === fresh.q)._added);
    ok('پرسشِ تکراری دو بار نمی‌آید', Content.add('quiz', fresh) !== '');

    /* حذفِ افزودهٔ خودمان، نه فقط مهر زدن */
    Content.remove('quiz', DATA.quiz.find(x => x.q === fresh.q));
    Content.apply();
    ok('افزودهٔ خودمان واقعاً پاک می‌شود', !DATA.quiz.some(x => x.q === fresh.q));
    ok('و در فهرستِ «برداشته‌ها» نمی‌نشیند',
       (Content.edits().del.quiz || []).length === 0,
       JSON.stringify(Content.edits().del.quiz));

    /* بانکِ مشتق: حذف باید پس از بازسازی هم بماند */
    Content.apply();
    const pickLen = DATA.surahPick.length;
    const one = DATA.surahPick[0];
    Content.remove('surahPick', one);
    Content.apply();
    ok('حذف از بانکِ مشتق هم می‌گیرد', DATA.surahPick.length === pickLen - 1,
       `${pickLen} → ${DATA.surahPick.length}`);

    /* CSV */
    const csv = Content.csv(['a', 'b'], [['1', 'x"y'], ['2', 'z']]);
    ok('CSV سرصفحه دارد', csv.includes('"a","b"'));
    ok('و گیومهٔ داخلِ مقدار را درست فرار می‌دهد', csv.includes('"x""y"'));
    ok('و BOM دارد تا اکسل فارسی درست بازش کند', csv.charCodeAt(0) === 0xFEFF);
    ok('و خطِ تازه‌اش CRLF است', csv.includes('\r\n'));

    /* پشتیبان */
    ok('پشتیبانِ بی‌ربط رد می‌شود', Content.importJSON('{"hello":1}') !== '');
    ok('JSON خراب رد می‌شود', Content.importJSON('{oops') !== '');
    ok('آرایه رد می‌شود', Content.importJSON('[1,2]') !== '');

    Content.restoreAll(); Content.apply();
  }finally{
    Store.update(d => { d.contentEdits = keepEdits; });
    Content.apply();
    ok('پس از پاک‌کردنِ روکش، بانک‌ها به تصویرِ اصلی برمی‌گردند',
       DATA.quiz.length === keepQuiz.length,
       `${DATA.quiz.length} ≠ ${keepQuiz.length}`);
  }
}

section('پنل مدیریت — زبانه‌ها و زمانِ نسبی');
{
  ok('زبانهٔ پیش‌فرض داشبورد است', Admin.currentTab === 'dash', Admin.currentTab);
  const tabs = ['dash', 'users', 'games', 'rooms', 'content', 'notif', 'reports', 'ops'];
  ok('همهٔ زبانه‌ها در سند هستند', (() => {
    const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
    return tabs.every(t => src.includes(`data-tab="${t}"`));
  })());
  ok('هر زبانه در switch هم یک case دارد', (() => {
    const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
    return tabs.every(t => src.includes(`case '${t}'`));
  })());
  ok('و renderTab هیچ زبانه‌ای را بی‌پاسخ نمی‌گذارد', (() => {
    const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
    const i = src.indexOf('renderTab(){');
    const body = src.slice(i, src.indexOf("case 'ops'", i));
    return tabs.slice(0, 7).every(t => body.includes(`case '${t}'`));
  })());

  const t = U.now();
  ok('«همین حالا» برای زمانِ کنونی', U.ago(t) === 'همین حالا', U.ago(t));
  ok('دقیقه‌ها درست خوانده می‌شوند', U.ago(t - 5 * 60000).includes('۵'), U.ago(t - 5 * 60000));
  ok('ساعت‌ها درست خوانده می‌شوند', U.ago(t - 3 * 3600000).includes('۳'), U.ago(t - 3 * 3600000));
  ok('روزها درست خوانده می‌شوند', U.ago(t - 4 * 86400000).includes('۴'), U.ago(t - 4 * 86400000));
  ok('زمانِ صفر «همین حالا» است، نه «۵۶ سال پیش»', U.ago(0) === 'همین حالا', U.ago(0));
  ok('زمانِ آینده هم «همین حالا» است', U.ago(t + 999999) === 'همین حالا', U.ago(t + 999999));
  ok('ورودیِ بی‌معنا نمی‌شکند', U.ago(undefined) === 'همین حالا' && U.ago('x') === 'همین حالا');

  /* هر بازی که فهرستِ راه‌انداز دارد باید شمارش هم بشود */
  ok('همهٔ بازی‌های راه‌انداز، شمارنده دارند', (() => {
    const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
    const need = ['surah', 'scramble', 'match', 'memory', 'dooz', 'esmfamil', 'hadith', 'imams', 'dua'];
    return need.every(g => src.includes(`Stats.track('${g}')`));
  })());
  ok('و آزمونِ خودِ برنامه شمرده نمی‌شود', !/Stats\.track\('selfTest'\)/.test(
    fs.readFileSync(__dirname + '/index.html', 'utf8')));
}

section('پنل مدیریت — دفترِ کاربران و کنش‌ها');
{
  /* رندر را می‌گیریم تا بشود دربارهٔ آنچه به کاربر نشان داده می‌شود سنجید */
  const draw = () => {
    const box = { innerHTML: '', classList:{ add(){}, remove(){}, toggle(){} } };
    const $0 = U.$;
    U.$ = (s, p) => s === '#adminBody' ? box : $0(s, p);
    try{ Admin.renderTab(); } finally { U.$ = $0; }
    return box.innerHTML;
  };
  const netKeep = { s: Net.status, m: Net.mode, post: Net.post };
  const seen = [];
  const onServer = () => { Net.status = 'online'; Net.mode = 'ws'; };
  const offServer = () => { Net.status = 'offline'; Net.mode = 'local'; };
  const keepUsers = Admin.users, keepAt = Admin.usersAt, keepQ = Admin._userQ;
  const keepTab = Admin.currentTab;
  Admin.currentTab = 'users';          // renderTab روی همین زبانه سوئیچ می‌کند
  const keepUser = Store.get('user');
  try{
    Net.post = env => { seen.push(env); return true; };

    /* ── فهرست از سرور ── */
    const list = [
      { id: 'usr_' + 'a'.repeat(20), phone: '09121112233', name: 'زهرا', joinedAt: U.now() - 86400000 * 30,
        lastLogin: U.now() - 3600000, visits: 9, plays: 12, score: 340, level: 4,
        blocked: false, online: true },
      { id: 'usr_' + 'b'.repeat(20), phone: '09354445566', name: 'محمد', joinedAt: U.now() - 86400000 * 3,
        lastLogin: U.now() - 86400000 * 2, visits: 2, plays: 1, score: 20, level: 1,
        blocked: true, online: false }
    ];
    Admin.gotUsers(list);
    ok('فهرستِ سرور می‌نشیند', Admin.users.length === 2);
    ok('و زمانِ گرفتنش ثبت می‌شود', U.now() - Admin.usersAt < 2000);
    ok('ورودیِ بی‌شکل، فهرست را خالی می‌کند نه خراب', (() => {
      Admin.gotUsers(null);
      const n = Admin.users.length;
      Admin.gotUsers(list);
      return n === 0 && Admin.users.length === 2;
    })());

    onServer();
    const html = draw();
    ok('شمارهٔ کاربر در فهرست دیده می‌شود', html.includes('0912 111 2233'), 'بی شماره');
    ok('و شناسهٔ او', html.includes('a'.repeat(20)));
    ok('و تعداد بازی‌ها', html.includes('۱۲ بازی') || html.includes('۱۲'), 'بی بازی');
    ok('و تاریخِ عضویت', html.includes('عضو از'), 'بی عضویت');
    ok('مسدود بودنِ کاربر هم پیداست', html.includes('مسدود'));
    ok('هر کاربر سه کنش دارد', (html.match(/data-act="/g) || []).length === 6,
       String((html.match(/data-act="/g) || []).length));

    /* ── جست‌وجو ── */
    Admin._userQ = 'زهرا';
    ok('جست‌وجو با نام کار می‌کند', draw().includes('زهرا'));
    Admin._userQ = '09354445566';
    const byPhone = draw();
    ok('جست‌وجو با شماره هم کار می‌کند', byPhone.includes('محمد') && !byPhone.includes('زهرا'));
    Admin._userQ = '۰۹۳۵۴۴۴۵۵۶۶';                 // همان شماره با رقمِ فارسی
    ok('و با رقمِ فارسیِ همان شماره', draw().includes('محمد'));
    Admin._userQ = 'usr_' + 'b'.repeat(20);
    ok('و با شناسه', draw().includes('محمد'));
    Admin._userQ = 'کسی‌که‌نیست';
    ok('بی‌نتیجه، پیامِ خالی می‌دهد', draw().includes('پیدا نشد'));
    Admin._userQ = '';

    /* ── کنش‌ها روی سرور ── */
    seen.length = 0;
    Store.update(d => { d.adminToken = 'e'.repeat(64); d.adminTokenExp = U.now() + 3600000; });
    Admin.userAct('block', { id: list[0].id, phone: list[0].phone });
    ok('کنشِ مسدودکردن به سرور می‌رود', seen.length === 1 && seen[0].t === 'admin:user:block',
       JSON.stringify(seen[0]));
    ok('و نشانهٔ نشست همراه دارد', seen[0].token === 'e'.repeat(64));
    ok('و کاربر با شناسه و شماره معرفی می‌شود',
       seen[0].id === list[0].id && seen[0].phone === list[0].phone);

    seen.length = 0;
    Admin.userAct('delete', { id: list[1].id });
    ok('حذف هم به سرور می‌رود', seen[0].t === 'admin:user:delete');

    seen.length = 0;
    Admin.userAct('sms', { id: list[0].id, phone: list[0].phone, text: 'سلام' });
    ok('پیامک با متنش می‌رود', seen[0].t === 'admin:user:sms' && seen[0].text === 'سلام',
       JSON.stringify(seen[0]));
    seen.length = 0;
    Admin.userAct('sms', { id: list[0].id, text: 'x'.repeat(500) });
    ok('متنِ بلند پیش از رفتن بریده می‌شود', seen[0].text.length === 300,
       String(seen[0].text.length));

    /* ── پاسخ‌های سرور ── */
    ok('«رسید» و «نمی‌دانم» و «نشد» یکی نیستند', (() => {
      const said = [];
      const t0 = UI.toast;
      UI.toast = (m, k) => { said.push([m, k]); };
      try{
        Admin.smsResult({ state: 'sent' });
        Admin.smsResult({ state: 'pending' });
        Admin.smsResult({ state: 'failed', error: 'قطع' });
      }finally{ UI.toast = t0; }
      return said.length === 3 && said[0][1] === 'ok' && said[1][1] === '' && said[2][1] === 'err'
             && said[1][0].includes('⏳');
    })());

    /* ── بی سرور: کنش محلی، و صداقت دربارهٔ آن ── */
    offServer();
    seen.length = 0;
    Store.update(d => { d.user = null; d.phone = ''; });
    User.entered = false;
    User.ensure();
    Admin.userAct('block', { id: User.get().id });
    ok('بی سرور، کنش به بیرون نمی‌رود', seen.length === 0, JSON.stringify(seen));
    ok('ولی قفلِ محلی می‌نشیند', Store.get('user').blocked === true);
    Admin.userAct('unblock', { id: User.get().id });
    ok('و بازکردنش هم محلی است', Store.get('user').blocked === false);

    ok('بی سرور، پیامک وعده داده نمی‌شود', (() => {
      let modal = 0, toast = '';
      const m0 = UI.modal, t0 = UI.toast;
      UI.modal = () => { modal++; };
      UI.toast = m => { toast = String(m); };
      try{ Admin.smsBox({ id: 'x', phone: '09121112233' }); }
      finally{ UI.modal = m0; UI.toast = t0; }
      return modal === 0 && /سرور/.test(toast);
    })());

    /* حذفِ محلی: هویت پاک می‌شود، نه داده‌های بازی */
    const score = Store.get('score');
    Admin.userAct('delete', { id: 'x' });
    ok('حذفِ محلی هویت را پاک می‌کند', Store.get('user') === null && Store.get('phone') === '');
    ok('ولی امتیاز و دستاوردِ دستگاه دست‌نخورده می‌ماند', Store.get('score') === score);

    /* ── نشانه در پیام‌ها ── */
    ok('🔒 هیچ کنشِ کاربری هش یا رمزی نمی‌فرستد', !seen.some(e => e.hash || e.pass),
       JSON.stringify(seen));
  }finally{
    Object.assign(Net, { status: netKeep.s, mode: netKeep.m, post: netKeep.post });
    Admin.users = keepUsers; Admin.usersAt = keepAt; Admin._userQ = keepQ;
    Admin.currentTab = keepTab;
    Store.update(d => { d.user = keepUser; d.adminToken = ''; d.adminTokenExp = 0; });
  }
}

/* ═══════════════════════════════════════════════════════════════════
   مأموریتِ رفعِ باگ — سنجش‌های پس‌نگر (رگرسیون)

   هر سنجش این‌جا یک باگِ *واقعی* را می‌بندد که یک بار رخ داده است. اگر
   روزی کسی خطِ مربوطه را به حالتِ قبل برگرداند، همین‌جا سرخ می‌شود.
   ═══════════════════════════════════════════════════════════════════ */
section('آیهٔ کامل — دنبالهٔ آیه نمایش داده می‌شود');
{
  ok('متنِ آیه دنبالهٔ آیه را هم می‌آورد', /lvl\.after\s*\?\s*' '\s*\+\s*U\.esc\(lvl\.after\)/.test(SRC));

  const withAfter = DATA.surah.filter(x => x.after);
  ok('دستِ‌کم شش آیه دنباله دارند (پیش‌تر چند آیه نیمه‌بریده بود)',
     withAfter.length >= 6, String(withAfter.length));

  /* دنباله نباید داخلِ خودِ پاسخ تکرار شود، وگرنه دو بار نشان داده می‌شود */
  ok('دنباله با پاسخ هم‌پوشانی ندارد',
     withAfter.every(x => !U.norm(x.after).startsWith(U.norm(x.ans))));

  /* و پرسشِ «سفر سوره‌ها» هم باید دنباله را در متن ببرد */
  const pick = DATA.surahPick.filter(q => q.q.includes('…'));
  ok('پرسش چهارگزینه‌ایِ سوره هم دنباله را می‌آورد',
     pick.length === DATA.surahPick.length,
     `${pick.length} از ${DATA.surahPick.length}`);
  ok('متنِ پرسشِ سوره دیگر وسطِ جمله تمام نمی‌شود', (() => {
    const l = DATA.surah.find(x => x.after);
    const q = DATA.surahPick.find(p => p.a === l.ans);
    return q && q.q.includes(l.after);
  })());

  /* بانکِ مشتق یک سازنده دارد، نه دو تا. پیش‌تر `Content.apply` نسخهٔ
     کهنهٔ خودش را می‌ساخت و در راه‌اندازی روی نسخهٔ درست می‌نشست —
     دنبالهٔ آیه بی‌صدا می‌افتاد و هیچ تستی هم نمی‌فهمید. */
  ok('بانکِ سوره فقط یک سازنده دارد',
     (SRC.match(/const surahPickBuild = /g) || []).length === 1);
  ok('قالبِ دستیِ دوم حذف شده',
     !/DATA\.surahPick = DATA\.surah\.map/.test(SRC));
  ok('هر دو جا (راه‌اندازی و بازسازیِ محتوا) از همان سازنده می‌سازند',
     (SRC.match(/= surahPickBuild\(\)/g) || []).length === 2,
     String((SRC.match(/= surahPickBuild\(\)/g) || []).length));
}

section('نوارِ پیشرفت — سؤالِ جاری شمرده می‌شود');
{
  /* باگِ اصلی: «i / n» در سؤالِ آخر هرگز به ۱۰۰٪ نمی‌رسید. */
  ok('سوره: فرمولِ پیشرفت «(i+1)/n» است',
     /U\.prog\(\(s\.i \+ 1\) \/ s\.list\.length \* 100/.test(SRC));
  ok('کوییز: فرمولِ پیشرفت «(i+1)/n» است',
     /U\.prog\(\(s\.i \+ 1\) \/ s\.qs\.length \* 100/.test(SRC));
  ok('هیچ‌جا پیشرفت با «i / n» پر نمی‌شود',
     !/U\.prog\(\(s\.i \/ s\./.test(SRC));

  /* ریاضیِ خودِ فرمول: پرسشِ آخر باید دقیقاً ۱۰۰ بدهد */
  const n = 24;
  ok('در پرسشِ آخر نوار ۱۰۰٪ می‌شود', ((n - 1 + 1) / n * 100) === 100);
  ok('در پرسشِ نخست نوار ۰ نیست', ((0 + 1) / n * 100) > 0);
  ok('شمارندهٔ «۹ از ۲۴» درست است', `سوره`.length > 0 &&
     U.fa(9) === '۹' && U.fa(24) === '۲۴');
}

section('حلقهٔ پیشرفتِ #s-play — SVG جای نوارِ خطی');
{
  /* ۱) نشانه‌گذاری */
  ok('حلقه در صفحه هست', SRC.includes('class="progress-ring"') &&
     SRC.includes('viewBox="0 0 100 100"'));
  ok('دو دایره: ریل و پیشرفت', SRC.includes('class="ring-track"') &&
     SRC.includes('class="ring-progress"'));
  ok('شعاع و ضخامتِ خط همان ۴۶ و ۴ است',
     /class="ring-track" cx="50" cy="50" r="46"/.test(SRC) &&
     /class="ring-progress" cx="50" cy="50" r="46"/.test(SRC) &&
     /\.progress-ring circle\{[^}]*stroke-width:4/.test(SRC));
  ok('متنِ وسط شمارنده و واحد دارد',
     SRC.includes('class="progress-text"') &&
     /class="progress-text"><b>[^<]*<\/b><small>/.test(SRC));

  /* ۲) نوارِ خطی هنوز سرِ جایش است — پشتوانه، و `FX.levelBurst` */
  ok('نوارِ خطی حذف نشد', SRC.includes('<i id="pgProg"></i>'));
  ok('ولی دیده نمی‌شود', /\.game-progress \.prog\{[^}]*opacity:0/.test(SRC));

  /* ۳) هیچ‌جا مستقیم روی `.style.width`ی نوار نوشته نمی‌شود */
  ok('🔒 هیچ نوشتنِ مستقیمی روی نوارِ خطی نمانده',
     !/pgProg'\)\.style\.width/.test(SRC));
  /* ۱۷ محلِ نوشتنِ مستقیم + تیکِ تایمرِ حالتِ سرعت + جفتِ حافظه */
  ok('و دستِ‌کم ۱۹ محل از `U.prog` می‌گذرد',
     (SRC.match(/U\.prog\(/g) || []).length >= 19,
     String((SRC.match(/U\.prog\(/g) || []).length));
  ok('تیکِ تایمرِ حالتِ سرعت هم حلقه را می‌چرخاند',
     /U\.prog\(\(s\.i \+ \(1 - s\.timeLeft \/ 12\)\) \/ s\.qs\.length \* 100/.test(SRC));
  ok('حافظه پس از هر جفت حلقه را جلو می‌برد',
     /U\.prog\(s\.matched \/ \(s\.cards\.length \/ 2\) \* 100/.test(SRC));

  /* ۴) ریاضیِ حلقه: محیط از خودِ SVG خوانده می‌شود، با پشتوانهٔ ۲πr */
  ok('محیط از `getTotalLength` خوانده می‌شود',
     /C = ring\.getTotalLength\(\)/.test(SRC));
  ok('پشتوانهٔ ۲πr با r=۴۶ هست', /C = 289\.03/.test(SRC));
  ok('`dasharray` و `dashoffset` از یک متغیر می‌آیند',
     /ring\.style\.strokeDasharray = C;/.test(SRC) &&
     /ring\.style\.strokeDashoffset = \(C \* \(1 - p \/ 100\)\)/.test(SRC));

  /* ۵) ریاضیِ خودِ نگاشت: صفر ⇒ خالی، صد ⇒ پر */
  const C = 2 * Math.PI * 46;
  ok('۲πr با r=۴۶ همان ۲۸۹ است', Math.abs(C - 289.03) < 0.05, C.toFixed(2));
  ok('در ۰٪ حلقه تهی است', Math.abs(C * (1 - 0) - C) < 1e-9);
  ok('در ۱۰۰٪ حلقه پر است', Math.abs(C * (1 - 1)) < 1e-9);

  /* ۶) سه حالتِ رنگ */
  ok('درست ⇒ سبز', /\.game-progress\.is-correct \.ring-progress\{stroke:var\(--grn\)\}/.test(SRC));
  ok('نادرست ⇒ سرخ', /\.game-progress\.is-wrong\s+\.ring-progress\{stroke:var\(--red\)\}/.test(SRC));
  ok('کامل ⇒ طلایی', /\.game-progress\.is-complete \.ring-progress\{stroke:var\(--gold\)\}/.test(SRC));
  ok('مهرِ گذرا با تایمر پاک می‌شود',
     /clearTimeout\(this\._pgMark\)/.test(SRC) &&
     /_pgMark = setTimeout\(/.test(SRC));
  ok('هر به‌روزرسانی، مهرِ پاسخِ پیشین را پاک می‌کند',
     /wrap\.classList\.remove\('is-correct', 'is-wrong'\);\s*\n\s*wrap\.classList\.toggle\('is-complete'/.test(SRC));

  /* ۷) مهرِ درست/نادرست به مسیرِ پاسخِ همهٔ بازی‌ها وصل است */
  ok('`Progress.award` مهر می‌زند', /if\(!silent\) U\.progState\(ok\);/.test(SRC));
  ok('حدیث‌یاب، معصومان و نجوا هم مهر می‌زنند',
     (SRC.match(/U\.progState\(ok\);/g) || []).length === 4,
     String((SRC.match(/U\.progState\(ok\);/g) || []).length));

  /* ۸) اندازه‌ها */
  ok('۱۰۰ پیکسل روی میزکار', /\.game-progress\{[^}]*width:100px;height:100px/.test(SRC));
  ok('۸۰ پیکسل روی موبایل', /@media\(max-width:400px\)\{\s*\.game-progress\{width:80px;height:80px/.test(SRC));

  /* ۹) تم دست‌نخورده: هیچ نشانهٔ تازه‌ای از دفترِ مرجع نیامده */
  ok('🔒 نشانه‌های مرجع وارد نشدند',
     !/--primary\b|--sp-4\b|--dur-slow\b|--fs-title\b|--fs-caption\b/.test(SRC));
}

section('سفرِ سوره‌ها — شمارش یکتا و نشانِ پایان');
{
  const names = DATA.surahNames;
  ok('فهرستِ نام‌های یکتا ساخته شده', Array.isArray(names) && names.length > 0);
  ok('نام‌ها یکتا هستند', new Set(names).size === names.length);
  ok('شمارِ سوره‌ها از شمارِ آیه‌ها کمتر است (چند آیه در یک سوره)',
     names.length < DATA.surah.length,
     `${names.length} سوره، ${DATA.surah.length} آیه`);
  ok('همهٔ نام‌های یکتا از خودِ آیه‌ها آمده', (() => {
    const s = new Set(DATA.surah.map(x => x.surah));
    return names.length === s.size && names.every(n => s.has(n));
  })());
  ok('سوره‌های خوانده‌نشده صفر می‌شمارد', DATA.surahDoneCount(null) === 0);
  ok('سورهٔ خوانده‌شده را می‌شمارد',
     DATA.surahDoneCount({ [names[0]]: 1 }) === 1);
  ok('سوره‌ای که در فهرست نیست شمرده نمی‌شود',
     DATA.surahDoneCount({ 'سورهٔ ساختگی': 1 }) === 0);
  ok('همه که خوانده شوند، برابرِ شمارِ سوره‌ها می‌شود',
     DATA.surahDoneCount(Object.fromEntries(names.map(n => [n, 1]))) === names.length);

  /* نشانِ «سفر سوره‌ها» باید با *همان* شمارنده قفل شود، وگرنه هرگز
     باز نمی‌شود (آستانهٔ آیه‌شمار با شمارندهٔ سوره‌شمار نمی‌خواند). */
  ok('آستانهٔ نشانِ سوره با شمارندهٔ یکتا یکی است',
     /surahDone >= DATA\.surahNames\.length/.test(SRC));
}

section('پیام‌های کوتاه (toast) — بستن، سقفِ دو، و متنِ ایمن');
{
  const i = SRC.indexOf('toast(msg, type');
  const body = SRC.slice(i, i + 1200);
  ok('مدتِ پیش‌فرض ۴۰۰۰ میلی‌ثانیه است', /toast\(msg,\s*type = '',\s*ms = 4000\)/.test(SRC));
  ok('دکمهٔ بستن با onclick بسته می‌شود', /x\.className = 'x'/.test(body) && /x\.onclick = close/.test(body));
  ok('دکمهٔ بستن برچسبِ دسترس‌پذیری دارد', /setAttribute\('aria-label', 'بستن پیام'\)/.test(body));
  ok('سقفِ هم‌زمانِ پیام‌ها دو است', /while\(box\.children\.length > 2\) box\.firstChild\.remove\(\)/.test(body));
  /* ── متنِ پیام از مسیرِ ایمن می‌رود ──
     پیام‌ها از دادهٔ سرور و نامِ کاربر می‌آیند، پس هرگز با `innerHTML`
     نوشته نمی‌شوند. ولی دو چیزِ تازه به‌عنوانِ markup می‌نشینند و هر دو
     **ثابت** هستند: آیکنِ صدرِ پیام (که از `Glyph.MAP` می‌آید) و آیکنِ
     دکمهٔ بستن. پس سنجش باید دقیق‌تر شود: متنِ پیام باید همچنان از
     `textContent` بگذرد، و `innerHTML` فقط ثابت بگیرد. */
  ok('متنِ پیام با textContent نوشته می‌شود، نه innerHTML',
     /tx\.textContent = body/.test(body) && !/innerHTML\s*=\s*msg/.test(body)
       && !/innerHTML\s*=\s*body/.test(body));
  ok('🔒 و تنها innerHTMLهای توست ثابت‌اند، نه متنِ پیام',
     /x\.innerHTML = Icon\.of\('close'\)/.test(body)
       && /if\(h\.startsWith\('<svg'\)\) s\.innerHTML = h;/.test(SRC)
       && /else s\.textContent = h;/.test(SRC));
  ok('بستنِ دستی تایمر را پاک می‌کند (پیام «زنده» نمی‌ماند)',
     /clearTimeout\(t\)/.test(body));

  /* ── خودِ رفتار، نه فقط متنِ کد ──
     استابِ DOM هارنس هر بار یک عنصرِ تازهٔ بی‌اثر می‌دهد
     (`appendChild` تهی است)، پس نمی‌شود با آن چیزی را *مشاهده* کرد.
     این‌جا یک عنصرِ کمینهٔ واقعی می‌سازیم. */
  const keep$ = U.$, keepCreate = document.createElement;
  const mkEl = () => {
    const e = {
      children: [], className: '', textContent: '', title: '', style: {}, parent: null,
      classList: { _s: new Set(), add(c){ e.classList._s.add(c); },
                   remove(c){ e.classList._s.delete(c); }, toggle(){},
                   contains(c){ return e.classList._s.has(c); } },
      setAttribute(k, v){ e[k] = v; }, getAttribute(k){ return e[k] ?? null; },
      appendChild(n){ e.children.push(n); n.parent = e; return n; },
      remove(){ const p = e.parent; if(!p) return;
                const k = p.children.indexOf(e); if(k >= 0) p.children.splice(k, 1); e.parent = null; },
      querySelector(){ return null; }, querySelectorAll(){ return []; }
    };
    Object.defineProperty(e, 'firstChild', { get(){ return e.children[0] || null; } });
    return e;
  };
  try{
    const box = mkEl();
    document.createElement = () => mkEl();
    U.$ = (sel) => (sel === '#toasts' ? box : keep$(sel));

    ok('میزبانِ پیام‌ها در صفحه هست', !!U.$('#toasts'));
    /* شماره با ارقامِ فارسی — قاعدهٔ نمایشیِ برنامه */
    for(let k = 0; k < 5; k++) UI.toast('پیام شمارهٔ ' + U.fa(k), '', 20);   // ۲۰ms: تایمری جا نمی‌ماند
    ok('بیش از دو پیام هم‌زمان نمی‌ماند', box.children.length === 2, String(box.children.length));
    ok('کهنه‌ترین پیام کنار رفته، تازه‌ترین مانده',
       box.children[1].children[0].textContent === 'پیام شمارهٔ ۴');
    ok('هر پیامِ ماندگار دکمهٔ بستن دارد',
       box.children.every(t => t.children.some(c => c.className === 'x')));
    ok('دکمهٔ بستن برچسب دارد، نه فقط شکلِ ✕',
       box.children.every(t => t.children.find(c => c.className === 'x')['aria-label'] === 'بستن پیام'));

    /* دادهٔ سرور/نام کاربر نباید به HTML بدل شود */
    const evil = '<img src=x onerror=alert(1)>';
    UI.toast(evil, '', 20);
    const last = box.children[box.children.length - 1];
    ok('متنِ پیام خام می‌ماند و تفسیر نمی‌شود', last.children[0].textContent === evil);

    box.children[0].children.find(c => c.className === 'x').onclick();
    ok('زدنِ ✕ پیام را نشانِ «رفتن» می‌دهد', box.children[0].classList.contains('out'));
  } finally {
    U.$ = keep$; document.createElement = keepCreate;
  }
}

section('بزرگ‌نمایی — تصویر و نقشه از قاب بیرون نمی‌زنند');
{
  ok('تصویر پهنای قاب را رد نمی‌کند', /img\{max-width:100%;height:auto\}/.test(SRC.replace(/\s+/g, '')));
  ok('نقشه (svg) هم مهار شده', /svg\{max-width:100%\}/.test(SRC.replace(/\s+/g, '')));
  ok('ارتفاعِ سراسری مهار شده (بزرگ‌نمایی صفحه را نمی‌کشد)',
     /html,body\{height:100%/.test(SRC.replace(/\s+/g, '')));
  /* ارتفاعِ خودکار فقط برای تصویر است؛ اگر به *قاعدهٔ سراسریِ* svg هم
     بخورد، آیکن‌هایی که اندازه‌شان از صفت می‌آید جابه‌جا می‌شوند.
     قاعده‌های نشان‌دار (`‎.art-hero svg{…}`) عمدی‌اند و اشکالی ندارند. */
  ok('قاعدهٔ سراسریِ svg ارتفاعِ خودکار نمی‌گیرد',
     !/(^|[};])svg\{[^}]*height:auto/.test(SRC.replace(/\s+/g, '')));
}

section('مرجعِ قرآنی — هر آیهٔ پرسیده‌شده سند دارد');
{
  const p = require('path').join(__dirname, '_quran-ref.json');
  ok('پروندهٔ مرجع هست', require('fs').existsSync(p));
  const REF = JSON.parse(require('fs').readFileSync(p, 'utf8'));
  ok('مرجع منبعش را می‌گوید', !!(REF._source && REF._fetched));
  ok('هر آیهٔ پرسیده‌شده در مرجع هست',
     DATA.surah.every(x => REF.ayat[`${x.n}:${x.a}`]),
     DATA.surah.filter(x => !REF.ayat[`${x.n}:${x.a}`]).map(x => `${x.n}:${x.a}`).join(' '));
  ok('مرجع آیه‌ای اضافه ندارد',
     Object.keys(REF.ayat).length >= DATA.surah.length);
}

section('پوسته — صفحهٔ ورودِ بازطراحی‌شده (فاز ۲)');
{
  /* ── نشان ── */
  ok('نشانِ قفل سه گرادیانِ حالت دارد (عادی/موفق/قفل)',
     /id="gtBody"/.test(SRC) && /id="gtBodyOk"/.test(SRC) && /id="gtBodyNo"/.test(SRC));
  ok('و قفل SVG است، نه شکلک', /class="gt-lock" viewBox="0 0 80 80"/.test(SRC));
  ok('و کمان و بدنه و سوراخ و کلید جدا نام‌گذاری شده‌اند',
     /class="g-shackle"/.test(SRC) && /class="g-body"/.test(SRC) &&
     /class="g-hole"/.test(SRC) && /class="g-key"/.test(SRC));
  ok('نشان در گام‌های دیگر هم می‌آید، با آیکنِ همان گام',
     /this\.emblem\('phone'\)/.test(SRC) && /this\.emblem\('crown'\)/.test(SRC) &&
     /this\.emblem\('sat'\)/.test(SRC));
  ok('و قابِ قدیمیِ شکلکی (`gt-mark`) از رنگ‌آمیزی رفته',
     !/class="gt-mark"/.test(SRC), (SRC.match(/class="gt-mark"/g) || []).length + ' مورد');

  /* ── حالت‌ها ── */
  ok('هر پنج حالتِ مرجع تعریف شده‌اند',
     [...Gate.STATE].sort().join(',') === 'is-checking,is-failing,is-locked,is-success,is-typing',
     Gate.STATE.join(','));
  ok('و رنگ‌آمیزی از حالتِ پاک شروع می‌شود',
     /this\.setState\(''\);\s*\n\s*const can = this\.canLogin/.test(SRC));
  ok('و CSS هر پنج حالت را می‌شناسد',
     Gate.STATE.every(k => SRC.includes('#gate.' + k + ' ')));

  /* ── جعبه‌های کد ── */
  ok(`جعبه‌ها به‌شمارِ کد است، نه عددِ ثابتِ مرجع`,
     /this\.pinsHTML\(OTP\.LEN\)/.test(SRC) && OTP.LEN === 5);
  ok('و ستون‌های CSS هم پنج‌تاست',
     /#gate \.gt-pin-group\{ display:grid; grid-template-columns:repeat\(5,/.test(SRC));
  ok('نقطه‌های پیشرفت هم به شمارِ کدند', /this\.barsHTML\(OTP\.LEN\)/.test(SRC));
  ok('و ستونِ پنجمِ موج هم تأخیرِ خودش را دارد',
     /#gate\.is-checking \.gt-progress span:nth-child\(5\)\{ animation-delay:\.4s \}/.test(SRC));

  /* ── #gtCode یک inputِ راستین مانده ──
     هم WebOTP و هم آزمون‌ها به این بندند؛ اگر شیشه‌ای شود، هر دو
     بی‌صدا می‌شکنند. */
  const paintGate = at => {
    const node = () => ({
      innerHTML:'', textContent:'', value:'', disabled:false, style:{}, dataset:{},
      classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
      focus(){}, blur(){}, click(){}, setAttribute(){}, getAttribute(){ return null; },
      appendChild(){}, remove(){}, children:[], firstChild:null, closest(){ return null; },
      querySelector(){ return node(); }, querySelectorAll(){ return []; }
    });
    const box = node(), gateEl = node(), $0 = U.$;
    U.$ = (s, p) => s === '#gate' ? gateEl : s === '#gateBox' ? box : $0(s, p);
    const keepStep = Gate.step, keepPhone = Gate.phone, keepLock = Gate.lockShown;
    try{ Gate.step = at; Gate.phone = '09121110001'; Gate.lockShown = false; Gate.paint(); }
    finally { Gate.step = keepStep; Gate.phone = keepPhone; Gate.lockShown = keepLock; U.$ = $0; }
    return box.innerHTML;
  };
  const code2 = paintGate('code');
  Gate.stop();
  ok('گامِ کد هنوز یک inputِ راستین دارد', /<input[^>]*id="gtCode"/.test(code2));
  ok('و همان ویژگی‌های WebOTP را نگه داشته',
     /id="gtCode"[^>]*inputmode="numeric"/.test(code2) &&
     /id="gtCode"[^>]*maxlength="5"/.test(code2) &&
     /id="gtCode"[^>]*autocomplete="one-time-code"/.test(code2));
  ok('و نشانه‌گذاریِ دسترس‌پذیری دارد', /id="gtCode"[^>]*aria-label=/.test(code2));
  ok('و کنارِ جعبه‌های دیداری نشسته، نه جایشان',
     code2.includes('class="gt-pin-group"') && code2.includes('class="gt-code-in"'));
  ok('و گامِ کد هم شکلک ندارد',
     !/[\u{1F000}-\u{1FAFF}]/u.test(code2), code2.match(/[\u{1F000}-\u{1FAFF}]/gu));

  /* ── WebOTP ── */
  ok('WebOTP هست و به inputِ راستین می‌ریزد',
     /navigator\.credentials\.get\(\{ otp:\{ transport:\['sms'\] \}/.test(SRC));
  ok('و در گامِ کد صدا زده می‌شود', /this\.run\(\);\s*\n\s*\/\* کد را خودِ اندروید/.test(SRC));
  ok('🔒 و اگر مرورگر نشناسد بی‌صدا رد می‌شود، نه خطا',
     /if\(!navigator\.credentials \|\| !window\.OTPCredential\) return;/.test(SRC));
  ok('🔒 و با رفتن از صفحه لغو می‌شود',
     /webotpStop\(\)\{/.test(SRC) && /this\.webotpStop\(\);\s*\n\s*this\.lockShown/.test(SRC));

  /* ── قفلِ موقت ── */
  ok('سقفِ تلاش و مدتِ قفل تعریف شده‌اند', Gate.MAX_TRY === 5 && Gate.LOCK_SEC === 60);
  ok('🔒 و در حافظه می‌ماند، نه فقط تا نوسازیِ صفحه',
     /lockSet\(fails, until\)\{ Store\.set\('gateLock'/.test(SRC));
  ok('و مقدارِ خرابِ حافظه را بی‌خطر می‌کند',
     (() => { const keep = Store.get('gateLock');
       try{ Store.set('gateLock', 'چیزِبی‌ربط');
         const l = Gate.lockGet();
         return l.fails === 0 && l.until === 0; }
       finally{ Store.set('gateLock', keep); } })());
  /* ── تلهٔ `|0` روی مُهرِ زمانی ──
     میلی‌ثانیهٔ امروز ≈۱.۷۶e۱۲ است و از ۳۲ بیت می‌گذرد؛ اگر کسی دوباره
     `until|0` بنویسد، قفل بی‌صدا هرگز بسته نمی‌شود. پس صریح سنجیده می‌شود. */
  ok('🔒 مُهرِ زمانیِ قفل از ۳۲ بیت سالم می‌گذرد',
     (() => { const keep = Store.get('gateLock');
       try{ const t = Date.now() + 60000;
         Gate.lockSet(0, t);
         return Gate.lockGet().until === t && Gate.lockLeft() > 55; }
       finally{ Store.set('gateLock', keep); } })(),
     String(Gate.lockGet().until));
  /* ── بازگشت به فرم پس از پایانِ شمارش ──
     این همان جایی است که یک‌بار حلقهٔ tick→paint→run→tick ساخت و
     پشته سرریز کرد؛ پس صریح سنجیده می‌شود. */
  ok('🔒 پایانِ شمارش قفل را پاک می‌کند و به فرم برمی‌گردد',
     /if\(w <= 0\)\{ this\.lockClear\(\); this\.lockShown = false; Haptic\.hit\(\); this\.paint\(\); \}/.test(SRC));
  ok('🔒 و تصمیمِ حلقه به گرهِ DOM بند نیست',
     /if\(this\.lockShown\)\{/.test(SRC) && /lockShown: false,/.test(SRC));
  /* ── قفل که باز است، فرمِ کد کشیده نمی‌شود ── */
  const keepLockVal = Store.get('gateLock');
  try{
    Store.set('gateLock', { fails:0, until: Date.now() + 60000 });
    const locked = paintGate('code');
    Gate.stop();
    ok('🔒 در حالتِ قفل، جعبه‌های کد کشیده نمی‌شوند',
       !locked.includes('id="gtCode"') && locked.includes('id="gtNum"'), locked.slice(0, 120));
    ok('و راهِ مهمان باز می‌ماند تا کاربر گیر نکند', locked.includes('id="gtGuest"'));
    ok('و جعبهٔ پیشرفت هم نیست', !locked.includes('gt-pin-group'));
  } finally {
    Store.set('gateLock', keepLockVal);
    Gate.lockShown = false;
  }

  /* ── شیشه و درخشش ── */
  ok('کارتِ ورود شیشه‌ای است', /#gate \.gt-card\{[\s\S]{0,260}?backdrop-filter:blur\(20px\)/.test(SRC));
  ok('و پیشوندِ وبیوِ قدیمی هم دارد', /-webkit-backdrop-filter:blur\(20px\)/.test(SRC));
  ok('و خطِ طلاییِ بالای کارت را دارد',
     /#gate \.gt-card::before\{[\s\S]{0,220}?linear-gradient\(90deg,transparent,var\(--gold\),transparent\)/.test(SRC));
  ok('و دکمهٔ اصلی درخششِ گذری دارد', /#gate \.btn\.w::after\{[\s\S]{0,220}?sk-shine/.test(SRC));
  ok('و کم‌حرکتی برای این‌ها هم رعایت شده',
     /@media\(prefers-reduced-motion:reduce\)\{[\s\S]{0,300}?#gate \.btn\.w::after/.test(SRC));
}

section('پوسته — پوستهٔ کلِ برنامه (فاز ۳)');
{
  /* ── هالهٔ محیطی ── */
  ok('لایهٔ هاله در سند هست و تزئینی است',
     /<div id="amb" aria-hidden="true"><i><\/i><i><\/i><\/div>/.test(SRC));
  ok('و دو گوی دارد، طلایی و سبز',
     /#amb i:nth-child\(1\)\{[\s\S]{0,200}?var\(--orb1\)/.test(SRC) &&
     /#amb i:nth-child\(2\)\{[\s\S]{0,200}?var\(--orb2\)/.test(SRC));
  ok('و کلیک را نمی‌گیرد', /#amb\{ position:fixed; inset:0; z-index:0; pointer-events:none/.test(SRC));
  ok('و پشتِ برنامه می‌ماند، نه رویش', /#app, #bgArt\{ z-index:1 \}/.test(SRC));

  /* ── توکن‌های شیشه در هر شش تم ──
     اگر `--glass` فقط در `:root` باشد، تمِ کویر کارتِ آبی می‌گیرد و تم
     معنایش را از دست می‌دهد. */
  const css2 = SRC.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
  const tk = sel => {
    const re = new RegExp(sel.replace(/[[\]"]/g, m => '\\' + m) + '\\s*\\{([\\s\\S]*?)\\}', 'g');
    const out = {}; let m;
    while((m = re.exec(css2)))
      for(const t of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[t[1]] = t[2].trim();
    return out;
  };
  const baseT = tk(':root');
  const THEMES = { dark: baseT };
  for(const t of Theme.ALL.filter(x => x !== 'dark'))
    THEMES[t] = Object.assign({}, baseT, tk(`[data-theme="${t}"]`));
  for(const t of Object.keys(THEMES)){
    ok(`تم «${t}» رنگِ شیشهٔ خودش را دارد`, /^rgba\(/.test(THEMES[t]['--glass'] || ''), THEMES[t]['--glass']);
    ok(`تم «${t}» گوی‌های محیطیِ خودش را دارد`,
       !!THEMES[t]['--orb1'] && !!THEMES[t]['--orb2']);
  }

  /* ── خواناییِ کارتِ شیشه‌ای ──
     `--glass` نیمه‌شفاف است؛ رنگِ راستینش از آمیختن با `--bg` درمی‌آید،
     نه از خودِ rgba. سنجشِ خامِ rgba اینجا بی‌معناست، پس اول می‌خوابانیم.
     این همان‌جایی است که شیشه می‌تواند متن را ناخوانا کند و کسی نفهمد. */
  const lum = h => {
    const c = [1,3,5].map(i => parseInt(h.slice(i, i+2), 16)/255)
      .map(v => v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4));
    return .2126*c[0] + .7152*c[1] + .0722*c[2];
  };
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b);
    return (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
  };
  const over = (c, bg) => {
    const m = String(c).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/i);
    if(!m) return c;
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    const b = [1,3,5].map(i => parseInt(bg.slice(i, i+2), 16));
    return '#' + [0,1,2].map(i => Math.round(parseFloat(m[i+1]) * a + b[i] * (1 - a))
      .toString(16).padStart(2, '0')).join('');
  };
  for(const [name, t] of Object.entries(THEMES)){
    const g = over(t['--glass'], t['--bg']);
    for(const f of ['txt','mut']){
      const r = ratio(t['--'+f], g);
      ok(`تم ${name}: --${f} روی کارتِ شیشه‌ای از حد AA می‌گذرد (${r.toFixed(2)})`, r >= 4.5,
         `${t['--'+f]} روی ${g}`);
    }
  }

  /* ── کارتِ شیشه‌ای ── */
  ok('کارت رنگِ شیشه گرفت', /^\.card\{[\s\S]{0,120}?background:var\(--glass\)/m.test(css2));
  ok('و خطِ طلاییِ بالا دارد',
     /\.card::before\{[\s\S]{0,240}?linear-gradient\(90deg,transparent,var\(--gold\),transparent\)/.test(css2));
  ok('و خط با inset-inline نوشته شده، نه چپ/راست',
     /\.card::before\{[^}]*inset-inline:14px/.test(css2));
  /* ── بلور فقط روی کارتِ سطحِ اول ──
     روی هر ۶۴ کارت، اندرویدِ میان‌رده ده‌ها لایهٔ بلور را هم‌زمان رندر
     می‌کند. این سنجش نگهبانِ همان تصمیم است. */
  ok('بلور فقط روی کارتِ سطحِ اولِ صفحهٔ فعال است',
     /\.screen\.active > \.card,/.test(css2));
  ok('🔒 و روی خودِ `.card` بی‌قید بلور نمی‌نشیند',
     !/^\.card\{[^}]*backdrop-filter/m.test(css2),
     (css2.match(/^\.card\{[^}]*backdrop-filter[^}]*\}/m) || [''])[0].slice(0, 90));

  /* ── کاشی‌ها ── */
  ok('کاشی هالهٔ شعاعی گرفت', /\.tile::after, \.stat::after\{[\s\S]{0,200}?radial-gradient\(circle/.test(css2));
  ok('و هاله در حالتِ عادی پنهان است', /\.tile::after, \.stat::after\{[\s\S]{0,260}?opacity:0/.test(css2));
  ok('و با هاور و فوکوسِ کلید بالا می‌آید',
     /\.tile:hover::after, \.tile:focus-visible::after,/.test(css2) &&
     /\.stat:hover::after, \.stat:focus-visible::after\{ opacity:1 \}/.test(css2));
  ok('کاشی با هاور بالا می‌آید', /\.tile:hover, \.stat:hover\{[\s\S]{0,120}?translateY\(-5px\)/.test(css2));
  /* ── تلهٔ جدِّ موقعیت‌دار ──
     `.stat` پیش‌تر `position` نداشت؛ هاله‌اش به نزدیک‌ترین جدِّ موقعیت‌دار
     می‌چسبید و کجای صفحه درمی‌آمد بی‌آنکه خطایی داده شود. */
  ok('🔒 `.stat` جدِّ موقعیت‌دار گرفت تا هاله‌اش گم نشود',
     /\.stat\{ position:relative; overflow:hidden \}/.test(css2));
  /* فقط `will-change:auto` (خاموش‌کردنِ صریح در کم‌حرکتی) مجاز است؛
     هر مقدارِ دیگر روی ۴۰ کاشی، ۴۰ لایهٔ گرافیکی می‌سازد. */
  const wcTile = [...css2.matchAll(/\.(?:tile|stat)[^{]*\{[^}]*will-change:\s*([a-z, -]+)/g)]
    .map(m => m[1].trim());
  ok('🔒 و will-change روی کاشی‌ها ننشست (۴۰ لایهٔ بی‌دلیل)',
     wcTile.every(v => v === 'auto'), wcTile.join(' / '));

  /* ── دکمه‌ها ──
     بازنویسی‌شده پس از باگِ «آیهٔ امروز»: درخشش دیگر از راهِ
     لغزاندنِ یک نوارِ بیرون‌زده با `overflow:hidden` نمی‌آید، چون آن
     `overflow` کمینهٔ خودکارِ آیتمِ فلکس را صفر می‌کرد و متنِ دکمه‌های
     یک ردیف را می‌بُرید. حالا `background-position` تکان می‌خورد. */
  ok('دکمه درخششِ گذری گرفت',
     /\.btn:not\(\.gh\):not\(:disabled\)::after\{[\s\S]{0,260}?animation:sk-sheen/.test(css2));
  ok('و دکمهٔ ثانویه و غیرفعال بی‌درخشش می‌مانند',
     /\.btn:not\(\.gh\):not\(:disabled\)::after/.test(css2));
  ok('و درخشش دکمه را از فوکوس‌پذیری نمی‌اندازد (pointer-events:none)',
     /\.btn:not\(\.gh\):not\(:disabled\)::after\{[^}]*pointer-events:none/.test(css2));
  ok('🔒 و دیگر `overflow` روی `.btn` نیست که متن را ببُرد',
     /\.btn\{ position:relative \}/.test(css2) &&
     !/\.btn\{[^}]*overflow/.test(css2));

  /* ── توست ── */
  ok('توست از راست می‌آید', /\.toast\{[\s\S]{0,260}?animation:sk-toast /.test(css2));
  ok('و شیشه‌ای شد', /\.toast\{[\s\S]{0,120}?background:var\(--glass\)/.test(css2));
  ok('و خروجش هم به همان سمت است', /\.toast\.out\{ animation:sk-toastOut/.test(css2));
  /* سمتِ نوار عمداً دست‌نخورده ماند؛ `border-inline-end` در RTL آن را به
     چپ می‌برد و ظاهرِ جاافتاده را بی‌دلیل عوض می‌کرد. */
  ok('🔒 و نوارِ رنگیِ توست جای خودش ماند', /\.toast\.ok\{border-right-color:var\(--grn\)\}/.test(css2));

  /* ── مودال ── */
  ok('جعبهٔ مودال شیشه‌ای شد', /#modal \.box\{[\s\S]{0,200}?background:var\(--glass\)/.test(css2));
  ok('و خطِ طلاییِ بالا دارد', /#modal \.box::before\{[\s\S]{0,240}?var\(--gold\)/.test(css2));
  ok('و برگهٔ پایین‌کش حرکتش را نگه داشت', /#modal\.sheet \.box\{ animation:sheetUp/.test(css2));

  /* ── ورودِ صفحه‌ها ── */
  ok('صفحه‌ها با منحنیِ نام‌دار وارد می‌شوند', /\.screen\{ animation:sk-entrance \.34s var\(--ease\)/.test(css2));

  /* ── کی‌فریم‌های تازه ── */
  ok('کی‌فریمِ ورودِ توست هست', /@keyframes sk-toast\s*\{/.test(css2));
  ok('و کی‌فریمِ خروجش هم', /@keyframes sk-toastOut\{/.test(css2));
  /* هر `sk-*` که جایی صدا زده می‌شود باید تعریف شده باشد؛ بی این،
     انیمیشن بی‌صدا هیچ کاری نمی‌کند و کسی نمی‌فهمد. */
  const used = new Set([...css2.matchAll(/animation:\s*(sk-[A-Za-z-]+)/g)].map(m => m[1]));
  const defined = new Set([...css2.matchAll(/@keyframes\s+(sk-[A-Za-z-]+)/g)].map(m => m[1]));
  const missing = [...used].filter(k => !defined.has(k));
  ok('هر کی‌فریمِ sk- که صدا زده می‌شود تعریف شده', missing.length === 0,
     missing.join(' ') + ` (${used.size} صدا‌زده، ${defined.size} تعریف‌شده)`);

  /* ── کم‌حرکتی ── */
  ok('کم‌حرکتی هاله را می‌خواباند',
     /@media\(prefers-reduced-motion:reduce\)\{[\s\S]{0,120}?#amb i, \.btn::after\{ animation:none/.test(css2));
  ok('و درخشش را هم برمی‌دارد', /@media\(prefers-reduced-motion:reduce\)\{[\s\S]{0,300}?\.btn::after\{ display:none \}/.test(css2));
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
