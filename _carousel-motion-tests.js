// Dependency-free behavioral checks against the real carousel controller.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('index.html', 'utf8');
function element(){
  const classes = new Set(), listeners = {};
  return {style:{},dataset:{},clientWidth:360,inert:false,listeners,
    classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(c,on){on?classes.add(c):classes.delete(c)}},
    addEventListener(n,fn){listeners[n]=fn},setAttribute(){},contains(){return false},
    setPointerCapture(){},releasePointerCapture(){},closest(){return null}};
}
const root=element(), track=element(), home=element(), pause=element();
home.classList.add('active');
const slides=Array.from({length:3},element), dots=Array.from({length:3},element);
const win=element(), doc=element();let delay, now=1000;
const context={window:win,document:doc,FX:{reduced:false},Icon:{of:()=>''},Date,
 U:{$:s=>({'#homeSlider':root,'.promo-panels':track,'#slidePause':pause,'#s-home':home}[s]),$$:s=>s==='.promo-panel'?slides:s==='[data-dot]'?dots:[],now:()=>now},
 Timers:{after(fn,ms){delay=ms;return 1},clear(){}},Set};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const HomeCarousel ='),source.indexOf('const AyahEmbed ='))+';this.carousel=HomeCarousel;',context);
const c=context.carousel;c.init();assert.equal(delay,5000);
const event=(x,y=0,type='pointermove')=>({clientX:x,clientY:y,pointerId:1,button:0,target:root,type});
function down(){root.listeners.pointerdown(event(0,0,'pointerdown'))}
function move(x,y=0){now+=16;root.listeners.pointermove(event(x,y))}
function up(x,type='pointerup'){win.listeners[type](event(x,0,type))}
down();move(90);up(90);assert.equal(c.index,1);assert.equal(track.style.transform,'');
down();move(35);move(-35);assert.equal(slides[2].style.opacity,'');up(-35,'pointercancel');
assert(slides.every(s=>s.style.opacity===''));assert(!c.pauses.has('touch'));
context.FX.reduced=true;down();move(90);up(90);assert.equal(c.index,2);assert(!c.pauses.has('touch'));assert.equal(c.timer,null);
context.FX.reduced=false;down();move(5,40);up(5);assert.equal(c.index,2);
c.show(-7);assert.equal(c.index,2);assert.equal(slides.filter(s=>!s.inert).length,1);
down();move(90);win.listeners.blur({type:'blur'});assert.equal(c.index,2);assert.equal(c.drag,null);assert(!c.pauses.has('touch'));
c.pause('hover',true);assert.equal(c.timer,null);c.pause('hover',false);assert.equal(delay,5000);
doc.hidden=true;c.schedule();assert.equal(c.timer,null);
console.log('PASS: cadence, inertia, direction reversal, cancellation, reduced-motion swipe, vertical scrolling, wrap, inert, blur, hover and hidden-tab pause');

/* ═══════════════════════════════════════════════════════════════════
   بخشِ دوم — CategoryCarousel (کاروسلِ دسته‌های خانه)

   همان روشِ بخشِ نخست: کنترل‌کنندهٔ *واقعی* از داخل index.html بیرون
   کشیده و در یک DOMِ کوچکِ ساختگی اجرا می‌شود. هیچ مرورگری در کار نیست،
   پس زمان مجازی است: `Timers.advance(ms)` تایمرهای سررسیده را به ترتیب
   شلیک می‌کند. این دقیقاً همان چیزی است که برای سنجشِ «پنج ثانیه» و
   «اینرسی» و «لغو» لازم است — و برخلافِ مرورگر، تکرارپذیر.

   نکتهٔ مهم دربارهٔ هندسه: صفحه RTL است، پس اسلایدِ ۰ راست‌ترین است و
   `offsetLeft`های کوچک‌تر به سمتِ چپ می‌روند. جابه‌جاییِ درست برای
   دیدنِ اسلایدِ ۱، *مثبت* است (track به راست می‌لغزد). فرمولِ
   چپ‌به‌راستِ `-index*(width+gap)` کاروسل را به سمتِ خالی هل می‌داد؛
   سنجشِ ۴ همین را می‌سنجد.
   ═══════════════════════════════════════════════════════════════════ */
