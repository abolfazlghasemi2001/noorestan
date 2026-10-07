/* ═══════════════════════════════════════════════════════════════════
   نورستان — نسخهٔ ۲۲: همراهِ نماز (رکعت‌شمارِ خودکار) و ذکرشمار
   ═══════════════════════════════════════════════════════════════════
   سه چیز در این فایل است و منطقِ هر سه بی‌DOM نوشته شده تا هارنسِ Node
   (`node _harness.js`) بتواند مستقیم بسنجَدشان:

   ۱) `SalahFive` — دفترچهٔ پنج نمازِ واجبهٔ روزانه (صبح ۲، ظهر ۴، عصر ۴،
      مغرب ۳، عشا ۴ = ۱۷ رکعت) و زنجیرهٔ روزهای کامل. از `SalahLog` جداست:
      آن دفترچهٔ *ستونِ اوقات*ِ صفحهٔ عبادت است (سه نماز، تصمیمِ نسخهٔ ۲۱)
      و این دفترچه نمازهایی را می‌شمارد که با همراهِ نماز *خوانده* شده‌اند.
      دو جا بودن عمدی است: سنجش‌ها و سقفِ سکهٔ آن یکی دست‌نخورده بماند.
   ۲) `Dhikr` — ذکرشمار: چند ذکرِ مأثور با هدفِ شمارش، ریستِ روزانه،
      «یکی کم» و ذکرِ دلخواه. تسبیحاتِ حضرتِ زهرا (س) همان `tasbihToday`
      کهنه را نگه می‌دارد (پوششِ `Tasbih` در `wird-1.js`) تا مأموریتِ
      رمضان و سنجش‌های نسخهٔ ۱۹ نشکنند.
   ۳) `Sajjada` — همراهِ نماز: صفّ مرحلهٔ همان نماز (نیت، تکبیر، قیام،
      قنوت، رکوع، برخاستن، دو سجده با جلوس میانِ آن‌ها، تشهّد، سلام) با
      تشخیصِ *خودکارِ* حالتِ بدن از شتاب‌سنج.

   چرا تشخیصِ حالت با «نمونهٔ خودِ کاربر» و نه آستانهٔ آماده؟
   شتاب‌سنج فقط یک بردار می‌دهد: جهتِ «بالای جهان» نسبت به بدنهٔ گوشی.
   گوشیِ ایستادهٔ کفِ دست، گوشیِ خم‌شده در رکوع و گوشیِ خوابیده در سجده از
   نظرِ عددِ خام می‌توانند یکی باشند (بستگی دارد گوشی کجا باشد: کفِ سجاده،
   توی جیب، یا کفِ دست). هر آستانهٔ ازپیش‌ساخته‌ای روی یک گوشی درست و روی
   گوشیِ دیگری همیشه غلط است. پس برنامه سه حالت را یک‌بار نمونه می‌گیرد و
   از آن پس نزدیک‌ترین نمونه را می‌گوید — همان کاری که قطب‌نماهای خوب با
   «شکلِ ۸» می‌کنند. اگر نمونه ندهی، همان صفحه با دکمهٔ «مرحلهٔ بعد» کار
   می‌کند و رکعت‌ها دستی شمرده می‌شوند؛ هیچ‌چیز به حسگر بند نیست.

   دوربین، میکروفن و «مکان» هرگز خوانده نمی‌شود. متن‌ها از متونِ مأثورِ
   نمازاند و این صفحه *همراهِ یادآوری* است، نه مرجعِ فقهی — همین جمله
   روی کارت هم نوشته شده است.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════ ۱. دفترچهٔ پنج نماز ═══════════════ */
const SalahFive = {
  NAMES: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
  /* رکعت‌های واجبهٔ هر نماز در حضر. مسافر بودن را کاربر خودش اعلام می‌کند
     (کلیدِ «مسافر» در همراهِ نماز) — برنامه هرگز حدس نمی‌زند. */
  RAKA: { fajr:2, dhuhr:4, asr:4, maghrib:3, isha:4 },
  TOTAL_RAKA: 17,
  COIN: 1, XP: 3,             // به‌ازای هر نمازی که با همراهِ نماز تمام شود
  ALL_COIN: 5, ALL_XP: 10,    // «هر پنج نمازِ امروز» — یک‌بار در روز

  _book(){ const b = Store.get('salahFive'); return (b && typeof b === 'object' && !Array.isArray(b)) ? b : {}; },
  today(){ return U.today(); },
  day(){ const v = this._book()[this.today()]; return Array.isArray(v) ? v : []; },
  marked(name){ return this.day().includes(name); },
  count(){ return this.day().length; },
  complete(){ return this.count() >= this.NAMES.length; },
  label(name){ return (Salah.LABEL && Salah.LABEL[name]) || name; },
  rakat(name, opt){
    opt = opt || {};
    let n = this.RAKA[name] || 2;
    if(opt.travel && n === 4) n = 2;
    return U.clamp(Math.floor(+opt.force) || n, 1, 8);
  },

  mark(name){
    if(!this.NAMES.includes(name)) return { ok:false, why:'bad' };
    if(this.marked(name)) return { ok:false, dup:true };
    const k = this.today(), b = this._book();
    const list = Array.isArray(b[k]) ? b[k].slice() : [];
    if(list.length >= this.NAMES.length) return { ok:false, cap:true };
    list.push(name);
    b[k] = [...new Set(list)];
    Store.set('salahFive', b);
    Wallet.earn(this.COIN, `نمازِ ${this.label(name)} (همراه)`);
    Store.update(d => { d.xp += this.XP; });
    try{ checkLevelUp(); }catch(e){}
    let bonus = 0;
    if(this.complete()) bonus = this.awardAll();
    return { ok:true, total:this.count(), bonus };
  },
  unmark(name){
    if(!this.NAMES.includes(name)) return false;
    const k = this.today(), b = this._book();
    if(!Array.isArray(b[k])) return false;
    const list = b[k].filter(n => n !== name);
    if(list.length) b[k] = list; else delete b[k];
    Store.set('salahFive', b);
    return true;
  },

  /* «هر پنج نمازِ امروز تمام شد» — یک‌بار در روز، با زنجیرهٔ روزهای پیاپی */
  awardAll(){
    const s = Store.get('prayStreak') || {};
    if(s.at === this.today()) return 0;
    const y = U.today(new Date(Date.now() - 864e5));
    const n = (s.at === y ? (Math.floor(+s.n) || 0) : 0) + 1;
    Store.update(d => { d.prayStreak = { n, at:this.today() }; });
    Wallet.earn(this.ALL_COIN, 'نمازهای پنج‌گانهٔ امروز');
    Store.update(d => { d.xp += this.ALL_XP; });
    try{ checkLevelUp(); }catch(e){}
    try{ Haptic.success(); }catch(e){}
    return this.ALL_COIN;
  },
  streak(){ const s = Store.get('prayStreak') || {}; return Math.max(0, Math.floor(+s.n) || 0); },
  segsHtml(){
    return this.NAMES.map(n => `<span class="sf-seg${this.marked(n) ? ' done' : ''}" title="${U.esc(this.label(n))}"></span>`).join('');
  }
};

/* ═══════════════ ۲. ذکرشمار ═══════════════
   هر پیش‌تنظیم چند «فاز» دارد (ذکر + هدف). شمارشِ امروزِ بقیه در
   `dhikrToday.by[id] = {c:[…], d:bool}` می‌نشیند؛ فقط تسبیحاتِ زهرا (س)
   در `tasbihToday`ِ کهنه، با همان شکلِ {date, counts, done}. */
