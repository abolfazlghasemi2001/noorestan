/* ═══════════════════════════════════════════════════════════════════
   نورستان — لایهٔ رفتارِ Material 3 (`M3`)
   ═══════════════════════════════════════════════════════════════════
   چرا این فایل وجود دارد؟
   `assets/styles/m3.css` نقش‌های رنگ، شکل، تایپ و چیدمانِ انطباقی را
   می‌دهد، اما چهار کار در CSS ممکن نیست و پیش از این اصلاً انجام
   نمی‌شد:

     ۱) کلاسِ اندازهٔ پنجره (compact / medium / expanded) رویِ `<html>`؛
        بدونِ آن، JS نمی‌تواند همان چیزی را ببیند که CSS می‌بیند و هر
        ماژول مجبور است خودش `innerWidth` را حدس بزند.
     ۲) موجِ لمس (ripple) — «پاسخِ سطح» در M3. برنامه فقط `scale(.96)`
        داشت؛ یعنی لمس دیده می‌شد ولی «کجا» لمس شد نه.
     ۳) اعلامِ صفحهٔ تازه به خوانندهٔ صفحه. برنامه SPA است و
        `Router._render` تنها کلاسِ `.active` را جابه‌جا می‌کند، پس کاربرِ
        نابینا هیچ‌وقت نمی‌فهمید صفحه عوض شده است (باگِ دسترس‌پذیری).
     ۴) سه حالتِ «خالی / در حالِ بارگذاری / خطا» با یک شکلِ مشترک و
        متنِ محترمانه — تا هر ماژول برای خودش HTML نسازد و یکی خالیِ
        بی‌پیام بگذارد، یکی متنِ دلخواه بنویسد و یکی هم عددِ ساختگی.

   سه قراردادِ سفت:
     • هیچ متنِ عبادی و هیچ عددِ تکراری این‌جا ساخته نمی‌شود. آن‌ها فقط
       از `NoorContent` می‌آیند. رشته‌های این فایل پوستهٔ رابط‌اند
       (بارگذاری / خالی / خطا) و همه در `STRINGS` نگه داشته می‌شوند تا
       روزی که زبانِ دوم اضافه شد فقط یک نگاشت عوض شود — معماریِ
       چندزبانه بدونِ بازنویسیِ ماژول‌ها.
     • هیچ سراسریِ موجودی بازنویسی نمی‌شود: `U`، `UI`، `Router`،
        `Theme` و `A11y` دست‌نخورده‌اند. تنها پیوندی که پوشانده می‌شود
        `selfTest` است، همان الگویی که `salah-1.js` گذاشته.
     • هر دسترسی به DOM نگهبان دارد. این فایل در هارنسِ تست با DOMِ
        استاب (بدونِ `matchMedia`، بدونِ `ResizeObserver`، بدونِ
        `getBoundingClientRect`) هم بار می‌شود و در آن حالت «کاری
        نمی‌کند» نه «خطا می‌دهد».
   ═══════════════════════════════════════════════════════════════════ */

