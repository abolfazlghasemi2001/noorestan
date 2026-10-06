/* ═══════════════════════════════════════════════════════════════════
   نورستان — نسخهٔ ۱۹د: صفحهٔ «عبادت» + تنظیماتِ عبادت + قبله
   ═══════════════════════════════════════════════════════════════════
   تزِ UI (نسخهٔ ۱۹د): سه بخشِ بالاییِ صحنِ نسخهٔ ۱۹ب — سربرگِ امروز (نام،
   شمسی+قمری، شهر و نوارِ تا اذانِ بعدی)، اوقاتِ شرعیِ امروز و کارتِ ذکر و
   تعقیبات — از خانه برداشته شدند و یک صفحهٔ مستقلِ خودشان را دارند:
   «عبادت» (`#s-ebadat`، تبِ تازهٔ نوارِ پایین). خانه (صحن) با تصویر و
   خوش‌آمد و آیهٔ روز و دسته‌ها سرِ جایش است؛ نوارِ نماز هم چهار نماز
   دارد، چون «عصر» به درخواستِ صاحبِ برنامه برداشته شد.

   این فایل *پس از* باندلِ اصلی و موتورِ اوقات بار می‌شود و به همان
   سبکِ بقیهٔ برنامه، خودش را به نقاطِ موجود وصل می‌کند:
   • `Router.hooks.ebadat` را می‌نشاند تا هر بارِ ورود به صفحه، اوقات و
     ذکر و مناسبتِ امروز را تازه کند (بی پوشاندنِ هیچ تابعِ دیگری)؛
   • Me.render() را می‌پوشاند تا بخشِ «عبادتِ روزانه» در تنظیمات بنشیند؛
   • نشانی‌های قدیمیِ #salah و #wird در `ROUTE_ALIASES` باندلِ اصلی به
     همین صفحه نگاشت شده‌اند، پس میان‌برِ کارتِ نصب هم کار می‌کند.

   همهٔ رنگ‌ها از توکن‌های پوسته‌اند (assets/styles/salah.css)؛ پس
   شب/اقیانوس/جنگل/سلطنتی/کویر/روشن، عبادت را هم‌رنگِ خودشان می‌کنند.
   ═══════════════════════════════════════════════════════════════════ */

/* ── دفترچهٔ علامتِ نماز ──
   محلی، ساده و با سقف: هر نماز در هر روز یک بار ثبت می‌شود و جایزهٔ
   هر ثبت «خیلی کم» است (۱ سکه + ۳ تجربه) — یعنی حداکثر یک سکه به ازای
   هر نمازِ ستونِ عبادت در روز. علامتِ نماز قرار است عادت بسازد، نه
   اینکه اقتصادِ سکه را پُر کند.
   فهرستِ نام‌ها از خودِ موتور می‌آید (`Salah.NAMES`): نسخهٔ ۱۹د «عصر»
   را از آن ستون برداشته، پس این‌جا هم چهار نماز است و سقفِ روزانه هم
   همان چهار می‌شود — بی آنکه عددی دستی تکرار شده باشد. */
const SalahLog = {
  NAMES: Salah.NAMES,
  COIN: 1, XP: 3, DAILY_CAP: Salah.NAMES.length,
  today(){ return U.today(); },
  _log(){ const l = Store.get('salahLog'); return (l && typeof l === 'object' && !Array.isArray(l)) ? l : {}; },
  day(){ const v = this._log()[this.today()]; return Array.isArray(v) ? v : []; },
  marked(name){ return this.day().includes(name); },
  count(){ return this.day().length; },
  markedAll(){ return this.count() >= this.NAMES.length; },
  mark(name){
    if(!this.NAMES.includes(name)) return { ok:false, why:'bad' };
    const label = (Salah.LABEL && Salah.LABEL[name]) || name;
    if(this.marked(name)){
      UI.toast(`نمازِ ${label} پیش‌تر علامت خورده`, '', 1800);
      return { ok:false, dup:true };
    }
    const k = this.today();
    const log = this._log();
    const list = Array.isArray(log[k]) ? [...log[k]] : [];
    if(list.length >= this.DAILY_CAP){
      UI.toast('سقفِ علامتِ امروز پُر است', '', 1800);
      return { ok:false, cap:true };
    }
    list.push(name);
    log[k] = list;
    Store.set('salahLog', log);
    try{ Courtyard.invalidateSig && Courtyard.invalidateSig(); }catch(e){}
    /* جایزهٔ خیلی کم + سقفِ روزانه (به ازای هر نمازِ ستونِ عبادت یک سکه) */
    Wallet.earn(this.COIN, `نمازِ ${label}`);
    Store.update(d => { d.xp += this.XP; });
    try{ checkLevelUp(); }catch(e){}
    try{ Haptic.success(); }catch(e){}
    UI.toast(`✅ نمازِ ${label} علامت خورد`, 'ok', 2000);
    return { ok:true, total:list.length };
  },
  unmark(name){
    if(!this.NAMES.includes(name)) return false;
    const k = this.today();
    const log = this._log();
    const list = Array.isArray(log[k]) ? log[k].filter(n => n !== name) : [];
    if(list.length) log[k] = list; else delete log[k];
    Store.set('salahLog', log);
    try{ Courtyard.invalidateSig && Courtyard.invalidateSig(); }catch(e){}
    return true;
  }
};

