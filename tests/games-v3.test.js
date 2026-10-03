// نگهبان نسخهٔ ۳ بازی‌ها: نمایهٔ بازیکن (XP/سطح/روز پیاپی/دستاورد)، چالش روزانه، «جفت نور» — node tests/games-v3.test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.error('❌ ' + m)); };
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

/* G را در یک DOM ساختگیِ حداقلی بالا می‌آوریم تا منطق نمایه واقعاً اجرا شود */
const boot = (now = Date.now()) => {
  const store = {};
  const node = () => ({ getContext: () => ({ setTransform() {} }), appendChild() {}, classList: { add() {}, remove() {} } });
  class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } }
  const ctx = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { createElement: node, querySelector: () => null, addEventListener() {}, body: node() },
    addEventListener() {}, matchMedia: () => ({ matches: true }), navigator: {}, window: {}, performance: { now: () => 0 },
    setTimeout, console, Math, Date: FakeDate, JSON, String, Object, Promise };
  vm.createContext(ctx);
  vm.runInContext(read('games/common.js') + ';this.G=G;', ctx);
  return { G: ctx.G, store };
};

const { G, store } = boot();
for (const k of ['profile', 'award', 'daily', 'levelOf', 'GAMES', 'ACH', 'noBuzz', 'calm']) ok(G[k] !== undefined, 'G.' + k + ' صادر نشده');
// سطح: مرزها و پیوستگی
ok(G.levelOf(0).lvl === 1 && G.levelOf(49).lvl === 1 && G.levelOf(50).lvl === 2 && G.levelOf(200).lvl === 3, 'مرزهای سطح نادرست');
for (let x = 0; x < 5000; x += 37) { const L = G.levelOf(x); ok(L.pct >= 0 && L.pct < 1 && x >= L.from && x < L.to, 'درصد سطح بیرون از بازه در XP=' + x); }
// جایزه و دستاورد
const d = G.daily();
ok(Object.keys(G.GAMES).includes(d), 'چالش روزانه باید یکی از بازی‌ها باشد');
const other = Object.keys(G.GAMES).find(g => g !== d);
const a1 = G.award(other + '_1', 1200, 3);
ok(a1.xp === 180 && !a1.isDaily, 'XP = امتیاز/۱۰ + ۲۰×ستاره (بیرون از چالش روز)');
ok(['first', 'star3', 's1000'].every(x => a1.got.includes(x)), 'دستاوردهای اولین بازی داده نشد');
const a2 = G.award(d + '_1', 100, 0);
ok(a2.isDaily && a2.xp === 20, 'چالش روزانه باید XP را دو برابر کند');
const a3 = G.award(d + '_1', 100, 0);
ok(!a3.isDaily && a3.xp === 10, 'چالش روزانه فقط یک بار در روز');
ok(!a3.got.includes('first'), 'دستاورد نباید دوباره داده شود');
Object.keys(G.GAMES).forEach(g => G.award(g, 10, 0));
ok(G.profile().ach.includes('all'), 'دستاورد «جهانگرد» پس از هر سه بازی');
ok(G.profile().streak === 1, 'روز پیاپیِ روز اول باید ۱ باشد');
// روزهای پیاپی با ساعت ساختگی
const day = 864e5, t = new Date(2026, 9, 3, 12).getTime();
const s1 = boot(t); s1.G.award('hadithrush', 10, 0);
const s2 = boot(t + day); s2.store.noorestan_g_profile = s1.store.noorestan_g_profile; s2.G.award('hadithrush', 10, 0);
const s3 = boot(t + 2 * day); s3.store.noorestan_g_profile = s2.store.noorestan_g_profile; const r3 = s3.G.award('hadithrush', 10, 0);
ok(r3.streak === 3 && r3.got.includes('streak3'), 'سه روز پیاپی باید streak=3 و دستاورد بدهد');
const s4 = boot(t + 5 * day); s4.store.noorestan_g_profile = s3.store.noorestan_g_profile;
ok(s4.G.award('hadithrush', 10, 0).streak === 1, 'وقفه باید روز پیاپی را به ۱ برگرداند');
ok(store.noorestan_g_profile && JSON.parse(store.noorestan_g_profile).xp > 0, 'نمایه ذخیره نشد');

/* «جفت نور» */
const np = read('games/noor-pairs.html');
[...np.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, k) => { try { new vm.Script(m[1]); pass++; } catch (e) { ok(false, 'noor-pairs اسکریپت ' + (k + 1) + ': ' + e.message); } });
ok(/G\.result\(\{/.test(np), 'جفت نور باید G.result داشته باشد');
ok(/key: key\(\)/.test(np) && /'noorpairs_'/.test(np), 'کلید رکورد جفت نور باید با noorpairs_ شروع شود (برای gameOf)');
// هر سوره‌ای که در مرجع هست باید نام داشته باشد تا جفت ساخته شود؛ دست‌کم ۸ سوره لازم است
const ref = JSON.parse(read('_quran-ref.json')).ayat;
const SUR = Function('return ' + np.match(/const SURAH = (\{[^}]+\})/)[1])();
const surahs = new Set(Object.keys(ref).map(k => +k.split(':')[0]).filter(s => SUR[s]));
ok(surahs.size >= 8, 'برای حالت ۸ جفت دست‌کم ۸ سوره در مرجع لازم است: ' + surahs.size);

/* هاب و هنر */
const hub = read('games/index.html');
for (const g of ['ayah-builder.html', 'hadith-rush.html', 'noor-pairs.html']) ok(hub.includes(`href="${g}"`), 'هاب به ' + g + ' لینک ندارد');
[...hub.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m => { try { new vm.Script(m[1]); pass++; } catch (e) { ok(false, 'هاب: ' + e.message); } });
ok(fs.existsSync(path.join(root, 'games/art/noor-pairs.svg')), 'art/noor-pairs.svg نیست');
const sw = read('sw.js');
ok(sw.includes("'./games/noor-pairs.html'") && sw.includes("'./games/art/noor-pairs.svg'"), 'sw.js جفت نور را پیش‌ذخیره نمی‌کند');

console.log(`games-v3: ${pass} ✓  ${fail} ✗`);
process.exit(fail ? 1 : 0);