const M3 = (function(){
  const VERSION = 1;

  /* ── رشته‌های پوستهٔ رابط (نه محتوای عبادی) ──
     کلیدها ثابت‌اند؛ فقط نگاشتِ زبان عوض می‌شود. `fa` تنها زبانی است که
     امروز تأیید شده، پس هیچ زبانِ دومی «حدس» زده نمی‌شود. */
  const STRINGS = {
    fa: {
      loading : 'در حالِ بارگذاری',
      emptyT  : 'موردی برای نمایش نیست',
      emptyP  : 'هرگاه چیزی ثبت شود، همین‌جا با همان متنِ منبع نشان داده می‌شود.',
      errorT  : 'نمایشِ این بخش ممکن نشد',
      errorP  : 'داده یا اتصالِ لازم در دسترس نیست.',
      retry   : 'تلاشِ دوباره',
      screen  : 'صفحهٔ ',
      progress: 'پیشرفت'
    }
  };
  let lang = 'fa';
  const hasLang = l => Object.prototype.hasOwnProperty.call(STRINGS, String(l || ''));
  const t = k => {
    const d = STRINGS[lang] || STRINGS.fa;
    return d && d[k] != null ? String(d[k]) : '';
  };

  /* ── ابزارهای کوچک و بی‌خطر ── */
  const rootEl = () => {
    try{ return (typeof document !== 'undefined' && document.documentElement) || null; }
    catch(e){ return null; }
  };
  const doc = () => { try{ return (typeof document !== 'undefined') ? document : null; }catch(e){ return null; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  /* عددِ فارسی فقط اگر خودِ برنامه نگاشت‌گر داشته باشد؛ وگرنه همان عدد.
     (عددِ «پیشرفت» از پهنای نوار خوانده می‌شود، نه از دادهٔ عبادی.) */
  const fa = n => {
    try{ if(typeof U !== 'undefined' && U && typeof U.fa === 'function') return U.fa(n); }catch(e){}
    return String(n);
  };
  /* «نامعلوم» با «صفر» یکی نیست: `Number(null) === 0` است، پس اگر تهی بودن
     صریح نگرفته شود، نوارِ پیشرفتِ بی‌مقدار «۰٪» گزارش می‌شود و اسکلتِ
     بارگذاری هم یک خط می‌سازد. هر دو دروغ‌اند. */
  const num = (v, lo, hi) => {
    if(v === null || v === undefined || v === '') return null;
    const x = Number(v);
    if(!isFinite(x)) return null;
    return Math.min(hi, Math.max(lo, x));
  };

  /* ═══════════ ۱. اندازهٔ پنجره — Window size class ═══════════
     همان سه شکستِ مرجعِ M3 که m3.css هم با media query می‌شناسد؛ این‌جا
     به `<html data-wsc>` نوشته می‌شود تا JS و CSS یک واقعیت را ببینند.
     اگر پهنا قابلِ خواندن نباشد (محیطِ تست/سرور) هیچ چیزی نوشته نمی‌شود:
     چیدمان با media query درست می‌ماند و ما «کلاسِ اشتباه» نمی‌چسبانیم. */
  const BP = { medium: 600, expanded: 840 };

  function viewport(){
    try{
      if(typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth > 0)
        return window.innerWidth;
      const de = rootEl();
      if(de && typeof de.clientWidth === 'number' && de.clientWidth > 0) return de.clientWidth;
    }catch(e){}
    return 0;
  }
  function sizeOf(w){
    const x = (typeof w === 'number' && isFinite(w) && w > 0) ? w : viewport();
    if(!x) return '';
    if(x >= BP.expanded) return 'expanded';
    if(x >= BP.medium) return 'medium';
    return 'compact';
  }
  let lastSize = '';
  function syncSize(){
    const s = sizeOf();
    if(!s) return lastSize;
    if(s === lastSize) return s;
    lastSize = s;
    const el = rootEl();
    if(el && typeof el.setAttribute === 'function'){
      try{ el.setAttribute('data-wsc', s); }catch(e){}
    }
    return s;
  }
  let resizeTimer = 0;
  function onResize(){
    /* پشتِ سرِ هم رویدادِ resize می‌آید؛ با یک تأخیرِ کوتاه یکی می‌شوند. */
    try{ if(resizeTimer) clearTimeout(resizeTimer); }catch(e){}
    try{ resizeTimer = setTimeout(() => { resizeTimer = 0; syncSize(); }, 120); }
    catch(e){ syncSize(); }
  }
  let observer = null;
  function observe(){
    try{
      if(observer) return observer;
      const de = rootEl();
      if(typeof window !== 'undefined' && typeof window.ResizeObserver === 'function' && de){
        observer = new window.ResizeObserver(() => onResize());
        observer.observe(de);
      }
    }catch(e){ observer = null; }
    return observer;
  }

  /* ═══════════ ۲. پاسخِ لمس — ripple و لایهٔ وضعیت ═══════════
     لایهٔ وضعیت (hover/focus/press) کاملاً در CSS است؛ این‌جا فقط موجِ
     لمس ساخته می‌شود، چون جایِ موج باید از مختصاتِ واقعیِ انگشت بیاید.
     یک شنوندهٔ واگذارشده (delegated) برای همهٔ برنامه — نه یک شنونده
     به ازای هر دکمه، وگرنه با هر بازرسمی صدها شنوندهٔ رها می‌ماند. */
  const RIPPLE_SEL = 'button,.navi,.tab,.dj-tab,.sc-tab,.chip,.tile,.opt,.item,' +
                     '.pill,.iconbtn,.back,.dj-pad,.m3-state';

  function motionOff(){
    try{
      const el = rootEl();
      if(el && typeof el.getAttribute === 'function' && el.getAttribute('data-motion') === 'off') return true;
      if(typeof window !== 'undefined' && typeof window.matchMedia === 'function'){
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if(mq && mq.matches) return true;
      }
    }catch(e){}
    return false;
  }

  function ripple(host, x, y){
    if(!host || motionOff()) return null;
    try{
      const d = doc();
      if(!d || typeof d.createElement !== 'function') return null;
      if(typeof host.getBoundingClientRect !== 'function' || typeof host.appendChild !== 'function') return null;
      if(host.classList && typeof host.classList.contains === 'function' && host.classList.contains('dot')) return null;
      const r = host.getBoundingClientRect();
      const w = r ? Number(r.width) : 0, h = r ? Number(r.height) : 0;
      /* بی‌اندازه یعنی بی‌چیدمان (محیطِ استاب یا عنصرِ پنهان): موجی ساخته
         نمی‌شود تا جعبه‌های صفر-در-صفر روی صفحه نچسبند. */
      if(!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0 || (w < 20 && h < 20)) return null;
      /* سطحِ میزبان باید جدِّ موقعیت‌دار و بُرندهٔ سرریز باشد؛ وگرنه دایرهٔ
         بزرگِ موج (`max(w,h)*2` با `scale(2.4)`) از دکمه بیرون می‌زند، عرضِ
         اسکرولِ صفحهٔ RTL را ناگهان بزرگ می‌کند و هنگام رها کردنِ لمس (که
         `transform`ِ `:active` برداشته می‌شود) به جدِّ بالاتر می‌پرد. */
      const keepOverflow = host.classList && typeof host.classList.contains === 'function' && host.classList.contains('sj-p');
      if(host.classList && typeof host.classList.add === 'function' && !keepOverflow){
        host.classList.add('m3-ripple-host');
      }
      if(typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && host.style){
        const cs = window.getComputedStyle(host);
        if(cs && cs.position === 'static') host.style.position = 'relative';
        if(cs && !keepOverflow && (cs.overflowX === 'visible' || cs.overflowY === 'visible')) host.style.overflow = 'hidden';
      }
      if(typeof host.querySelectorAll === 'function'){
        host.querySelectorAll('.m3-ripple').forEach(old => { try{ old.remove(); }catch(e){} });
      }
      const size = Math.max(w, h) * 2;
      const px = (typeof x === 'number' && isFinite(x) ? x : Number(r.left) + w / 2) - Number(r.left);
      const py = (typeof y === 'number' && isFinite(y) ? y : Number(r.top) + h / 2) - Number(r.top);
      const s = d.createElement('span');
      if(!s) return null;
      if('className' in s) s.className = 'm3-ripple';
      if(typeof s.setAttribute === 'function') s.setAttribute('aria-hidden', 'true');
      if(s.style){
        s.style.width = size.toFixed(1) + 'px';
        s.style.height = size.toFixed(1) + 'px';
        s.style.left = (px - size / 2).toFixed(1) + 'px';
        s.style.top = (py - size / 2).toFixed(1) + 'px';
      }
      host.appendChild(s);
      /* `pointer-events:none` در CSS است، پس موج هرگز هدفِ رویداد نمی‌شود
         و شمارِ ذکرشمار (که روی خودِ `.dj-pad` بسته شده) نمی‌شکند. */
      let done = false;
      const kill = () => {
        if(done) return; done = true;
        try{ if(typeof s.remove === 'function') s.remove(); }catch(e){}
      };
      if(typeof s.addEventListener === 'function') s.addEventListener('animationend', kill);
      /* پشتبان: اگر animationend نیامد (حرکت خاموش، مرورگرِ بدونِ انیمیشن)
         موج روی سطح نمی‌ماند. */
      try{ setTimeout(kill, 700); }catch(e){ kill(); }
      return s;
    }catch(e){ return null; }
  }

  function onPointerDown(ev){
    try{
      const tgt = ev && ev.target;
      if(!tgt || typeof tgt.closest !== 'function') return;
      const host = tgt.closest(RIPPLE_SEL);
      if(!host || host.disabled) return;
      /* سطحِ «قفل» یا «از کار افتاده» پاسخِ لمس نمی‌گیرد. */
      if(host.getAttribute && host.getAttribute('aria-disabled') === 'true') return;
      ripple(host, ev.clientX, ev.clientY);
    }catch(e){}
  }

  /* ═══════════ ۳. دسترس‌پذیری — اعلامِ صفحهٔ تازه ═══════════ */
  let liveEl = null;
  function live(){
    try{
      const d = doc();
      if(!d) return null;
      if(liveEl) return liveEl;
      if(typeof d.querySelector === 'function'){
        const found = d.querySelector('#m3Live');
        /* در DOMِ استابِ هارنس، querySelector همیشه چیزی برمی‌گرداند؛
           همان را نگه می‌داریم و چیزی به سند اضافه نمی‌کنیم. */
        if(found && (typeof d.body !== 'object' || found.id === 'm3Live' || typeof found.appendChild === 'function')){
          liveEl = found; return liveEl;
        }
      }
      const host = d.body || d.documentElement;
      if(!host || typeof d.createElement !== 'function' || typeof host.appendChild !== 'function') return null;
      const el = d.createElement('div');
      if(!el) return null;
      if(typeof el.setAttribute === 'function'){
        el.setAttribute('id', 'm3Live');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
      }
      /* `.sr` همان کلاسِ «فقط صفحه‌خوان» خودِ برنامه است (style-1);
         `.m3-live` هم در m3.css همان قاعده را دارد تا اگر روزی `.sr`
         برداشته شد، اعلامِ صفحه بی‌صدا نشود. */
      if('className' in el) el.className = 'm3-live sr';
      host.appendChild(el);
      liveEl = el;
      return liveEl;
    }catch(e){ return null; }
  }

  let lastMsg = '', lastAt = 0;
  function announce(text){
    const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if(!s) return false;
    const el = live();
    if(!el) return false;
    const now = Date.now();
    const same = (s === lastMsg);
    lastMsg = s; lastAt = now;
    try{
      if(same){
        /* همان پیام دو بار پشتِ سرِ هم: خوانندهٔ صفحه متنِ یکسان را دوباره
           نمی‌خواند، پس یک لحظه خالی می‌شود و بعد پر. */
        if('textContent' in el) el.textContent = '';
        try{ setTimeout(() => { try{ if('textContent' in el) el.textContent = s; }catch(e){} }, 60); }
        catch(e){ if('textContent' in el) el.textContent = s; }
      } else if('textContent' in el){
        el.textContent = s;
      } else {
        el.innerHTML = esc(s);
      }
    }catch(e){ return false; }
    return true;
  }

  /* برچسبِ صفحه از خودِ برنامه گرفته می‌شود، نه از یک فهرستِ دستیِ تازه:
     ۱) کلیدِ ناوبریِ همان صفحه (متنِ فارسیِ دکمه)، ۲) عنوانِ سربرگِ
     صفحه، ۳) `aria-label` خودِ صفحه. اگر هیچ‌کدام نبود، چیزی اعلام
     نمی‌شود — بهتر از اعلامِ «صفحهٔ s-home». */
  function screenLabel(name){
    try{
      if(!name) return '';
      const d = doc();
      if(!d || typeof d.querySelector !== 'function') return '';
      const nav = d.querySelector('.navi[data-nav="' + String(name).replace(/"/g, '') + '"]');
      const navText = nav && typeof nav.textContent === 'string' ? nav.textContent.replace(/\s+/g, ' ').trim() : '';
      if(navText) return navText;
      let id = '';
      try{ if(typeof Router !== 'undefined' && Router && Router.screens) id = Router.screens[name] || ''; }catch(e){}
      const scr = id ? d.querySelector('#' + id) : null;
      if(scr){
        if(typeof scr.querySelector === 'function'){
          const h = scr.querySelector('.phead h2, h1, h2');
          const ht = h && typeof h.textContent === 'string' ? h.textContent.replace(/\s+/g, ' ').trim() : '';
          if(ht) return ht;
        }
        if(typeof scr.getAttribute === 'function'){
          const al = scr.getAttribute('aria-label');
          if(al && String(al).trim()) return String(al).trim();
        }
      }
    }catch(e){}
    return '';
  }

  function onScreen(ev){
    try{
      const name = (ev && ev.detail && ev.detail.name) || '';
      const label = screenLabel(name);
      if(label) announce(t('screen') + label);
      /* صفحهٔ تازه یعنی چیدمانِ تازه و نوارهای پیشرفتِ تازه. */
      syncSize();
      syncProgress();
    }catch(e){}
  }

  /* ═══════════ ۴. نوارِ پیشرفت — مقدارِ واقعی یا «نامعلوم» ═══════════
     دو باگِ رایج این‌جا بسته می‌شود: نبارِ بی‌`aria-valuenow` (یعنی
     خوانندهٔ صفحه هیچ عددی نمی‌شنود) و نبارِ «نامعلوم» که با عددِ صفر
     گزارش می‌شود. اگر مقدار نامعلوم باشد، `aria-valuenow` *برداشته*
     می‌شود تا وضعیتِ indeterminate درست بماند — همان قاعده‌ای که در
     لایهٔ داده برای «تعدادِ تکرار ثبت نشده» گذاشته‌ایم. */
  function progressbar(el, value, max, text){
    if(!el || typeof el.setAttribute !== 'function') return false;
    try{
      const hi = (typeof max === 'number' && isFinite(max) && max > 0) ? max : 100;
      el.setAttribute('role', 'progressbar');
      el.setAttribute('aria-valuemin', '0');
      el.setAttribute('aria-valuemax', String(hi));
      const v = num(value, 0, hi);
      if(v === null){
        if(typeof el.removeAttribute === 'function') el.removeAttribute('aria-valuenow');
      } else {
        el.setAttribute('aria-valuenow', String(Math.round(v * 100) / 100));
      }
      const label = (text == null || String(text) === '') ? '' : String(text).replace(/\s+/g, ' ').trim();
      if(label) el.setAttribute('aria-valuetext', label);
      else if(typeof el.removeAttribute === 'function') el.removeAttribute('aria-valuetext');
      return true;
    }catch(e){ return false; }
  }

  /* هر نبارِ `role="progressbar"` که پرکنندهٔ درصدی دارد، از خودِ همان
     پهنا عدد می‌گیرد — یعنی هیچ منبعِ حقیقتِ دومی ساخته نمی‌شود. */
  function syncProgress(scope){
    try{
      const host = scope || doc();
      if(!host || typeof host.querySelectorAll !== 'function') return 0;
      const list = host.querySelectorAll('[role="progressbar"]') || [];
      let n = 0;
      for(let i = 0; i < list.length; i++){
        const el = list[i];
        if(!el || typeof el.querySelector !== 'function') continue;
        if(el.getAttribute && el.getAttribute('aria-valuenow')) continue;   // کسی خودش مقدار داده
        const fill = el.querySelector('.prog i') || el.querySelector('.lvlbar i') || el.querySelector('i');
        if(!fill || !fill.style) continue;
        const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(String(fill.style.width || ''));
        if(!m) continue;
        const pct = num(parseFloat(m[1]), 0, 100);
        if(pct === null) continue;
        const txt = (typeof el.textContent === 'string' ? el.textContent : '').replace(/\s+/g, ' ').trim();
        progressbar(el, pct, 100, txt || (t('progress') + ': ' + fa(Math.round(pct)) + '٪'));
        n++;
      }
      return n;
    }catch(e){ return 0; }
  }

  /* ═══════════ ۵. سه حالتِ هر صفحه: خالی، بارگذاری، خطا ═══════════
     خروجی رشتهٔ HTML است (همان قراردادِ `UI.empty` در باندل) تا هر
     ماژولی — چه امروز، چه ماژولِ فردا — همان شکل را بگیرد. کلاسِ
     `empty-state` عمداً نگه داشته شده: قاعده‌های قدیمیِ پوسته و
     سنجش‌های موجود روی همان کلاس نشسته‌اند.

     هیچ‌کدام عدد یا متنِ عبادی از خود نمی‌سازند: عنوان/توضیح یا از
     فراخوان می‌آید یا از `STRINGS`. اگر داده‌ای «نامعلوم» است، فراخوان
     باید همان را بگوید (مثلاً «تعدادِ تکرار در منبع ثبت نشده است» از
     `NoorContent.repeatLabel`) — این‌جا جایگزینِ پیش‌فرض نمی‌شود. */
  function iconOf(name){
    if(!name) return '';
    try{ if(typeof Icon !== 'undefined' && Icon && typeof Icon.of === 'function') return String(Icon.of(name) || ''); }
    catch(e){}
    return '';
  }
  function actionHtml(a){
    if(!a || !a.label) return '';
    const attr = a.action ? ' data-m3-action="' + esc(a.action) + '"' : '';
    const cls = a.cls ? ' ' + esc(a.cls) : '';
    return '<button type="button" class="btn sm' + cls + '"' + attr + '>' + esc(a.label) + '</button>';
  }

  function empty(o){
    const a = o || {};
    const ic = a.icon ? '<span class="m3-empty-ic" aria-hidden="true">' + iconOf(a.icon) + '</span>' : '';
    const title = (a.title == null || a.title === '') ? t('emptyT') : a.title;
    const body = (a.body == null || a.body === '') ? t('emptyP') : a.body;
    const cls = a.cls ? ' ' + esc(a.cls) : '';
    return '<div class="empty-state m3-empty' + cls + '" data-m3-state="empty">' +
             ic + '<b>' + esc(title) + '</b>' +
             (body ? '<p>' + esc(body) + '</p>' : '') +
             actionHtml(a.action) +
           '</div>';
  }

  function error(o){
    const a = o || {};
    const title = (a.title == null || a.title === '') ? t('errorT') : a.title;
    const body = (a.body == null || a.body === '') ? t('errorP') : a.body;
    const cls = a.cls ? ' ' + esc(a.cls) : '';
    const act = a.action || { label: t('retry'), action: 'retry' };
    return '<div class="m3-error' + cls + '" data-m3-state="error">' +
             '<span class="m3-empty-ic" aria-hidden="true">' + iconOf(a.icon || 'alert') + '</span>' +
             '<b>' + esc(title) + '</b>' +
             (body ? '<p>' + esc(body) + '</p>' : '') +
             actionHtml(act) +
           '</div>';
  }

  function loading(o){
    const a = o || {};
    const rows = num(a.rows, 1, 12);
    const n = rows === null ? 3 : Math.round(rows);
    const label = (a.label == null || a.label === '') ? t('loading') : a.label;
    let out = '<div class="m3-loading" data-m3-state="loading" role="status">' +
              '<span class="m3-spinner" aria-hidden="true"></span>' +
              '<b class="m3-loading-t">' + esc(label) + '</b>';
    for(let i = 0; i < n; i++) out += '<span class="m3-skeleton"></span>';
    return out + '</div>';
  }

  const spinner = o => {
    const a = o || {};
    const label = (a.label == null || a.label === '') ? t('loading') : a.label;
    return '<span class="m3-spinner" role="status" aria-label="' + esc(label) + '"></span>';
  };
  const skeleton = (o) => {
    const a = o || {};
    const rows = num(a.rows, 1, 24);
    const n = rows === null ? 1 : Math.round(rows);
    let out = '';
    for(let i = 0; i < n; i++){
      const w = a.width ? ' style="inline-size:' + esc(String(a.width)) + '"' : '';
      out += '<span class="m3-skeleton"' + w + ' aria-hidden="true"></span>';
    }
    return out;
  };

  /* ═══════════ ۶. پیش‌فرضِ اندازهٔ قلمِ رابط ═══════════
     m3.css همهٔ اندازه‌های تایپ را در `--md-ts` ضرب می‌کند، پس «قلمِ
     بزرگ‌تر» یک تنظیمِ پوسته‌ای است نه بازنویسیِ قاعده‌ها. سه پیش‌فرض
     (کوچک/میانه/بزرگ) — همان چیزی که سندِ طراحی خواسته. مقدار در
     localStorage می‌ماند، نه در Store: کلیدِ دادهٔ کاربر جایِ دیگری است
     و این‌جا فقط پوسته است. */
  const SCALES = { sm: 'sm', md: 'md', lg: 'lg' };
  const PREF_KEY = 'noorestan_ui_v1';

  function readPrefs(){
    try{
      if(typeof localStorage === 'undefined' || !localStorage || typeof localStorage.getItem !== 'function') return {};
      const raw = localStorage.getItem(PREF_KEY);
      if(!raw) return {};
      const o = JSON.parse(raw);
      return (o && typeof o === 'object') ? o : {};
    }catch(e){ return {}; }
  }
  function writePrefs(p){
    try{
      if(typeof localStorage === 'undefined' || !localStorage || typeof localStorage.setItem !== 'function') return false;
      localStorage.setItem(PREF_KEY, JSON.stringify(p || {}));
      return true;
    }catch(e){ return false; }
  }
  function typeScale(k){
    return Object.prototype.hasOwnProperty.call(SCALES, String(k || '')) ? String(k) : '';
  }
  function setTypeScale(k, persist){
    const key = typeScale(k);
    const el = rootEl();
    if(el && typeof el.setAttribute === 'function'){
      try{
        if(key) el.setAttribute('data-fs', key);
        else if(typeof el.removeAttribute === 'function') el.removeAttribute('data-fs');
      }catch(e){}
    }
    if(persist !== false){
      const p = readPrefs();
      p.fs = key || 'md';
      writePrefs(p);
    }
    return key || 'md';
  }
  function getTypeScale(){
    const el = rootEl();
    try{
      if(el && typeof el.getAttribute === 'function'){
        const v = typeScale(el.getAttribute('data-fs'));
        if(v) return v;
      }
    }catch(e){}
    const p = readPrefs();
    return typeScale(p.fs) || 'md';
  }
  function applyPrefs(){
    try{
      const p = readPrefs();
      const key = typeScale(p.fs);
      if(key) setTypeScale(key, false);
      if(p.lang && hasLang(p.lang)) lang = String(p.lang);
    }catch(e){}
  }
  function setLang(l){
    if(!hasLang(l)) return lang;      // زبانِ تأییدنشده هرگز حدس زده نمی‌شود
    lang = String(l);
    const p = readPrefs(); p.lang = lang; writePrefs(p);
    return lang;
  }

  /* ═══════════ راه‌اندازی ═══════════ */
  let booted = false;
  function init(){
    if(booted) return true;
    booted = true;
    try{ applyPrefs(); }catch(e){}
    try{ syncSize(); }catch(e){}
    try{
      if(typeof window !== 'undefined' && typeof window.addEventListener === 'function'){
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        /* رویدادِ `noor:screen` را `Router._render` پس از نشاندنِ صفحه
           می‌فرستد؛ یعنی تنها نقطهٔ اتصالِ این لایه به راهبر است و هیچ
           تابعی از راهبر پوشانده نمی‌شود. */
        window.addEventListener('noor:screen', onScreen);
      }
    }catch(e){}
    try{
      const d = doc();
      if(d && typeof d.addEventListener === 'function')
        d.addEventListener('pointerdown', onPointerDown, true);
    }catch(e){}
    try{ observe(); }catch(e){}
    try{ syncProgress(); }catch(e){}
    return true;
  }

  /* ═══════════ سنجشِ درونی ═══════════
     همهٔ سنجش‌ها تابعِ خالص‌اند (بی‌DOM) تا هم در کنسولِ مرورگر و هم در
     هارنسِ Node یکسان جواب بدهند. */
  function selfTest(){
    const rows = [];
    const ok = (name, cond, extra) => rows.push({ name, ok: !!cond, extra });
    try{
      ok('M3/سه کلاسِ اندازهٔ پنجره از پهنای واقعی ساخته می‌شوند',
         sizeOf(320) === 'compact' && sizeOf(599) === 'compact' && sizeOf(600) === 'medium' &&
         sizeOf(839) === 'medium' && sizeOf(840) === 'expanded' && sizeOf(1440) === 'expanded',
         [sizeOf(320), sizeOf(600), sizeOf(840)].join());
      ok('M3/پهنای نامعلوم کلاسِ اشتباه نمی‌سازد', sizeOf(0) === '' && sizeOf(NaN) === '');
      ok('M3/حالتِ خالی متنِ پیش‌فرضِ محترمانه دارد و escape می‌شود',
         /empty-state/.test(empty({})) && /m3-empty/.test(empty({})) &&
         empty({ title: '<b>' }).indexOf('&lt;b&gt;') >= 0);
      ok('M3/حالتِ خطا کنشِ «تلاشِ دوباره» دارد و متنِ دلخواه را escape می‌کند',
         /m3-error/.test(error({})) && error({}).indexOf(esc(t('retry'))) >= 0 &&
         error({ title: '"x"' }).indexOf('&quot;x&quot;') >= 0);
      ok('M3/حالتِ بارگذاری نقشِ status دارد و اسکلت می‌سازد',
         /role="status"/.test(loading({ rows: 2 })) &&
         (loading({ rows: 2 }).match(/m3-skeleton/g) || []).length === 2 &&
         (loading({ rows: 999 }).match(/m3-skeleton/g) || []).length === 12 &&
         /* تهی بودن یعنی «پیش‌فرضِ سه خط»، نه «یک خط» — `Number(null)===0` */
         (loading({}).match(/m3-skeleton/g) || []).length === 3);
      ok('M3/نوارِ پیشرفت مقدارِ واقعی را می‌نشاند و در محدوده نگه می‌دارد', (() => {
        const a = {};
        const fake = { setAttribute: (k, v) => { a[k] = v; }, removeAttribute: k => { delete a[k]; } };
        progressbar(fake, 42, 100, '');
        const one = a['aria-valuenow'] === '42' && a['aria-valuemax'] === '100';
        progressbar(fake, 180, 100, '');
        const clamped = a['aria-valuenow'] === '100';
        progressbar(fake, null, 100, '');
        const unknown = !('aria-valuenow' in a);
        return one && clamped && unknown;
      })());
      ok('M3/پیش‌فرضِ اندازهٔ قلم فقط سه مقدارِ شناخته‌شده می‌گیرد',
         setTypeScale('lg', false) === 'lg' && setTypeScale('md', false) === 'md' &&
         setTypeScale('xl', false) === 'md' && setTypeScale('', false) === 'md');
      ok('M3/زبانِ تأییدنشده جایِ زبانِ جاری نمی‌نشیند',
         setLang('en') === lang && setLang('fa') === 'fa');
      ok('M3/رشته‌های پوسته هیچ عددِ عبادی ندارند', (() => {
        const all = Object.keys(STRINGS.fa).map(k => STRINGS.fa[k]).join(' ');
        return !/[0-9۰-۹]/.test(all) && !/الله|سبحان|الحمد/.test(all);
      })());
    }catch(e){
      rows.push({ name: 'M3/سنجشِ درونی', ok: false, extra: e && e.message });
    }
    const pass = rows.filter(r => r.ok).length;
    return { total: rows.length, pass, ok: pass === rows.length, rows };
  }

  init();

  return {
    VERSION, STRINGS, BP, SCALES,
    lang: () => lang, setLang, t,
    esc, viewport, sizeOf, syncSize, onResize,
    motionOff, ripple,
    live, announce, screenLabel,
    progressbar, syncProgress,
    empty, error, loading, spinner, skeleton,
    setTypeScale, getTypeScale,
    init, selfTest
  };
})();

/* پیوندِ سراسری — همان الگوی بقیهٔ ماژول‌های برنامه. */
try{ if(typeof window !== 'undefined') window.M3 = M3; }catch(e){}

/* ═══════════ گسترشِ selfTest (الگوی salah-1.js) ═══════════
   نتیجهٔ سنجشِ M3 هم در کنسول و هم در «تنظیمات → selfTest» دیده می‌شود.
   پوشاندنِ `selfTest` تنها جایی است که این لایه به یک پیوندِ سراسریِ
   موجود دست می‌زند؛ آن هم با همان قراردادی که پیش‌تر گذاشته شده. */
(function extendSelfTest(){
  try{
    if(typeof selfTest !== 'function') return;
    const base = selfTest;
    const wrapped = function(){
      const res = base.apply(this, arguments);
      if(!res || !Array.isArray(res.rows)) return res;
      try{
        const mine = M3.selfTest();
        mine.rows.forEach(r => res.rows.push({
          name: 'selfTest/' + String(r.name).replace(/^M3\//, 'M3 — '), ok: !!r.ok, extra: r.extra
        }));
      }catch(e){
        res.rows.push({ name: 'selfTest/M3 — لایهٔ رفتار', ok: false, extra: e && e.message });
      }
      res.total = res.rows.length;
      res.pass = res.rows.filter(r => r.ok).length;
      res.ok = res.pass === res.total;
      return res;
    };
    selfTest = wrapped;                        // بازانتساب به همان پیوندِ سراسری
    try{ window.selfTest = wrapped; }catch(e){}
  }catch(e){}
})();

/* در محیطِ CommonJS (تستِ مستقلِ Node) هم قابلِ استفاده است. */
if(typeof module !== 'undefined' && module.exports){
  try{ module.exports = { M3 }; }catch(e){}
}