/* ── صحنِ روزانه ── */
const Courtyard = {
  _clockId: null,
  _curName: '',

  enabled(){
    const s = Store.get('settings') || {};
    return s.salahOnHome !== false;
  },

  hhmm(d){
    return U.fa(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
  },
  mmss(ms){
    ms = Math.max(0, +ms || 0);
    const m = Math.floor(ms / 6e4), s = Math.floor((ms % 6e4) / 1e3);
    return U.fa(m + ':' + String(s).padStart(2, '0'));
  },

  _buildSig(){
    const day = U.today();
    const loc = Store.get('loc') || {};
    const city = loc.cityId || (loc.lat ? (loc.lat + ',' + loc.lon) : 'default');
    const method = Store.get('salahMethod') || 'jafari';
    const fajr = Store.get('fajrAngle') || 18;
    const maghrib = Store.get('maghribOffsetMin') || 14;
    const isha = Store.get('ashaOffsetMin') || 90;
    const marks = SalahLog.count();
    let occKey = '';
    try{ const o = noorOccasionFor(new Date()); occKey = o ? (o.title || '') : ''; }catch(e){}
    let ramadanKey = '';
    try{ ramadanKey = (typeof RamadanUI !== 'undefined' && RamadanUI.isRamadan(new Date())) ? '1' : '0'; }catch(e){}
    return `${day}|${city}|${method}|${fajr}|${maghrib}|${isha}|${marks}|${occKey}|${ramadanKey}`;
  },

  invalidateSig(){
    const box = U.$('#salahCourt');
    if(box) delete box.dataset.scSig;
  },

  /* نامِ شهرِ فعال — اگر loc نبود، تهران (بدونِ throw) */
  cityLabel(){
    try{
      const loc = Store.get('loc');
      if(loc && loc.cityId){
        const c = Salah.city(loc.cityId);
        if(c) return c.name;
      }
      if(loc && loc.source === 'geo') return 'موقعیتِ من';
    }catch(e){}
    return Salah.defaultCity().name;
  },

  hasLoc(){ try{ return !!Store.get('loc'); }catch(e){ return false; } },

  /* ── صفحهٔ عبادت: هست یا نه؟ ──
     کارت‌های اوقات حالا در صفحهٔ جداگانه‌ای زندگی می‌کنند، پس رسم و
     تیکِ هرثانیه‌ای فقط وقتی معنا دارد که همان صفحه باز باشد. در
     هارنسِ Node (DOMِ ساختگی) یا پیش از افزودنِ بخش به سند، «باز نیست»
     نتیجه می‌شود و کد بی‌خطا سرِ جایش می‌ماند. */
  open(){
    try{
      const el = U.$('#s-ebadat');
      return !!(el && el.classList && el.classList.contains('active'));
    }catch(e){ return false; }
  },

  /* ── اندازهٔ کاروسل: به اندازهٔ اسلایدِ فعال ──
     قابِ کاروسل به بلندترین اسلاید قفل می‌شد؛ یعنی سربرگ (کارتِ کوتاه)
     صدها پیکسل جای خالی زیرش داشت. حالا پیمانهٔ ارتفاع همان اسلایدی است
     که دیده می‌شود و با هر جابه‌جایی نرم عوض می‌شود (CSS گذارِ ارتفاع
     را دارد). کم‌حرکتی هم گذار را خاموش می‌کند، ولی اندازه درست
     می‌ماند. */
  fitCarousel(){
    try{
      const box = U.$('#salahCourt');
      if(!box) return;
      const car = U.$('#scCarousel', box);
      const vp = car && U.$('.carousel-viewport', car);
      if(!car || !vp || !vp.style) return;
      const act = U.$('.slide.is-active', car) || U.$('.slide', car);
      const h = act && (act.offsetHeight || act.getBoundingClientRect && Math.round(act.getBoundingClientRect().height));
      /* نوشتنِ فقط-در-تغییر: اگر مقدار همان باشد دست نمی‌زنیم. همین
         بی‌اثر‌بودنِ نوشتن است که حلقهٔ ناظر→اندازه→کلاس→ناظر را
         می‌بندد (اندازه‌گیریِ پشت‌سرهم با تغییرهای بی‌مورد). */
      const want = h > 0 ? Math.round(h) + 'px' : '';
      if(vp.style.height !== want) vp.style.height = want;
      const sized = car.classList.contains('sc-sized');
      if(sized !== (h > 0)) car.classList.toggle('sc-sized', h > 0);
    }catch(e){}
  },

  times(){ return Salah.times(new Date()); },

  headerHtml(now, t, nx){
    const name = Store.get('playerName') || 'بازیکن';
    const jal = U.jalali(+now);
    const hij = Hijri.formatFa(now);
    return `
      <div class="sc-head">
        <div class="sc-head-top">
          <div>
            <div class="sc-hello">سلام،</div>
            <div class="sc-name">${U.esc(name)}</div>
            <div class="sc-dates"><span>${U.esc(jal)}</span> • <span>${U.esc(hij)}</span></div>
          </div>
          <button class="sc-citybtn" data-sc="city" aria-label="انتخابِ شهر برای اوقاتِ نماز">
            ${Icon.of('city')} <span>${U.esc(this.cityLabel())}</span>
          </button>
        </div>
        ${this.hasLoc() ? '' : '<div class="sc-noloc">برای اوقاتِ دقیق، شهرت را انتخاب کن.</div>'}
        <div class="sc-next">
          <div class="sc-next-row">
            <span class="sc-next-name" id="scNextName">—</span>
            <span>اذانِ بعدی</span>
            <span class="sc-next-clock" id="scNextAt">${this.hhmm(nx.at)}</span>
            <span class="sc-next-count" id="scNextIn">—</span>
          </div>
          <div class="sc-next-bar" role="progressbar" aria-label="زمان تا اذان بعدی"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="scNextBarWrap"><i id="scNextBar"></i></div>
          <div class="sc-count-chip" id="scMarks">${this.marksChip()}</div>
        </div>
      </div>`;
  },

  marksChip(){
    const n = SalahLog.count();
    return `${U.fa(n)} از ${U.fa(SalahLog.NAMES.length)} نمازِ امروز علامت خورده`;
  },

  prayersHtml(t, curName){
    return `
      <div class="sc-prayers" role="group" aria-label="نوارِ نمازهای امروز">
        ${Salah.NAMES.map(name => {
          const label = Salah.LABEL[name] || name;
          const isCur = name === curName;
          const done = SalahLog.marked(name);
          return `
          <button class="sc-prayer${isCur ? ' is-current' : ''}${done ? ' is-marked' : ''}"
                  data-sp="${name}" ${isCur ? 'aria-current="time"' : ''}
                  aria-label="نمازِ ${label} — ${this.hhmm(t[name])}${done ? ' — علامت خورده' : ''}">
            ${done ? '<span class="sp-mark" aria-hidden="true">✓</span>' : ''}
            <span class="sp-name">${label}</span>
            <span class="sp-time">${this.hhmm(t[name])}</span>
          </button>`;
        }).join('')}
      </div>`;
  },

  occasionHtml(date){
    let occ = null;
    try{ occ = noorOccasionFor(date || new Date()); }catch(e){}
    if(!occ) return '';                       /* اگر مناسبت نیست، هیچ کارتی نیست */
    const go = occ.topic ? `<button class="btn gh sm sc-occ-go" data-sc="occ-quiz" data-topic="${U.esc(occ.topic)}">
        ${Icon.of('medal')}<span>آزمونِ ${U.esc(occ.topic)}</span></button>` : '';
    return `
      <div class="sc-occ ${occ.kind === 'mourning' ? 'mourning' : ''}" role="note" aria-label="مناسبتِ امروز">
        <div>
          <b>${U.esc(occ.title)}</b>
          ${occ.range ? `<span class="sc-occ-tag">${U.esc(occ.label || 'مشهور')}</span>` : ''}
          <small>${U.esc(occ.src || '')}</small>
        </div>
        ${go}
      </div>`;
  },

  /* کلِ عبادت — اسلایدهای کاروسلی */
  html(){
    const now = new Date();
    const t = this.times();
    const nx = Salah.next(now);
    const cur = Salah.current(now);
    this._curName = cur.name;

    const ramadan = (typeof RamadanUI !== 'undefined' && RamadanUI.cardHtml) ? RamadanUI.cardHtml(now, t) : '';
    const wird = (typeof WirdUI !== 'undefined' && WirdUI.cardHtml) ? WirdUI.cardHtml(now) : '';
    const occ = this.occasionHtml(now);

    const slides = [
      `<article class="slide sc-slide sc-head-slide" role="group" aria-label="سربرگ و اذان بعدی">
        ${this.headerHtml(now, t, nx)}
      </article>`,
      `<article class="slide sc-slide sc-prayer-slide" role="group" aria-label="اوقات نماز">
        <div class="sc-slide-head-row">
          <span class="sc-slide-title">${Icon.of('clock')} <b>اوقاتِ شرعیِ امروز</b></span>
          <small class="sc-slide-sub">${U.esc(this.cityLabel())}</small>
        </div>
        ${this.prayersHtml(t, cur.name)}
      </article>`
    ];

    if(ramadan){
      slides.push(`
        <article class="slide sc-slide sc-ramadan-slide" role="group" aria-label="رمضان — سحر و افطار">
          ${ramadan}
        </article>`);
    }

    if(wird){
      slides.push(`
        <article class="slide sc-slide sc-wird-slide" role="group" aria-label="ذکر و تعقیبات روز">
          ${wird}
        </article>`);
    }

    if(occ){
      slides.push(`
        <article class="slide sc-slide sc-occ-slide" role="group" aria-label="مناسبت امروز">
          ${occ}
        </article>`);
    }

    /* فاز ۲: اسلایدِ «میان‌برهای نورستان» برداشته شد. سه دکمهٔ آن به
       تلاوت/بازی/محفل می‌بردند — همان سه بخشی که تبِ پایین دارد. عبادت
       محتواست (اوقات، قبله، ذکر، مناسبت)، نه دروازهٔ دوم. */

    /* نسخهٔ ۱۹د: همین چند اسلاید از بالای صحن به این صفحه منتقل شدند.
       کاروسل دست‌نخورده مانده — فقط اندازه‌اش را `fitCarousel` به اندازهٔ
       اسلایدِ فعال می‌بندد تا زیرِ کارتِ کوتاه جای خالی نماند. */

    return `
      <div class="sc-wrap">
        <div class="category-carousel" id="scCarousel" role="group" aria-roledescription="کاروسل" aria-label="عبادت — اوقات نماز، ذکر و برنامه‌های امروز">
          <div class="carousel-viewport">
            <div class="carousel-track">
              ${slides.join('')}
            </div>
          </div>
          <button type="button" class="carousel-nav prev" aria-label="اسلاید قبلی">›</button>
          <button type="button" class="carousel-nav next" aria-label="اسلاید بعدی">‹</button>
          <div class="carousel-controls">
            <button type="button" class="carousel-toggle" aria-label="توقف چرخش خودکار" aria-pressed="false">${Icon.of('pause')}</button>
            <div class="carousel-dots" role="group" aria-label="انتخاب اسلاید"></div>
          </div>
          <p class="carousel-status" role="status" aria-live="polite"></p>
        </div>
      </div>`;
  },

  /* حالتِ خاموش: به‌جای جای خالی، یک کارتِ راهنما با دکمهٔ روشن‌کردن —
     کاربرِ تازه نباید پشتِ یک صفحهٔ خالی بماند. */
  offHtml(){
    return `
      <div class="card sc-off" role="note" aria-label="اوقاتِ نماز خاموش است">
        <b style="font-size:13px">${Icon.of('mosque')} اوقاتِ نماز خاموش است</b>
        <p style="font-size:12px;color:var(--mut);margin:8px 0 12px">
          اوقاتِ شرعی، اذانِ بعدی، قبله و ذکرهای روز در همین صفحه‌اند؛
          کافی است نمایششان را روشن کنی. هر وقت خواستی از
          «من → تنظیمات → عبادتِ روزانه» هم می‌شود خاموشش کرد.</p>
        <button class="btn w" id="scTurnOn">${Icon.of('check')}<span>روشنش کن</span></button>
      </div>`;
  },

  render(){
    const box = U.$('#salahCourt');
    if(!box) return;

    if(!this.enabled()){
      if(box.dataset.scSig !== 'off'){
        box.dataset.scSig = 'off';
        box.innerHTML = this.offHtml();
        this.wire(box);
      }
      return;
    }

    const sig = this._buildSig();
    if(box.dataset.scSig === sig && U.$('#scCarousel', box)){
      this.tick();
      this.fitCarousel();
      return;
    }

    box.dataset.scSig = sig;
    box.innerHTML = this.html();
    this.wire(box);
    try{ initAllCarousels(); }catch(e){}
    this.startClock();
    this.observeCarousel(box);
    this.tick();
    this.fitCarousel();
  },

  /* ── دیدنِ جابه‌جاییِ اسلاید و هم‌اندازه‌کردنِ قاب ──
     کنترل‌کنندهٔ کاروسل کلاسِ `is-active` را روی اسلاید می‌گرداند؛ همان
     یک تغییر برای ما نشانه است. یک ناظرِ کوچک روی زیردرختِ کاروسل
     می‌نشیند و ارتفاعِ قاب را با اسلایدِ تازه یکی می‌کند. ناظرِ پیشین
     (اگر بود) جدا می‌شود تا با هر بازترسیم، شنوندهٔ کهنه نماند.
     دو نگهبانِ حلقه: کلاسِ ریشه نادیده گرفته می‌شود (آن نشانِ خودِ
     `fitCarousel` است) و اندازه‌گیری به فریمِ بعد موکول می‌شود و فقط
     یک‌بار در هر فریم می‌افتد. */
  observeCarousel(box){
    try{
      if(this._fitObs){ try{ this._fitObs.disconnect(); }catch(e){} }
      this._fitObs = null;
      if(typeof MutationObserver !== 'function') return;
      const car = U.$('#scCarousel', box);
      if(!car) return;
      this._fitObs = new MutationObserver(recs => {
        /* کلاسِ ریشهٔ کاروسل نشانِ خودِ ماست؛ گوش‌دادن به آن حلقهٔ
           ناظر→اندازه→کلاس→ناظر می‌سازد. فقط جابه‌جاییِ اسلایدها (زیردرخت)
           ارزشِ اندازه‌گیری دارد. */
        if(recs.every(r => r.target === car)) return;
        /* هر نشانه فقط یک اندازه‌گیری در همان فریم می‌ارزد، نه یک
           آبشارِ ریزکارتی که صفحه را قفل کند. */
        if(this._fitPending) return;
        this._fitPending = true;
        const run = () => { this._fitPending = false; this.fitCarousel(); };
        if(typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
        else setTimeout(run, 16);
      });
      this._fitObs.observe(car, { attributes:true, attributeFilter:['class'], subtree:true });
    }catch(e){ this._fitObs = null; }
  },

  wire(box){
    U.$$('[data-sp]', box).forEach(b => b.onclick = () => { Sound.click(); this.prayerModal(b.dataset.sp); });
    U.$$('[data-sc="city"]', box).forEach(b => b.onclick = () => this.cityPicker());
    U.$$('[data-sc="occ-quiz"]', box).forEach(b => b.onclick = () => {
      const topic = b.dataset.topic;
      UI.closeModal && UI.closeModal();
      QuizPick.open([topic]);
    });
    const on = U.$('#scTurnOn', box);
    if(on) on.onclick = () => {
      Store.update(x => { x.settings.salahOnHome = true; });
      this.invalidateSig();
      this.render();
      try{ SalahSettings.refresh(true); }catch(e){}
      UI.toast('🕌 عبادت روشن شد', 'ok', 2000);
    };
    try{ if(typeof WirdUI !== 'undefined' && WirdUI.wire) WirdUI.wire(box); }catch(e){}
    try{ if(typeof Adhan !== 'undefined' && Adhan.reschedule) Adhan.reschedule(); }catch(e){}
    this.fitCarousel();
  },

  /* ساعتِ عبادت: هر ثانیه فقط متنِ شمارش و نوار تازه می‌شود (نه کلِ DOM)؛
     وقتی نمازِ جاری عوض شود، فقط نشانگرِ is-current عوض می‌شود.
     تیک فقط وقتی می‌زند که صفحهٔ عبادت باز باشد — محاسبهٔ نجومیِ هر
     ثانیه در صفحه‌های دیگر بی‌فایده است. */
  startClock(){
    if(this._clockId != null) return;
    try{
      this._clockId = Timers.every(() => {
        try{ this.tick(); }catch(e){ /* تایمرِ بی‌گیر هرگز نباید بمیرد */ }
      }, 1000, 'sys');
    }catch(e){}
  },

  tick(){
    if(!this.enabled()) return;
    if(!this.open()) return;
    const now = new Date();
    const nx = Salah.next(now);
    const cur = Salah.current(now);
    const inn = U.$('#scNextIn'); if(inn) inn.textContent = this.mmss(nx.inMs);
    const nm = U.$('#scNextName'); if(nm) nm.textContent = (Salah.LABEL[nx.name] || nx.name) + ' —';
    const at = U.$('#scNextAt'); if(at) at.textContent = this.hhmm(nx.at);
    const p = Math.round(Salah.progress(now) * 100);
    const bar = U.$('#scNextBar'); if(bar) bar.style.width = p + '%';
    const bw = U.$('#scNextBarWrap'); if(bw && bw.setAttribute) bw.setAttribute('aria-valuenow', String(p));
    const chip = U.$('#scMarks'); if(chip) chip.textContent = this.marksChip();

    if(cur.name !== this._curName){
      this._curName = cur.name;
      this.fitCarousel();
      const box = U.$('#salahCourt');
      if(box){
        U.$$('[data-sp]', box).forEach(btn => {
          const isCur = btn.dataset.sp === cur.name;
          btn.classList.toggle('is-current', isCur);
          if(isCur){
            btn.setAttribute('aria-current', 'time');
          } else {
            btn.removeAttribute('aria-current');
          }
        });
      }
    }
  },

  /* ── جزئیاتِ یک نماز + «علامت زدم» ── */
  prayerModal(name){
    const t = this.times();
    const label = Salah.LABEL[name] || name;
    const done = SalahLog.marked(name);
    /* نسخهٔ ۱۹د: «عصر» از اوقاتِ نمایش‌داده‌شده برداشته شد — همان‌طور که
       از ستونِ نمازها و یادآورهای اذان رفت. باقیِ اوقات دست‌نخورده‌اند. */
    const rows = [['فجر','fajr'],['طلوع','sunrise'],['ظهر','dhuhr'],
                  ['غروب','sunset'],['مغرب','maghrib'],['عشا','isha'],['نیمه‌شبِ شرعی','midnight']];
    UI.modal(`
      <h3 style="margin-bottom:4px">${Icon.of('clock')} نمازِ ${label}</h3>
      <p style="font-size:12px;color:var(--mut);margin-bottom:10px">
        ${U.esc(this.cityLabel())} • ${U.esc((Salah.METHODS[Store.get('salahMethod')] || {}).name || '')}
        • ${U.esc(Hijri.formatFa(new Date()))}</p>
      <div class="card" style="padding:10px">
        ${rows.map(([fa, k]) => `
          <div class="kv" ${k === name ? 'style="color:var(--gold)"' : ''}>
            <span>${fa}</span><b dir="ltr">${this.hhmm(t[k])}</b>
          </div>`).join('')}
      </div>
      <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn w" id="spMark">${done ? '✓ علامت خورده — برداشتن' : Icon.of('check') + '<span>علامت زدم</span>'}</button>
        <button class="btn gh" id="spQibla">${Icon.of('target')}<span>قبله</span></button>
      </div>
      <p style="font-size:11px;color:var(--mut);margin-top:8px">
        علامتِ نماز ${U.fa(SalahLog.COIN)} سکه و ${U.fa(SalahLog.XP)} تجربه می‌دهد — هر نماز در روز یک بار.</p>
    `, box => {
      const mk = U.$('#spMark', box);
      if(mk) mk.onclick = () => {
        if(SalahLog.marked(name)){ SalahLog.unmark(name); UI.toast('علامت برداشته شد', '', 1600); }
        else SalahLog.mark(name);
        UI.closeModal();
        this.invalidateSig();
        this.render();
      };
      const qb = U.$('#spQibla', box);
      if(qb) qb.onclick = () => Qibla.open();
    });
  },

  /* ── انتخابِ شهر ── */
  cityPicker(){
    const rows = NOOR_CITIES.map(c => `
      <button class="btn gh" data-city="${U.esc(c.id)}">${U.esc(c.name)}</button>`).join('');
    UI.modal(`
      <h3 style="margin-bottom:10px">${Icon.of('city')} شهرِ من</h3>
      <input class="inp" id="scCitySearch" placeholder="جستجوی شهر…" style="margin-bottom:10px">
      <button class="btn w" id="scGeo" style="margin-bottom:10px">${Icon.of('sat')}<span>موقعیتِ دستگاه (یک‌بار)</span></button>
      <div class="sc-citylist" id="scCityList">${rows}</div>
    `, box => {
      const search = U.$('#scCitySearch', box);
      const list = U.$('#scCityList', box);
      if(search && list) search.oninput = () => {
        const q = U.norm(search.value || '');
        U.$$('[data-city]', list).forEach(b => {
          const c = Salah.city(b.dataset.city);
          b.style.display = (!q || (c && U.norm(c.name).includes(q))) ? '' : 'none';
        });
      };
      const geo = U.$('#scGeo', box);
      if(geo) geo.onclick = () => { UI.closeModal(); this.useGeo(); };
      U.$$('[data-city]', box).forEach(b => b.onclick = () => {
        this.setCity(b.dataset.city);
        UI.closeModal();
      });
    });
  },

  setCity(id){
    const c = Salah.city(id);
    if(!c) return false;
    Store.update(d => { d.loc = { cityId:c.id, lat:c.lat, lon:c.lon, source:'city' }; });
    this.invalidateSig();
    this.render();
    try{ SalahSettings.refresh(); }catch(e){}
    UI.toast(`🕌 اوقات بر اساسِ ${c.name}`, 'ok', 2000);
    return true;
  },

  /* Geolocation فقط با درخواستِ صریحِ کاربر و فقط یک‌بار در هر ضربه —
     هیچ ردیابیِ پس‌زمینه‌ای در کار نیست. */
  useGeo(){
    if(!(typeof navigator !== 'undefined' && navigator.geolocation)){
      UI.toast('این مرورگر موقعیتِ دستگاه ندارد — شهرت را از فهرست انتخاب کن', 'err', 3200);
      return;
    }
    UI.toast('⏳ در حالِ گرفتنِ موقعیت…', '', 1800);
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = +pos.coords.latitude, lon = +pos.coords.longitude;
      if(!isFinite(lat) || !isFinite(lon)){ UI.toast('موقعیت خوانده نشد', 'err'); return; }
      Store.update(d => { d.loc = { cityId:'', lat:+lat.toFixed(4), lon:+lon.toFixed(4), source:'geo' }; });
      this.invalidateSig();
      this.render();
      try{ SalahSettings.refresh(); }catch(e){}
      UI.toast('📍 موقعیتت ذخیره شد — اوقات دقیق‌تر شد', 'ok', 2400);
    }, () => {
      UI.toast('موقعیت گرفته نشد — شهرت را دستی انتخاب کن', 'err', 3000);
    }, { timeout:8000, maximumAge:6e5 });
  }
};

