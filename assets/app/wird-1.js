/* ═══════════════════════════════════════════════════════════════════
   نورستان — نسخهٔ ۱۹: همراهِ روزانه
   ═══════════════════════════════════════════════════════════════════
   لایهٔ سومِ صحن: بانک‌های ورد، کارتِ ذکر، تسبیحِ ۳۳/۳۳/۳۳، ختمِ
   محلی، کارتِ رمضان و اذانِ محلی (بدونِ سرور).

   دو قاعدهٔ سخت:
   ۱) هیچ متنِ عربی تازه‌ای از حافظه ساخته نمی‌شود — بانک‌های ورد فقط
      «ارجاع» به عنوان‌های DATA.duas (بانکِ دعا) هستند و همان شیءِ
      بانک برگردانده می‌شود؛ اگر عنوانی پیدا نشود، جایش خالی می‌ماند.
      میان‌برِ دعاها هم فقط همان‌هایی است که در بانک هست (کمیل،
      عاشورا، فرج، یونسیه، آیةالکرسی، تعقیبات) — هر دُعایی که در
      بانک نباشد، میان‌بری هم ندارد و هرگز از حافظه ساخته نمی‌شود.
   ۲) اذان «محلی» است: فقط وقتی برنامه زنده است برنامه‌ریزی می‌شود
      (setTimeout) — پوشِ سرور، service-worker push و Firebase هیچ‌کدام
      در کار نیستند و محدودیتش صریح در README آمده. صدای اذان هم
      فایلِ بیرونی نیست؛ یک زنگِ کوتاهِ WebAudio از خودِ Sound است و
      فقط پس از ژستِ کاربر (سیاستِ autoplay) پخش می‌شود.

   این فایل پس از courtyard-1.js بار می‌شود و مثلِ بقیهٔ برنامه خودش
   را وصل می‌کند: SalahSettings.inject برای کارتِ اذان، Qibla.open
   برای شمارِ مأموریت، و Missions.ensure/key برای مأموریت‌های تازه.
   ═══════════════════════════════════════════════════════════════════ */

