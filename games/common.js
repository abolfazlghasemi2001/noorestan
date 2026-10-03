/* نورستان — ابزار مشترک بازی‌های مستقل: صدا، لرزش، ذرات، رکورد، رقم فارسی، صفحهٔ نتیجهٔ سینمایی،
   نمایهٔ بازیکن (XP، سطح، روزهای پیاپی، دستاوردها) و چالش روزانه */
const G = (() => {
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const $ = s => document.querySelector(s);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const muted = () => { try { return localStorage.getItem('noorestan_g_mute') === '1'; } catch { return false; } };
  const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  let ac = null;
  const tone = (f = 440, d = .12, type = 'sine', v = .18, delay = 0) => {
    if (muted()) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02);
    } catch {}
  };
  const sfx = {
    tap: () => tone(660, .07, 'triangle', .12),
    ok: () => { tone(784, .12, 'sine', .16); tone(1046, .18, 'sine', .14, .07); },
    bad: () => { tone(220, .2, 'sawtooth', .08); tone(160, .25, 'sawtooth', .07, .06); },
    win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .25, 'sine', .14, i * .09)),
    lvl: () => [440, 554, 659, 880].forEach((f, i) => tone(f, .18, 'triangle', .12, i * .06)),
    tick: () => tone(1200, .03, 'square', .04),
    star: i => { tone(880 + i * 220, .22, 'sine', .15); tone(1320 + i * 220, .3, 'triangle', .08, .05); },
  };
  const noBuzz = () => { try { return localStorage.getItem('noorestan_g_nobuzz') === '1'; } catch { return false; } };
  const buzz = p => { if (noBuzz()) return; try { navigator.vibrate && navigator.vibrate(p); } catch {} };
  // ذرات
  const cv = document.createElement('canvas'); cv.id = 'fx';
  const ctx = cv.getContext('2d'); let parts = [], running = false;
  const fit = () => { const r = devicePixelRatio || 1; cv.width = innerWidth * r; cv.height = innerHeight * r; ctx.setTransform(r, 0, 0, r, 0, 0); };
  addEventListener('resize', fit);
  const loop = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life -= 1; p.rot += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      if (p.star) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? p.s * .45 : p.s; const a = i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); }
      else ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6);
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else running = false;
  };
  const burst = (x, y, n = 26, colors = ['#f5c96a', '#ffdf91', '#ffb347', '#fff'], star = true) => {
    if (calm()) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: .14, s: 4 + Math.random() * 6, c: colors[i % colors.length], life: 50 + Math.random() * 30, max: 80, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, star });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  };
  const confetti = () => { for (let i = 0; i < 6; i++) setTimeout(() => burst(Math.random() * innerWidth, innerHeight * .25, 30, ['#f5c96a', '#3ddc97', '#7aa2ff', '#ff8a5c', '#fff'], false), i * 140); };
  const best = (key, v) => {
    const k = 'noorestan_g_' + key + '_best';
    let b = 0; try { b = +localStorage.getItem(k) || 0; } catch {}
    if (v != null && v > b) { try { localStorage.setItem(k, v); } catch {} return { best: v, isNew: true, prev: b }; }
    return { best: b, isNew: false, prev: b };
  };
  /* بهترین ستارهٔ هر بازی؛ کارت‌های فهرست بازی‌ها از همین می‌خوانند */
  const stars = (key, v) => {
    const k = 'noorestan_g_' + key + '_stars';
    let b = 0; try { b = +localStorage.getItem(k) || 0; } catch {}
    if (v != null && v > b) { try { localStorage.setItem(k, v); } catch {} return v; }
    return b;
  };
  let tt;
  const toast = (msg, ms = 2200) => { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), ms); };
  const hearts = (el, n, max = 3, broke = false) => { el.innerHTML = ''; for (let i = 0; i < max; i++) { const h = document.createElement('i'); if (i >= n) h.className = 'off'; if (broke && i === n) h.classList.add('break'); el.appendChild(h); } };
  const reshake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
  // نرمال‌سازی عربی برای مقایسهٔ بی‌اعراب
  const norm = s => String(s).replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه').replace(/[^\u0621-\u064A]/g, '');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ── پل امتیاز به برنامهٔ اصلی ──────────────────────────────────────
     بازی‌های games/ صفحهٔ جدا هستند و به Progress.award در index.html
     دسترسی ندارند. پس نتیجه در صفِ noorestan_g_pending می‌نشیند و اگر
     بازی داخل iframe باز شده باشد، یک postMessage هم به والد می‌رود.
     برنامهٔ اصلی صف را می‌خواند، سکه می‌دهد و خالی‌اش می‌کند. */
  const report = (game, score, starsN) => {
    const item = { game, score, stars: starsN, at: Date.now() };
    try {
      const q = JSON.parse(localStorage.getItem('noorestan_g_pending') || '[]');
      q.push(item); localStorage.setItem('noorestan_g_pending', JSON.stringify(q.slice(-50)));
    } catch {}
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ t: 'noorestan:game-result', ...item }, location.origin); } catch {}
  };

  /* ── صفحهٔ نتیجهٔ سینمایی ───────────────────────────────────────────
     شمارش امتیاز با صدای تیک، ۰ تا ۳ ستاره با پرش، مقایسهٔ میله‌ای با
     رکورد پیشین و هم‌رسانیِ تصویری (کارت ۱۰۸۰×۱۳۵۰). با reduced-motion
     همه‌چیز بی‌انیمیشن و فوری نشان داده می‌شود. */
  const countUp = (node, to, ms, onTick) => new Promise(res => {
    if (calm() || to <= 0) { node.textContent = fa(to); return res(); }
    const t0 = performance.now(); let lastTick = 0;
    const step = now => {
      const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3), v = Math.round(to * e);
      node.textContent = fa(v);
      if (now - lastTick > 55 && p < 1) { lastTick = now; onTick && onTick(); }
      if (p < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));

  const shareCard = async o => {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#24306b'); bg.addColorStop(.55, '#0b1026'); bg.addColorStop(1, '#3a1f4f');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.globalAlpha = .08; x.strokeStyle = '#f5c96a'; x.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const cx = (i * 197) % W, cy = (i * 311) % H; x.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 14 : 34, a = k * Math.PI / 5; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.stroke(); }
    x.globalAlpha = 1; x.textAlign = 'center'; x.direction = 'rtl';
    const font = (w, s) => `${w} ${s}px Vazirmatn, Tahoma, sans-serif`;
    const gold = x.createLinearGradient(0, 0, W, 0); gold.addColorStop(0, '#ffdf91'); gold.addColorStop(1, '#f5a623');
    x.fillStyle = '#c9d1f5'; x.font = font(700, 44); x.fillText('نورستان', W / 2, 150);
    x.fillStyle = gold; x.font = font(900, 84); x.fillText(o.game, W / 2, 270);
    for (let i = 0; i < 3; i++) {
      const cx = W / 2 + (1 - i) * 170, cy = 470, on = i < o.stars;
      x.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 36 : 82, a = -Math.PI / 2 + k * Math.PI / 5; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath();
      x.fillStyle = on ? gold : 'rgba(255,255,255,.12)'; x.fill();
    }
    x.fillStyle = gold; x.font = font(900, 220); x.fillText(fa(o.score), W / 2, 820);
    x.fillStyle = '#c9d1f5'; x.font = font(700, 46); x.fillText('امتیاز', W / 2, 900);
    if (o.isNew) { x.fillStyle = '#3ddc97'; x.font = font(800, 52); x.fillText('🏆 رکورد تازه!', W / 2, 1010); }
    x.fillStyle = 'rgba(201,209,245,.75)'; x.font = font(500, 36); x.fillText((o.lines || []).join(' · '), W / 2, 1110);
    x.fillStyle = 'rgba(245,201,106,.8)'; x.font = font(700, 34); x.fillText('تو هم بازی کن: ' + location.host, W / 2, 1260);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'noorestan-result.png', { type: 'image/png' });
    const text = `در «${o.game}» نورستان ${fa(o.score)} امتیاز گرفتم ${'⭐'.repeat(o.stars)}`;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('تصویر نتیجه ذخیره شد');
  };

  /* ── نمایهٔ بازیکن ─────────────────────────────────────────────────
     XP از هر بازی: یک‌دهم امتیاز + ۲۰ برای هر ستاره، در چالش روزانه ×۲.
     سطح = ⌊√(XP/50)⌋+1 — هر سطح کمی دیرتر از قبلی می‌رسد ولی هیچ‌وقت
     دست‌نیافتنی نمی‌شود. روزِ پیاپی با تاریخ محلی شمرده می‌شود. */
  const GAMES = {
    ayahbuilder: { name: 'آیه‌ساز', href: 'ayah-builder.html', art: 'art/ayah-builder.svg' },
    hadithrush: { name: 'باران حکمت', href: 'hadith-rush.html', art: 'art/hadith-rush.svg' },
    noorpairs: { name: 'جفت نور', href: 'noor-pairs.html', art: 'art/noor-pairs.svg' },
  };
  const gameOf = key => String(key).split('_')[0];
  const TITLES = ['نوآموز', 'جویا', 'رهرو', 'دانش‌پژوه', 'قاری', 'حافظ', 'استاد', 'نورانی'];
  const ACH = {
    first: { ic: '🌱', name: 'نخستین گام', desc: 'اولین بازی‌ات را تمام کردی' },
    star3: { ic: '⭐', name: 'سه‌ستاره', desc: 'یک بازی را با ۳ ستاره تمام کردی' },
    s1000: { ic: '💎', name: 'هزاری', desc: 'در یک بازی ۱۰۰۰ امتیاز گرفتی' },
    all: { ic: '🧭', name: 'جهانگرد', desc: 'هر سه بازی را دست‌کم یک بار بازی کردی' },
    streak3: { ic: '🔥', name: 'سه روز پیاپی', desc: '۳ روز پشت سر هم بازی کردی' },
    streak7: { ic: '🏅', name: 'یک هفتهٔ نورانی', desc: '۷ روز پشت سر هم بازی کردی' },
    daily: { ic: '📅', name: 'چالش روز', desc: 'چالش روزانه را انجام دادی' },
    lvl5: { ic: '👑', name: 'سطح ۵', desc: 'به سطح ۵ رسیدی' },
  };
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const dayNum = (d = new Date()) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5);
  const loadProfile = () => {
    let p = null; try { p = JSON.parse(localStorage.getItem('noorestan_g_profile') || 'null'); } catch {}
    return Object.assign({ xp: 0, plays: 0, lastDay: null, streak: 0, bestStreak: 0, played: {}, ach: [], dailyDone: null }, p || {});
  };
  const saveProfile = p => { try { localStorage.setItem('noorestan_g_profile', JSON.stringify(p)); } catch {} };
  const levelOf = xp => {
    const lvl = Math.floor(Math.sqrt(xp / 50)) + 1;
    const from = 50 * (lvl - 1) ** 2, to = 50 * lvl ** 2;
    return { lvl, title: TITLES[Math.min(lvl - 1, TITLES.length - 1)], from, to, pct: (xp - from) / (to - from) };
  };
  /* چالش روزانه: هر روز یک بازی، برای همه یکسان (از شمارهٔ روز) */
  const daily = () => { const keys = Object.keys(GAMES); return keys[dayNum() % keys.length]; };
  const award = (key, score, starsN) => {
    const p = loadProfile(), before = levelOf(p.xp).lvl, game = gameOf(key), today = dayNum();
    const isDaily = daily() === game && p.dailyDone !== dayKey();
    let xp = Math.round(score / 10 + starsN * 20);
    if (isDaily) { xp *= 2; p.dailyDone = dayKey(); }
    p.xp += xp; p.plays++; p.played[game] = (p.played[game] || 0) + 1;
    if (p.lastDay !== today) { p.streak = p.lastDay === today - 1 ? p.streak + 1 : 1; p.lastDay = today; }
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    const got = [], give = id => { if (!p.ach.includes(id)) { p.ach.push(id); got.push(id); } };
    give('first');
    if (starsN >= 3) give('star3');
    if (score >= 1000) give('s1000');
    if (Object.keys(GAMES).every(g => p.played[g])) give('all');
    if (p.streak >= 3) give('streak3');
    if (p.streak >= 7) give('streak7');
    if (isDaily) give('daily');
    const L = levelOf(p.xp); if (L.lvl >= 5) give('lvl5');
    saveProfile(p);
    return { xp, isDaily, levelUp: L.lvl > before, level: L, streak: p.streak, got };
  };
  const profile = () => { const p = loadProfile(); return { ...p, level: levelOf(p.xp), daily: daily(), dailyDone: p.dailyDone === dayKey() }; };

  let resEl = null;
  const result = async o => {
    /* o = { key, game, title, score, stars(0..3), lines:[...], onAgain } */
    const rec = best(o.key, o.score);
    stars(o.key, o.stars);
    report(o.key, o.score, o.stars);
    const aw = award(o.key, o.score, o.stars);
    if (!resEl) { resEl = document.createElement('div'); resEl.className = 'overlay res'; resEl.id = 'result'; document.body.appendChild(resEl); }
    const max = Math.max(o.score, rec.prev, 1);
    resEl.innerHTML = `<div class="card res-card">
      <div class="mut res-title">${esc(o.title)}</div>
      <div class="res-stars">${[0, 1, 2].map(i => `<i data-s="${i}"></i>`).join('')}</div>
      <div class="big res-score" id="resScore">۰</div>
      <div class="res-new" id="resNew">🏆 رکورد تازه!</div>
      <div class="res-cmp">
        <div class="res-bar"><span>این بار</span><b><i id="barNow"></i></b><em>${fa(o.score)}</em></div>
        <div class="res-bar prev"><span>رکورد پیشین</span><b><i id="barPrev"></i></b><em>${rec.prev ? fa(rec.prev) : '—'}</em></div>
      </div>
      <p class="mut res-lines">${(o.lines || []).map(esc).join('<br>')}</p>
      <div class="res-xp">
        <div class="res-xp-top"><span>سطحِ ${fa(aw.level.lvl)} · ${esc(aw.level.title)}</span><b>+${fa(aw.xp)} XP${aw.isDaily ? ' · 📅 چالش روز ×۲' : ''}</b></div>
        <div class="res-xp-bar"><i id="resXp"></i></div>
        <div class="res-lvlup" id="resLvl">⬆️ سطح تازه: ${fa(aw.level.lvl)} — ${esc(aw.level.title)}</div>
        ${aw.streak > 1 ? `<div class="res-streak">🔥 ${fa(aw.streak)} روز پیاپی</div>` : ''}
      </div>
      <div class="res-ach" id="resAch">${aw.got.map(id => `<span class="ach-chip" title="${esc(ACH[id].desc)}">${ACH[id].ic} ${esc(ACH[id].name)}</span>`).join('')}</div>
      <div class="res-row">
        <button class="btn" id="resAgain">دوباره</button>
        <button class="btn-ghost" id="resShare">📤 هم‌رسانی</button>
        <a class="btn-ghost" href="./">بازی‌ها</a>
      </div>
    </div>`;
    resEl.querySelector('#resAgain').onclick = () => { resEl.classList.remove('on'); o.onAgain && o.onAgain(); };
    resEl.querySelector('#resShare').onclick = () => shareCard({ ...o, isNew: rec.isNew }).catch(() => toast('هم‌رسانی ممکن نشد'));
    resEl.classList.add('on');
    await wait(350);
    await countUp(resEl.querySelector('#resScore'), o.score, 1300, sfx.tick);
    const prevW = rec.prev / max * 100, nowW = o.score / max * 100;
    resEl.querySelector('#barPrev').style.width = prevW + '%';
    resEl.querySelector('#barNow').style.width = nowW + '%';
    for (let i = 0; i < o.stars; i++) {
      await wait(280);
      const s = resEl.querySelector(`[data-s="${i}"]`); s.classList.add('on');
      sfx.star(i); buzz(18);
      const r = s.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 18);
    }
    if (rec.isNew && o.score > 0) { await wait(250); resEl.querySelector('#resNew').classList.add('on'); sfx.win(); confetti(); }
    await wait(200);
    resEl.querySelector('#resXp').style.width = Math.round(aw.level.pct * 100) + '%';
    if (aw.levelUp) { await wait(500); resEl.querySelector('#resLvl').classList.add('on'); sfx.lvl(); confetti(); }
    [...resEl.querySelectorAll('.ach-chip')].forEach((c, i) => setTimeout(() => { c.classList.add('on'); sfx.star(i % 3); }, calm() ? 0 : 300 + i * 260));
    return { ...rec, award: aw };
  };

  document.addEventListener('DOMContentLoaded', () => { document.body.appendChild(cv); fit(); });
  return { fa, $, shuffle, sfx, buzz, burst, confetti, best, stars, toast, hearts, reshake, norm, muted, noBuzz, esc, result, report, profile, award, daily, levelOf, GAMES, ACH, calm };
})();