const Dhikr = {
  ZAHRA:'zahra',
  PRESETS:[
    { id:'zahra', title:'تسبیحاتِ حضرتِ زهرا (س)', tab:'تسبیحاتِ زهرا (س)', sub:'پس از هر نماز — سه فازِ ۳۳ تایی',
      store:'tasbihToday', coin:2, xp:2,
      phases:[
        { ar:'سُبْحانَ الله', fa:'پاک است خدا', n:33 },
        { ar:'اَلْحَمْدُ لِلّٰه', fa:'ستایش، از آنِ خداست', n:33 },
        { ar:'اَللهُ اَکبَر', fa:'خدا بزرگ‌تر است', n:33 }
      ] },
    { id:'istighfar', title:'اِستِغفار', tab:'استغفار', sub:'در تعقیباتِ نماز', coin:0, xp:1,
      phases:[{ ar:'اَسْتَغْفِرُ اللهَ رَبّی وَ اَتُوبُ اِلَیْهِ', fa:'از خداوندِ پروردگارم آمرزش می‌خواهم و به سوی او بازم‌گردم', n:70 }] },
    { id:'tahlil', title:'تَهلیل', tab:'تهلیل', sub:'یادِ خدا با زبان', coin:0, xp:1,
      phases:[{ ar:'لا اِلٰهَ اِلَّا اللهُ', fa:'نیست معبودی جز خدا', n:100 }] },
    { id:'hawqala', title:'حَولَقَه', tab:'حولقه', sub:'توکّل به خدا', coin:0, xp:1,
      phases:[{ ar:'لا حَولَ وَ لا قُوَّةَ اِلَّا بِاللهِ العَلِیِّ العَظیم', fa:'نه دگرگونی هست و نه نیرو، مگر از سوی خدایِ برترِ بزرگ', n:100 }] },
    { id:'salawat', title:'صَلَوات', tab:'صلوات', sub:'درود بر پیامبر و خاندانش', coin:0, xp:1,
      phases:[{ ar:'اَللّٰهُمَّ صَلِّ عَلی مُحَمَّدٍ وَ آلِ مُحَمَّدٍ', fa:'خدایا درود فرست بر محمد و خاندانِ محمد', n:100 }] },
    { id:'custom', title:'ذکرِ دلخواه', tab:'ذکرِ من', sub:'خودت ذکر و هدف را بنویس', editable:true, coin:0, xp:0,
      phases:[{ ar:'', fa:'', n:33 }] }
  ],

  by(id){ return this.PRESETS.find(p => p.id === id) || null; },
  /* ذکرِ دلخواه فقط وقتی در فهرست است که کاربر برایش متن نوشته باشد */
  list(){ const c = this.custom(); return this.PRESETS.filter(p => p.id !== 'custom' || (c && c.ar)); },
  custom(){ try{ const c = Store.get('dhikrCustom'); return (c && typeof c === 'object') ? c : null; }catch(e){ return null; } },
  setCustom(ar, n){
    const v = { ar:String(ar || '').replace(/\s+/g, ' ').trim().slice(0, 160),
                n:U.clamp(Math.floor(+n) || 33, 1, 999) };
    Store.set('dhikrCustom', v.ar ? v : null);
  },
  view(id){
    const p = this.by(id) || this.PRESETS[0];
    if(p.editable){
      const c = this.custom() || { ar:'', n:33 };
      return { id:p.id, title:p.title, tab:p.tab, sub:p.sub, coin:p.coin, xp:p.xp, editable:true,
               phases:[{ ar:c.ar || 'ذکرِ دلخواه را بنویس…', fa:'', n:U.clamp(+c.n || 33, 1, 999) }] };
    }
    return p;
  },

  /* ── خواندن/نوشتنِ شمارشِ امروز ── */
  state(id){
    const p = this.view(id), day = U.today();
    if(p.store === 'tasbihToday'){
      const t = Store.get('tasbihToday') || {};
      if(t.date !== day) return { date:day, counts:p.phases.map(() => 0), done:false };
      const src = Array.isArray(t.counts) ? t.counts : [];
      return { date:day, counts:p.phases.map((x, i) => U.clamp(Math.floor(+src[i]) || 0, 0, x.n)), done:!!t.done };
    }
    const d = Store.get('dhikrToday') || {};
    const v = (d.date === day && d.by && d.by[p.id] && Array.isArray(d.by[p.id].c)) ? d.by[p.id] : null;
    const src = v ? v.c : [];
    return { date:day, counts:p.phases.map((x, i) => U.clamp(Math.floor(+src[i]) || 0, 0, x.n)), done:!!(v && v.d) };
  },
  _save(id, s){
    const p = this.view(id);
    if(p.store === 'tasbihToday'){
      Store.set('tasbihToday', { date:s.date, counts:s.counts.slice(0, 3), done:!!s.done });
      return;
    }
    const d = (Store.get('dhikrToday') && typeof Store.get('dhikrToday') === 'object') ? Store.get('dhikrToday') : {};
    if(d.date !== s.date || !d.by || typeof d.by !== 'object' || Array.isArray(d.by)) d.by = {};
    d.date = s.date;
    d.by[p.id] = { c:s.counts.slice(0, 8), d:!!s.done };
    Store.set('dhikrToday', d);
  },
  phaseIndex(id, s){
    s = s || this.state(id);
    const p = this.view(id);
    for(let i = 0; i < p.phases.length; i++) if(s.counts[i] < p.phases[i].n) return i;
    return -1;
  },
  doneToday(id){ const s = this.state(id); return !!s.done && this.phaseIndex(id, s) === -1; },
  progress(id){
    const p = this.view(id), s = this.state(id);
    const goal = p.phases.reduce((a, x) => a + x.n, 0);
    const got = s.counts.reduce((a, x) => a + (x || 0), 0);
    return { got, goal, pct:goal ? U.clamp(got / goal, 0, 1) : 0, done:goal > 0 && got >= goal };
  },

  /* یک ضربه = یک ذکر؛ `back:true` یکی کم می‌کند (لمسِ اشتباه). */
  tap(id, back){
    id = id || Dhikr.ZAHRA;
    const p = this.view(id), s = this.state(id);
    if(back){
      for(let k = p.phases.length - 1; k >= 0; k--){
        if(s.counts[k] > 0){ s.counts[k]--; s.done = false; this._save(id, s); this.beep(false);
          return { ok:true, back:true, phase:k, counts:s.counts.slice(), done:false }; }
      }
      return { ok:false, zero:true, counts:s.counts.slice() };
    }
    let i = this.phaseIndex(id, s);
    if(i < 0){
      UI.toast('این ذکر امروز کامل شده — آفرین', 'ok', 1800);
      return { ok:false, complete:true, counts:s.counts.slice() };
    }
    s.counts[i]++;
    i = this.phaseIndex(id, s);
    let reward = 0;
    if(i < 0){ s.done = true; reward = this.pay(id, p); }
    this._save(id, s);
    try{ this.beep(i < 0); }catch(e){}
    return { ok:true, phase:i, counts:s.counts.slice(), done:!!s.done, reward };
  },
  /* جایزه یک‌بار در روز. ذکرهای ساده فقط تجربه می‌دهند تا «هزار بار
     لاالهالاالله» اقتصادِ سکه را تورم ندهد. */
  pay(id, p){
    p = p || this.view(id);
    /* جایزه یک‌بار در روز است. `tap` پیش از ذخیره این‌جا می‌آید (پس امروز
       هنوز «کامل نشده» به‌نظر می‌رسد) و هر فراخوانیِ دیگری پس از ذخیره
       صفر می‌گیرد — یعنی حتی اگر روزی دو جا صدا زده شود، سکه دو بار
       نمی‌آید. */
    if(this.doneToday(id)) return 0;
    let reward = 0;
    if(p.coin > 0 && id !== 'custom'){ Wallet.earn(p.coin, p.title); reward = p.coin; }
    if(p.xp > 0){ Store.update(d => { d.xp += p.xp; }); try{ checkLevelUp(); }catch(e){} }
    if(reward > 0) UI.toast('📿 ' + p.title + ' — کامل شد', 'ok', 2200);
    else UI.toast('✓ ' + p.title + ' — کامل شد', 'ok', 1800);
    return reward;
  },
  reset(id){
    /* بی شناسهٔ معتبر هیچ را پاک نمی‌کنیم (وگرنه یک idِ اشتباه، شمارشِ
       زهرا (س) را می‌برد) */
    const p = this.by(id || Dhikr.ZAHRA);
    if(!p) return false;
    this._save(p.id, { date:U.today(), counts:p.phases.map(() => 0), done:false });
    return true;
  },
  beep(full){
    if((Store.get('settings') || {}).haptics !== false && typeof navigator !== 'undefined' && navigator.vibrate){
      try{ navigator.vibrate(full ? [15, 40, 25] : 10); }catch(e){}
    }
    try{
      if(full) Sound.rich(880, .22, .06);
      else Sound.tone(1180, .05, 'sine', .04);
    }catch(e){}
  },

  /* ── مارک‌آپ ── `compact` برای صفحهٔ همراهِ نماز (بی زبانه، بی پاورقی) */
  html(id, opt){
    opt = opt || {};
    id = id || Dhikr.ZAHRA;
    if(!this.by(id)) id = Dhikr.ZAHRA;
    const p = this.view(id), s = this.state(id);
    const i = this.phaseIndex(id, s), pr = this.progress(id);
    const cur = i >= 0 ? p.phases[i] : p.phases[p.phases.length - 1];
    const curN = i >= 0 ? s.counts[i] : cur.n;
    const multi = p.phases.length > 1;
    const tab = this._tab || id;
    return `
      <div class="dj${opt.compact ? ' dj-c' : ''}" data-dj="${U.esc(p.id)}">
        ${opt.compact ? '' : `<div class="dj-tabs" role="group" aria-label="انتخابِ ذکر">
          ${this.list().map(x => `<button class="dj-tab${x.id === tab ? ' on' : ''}" data-dj-tab="${x.id}"
              aria-pressed="${x.id === tab ? 'true' : 'false'}">${U.esc(x.tab || x.title)}</button>`).join('')}
        </div>`}
        <div class="dj-pad" data-dj-tap role="button" tabindex="0"
             aria-label="ذکرشمار — ${U.esc(cur.ar || p.title)} — ${U.fa(curN)} از ${U.fa(cur.n)}">
          <div class="dj-ring" aria-hidden="true">${this.ring(pr.pct, opt.compact ? 108 : 122)}
            <div class="dj-mid">
              <div class="dj-n">${U.fa(curN)}</div>
              <div class="dj-of">${U.fa(cur.n)}${multi ? ' · فاز ' + U.fa(i < 0 ? p.phases.length : i + 1) + '/' + U.fa(p.phases.length) : ''}</div>
            </div>
          </div>
          <div class="dj-txt">
            <div class="dj-ar">${U.esc(cur.ar || p.title)}</div>
            ${cur.fa ? `<div class="dj-fa">${U.esc(cur.fa)}</div>` : ''}
            ${pr.done ? '<div class="dj-ok">✓ امروز کامل شد</div>' : ''}
          </div>
        </div>
        ${multi ? `<div class="dj-phases">${p.phases.map((x, k) => `
            <span class="dj-ph${s.counts[k] >= x.n ? ' done' : ''}${k === i ? ' on' : ''}">
              <b>${U.esc(x.ar)}</b><i>${U.fa(s.counts[k])}/${U.fa(x.n)}</i></span>`).join('')}</div>` : ''}
        <div class="dj-row">
          <button class="btn gh sm" data-dj-back>${Icon.of('prev')}<span>یکی کم</span></button>
          ${opt.compact ? '' : `
            ${p.editable ? `<button class="btn gh sm" data-dj-edit>${Icon.of('edit')}<span>نوشتنِ ذکر</span></button>`
                         : `<button class="btn gh sm" data-dj-go>${Icon.of('expand')}<span>تمام‌صفحه</span></button>`}`}
          <button class="btn gh sm" data-dj-reset>${Icon.of('refresh')}<span>ریست</span></button>
        </div>
        ${opt.compact ? '' : `<p class="dj-note">${U.esc(p.sub || '')}${p.coin ? ' — جایزهٔ یک‌بارِ روزانه: ' + U.fa(p.coin) + ' سکه' : ''}</p>`}
      </div>`;
  },
  ring(pct, size){
    const r = (size / 2) - 7, C = 2 * Math.PI * r;
    const o = (C * (1 - U.clamp(+pct || 0, 0, 1))).toFixed(2);
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r.toFixed(2)}" class="dj-c-bg" stroke-width="7"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r.toFixed(2)}" class="dj-c-fg" stroke-width="7"
              stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${o}"
              transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
  },
  /* سیم‌کشیِ ذکرشمار(ها) در یک محدوده — هر `[data-dj]` ذکرشمارِ خودش است
     (یکی در کارتِ ذکرِ صفحهٔ عبادت، یکی در صفحهٔ همراهِ نماز)، پس محدوده
     از بیرون داده می‌شود تا یکی دیگری را دست نبرد. */
  wire(scope, hooks){
    const root = scope || document;
    const boxes = (root.querySelectorAll ? [...root.querySelectorAll('[data-dj]')] : []);
    if(!boxes.length) return;
    this._tab = this._tab || Dhikr.ZAHRA;
    boxes.forEach(box => {
      const cur = box.dataset.dj || Dhikr.ZAHRA;
      const rerender = () => {
        const wrap = document.createElement('div');
        wrap.innerHTML = this.html(cur, { compact:box.classList.contains('dj-c') });
        const fresh = wrap.firstElementChild;
        if(fresh && box.replaceWith) box.replaceWith(fresh);
        else if(fresh) box.innerHTML = fresh.innerHTML;
        this.wire(root, hooks);
      };
      const paint = () => {
        this.refresh(box, cur);
        try{ hooks && hooks.onTap && hooks.onTap(cur); }catch(e){}
      };
      U.$$('[data-dj-tab]', box).forEach(b => b.onclick = () => {
        this._tab = b.dataset.djTab;
        try{ Sound.click(); }catch(e){}
        rerender();
        try{ hooks && hooks.onPick && hooks.onPick(this._tab); }catch(e){}
      });
      const tap = U.$('[data-dj-tap]', box);
      if(tap){
        tap.onclick = () => { this.tap(cur); paint(); };
        tap.onkeydown = e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); this.tap(cur); paint(); } };
        tap.oncontextmenu = e => { e.preventDefault(); this.tap(cur, true); paint(); };
      }
      const bk = U.$('[data-dj-back]', box); if(bk) bk.onclick = () => { this.tap(cur, true); paint(); };
      const rs = U.$('[data-dj-reset]', box);
      if(rs) rs.onclick = () => { this.reset(cur); paint(); UI.toast('ذکرشمار ریست شد', '', 1400); try{ hooks && hooks.onChange && hooks.onChange(); }catch(e){} };
      const ed = U.$('[data-dj-edit]', box); if(ed) ed.onclick = () => this.editModal(box, rerender);
      const go = U.$('[data-dj-go]', box); if(go) go.onclick = () => this.fullModal(cur);
    });
  },
  /* تازه‌سازیِ بی‌بازسازیِ DOM — ضربه‌های انگشت باید بی‌پرشِ زبانه رد شوند */
  refresh(box, id){
    box = box || U.$('[data-dj]');
    if(!box) return;
    id = id || box.dataset.dj || Dhikr.ZAHRA;
    const p = this.view(id), s = this.state(id);
    const i = this.phaseIndex(id, s), pr = this.progress(id);
    const cur = i >= 0 ? p.phases[i] : p.phases[p.phases.length - 1];
    const curN = i >= 0 ? s.counts[i] : cur.n;
    const put = (sel, txt) => { const el = U.$(sel, box); if(el && el.textContent !== txt) el.textContent = txt; };
    put('.dj-n', U.fa(curN));
    put('.dj-of', 'از ' + U.fa(cur.n) + (p.phases.length > 1 ? ' · فاز ' + U.fa(i < 0 ? p.phases.length : i + 1) + '/' + U.fa(p.phases.length) : ''));
    put('.dj-ar', cur.ar || p.title);
    if(cur.fa) put('.dj-fa', cur.fa);
    const fg = U.$('.dj-c-fg', box);
    if(fg && fg.getAttribute){
      const r = parseFloat(fg.getAttribute('r')) || 0;
      if(r){ const C = 2 * Math.PI * r; fg.setAttribute('stroke-dasharray', C.toFixed(2)); fg.setAttribute('stroke-dashoffset', (C * (1 - pr.pct)).toFixed(2)); }
    }
    const pad = U.$('[data-dj-tap]', box);
    if(pad && pad.setAttribute) pad.setAttribute('aria-label', 'ذکرشمار — ' + (cur.ar || p.title) + ' — ' + U.fa(curN) + ' از ' + U.fa(cur.n));
    U.$$('.dj-ph', box).forEach((el, k) => {
      if(!p.phases[k]) return;
      el.classList.toggle('done', s.counts[k] >= p.phases[k].n);
      el.classList.toggle('on', k === i);
      const it = U.$('i', el); if(it) it.textContent = U.fa(s.counts[k]) + '/' + U.fa(p.phases[k].n);
    });
    const txt = U.$('.dj-txt', box);
    const ok = U.$('.dj-ok', box);
    if(pr.done && !ok && txt){ const d = document.createElement('div'); d.className = 'dj-ok'; d.textContent = '✓ امروز کامل شد'; txt.appendChild(d); }
    if(!pr.done && ok && ok.remove) ok.remove();
  },

  /* ذکرشمارِ تمام‌صفحه — برای «بعد از نماز» و برای شمارشِ بلند */
  fullModal(id){
    id = id || Dhikr.ZAHRA;
    UI.modal(`
      <h3 style="margin-bottom:6px">${Icon.of('medal')} ذکرشمار</h3>
      <div class="dj-full">${this.html(id)}</div>
    `, box => { this.wire(box); });
  },
  editModal(box, then){
    const c = this.custom() || { ar:'', n:33 };
    UI.modal(`
      <h3 style="margin-bottom:6px">${Icon.of('edit')} ذکرِ دلخواه</h3>
      <p class="dj-note" style="margin-bottom:10px">متنِ ذکر فقط روی همین دستگاه ذخیره می‌شود و به هیچ جایی فرستاده نمی‌شود.</p>
      <label class="lbl">متنِ ذکر</label>
      <textarea class="inp" id="djEdAr" rows="2" style="width:100%;font-family:var(--f-quran);font-size:18px">${U.esc(c.ar)}</textarea>
      <label class="lbl">هدفِ شمارش</label>
      <div class="sc-stepper">
        <button class="btn gh sm" id="djEdDown" aria-label="کم کردنِ هدف">−</button>
        <span class="sv" id="djEdN">${U.fa(c.n)}</span>
        <button class="btn gh sm" id="djEdUp" aria-label="افزودنِ هدف">+</button>
      </div>
      <button class="btn w" id="djEdOk" style="margin-top:12px">${Icon.of('check')}<span>ذخیره</span></button>
    `, m => {
      let n = U.clamp(+c.n || 33, 1, 999);
      const paint = () => { const v = U.$('#djEdN', m); if(v) v.textContent = U.fa(n); };
      const dn = U.$('#djEdDown', m); if(dn) dn.onclick = () => { n = U.clamp(n - (n > 33 ? 10 : 1), 1, 999); paint(); };
      const up = U.$('#djEdUp', m); if(up) up.onclick = () => { n = U.clamp(n + (n >= 33 ? 10 : 1), 1, 999); paint(); };
      const ok = U.$('#djEdOk', m);
      if(ok) ok.onclick = () => {
        const ta = U.$('#djEdAr', m);
        this.setCustom(ta && ta.value ? ta.value : '', n);
        UI.closeModal();
        UI.toast('ذکرِ دلخواه ذخیره شد', 'ok', 1800);
        try{ then && then(); }catch(e){}
      };
      paint();
    });
  }
};

