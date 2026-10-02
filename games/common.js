/* نورستان — ابزار مشترک بازی‌های مستقل: صدا، لرزش، ذرات، رکورد، رقم فارسی */
const G = (() => {
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const $ = s => document.querySelector(s);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const muted = () => { try { return localStorage.getItem('noorestan_g_mute') === '1'; } catch { return false; } };
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
  };
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };
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
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
    if (v != null && v > b) { try { localStorage.setItem(k, v); } catch {} return { best: v, isNew: true }; }
    return { best: b, isNew: false };
  };
  let tt;
  const toast = (msg, ms = 2200) => { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), ms); };
  const hearts = (el, n, max = 3, broke = false) => { el.innerHTML = ''; for (let i = 0; i < max; i++) { const h = document.createElement('i'); if (i >= n) h.className = 'off'; if (broke && i === n) h.classList.add('break'); el.appendChild(h); } };
  const reshake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
  // نرمال‌سازی عربی برای مقایسهٔ بی‌اعراب
  const norm = s => String(s).replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه').replace(/[^\u0621-\u064A]/g, '');
  document.addEventListener('DOMContentLoaded', () => { document.body.appendChild(cv); fit(); });
  return { fa, $, shuffle, sfx, buzz, burst, confetti, best, toast, hearts, reshake, norm, muted };
})();