/* ── قبله: SVG/CSS خالص، بدونِ کتابخانه ──
   دو حالت: اگر DeviceOrientation در دسترس بود، صفحهٔ قطب‌نما می‌چرخد و
   نشانگرِ کعبه سمتِ واقعی را می‌گوید؛ وگرنه سوزن روی درجهٔ محاسبه‌شده
   می‌نشیند و عدد + راهنمای فارسی نمایش داده می‌شود. با
   prefers-reduced-motion هیچ چرخشِ نرمی نیست (CSS انتقال را خاموش
   می‌کند و JS مستقیم می‌نویسد). */
const Qibla = {
  _bound:false, _open:false, _heading:null, _q:0,

  svgHtml(q){
    /* صفحهٔ قطب‌نما: N بالا، E راست (همان قراردادِ نقشه). درجهٔ قبله
       از شمال، ساعتگرد. */
    const ticks = Array.from({ length:12 }, (_, i) => {
      const a = i * 30;
      return `<line class="qb-tick" x1="100" y1="14" x2="100" y2="${i % 3 === 0 ? 24 : 19}" transform="rotate(${a} 100 100)"/>`;
    }).join('');
    return `
      <svg viewBox="0 0 200 200" role="img" aria-label="قطب‌نمای قبله — ${Math.round(q)} درجه از شمال">
        <circle class="qb-face" cx="100" cy="100" r="92"/>
        <circle class="qb-ring" cx="100" cy="100" r="92"/>
        ${ticks}
        <text class="qb-cardinal n" x="100" y="36">ش</text>
        <text class="qb-cardinal" x="164" y="102">خ</text>
        <text class="qb-cardinal" x="100" y="168">ج</text>
        <text class="qb-cardinal" x="36" y="102">ب</text>
        <g class="qb-dial" id="qbDial" transform="rotate(${q.toFixed(1)} 100 100)">
          <line class="qb-needle" x1="100" y1="100" x2="100" y2="46"/>
          <rect class="qb-kaaba" x="93" y="36" width="14" height="14" rx="3"/>
        </g>
        <circle cx="100" cy="100" r="5" fill="var(--mut)"/>
      </svg>`;
  },

  open(){
    const loc = Salah.resolveLoc(Store.get('loc'));
    const q = Salah.qibla(loc.lat, loc.lon);
    this._q = q; this._heading = null; this._open = true;
    UI.modal(`
      <h3 style="margin-bottom:4px">${Icon.of('target')} قبله</h3>
      <p style="font-size:12px;color:var(--mut);margin-bottom:8px">
        ${U.esc(Courtyard.cityLabel())} — <b class="qb-deg" id="qbDeg">${U.fa(Math.round(q))}°</b> از شمالِ جغرافیایی</p>
      <div class="sc-qibla" id="qbBox">
        ${this.svgHtml(q)}
        <div class="qb-hint" id="qbHint">گوشی را افقیِ دستِ‌نخورده نگه دار و لبهٔ بالایش را به سمتِ
          «ش» (بالای صفحه) بچرخان تا نشانگرِ طلاییِ کعبه سمتِ قبله را نشان دهد.
          ${this.sensorAvail() ? '' : 'این مرورگر قطب‌نمای دستگاه نمی‌دهد — عددِ درجه را با یک قطب‌نمای معمولی یا نقشهٔ محلّت مطابقت بده.'}</div>
        <div class="qb-actions">
          <button class="btn gh sm" id="qbSensor" ${this.sensorAvail() ? '' : 'hidden'}>
            ${Icon.of('sat')}<span>فعال‌سازیِ قطب‌نمای دستگاه</span></button>
          <button class="btn gh sm" id="qbClose">${Icon.of('close')}<span>بستن</span></button>
        </div>
      </div>`, box => {
      const btn = U.$('#qbSensor', box);
      if(btn) btn.onclick = () => this.enableSensor(btn);
      const cl = U.$('#qbClose', box);
      if(cl) cl.onclick = () => { this._open = false; UI.closeModal(); };
      this.bindOnce();
    });
  },

  sensorAvail(){
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  },

  /* یک شنوندهٔ دائمی (بدونِ نشت): فقط وقتی پنجرهٔ قبله باز است اثر
     می‌کند. روی iOS پیش از هر چیز باید با ژستِ کاربر اجازه گرفته شود. */
  bindOnce(){
    if(this._bound || !this.sensorAvail()) return;
    this._bound = true;
    try{
      window.addEventListener('deviceorientation', e => {
        try{
          if(!this._open) return;
          if(e.alpha == null && e.webkitCompassHeading == null) return;
          /* iOS جهتِ قطب‌نما را مستقیم می‌دهد؛ اندرویدِ absolute از آلفا
             ساخته می‌شود (۰ = شمال، پادساعتگرد → معکوسش می‌کنیم). */
          let h = e.webkitCompassHeading != null ? +e.webkitCompassHeading
                : (e.absolute ? 360 - e.alpha : null);
          if(h == null || !isFinite(h)) return;
          this._heading = ((h % 360) + 360) % 360;
          this.paint();
        }catch(err){}
      });
    }catch(e){}
  },

  async enableSensor(btn){
    try{
      const DOE = window.DeviceOrientationEvent;
      if(DOE && typeof DOE.requestPermission === 'function'){
        const r = await DOE.requestPermission();
        if(r !== 'granted'){ UI.toast('اجازهٔ قطب‌نما داده نشد — همان عددِ درجه کافی است', '', 2600); return; }
      }
      if(btn){ U.label ? U.label(btn, 'قطب‌نما روشن است') : null; btn.disabled = true; }
      UI.toast('🧭 گوشی را تخت و بی‌حرکت نگه دار — صفحه با چرخشِ تو جابه‌جا می‌شود', 'ok', 2400);
    }catch(e){
      UI.toast('قطب‌نمای دستگاه در دسترس نیست', 'err', 2400);
    }
  },

  paint(){
    const dial = U.$('#qbDial');
    if(dial && this._heading != null){
      /* صفحه خلافِ حرکتِ گوشی می‌چرخد تا «ش» همیشه شمالِ واقعی بماند؛
         نشانگرِ کعبه (که با q روی صفحه نشسته) سمتِ قبله را می‌گوید. */
      dial.setAttribute('transform', `rotate(${(this._q - this._heading).toFixed(1)} 100 100)`);
      const hint = U.$('#qbHint');
      if(hint){
        const delta = Math.round(((this._q - this._heading + 540) % 360) - 180);
        hint.textContent = delta === 0 ? '✅ روبه‌روی قبله‌ای'
          : `نشانگرِ کعبه را بگیر: ${U.fa(Math.abs(delta))}° به سمتِ ${delta > 0 ? 'راست' : 'چپ'}`;
      }
    }
  }
};