/* ── بانک‌های ورد — فقط ارجاع به بانکِ دعا ── */
const WirdUI = {
  BANKS: {
    morning:     ['ذکر یونسیه', 'دعای سلامتی امام زمان', 'دعای فرج (عظم البلاء) — بند نخست'],
    evening:     ['دعای حضرت موسی (ع) — ربّ اشرح لی صدری', 'استغفار تعقیب نماز', 'دعای پدر و مادر'],
    afterPrayer: ['لا حول ولا قوّة إلا بالله', 'صلوات — تعقیب نماز', 'تسبیح تعقیب نماز']
  },
  LABEL: { morning:'ذکرِ صبح', evening:'ذکرِ شام', afterPrayer:'تعقیبِ پس از نماز' },

  /* ارجاع — همان شیءِ DATA.duas، نه کپی. پیدا نشد → null (خالی می‌ماند). */
  dua(substr){
    try{ return (DATA.duas || []).find(d => (d.title || '').includes(substr)) || null; }
    catch(e){ return null; }
  },
  bankItems(which){
    return (this.BANKS[which] || []).map(t => this.dua(t)).filter(Boolean);
  },
  /* میان‌برهای دعا — فقط آنچه بانک دارد */
  shortcuts(){
    return ['دعای کمیل', 'زیارت عاشورا', 'دعای فرج (عظم البلاء)', 'ذکر یونسیه', 'آیةالکرسی', 'تعقیب نماز']
      .map(q => ({ q, dua:this.dua(q) }))
      .filter(x => x.dua);
  },

  /* بانکِ کنونی بر پایهٔ ساعتِ نماز: پیش از ظهرِ شرعی → صبح، وگرنه شام */
  whichAt(now){
    now = now || new Date();
    try{
      const t = Salah.times(now);
      return (+now < +t.dhuhr) ? 'morning' : 'evening';
    }catch(e){
      return now.getHours() < 12 ? 'morning' : 'evening';
    }
  },

  _state(){
    const w = Store.get('wirdToday') || {};
    if(w.date !== U.today()) return { date:U.today(), done:{} };
    return { date:w.date, done:Object.assign({ morning:false, evening:false, afterPrayer:false }, w.done || {}) };
  },
  done(which){ return !!this._state().done[which]; },
  doneCount(){ const d = this._state().done; return ['morning','evening','afterPrayer'].filter(k => d[k]).length; },

  finish(which){
    if(!this.BANKS[which]) return { ok:false };
    const s = this._state();
    if(s.done[which]){ UI.toast('این ورد امروز انجام شده', '', 1600); return { ok:false, dup:true }; }
    s.done[which] = true;
    Store.set('wirdToday', s);
    /* خیلی کم: هر بانک یک بار در روز ⇒ سقفِ روزانهٔ ۳ سکه */
    Wallet.earn(1, 'وردِ ' + this.LABEL[which]);
    Store.update(d => { d.xp += 2; });
    try{ checkLevelUp(); }catch(e){}
    UI.toast('✅ ' + this.LABEL[which] + ' تمام شد', 'ok', 2000);
    return { ok:true };
  },

  /* ── کارتِ ذکر روی صحن (بینِ نوارِ نماز و مناسبت) ── */
  cardHtml(now){
    now = now || new Date();
    const which = this.whichAt(now);
    const items = this.bankItems(which);
    const done = this.done(which);
    const other = which === 'morning' ? 'evening' : 'morning';
    const sc = this.shortcuts();
    return `
      <div class="sc-wird" id="wirdCard">
        <div class="w-title">${Icon.of('medal')} ${this.LABEL[which]}
          ${done ? '<span class="chip wr" style="font-size:10px">✓ انجام شد</span>' : ''}</div>
        ${items.map((d, i) => `
          <details class="w-item" ${i === 0 ? 'open' : ''} data-wird="${which}" data-i="${i}">
            <summary>${U.esc(d.title)}</summary>
            <div class="w-ar">${U.esc(d.ar)}</div>
            <div class="w-fa">${U.esc(d.fa)}</div>
            <div class="w-src">${U.esc(d.src || '')}</div>
          </details>`).join('')}
        ${done ? '' : `<button class="btn gh sm" data-wird-finish="${which}">
            ${Icon.of('check')}<span>تمام کردم</span></button>`}
        <div class="sep"></div>
        ${Tasbih.html()}
        <div class="sep"></div>
        <div class="w-title" style="font-size:12px">${Icon.of('book-open')} میان‌برِ دعاها</div>
        <div class="sc-set-row" style="flex-wrap:wrap">
          ${sc.map(x => `<button class="btn gh sm" data-dua-open="${U.esc(x.q)}" style="min-height:44px">${U.esc(x.dua.title.split(' — ')[0])}</button>`).join('')}
          <button class="btn gh sm" data-wird-open="${other}" style="min-height:44px">${this.LABEL[other]}</button>
          <button class="btn gh sm" id="khatmOpen" style="min-height:44px">${Icon.of('listen')}<span>ختمِ قرآن</span></button>
        </div>
      </div>`;
  },

  open(which){
    const items = this.bankItems(which);
    if(!items.length){ UI.toast('بانکِ ورد خالی است', 'err'); return; }
    UI.modal(`
      <h3 style="margin-bottom:8px">${Icon.of('medal')} ${this.LABEL[which]}</h3>
      ${items.map(d => `
        <div class="card" style="padding:10px;margin-bottom:8px">
          <b style="font-size:12px">${U.esc(d.title)}</b>
          <div class="w-ar" style="margin-top:6px">${U.esc(d.ar)}</div>
          <div class="w-fa">${U.esc(d.fa)}</div>
          <div class="w-src">${U.esc(d.src || '')}</div>
        </div>`).join('')}
      ${this.done(which) ? '' : `<button class="btn w" data-wird-finish="${which}" style="width:100%">
          ${Icon.of('check')}<span>تمام کردم</span></button>`}
    `, box => {
      U.$$('[data-wird-finish]', box).forEach(b => b.onclick = () => {
        WirdUI.finish(b.dataset.wirdFinish);
        UI.closeModal();
        try{ Courtyard.render(); }catch(e){}
      });
    });
  },

  duaModal(substr){
    const d = this.dua(substr);
    if(!d){ UI.toast('این دعا در بانک نیست', 'err'); return; }
    UI.modal(`
      <h3 style="margin-bottom:8px">${Icon.of('medal')} ${U.esc(d.title)}</h3>
      <div class="w-ar" style="font-size:22px">${U.esc(d.ar)}</div>
      <div class="w-fa" style="margin-top:8px">${U.esc(d.fa)}</div>
      <div class="w-src" style="margin-top:8px">${U.esc(d.src || '')}</div>
    `, () => {});
  },

  wire(box){
    U.$$('[data-wird-finish]', box).forEach(b => b.onclick = () => {
      WirdUI.finish(b.dataset.wirdFinish);
      try{ Courtyard.render(); }catch(e){}
    });
    U.$$('[data-dua-open]', box).forEach(b => b.onclick = () => WirdUI.duaModal(b.dataset.duaOpen));
    U.$$('[data-wird-open]', box).forEach(b => b.onclick = () => WirdUI.open(b.dataset.wirdOpen));
    const kh = U.$('#khatmOpen', box); if(kh) kh.onclick = () => Khatm.modal();
    Tasbih.wire(box);
  }
};

/* ── تسبیحِ حضرتِ زهرا (س): ۳۳ / ۳۳ / ۳۳ ──
   ریست با U.today (مرزِ روزِ محلی — همان مرزی که بقیهٔ برنامه دارد).
   لرزش اختیاری است و فقط اگر haptics در تنظیمات روشن باشد. */