let vnow = 1000;
const rafQ = [];
const _timers = new Map();
let _nextId = 1;
const Timers2 = {
  page: new Set(), sys: new Set(),
  after(fn, ms, kind = 'page'){
    const id = _nextId++;
    _timers.set(id, { fn, at: vnow + (ms || 0), kind });
    this[kind].add(id);
    return id;
  },
  every(fn, ms, kind){ return this.after(fn, ms, kind); },
  clear(id){ const t = _timers.get(id); if(t) this[t.kind].delete(id); _timers.delete(id); },
  clearPage(){ for(const id of this.page) _timers.delete(id); this.page.clear(); },
  clearSys(){ for(const id of this.sys) _timers.delete(id); this.sys.clear(); },
  /* پیشرویِ زمانِ مجازی؛ تایمرهای سررسیده به ترتیبِ سررسید شلیک می‌شوند
     (مانند مرورگر) و تایمرهای تازه‌ای که در همان میان گرفته می‌شوند هم
     اگر سررسیدشان گذشته باشد، در همین فراخوانی اجرا می‌شوند. */
  advance(ms){
    const target = vnow + ms;
    for(;;){
      let pick = null;
      for(const [id, t] of _timers) if(t.at <= target && (pick == null || t.at < _timers.get(pick).at)) pick = id;
      if(pick == null) break;
      const t = _timers.get(pick);
      vnow = t.at;
      _timers.delete(pick); Timers2[t.kind].delete(pick);
      t.fn();
    }
    vnow = target;
  },
  pending(){ return _timers.size; }
};

const matches = (n, sel) => String(sel).split(',').map(s => s.trim()).filter(Boolean)
  .some(one => one.split('.').filter(Boolean).every(c => n._classes.has(c)));
const descendants = (n, out = []) => { (n.children || []).forEach(c => { out.push(c); descendants(c, out); }); return out; };

