/* نورستان — دروازهٔ محلی (بدون وابستگی)
   ─────────────────────────────────────────────────────────────
   پیش‌تر این اسکریپت فقط `node --check` روی اسکریپت‌های لینک‌شده در
   index.html می‌زد؛ در حالی که گامِ CI به نامِ «برگهٔ سبک — نبودنِ
   نشانیِ بیرونی» شناخته می‌شد. یعنی دروازه‌ای که نامش چیزِ دیگری
   می‌گفت، هیچ‌کدام از چهار چیزِ زیر را نمی‌سنجید.

   حالا چهار چیز را می‌سنجد و هر کدام را جدا گزارش می‌دهد:
     ۱) سینتکسِ همهٔ اسکریپت‌هایی که منتشر می‌شوند (لینک‌شده در HTML،
        درون‌خطی، و هر .js در مسیرهای برنامه — از جمله assets/app/ و
        assets/games/ که پیش‌تر هیچ دروازه‌ای نمی‌دیدشان).
     ۲) وجودِ مقصدِ هر src/href محلی در همهٔ صفحه‌های HTML.
     ۳) url() و @import در برگه‌های سبکِ خودمان: فایل باید باشد و نشانی
        نباید بیرونی باشد (قلم و داراییِ برنامه روی خودمان میزبانی
        می‌شود).
     ۴) هر ورودیِ PRECACHE/OPTIONAL/GAME_FILES در sw.js باید روی دیسک
        باشد. نسخهٔ ۱۷ همین باگ را داشت: چهار مسیرِ بی‌فایل در فهرست بود
        و هر نصب چهار درخواستِ محکوم‌به‌شکست می‌فرستاد.

   اجرا: node _check-scripts.js     (کدِ خروج: ۰ سالم، ۱ ایراد)
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const cp = require('child_process');
const os = require('os');
const path = require('path');
const ROOT = __dirname;

const problems = [];
const warnings = [];
const notes = [];

/* نشانی‌های بیرونی‌ای که *آگاهانه* مانده‌اند. هر کدام باید دلیل و
   برنامهٔ رفع داشته باشد؛ هر نشانیِ تازه‌ای که این‌جا نباشد، دروازه را
   قرمز می‌کند. */
const KNOWN_EXTERNAL_CSS = new Set([
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap'
]);
const fail = (group, msg) => problems.push(`[${group}] ${msg}`);
const exists = rel => { try{ return fs.statSync(path.join(ROOT, rel)).isFile(); }catch(e){ return false; } };
const isDir = rel => { try{ return fs.statSync(path.join(ROOT, rel)).isDirectory(); }catch(e){ return false; } };
const isRemote = u => /^(https?:)?\/\//i.test(u) || /^(data|mailto|tel|blob|javascript):/i.test(u);

/* ── ۱) سینتکس ──────────────────────────────────────────────
   فهرست از دو جا می‌آید: هرچه در HTML ارجاع شده، و پیمایشِ مسیرهای
   برنامه. دومی لازم است چون assets/games/*.js و games/*.js در HTMLِ
   index ارجاعی ندارند و از چشمِ دروازه می‌افتادند. */
const htmlFiles = ['index.html', 'offline.html', 'duel.html']
  .concat(fs.existsSync(path.join(ROOT, 'games'))
    ? fs.readdirSync(path.join(ROOT, 'games')).filter(f => f.endsWith('.html')).map(f => 'games/' + f)
    : []);