const Tasbih = {
  PHASES: [
    { label:'سبحان الله', goal:33 },
    { label:'الحمدلله', goal:33 },
    { label:'الله اکبر', goal:33 }
  ],
  COIN: 2,

  st(){
    const t = Store.get('tasbihToday') || {};
    if(t.date !== U.today()) return { date:U.today(), counts:[0, 0, 0], done:false };  /* تغییرِ روز ⇒ ریست */
    return { date:t.date, counts:Array.isArray(t.counts) ? t.counts.slice(0, 3) : [0, 0, 0], done:!!t.done };
  },
  phaseIndex(s){
    s = s || this.st();
    for(let i = 0; i < 3; i++) if(s.counts[i] < this.PHASES[i].goal) return i;
    return -1;
  },
  doneToday(){ const s = this.st(); return s.done && this.phaseIndex(s) === -1; },

  tap(){
    const s = this.st();
    const i = this.phaseIndex(s);
    if(i < 0){
      UI.toast('تسبیحِ امروز کامل است — آفرین', 'ok', 1800);
      return { ok:false, complete:true };
    }
    s.counts[i]++;
    const haptics = (Store.get('settings') || {}).haptics !== false;
    if(haptics && typeof navigator !== 'undefined' && navigator.vibrate){
      try{ navigator.vibrate(10); }catch(e){}
    }
    try{ Sound.click && Sound.click(); }catch(e){}
    let reward = 0;
    if(this.phaseIndex(s) === -1){
      s.done = true;
      Wallet.earn(this.COIN, 'تسبیحِ ۳۳/۳۳/۳۳');
      Store.update(d => { d.xp += 2; });
      try{ checkLevelUp(); }catch(e){}
      reward = this.COIN;
      UI.toast('📿 سبحان الله، الحمدلله، الله اکبر — تمام شد', 'ok', 2200);
    }
    Store.set('tasbihToday', s);
    this.paint();
    return { ok:true, phase:i, counts:s.counts, reward };
  },
  reset(){
    Store.set('tasbihToday', { date:U.today(), counts:[0, 0, 0], done:false });
    this.paint();
  },

  html(){
    const s = this.st();
    const i = this.phaseIndex(s);
    const cur = i >= 0 ? this.PHASES[i] : null;
    return `
      <div class="sc-tasbih" id="tasbihBox">
        <button class="tb-btn" id="tbTap" aria-label="شمارِ تسبیح — ${cur ? U.esc(cur.label) : 'کامل'}">
          <span>${cur ? U.esc(cur.label) : '✅ کامل'}</span>
          <span class="tb-count" id="tbCount">${cur ? U.fa(s.counts[i]) + '/' + U.fa(cur.goal) : U.fa(99) + '/' + U.fa(99)}</span>
        </button>
        <div class="tb-side">
          ${this.PHASES.map((p, k) => `
            <span id="tbP${k}" ${k === i ? 'style="color:var(--gold)"' : ''}>${U.esc(p.label)}: ${U.fa(s.counts[k])}/${U.fa(p.goal)}</span>`).join('')}
          <button class="btn gh sm" id="tbReset" aria-label="ریستِ تسبیح">${Icon.of('close')}<span>ریست</span></button>
        </div>
      </div>`;
  },
  paint(){
    /* فقط عددها و برچسبِ فاز تازه می‌شوند — نه کلِ کارت */
    const s = this.st();
    const i = this.phaseIndex(s);
    const tap = U.$('#tbTap');
    if(tap){
      const cur = i >= 0 ? this.PHASES[i] : null;
      tap.innerHTML = `<span>${cur ? U.esc(cur.label) : '✅ کامل'}</span>
        <span class="tb-count" id="tbCount">${cur ? U.fa(s.counts[i]) + '/' + U.fa(cur.goal) : U.fa(99) + '/' + U.fa(99)}</span>`;
      tap.setAttribute && tap.setAttribute('aria-label', 'شمارِ تسبیح — ' + (cur ? cur.label : 'کامل'));
    }
    this.PHASES.forEach((p, k) => {
      const el = U.$('#tbP' + k);
      if(el) el.textContent = `${p.label}: ${U.fa(s.counts[k])}/${U.fa(p.goal)}`;
    });
  },
  wire(box){
    const tap = U.$('#tbTap', box);
    if(tap) tap.onclick = () => Tasbih.tap();
    const rs = U.$('#tbReset', box);
    if(rs) rs.onclick = () => { Tasbih.reset(); UI.toast('تسبیح ریست شد', '', 1400); };
  }
};

/* ── ختمِ محلی: هدفِ روزانهٔ صفحه/سوره، وصل به مصحف‌نما ──
   ساده و محلی — هیچ ختمِ سروری ساخته نشد. صفحه‌بندی تقریبیِ مصحفِ
   متداول (۶۰۴ صفحه / ۶۲۳۶ آیه) است و همین در UI هم گفته می‌شود. */
