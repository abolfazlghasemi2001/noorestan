/* ═══════════════════════════════════════════════════════════════════
   نورستان — نسخهٔ ۱۹ب: صحنِ روزانه + تنظیماتِ عبادت + قبله
   ═══════════════════════════════════════════════════════════════════
   تزِ UI: خانه «صحن» است، نه لانچرِ شلوغِ بازی و نه داشبوردِ اذان.
   یک کاروسلِ موبایل‌اول: سربرگِ امروز، نوارِ پنج نماز، رمضان و ذکر
   (اگر باشند)، مناسبت و میان‌برهای سه‌تایی. آیهٔ روز و مأموریت‌ها
   همان قهرمان‌های قبلیِ خانه‌اند و دست‌نخورده زیرِ صحن می‌مانند.

   این فایل *پس از* باندلِ اصلی و موتورِ اوقات بار می‌شود و به همان
   سبکِ بقیهٔ برنامه، خودش را به نقاطِ موجود وصل می‌کند:
   • renderHome() را می‌پوشاند تا صحن با هر بارِ خانه تازه شود؛
   • Me.render() را می‌پوشاند تا بخشِ «عبادتِ روزانه» در تنظیمات بنشیند؛
   • هیچ روتِ قدیمی را عوض نمی‌کند — #salah هم از راهِ همان
     واپس‌رویِ Router.init به خانه (صحن) می‌رسد، پس لینکِ قدیم کار می‌کند.

   همهٔ رنگ‌ها از توکن‌های پوسته‌اند (assets/styles/salah.css)؛ پس
   شب/اقیانوس/جنگل/سلطنتی/کویر/روشن، نماز را هم‌رنگِ خودشان می‌کنند.
   ═══════════════════════════════════════════════════════════════════ */

/* ── دفترچهٔ علامتِ نماز ──
   محلی، ساده و با سقف: هر نماز در هر روز یک بار ثبت می‌شود و جایزهٔ
   هر ثبت «خیلی کم» است (۱ سکه + ۳ تجربه) — یعنی حداکثر ۵ سکه در روز.
   علامتِ نماز قرار است عادت بسازد، نه اینکه اقتصادِ سکه را پُر کند. */