/* ── تنظیماتِ عبادت — بخشِ «عبادتِ روزانه» در «من → تنظیمات» ── */
const SalahSettings = {
  methods(){ return ['jafari', 'mwl', 'ummqura', 'isna'].map(id => ({ id, name:Salah.METHODS[id].name, madhab:Salah.METHODS[id].madhab })); },

  previewHtml(){
    const t = Salah.times(new Date());
    /* همان فهرستِ اوقاتِ کارتِ هر نماز — بی «عصر» (نسخهٔ ۱۹د). */
    const cells = [['fajr','فجر'],['sunrise','طلوع'],['dhuhr','ظهر'],
                   ['sunset','غروب'],['maghrib','مغرب'],['isha','عشا'],['midnight','نیمه‌شب']];
    return cells.map(([k, fa]) => `
      <div class="pv"><b>${Courtyard.hhmm(t[k])}</b>${fa}</div>`).join('');
  },

  cardHtml(){
    const d = Store.data || {};
    const m = d.salahMethod || 'jafari';
    const isJafari = m === 'jafari';
    const onHome = (Store.get('settings') || {}).salahOnHome !== false;
    return `
      <div class="card mt14" id="salahSetCard">
        <b style="font-size:13px">${Icon.of('clock')} عبادتِ روزانه</b>
        <div class="sep"></div>

        <label class="lbl">شهر / موقعیت</label>
        <div class="sc-set-row">
          <button class="btn gh" id="setSalahCity">${Icon.of('city')}<span>${U.esc(Courtyard.cityLabel())}</span></button>
          <button class="btn gh" id="setSalahGeo">${Icon.of('sat')}<span>موقعیتِ دستگاه (یک‌بار)</span></button>
        </div>

        <label class="lbl">مذهب</label>
        <div class="sc-set-row">
          <button class="btn ${isJafari ? '' : 'gh'}" id="setMadhabJafari" style="flex:1">جعفری (پیش‌فرض)</button>
          <button class="btn ${!isJafari ? '' : 'gh'}" id="setMadhabSunni" style="flex:1">اهلِ سنت</button>
        </div>

        <label class="lbl">روشِ محاسبه</label>
        <div class="sc-set-row">
          ${this.methods().map(x => `
            <button class="btn ${m === x.id ? '' : 'gh'} sm" data-salah-method="${x.id}" style="flex:1;min-width:120px;min-height:44px">${U.esc(x.name)}</button>`).join('')}
        </div>

        ${isJafari ? `
        <label class="lbl">زاویهٔ فجر</label>
        <div class="sc-set-row">
          <button class="btn ${+d.fajrAngle === 15 ? '' : 'gh'}" id="setFajr15" style="flex:1">۱۵°</button>
          <button class="btn ${+d.fajrAngle === 18 ? '' : 'gh'}" id="setFajr18" style="flex:1">۱۸° (پیش‌فرض)</button>
        </div>
        <label class="lbl">مغرب = غروب + … دقیقه (۱۲–۱۸)</label>
        <div class="sc-stepper">
          <button class="btn gh sm" id="setMaghribDown" aria-label="کم کردنِ دقیقهٔ مغرب">−</button>
          <span class="sv" id="setMaghribVal">${U.fa(d.maghribOffsetMin || 14)} دقیقه</span>
          <button class="btn gh sm" id="setMaghribUp" aria-label="افزودنِ دقیقهٔ مغرب">+</button>
        </div>
        <label class="lbl">عشا = مغرب + … دقیقه</label>
        <div class="sc-stepper">
          <button class="btn gh sm" id="setIshaDown" aria-label="کم کردنِ دقیقهٔ عشا">−</button>
          <span class="sv" id="setIshaVal">${U.fa(d.ashaOffsetMin || 90)} دقیقه</span>
          <button class="btn gh sm" id="setIshaUp" aria-label="افزودنِ دقیقهٔ عشا">+</button>
        </div>` : ''}

        <label class="lbl">پیش‌نمایشِ اوقاتِ امروز — ${U.esc(Courtyard.cityLabel())}</label>
        <div class="sc-set-preview" id="setSalahPreview">${this.previewHtml()}</div>

        <label class="lbl">نمایش در صفحهٔ عبادت</label>
        <div class="sc-set-row">
          <button class="btn ${onHome ? '' : 'gh'}" id="setSalahHome" style="flex:1">
            ${onHome ? '🕌 کارت‌های عبادت: روشن' : '🕌 کارت‌های عبادت: خاموش'}</button>
          <button class="btn gh" id="setSalahQibla" style="flex:1">${Icon.of('target')}<span>قبله</span></button>
        </div>
        <p style="font-size:11.5px;color:var(--mut);margin-top:8px">
          اوقات با الگوریتمِ نجومیِ مستند (PrayTimes) روی خودِ دستگاه حساب می‌شود —
          بی اینترنت هم درست است. برای دقتِ بیشتر، شهرت را انتخاب کن.
          «عصر» در این نسخه از اوقاتِ نمایش‌داده‌شده و از یادآورهای اذان
          برداشته شده است.</p>
      </div>`;
  },

  inject(){
    if(U.$('#salahSetCard')) return;
    const body = U.$('#meBody');
    if(!body || !body.appendChild) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = this.cardHtml();
    body.appendChild(wrap.firstElementChild || wrap);
    this.wire();
  },

  wire(){
    const city = U.$('#setSalahCity'); if(city) city.onclick = () => Courtyard.cityPicker();
    const geo = U.$('#setSalahGeo'); if(geo) geo.onclick = () => Courtyard.useGeo();
    const mj = U.$('#setMadhabJafari'); if(mj) mj.onclick = () => this.applyMethod('jafari');
    const ms = U.$('#setMadhabSunni'); if(ms) ms.onclick = () => this.applyMethod('mwl');
    U.$$('[data-salah-method]').forEach(b => b.onclick = () => this.applyMethod(b.dataset.salahMethod));
    const f15 = U.$('#setFajr15'); if(f15) f15.onclick = () => this.setFajrAngle(15);
    const f18 = U.$('#setFajr18'); if(f18) f18.onclick = () => this.setFajrAngle(18);
    const md = U.$('#setMaghribDown'); if(md) md.onclick = () => this.step('maghribOffsetMin', -1, 12, 18);
    const mu = U.$('#setMaghribUp'); if(mu) mu.onclick = () => this.step('maghribOffsetMin', +1, 12, 18);
    const id = U.$('#setIshaDown'); if(id) id.onclick = () => this.step('ashaOffsetMin', -5, 60, 120);
    const iu = U.$('#setIshaUp'); if(iu) iu.onclick = () => this.step('ashaOffsetMin', +5, 60, 120);
    const sh = U.$('#setSalahHome'); if(sh) sh.onclick = () => {
      const v = !((Store.get('settings') || {}).salahOnHome !== false);
      Store.update(x => { x.settings.salahOnHome = v; });
      U.label(sh, v ? '🕌 کارت‌های عبادت: روشن' : '🕌 کارت‌های عبادت: خاموش');
      sh.classList.toggle('gh', !v);
      Courtyard.render();
    };
    const qb = U.$('#setSalahQibla'); if(qb) qb.onclick = () => Qibla.open();
  },

  applyMethod(id){
    if(!Salah.METHODS[id]) return;
    Store.update(d => { d.salahMethod = id; });
    this.refresh(true);
    try{ Courtyard.invalidateSig && Courtyard.invalidateSig(); }catch(e){}
    Courtyard.render();
  },
  setFajrAngle(a){
    Store.update(d => { d.fajrAngle = (a === 15 ? 15 : 18); });
    this.refresh(true);
    try{ Courtyard.invalidateSig && Courtyard.invalidateSig(); }catch(e){}
    Courtyard.render();
  },
  step(key, delta, lo, hi){
    const cur = Math.round(+Store.get(key)) || (key === 'maghribOffsetMin' ? 14 : 90);
    const v = U.clamp(cur + delta, lo, hi);
    Store.update(d => { d[key] = v; });
    this.refresh(true);
    try{ Courtyard.invalidateSig && Courtyard.invalidateSig(); }catch(e){}
    Courtyard.render();
  },

  /* کارتِ تنظیمات را از نو می‌سازد (اگر باز است) — پیش‌نمایشِ اوقاتِ
     همان صفحه با هر تغییر تازه می‌شود. */
  refresh(rebuild){
    if(rebuild && U.$('#salahSetCard')){
      const old = U.$('#salahSetCard');
      const wrap = document.createElement('div');
      wrap.innerHTML = this.cardHtml();
      const fresh = wrap.firstElementChild || wrap;
      try{ old.replaceWith ? old.replaceWith(fresh) : (old.innerHTML = fresh.innerHTML || ''); }catch(e){}
      this.wire();
      return;
    }
    const pv = U.$('#setSalahPreview');
    if(pv) pv.innerHTML = this.previewHtml();
  }
};