const Khatm = {
  TOTAL_AYAH: 6236, TOTAL_PAGES: 604,

  state(){
    const k = Store.get('khatm') || {};
    return { page:U.clamp(Math.floor(+k.page) || 1, 1, 604), month:(k.month || '').slice(0, 7), stamp:(k.stamp || '') };
  },
  doneToday(){ return this.state().stamp === U.today(); },

  /* صفحه → سوره/آیه (تقریبِ مصحفِ متداول) */
  locate(page){
    page = U.clamp(Math.floor(+page) || 1, 1, this.TOTAL_PAGES);
    const idx = Math.round((page - 1) * this.TOTAL_AYAH / this.TOTAL_PAGES);
    let left = idx;
    for(let s = 0; s < QURAN.length; s++){
      if(left < QURAN[s].count) return { s:s + 1, a:left + 1 };
      left -= QURAN[s].count;
    }
    return { s:114, a:QURAN[113].count };
  },

  /* «خواندم/انجام دادم» — مهرِ امروز + جایزهٔ یک‌بار در روز */
  mark(openReader){
    const done = this.doneToday();
    const st = this.state();
    Store.update(d => { d.khatm = Object.assign({}, d.khatm, { stamp:U.today() }); });
    if(!done){
      Wallet.earn(1, 'ختمِ قرآن — صفحهٔ امروز');
      Store.update(d => { d.xp += 3; });
      try{ checkLevelUp(); }catch(e){}
      UI.toast('✅ صفحهٔ امروزِ ختم ثبت شد', 'ok', 2000);
    } else {
      UI.toast('ختمِ امروز پیش‌تر ثبت شده', '', 1600);
    }
    if(openReader !== false){
      try{
        const bm = Store.get('bookmarks') || [];
        const last = Array.isArray(bm) && bm.length ? bm[bm.length - 1] : null;
        const at = last ? { s:+last.s || 1, a:+last.a || 1 } : this.locate(st.page);
        Router.go('read');
        ReaderUI.open(at.s, at.a);
      }catch(e){}
    }
    return !done;
  },

  setPage(p){
    p = U.clamp(Math.floor(+p) || 1, 1, this.TOTAL_PAGES);
    Store.update(d => { d.khatm = Object.assign({}, d.khatm, { page:p, month:U.today().slice(0, 7), stamp:'' }); });
  },

  modal(){
    const st = this.state();
    const at = this.locate(st.page);
    const sur = QURAN[at.s - 1];
    UI.modal(`
      <h3 style="margin-bottom:4px">${Icon.of('listen')} ختمِ قرآن (محلی)</h3>
      <p style="font-size:12px;color:var(--mut);margin-bottom:10px">
        هدفِ روزانه: یک صفحه — ${U.fa(st.page)} از ${U.fa(604)}
        (تقریباً سورهٔ ${U.esc(sur.name)} آیهٔ ${U.fa(at.a)}). مهرِ ختم فقط روی
        همین دستگاه است؛ سروری در کار نیست.</p>
      <div class="sc-stepper">
        <button class="btn gh sm" id="khDown" aria-label="صفحهٔ قبل">−</button>
        <span class="sv" id="khVal">${U.fa(st.page)}</span>
        <button class="btn gh sm" id="khUp" aria-label="صفحهٔ بعد">+</button>
      </div>
      <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn w" id="khMark" style="flex:1">${Icon.of('check')}<span>خواندم — ثبتِ امروز</span></button>
        <button class="btn gh" id="khRead" style="flex:1">${Icon.of('book-open')}<span>بازکردنِ مصحف‌نما</span></button>
      </div>
      ${st.stamp ? `<p style="font-size:11px;color:var(--mut);margin-top:8px">آخرین ثبت: ${U.esc(st.stamp)}${this.doneToday() ? ' (امروز)' : ''}</p>` : ''}
    `, box => {
      const paint = () => { const v = U.$('#khVal', box); if(v) v.textContent = U.fa(Khatm.state().page); };
      const dn = U.$('#khDown', box); if(dn) dn.onclick = () => { Khatm.setPage(Khatm.state().page - 1); paint(); };
      const up = U.$('#khUp', box); if(up) up.onclick = () => { Khatm.setPage(Khatm.state().page + 1); paint(); };
      const mk = U.$('#khMark', box); if(mk) mk.onclick = () => { Khatm.mark(true); UI.closeModal(); try{ Courtyard.render(); }catch(e){} };
      const rd = U.$('#khRead', box); if(rd) rd.onclick = () => { UI.closeModal(); Khatm.mark(false); };
    });
  }
};

/* ── رمضان: فقط در ماهِ ۹ قمری ──
   کارتِ سحر/افطار بالایِ نوارِ نماز می‌نشیند و با پایانِ ماه ناپدید
   می‌شود؛ دو مأموریتِ ویژه هم فقط در رمضان به استخر اضافه می‌شوند. */