const SalahLog = {
  NAMES: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
  COIN: 1, XP: 3, DAILY_CAP: 5,
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
    try{ Courtyard.invalidateSig(); }catch(e){}
    /* جایزهٔ خیلی کم + سقفِ روزانه (۵ نماز ⇒ حداکثر ۵ سکه) */
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
    try{ Courtyard.invalidateSig(); }catch(e){}
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

  times(){ return Salah.times(new Date()); },

  /* محتوای صحن فقط با تغییرِ یکی از ورودی‌های واقعیِ آن ساخته می‌شود. */
  _buildSig(){
    const now = new Date();
    const loc = Store.get('loc') || {};
    let occ = null, ramadan = false, wird = null;
    try{ occ = noorOccasionFor(now); }catch(e){}
    try{ ramadan = typeof RamadanUI !== 'undefined' && !!RamadanUI.isRamadan(now); }catch(e){}
    try{
      if(typeof WirdUI !== 'undefined' && WirdUI.cardHtml){
        wird = [WirdUI.whichAt(now), WirdUI.doneCount()];
      }
    }catch(e){}
    return JSON.stringify({
      day: U.today(),
      city: this.cityLabel(),
      location: [loc.cityId || '', loc.source || '', loc.lat == null ? '' : loc.lat, loc.lon == null ? '' : loc.lon],
      method: Store.get('salahMethod') || 'jafari',
      adjustments: [Store.get('fajrAngle') || 18, Store.get('maghribOffsetMin') || 14, Store.get('ashaOffsetMin') || 90],
      occasion: occ ? [occ.title, occ.kind, occ.topic, !!occ.range, occ.label, occ.src] : null,
      ramadan,
      marks: SalahLog.count(),
      player: Store.get('playerName') || 'بازیکن',
      hasLoc: this.hasLoc(),
      wird
    });
  },

  invalidateSig(){
    const box = U.$('#salahCourt');
    if(box && box.dataset) delete box.dataset.scSig;
  },

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
          <button type="button" class="sc-citybtn" data-sc="city" aria-label="انتخابِ شهر برای اوقاتِ نماز">
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
    return `${U.fa(n)} از ${U.fa(5)} نمازِ امروز علامت خورده`;
  },

  prayersHtml(t, curName){
    return `
      <div class="sc-prayers" role="group" aria-label="نوارِ پنج نماز">
        ${Salah.NAMES.map(name => {
          const label = Salah.LABEL[name] || name;
          const isCur = name === curName;
          const done = SalahLog.marked(name);
          return `
          <button type="button" class="sc-prayer${isCur ? ' is-current' : ''}${done ? ' is-marked' : ''}"
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
    const go = occ.topic ? `<button type="button" class="btn gh sm sc-occ-go" data-sc="occ-quiz" data-topic="${U.esc(occ.topic)}">
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

  shortcutsHtml(){
    return `
      <div class="sc-short">
        <button type="button" data-sc-short="quran" aria-label="رفتن به تلاوت">${Icon.of('listen')}<span>تلاوت</span></button>
        <button type="button" data-sc-short="play" aria-label="رفتن به بازیِ امروز">${Icon.of('gamepad')}<span>بازیِ امروز</span></button>
        <button type="button" data-sc-short="online" aria-label="رفتن به محفل">${Icon.of('globe')}<span>محفل</span></button>
      </div>`;
  },

  /* کلِ صحن — هر بخشِ روزانه یک اسلایدِ مستقل در همان موتورِ کاروسلِ خانه است. */
  html(){
    const now = new Date();
    const t = this.times();
    const nx = Salah.next(now);
    const cur = Salah.current(now);
    this._curName = cur.name;
    const ramadan = (typeof RamadanUI !== 'undefined' && RamadanUI.cardHtml) ? RamadanUI.cardHtml(now, t) : '';
    const wird = (typeof WirdUI !== 'undefined' && WirdUI.cardHtml) ? WirdUI.cardHtml(now) : '';
    const occasion = this.occasionHtml(now);
    const slides = [
      `<article class="slide" role="group" aria-roledescription="اسلاید" aria-label="سربرگِ امروز">
        ${this.headerHtml(now, t, nx)}
      </article>`,
      `<article class="slide" role="group" aria-roledescription="اسلاید" aria-label="اوقاتِ نماز">
        <div class="sc-prayer-slide">
          <div class="sc-slide-heading"><b>اوقاتِ نماز</b><small>امروز</small></div>
          ${this.prayersHtml(t, cur.name)}
        </div>
      </article>`
    ];
    if(ramadan) slides.push(`<article class="slide" role="group" aria-roledescription="اسلاید" aria-label="رمضان — سحر و افطار">${ramadan}</article>`);
    if(wird) slides.push(`<article class="slide" role="group" aria-roledescription="اسلاید" aria-label="ذکرِ امروز">${wird}</article>`);
    if(occasion) slides.push(`<article class="slide" role="group" aria-roledescription="اسلاید" aria-label="مناسبتِ امروز">${occasion}</article>`);
    slides.push(`<article class="slide" role="group" aria-roledescription="اسلاید" aria-label="میان‌برها">
      <div class="sc-short-slide">
        <div class="sc-slide-heading"><b>دسترسیِ سریع</b><small>میان‌برها</small></div>
        ${this.shortcutsHtml()}
      </div>
    </article>`);

    const count = slides.length;
    const dots = slides.map((_, i) => `
      <button type="button" class="dot${i === 0 ? ' active' : ''}" data-i="${i}"
              aria-label="رفتن به اسلایدِ ${U.fa(i + 1)}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('');
    return `
      <div class="sc-wrap">
        <div id="scCarousel" class="category-carousel" role="group" aria-roledescription="کاروسل" aria-label="صحنِ روزانه">
          <div class="carousel-viewport">
            <div class="carousel-track">${slides.join('')}</div>
          </div>
          <button type="button" class="carousel-nav prev" aria-label="اسلاید قبلی">›</button>
          <button type="button" class="carousel-nav next" aria-label="اسلاید بعدی">‹</button>
          <div class="carousel-controls">
            <button type="button" class="carousel-toggle" aria-label="توقف چرخش خودکار" aria-pressed="false" title="توقف چرخش خودکار">${Icon.of('pause')}</button>
            <div class="carousel-dots" role="group" aria-label="انتخاب اسلاید">${dots}</div>
          </div>
          <p class="carousel-status" role="status" aria-live="polite">اسلایدِ ۱ از ${U.fa(count)}</p>
        </div>
      </div>`;
  },

  render(){
    const box = U.$('#salahCourt');
    if(!box) return;
    if(!this.enabled()){
      box.innerHTML = '';
      if(box.dataset) delete box.dataset.scSig;
      try{ initAllCarousels(); }catch(e){}
      return;
    }
    const sig = this._buildSig();
    const carousel = U.$('#scCarousel', box);
    if(box.dataset && box.dataset.scSig === sig && carousel && carousel.isConnected !== false){
      this.startClock();
      this.tick();
      return;
    }
    box.innerHTML = this.html();
    if(box.dataset) box.dataset.scSig = sig;
    try{ initAllCarousels(); }catch(e){}
    this.wire(box);
    this.startClock();
    this.tick();
  },

  wire(box){
    U.$$('[data-sp]', box).forEach(b => b.onclick = () => { Sound.click(); this.prayerModal(b.dataset.sp); });
    U.$$('[data-sc="city"]', box).forEach(b => b.onclick = () => this.cityPicker());
    U.$$('[data-sc-short]', box).forEach(b => b.onclick = () => {
      const to = b.dataset.scShort;
      Sound.page && Sound.page();
      if(to === 'play'){
        const pg = U.$('#pgBody'); if(pg) pg.innerHTML = '';
        Router.go('play');
        try{ Launcher.open(); }catch(e){}
      } else Router.go(to);
    });
    U.$$('[data-sc="occ-quiz"]', box).forEach(b => b.onclick = () => {
      const topic = b.dataset.topic;
      UI.closeModal && UI.closeModal();
      QuizPick.open([topic]);
    });
    try{ if(typeof WirdUI !== 'undefined' && WirdUI.wire) WirdUI.wire(box); }catch(e){}
    try{ if(typeof Adhan !== 'undefined' && Adhan.reschedule) Adhan.reschedule(); }catch(e){}
  },

  /* ساعتِ صحن: تیک‌های کوچک فقط متن‌ها، نوارِ پیشرفت و chip را patch می‌کنند؛
     تغییرِ نمازِ جاری فقط کلاس و aria-current را روی همان دکمه‌ها عوض می‌کند. */
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
    const box = U.$('#salahCourt');
    if(!box || !U.$('#scCarousel', box)) return;
    const now = new Date();
    const nx = Salah.next(now);
    const cur = Salah.current(now);
    const setText = (el, value) => { if(el && el.textContent !== value) el.textContent = value; };
    setText(U.$('#scNextIn', box), this.mmss(nx.inMs));
    setText(U.$('#scNextName', box), (Salah.LABEL[nx.name] || nx.name) + ' —');
    setText(U.$('#scNextAt', box), this.hhmm(nx.at));
    setText(U.$('#scMarks', box), this.marksChip());
    const p = Math.round(Salah.progress(now) * 100);
    const bar = U.$('#scNextBar', box);
    if(bar && bar.style.width !== p + '%') bar.style.width = p + '%';
    const bw = U.$('#scNextBarWrap', box);
    if(bw && bw.getAttribute && bw.getAttribute('aria-valuenow') !== String(p)) bw.setAttribute('aria-valuenow', String(p));
    if(cur.name !== this._curName){
      this._curName = cur.name;
      U.$$('[data-sp]', box).forEach(b => {
        const isCurrent = b.dataset.sp === cur.name;
        b.classList.toggle('is-current', isCurrent);
        if(isCurrent) b.setAttribute('aria-current', 'time');
        else b.removeAttribute('aria-current');
      });
    }
  },

  /* ── جزئیاتِ یک نماز + «علامت زدم» ── */
  prayerModal(name){
    const t = this.times();
    const label = Salah.LABEL[name] || name;
    const done = SalahLog.marked(name);
    const rows = [['فجر','fajr'],['طلوع','sunrise'],['ظهر','dhuhr'],['عصر','asr'],
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
    const cells = [['fajr','فجر'],['sunrise','طلوع'],['dhuhr','ظهر'],['asr','عصر'],
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

        <label class="lbl">نمایش</label>
        <div class="sc-set-row">
          <button class="btn ${onHome ? '' : 'gh'}" id="setSalahHome" style="flex:1">
            ${onHome ? '🕌 اوقات رویِ خانه: روشن' : '🕌 اوقات رویِ خانه: خاموش'}</button>
          <button class="btn gh" id="setSalahQibla" style="flex:1">${Icon.of('target')}<span>قبله</span></button>
        </div>
        <p style="font-size:11.5px;color:var(--mut);margin-top:8px">
          اوقات با الگوریتمِ نجومیِ مستند (PrayTimes) روی خودِ دستگاه حساب می‌شود —
          بی اینترنت هم درست است. برای دقتِ بیشتر، شهرت را انتخاب کن.</p>
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
      U.label(sh, v ? '🕌 اوقات رویِ خانه: روشن' : '🕌 اوقات رویِ خانه: خاموش');
      sh.classList.toggle('gh', !v);
      Courtyard.render();
    };
    const qb = U.$('#setSalahQibla'); if(qb) qb.onclick = () => Qibla.open();
  },

  applyMethod(id){
    if(!Salah.METHODS[id]) return;
    Store.update(d => { d.salahMethod = id; });
    this.refresh(true);
    Courtyard.render();
  },
  setFajrAngle(a){
    Store.update(d => { d.fajrAngle = (a === 15 ? 15 : 18); });
    this.refresh(true);
    Courtyard.render();
  },
  step(key, delta, lo, hi){
    const cur = Math.round(+Store.get(key)) || (key === 'maghribOffsetMin' ? 14 : 90);
    const v = U.clamp(cur + delta, lo, hi);
    Store.update(d => { d[key] = v; });
    this.refresh(true);
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
   نه روتِ تازه، نه حذفِ چیزی: renderHome و Me.render پوشانده می‌شوند
   تا صحن و تنظیمات سرِ جایِ خودشان بنشینند. */
(function attachSalahUI(){
  try{
    if(typeof renderHome === 'function' && !renderHome._salahWrapped){
      const _rh = renderHome;
      const wrapped = function(){
        const r = _rh.apply(this, arguments);
        try{ Courtyard.render(); }catch(e){ console.warn('courtyard', e); }
        return r;
      };
      wrapped._salahWrapped = true;
      renderHome = wrapped;
      try{ window.renderHome = wrapped; }catch(e){}
    }
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