/* ═══════════════ ۳. حالت‌یابِ بدن ═══════════════
   بردارِ ویژگی: جهتِ «بالای جهان» در مختصاتِ خودِ گوشی — یعنی همان
   شتابِ ثقلِ نرمال‌شده. سه جزء دارد و همین، هم برای نمونهٔ کالیبراسیون
   و هم برای تشخیص کافی است (مغناطیس‌سنج لازم ندارد، پس جهتِ جغرافیایی
   هم کار ما نیست). */
const NoorPose = {
  KEYS:['stand', 'ruku', 'sujud', 'sit'],
  LABEL:{ stand:'قیام', ruku:'رکوع', sujud:'سجده', sit:'نشستن' },
  THRESH:0.80, GAP:0.06,        // آستانهٔ شباهت و فاصلهٔ امن از رتبهٔ دوم
  _samples:null, _last:null, _run:null, _n:0,

  /* شتاب → بردارِ واحد؛ نمونه‌های نامعتبر/null */
  vec(ev){
    const a = ev && (ev.accelerationIncludingGravity || ev.acceleration);
    if(!a) return null;
    const x = +a.x, y = +a.y, z = +a.z;
    if(![x, y, z].every(v => isFinite(v))) return null;
    const m = Math.hypot(x, y, z);
    if(!(m > 4 && m < 25)) return null;             // لحظهٔ بی‌ثقل یا پُرشتاب
    return [x / m, y / m, z / m];
  },
  norm(v){ const m = Math.hypot(v[0], v[1], v[2]); return m > 1e-6 ? [v[0] / m, v[1] / m, v[2] / m] : null; },
  /* شباهت = ضربِ داخلیِ دو بردارِ واحد؛ ۱ یعنی همان حالت */
  sim(a, b){ return (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]); },
  /* نزدیک‌ترین پروفایل — اگر شک داشت `null` (بی‌قضاوت بهتر از اشتباه) */
  match(v, profiles){
    if(!v || !profiles) return { key:null, conf:0 };
    let best = null, second = -1;
    for(const k of this.KEYS){
      const p = profiles[k];
      if(!p || !p.v) continue;
      const s = this.sim(v, p.v);
      if(!best || s > best.conf) { if(best) second = Math.max(second, best.conf); best = { key:k, conf:s }; }
      else if(s > second) second = s;
    }
    if(!best) return { key:null, conf:0 };
    if(best.conf < this.THRESH || best.conf - second < this.GAP) return { key:null, conf:best.conf, gap:best.conf - second };
    return { key:best.key, conf:best.conf, gap:best.conf - second };
  },
  /* پروفایلِ پیش‌فرض («گوشی کفِ دست»): تقریبی است و رابط هم همین را
     می‌گوید. کالیبراسیونِ کاربر جای این عدد را می‌گیرد. */
  guess(){
    const mk = v => { const u = this.norm(v) || [0, 1, 0]; return { v:u, n:0 }; };
    return {
      stand: mk([0,  1,   0.15]),   // گوشی عمودی کفِ دست، صفحه رو به صورت
      ruku:  mk([0,  0.55, 0.85]), // خم شده: گوشی در پیشِ سینه، صفحه رو به بالا-جلو
      sujud: mk([0, -0.55, 0.85]), // سجده: گوشی در پیشِ زانو، صفحه رو به آسمان
      sit:   mk([0, -0.95, 0.3])   // نشسته: گوشی روی ران، صفحه رو به سقفِ خودی
    };
  },
  profiles(){
    try{
      const p = Store.get('poseProfiles');
      if(p && p.profiles){
        const out = {};
        for(const k of this.KEYS){ const v = p.profiles[k] && p.profiles[k].v; const u = v && this.norm([+v[0] || 0, +v[1] || 0, +v[2] || 0]); if(u) out[k] = { v:u, n:+p.profiles[k].n || 0 }; }
        if(out.stand || out.ruku || out.sujud) return out;
      }
    }catch(e){}
    return null;
  },
  calibrated(){ try{ const p = Store.get('poseProfiles'); return !!(p && p.calibrated); }catch(e){ return false; } },
  save(profiles, calibrated){
    try{ Store.set('poseProfiles', { at:U.now(), calibrated:!!calibrated, profiles }); }catch(e){}
  },
  clear(){ try{ Store.set('poseProfiles', null); }catch(e){} },

  /* ── نمونه‌گیریِ کالیبراسیون ── */
  begin(){ this._samples = { __all:{} }; this.KEYS.forEach(k => this._samples.__all[k] = []); },
  sample(key, ev){
    const s = this._samples && this._samples.__all;
    if(!s || !s[key]) return false;
    const v = this.vec(ev);
    if(!v) return false;
    s[key].push(v);
    return true;
  },
  build(){
    const s = this._samples && this._samples.__all;
    this._samples = null;
    if(!s) return null;
    const out = {};
    for(const k of Object.keys(s)){
      const arr = s[k];
      if(!arr || arr.length < 4) continue;
      const v = [0, 0, 0];
      for(const one of arr){ v[0] += one[0]; v[1] += one[1]; v[2] += one[2]; }
      v[0] /= arr.length; v[1] /= arr.length; v[2] /= arr.length;
      const u = this.norm(v);
      if(!u) continue;
      /* پراکندگیِ نمونه‌ها = بی‌ثباتیِ دست؛ اگر زیاد بود همان حالت را
         بی‌اعتبار می‌کنیم تا تشخیصِ اشتباه از تشخیصِ نبودن بدتر نباشد */
      let spread = 0;
      for(const one of arr) spread += 1 - this.sim(one, u);
      spread /= arr.length;
      if(spread > 0.25) continue;
      out[k] = { v:u, n:arr.length };
    }
    return Object.keys(out).length >= 2 ? out : null;
  },
  /* تشخیصِ پیوسته: سه نمونهٔ پیاپیِ هم‌حالت لازم است (لرزشِ دست و
     لحظهٔ جابه‌جاییِ گوشی، وگرنه مرحلهٔ نماز می‌پرد). */
  feed(ev, profiles){
    const v = this.vec(ev);
    if(!v) return null;
    const r = this.match(v, profiles || this.profiles() || this.guess());
    if(!r.key){ return null; }
    if(this._last === r.key) this._n++;
    else { this._last = r.key; this._n = 1; }
    return this._n >= 3 ? r.key : null;
  },
  reset(){ this._last = null; this._n = 0; }
};