const RamadanUI = {
  isRamadan(date){
    date = date || new Date();
    try{ return Hijri.fromGregorian(date).hm === 9; }
    catch(e){ return false; }
  },

  cardHtml(now, times){
    now = now || new Date();
    if(!this.isRamadan(now)) return '';          /* بیرونِ رمضان: هیچ کارتی نیست */
    const t = times || Salah.times(now);
    const hij = Hijri.formatFa(now);
    const sahri = (() => {                        /* ذکرِ سحر — از همان بانکِ دعا */
      const d = WirdUI.dua('دعای سلامتی امام زمان');
      return d ? `<div class="rm-dua"><b>ذکرِ سحر (از بانکِ دعا):</b><br>${U.esc(d.title)} — ${U.esc(d.fa)}<br><small>${U.esc(d.src || '')}</small></div>` : '';
    })();
    const fasted = SalahLog.marked('maghrib');
    return `
      <div class="sc-ramadan" role="note" aria-label="رمضان — سحر و افطار">
        <div class="rm-top">🌙 <b>رمضانِ مبارک</b> <span style="font-size:11px;color:var(--mut)">${U.esc(hij)}</span></div>
        <div class="rm-times">
          <span>سحر تا اذانِ صبح: <b>${Courtyard.hhmm(t.fajr)}</b></span>
          <span>افطار (مغربِ جعفری): <b>${Courtyard.hhmm(t.maghrib)}</b></span>
        </div>
        ${sahri}
        ${fasted ? '<div style="font-size:11.5px;color:var(--grn)">✓ افطارِ امروز (نمازِ مغرب) علامت خورده</div>' : ''}
      </div>`;
  }
};

/* ── اذانِ محلی (بدونِ سرور) ──
   برنامه‌ریزی با setTimeout روی هدفِ بعدیِ Salah.next؛ هنگامِ پخش:
   Notification اگر اجازه داده شده باشد، وگرنه toast + زنگِ WebAudio
   (از خودِ Sound، بدونِ فایلِ بیرونی). در محفل/بازیِ تمام‌صفحه و
   وقتی پنجره‌ای باز است، سکوت می‌کند. محدودیتِ PWA (یادآور فقط با
   برگِ زنده) صریح در README آمده. */
