/* ═══════════════════════════════════════════════════════════════════
   نورستان — نسخهٔ ۲۱: صفحهٔ «عبادت» (بازطراحیِ کامل)
   ═══════════════════════════════════════════════════════════════════
   تزِ UI (نسخهٔ ۲۱): کاروسلِ نسخهٔ ۱۹د کنار رفت — به درخواستِ صاحبِ
   برنامه صفحه «نظم ندارد و جذاب نیست». عبادت حالا یک ستونِ عمودیِ
   منظم است، هم‌خانواده با بقیهٔ صفحه‌ها (سربرگِ بخش، کارتِ شیشه‌ای،
   خطِ زرّین):

   ۱) سربرگِ امروز: سلام + نام، تاریخِ شمسی و قمری، شهر، و تابلوی
      «اذانِ بعدی» با شمارشِ معکوسِ زنده و نوارِ پیشرفتِ بازه؛
   ۲) مناسبتِ امروز (فقط اگر هست)؛
   ۳) اوقاتِ امروز: سه ردیفِ نماز (صبح/ظهر/مغرب — «عشا» در نسخهٔ ۲۱
      مثلِ «عصر» از ستون رفت) با دکمهٔ «علامت زدم» روی هر ردیف، به‌علاوهٔ
      طلوع/غروب/نیمه‌شب؛
   ۴) کارتِ رمضان (فقط در ماهِ نهم)؛
   ۵) کارتِ قبله: درجه، جهت و فاصله تا مکه + دکمهٔ «قبله‌نمای زنده»؛
   ۶) ذکر و تعقیبات: زبانه‌های صبح/شام/پس‌ازنماز با متنِ کاملِ ادعیه
      (از پوششِ DUA_FULL)، تسبیح، میان‌برِ دعاها و ختم.

   اتصال‌ها مثلِ پیش است: `Router.hooks.ebadat`، پوششِ `Me.render` برای
   بخشِ «عبادتِ روزانه» در تنظیمات، و دکمهٔ `#ebQibla` در سربرگِ صفحه.
   همهٔ رنگ‌ها از توکن‌های پوسته‌اند (assets/styles/salah.css).
   ═══════════════════════════════════════════════════════════════════ */

/* ── دفترچهٔ علامتِ نماز ──
   محلی، ساده و با سقف: هر نماز در هر روز یک بار ثبت می‌شود و جایزهٔ
   هر ثبت «خیلی کم» است (۱ سکه + ۳ تجربه).
   فهرستِ نام‌ها از خودِ موتور می‌آید (`Salah.NAMES`): نسخهٔ ۱۹د «عصر»
   و نسخهٔ ۲۱ «عشا» را از آن ستون برداشتند، پس این‌جا هم سه نماز است و
   سقفِ روزانه هم همان سه می‌شود — بی آنکه عددی دستی تکرار شده باشد. */
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

