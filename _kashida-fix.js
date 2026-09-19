/* ═══════════════════════════════════════════════════════════════════
   _kashida-fix.js — برداشتنِ کشیده (ـ) از متنِ محتوا

   کشیده در متنِ اسکرپ‌شده اثرِ «تراز کردن» است، نه املا: «الْجِـبالِ»
   جای «الْجِبالِ». برنامه معنی را درست می‌فهمد (چون U.norm آن را دور
   می‌ریزد) ولی کاربر در دکمهٔ بازی «الْجِـبالِ» می‌بیند.

   قاعدهٔ ایمنی: فقط جایی کشیده برداشته می‌شود که *دو طرفش* حرف عربی
   باشد. کشیدهٔ میان دو فاصله («1 ـ جوانى») جداکننده است و دست‌نخورده
   می‌ماند تا چشمِ آدم ببیندش.

   اجرا:  node _kashida-fix.js          → گزارش، بی نوشتن
          node _kashida-fix.js --write  → نوشتن
   ═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const FILE = __dirname + '/index.html';
const html = fs.readFileSync(FILE, 'utf8');

const at = html.indexOf('\nconst DATA = {');
const end = html.indexOf('\n};', at);
if(at < 0 || end < 0) throw new Error('DATA پیدا نشد');

const AR = '\\u0600-\\u06FF\\u200c\\u200f';
/* هر تکرار، یک لایه کشیده را برمی‌دارد: «دوســتان» سه تا دارد. */
const INSIDE = new RegExp(`([${AR}])ـ+([${AR}])`, 'g');

let region = html.slice(at, end);
const before = (region.match(/ـ/g) || []).length;
let pass = 0;
while(INSIDE.test(region) && pass++ < 40)
  region = region.replace(INSIDE, '$1$2');
const after = (region.match(/ـ/g) || []).length;

console.log(`کشیدهٔ درونِ واژه: ${before - after} کاراکتر برداشته شد`);
if(after){
  console.log(`\nکشیدهٔ جامانده (میان دو فاصله — دستی ببین): ${after}`);
  for(const m of region.matchAll(/.{0,34}ـ.{0,22}/g)) console.log('   ' + JSON.stringify(m[0]));
}

/* فاصلهٔ دوتایی و فاصلهٔ سر/ته در رشته‌های src/why/title/fa/ar */
const TWICE = /(["'])((?:(?!\1)[^\\]|\\.)*?)\1/g;
let fixed = 0;
const next = region.replace(TWICE, (m0, q, body) => {
  /* فقط رشته‌هایی که متنِ آدمی‌اند؛ JS و CSS دست‌نخورده می‌مانند */
  if(!/[؀-ۿ]/.test(body)) return m0;
  const clean = body.replace(/[ \t]{2,}/g, ' ').replace(/^ | $/g, '');
  if(clean !== body) fixed++;
  return q + clean + q;
});
console.log(`\nرشته‌های با فاصلهٔ اضافه اصلاح‌شده: ${fixed}`);

/* کدِ خودِ برنامه نباید عوض شود: تعدادِ کشیده در نرمال‌سازی‌ها ثابت بماند */
const out = html.slice(0, at) + next + html.slice(end);
const stillNorm = (out.match(/\[ً-ْٰـ\]|\[‌‏ـ\]/g) || []).length;
console.log(`نرمال‌سازی‌های کشیده سرِ جایشان: ${stillNorm}/2`);
if(stillNorm !== 2) throw new Error('به کدِ نرمال‌سازی دست خورد — نوشته نشد');

if(!process.argv.includes('--write')){ console.log('\n(بی --write چیزی نوشته نشد)'); process.exit(0); }
fs.writeFileSync(FILE, out);
console.log('\n✅ نوشته شد');