function node(spec = {}){
  const classes = new Set(spec.classes || []);
  const listeners = {};
  const attrs = Object.assign({}, spec.attrs || {});
  const n = {
    tagName: spec.tagName || 'DIV',
    _classes: classes, _html: '', listeners, attrs,
    style: Object.assign({ setProperty(k, v){ this[k] = v; }, removeProperty(k){ delete this[k]; } }, spec.style || {}),
    dataset: Object.assign({}, spec.dataset || {}),
    classList: {
      contains: c => classes.has(c),
      add: (...cs) => cs.forEach(c => classes.add(c)),
      remove: (...cs) => cs.forEach(c => classes.delete(c)),
      toggle(c, on){
        const want = on === undefined ? !classes.has(c) : !!on;
        want ? classes.add(c) : classes.delete(c);
        return want;
      }
    },
    children: spec.children || [],
    addEventListener(t, fn){ (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener(t, fn){ if(listeners[t]) listeners[t] = listeners[t].filter(f => f !== fn); },
    setAttribute(k, v){ attrs[k] = String(v); },
    getAttribute(k){ return k in attrs ? attrs[k] : null; },
    removeAttribute(k){ delete attrs[k]; },
    querySelector(sel){ return n.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel){ return descendants(n).filter(c => matches(c, sel)); },
    contains(o){ return !!o && descendants(n).includes(o); },
    closest(sel){ let c = n; while(c){ if(matches(c, sel)) return c; c = c.parent || null; } return null; },
    setPointerCapture(){}, releasePointerCapture(){},
    getBoundingClientRect(){ return { left: 0, top: 0, width: n.clientWidth || 0, height: n.offsetHeight || 0 }; },
    fire(type, ev = {}){
      (listeners[type] || []).slice().forEach(f => f(Object.assign(
        { type, preventDefault(){}, stopPropagation(){}, target: n }, ev)));
      return (listeners[type] || []).length;
    },
    offsetWidth: spec.offsetWidth || 0, offsetHeight: spec.offsetHeight || 0,
    offsetLeft: spec.offsetLeft || 0, clientWidth: spec.clientWidth || 0,
    inert: false, hidden: false, isConnected: spec.isConnected !== false,
    parent: spec.parent || null, textContent: '',
    onclick: null
  };
  /* innerHTML: فقط همان چیزی که برنامه واقعاً می‌نویسد — رشتهٔ دکمه‌های
     نقطه. بی این، «نقطه‌ها از روی اسلایدها ساخته می‌شوند» هرگز سنجیده
     نمی‌شد چون DOMِ ساختگی رشته را تجزیه نمی‌کند. */
  Object.defineProperty(n, 'innerHTML', {
    get(){ return n._html; },
    set(html){
      n._html = String(html);
      n.children.length = 0;
      const re = /<button\b([^>]*)>\s*<\/button>/g;
      let m;
      while((m = re.exec(n._html))){
        const a = m[1];
        const cls = ((a.match(/class="([^"]*)"/) || [, ''])[1]).split(/\s+/).filter(Boolean);
        const di = (a.match(/data-i="([^"]*)"/) || [, ''])[1];
        const c = node({ tagName: 'BUTTON', classes: cls, dataset: di === '' ? {} : { i: di } });
        c.parent = n; n.children.push(c);
      }
    }
  });
  n.children.forEach(c => { c.parent = n; });
  return n;
}

/* کاروسلِ ساختگی: ۴ اسلاید به عرضِ ۳۰۰ و فاصلهٔ ۱۲، چیده‌شده RTL */
function makeCarousel({ slides = 4, width = 300, gap = 12, clientWidth = 390, withDots = true, connected = true } = {}){
  const step = width + gap;
  const slideNodes = Array.from({ length: slides }, (_, i) => node({
    tagName: 'ARTICLE', classes: ['slide'], dataset: { game: 'memory' },
    /* RTL: اسلایدِ ۰ راست‌ترین است، پس بزرگ‌ترین offsetLeft را دارد */
    offsetWidth: width, offsetHeight: 240, offsetLeft: (slides - 1 - i) * step,
    attrs: { role: 'group' }
  }));
  const track = node({ classes: ['carousel-track'], children: slideNodes, clientWidth });
  const viewport = node({ classes: ['carousel-viewport'], children: [track], clientWidth });
  const dots = node({ classes: ['carousel-dots'], children: [] });
  const status = node({ classes: ['carousel-status'] });
  const navPrev = node({ tagName: 'BUTTON', classes: ['carousel-nav', 'prev'] });
  const navNext = node({ tagName: 'BUTTON', classes: ['carousel-nav', 'next'] });
  const root = node({
    classes: ['category-carousel'], dataset: { cat: 'brain' },
    children: [viewport, navPrev, navNext, ...(withDots ? [dots] : []), status],
    clientWidth, offsetWidth: clientWidth, offsetHeight: 280, isConnected: connected,
    attrs: { 'data-cat': 'brain' }
  });
  const screen = node({ classes: ['screen', 'active'], children: [root] });
  return { root, track, viewport, dots, status, navPrev, navNext, slides: slideNodes, screen };
}

const openedGames = [];
const doc2 = node({ tagName: '#document', children: [] });
doc2.hidden = false;
doc2.documentElement = node({ attrs: { dir: 'rtl' } });
doc2.dir = 'rtl';
const win2 = node({ tagName: 'WINDOW' });
const carouselsInDoc = [];
doc2.querySelectorAll = sel => matches(doc2, sel) ? [] :
  (String(sel).includes('.category-carousel') ? carouselsInDoc.filter(c => c.isConnected) : []);
doc2.querySelector = sel => doc2.querySelectorAll(sel)[0] || null;

const ctx2 = {
  window: win2, document: doc2, Date, console,
  getComputedStyle: () => ({ direction: 'rtl' }),
  requestAnimationFrame: fn => { rafQ.push(fn); return rafQ.length; },
  cancelAnimationFrame(){},
  FX: { reduced: false, raf(fn){ try{ return requestAnimationFrame(fn); }catch(e){ fn(0); return 0; } } },
  Icon: { of: () => '' },
  U: { $: (s, p = doc2) => p.querySelector(s), $$: (s, p = doc2) => p.querySelectorAll(s),
       /* مثلِ خودِ برنامه: ارقامِ فارسی. بی این، سنجشِ «گزارشِ زندهٔ
          صفحه‌خوان» رشتهٔ لاتین می‌دید و بی‌آنکه چیزی خراب باشد می‌شکست. */
       fa: n => String(n ?? 0).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]), now: () => vnow },
  Timers: Timers2,
  Sound: { click(){}, page(){} },
  UI: { toast(){} },
  Games: { memory(){ openedGames.push('memory'); } },
  Set
};
vm.createContext(ctx2);
vm.runInContext(
  source.slice(source.indexOf('const HomeCarousel ='), source.indexOf('const AyahEmbed =')) +
  ';this.CC=CategoryCarousel;this.Carousels=Carousels;this.initAllCarousels=initAllCarousels;', ctx2);
const CC = ctx2.CC, Carousels2 = ctx2.Carousels, initAll = ctx2.initAllCarousels;
const drainRaf = () => { let n = 0; while(rafQ.length && n++ < 100) rafQ.shift()(vnow); return n; };
const txOf = t => { const n = parseFloat(String(t || '').replace(/[^-\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
const ptr = (x, y, extra = {}) => Object.assign({ clientX: x, clientY: y, pointerId: 7, button: 0, isPrimary: true, pointerType: 'mouse' }, extra);
const drag = (c, dx, { dy = 0, steps = 6, perStepMs = 16, release = 'pointerup', startMs = 0 } = {}) => {
  c.root.fire('pointerdown', ptr(500, 300, { target: c.slides[0] }));
  for(let i = 1; i <= steps; i++){
    vnow += perStepMs;
    c.root.fire('pointermove', ptr(500 + dx * i / steps, 300 + dy * i / steps, { target: c.slides[0] }));
  }
  if(startMs) vnow += startMs;
  win2.fire(release, ptr(500 + dx, 300 + dy, { type: release, target: c.slides[0] }));
};

assert.equal(typeof CC, 'function', '۱ — CategoryCarousel باید تابع باشد');

/* ── ۲ تا ۵: ساخت، هندسهٔ RTL، کلاس‌ها ── */
{
  const c = makeCarousel(); carouselsInDoc.push(c.root);
  const inst = new CC(c.root, { autoplay: 5000 });
  assert.equal(c.root.__carousel, inst, '۲ — نمونه باید روی el.__carousel بنشیند');
  assert.equal(inst.current, 0);
  assert.equal(c.track.style.transform, 'translateX(0px)', '۳ — اسلایدِ ۰ یعنی جابه‌جاییِ صفرِ صریح');
  assert.ok(c.slides[0]._classes.has('is-active'), '۳ — اسلایدِ ۰ فعال است');
  assert.equal(c.slides[0].inert, false);
  assert.equal(c.slides[1].inert, true, '۵ — اسلایدِ غیرفعال inert است');
  assert.equal(c.slides[1].attrs['aria-hidden'], 'true');

  inst.go(1);
  /* RTL ⇒ جابه‌جایی *مثبت*: track به راست می‌لغزد تا اسلایدِ ۱ دیده شود */
  /* عددِ جابه‌جایی را می‌سنجیم، نه رشته‌اش را: مرورگر مقدارِ inline را
     نرمال می‌کند (312px) و DOMِ ساختگی نه (312.0px). */
  assert.equal(txOf(c.track.style.transform), 312,
    '۴ — در RTL اسلایدِ بعدی باید با translateX مثبتِ ۳۱۲px بیاید');
  assert.equal(inst.current, 1);
  assert.ok(c.slides[0]._classes.has('is-prev'), '۵ — همسایهٔ پیشین is-prev');
  assert.ok(c.slides[2]._classes.has('is-next'), '۵ — همسایهٔ بعدی is-next');
  assert.ok(c.slides[3]._classes.has('is-far'), '۵ — اسلایدِ دور is-far');
  assert.equal(c.slides[0].inert, true, '۵ — همسایه‌ها inert می‌مانند');
  assert.equal(c.slides[1].inert, false);

  /* wrap در هر دو سو */
  inst.go(0); inst.go(-1);
  assert.equal(inst.current, 3, '۶ — از ۰ به -۱ باید به آخرین بپیچد');
  inst.go(4);
  assert.equal(inst.current, 0, '۶ — از آخرین به +۱ باید به ۰ بپیچد');

  /* نقطه‌ها از روی اسلایدها ساخته می‌شوند و کلیک‌شان می‌برد */
  assert.equal(c.dots.querySelectorAll('.dot').length, 4, '۷ — به تعدادِ اسلایدها نقطه ساخته می‌شود');
  /* شنوندهٔ نقطه‌ها روی خودِ ظرف است (event delegation)، پس رویداد را
     روی ظرف می‌اندازیم با targetِ همان نقطه — دقیقاً مثلِ مرورگر. */
  const dot2 = c.dots.querySelectorAll('.dot')[2];
  c.dots.fire('click', { target: dot2 });
  assert.equal(inst.current, 2, '۷ — کلیکِ نقطهٔ ۳ باید به اسلایدِ ۳ ببرد');
  assert.equal(c.dots.querySelectorAll('.dot')[2]._classes.has('active'), true);

  /* دکمه‌های ناوبری */
  c.navNext.onclick(); assert.equal(inst.current, 3, '۸ — دکمهٔ بعدی');
  c.navPrev.onclick(); assert.equal(inst.current, 2, '۸ — دکمهٔ پیشین');

  /* کلیدها: در RTL فلشِ چپ = جلو */
  c.root.fire('keydown', { key: 'ArrowLeft', preventDefault(){} });
  assert.equal(inst.current, 3, '۸ — در RTL فلشِ چپ یعنی اسلایدِ بعد');
  c.root.fire('keydown', { key: 'ArrowRight', preventDefault(){} });
  assert.equal(inst.current, 2, '۸ — در RTL فلشِ راست یعنی اسلایدِ پیشین');

  /* گزارشِ زندهٔ صفحه‌خوان */
  assert.ok(/۳/.test(c.status.textContent), '۸ — وضعیت برای صفحه‌خوان نوشته می‌شود');

  inst.destroy();
}

/* ── ۹ تا ۱۳: دروازه‌های حرکتِ خودکار ── */
{
  const c = makeCarousel(); carouselsInDoc.push(c.root);
  const inst = new CC(c.root, { autoplay: 5000 });
  assert.ok(inst.timer != null && Timers2.page.has(inst.timer), '۹ — تایمرِ page-kind گرفته می‌شود');
  Timers2.advance(4999); assert.equal(inst.current, 0, '۹ — پیش از ۵ ثانیه نمی‌رود');
  Timers2.advance(1);    assert.equal(inst.current, 1, '۹ — سرِ ۵۰۰۰ms یک اسلاید جلو');
  Timers2.advance(5000); assert.equal(inst.current, 2, '۹ — و دوباره');

  /* hover با نشانگر می‌خواباند، با لمس نه */
  c.root.fire('pointerenter', ptr(0, 0, { pointerType: 'mouse' }));
  assert.equal(inst.timer, null, '۱۰ — hover تایمر را پاک می‌کند');
  c.root.fire('pointerleave', ptr(0, 0, { pointerType: 'mouse' }));
  assert.ok(inst.timer != null, '۱۰ — رفتنِ نشانگر تایمر را برمی‌گرداند');
  const before = inst.current;
  c.root.fire('pointerenter', ptr(0, 0, { pointerType: 'touch' }));
  assert.ok(inst.timer != null, '۱۱ — لمس، hover چسبنده نمی‌سازد');
  Timers2.advance(5000);
  assert.equal(inst.current, before + 1, '۱۱ — با لمس هم حرکتِ خودکار ادامه دارد');
  c.root.fire('pointerleave', ptr(0, 0, { pointerType: 'touch' }));

  /* تبِ پنهان */
  doc2.hidden = true; inst.schedule(true);
  assert.equal(inst.timer, null, '۱۲ — تبِ پنهان تایمر نمی‌گیرد');
  doc2.hidden = false; inst.schedule(true);
  assert.ok(inst.timer != null, '۱۲ — آشکارشدن تایمر را برمی‌گرداند');

  /* صفحهٔ غیرفعال */
  c.screen._classes.delete('active'); inst.schedule(true);
  assert.equal(inst.timer, null, '۱۳ — صفحهٔ غیرفعال تایمر نمی‌گیرد');
  c.screen._classes.add('active'); inst.schedule(true);
  assert.ok(inst.timer != null, '۱۳ — فعال‌شدنِ صفحه تایمر را برمی‌گرداند');
  inst.destroy();
}

/* ── ۱۴: کم‌حرکتی ── */
{
  ctx2.FX.reduced = true;
  const c = makeCarousel(); carouselsInDoc.push(c.root);
  const inst = new CC(c.root, { autoplay: 5000 });
  assert.equal(inst.timer, null, '۱۴ — کم‌حرکتی یعنی بدون حرکتِ خودکار');
  assert.equal(c.track.style.transform, '', '۱۴ — کم‌حرکتی transform نمی‌نویسد (CSS خودش صفر می‌کند)');
  inst.go(2);
  assert.equal(inst.current, 2, '۱۴ — ولی رفتنِ دستی کار می‌کند');
  assert.ok(c.slides[2]._classes.has('is-active'));
  /* کشیدن در کم‌حرکتی: بدون دنبال‌کردنِ زنده، ولی آستانه همان است */
  drag(c, 120);
  assert.equal(inst.current, 3, '۱۴ — کشیدن در کم‌حرکتی هم اسلاید را می‌برد');
  assert.equal(c.track.style.transform, '', '۱۴ — هیچ transform زنده‌ای نوشته نشد');
  ctx2.FX.reduced = false;
  inst.destroy();
}

/* ── ۱۵ تا ۲۰: کشیدن، اینرسی، جهت، لغو ── */
{
  const c = makeCarousel(); carouselsInDoc.push(c.root);
  const inst = new CC(c.root, { autoplay: 5000 });

  /* راست ⇒ اسلایدِ بعد (RTL) */
  drag(c, 120);
  assert.equal(inst.current, 1, '۱۵ — کشیدن به راست در RTL یعنی اسلایدِ بعد');
  /* چپ ⇒ اسلایدِ پیشین، با پیچیدن از ۰ */
  inst.go(0);
  drag(c, -120);
  assert.equal(inst.current, 3, '۱۶ — کشیدن به چپ یعنی اسلایدِ پیشین و از ۰ می‌پیچد');
  /* زیرِ آستانه ⇒ فنر به جای خود */
  inst.go(0);
  drag(c, 30, { perStepMs: 200 });          // سرعتِ کم، پس flick نیست
  assert.equal(inst.current, 0, '۱۷ — جابه‌جاییِ زیرِ آستانه اسلاید را نمی‌برد');

  /* عمودی ⇒ مرده */
  inst.go(1);
  drag(c, 10, { dy: 90 });
  assert.equal(inst.current, 1, '۱۷ — کشیدنِ عمودی اسکرولِ صفحه است، نه کاروسل');
  assert.ok(c.slides.every(s => s.style.opacity === ''), '۱۷ — اثرِ زندهٔ کشیدن پاک می‌شود');
  assert.equal(inst.pauses.has('touch'), false, '۱۷ — پس از مرده‌شدن، مکثِ لمس برمی‌گردد');

  /* flick: جابه‌جاییِ کم ولی سرعتِ بالا */
  inst.go(0);
  drag(c, 34, { steps: 3, perStepMs: 16 }); // v ≈ 0.7 px/ms و تازه
  assert.equal(inst.current, 1, '۱۸ — flick با جابه‌جاییِ کم هم می‌برد');
  /* سرعتِ کهنه flick حساب نمی‌شود */
  inst.go(0);
  drag(c, 34, { steps: 3, perStepMs: 16, startMs: 400 });
  assert.equal(inst.current, 0, '۱۹ — سرعتِ کهنه (>۱۰۰ms) flick نیست');
  /* لغو */
  inst.go(0);
  drag(c, 200, { release: 'pointercancel' });
  assert.equal(inst.current, 0, '۲۰ — pointercancel هیچ‌جا نمی‌برد');
  assert.equal(inst.drag, null, '۲۰ — state کشیدن پاک می‌شود');
  inst.destroy();
}

/* ── ۲۱: رگرسیونِ طوفانِ resize ──
   این همان باگی است که در اندازه‌گیریِ مرورگری پیدا شد: `refresh()` تایمر
   را از سر می‌انداخت، پس رویدادهای پشتِ سرهمِ resize (که عکس‌گرفتنِ
   مرورگرِ آزمون می‌ساخت، و روی گوشی جمع‌شدنِ نوارِ نشانی) شمارشِ
   پنج‌ثانیه‌ای را هیچ‌وقت به پایان نمی‌رساندند. */
{
  const c = makeCarousel(); carouselsInDoc.push(c.root);
  const inst = new CC(c.root, { autoplay: 5000 });
  const armed = inst.timer;
  for(let i = 0; i < 40; i++){ Timers2.advance(100); inst.refresh(); }
  assert.equal(inst.timer, armed, '۲۱ — refresh پشتِ سرهم تایمرِ جاری را از سر نمی‌اندازد');
  assert.equal(inst.current, 0, '۲۱ — و بی‌جهت اسلاید هم نمی‌برد');
  Timers2.advance(1000);
  assert.equal(inst.current, 1, '۲۱ — سرِ همان ۵۰۰۰msِ نخست تیک می‌خورد');

  /* ۲۲: clearPage تایمر را بی‌صدا می‌کُشد؛ شناسه باید مرده شناخته شود */
  Timers2.clearPage();
  assert.equal(inst.timerAlive(), false, '۲۲ — تایمرِ پاک‌شده مرده شناخته می‌شود');
  inst.schedule();
  assert.ok(inst.timer != null && Timers2.page.has(inst.timer), '۲۲ — و دوباره گرفته می‌شود');
  /* ولی refreshِ بی‌تغییرِ عرض، هیچ سبکی بازنویسی نمی‌کند */
  const t = c.track.style.transform;
  inst.refresh();
  assert.equal(c.track.style.transform, t, '۲۲ — عرض عوض نشده ⇒ بازنویسیِ سبک هم نیست');
  inst.destroy();
  assert.equal(inst.timer, null, '۲۳ — destroy تایمر را پاک می‌کند');
  assert.equal((win2.listeners.pointerup || []).length, 0, '۲۳ — و شنوندهٔ window را برمی‌دارد');
  assert.equal(c.root.__carousel, null, '۲۳ — و __carousel را خالی می‌کند');
}

/* ── ۲۴: initAllCarousels روی چند گره + پاک‌سازیِ گرهٔ افتاده ── */
{
  carouselsInDoc.length = 0;
  const a = makeCarousel({ slides: 5 }), b = makeCarousel({ slides: 3 });
  carouselsInDoc.push(a.root, b.root);
  const made = initAll();
  assert.equal(made, 2, '۲۴ — برای هر گره یک نمونه ساخته می‌شود');
  assert.ok(a.root.__carousel && b.root.__carousel, '۲۴ — هر دو __carousel دارند');
  assert.equal(initAll(), 0, '۲۴ — فراخوانیِ دوباره نمونهٔ مضاعف نمی‌سازد');
  assert.equal(Carousels2.list.size, 2);
  /* گرهٔ نخست از DOM می‌افتد (renderHome دوباره کشید). نمونه را پیش از
     init نگه می‌داریم، چون destroy() خودِ `el.__carousel` را null می‌کند. */
  const aInst = a.root.__carousel;
  a.root.isConnected = false;
  carouselsInDoc.splice(0, 1);
  const c2 = makeCarousel({ slides: 4 });
  carouselsInDoc.push(c2.root);
  initAll();
  assert.equal(aInst.destroyed, true, '۲۴ — نمونهٔ گرهٔ افتاده نابود می‌شود');
  assert.equal(a.root.__carousel, null, '۲۴ — و گرهٔ افتاده نمونهٔ زنده ندارد');
  assert.equal(Carousels2.list.size, 2, '۲۴ — فهرست تمیز می‌ماند (نه انباشته)');
  assert.equal((win2.listeners.pointerup || []).length, 2, '۲۴ — شنوندهٔ window هم به همان شمار است');
  /* تک‌اسلاید: نه تایمر، نه نقطه */
  const one = makeCarousel({ slides: 1 });
  carouselsInDoc.push(one.root);
  const oi = new CC(one.root, { autoplay: 5000 });
  assert.equal(oi.timer, null, '۲۴ — کاروسلِ تک‌اسلاید حرکتِ خودکار ندارد');
  assert.equal(one.dots.hidden, true, '۲۴ — و نقطه‌هایش پنهان است');
  [b.root.__carousel, c2.root.__carousel, oi].forEach(x => x.destroy());
}

/* ── ۲۵: کلیکِ کارت و فرونشاندنِ کلیکِ پس از کشیدن ── */
{
  openedGames.length = 0;
  const c = makeCarousel(); carouselsInDoc.push(c.root);
  const inst = new CC(c.root, { autoplay: 5000 });
  c.root.fire('click', { target: c.slides[0] });
  assert.deepEqual(openedGames, ['memory'], '۲۵ — کلیکِ کارت بازی را باز می‌کند');
  openedGames.length = 0;
  drag(c, 200);
  c.root.fire('click', { target: c.slides[1] });
  assert.deepEqual(openedGames, [], '۲۵ — بلافاصله پس از کشیدن، کلیک فرو نشانده می‌شود');
  vnow += 600;
  c.root.fire('click', { target: c.slides[1] });
  assert.deepEqual(openedGames, ['memory'], '۲۵ — پس از فرونشستن، دوباره کار می‌کند');
  inst.destroy();
}

console.log('PASS CategoryCarousel: RTL geometry, wrap, dots, nav, keyboard, autoplay gates, ' +
  'reduced motion, drag/inertia/cancel/vertical, resize-storm regression, clearPage revival, ' +
  'destroy cleanup, multi-node init, click suppression');