const Adhan = {
  _timer:null, _firedStamp:'', _retry:0,
  CHIME: [523.25, 659.25, 783.99],     /* زنگِ سه‌نتی — WebAudioِ داخلی */

  cfg(){ return Store.get('adhanEnabled') || {}; },
  on(name){ const a = this.cfg(); return a.master !== false && a[name] !== false; },
  anyOn(){ return Salah.NAMES.some(n => this.on(n)); },
  before15(){ return !!(Store.get('adhanOffsets') || {}).before15; },

  /* سکوت: محفل، اتاقِ بازی، بازیِ تمام‌صفحه یا پنجرهٔ باز */
  quietNow(){
    try{
      const top = (Router.stack || [])[ (Router.stack || []).length - 1 ];
      if(top === 'play' || top === 'room' || top === 'online') return true;
      if(typeof UI.isOpen === 'function' && UI.isOpen()) return true;
      return false;
    }catch(e){ return false; }
  },

  /* هدفِ بعدی — تابعِ خالص برای تست: { name, at, kind:'adhan'|'before' } یا null.
     نمازهای خاموش را رد می‌کند و اگر امروز چیزی نمانده باشد، نخستین
     نمازِ روشنِ فردا را برمی‌دارد. */
  nextTarget(now){
    now = now || new Date();
    const enabled = Salah.NAMES.filter(n => this.on(n));
    if(!enabled.length) return null;                 // master خاموش ⇒ هیچ هدفی نیست
    const t = Salah.times(now);
    let target = null;
    for(const n of enabled){ if(+t[n] > +now){ target = { name:n, at:t[n] }; break; } }
    if(!target){
      const t2 = Salah.times(new Date(+now + 864e5));
      target = { name:enabled[0], at:t2[enabled[0]] };
    }
    if(this.before15()){
      const early = +target.at - 15 * 6e4;
      if(early > +now) return { name:target.name, at:new Date(early), kind:'before' };
    }
    return { name:target.name, at:target.at, kind:'adhan' };
  },

  reschedule(){
    try{ if(this._timer != null) clearTimeout(this._timer); }catch(e){}
    this._timer = null;
    const tg = this.nextTarget(new Date());
    if(!tg) return;
    const ms = Math.max(1000, +tg.at - Date.now());
    /* setTimeout تا ~۲۴ روز امن است؛ هدفِ ما هرگز از ۱۵ ساعت دورتر نیست */
    try{
      this._timer = setTimeout(() => {
        try{ this.fire(tg); }catch(e){}
        try{ this.reschedule(); }catch(e){}
      }, ms);
    }catch(e){}
  },

  fire(tg){
    const now = new Date();
    const stamp = tg.kind + ':' + tg.name + ':' + Math.round(+tg.at / 6e4);
    if(this._firedStamp === stamp) return;          /* یک هدف، یک بار */
    if(+now > +tg.at + 10 * 6e4) return;            /* خیلی گذشته — ردش کن */
    if(this.quietNow()){                            /* محفل/بازی: سکوت، کمی بعد دوباره */
      if(this._retry < 10){
        this._retry++;
        try{ if(this._timer != null) clearTimeout(this._timer); }catch(e){}
        this._timer = setTimeout(() => { try{ this.fire(tg); }catch(e){} }, 6e4);
      }
      return;
    }
    this._retry = 0;
    this._firedStamp = stamp;
    const label = Salah.LABEL[tg.name] || tg.name;
    const title = tg.kind === 'before' ? `۱۵ دقیقه تا اذانِ ${label}` : `اذانِ ${label}`;
    const body = tg.kind === 'before' ? 'کم‌کم وقتِ نماز می‌رسد' : `${label} — ${Courtyard.cityLabel()}`;
    this.notify(title, body);
    this.chime();
  },

  notify(title, body){
    /* Notification اگر اجازه هست، وگرنه همان toast */
    try{
      if(typeof Notification !== 'undefined' && Notification.permission === 'granted' &&
         Store.get('notifGranted') !== 'denied'){
        new Notification('🕌 نورستان — ' + title, { body, tag:'noor-adhan', lang:'fa', dir:'rtl' });
        return 'notification';
      }
    }catch(e){}
    UI.toast('🕌 ' + title + ' — ' + body, 'ok', 6000);
    return 'toast';
  },

  /* زنگِ WebAudio — فقط اگر صدا روشن است و AudioContext از پیش با ژستِ
     کاربر باز شده باشد (سیاستِ autoplay مرورگر). فایلِ بیرونی ندارد. */
  chime(){
    try{
      if(!(Store.get('settings') || {}).sound) return;
      if(typeof Sound.ensure === 'function' && !Sound.ensure()) return;
      /* امضای Sound: tone(freq, dur, type, vol, delay) */
      this.CHIME.forEach((f, i) => {
        try{ Sound.tone(f, .45, 'sine', .07, i * .28); }catch(e){}
      });
    }catch(e){}
  },

  requestPermission(){
    if(typeof Notification === 'undefined'){
      UI.toast('این مرورگر Notification ندارد — همان یادآورِ داخلِ برنامه کار می‌کند', '', 3000);
      return;
    }
    if(Notification.permission === 'granted'){
      Store.set('notifGranted', 'granted');
      UI.toast('یادآورِ اذان فعال است', 'ok', 2000);
      return;
    }
    if(Notification.permission === 'denied'){
      Store.set('notifGranted', 'denied');
      this.deniedGuide();                            /* راهنمای فارسی، یک بار */
      return;
    }
    try{
      Notification.requestPermission().then(p => {
        Store.set('notifGranted', p === 'granted' ? 'granted' : (p === 'denied' ? 'denied' : 'default'));
        if(p === 'granted'){ UI.toast('🔔 اجازه گرفتی — یادآورِ اذان فعال شد', 'ok', 2400); this.reschedule(); }
        else if(p === 'denied') this.deniedGuide();
      }).catch(() => {});
    }catch(e){}
  },

  /* راهنمای فارسیِ «چطور در تنظیماتِ مرورگر روشنش کنی» — یک بار، بدونِ
     بنرِ مزاحم و بدونِ اصرارِ دوباره */
  deniedGuide(){
    if(Adhan._guideShown) return;
    Adhan._guideShown = true;
    UI.modal(`
      <h3 style="margin-bottom:8px">${Icon.of('target')} یادآورِ اذان</h3>
      <p style="font-size:12.5px;line-height:2;color:var(--txt)">
        اجازهٔ اعلان‌ها را نداده‌ای — اشکالی ندارد؛ یادآور داخلِ برنامه
        (toast + زنگ) همچنان کار می‌کند، فقط وقتی نورستان باز باشد.
        اگر خواستی اعلانِ سیستمی بگیری: در همان نوارِ نشانیِ مرورگر روی
        نمادِ قفل/تنظیمات بزن، «اعلان‌ها / Notifications» را پیدا کن و
        «اجازه / Allow» را انتخاب کن؛ بعد همین‌جا دکمهٔ «دوباره» را بزن.</p>
      <p style="font-size:11.5px;color:var(--mut);margin-top:6px">
        توجه: یادآورِ PWA فقط وقتی برنامه باز است کار می‌کند — پوشِ
        سروری در کار نیست (در README توضیح داده شده).</p>
      <button class="btn w" id="adhGuideOk" style="width:100%;margin-top:10px">فهمیدم</button>
    `, box => {
      const ok = U.$('#adhGuideOk', box);
      if(ok) ok.onclick = () => UI.closeModal();
    });
  },

  /* ── کارتِ تنظیماتِ اذان (در «عبادتِ روزانه») ── */
  cardHtml(){
    const a = this.cfg();
    const b15 = this.before15();
    const ng = Store.get('notifGranted');
    return `
      <div class="card mt14" id="adhanSetCard">
        <b style="font-size:13px">${Icon.of('target')} اذان و یادآور</b>
        <div class="sep"></div>
        <label class="lbl">یادآورِ هر نماز</label>
        <div class="sc-set-row">
          <button class="btn ${a.master !== false ? '' : 'gh'} sm" id="adhMaster" style="flex:1;min-height:44px">
            ${a.master !== false ? '🔔 یادآور: روشن' : '🔕 یادآور: خاموش'}</button>
          <button class="btn ${b15 ? '' : 'gh'} sm" id="adhBefore" style="flex:1;min-height:44px">
            ${b15 ? '۱۵ دقیقه قبل: روشن' : '۱۵ دقیقه قبل: خاموش'}</button>
        </div>
        <div class="sc-set-row" style="margin-top:6px">
          ${Salah.NAMES.map(n => `
            <button class="btn ${this.on(n) ? '' : 'gh'} sm" data-adhan="${n}"
                    style="flex:1;min-width:84px;min-height:44px">${Salah.LABEL[n]} ${this.on(n) ? '✓' : '✕'}</button>`).join('')}
        </div>
        <label class="lbl">اعلانِ سیستمی</label>
        <div class="sc-set-row">
          <button class="btn gh sm" id="adhPerm" style="flex:1;min-height:44px">
            ${ng === 'granted' ? '✅ اجازهٔ اعلان داده شده' : (ng === 'denied' ? '⛔ اعلان بسته است — راهنما' : 'فعال‌سازیِ اعلانِ سیستمی')}</button>
          <button class="btn gh sm" id="adhTest" style="min-height:44px">${Icon.of('clock')}<span>آزمایشِ زنگ</span></button>
        </div>
        <p style="font-size:11.5px;color:var(--mut);margin-top:8px">
          اذان محلی است: فقط وقتی نورستان باز است یادآور می‌دهد، در
          محفل/بازیِ تمام‌صفحه ساکت است و صدای زنگ از WebAudioِ خودِ
          برنامه است (بدونِ فایل و بدونِ سرور).</p>
      </div>`;
  },

  wire(){
    const master = U.$('#adhMaster');
    if(master) master.onclick = () => {
      const v = !((Store.get('adhanEnabled') || {}).master !== false);
      Store.update(d => { d.adhanEnabled.master = v; });
      U.label(master, v ? '🔔 یادآور: روشن' : '🔕 یادآور: خاموش');
      master.classList.toggle('gh', !v);
      Adhan.reschedule();
    };
    const before = U.$('#adhBefore');
    if(before) before.onclick = () => {
      const v = !Adhan.before15();
      Store.update(d => { d.adhanOffsets.before15 = v; });
      U.label(before, v ? '۱۵ دقیقه قبل: روشن' : '۱۵ دقیقه قبل: خاموش');
      before.classList.toggle('gh', !v);
      Adhan.reschedule();
    };
    U.$$('[data-adhan]').forEach(b => b.onclick = () => {
      const n = b.dataset.adhan;
      /* وضعیتِ فعلیِ همان نماز را برعکس کن (بدونِ دست‌زدن به master) */
      const cur = (Store.get('adhanEnabled') || {})[n] !== false;
      const next = !cur;
      Store.update(d => { d.adhanEnabled[n] = next; });
      b.classList.toggle('gh', !next);
      b.textContent = `${Salah.LABEL[n]} ${next ? '✓' : '✕'}`;
      Adhan.reschedule();
    });
    const perm = U.$('#adhPerm');
    if(perm) perm.onclick = () => Adhan.requestPermission();
    const test = U.$('#adhTest');
    if(test) test.onclick = () => {
      UI.toast('🕌 آزمایش — ' + (Salah.LABEL[(Salah.current(new Date()) || {}).name] || 'اذان'), 'ok', 3000);
      Adhan.chime();
    };
  }
};