/* ── صفحهٔ عبادت ── */
const Courtyard = {
  _clockId: null,
  _curName: '',

  /* آیکنِ هر نماز در ردیفِ اوقات — سحر/نیمروز/شامگاه */
  PRAYER_ICON: { fajr:'sparkle', dhuhr:'sun', maghrib:'moon' },
  PRAYER_SUB: { fajr:'اذانِ صبح', dhuhr:'اذانِ ظهر', maghrib:'اذانِ مغرب' },

  enabled(){
    const s = Store.get('settings') || {};
    return s.salahOnHome !== false;
  },

  hhmm(d){
    return U.fa(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
  },
  /* شمارشِ معکوس: زیرِ یک ساعت «دقیقه:ثانیه»، وگرنه «ساعت:دقیقه:ثانیه» */
  mmss(ms){
    ms = Math.max(0, +ms || 0);
    const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
    const body = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                       : `${m}:${String(s).padStart(2, '0')}`;
    return U.fa(body);
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

  /* رسم و تیکِ هرثانیه‌ای فقط وقتی معنا دارد که صفحهٔ عبادت باز باشد */
  open(){
    try{
      const el = U.$('#s-ebadat');
      return !!(el && el.classList && el.classList.contains('active'));
    }catch(e){ return false; }
  },

  times(){ return Salah.times(new Date()); },

  /* ── ۱. سربرگِ امروز + تابلوی اذانِ بعدی ── */
  headerHtml(now, t, nx){
    const name = Store.get('playerName') || 'بازیکن';
    const jal = U.jalali(+now);
    const hij = Hijri.formatFa(now);
    return `
      <div class="sc-hero">
        <div class="sc-hero-top">
          <div class="sc-hero-id">
            <div class="sc-hello">سلام،</div>
            <div class="sc-name">${U.esc(name)}</div>
            <div class="sc-dates">
              <span class="sc-chip">${Icon.of('calendar')}<span>${U.esc(jal)}</span></span>
              <span class="sc-chip">${Icon.of('moon')}<span>${U.esc(hij)}</span></span>
            </div>
          </div>
          <button class="sc-citybtn" data-sc="city" aria-label="انتخابِ شهر برای اوقاتِ نماز">
            ${Icon.of('city')} <span>${U.esc(this.cityLabel())}</span>
          </button>
        </div>
        ${this.hasLoc() ? '' : '<div class="sc-noloc">برای اوقاتِ دقیق، شهرت را انتخاب کن.</div>'}
        <div class="sc-next">
          <div class="sc-next-head">
            <span class="sc-next-label">اذانِ بعدی</span>
            <span class="sc-next-name" id="scNextName">—</span>
            <span class="sc-next-clock" id="scNextAt">${this.hhmm(nx.at)}</span>
          </div>
          <div class="sc-next-count" id="scNextIn" aria-live="off">—</div>
          <div class="sc-next-bar" role="progressbar" aria-label="زمان تا اذان بعدی"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="scNextBarWrap"><i id="scNextBar"></i></div>
          <div class="sc-marks-row">
            <div class="sc-segs" aria-hidden="true">${this.segsHtml()}</div>
            <div class="sc-count-chip" id="scMarks">${this.marksChip()}</div>
          </div>
        </div>
      </div>`;
  },

  marksChip(){
    const n = SalahLog.count();
    return `${U.fa(n)} از ${U.fa(SalahLog.NAMES.length)} نمازِ امروز علامت خورده`;
  },

  segsHtml(){
    return SalahLog.NAMES.map(name =>
      `<span class="seg${SalahLog.marked(name) ? ' done' : ''}" title="${U.esc(Salah.LABEL[name] || name)}"></span>`
    ).join('');
  },

  /* ── ۳. ردیف‌های نمازِ امروز + طلوع/غروب/نیمه‌شب ── */
  prayersHtml(t, curName){
    const rows = Salah.NAMES.map(name => {
      const label = Salah.LABEL[name] || name;
      const isCur = name === curName;
      const done = SalahLog.marked(name);
      const icon = this.PRAYER_ICON[name] || 'clock';
      const sub = this.PRAYER_SUB[name] || '';
      return `
      <div class="sc-prayer-row">
        <button class="sc-prayer${isCur ? ' is-current' : ''}${done ? ' is-marked' : ''}"
                data-sp="${name}" ${isCur ? 'aria-current="time"' : ''}
                aria-label="نمازِ ${label} — ${this.hhmm(t[name])}${done ? ' — علامت خورده' : ''}">
          <span class="sp-ic">${Icon.of(icon)}</span>
          <span class="sp-main">
            <span class="sp-name">${label}${isCur ? ' <span class="sp-badge">الآن</span>' : ''}</span>
            <span class="sp-sub">${sub}</span>
          </span>
          <span class="sp-time">${this.hhmm(t[name])}</span>
        </button>
        <button class="sp-mark${done ? ' done' : ''}" data-sp-mark="${name}"
                aria-pressed="${done ? 'true' : 'false'}"
                aria-label="${done ? 'برداشتنِ علامتِ نمازِ' : 'علامتِ نمازِ'} ${label}"
                title="${done ? 'علامت خورده — برای برداشتن بزن' : 'علامت زدم'}">${Icon.of('check')}</button>
      </div>`;
    }).join('');
    const subs = [
      ['sun', 'طلوعِ آفتاب', t.sunrise],
      ['moon', 'غروبِ آفتاب', t.sunset],
      ['star', 'نیمه‌شبِ شرعی', t.midnight]
    ].map(([ic, label, at]) => `
      <div class="sc-sub">${Icon.of(ic)}<span>${label}</span><b>${this.hhmm(at)}</b></div>`).join('');
    return `
      <div class="sc-times">
        <div class="sc-sec-head">
          <span class="sc-sec-title">${Icon.of('clock')} <b>اوقاتِ امروز</b></span>
          <small class="sc-sec-sub">${U.esc(this.cityLabel())}</small>
        </div>
        <div class="sc-prayers" role="group" aria-label="نمازهای امروز">
          ${rows}
        </div>
        <div class="sc-sub-times">${subs}</div>
      </div>`;
  },

  /* ── ۵. کارتِ قبله روی صفحه ──
     درجه و جهت و فاصله همین‌جا دیده می‌شود؛ «قبله‌نمای زنده» همان
     پنجرهٔ قطب‌نمای واقعی (`Qibla.open`) را باز می‌کند. */
  qiblaCardHtml(){
    let q = 0, dist = 0;
    try{
      const loc = Salah.resolveLoc(Store.get('loc'));
      q = Salah.qibla(loc.lat, loc.lon);
      dist = Qibla.distanceKm(loc.lat, loc.lon);
    }catch(e){}
    return `
      <div class="sc-qibla-card">
        <div class="sc-sec-head">
          <span class="sc-sec-title">${Icon.of('target')} <b>قبله</b></span>
          <small class="sc-sec-sub">${U.esc(this.cityLabel())}</small>
        </div>
        <div class="qb-mini-row">
          <div class="qb-mini-svg" aria-hidden="true">${Qibla.svgHtml(q, 'mini')}</div>
          <div class="qb-mini-info">
            <div class="qb-deg-big">${U.fa(Math.round(q))}°</div>
            <div class="qb-desc">به سمتِ ${U.esc(Qibla.describe(q))}</div>
            <div class="qb-dist">فاصله تا مکه: ${Qibla.fmtKm(dist)} کیلومتر</div>
          </div>
        </div>
        <button class="btn w" id="qbOpenPage">${Icon.of('target')}<span>قبله‌نمای زنده</span></button>
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

  /* کلِ عبادت — ستونِ عمودیِ بخش‌ها (نسخهٔ ۲۱: بی‌کاروسل) */
  html(){
    const now = new Date();
    const t = this.times();
    const nx = Salah.next(now);
    const cur = Salah.current(now);
    this._curName = cur.name;

    const ramadan = (typeof RamadanUI !== 'undefined' && RamadanUI.cardHtml) ? RamadanUI.cardHtml(now, t) : '';
    const wird = (typeof WirdUI !== 'undefined' && WirdUI.cardHtml) ? WirdUI.cardHtml(now) : '';
    const occ = this.occasionHtml(now);

    return `
      <div class="sc-wrap">
        ${this.headerHtml(now, t, nx)}
        ${occ}
        ${this.prayersHtml(t, cur.name)}
        ${ramadan}
        ${this.qiblaCardHtml()}
        ${wird}
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
    if(box.dataset.scSig === sig && box.innerHTML && box.innerHTML.includes('sc-hero')){
      this.tick();
      return;
    }

    box.dataset.scSig = sig;
    box.innerHTML = this.html();
    this.wire(box);
    this.startClock();
    this.tick();
  },

  wire(box){
    U.$$('[data-sp]', box).forEach(b => b.onclick = () => { try{ Sound.click(); }catch(e){} this.prayerModal(b.dataset.sp); });
    U.$$('[data-sp-mark]', box).forEach(b => b.onclick = (ev) => {
      try{ ev && ev.stopPropagation && ev.stopPropagation(); }catch(e){}
      const name = b.dataset.spMark;
      if(SalahLog.marked(name)){ SalahLog.unmark(name); UI.toast('علامت برداشته شد', '', 1400); }
      else SalahLog.mark(name);
      this.invalidateSig();
      this.render();
    });
    U.$$('[data-sc="city"]', box).forEach(b => b.onclick = () => this.cityPicker());
    U.$$('[data-sc="occ-quiz"]', box).forEach(b => b.onclick = () => {
      const topic = b.dataset.topic;
      UI.closeModal && UI.closeModal();
      QuizPick.open([topic]);
    });
    const qb = U.$('#qbOpenPage', box);
    if(qb) qb.onclick = () => { try{ Sound.click(); }catch(e){} Qibla.open(); };
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
  },

  /* ساعتِ عبادت: هر ثانیه فقط متنِ شمارش و نوار تازه می‌شود (نه کلِ DOM)؛
     وقتی نمازِ جاری عوض شود، فقط نشانگرِ is-current عوض می‌شود.
     تیک فقط وقتی می‌زند که صفحهٔ عبادت باز باشد. */
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
    const nm = U.$('#scNextName'); if(nm) nm.textContent = (Salah.LABEL[nx.name] || nx.name);
    const at = U.$('#scNextAt'); if(at) at.textContent = this.hhmm(nx.at);
    const p = Math.round(Salah.progress(now) * 100);
    const bar = U.$('#scNextBar'); if(bar) bar.style.width = p + '%';
    const bw = U.$('#scNextBarWrap'); if(bw && bw.setAttribute) bw.setAttribute('aria-valuenow', String(p));
    const chip = U.$('#scMarks'); if(chip) chip.textContent = this.marksChip();

    if(cur.name !== this._curName){
      this._curName = cur.name;
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
    /* نسخهٔ ۲۱: «عشا» هم مثلِ «عصر» از اوقاتِ نمایش‌داده‌شده رفت. */
    const rows = [['فجر','fajr'],['طلوع','sunrise'],['ظهر','dhuhr'],
                  ['غروب','sunset'],['مغرب','maghrib'],['نیمه‌شبِ شرعی','midnight']];
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

/* ── قبله‌نمای تمام‌صفحه (نسخهٔ ۲۲) ──
   خواستهٔ صاحبِ برنامه: «از برترین برنامه‌های جهانی الهام بگیر، و
   توضیحات و علامات پایینِ قبله‌نما حذف شود.» پس دو کار شد:

   الف) پایینِ صفحه رفت: نه پاراگرافِ راهنما، نه ردیفِ «جهتِ گوشی/دقت»،
      نه فهرستِ جهت‌های چهارگانه. هرچه لازم است روی خودِ ابزار دیده
      می‌شود: عددِ درجه در مغزِ قطب‌نما، وضعیتِ هم‌راستایی با رنگ و حلقه،
      و دو کلیدِ کوچکِ بالا (حسگر، حالتِ دستی).
   ب) خودِ ابزار واقعی شد — همان چیزهایی که در Muslim Pro / Athan /
      «Qibla Finder» هست و در قطب‌نمایِ قبلیِ ما نبود:
        • صفحه‌گردانِ ۳۶۰ درجه با شِکَبِ هر ۵ درجه و شماره‌گذاری هر ۳۰
        • صافیِ زاویه‌ای (میانگینِ دورانیِ نمایی) تا سوزن نلرزد
        • مخروطِ دقت روی صفحه‌گردان (از `webkitCompassAccuracy` یا
          برآوردِ ناپایداریِ خودِ داده)
        • کمانِ انحراف تا قبله + آستانهٔ ۵ درجه برای «پیدا شدی»
        • بازخوردِ لمسی و صوتی در لحظهٔ هم‌راستایی (بی‌سروصدا در حالتِ بی‌صدا)
        • کالیبراسیون: اگر داده ناپایدار بود یا دستگاه خودش خواست،
          انیمیشنِ «هشت‌خط» وسطِ صفحه می‌آید (متنِ پایین، نه!)
        • حالتِ دستی: اگر حسگری نبود یا کاربر بستش، با کشیدنِ انگشت روی
          حلقه جهتِ خودت را از شمالِ جغرافیایی می‌گیری و کعبه همان‌جا
          می‌نشیند — همان کاری که با قطب‌نمایِ کاغذی یا نقشه می‌کنی
        • بیدار ماندنِ صفحه تا زمانی که قبله‌نما باز است

   مرجعِ «بالا» لبهٔ فیزیکیِ بالای گوشی است، پس جبرانِ چرخشِ صفحه لازم
   نیست؛ اگر گوشی افقی باشد نشانگرِ تراز در نوارِ بالا روشن می‌شود.
   با `prefers-reduced-motion` چرخشِ نرم خاموش است و JS مستقیم می‌نویسد. */
const Qibla = {
  _open:false, _bound:false, _heading:null, _uselessSeen:false, _shown:null, _q:0, _acc:null, _dist:0,
  _oriCb:null, _waitTimer:null, _calTimer:null, _calAt:0,
  _aligned:false, _needCalib:false, _stable:0, _manual:false, _level:true,
  _tiltN:0, _tiltSum:0, _raf:null, _lastEv:0,

  /* ══ نگارهٔ کلاسیک — همان چیزی که کارتِ کوچکِ صفحه و سنجش‌ها می‌شناسند ══
     N بالا، E راست (قراردادِ نقشه). `ns` فضای‌نامِ شناسه‌هاست تا نگارهٔ
     کوچکِ روی صفحه و هر نسخهٔ دیگرِ هم‌زمان، شناسهٔ یکتا داشته باشند. */
  svgHtml(q, ns){
    ns = ns || '';
    q = this.deg(q);
    const id = s => ns + s;
    let ticks = '';
    for(let i = 0; i < 24; i++){
      const a = i * 15, major = i % 6 === 0, mid = i % 2 === 0;
      ticks += `<line class="qb-tick${major ? ' major' : ''}" x1="100" y1="12" x2="100" y2="${major ? 26 : (mid ? 21 : 18)}" transform="rotate(${a} 100 100)"/>`;
    }
    return `
      <svg class="qb-svg" viewBox="0 0 200 200" role="img" aria-label="قطب‌نمای قبله — ${Math.round(q)} درجه از شمال">
        <circle class="qb-face" cx="100" cy="100" r="92"/>
        <circle class="qb-ring" cx="100" cy="100" r="92"/>
        <g class="qb-rose" id="${id('qbRose')}">
          ${ticks}
          <text class="qb-cardinal n" x="100" y="42">ش</text>
          <text class="qb-cardinal" x="162" y="104">خ</text>
          <text class="qb-cardinal" x="100" y="168">ج</text>
          <text class="qb-cardinal" x="38" y="104">ب</text>
          <text class="qb-inter" x="141" y="63">ش‌خ</text>
          <text class="qb-inter" x="141" y="143">ج‌خ</text>
          <text class="qb-inter" x="59" y="143">ج‌ب</text>
          <text class="qb-inter" x="59" y="63">ش‌ب</text>
        </g>
        <g class="qb-dial" id="${id('qbDial')}" transform="rotate(${(+q).toFixed(1)} 100 100)">
          <line class="qb-tail" x1="100" y1="100" x2="100" y2="128"/>
          <line class="qb-needle" x1="100" y1="100" x2="100" y2="44"/>
          <rect class="qb-kaaba" x="92" y="30" width="16" height="16" rx="3"/>
        </g>
        <circle class="qb-hub" cx="100" cy="100" r="5"/>
      </svg>`;
  },

  /* ══ صفحه‌گردانِ تمام‌صفحه ══
     دو گروهِ چرخان: «rose» (جهت‌های جغرافیایی، با منهای جهتِ گوشی) و
     «kb» (کعبه، با فرقِ قبله و جهتِ گوشی). کمانِ انحراف بینِ این دو
     کشیده می‌شود؛ وقتی صفر شد همه‌چیز سبز است. */
  dialHtml(q){
    q = this.deg(q);
    const R = 148, A = [];
    for(let i = 0; i < 72; i++){
      const a = i * 5, major = i % 6 === 0, mid = i % 3 === 0;
      A.push(`<line class="qb-tick${major ? ' major' : (mid ? ' mid' : '')}" x1="160" y1="${160 - R}" x2="160" y2="${160 - R + (major ? 16 : (mid ? 10 : 6))}" transform="rotate(${a} 160 160)"/>`);
    }
    const NUMS = [[0, '۰'], [30, '۳۰'], [60, '۶۰'], [90, '۹۰'], [120, '۱۲۰'], [150, '۱۵۰'],
                  [180, '۱۸۰'], [210, '۲۱۰'], [240, '۲۴۰'], [270, '۲۷۰'], [300, '۳۰۰'], [330, '۳۳۰']];
    const nums = NUMS.map(([a, t]) => `<text class="qb-num" x="160" y="${160 - R + 30}" transform="rotate(${a} 160 160)">${t}</text>`).join('');
    const card = [[0, 'ش', 'n'], [90, 'خ', ''], [180, 'ج', ''], [270, 'ب', '']]
      .map(([a, t, cls]) => `<text class="qb-cardinal ${cls}" x="160" y="${160 - R + 50}" transform="rotate(${a} 160 160)">${t}</text>`).join('');
    return `
      <svg class="qb-svg qb-svg-lg" viewBox="0 0 320 320" role="img"
           aria-label="قطب‌نمای قبله — ${U.fa(Math.round(q))} درجه از شمالِ جغرافیایی">
        <defs>
          <radialGradient id="qbFaceG" cx="50%" cy="38%" r="72%">
            <stop offset="0" stop-color="rgba(255,255,255,.06)"/>
            <stop offset="1" stop-color="rgba(0,0,0,.16)"/>
          </radialGradient>
          <linearGradient id="qbArcG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--gold)"/><stop offset="1" stop-color="var(--grn)"/>
          </linearGradient>
        </defs>
        <circle class="qb-face2" cx="160" cy="160" r="${R + 14}"/>
        <circle cx="160" cy="160" r="${R + 14}" fill="url(#qbFaceG)"/>
        <circle class="qb-ring2" cx="160" cy="160" r="${R + 14}"/>
        <path class="qb-dev-arc" id="qbDevArc" d=""/>
        <g class="qb-rose" id="qbRose">
          <circle class="qb-rose-ring" cx="160" cy="160" r="${R}"/>
          ${A.join('')}${nums}${card}
        </g>
        <g class="qb-kb" id="qbKb" transform="rotate(${(+q).toFixed(1)} 160 160)">
          <path class="qb-wedge" d="M160 160 L148 ${160 - R + 16} L172 ${160 - R + 16} Z"/>
          <line class="qb-needle2" x1="160" y1="160" x2="160" y2="${160 - R + 22}"/>
          <g class="qb-kaaba2" transform="translate(160 ${160 - R + 6})">
            <rect x="-13" y="-13" width="26" height="26" rx="5"/>
            <path class="qb-band" d="M-13 -4h26"/>
          </g>
        </g>
        <path class="qb-idx" d="M160 8 l9 17h-18z"/>
        <circle class="qb-hub2" cx="160" cy="160" r="6"/>
      </svg>`;
  },

  /* فاصلهٔ هوایی تا کعبه (کیلومتر) — هاورساینِ استاندارد */
  distanceKm(lat, lon){
    try{
      const k = Salah.KAABA, R = 6371, t = Math.PI / 180;
      const la1 = (+lat) * t, la2 = k.lat * t;
      const dLa = (k.lat - (+lat)) * t, dLo = (k.lon - (+lon)) * t;
      const h = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
                Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
      const d = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
      return isFinite(d) ? d : 0;
    }catch(e){ return 0; }
  },
  fmtKm(km){
    const n = Math.max(0, Math.round(+km || 0));
    return U.fa(n.toLocaleString('en-US').replace(/,/g, '٬'));
  },
  /* توصیفِ فارسیِ جهت: شمالی، شمال‌شرقی، شرقی، … */
  describe(q){
    const dirs = ['شمالی', 'شمال‌شرقی', 'شرقی', 'جنوب‌شرقی', 'جنوبی', 'جنوب‌غربی', 'غربی', 'شمال‌غربی'];
    const i = Math.round((((+q % 360) + 360) % 360) / 45) % 8;
    return dirs[i] || '';
  },
  /* هر زاویه‌ای که از هر جایی می‌آید (دادهٔ خرابِ حسگر، locِ نصفه) باید
     عددِ ۰..۳۶۰ شود: `rotate(NaN …)` در SVG بی‌اعتبار است و حلقه از
     کار می‌افتد — صفر بهتر از حلقهٔ مُرده است. */
  deg(q){ q = +q; return isFinite(q) ? ((q % 360) + 360) % 360 : 0; },
  /* کوتاه‌ترین زاویهٔ signedِ دو جهت — برای «چقدر بچرخم» */
  delta(a, b){ return ((b - a + 540) % 360) - 180; },
  /* میانگینِ دورانیِ نمایی: ۳۵۹° و ۱° را «۱۸۰» نمی‌کند */
  ease(cur, target, k){
    if(cur == null || !isFinite(cur)) return target;
    const d = this.delta(cur, target);
    return ((cur + d * U.clamp(+k || .28, .02, 1) + 360) % 360);
  },

  open(){
    let loc;
    try{ loc = Salah.resolveLoc(Store.get('loc')); }
    catch(e){ loc = { lat:35.6892, lon:51.3890 }; }
    this.show(loc);
  },

  show(loc){
    loc = loc || (() => { try{ return Salah.resolveLoc(Store.get('loc')); }catch(e){ return { lat:35.6892, lon:51.3890 }; } })();
    const q = this.deg(Salah.qibla(loc.lat, loc.lon));
    this._q = q;
    this._dist = this.distanceKm(loc.lat, loc.lon);
    this._heading = null; this._shown = null; this._acc = null;
    this._aligned = false; this._needCalib = false; this._stable = 0; this._tiltSum = 0; this._tiltN = 0;
    this._uselessSeen = false;
    this._manual = !this.sensorAvail();
    this._open = true;
    UI.stage(this.stageHtml(q), box => this.mount(box));
  },
  /* ساختارِ صحنه از «نمایش» جداست: هارنسِ Node DOMِ واقعی ندارد، پس باید
     شد سنجید که پایینِ صفحهٔ قبله هیچ توضیحی و هیچ فهرستِ علامت ندارد. */
  stageHtml(q){
    const hasSensor = this.sensorAvail();
    return `
      <div class="qb-stage" id="qbStage" data-align="off">
        <div class="qb-sky" aria-hidden="true"><i></i><i></i><i></i><div class="qb-pat"></div></div>
        <header class="qb-bar">
          <button class="qb-ib" id="qbX" aria-label="بستنِ قبله‌نما">${Icon.of('close')}</button>
          <div class="qb-meta">
            <b>${U.fa(Math.round(q))}°</b>
            <span>${U.esc(Courtyard.cityLabel())} · ${U.fa(Math.round(this._dist))} کیلومتر تا مکه</span>
          </div>
          <div class="qb-tools">
            <button class="qb-ib" id="qbGeo" aria-label="موقعیتِ دقیقِ دستگاه برای قبله">${Icon.of('globe')}</button>
            <button class="qb-ib" id="qbManual" aria-pressed="${this._manual ? 'true' : 'false'}"
                    aria-label="حالتِ دستی — چرخاندنِ صفحه‌گردان با انگشت">${Icon.of('repeat')}</button>
            <button class="qb-ib" id="qbSensor" aria-pressed="false" ${hasSensor ? '' : 'disabled'}
                    aria-label="فعال‌سازیِ حسگرِ قطب‌نما">${Icon.of('sat')}</button>
          </div>
        </header>
        <div class="qb-chips">
          <span class="qb-chip" id="qbLv">${Icon.of('signal')}<b>تراز</b></span>
          <span class="qb-chip" id="qbAcc">${Icon.of('target')}<b>دقت: —</b></span>
          <span class="qb-chip" id="qbCalChip" hidden>${Icon.of('warn')}<b>هشت‌خط بچرخان</b></span>
        </div>
        <div class="qb-hold" id="qbHold">
          ${this.dialHtml(q)}
          <div class="qb-read" aria-live="polite">
            <b id="qbDelta">—</b>
            <small id="qbHint">جهتِ گوشی</small>
          </div>
          <div class="qb-calib" id="qbCalib" hidden aria-hidden="true">
            <svg viewBox="0 0 120 120"><path d="M60 30c22 0 22 30 0 30s-22 30 0 30 22 0 0 0 -22-30 0-30 22 0 0 0"/></svg>
            <span>هشت‌خط</span>
          </div>
        </div>
      </div>
    `;
  },

  mount(box){
    const on = (id, fn) => { const el = U.$(id, box); if(el) el.onclick = e => { try{ e && e.preventDefault && e.preventDefault(); }catch(err){} try{ fn(e); }catch(err){ console.warn('qibla', err); } }; };
    on('#qbX', () => this.close());
    on('#qbGeo', () => this.useGeo());
    on('#qbSensor', () => this.enableSensor());
    on('#qbManual', () => this.toggleManual());
    this.bind();
    this.drag(box);
    UI.onClose = () => this.shutdown();
    this.paint();
    if(!this._manual) this.enableSensor(true);
    try{ NoorWake.ask('qibla'); }catch(e){}
  },
  close(){ this._open = false; try{ UI.closeModal(); }catch(e){} this.shutdown(); },
  shutdown(){
    this._open = false;
    if(this._raf){ try{ cancelAnimationFrame(this._raf); }catch(e){} this._raf = null; }
    try{ if(this._waitTimer){ clearTimeout(this._waitTimer); this._waitTimer = null; } }catch(e){}
    this.unbind();
    this.hideCalib();
    try{ NoorWake.release('qibla'); }catch(e){}
  },

  sensorAvail(){
    try{
      return typeof window !== 'undefined' &&
        (('DeviceOrientationEvent' in window) || ('DeviceOrientationAbsoluteEvent' in window));
    }catch(e){ return false; }
  },
  /* یک‌بار شنونده می‌نشیند؛ شناسهٔ شنونده نگه داشته می‌شود تا با بستنِ
     صحنه برداشته شود (الگویِ نشتِ کلاسیک: پنجره بسته، شنونده روی صفحهٔ
     مرده مانده و با هر رویدادِ حسگر چیزی را نویشته می‌کند). */
  bind(){
    if(this._bound) return;
    if(!this.sensorAvail()) return;
    this._bound = true;
    const push = this._oriCb = e => { try{ this.onOri(e); }catch(err){} };
    try{ if(typeof NoorSensor !== 'undefined' && NoorSensor.watchOri) NoorSensor.watchOri(push); }
    catch(e){
      try{ window.addEventListener('deviceorientationabsolute', push); }catch(err){}
      try{ window.addEventListener('deviceorientation', push); }catch(err){}
    }
    /* اگر ۹ ثانیه هیچ رویدادِ مطلق نیاید، دستگاه یا حسگر ندارد یا
       کاربر باید اجازه بدهد — صفحهٔ بی‌حرکت نمی‌مانیم. */
    try{ this._waitTimer = setTimeout(() => { if(this._heading == null) this.flagCalib(); }, 9000); }catch(e){}
  },
  unbind(){
    if(!this._bound) return;
    this._bound = false;
    try{ if(typeof NoorSensor !== 'undefined' && NoorSensor.stopOri && this._oriCb) NoorSensor.stopOri(this._oriCb); }catch(e){}
    this._oriCb = null;
  },
  /* iOS: `webkitCompassHeading`؛ اندروید: آلفای *مطلق* (نسبی جهتِ
     واقعی نمی‌دهد و عمداً پذیرفته نمی‌شود، چون کاربر را گمراه می‌کند). */
  onOri(e){
    if(!this._open || !e) return;
    if(e.needCalib){ this.flagCalib(); return; }
    if(this._manual) return;
    let h = null, acc = null;
    if(e.webkitCompassHeading != null && isFinite(+e.webkitCompassHeading)){
      h = +e.webkitCompassHeading;
      if(isFinite(+e.webkitCompassAccuracy)) acc = +e.webkitCompassAccuracy;
    } else if(e.alpha != null && isFinite(+e.alpha) && (e.absolute === true || e.type === 'deviceorientationabsolute')){
      h = (360 - (+e.alpha)) % 360;
      if(isFinite(+e.beta)) this.tilt(+e.beta, +e.gamma);
    } else {
      /* آلفای نسبی جهتِ واقعی نمی‌دهد؛ یک‌بار همان را می‌گوییم و بعد
         سکوت — جایز نیست وسطِ چرخشِ گوشی پیام بیاید. */
      if(!this._uselessSeen){
        this._uselessSeen = true;
        try{ UI.toast('قطب‌نمایِ واقعی در این مرورگر نیست — از عددِ درجه یا حالتِ دستی استفاده کن', '', 3200); }catch(err){}
      }
      this.flagCalib(); return;
    }
    h = ((h % 360) + 360) % 360;
    this._acc = acc;
    this._lastEv = U.now();
    /* ناپایداری = کالیبراسیون لازم است؛ سه ثانیه دادهٔ نرم ⇒ تمام */
    if(this._heading != null){
      const jump = Math.abs(this.delta(this._heading, h));
      if(jump > 22){ this._stable = 0; this.flagCalib(); } else this._stable++;
    }
    this._heading = h;
    if(this._raf == null) this._raf = requestAnimationFrame(() => { this._raf = null; this.tick(); });
  },
  /* تراز: قطب‌نمایِ دیجیتال با کج‌شدنِ گوشی خطا می‌کند. بتا در حالتِ
     ایستادهٔ گوشی ≈ ±۹۰ است؛ هرچه از آن دورتر شویم کج‌تر هستیم. میانگینِ
     ۲۴ نمونهٔ اخیر گرفته می‌شود تا با یک لرزشِ دست هشدار نپرد. */
  tilt(beta, gamma){
    const off = Math.min(60, Math.abs(Math.abs(+beta) - 90) + (isFinite(+gamma) ? Math.abs(+gamma) : 0));
    this._tiltSum += off; this._tiltN++;
    if(this._tiltN < 24) return;
    const avg = this._tiltSum / this._tiltN;
    this._tiltN = 0; this._tiltSum = 0;
    const lv = avg < 22;
    if(lv === this._level) return;
    this._level = lv;
    const c = U.$('#qbLv');
    if(c){
      c.classList.toggle('bad', !lv);
      const b = c.querySelector('b');
      if(b) b.textContent = lv ? 'تراز' : 'گوشی را عمودیِ تخت بگیر';
    }
  },
  flagCalib(){
    const now = U.now();
    if(this._needCalib && now - (this._calAt || 0) < 1200) return;
    this._needCalib = true; this._calAt = now;
    const c = U.$('#qbCalChip'); if(c) c.hidden = false;
    const box = U.$('#qbCalib'); if(box) box.hidden = false;
    try{ if(this._calTimer) clearTimeout(this._calTimer); }catch(e){}
    try{ this._calTimer = setTimeout(() => { this.hideCalib(); }, 9000); }catch(e){}
  },
  hideCalib(){
    this._needCalib = false;
    try{ if(this._calTimer){ clearTimeout(this._calTimer); this._calTimer = null; } }catch(e){}
    const c = U.$('#qbCalChip'); if(c) c.hidden = true;
    const box = U.$('#qbCalib'); if(box) box.hidden = true;
  },
  /* نرم‌کردنِ زاویه با rAF — نه با هر نمونهٔ خام: روی گوشی‌هایی که ۱۰۰Hz
     رویداد می‌دهند، نوشتنِ DOM در هر نمونه صفحه را می‌خورد. */
  tick(){
    if(!this._open || this._heading == null) return;
    this._shown = this.ease(this._shown, this._heading, this._stable > 40 ? .5 : .22);
    this.paint();
    if(Math.abs(this.delta(this._shown, this._heading)) > 0.4 && this._raf == null){
      this._raf = requestAnimationFrame(() => { this._raf = null; this.tick(); });
    }
  },
  paint(){
    const rose = U.$('#qbRose'), kb = U.$('#qbKb');
    const head = this._manual ? (this._heading == null ? 0 : this._heading) : (this._shown == null ? 0 : this._shown);
    const d = this.delta(head, this._q);                  // + یعنی باید راست بچرخیم
    const aligned = this._heading != null && Math.abs(d) <= 5;
    if(rose) rose.setAttribute('transform', `rotate(${(-head).toFixed(1)} 160 160)`);
    if(kb) kb.setAttribute('transform', `rotate(${(+this._q - head).toFixed(1)} 160 160)`);
    const arc = U.$('#qbDevArc');
    if(arc) arc.setAttribute('d', aligned ? '' : this.arcPath(160, 160, 176, head, this._q));
    const dl = U.$('#qbDelta'), hint = U.$('#qbHint');
    if(dl) dl.textContent = this._heading == null ? '—' : (aligned ? '✓' : U.fa(Math.abs(Math.round(d))) + '°');
    if(hint) hint.textContent = this._heading == null
      ? (this._manual ? 'جهتِ گوشی را بچرخان' : 'در انتظارِ حسگر')
      : (aligned ? 'روبه‌روی قبله' : (d > 0 ? 'به راست بچرخ' : 'به چپ بچرخ'));
    const st = U.$('#qbStage');
    if(st && st.dataset) st.dataset.align = aligned ? 'on' : (this._heading == null ? 'off' : 'near');
    const ac = U.$('#qbAcc');
    if(ac){
      const acc = this._acc;
      const est = acc != null ? acc : (this._heading == null ? null : (this._stable > 60 ? 8 : 24));
      ac.querySelector('b') && (ac.querySelector('b').textContent = est == null ? 'دقت: —' : 'دقت: ±' + U.fa(Math.round(est)) + '°');
      ac.classList.toggle('good', est != null && est <= 12);
      ac.classList.toggle('bad', est != null && est > 20);
    }
    if(aligned && !this._aligned){
      this._aligned = true;
      try{ if((Store.get('settings') || {}).haptics !== false && navigator.vibrate) navigator.vibrate([18, 40, 22]); }catch(e){}
      try{ if((Store.get('settings') || {}).sound) Sound.rich(740, .18, .05); }catch(e){}
      this.hideCalib();
    } else if(!aligned) this._aligned = false;
  },
  /* کمانِ SVG بینِ دو زاویه — همان «چقدر مانده» روی لبهٔ بیرونی */
  arcPath(cx, cy, r, a0, a1){
    const A = (a) => { const t = (a - 90) * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
    let span = ((a1 - a0) % 360 + 360) % 360;
    if(span > 359.5) span = 359.5;
    const [x0, y0] = A(a0), [x1, y1] = A(a0 + span);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  },

  /* ══ حالتِ دستی ══ گوشی را که نمی‌توان به مغناطیس‌سنج اعتماد کرد، با
     انگشت روی حلقه جهتِ خودت را از شمال می‌گیری (از نقشه یا خورشید). */
  toggleManual(force){
    this._manual = (force == null) ? !this._manual : !!force;
    const b = U.$('#qbManual');
    if(b){ b.setAttribute('aria-pressed', this._manual ? 'true' : 'false'); b.classList.toggle('on', this._manual); }
    if(this._manual && this._heading == null) this._heading = 0;
    if(this._manual) this._shown = this._heading;
    const hint = U.$('#qbHint');
    if(hint) hint.textContent = this._manual ? 'حالتِ دستی — حلقه را بچرخان' : 'جهتِ گوشی';
    this.paint();
  },
  drag(box){
    const hold = U.$('#qbHold', box);
    if(!hold) return;
    const set = (ev) => {
      const t = (ev.touches && ev.touches[0]) || ev;
      const r = hold.getBoundingClientRect ? hold.getBoundingClientRect() : { left:0, top:0, width:320, height:320 };
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const a = (Math.atan2(t.clientX - cx, -(t.clientY - cy)) * 180 / Math.PI + 360) % 360;
      this._heading = a; this._shown = a; this._acc = null;
      this.paint();
    };
    let on = false;
    const down = ev => { if(!this._manual) return; on = true; try{ ev.preventDefault(); }catch(e){} set(ev); };
    const move = ev => { if(!on || !this._manual) return; try{ ev.preventDefault(); }catch(e){} set(ev); };
    const up = () => { on = false; };
    try{
      hold.addEventListener('touchstart', down, { passive:false });
      hold.addEventListener('touchmove', move, { passive:false });
      hold.addEventListener('touchend', up);
      hold.addEventListener('pointerdown', down);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }catch(e){}
  },

  /* حسگر — با اجازهٔ کاربر (iOS) و بی هیچ اصراری؛ اگر نشد همان عددِ
     درجه و حالتِ دستی کار می‌کند. */
  enableSensor(quiet){
    const go = ok => {
      const b = U.$('#qbSensor');
      if(b){
        b.setAttribute('aria-pressed', ok ? 'true' : 'false');
        b.classList.toggle('on', !!ok);
      }
      if(ok){
        if(this._manual) this.toggleManual(false);
        this.bind();
        if(!quiet) UI.toast('🧭 گوشی را تخت و بی‌حرکت نگه دار', 'ok', 2200);
      } else if(!quiet) UI.toast('حسگرِ قطب‌نما باز نشد — با حالتِ دستی (چرخاندنِ حلقه) هم قبله پیدا می‌شود', '', 3000);
    };
    if(typeof NoorSensor !== 'undefined' && NoorSensor.askOri) NoorSensor.askOri(() => go(true), () => go(false));
    else go(this.sensorAvail());
  },

  /* موقعیتِ دقیق برای قبله: یک‌بار، با درخواستِ صریحِ کاربر */
  useGeo(){
    if(!(typeof navigator !== 'undefined' && navigator.geolocation)){
      UI.toast('این مرورگر موقعیتِ دستگاه ندارد', 'err', 2400); return;
    }
    UI.toast('⏳ در حالِ گرفتنِ موقعیت…', '', 1800);
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = +pos.coords.latitude, lon = +pos.coords.longitude;
      if(!isFinite(lat) || !isFinite(lon)){ UI.toast('موقعیت خوانده نشد', 'err'); return; }
      Store.update(d => { d.loc = { cityId:'', lat:+lat.toFixed(4), lon:+lon.toFixed(4), source:'geo' }; });
      try{ Courtyard.invalidateSig && Courtyard.invalidateSig(); Courtyard.render(); }catch(e){}
      try{ SalahSettings.refresh(); }catch(e){}
      const q = Salah.qibla(lat, lon);
      this._q = q;
      this._dist = this.distanceKm(lat, lon);
      const meta = U.$('.qb-meta');
      if(meta){
        const b = meta.querySelector('b'), s = meta.querySelector('span');
        if(b) b.textContent = U.fa(Math.round(q)) + '°';
        if(s) s.textContent = 'موقعیتِ دستگاه · ' + U.fa(Math.round(this._dist)) + ' کیلومتر تا مکه';
      }
      this.paint();
      UI.toast('📍 قبله با موقعیتِ دقیقِ تو حساب شد', 'ok', 2200);
    }, () => {
      UI.toast('موقعیت گرفته نشد — همان شهرِ انتخابی حساب می‌شود', 'err', 2600);
    }, { timeout:8000, maximumAge:6e5 });
  },

}

/* ── تنظیماتِ عبادت — بخشِ «عبادتِ روزانه» در «من → تنظیمات» ── */
const SalahSettings = {
  methods(){ return ['jafari', 'mwl', 'ummqura', 'isna'].map(id => ({ id, name:Salah.METHODS[id].name, madhab:Salah.METHODS[id].madhab })); },

  previewHtml(){
    const t = Salah.times(new Date());
    /* نسخهٔ ۲۱: بی «عصر» و بی «عشا» — همان فهرستِ کارتِ هر نماز. */
    const cells = [['fajr','صبح'],['sunrise','طلوع'],['dhuhr','ظهر'],
                   ['sunset','غروب'],['maghrib','مغرب'],['midnight','نیمه‌شب']];
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
          «عصر» و «عشا» در این نسخه از اوقاتِ نمایش‌داده‌شده و از یادآورهای اذان
          برداشته شده‌اند.</p>
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
   نسخهٔ ۲۱: ستونِ عمودیِ بخش‌ها جای کاروسل نشست، ولی اتصال‌ها همان‌اند:
   قلابِ روتِ `ebadat`، دکمهٔ قبلهٔ سربرگ (`#ebQibla`) و تزریقِ بخشِ
   «عبادتِ روزانه» به تنظیمات از راهِ پوششِ `Me.render`. */
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