const scriptSet = new Set();
const styleSet = new Set();
const localRefs = [];   // { file, attr, ref } برای گامِ وجودِ مقصد
const collectPage = (rel) => {
  const abs = path.join(ROOT, rel);
  if(!fs.existsSync(abs)) return;
  const html = fs.readFileSync(abs, 'utf8');
  const dir = path.posix.dirname(rel);
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    const attrs = m[1] || '';
    const src = (attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1];
    if(src){
      if(!isRemote(src)) scriptSet.add(path.posix.normalize(path.posix.join(dir, src.replace(/[?#].*$/, ''))));
    } else if(m[2] && m[2].trim()){
      const type = (attrs.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1];
      if(!type || /javascript|module/i.test(type)) scriptSet.add(rel + '#inline:' + (m.index));
    }
  }
  for(const tag of html.matchAll(/<(link|a|img|iframe|source)\b([^>]*)>/gi)){
    const attrs = tag[2] || '';
    const name = tag[1].toLowerCase();
    const ref = ((name === 'link' ? attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)
                                 : attrs.match(/\b(?:href|src)\s*=\s*["']([^"']+)["']/i)) || [])[1];
    if(!ref || isRemote(ref) || ref.startsWith('#')) continue;
    const clean = ref.replace(/[?#].*$/, '');
    const target = path.posix.normalize(path.posix.join(dir, clean || '.'));
    if(name === 'link' && /rel\s*=\s*["']?stylesheet/i.test(attrs)) styleSet.add(target.endsWith('/') ? target + 'index.html' : target);
    localRefs.push({ file: rel, attr: (name === 'link' ? 'href(link)' : name), ref, target });
  }
};
htmlFiles.forEach(collectPage);

/* مسیرهای برنامه — هر .js که واقعاً منتشر می‌شود */
for(const dir of ['assets/app', 'assets/games', 'games', 'tools', 'tests', '.']){
  const abs = path.join(ROOT, dir);
  if(!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
  for(const f of fs.readdirSync(abs)){
    if(!f.endsWith('.js')) continue;
    if(dir === 'tests' || dir === 'tools') continue;      // ابزارِ توسعه؛ در دروازهٔ سینتکس CI هست
    scriptSet.add(dir === '.' ? f : dir + '/' + f);
  }
}
/* ابزارهای توسعه هم سینتکس‌شان پالیده شود (CI همین فهرست را می‌زند) */
const devScripts = [];
for(const dir of ['.', 'tools', 'tests', 'games']){
  const abs = path.join(ROOT, dir);
  if(!fs.existsSync(abs)) continue;
  for(const f of fs.readdirSync(abs)){
    if(!f.endsWith('.js')) continue;
    devScripts.push(dir === '.' ? f : dir + '/' + f);
  }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'noorestan-check-'));
let checked = 0;
try{
  const unique = new Map();
  for(const rel of [...scriptSet, ...devScripts]) unique.set(rel, true);
  for(const rel of unique.keys()){
    if(rel.includes('#inline:')){
      const [file, marker] = rel.split('#inline:');
      const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const at = Number(marker);
      const body = html.slice(at).match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
      if(!body) continue;
      const out = path.join(tmp, `inline-${checked}.js`);
      fs.writeFileSync(out, body[1]);
      try{ cp.execFileSync(process.execPath, ['--check', out], { stdio: 'pipe' }); checked++; }
      catch(e){ fail('سینتکس', `${file} (درون‌خطی): ${String(e.stderr || e.message).split('\n')[0]}`); }
      continue;
    }
    if(!exists(rel)){ fail('سینتکس', `${rel} وجود ندارد ولی به آن ارجاع شده`); continue; }
    try{ cp.execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' }); checked++; }
    catch(e){ fail('سینتکس', `${rel}: ${String(e.stderr || e.message).split('\n')[0]}`); }
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

/* ── ۲) وجودِ مقصدِ پیوندهای محلی ── */
for(const { file, attr, ref, target } of localRefs){
  const okTarget = target.endsWith('/') ? isDir(target.slice(0, -1)) || exists(target + 'index.html') : exists(target) || isDir(target);
  if(!okTarget) fail('پیوند', `${file}: ${attr}="${ref}" → «${target}» نیست`);
}

/* ── ۳) برگه‌های سبک ── */
const readCss = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const cssQueue = [...styleSet].filter(p => p.endsWith('.css')).map(p => ({ rel: p, from: 'index' }));
const seenCss = new Set();
while(cssQueue.length){
  const { rel } = cssQueue.shift();
  if(seenCss.has(rel)) continue;
  seenCss.add(rel);
  if(!exists(rel)){ fail('استایل', `${rel} نیست`); continue; }
  const dir = path.posix.dirname(rel);
  const css = readCss(rel);
  /* یادداشت‌ها پیش از جست‌وجو پوشانده می‌شوند تا url() داخل کامنت، ایرادِ کاذب نسازد */
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for(const m of bare.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)){
    const u = m[1].trim();
    if(!u || u.startsWith('#') || isRemote(u)){ continue; }
    const target = path.posix.normalize(path.posix.join(dir, u.replace(/[?#].*$/, '')));
    if(!exists(target)) fail('استایل', `${rel}: url(${u}) → «${target}» نیست`);
  }
  for(const m of bare.matchAll(/@import\s+url\(\s*["']?([^"')]+)["']?\s*\)/gi)){
    const u = m[1].trim();
    if(isRemote(u)){
      /* استثناهای نام‌دار: هر نشانیِ بیرونیِ تازه، دروازه را قرمز می‌کند
         تا بی‌صدا به برگه‌های سبک اضافه نشود. */
      if(KNOWN_EXTERNAL_CSS.has(u)) warnings.push(`${rel}: استثنای نام‌دار — «${u}» (بدهیِ فاز ۴: میزبانیِ محلی)`);
      else fail('استایل', `${rel}: @import بیرونی «${u}» — داراییِ برنامه باید روی خودمان باشد`);
      continue;
    }
    const target = path.posix.normalize(path.posix.join(dir, u));
    if(!exists(target)) fail('استایل', `${rel}: @import «${target}» نیست`);
    else cssQueue.push({ rel: target });
  }
  for(const m of bare.matchAll(/@import\s+["']([^"']+)["']/gi)){
    const u = m[1].trim();
    const target = path.posix.normalize(path.posix.join(dir, u));
    if(!exists(target)) fail('استایل', `${rel}: @import «${target}» نیست`);
    else cssQueue.push({ rel: target });
  }
}
notes.push(`برگهٔ سبکِ پیموده‌شده: ${seenCss.size}`);

/* ── ۴) فهرستِ پیش‌ذخیرهٔ سرویس‌ورکر ── */
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const listOf = name => {
  const i = sw.indexOf(`const ${name} = [`);
  if(i < 0) return [];
  const j = sw.indexOf('\n];', i);
  const body = sw.slice(i, j < 0 ? undefined : j);
  return [...body.matchAll(/^\s*'([^']+)'/gm)].map(m => m[1]);
};
let precache = 0;
for(const name of ['PRECACHE', 'OPTIONAL', 'GAME_FILES']){
  for(const raw of listOf(name)){
    if(raw === './') continue;
    const rel = raw.replace(/^\.\//, '');
    if(rel.endsWith('/')){                       // پوشه → index.html
      if(!exists(rel + 'index.html')) fail('پیش‌ذخیره', `${name}: «${raw}» پوشه است ولی index.html ندارد`);
      precache++; continue;
    }
    if(!exists(rel)) fail('پیش‌ذخیره', `${name}: «${raw}» روی دیسک نیست`);
    else precache++;
  }
}

/* ── گزارش ── */
console.log(`سینتکس: ${checked} اسکریپت سالم`);
console.log(`پیوندهای محلی بررسی‌شده: ${localRefs.length}`);
notes.forEach(n => console.log(n));
console.log(`ورودی‌های پیش‌ذخیرهٔ موجود: ${precache}`);
if(warnings.length){
  console.log(`\n⚠️  ${warnings.length} یادآوری:`);
  warnings.forEach(w => console.log('   ' + w));
}
if(problems.length){
  console.log(`\n❌ ${problems.length} ایراد:`);
  problems.forEach(p => console.log('   ' + p));
  process.exit(1);
}
console.log('✅ دروازهٔ محلی: هیچ ایرادی نیست');