/* ═══════════ اتصال به برنامهٔ موجود (بدونِ بازنویسی) ═══════════ */
(function attachWirdUI(){
  /* ۱) کارتِ اذان به بخشِ «عبادتِ روزانه» اضافه شود */
  try{
    if(typeof SalahSettings === 'object' && !SalahSettings.inject._adhanWrapped){
      const _inject = SalahSettings.inject.bind(SalahSettings);
      SalahSettings.inject = function(){
        _inject();
        try{
          if(!U.$('#adhanSetCard')){
            const body = U.$('#meBody');
            if(body && body.appendChild){
              const wrap = document.createElement('div');
              wrap.innerHTML = Adhan.cardHtml();
              body.appendChild(wrap.firstElementChild || wrap);
              Adhan.wire();
            }
          }
        }catch(e){ console.warn('adhan card', e); }
      };
      SalahSettings.inject._adhanWrapped = true;
    }
  }catch(e){}

  /* ۲) باز شدنِ قبله شمرده شود (مأموریتِ «یک‌بار در عمر») */
  try{
    if(typeof Qibla === 'object' && !Qibla.open._countWrapped){
      const _open = Qibla.open.bind(Qibla);
      Qibla.open = function(){
        try{ Store.update(d => { d.stats.qiblaOpens = (d.stats.qiblaOpens || 0) + 1; }); }catch(e){}
        return _open();
      };
      Qibla.open._countWrapped = true;
    }
  }catch(e){}

  /* ۳) مأموریت‌های عبادت — جایگزینِ تصادفیِ استخر، نه اجباریِ هر روز.
     استخر پیش از ensure همگام می‌شود؛ مأموریتِ قبله فقط تا وقتی انجام
     نشده در استخر می‌ماند و مأموریت‌های رمضان فقط در رمضان. */
  try{
    const WORSHIP = [
      { id:'pray5',  icon:'🕌', t:'هر پنج نمازِ امروز را علامت بزن', d:'از نوارِ نمازِ صحن', goal:5, pts:60 },
      { id:'wird1',  icon:'📿', t:'یک وردِ ذکر تمام کن',            d:'ذکرِ صبح، شام یا تعقیب', goal:1, pts:45 },
      { id:'khatm1', icon:'📖', t:'یک صفحهٔ ختم بخوان',             d:'از کارتِ ختمِ قرآن', goal:1, pts:50 }
    ];
    const QIBLA_M = { id:'qibla1', icon:'🧭', t:'یک بار قبله را باز کن', d:'فقط یک بار در عمر', goal:1, pts:35 };
    const RAMADAN = [
      { id:'ramWird',    icon:'🌙', t:'ذکرِ سحر را بخوان',        d:'کارتِ رمضان روی صحن', goal:1, pts:50 },
      { id:'ramMaghrib', icon:'🌆', t:'نمازِ مغرب (افطار) را علامت بزن', d:'وقتِ افطار', goal:1, pts:50 },
      { id:'ramTasbih',  icon:'📿', t:'تسبیحِ امروز را کامل کن',  d:'۳۳/۳۳/۳۳', goal:1, pts:50 }
    ];
    Missions.WORSHIP_POOL = WORSHIP.concat(RAMADAN).concat([QIBLA_M]);

    Missions.ramadanPool = () => RAMADAN;

    Missions._syncPool = function(){
      const has = id => this.POOL.some(m => m.id === id);
      const drop = id => { this.POOL = this.POOL.filter(m => m.id !== id); };
      /* عبادت: همیشه در استخر (به‌جزِ قبله که یک‌باردرعمر است) */
      WORSHIP.forEach(m => { if(!has(m.id)) this.POOL.push(m); });
      /* قبله: فقط تا وقتی انجام نشده */
      let qOpen = 0;
      try{ qOpen = (Store.get('stats') || {}).qiblaOpens || 0; }catch(e){}
      if(qOpen > 0) drop('qibla1');
      else if(!has('qibla1')) this.POOL.push(QIBLA_M);
      /* رمضان: فقط در ماهِ نهم */
      const ram = (typeof RamadanUI !== 'undefined') && RamadanUI.isRamadan(new Date());
      RAMADAN.forEach(m => { if(ram){ if(!has(m.id)) this.POOL.push(m); } else drop(m.id); });
    };

    if(!Missions.ensure._worshipWrapped){
      const _ensure = Missions.ensure.bind(Missions);
      Missions.ensure = function(){
        try{ Missions._syncPool(); }catch(e){}
        return _ensure();
      };
      Missions.ensure._worshipWrapped = true;
    }

    /* شمارندهٔ مأموریت‌های تازه */
    if(!Missions.key._worshipWrapped){
      const _key = Missions.key.bind(Missions);
      Missions.key = function(id){
        switch(id){
          case 'pray5':  return SalahLog.count();
          case 'wird1':  return WirdUI.doneCount();
          case 'khatm1': return Khatm.doneToday() ? 1 : 0;
          case 'qibla1': return ((Store.get('stats') || {}).qiblaOpens || 0) > 0 ? 1 : 0;
          case 'ramWird':    return WirdUI.doneCount();
          case 'ramMaghrib': return SalahLog.marked('maghrib') ? 1 : 0;
          case 'ramTasbih':  return Tasbih.doneToday() ? 1 : 0;
          default: return _key(id);
        }
      };
      Missions.key._worshipWrapped = true;
    }
  }catch(e){ console.warn('missions wrap', e); }

  /* ۴) برنامه‌ریزیِ اذان روی شروع — با تأخیر تا صفحه نفس بکشد */
  try{
    if(typeof document !== 'undefined' && document.addEventListener){
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { try{ Adhan.reschedule(); }catch(e){} }, 3500);
      });
    }
  }catch(e){}
})();