/* ═══════════════ اتصال به برنامهٔ موجود ═══════════════
   نسخهٔ ۱۹د: کارت‌های عبادت از خانه به صفحهٔ خودشان (`#s-ebadat`) رفته‌اند،
   پس دیگر `renderHome` پوشانده نمی‌شود؛ به‌جایش یک قلابِ روتِ صریح
   (`Router.hooks.ebadat`) می‌نشیند که با هر بارِ ورود، اوقات و ذکر و
   مناسبتِ همان لحظه را می‌کشد. Me.render هم مثل پیش سرِ جایش می‌ماند تا
   بخشِ «عبادتِ روزانه» در تنظیمات بنشیند. */
(function attachSalahUI(){
  try{
    if(typeof Router === 'object' && Router.screens && Router.screens.ebadat === 's-ebadat'){
      /* باندلِ اصلی همین قلاب را می‌نشاند و این‌جا فقط پشتیبان است: اگر
         روزی ترتیبِ بارگذاری عوض شود یا `init()` دوباره صدا زده شود،
         قلاب باید سرِ جایش بماند. */
      if(typeof Router.hooks.ebadat !== 'function'){
        Router.hooks.ebadat = function(){
          try{ Courtyard.render(); }catch(e){ console.warn('courtyard', e); }
        };
      }
      /* اگر برنامه با همین نشانی باز شده باشد، Router.init پیش از بارشدنِ
         این فایل اجرا شده و قلاب را صدا نزده است؛ پس یک بار دستی می‌کشیم. */
      const cur = (Router.stack || [])[(Router.stack || []).length - 1];
      if(cur === 'ebadat'){ try{ Courtyard.render(); }catch(e){} }
    }
  }catch(e){}
  /* دکمهٔ قبله در سربرگِ همان صفحه (بیرونِ ظرفِ کارت‌ها) */
  try{
    const qb = U.$('#ebQibla');
    if(qb) qb.onclick = () => { try{ Sound.click(); }catch(e){} Qibla.open(); };
  }catch(e){}
  try{
    if(typeof Me === 'object' && typeof Me.render === 'function' && !Me.render._salahWrapped){
      const _me = Me.render;
      const wrapped = function(){
        const r = _me.apply(this, arguments);
        try{ if(this.tab === 'settings') SalahSettings.inject(); }catch(e){ console.warn('salah settings', e); }
        return r;
      };
      wrapped._salahWrapped = true;
      Me.render = wrapped;
    }
  }catch(e){}
})();