/* ═══════════════ ۴. همراهِ نماز ═══════════════ */
const Sajjada = {
  /* متن‌های مأثورِ هر حالت — یادآوری، نه استناد */
  TXT:{
    takbir:   { ar:'اَللهُ اَکبَر', fa:'خدا بزرگ‌تر است — آغازِ نماز' },
    hamd:     { ar:'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحیمِ', fa:'حمد و سپس سوره‌ای کوتاه بخوان' },
    dhikr34:  { ar:'سُبْحَانَ اللَّهِ وَ الْحَمْدُ لِلّٰهِ وَ لا اِلٰهَ اِلَّا اللهُ وَ اللهُ اَکبَرُ', fa:'در رکعتِ سوم و چهارم: سه بار این ذکر، یا سه بار حمد' },
    qunut:    { ar:'رَبَّنا آتِنا فِی الدُّنْیا حَسَنَةً وَ فِی الْآخِرَةِ حَسَنَةً وَ قِنا عَذابَ النّارِ', fa:'دست‌ها روبه‌آسمان — هر دوعایی هم کافی است' },
    ruku:     { ar:'سُبْحانَ رَبِّیَ الْعَظیمِ وَ بِحَمْدِهِ', fa:'سه بار در رکوع' },
    rise:     { ar:'سَمِعَ اللهُ لِمَنْ حَمِدَهُ', fa:'برخاستن از رکوع — و برقامه: اَلْحَمْدُ لِلّٰهِ رَبِّ الْعالَمینَ' },
    sujud:    { ar:'سُبْحانَ اللهِ الْعَلِیِّ رَبِّنا وَ بِحَمْدِهِ', fa:'سه بار در سجده — هفت عضو بر زمین' },
    julus:    { ar:'اَللهُ اَکبَر', fa:'نشستن میانِ دو سجده' },
    tashahhud:{ ar:'اَلتَّحِیّاتُ لِلّٰهِ وَ الصَّلَواتُ وَ الطَّیِّباتُ… اَشْهَدُ اَنْ لا اِلٰهَ اِلَّا اللهُ وَحْدَهُ لا شَریکَ لَهُ وَ اَنَّ مُحَمَّداً عَبْدُهُ وَ رَسولُهُ، اَللّٰهُمَّ صَلِّ عَلی مُحَمَّدٍ وَ آلِ مُحَمَّدٍ', fa:'ستایش‌ها از آنِ خداست — در نشستن بخوان' },
    salam:    { ar:'اَلسَّلامُ عَلَیْنا وَ عَلی عِبادِ اللهِ الصّالِحینَ', fa:'با این سلام نماز از حالتِ خواندن بیرون می‌آید' }
  },
  /* حالتِ بدنیِ هر مرحله — ستونِ فقرتِ تشخیصِ خودکار */
  POSE:{ niyyah:'stand', takbir:'stand', qiyam:'stand', qunut:'stand', ruku:'ruku', rise:'stand',
         sujud:'sujud', julus:'sit', tashahhud:'sit', salam:'sit' },
  REPS:{ ruku:3, sujud:3, rise:1, julus:1, takbir:1, salam:1 },

  _steps:null, _st:null, _pray:'', _opt:null, _open:false, _travel:false,
  _tickId:null, _t0:0, _onPose:null, _cal:null, _panel:false, _afterMounted:false, _afterDj:'zahra',

  /* ── صفّهٔ مرحله‌ها (تابعِ خالص) ──
     هر رکعت: قیام ← قنوت ← رکوع ← برخاستن ← سجدهٔ اول ← جلوس ← سجدهٔ دوم.
     تشهّد پس از هر رکعتِ جفتی که آخر نیست، و در پایان: تشهّد + سلام. */
  build(pray, opt){
    opt = opt || {};
    const total = U.clamp(Math.floor(+opt.rakat) || (SalahFive.RAKA[pray] || 2), 1, 8);
    const steps = [];
    const push = o => steps.push(o);
    push({ key:'niyyah', name:'نِیَّت', hint:'روبه‌قبله بایست و نیتِ نماز را در دل بیاور' });
    push({ key:'takbir', name:'تَکبیرهٔ اَحرام', ar:this.TXT.takbir.ar, fa:this.TXT.takbir.fa, reps:1 });
    for(let r = 1; r <= total; r++){
      const last = r === total;
      const rec = r <= 2 ? { ar:this.TXT.hamd.ar, fa:this.TXT.hamd.fa } : { ar:this.TXT.dhikr34.ar, fa:this.TXT.dhikr34.fa };
      push({ key:'qiyam', r, name:'قیام', sub:'رکعتِ ' + U.fa(r) + ' از ' + U.fa(total) + (r <= 2 ? ' — حمد و سوره' : ' — حمد یا ذکرِ واجب'), ar:rec.ar, fa:rec.fa });
      push({ key:'qunut', r, name:'قُنوت', sub:'مستحبّ — پیش از رکوع', ar:this.TXT.qunut.ar, fa:this.TXT.qunut.fa });
      push({ key:'ruku', r, name:'رکوع', ar:this.TXT.ruku.ar, fa:this.TXT.ruku.fa, reps:this.REPS.ruku });
      push({ key:'rise', r, name:'برخاستن از رکوع', ar:this.TXT.rise.ar, fa:this.TXT.rise.fa, reps:this.REPS.rise });
      push({ key:'sujud', r, n:1, name:'سجدهٔ اوّل', ar:this.TXT.sujud.ar, fa:this.TXT.sujud.fa, reps:this.REPS.sujud });
      push({ key:'julus', r, name:'جُلوس', sub:'میانِ دو سجده', ar:this.TXT.julus.ar, fa:this.TXT.julus.fa, reps:this.REPS.julus });
      push({ key:'sujud', r, n:2, name:'سجدهٔ دوم', ar:this.TXT.sujud.ar, fa:this.TXT.sujud.fa, reps:this.REPS.sujud });
      if(r % 2 === 0 && !last) push({ key:'tashahhud', r, name:'تَشَهُّد', sub:'سپس برخیز به رکعتِ ' + U.fa(r + 1), ar:this.TXT.tashahhud.ar, fa:this.TXT.tashahhud.fa });
      if(last){
        push({ key:'tashahhud', r, name:'تَشَهُّدِ آخر', final:true, ar:this.TXT.tashahhud.ar, fa:this.TXT.tashahhud.fa });
        push({ key:'salam', r, name:'سَلام', final:true, ar:this.TXT.salam.ar, fa:this.TXT.salam.fa, reps:1 });
      }
    }
    return steps;
  },
  poseOf(s){ return this.POSE[s && s.key] || 'stand'; },
  blank(len){ return { i:0, reps:new Array(len).fill(0), done:false }; },
  stepOf(steps, st){ return steps ? (steps[U.clamp(st.i, 0, steps.length - 1)] || null) : null; },

  /* ── reducerِ خالص (تست‌پذیر) ──
     next/back/rep از کاربر، pose از حسگر، end از دکمهٔ «تمام شد». */
  reducer(steps, st, act){
    const len = steps.length;
    act = act || { t:'next' };
    const reps = (st && st.reps ? st.reps : []).slice();
    while(reps.length < len) reps.push(0);
    const s = { i:U.clamp(Math.floor(+st.i) || 0, 0, len - 1), reps, done:!!st.done };
    if(act.t === 'goto'){ s.i = U.clamp(Math.floor(+act.i) || 0, 0, len - 1); s.done = false; return s; }
    if(s.done) return s;
    switch(act.t){
      case 'next':
        if(s.i >= len - 1) s.done = true; else s.i++;
        break;
      case 'back':
        if(s.reps[s.i] > 0) s.reps[s.i]--;
        else if(s.i > 0){ s.i--; s.reps[s.i] = 0; }
        break;
      case 'rep': {
        const cur = steps[s.i], need = cur && cur.reps ? cur.reps : 1;
        if(s.reps[s.i] < need){
          s.reps[s.i]++;
          if(s.reps[s.i] >= need){ if(s.i < len - 1) s.i++; else s.done = true; }
        }
        break;
      }
      /* تشخیصِ خودکار فقط «گذارِ مجاور» را جلو می‌برد: حالتِ تازه باید
         حالتِ مرحلهٔ بعدی باشد و با حالتِ مرحلهٔ جاری فرق داشته باشد.
         دو مرحلهٔ هم‌حالت (مثلاً دو سجدهٔ پشت‌سرهم در حالتِ یکسان) را
         حسگر نمی‌تواند از هم بازشناسد — آن‌جا ضربه حرف می‌زند. */
      case 'pose': {
        const nx = steps[s.i + 1];
        if(nx && this.poseOf(nx) === act.p && this.poseOf(steps[s.i]) !== act.p){
          if(steps[s.i].reps) s.reps[s.i] = steps[s.i].reps;
          s.i++;
        }
        break;
      }
      case 'end': s.done = true; break;
      case 'undoDone': s.done = false; break;
      default: break;
    }
    return s;
  },

  /* ── نشستِ نیمه‌کاره ── دیروز نمی‌ماند (sanitize هم پاکش می‌کند) */
  saved(){
    try{
      const m = Store.get('prayerMate') || {};
      if(!m.date || m.date !== U.today() || !m.pray || !SalahFive.NAMES.includes(m.pray)) return null;
      if(m.at && (U.now() - m.at) > 30 * 6e4) return null;      // نیم‌ساعت بی‌اثر ⇒ رهایش کن
      return m;
    }catch(e){ return null; }
  },
  /* نیمهٔ نماز نگه داشته می‌شود تا «ادامه» روی کارت بیاید — بستنِ صفحه یا
     خوابیدنِ گوشی نباید شمارشِ رکعت را دور بریزد. نمازِ تمام‌شده پاک
     می‌شود (جایزه‌اش همان لحظه در دفترچه ثبت شده) و `sanitize` هم هرچه
     به روزِ دیگری مربوط باشد دور می‌ریزد. */
  persist(){
    try{
      const done = !this._st || this._st.done;
      Store.update(d => {
        d.prayerMate = {
          date: done ? '' : U.today(),
          pray: done ? '' : this._pray,
          idx: this._st ? this._st.i : 0,
          at: U.now(),
          reps: this._st ? this._st.reps.slice(0, 80) : [],
          auto: !!NoorSensor.on
        };
      });
    }catch(e){}
  },
  resumeLabel(){
    const m = this.saved();
    if(!m) return '';
    const steps = this.build(m.pray, { rakat:SalahFive.rakat(m.pray) });
    const s = steps[U.clamp(m.idx, 0, steps.length - 1)];
    return (s ? s.name : 'مرحلهٔ بعد') + ' · ' + SalahFive.label(m.pray);
  },

  /* ═══════════ کارتِ صفحهٔ عبادت ═══════════ */
  cardHtml(){
    const cur = (Salah.current && Salah.current(new Date())) || {};
    const done = SalahFive.complete(), n = SalahFive.count();
    const resume = this.resumeLabel();
    const chips = SalahFive.NAMES.map(name => {
      const ok = SalahFive.marked(name);
      const isCur = cur.name === name;
      return `<button class="sj-p${ok ? ' on' : ''}${isCur ? ' cur' : ''}" data-sj-pray="${name}"
                aria-label="${U.esc(SalahFive.label(name))} — ${U.fa(SalahFive.RAKA[name])} رکعت${ok ? '، تمام شده' : ''}"
                title="${U.esc(SalahFive.label(name))} — ${U.fa(SalahFive.RAKA[name])} رکعت">
                <b>${U.esc(SalahFive.label(name))}</b>
                <i>${U.fa(SalahFive.RAKA[name])} رکعت</i>
                ${ok ? '<span class="sj-tick">' + Icon.of('check') + '</span>' : ''}
              </button>`;
    }).join('');
    return `
      <div class="sj-card" id="sjCard">
        <div class="sc-sec-head">
          <span class="sc-sec-title">${Icon.of('mosque')} <b>همراهِ نماز</b></span>
          <small class="sc-sec-sub">${U.fa(n)} از ${U.fa(5)} نمازِ امروز</small>
        </div>
        <div class="sj-top-row">
          <div class="sj-segs" aria-hidden="true">${SalahFive.segsHtml()}</div>
          <span class="sj-streak">${Icon.of('flame')} <b>${U.fa(SalahFive.streak())}</b> روز پیاپی</span>
        </div>
        <div class="sj-chips" role="group" aria-label="کدام نماز را می‌خوانی؟">${chips}</div>
        <div class="sj-raka-sum">${U.fa(17)} رکعتِ نمازهای پنج‌گانِه — با همراهِ نماز می‌توانی رکعت‌ها را بشماری؛ گوشی حالتِ بدن را می‌فهمد و رکعت را خودش جلو می‌برد.</div>
        ${done ? `<div class="sj-all">${Icon.of('sparkle')}<span>نمازهای پنج‌گانهٔ امروز کامل شد — تسبیحاتِ پس از نماز را از ذکرشمار بخوان.</span></div>` : ''}
        ${resume ? `<div class="sj-resume"><span>نمازِ نیمه‌کاره: ${U.esc(resume)}</span>
            <button class="btn gh sm" id="sjResume">${Icon.of('play')}<span>ادامه</span></button></div>` : ''}
        <button class="btn w" id="sjStart">${Icon.of('play')}<span>آغازِ نماز</span></button>
        <p class="sj-fine">یادآورِ مرحله‌ها و رکعت‌هاست، نه مرجعِ فقهی — پرسش‌هایت را در رسالهٔ مرجع بخوان.</p>
      </div>`;
  },
  wire(box){
    U.$$('[data-sj-pray]', box).forEach(b => b.onclick = () => this.open(b.dataset.sjPray));
    const st = U.$('#sjStart', box);
    if(st) st.onclick = () => {
      const m = this.saved();
      const cur = (Salah.current(new Date()) || {}).name;
      try{ Sound.click(); }catch(e){}
      this.open(m ? m.pray : (SalahFive.NAMES.includes(cur) ? cur : 'dhuhr'));
    };
    const rs = U.$('#sjResume', box);
    if(rs) rs.onclick = () => this.open(null, { resume:true });
  },

  /* ═══════════ صفحهٔ تمام‌صفحه ═══════════ */
  open(pray, opt){
    opt = opt || {};
    const m = this.saved();
    if(opt.resume && m) pray = m.pray;
    if(!pray) pray = (Salah.current(new Date()) || {}).name || 'dhuhr';
    if(!SalahFive.NAMES.includes(pray)) pray = 'dhuhr';
    this._pray = pray;
    this._travel = false;
    this._cal = null;
    this._panel = false;
    this._afterMounted = false;
    this._opt = { rakat:SalahFive.rakat(pray) };
    this._steps = this.build(pray, this._opt);
    if(opt.resume && m){
      const reps = Array.isArray(m.reps) ? m.reps.slice(0, this._steps.length).map(x => U.clamp(Math.floor(+x) || 0, 0, 99)) : [];
      while(reps.length < this._steps.length) reps.push(0);
      this._st = { i:U.clamp(Math.floor(m.idx) || 0, 0, this._steps.length - 1), reps, done:false };
    } else {
      this._st = this.blank(this._steps.length);
    }
    this._t0 = U.now(); this._open = true;
    NoorSensor.on = !!(m && m.auto);
    NoorPose.reset();
    this.show();
  },

  show(){
    UI.stage(this.stageHtml(), box => this.mount(box));
  },
  /* مارک‌آصِ صحنه از «نمایش» جداست: هارنسِ Node DOMِ واقعی ندارد، پس
     ساختارِ صفحه را می‌شود مستقیم از رشته سنجید (مثلاً اینکه پایینِ
     صفحه هیچ توضیحی نیست). */
  stageHtml(){
    return `
      <div class="sj-stage" id="sjStage" data-pose="stand">
        <div class="sj-bg" aria-hidden="true"><i></i><i></i><i></i><div class="sj-pat"></div></div>
        <header class="sj-top">
          <button class="sj-ib" id="sjClose" aria-label="بستنِ همراهِ نماز">${Icon.of('close')}</button>
          <div class="sj-who"><b id="sjTitle">—</b><small id="sjRaka">—</small></div>
          <button class="sj-ib" id="sjList" aria-label="فهرستِ مرحله‌ها">${Icon.of('list')}</button>
        </header>
        <div class="sj-flags">
          <button class="sj-flag" id="sjAuto" aria-pressed="false">${Icon.of('signal')}<span>خودکار</span></button>
          <button class="sj-flag" id="sjTravel" aria-pressed="false">${Icon.of('repeat')}<span>مسافر</span></button>
          <button class="sj-flag" id="sjCal" aria-pressed="false">${Icon.of('sliders')}<span>تنظیمِ حالت‌ها</span></button>
          <span class="sj-clock" id="sjClock" dir="ltr">۰۰:۰۰</span>
        </div>
        <main class="sj-body" id="sjBody">
          <div class="sj-fig" id="sjFig">${this.glyph('stand')}</div>
          <div class="sj-step">
            <div class="sj-step-name" id="sjStepName">—</div>
            <div class="sj-step-ar" id="sjStepAr"></div>
            <div class="sj-step-fa" id="sjStepFa"></div>
          </div>
          <div class="sj-reps" id="sjReps"></div>
        </main>
        <div class="sj-prog" role="progressbar" aria-label="پیشرفتِ نماز" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="sjProg"></i></div>
        <nav class="sj-ctl">
          <button class="sj-cb" id="sjBack" aria-label="یک مرحله برگرد">${Icon.of('prev')}<span>بازگشت</span></button>
          <button class="sj-cb sj-go" id="sjNext"><span>مرحلهٔ بعد</span>${Icon.of('next')}</button>
          <button class="sj-cb" id="sjRep" aria-label="یک ذکر اضافه کن">${Icon.of('plus')}<span id="sjRepN">ذکر</span></button>
        </nav>
        <div class="sj-sheet" id="sjSheet" hidden></div>
      </div>`;
  },
  mount(box){
    const on = (id, fn) => {
      const el = U.$(id, box);
      if(el) el.onclick = e => {
        try{ e && e.preventDefault && e.preventDefault(); }catch(err){}
        try{ fn(e); }catch(err){ console.warn('sajjada', err); }
      };
    };
    on('#sjClose', () => this.close());
    on('#sjNext', () => this.act({ t:'next' }));
    on('#sjBack', () => this.act({ t:'back' }));
    on('#sjRep', () => this.act({ t:'rep' }));
    on('#sjAuto', () => this.toggleAuto());
    on('#sjTravel', () => this.toggleTravel());
    on('#sjCal', () => this.openCal());
    on('#sjList', () => this.openList());
    /* کل بدنهٔ صفحه = دکمهٔ «بعدی». وسطِ نماز انگشت روی حلقهٔ ذکر
       نباشد، با یک لمسِ ساده مرحله عوض می‌شود. */
    const body = U.$('#sjBody', box);
    if(body) body.onclick = e => {
      if(this._cal || (this._st && this._st.done)) return;
      const t = e && e.target;
      if(t && t.closest && t.closest('button')) return;
      this.act({ t:'next' });
    };
    UI.onClose = () => this.shutdown();
    try{ NoorWake.ask('sajjada'); }catch(e){}
    this.startClock();
    this.paint();
    if(NoorSensor.on) this.attachSensor();
  },

  /* نگارهٔ حالتِ بدن — خط‌کشیِ ساده، بی چهره */
  glyph(pose){
    const G = {
      stand: '<circle cx="32" cy="11" r="4.6"/><path d="M32 16v21M32 37l-7 14M32 37l7 14M25 23l7 4 7-4"/>',
      ruku:  '<circle cx="47" cy="21" r="4.6"/><path d="M43 24 24 28M24 28v23M24 32l-7 9M41 27l-4 10"/>',
      sujud: '<circle cx="13" cy="44" r="4.6"/><path d="M18 42c7-1 12-5 16-11M34 31l11-4M45 27v10l6 13"/>',
      sit:   '<circle cx="28" cy="14" r="4.6"/><path d="M28 19v21M28 40h16M44 40v11M28 40l-7 11M28 26l11 8"/>'
    };
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><g class="sj-fig-g">${G[pose] || G.stand}</g><path class="sj-ground" d="M5 54h54"/></svg>`;
  },

  paint(){
    if(!this._open || !this._steps) return;
    if(this._cal){ this.paintCal(); return; }   // کالیبراسیون صفحه را در دست دارد
    const steps = this._steps, st = this._st;
    const s = this.stepOf(steps, st);
    const total = steps.length ? (steps[steps.length - 1].r || 1) : 1;
    const raka = st.done ? total : ((s && s.r) || 1);
    const pct = U.clamp(steps.length > 1 ? st.i / (steps.length - 1) : (st.done ? 1 : 0), 0, 1);
    const put = (sel, txt) => { const el = U.$(sel); if(el && el.textContent !== txt) el.textContent = txt; };
    put('#sjTitle', SalahFive.label(this._pray) + (st.done ? ' — تمام شد' : ''));
    put('#sjRaka', st.done
      ? 'سلام داده شد · ' + U.fa(SalahFive.count()) + ' از ' + U.fa(5) + ' نمازِ امروز'
      : 'رکعتِ ' + U.fa(raka) + ' از ' + U.fa(total) + ' · مرحلهٔ ' + U.fa(st.i + 1) + ' از ' + U.fa(steps.length));
    put('#sjStepName', st.done ? 'تَسبیحات و ذکرشمار' : (s ? (s.name + (s.sub ? ' · ' + s.sub : '')) : '—'));
    put('#sjStepAr', st.done ? '' : (s && s.ar ? s.ar : ''));
    put('#sjStepFa', st.done ? '' : (s ? (s.fa || s.hint || '') : ''));
    /* نگاره فقط وقتی حالت عوض شد از نو کشیده می‌شود — وسطِ نماز هیچ
       بازترسیمِ بی‌دلیلی نباید باشد (ضربانِ DOM، لرزشِ تصویر می‌آورد). */
    const fig = U.$('#sjFig');
    if(fig && fig.dataset){
      const p = st.done ? 'sit' : this.poseOf(s);
      if(fig.dataset.pose !== p){
        const wrap = document.createElement('div');
        wrap.innerHTML = this.glyph(p);
        const fresh = wrap.firstElementChild;
        if(fresh){
          fresh.id = 'sjFig'; fresh.className = 'sj-fig'; fresh.dataset.pose = p;
          if(fig.replaceWith) fig.replaceWith(fresh);
          else { fig.dataset.pose = p; fig.innerHTML = fresh.innerHTML; }
        } else fig.dataset.pose = p;
      }
      const stage = U.$('#sjStage');
      if(stage && stage.dataset && stage.dataset.pose !== p) stage.dataset.pose = p;
    }
    const bar = U.$('#sjProg'); if(bar) bar.style.width = Math.round(pct * 100) + '%';
    const wrapP = U.$('.sj-prog'); if(wrapP && wrapP.setAttribute) wrapP.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
    /* شمارشِ ذکرِ همان مرحله — نقطه‌ها، تا بی نگاه‌کردن هم معلوم شود */
    const need = (!st.done && s && s.reps) ? s.reps : 0;
    const dots = U.$('#sjReps');
    if(dots){
      if(need){
        const got = U.clamp((st.reps && st.reps[st.i]) || 0, 0, need);
        let h = '';
        for(let i = 0; i < need; i++) h += `<i class="${i < got ? 'on' : ''}"></i>`;
        const nx = steps[st.i + 1];
        if(nx && this.poseOf(nx) === this.poseOf(s)) h += '<em>همان حالت — با ضربه جلو برو</em>';
        dots.innerHTML = h;
        dots.classList.add('show');
      } else if(dots.innerHTML){ dots.innerHTML = ''; dots.classList.remove('show'); }
    }
    const repN = U.$('#sjRepN'); if(repN) repN.textContent = need ? (U.fa(U.clamp((st.reps && st.reps[st.i]) || 0, 0, need)) + '/' + U.fa(need)) : 'ذکر';
    const a = U.$('#sjAuto'); if(a){ a.setAttribute('aria-pressed', NoorSensor.on ? 'true' : 'false'); a.classList.toggle('on', !!NoorSensor.on); }
    const tr = U.$('#sjTravel'); if(tr){ tr.setAttribute('aria-pressed', this._travel ? 'true' : 'false'); tr.classList.toggle('on', !!this._travel); }
    const cl = U.$('#sjCal'); if(cl) cl.classList.toggle('on', NoorPose.calibrated());
    /* پس از سلام: ذکرشمار داخلِ همان صفحه می‌آید (تسبیحاتِ زهرا (س) و
       بقیهٔ ذکرهای تعقیب) */
    /* پس از سلام: ذکرشمار داخلِ همان صفحه می‌آید (تسبیحاتِ زهرا (س) و بقیهٔ
       ذکرهای تعقیب)؛ اگر شمارشِ نوئی شروع شد، پنل برداشته می‌شود تا جایِ
       رکعت‌شمار را نگیرد. */
    if(st.done){ if(!this._afterMounted){ this.mountAfter(); this._afterMounted = true; } }
    else if(this._afterMounted){
      this._afterMounted = false;
      const bd = U.$("#sjBody"); const x = bd && U.$(".sj-after", bd);
      if(x) x.remove();
    }
  },
  afterHtml(){
    const five = SalahFive.complete();
    const id = Dhikr.by(this._afterDj) ? this._afterDj : Dhikr.ZAHRA;
    const picks = Dhikr.list();
    return `
      ${five ? '<div class="sj-bonus">' + Icon.of('sparkle') + '<span>نمازهای پنج‌گانهٔ امروز کامل شد · ' + U.fa(SalahFive.streak()) + ' روز پیاپی</span></div>' : ''}
      <div class="sj-after-head">${Icon.of('medal')}<span>تعقیباتِ نماز</span>
        <button class="sj-ib sm" id="sjAgain" aria-label="نمازِ بعدی">${Icon.of('repeat')}</button></div>
      ${picks.length > 1 ? `<div class="dj-picks" role="group" aria-label="انتخابِ ذکر">${
        picks.map(x => `<button class="dj-pick${x.id === id ? ' on' : ''}" data-dj-pick="${x.id}"
                  aria-pressed="${x.id === id ? 'true' : 'false'}">${U.esc(x.tab || x.title)}</button>`).join('')}</div>` : ''}
      ${Dhikr.html(id, { compact:true })}
      <button class="btn gh w" id="sjWird" style="margin-top:8px">${Icon.of('book-open')}<span>متنِ کاملِ تعقیب و ادعیه</span></button>`;
  },
  /* ذکرشمارِ پس از سلام — یک‌بار ساخته می‌شود و با انتخابِ ذکر از نو
     می‌نشیند. پنجرهٔ تازه روی این صحنه باز نمی‌کنیم (یک جعبه بیشتر
     نداریم)، پس همه‌چیز داخلِ همان صفحه است. */
  mountAfter(){
    const body = U.$('#sjBody');
    if(!body) return;
    body.innerHTML = `<div class="sj-after">${this.afterHtml()}</div>`;
    const w = U.$('.sj-after', body) || body;
    Dhikr.wire(w, { onTap:() => this.paint() });
    U.$$('[data-dj-pick]', w).forEach(b => b.onclick = () => {
      this._afterDj = b.dataset.djPick;
      try{ Sound.click(); }catch(e){}
      this.mountAfter();
    });
    const again = U.$('#sjAgain', w);
    if(again) again.onclick = () => {
      const i = SalahFive.NAMES.indexOf(this._pray);
      const next = SalahFive.NAMES.slice(i + 1).find(n => !SalahFive.marked(n)) || SalahFive.NAMES[(i + 1) % 5];
      this.open(next);
    };
    const wd = U.$('#sjWird', w);
    if(wd) wd.onclick = () => {
      /* متنِ کاملِ تعقیب در کارتِ ذکرِ همان صفحه است؛ صفحه را می‌بندیم
         و زبانه را روی «تعقیبِ پس از نماز» می‌گذاریم. */
      this.close();
      try{ Router.go('ebadat'); }catch(e){}
      try{
        const box = U.$('#salahCourt');
        if(box && typeof WirdUI !== 'undefined' && WirdUI.paintTab) WirdUI.paintTab(box, 'afterPrayer');
      }catch(e){}
    };
  },

  act(a){
    if(!this._steps) return;
    if(this._cal) return;
    const before = this._st.i, wasDone = !!this._st.done;
    this._st = this.reducer(this._steps, this._st, a);
    if(a.t === 'end' || before !== this._st.i || a.t === 'rep') { try{ this.blip(a); }catch(e){} }
    if(!wasDone && this._st.done) this.finish();
    if(wasDone && a.t === 'rep') { /* ذکرشمار خودش ذخیره می‌کند */ }
    this.persist();
    this.paint();
    try{ Courtyard.invalidateSig && Courtyard.invalidateSig(); }catch(e){}
  },
  /* لرزهٔ تمایزی: هر حالتِ بدن ضرباهنگِ خودش را دارد تا کاربر بی
     نگاه‌کردن به گوشی بفهمد در کدام مرحله است */
  blip(a){
    if(!Store.get('settings') || Store.get('settings').haptics === false) return;
    const s = this.stepOf(this._steps, this._st);
    const pat = { stand:[18], ruku:[16, 60, 16], sujud:[30], sit:[14, 46] }[this.poseOf(s)] || [16];
    try{ if(navigator.vibrate) navigator.vibrate(a.t === 'back' ? [10, 30, 10] : (this._st.done ? [20, 60, 20, 60, 30] : pat)); }catch(e){}
    try{ if(Store.get('settings').sound) Sound.tone(this._st.done ? 660 : 1180, .05, 'sine', .04); }catch(e){}
  },
  finish(){
    const r = SalahFive.mark(this._pray);
    /* ستونِ اوقات هم‌گام بماند (همان سه نمازِ نسخهٔ ۲۱ — جایزه‌اش را
       خودش می‌دهد، پس فقط اگر علامت نخورده بود می‌زنیم) */
    try{ if(typeof SalahLog === 'object' && SalahLog.NAMES.includes(this._pray) && !SalahLog.marked(this._pray)) SalahLog.mark(this._pray); }catch(e){}
    this.persist();
    try{ Adhan.reschedule(); }catch(e){}
    if(r.bonus) UI.toast('🎉 نمازهای پنج‌گانهٔ امروز کامل شد', 'ok', 2600);
  },

  toggleTravel(){
    this._travel = !this._travel;
    this._opt = { rakat:SalahFive.rakat(this._pray, { travel:this._travel }) };
    this._steps = this.build(this._pray, this._opt);
    this._st = this.blank(this._steps.length);
    NoorPose.reset();
    UI.toast(this._travel ? 'مسافر: نمازهای چهاررکعتی دو رکعت خوانده می‌شود' : 'حاضر: رکعت‌ها کامل', '', 2600);
    this.paint();
  },

  /* ── خودکار ── */
  toggleAuto(){
    if(NoorSensor.on){
      NoorSensor.on = false;
      if(this._onPose){ NoorSensor.stopWatch(this._onPose); this._onPose = null; }
      this.paint();
      UI.toast('تشخیصِ خودکار خاموش — با دکمه پیش برو', '', 1800);
      return;
    }
    const on = () => {
      NoorSensor.on = true;
      NoorPose.reset();
      if(!this._onPose){ this._onPose = e => this.onPose(e); NoorSensor.watch(this._onPose); }
      if(!NoorPose.profiles()){
        UI.toast('برای دقتِ بیشتر «تنظیمِ حالت‌ها» را بزن — فعلاً تقریبی کار می‌کند', '', 3000);
      } else UI.toast('تشخیصِ خودکار روشن است', 'ok', 1800);
      this.paint();
    };
    NoorSensor.askMotion(on, () => UI.toast('شتاب‌سنج در این مرورگر باز نمی‌شود — با دکمهٔ «مرحلهٔ بعد» پیش برو', '', 3000));
  },
  attachSensor(){
    if(this._onPose) return;
    this._onPose = e => this.onPose(e);
    NoorSensor.watch(this._onPose);
  },
  onPose(e){
    if(!this._open || !this._steps || !this._st || this._st.done || this._cal) return;
    const p = NoorPose.feed(e, NoorPose.profiles() || NoorPose.guess());
    if(!p) return;
    const steps = this._steps, i = this._st.i;
    if(p === this.poseOf(steps[i])) return;
    const nx = steps[i + 1];
    if(nx && this.poseOf(nx) === p){ this.act({ t:'pose', p }); return; }
    /* حالتِ جاری چند مرحله جلوتر است (کاربر مثلاً سجده را جا انداخت):
       بیش از دو مرحله نمی‌پریم — پرشِ بی‌جواب بدتر از نشانی‌کهنه است. */
    let k = i;
    for(let hops = 0; hops < 2 && k < steps.length - 1; hops++){
      k++;
      if(this.poseOf(steps[k]) === p) break;
    }
    if(k > i && this.poseOf(steps[k]) === p){
      this._st = this.reducer(steps, this._st, { t:'goto', i:k });
      try{ this.blip({ t:'pose' }); }catch(err){}
      this.persist(); this.paint();
      try{ Courtyard.invalidateSig && Courtyard.invalidateSig(); }catch(err){}
    }
  },

  /* ── کالیبراسیونِ حالت‌ها، درونِ همان صفحه (بی پنجرهٔ روی‌پنجره) ── */
  /* صفحهٔ کالیبراسیون همان صفحه است، نه پنجره‌ای رویش: `UI.modal` یک
     جعبه دارد و اگر پنجرهٔ تازه باز کنیم خودِ همراهِ نماش عوض می‌شود. */
  paintCal(){
    const c = this._cal;
    const key = c.keys[c.n];
    const got = (NoorPose._samples && NoorPose._samples.__all[key]) ? NoorPose._samples.__all[key].length : 0;
    const put = (sel, txt) => { const el = U.$(sel); if(el && el.textContent !== txt) el.textContent = txt; };
    put('#sjTitle', 'تنظیمِ حالت‌ها — ' + U.fa(c.n + 1) + ' از ' + U.fa(c.keys.length));
    put('#sjRaka', 'نمونهٔ ' + U.fa(got) + ' از ' + U.fa(4) + ' — گوشی را همان‌طور که در این حالت دست می‌گیری نگه دار');
    put('#sjStepName', NoorPose.LABEL[key] || '—');
    put('#sjStepAr', '');
    put('#sjStepFa', 'تا نوارِ پایین پر شود می‌شماریم؛ بعد حالتِ بعدی');
    const bar = U.$('#sjProg');
    if(bar) bar.style.width = Math.round(U.clamp(got / 4, 0, 1) * 100) + '%';
    const dots = U.$('#sjReps');
    if(dots) dots.innerHTML = '<button class="btn gh sm" id="sjCalSkip">رد کن</button><button class="btn gh sm" id="sjCalStop">بس کن</button>';
    if(dots) dots.classList.add('show');
    const sk = U.$('#sjCalSkip'); if(sk && !sk.onclick) sk.onclick = () => this.calStep();
    const st = U.$('#sjCalStop'); if(st && !st.onclick) st.onclick = () => this.closeCal(true);
    const fig = U.$('#sjFig');
    if(fig && fig.dataset && fig.dataset.pose !== key){
      fig.dataset.pose = key;
      const g = U.$('.sj-fig-g', fig);
      const src = this.glyph(key);
      if(g){ const tmp = document.createElement('div'); tmp.innerHTML = src; const fresh = tmp.firstElementChild && tmp.firstElementChild.querySelector('.sj-fig-g'); if(fresh) g.innerHTML = fresh.innerHTML; }
    }
  },
  openCal(){
    if(this._cal){ this.closeCal(false); return; }        // یک بار دیگر زدن = لغو
    NoorSensor.askMotion(() => {
      this._cal = { keys:['stand', 'ruku', 'sujud'], n:0, until:0 };
      this.showCal();
    }, () => UI.toast('شتاب‌سنج در این مرورگر باز نشد — کالیبراسیون ممکن نیست', 'err', 2800));
  },
  /* نمونهٔ هر حالت ۳٫۲ ثانیه طول می‌کشد؛ در همین پنجره شمارش می‌شود که
     کاربر بتواند گوشی را نگه دارد، نه اینکه با انگشت دکمه بزند. */
  showCal(){
    const c = this._cal;
    if(!c) return;
    c.until = U.now() + 3200;
    NoorPose.begin();                        // هر حالت از صفر نمونه می‌گیرد
    if(!this._calRaw){
      this._calRaw = e => {
        const k = this._cal && this._cal.keys[this._cal.n];
        if(!k || U.now() >= this._cal.until) return;
        if(NoorPose.sample(k, e)) this.paint();
      };
      NoorSensor.watchRaw(this._calRaw);
    }
    if(this._calTick != null){ try{ Timers.clear(this._calTick); }catch(e){} this._calTick = null; }
    this._calTick = Timers.every(() => {
      if(!this._cal) return;
      const left = Math.max(0, this._cal.until - U.now());
      const bar = U.$('#sjProg');
      if(bar) bar.style.width = Math.round(U.clamp(1 - left / 3200, 0, 1) * 100) + '%';
      if(left <= 0) this.calStep();
    }, 150, 'sys');
    this.paint();
  },
  calStep(){
    const c = this._cal;
    if(!c) return;
    c.n++;
    if(c.n >= c.keys.length){ this.closeCal(true); return; }
    this.showCal();
  },
  closeCal(save){
    if(this._calTick != null){ try{ Timers.clear(this._calTick); }catch(e){} this._calTick = null; }
    if(this._calRaw){ NoorSensor.stopRaw(this._calRaw); this._calRaw = null; }
    const prof = NoorPose.build();
    this._cal = null;
    if(save && prof){
      NoorPose.save(prof, true);
      NoorSensor.on = true;
      if(!this._onPose){ this._onPose = e => this.onPose(e); NoorSensor.watch(this._onPose); }
      UI.toast('حالت‌ها روی گوشیِ خودت تنظیم شد', 'ok', 2200);
    } else if(save){
      NoorPose.save(NoorPose.guess(), false);
      UI.toast('نمونهٔ کافی گرفته نشد — تنظیمِ پیش‌فرض گذاشته شد (تقریبی)', '', 3000);
    }
    this.paint();
  },

  /* ── صفحهٔ مرحلهها (درورونِ همان صفحه، بی پنجرهٔ روی‌پنجره) ── */
  openList(){
    const sheet = U.$('#sjSheet');
    if(!sheet) return;
    if(this._panel){ sheet.hidden = true; sheet.innerHTML = ''; this._panel = false; return; }
    this._panel = true;
    const steps = this._steps || [];
    sheet.hidden = false;
    sheet.innerHTML = `
      <div class="sj-list">
        <div class="sj-list-head"><b>مرحلهٔ ${U.esc(SalahFive.label(this._pray))}</b>
          <button class="sj-ib sm" id="sjListX" aria-label="بستن">${Icon.of('close')}</button></div>
        <div class="sj-list-body">
          ${steps.map((s, i) => `<button class="sj-li${i === this._st.i ? ' on' : ''}${i < this._st.i ? ' done' : ''}" data-sj-go="${i}">
              <i>${U.fa(i + 1)}</i><span>${U.esc(s.name)}</span><em>${U.fa(s.r || 1)}</em></button>`).join('')}
        </div>
      </div>`;
    const x = U.$('#sjListX', sheet);
    if(x) x.onclick = () => { this._panel = false; sheet.hidden = true; sheet.innerHTML = ''; };
    U.$$('[data-sj-go]', sheet).forEach(b => b.onclick = () => {
      this._panel = false; sheet.hidden = true; sheet.innerHTML = '';
      this.act({ t:'goto', i:+b.dataset.sjGo });
    });
  },

  startClock(){
    if(this._tickId != null) return;
    try{
      this._tickId = Timers.every(() => {
        const el = U.$('#sjClock');
        if(!el) return;
        const ms = Math.max(0, U.now() - this._t0);
        const m = Math.floor(ms / 6e4), s = Math.floor((ms % 6e4) / 1e3);
        el.textContent = U.fa(String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'));
      }, 1000, 'sys');
    }catch(e){}
  },
  close(){ try{ UI.closeModal(); }catch(e){} this.shutdown(); },
  shutdown(){
    if(this._cal){ if(this._calTick != null){ try{ Timers.clear(this._calTick); }catch(e){} this._calTick = null; }
      if(this._calRaw) NoorSensor.stopRaw(this._calRaw);
      this._calRaw = null; this._cal = null; }
    this._open = false;
    if(this._tickId != null){ try{ Timers.clear(this._tickId); }catch(e){} this._tickId = null; }
    if(this._onPose){ NoorSensor.stopWatch(this._onPose); this._onPose = null; }
    try{ NoorWake.release('sajjada'); }catch(e){}
    /* اول ذخیره، بعد پاک‌کردنِ وضعیت: `persist` از روی `_st` می‌فهمد نماز
       نیمه‌کاره است (نگهش دارد) یا تمام‌شده (پاکش می‌کند). اگر پیش از
       persist صفرش کنیم، «ادامه» هیچ‌وقت روی کارت نمی‌آید. */
    if(this._st) this.persist();
    this._steps = this._st = null;
    try{ Courtyard.invalidateSig && Courtyard.invalidateSig(); Courtyard.render(); }catch(e){}
  }
};

/* ═══════════════ ۵. حسگرِ مشترکِ قبله‌نما و همراهِ نماز ═══════════════
   دو شنوندهٔ جهانی، یک‌بار و برای همیشه؛ هر مصرف‌کنندهٔ فعال در فهرستِ
   خودش است. بی این لایه، هر پنجرهٔ تازه‌ای یک شنوندهٔ جدید می‌نشاند و
   پس از بستن، شنونده‌ها روی صفحهٔ مرده می‌ماندند (نشتِ کلاسیک). */
const NoorSensor = {
  on:false, _ori:new Set(), _mot:new Set(), _raw:new Set(), _oriOn:false, _motOn:false,
  oriAvail(){ try{ return typeof window !== 'undefined' && ('DeviceOrientationEvent' in window || 'DeviceOrientationAbsoluteEvent' in window); }catch(e){ return false; } },
  motAvail(){ try{ return typeof window !== 'undefined' && 'DeviceMotionEvent' in window; }catch(e){ return false; } },
  bind(){
    if(!this._oriOn && this.oriAvail()){
      this._oriOn = true;
      const f = e => { this._ori.forEach(cb => { try{ cb(e); }catch(err){} }); };
      try{ window.addEventListener('deviceorientationabsolute', f); }catch(e){}
      try{ window.addEventListener('deviceorientation', f); }catch(e){}
      try{ window.addEventListener('compassneedscalibration', () => this._ori.forEach(cb => { try{ cb({ needCalib:true }); }catch(err){} })); }catch(e){}
    }
    if(!this._motOn && this.motAvail()){
      this._motOn = true;
      const f = e => {
        this._mot.forEach(cb => { try{ cb(e); }catch(err){} });
        this._raw.forEach(cb => { try{ cb(e); }catch(err){} });
      };
      try{ window.addEventListener('devicemotion', f); }catch(e){}
    }
  },
  /* اجازهٔ iOS باید از ژستِ کاربر بیاید؛ اگر لازم نبود همان‌جا ادامه */
  ask(kind, then, fail){
    const W = (typeof window !== 'undefined') ? window : {};
    const motion = kind === 'motion';
    const Ctor = motion ? W.DeviceMotionEvent : W.DeviceOrientationEvent;
    const ok = () => { this.bind(); try{ then && then(); }catch(e){} };
    try{
      if(motion ? !this.motAvail() : !this.oriAvail()){ fail && fail('none'); return false; }
      if(Ctor && typeof Ctor.requestPermission === 'function'){
        Promise.resolve(Ctor.requestPermission()).then(r => {
          if(r === 'granted') ok(); else fail && fail(r);
        }).catch(() => { fail && fail('err'); });
        return true;
      }
      ok();
      return true;
    }catch(e){ fail && fail(e); return false; }
  },
  askMotion(then, fail){ return this.ask('motion', then, fail); },
  askOri(then, fail){ return this.ask('orientation', then, fail); },
  watch(cb){ this.bind(); this._mot.add(cb); },
  stopWatch(cb){ this._mot.delete(cb); },
  watchOri(cb){ this.bind(); this._ori.add(cb); },
  stopOri(cb){ this._ori.delete(cb); },
  watchRaw(cb){ this.bind(); this._raw.add(cb); },
  stopRaw(cb){ this._raw.delete(cb); },
  count(){ return this._ori.size + this._mot.size + this._raw.size; }
};

/* ═══════════════ ۶. بیدار نگه‌داشتنِ صفحه ═══════════════
   قبله‌نما و همراهِ نماز وسطِ کارِ کاربر باز می‌شوند؛ اگر صفحه بخوابد
   شمارشِ رکعت و هم‌راستایی با حسگر می‌شکند. «درخواست» است نه فرمان:
   نبودش هیچ چیزی را خراب نمی‌کند. تبِ پس‌زمینه قفل را می‌سوزاند، پس با
   بازگشت دوباره گرفته می‌شود. */
const NoorWake = {
  _locks:{},
  avail(){ try{ return typeof navigator !== 'undefined' && !!navigator.wakeLock && typeof navigator.wakeLock.request === 'function'; }catch(e){ return false; } },
  ask(tag){
    if(!this.avail() || this._locks[tag]) return Promise.resolve(!!this._locks[tag]);
    return Promise.resolve()
      .then(() => navigator.wakeLock.request('screen'))
      .then(l => {
        this._locks[tag] = l;
        try{ l.addEventListener && l.addEventListener('release', () => { delete this._locks[tag]; }); }catch(e){}
        return true;
      })
      .catch(() => false);
  },
  release(tag){
    const l = this._locks[tag];
    if(!l) return Promise.resolve(false);
    delete this._locks[tag];
    try{ return Promise.resolve(l.release()).then(() => true, () => false); }catch(e){ return Promise.resolve(false); }
  },
  rearm(){
    try{
      if(typeof document === 'undefined' || !document.addEventListener) return;
      document.addEventListener('visibilitychange', () => {
        if(!document.visibilityState || document.visibilityState !== 'visible') return;
        Object.keys(this._locks).forEach(t => { this._locks[t] = null; this.ask(t); });
      });
    }catch(e){}
  }
};
try{ NoorWake.rearm(); }catch(e){}

/* ═══════════════ اتصال به برنامه (بی‌بازنویسیِ چیزی) ═══════════════ */
(function attachSajjada(){
  /* ۱) کارتِ همراهِ نماز پس از کارتِ قبله و پیش از ذکر می‌نشیند، تا
        روایتِ صفحه «وقت ← قبله ← نماز ← ذکر» حفظ شود. */
  try{
    if(typeof Courtyard === 'object' && Courtyard.qiblaCardHtml && !Courtyard.qiblaCardHtml._sj){
      const _q = Courtyard.qiblaCardHtml.bind(Courtyard);
      Courtyard.qiblaCardHtml = function(){ return _q() + Sajjada.cardHtml(); };
      Courtyard.qiblaCardHtml._sj = true;
    }
    if(typeof Courtyard === 'object' && Courtyard.wire && !Courtyard.wire._sj){
      const _w = Courtyard.wire.bind(Courtyard);
      Courtyard.wire = function(box){
        _w(box);
        try{ Sajjada.wire(box); }catch(e){ console.warn('sajjada wire', e); }
      };
      Courtyard.wire._sj = true;
    }
    /* امضای رندرِ صفحه باید نشستنِ نیمه‌کاره را هم ببیند، وگرنه پس از
       بستنِ صفحهٔ تمام‌صفحه نشانِ «ادامه» روی صفحه نمی‌آید. */
    if(typeof Courtyard === 'object' && Courtyard._buildSig && !Courtyard._buildSig._sj){
      const _b = Courtyard._buildSig.bind(Courtyard);
      Courtyard._buildSig = function(){
        let m = '';
        try{ const s = Sajjada.saved(); m = s ? (s.pray + ':' + s.idx) : ''; }catch(e){}
        return _b() + '|sj:' + m + ':' + SalahFive.count();
      };
      Courtyard._buildSig._sj = true;
    }
  }catch(e){ console.warn('sajjada courtyard', e); }

  /* ۲) مأموریت‌ها — «پنج نمازِ امروز» و «ذکرشمار به هدف». استخر با
        پوششِ `wird-1.js` هم‌گام است؛ این‌جا فقط دو تا افزوده می‌شود. */
  try{
    if(typeof Missions === 'object' && Missions.key && !Missions.key._sj){
      const M5 = { id:'pray5all', icon:'🕌', t:'هر پنج نمازِ واجبهٔ امروز را تمام کن', d:'با همراهِ نماز — ۱۷ رکعت', goal:5, pts:80 };
      const MD = { id:'dhikr1',  icon:'📿', t:'یک ذکرشمار را به هدف برسان',      d:'ذکر و تعقیبات — صفحهٔ عبادت', goal:1, pts:40 };
      Missions.WORSHIP_POOL = (Missions.WORSHIP_POOL || []).concat([M5, MD]);
      Missions._syncPoolSj = function(){
        const has = id => this.POOL.some(m => m.id === id);
        if(!has(M5.id)) this.POOL.push(M5);
        if(!has(MD.id)) this.POOL.push(MD);
      };
      const _sync = Missions._syncPool;
      Missions._syncPool = function(){
        try{ _sync.call(this); }catch(e){}
        try{ this._syncPoolSj(); }catch(e){}
      };
      const _k = Missions.key.bind(Missions);
      Missions.key = function(id){
        switch(id){
          case 'pray5all': return SalahFive.count();
          case 'dhikr1':   return Dhikr.PRESETS.filter(p => Dhikr.doneToday(p.id)).length;
          default:         return _k(id);
        }
      };
      /* پرچم‌های پوششِ قبلی روی تابعِ تازه هم می‌مانند (سنجش‌های ۱۹
         همان‌ها را می‌بینند) */
      try{ Missions.key._worshipWrapped = true; }catch(e){}
      Missions.key._sj = true;
    }
  }catch(e){ console.warn('sajjada missions', e); }
})();

/* در محیطِ CommonJS (هارنس/تستِ مستقل) هم قابل‌استفاده باشد */
if(typeof module !== 'undefined' && module.exports){
  module.exports = { SalahFive, Dhikr, NoorPose, Sajjada, NoorSensor, NoorWake };
}
