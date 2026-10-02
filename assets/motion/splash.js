/* ═══════════════════════════════════════════════════════════════════
   نورستان — Splash (فاز ۲ موشن، مرحلهٔ ۲)

   جایگاه: درست بعد از تگ <body> در index.html، همزمان (بی defer):
     <script src="./assets/motion/splash.js"></script>
   همزمان است تا لایه پیش از نخستین نقاشیِ برنامه بنشیند؛ فایل کوچک است و
   از شاخهٔ /assets/ِ سرویس‌ورکر (اول کش) می‌آید. سبک‌ها در motion.css هستند.

   قاعده‌ها:
   • فقط یک بار در هر نشست (sessionStorage)؛ بازگشت به برنامه معطل نمی‌کند.
   • با prefers-reduced-motion، html[data-motion="off"]، مرورگرِ خودکار
     (navigator.webdriver — تا _shots و آزمون‌ها نشکنند) یا ?nosplash اصلاً ساخته نمی‌شود.
   • حداقل ۱.۳ ثانیه (تا حرکت ناقص نبرد)، حداکثر ۲.۴ ثانیه حتی اگر load نیاید.
   • با لمس، کلید یا پنهان شدنِ تب فوراً می‌رود.
   • فقط transform و opacity متحرک می‌شوند؛ هیچ حلقهٔ requestAnimationFrameی نیست.
   • پایانش رویدادِ window «nr:splash-done» می‌فرستد تا Onboarding/Hero بعداً به آن گوش دهند.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var d = document, root = d.documentElement, KEY = 'nr-splash-seen';

  function skip(){
    if (navigator.webdriver) return true;
    if (/[?&]nosplash\b/.test(location.search)) return true;
    if (root.getAttribute('data-motion') === 'off') return true;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    try {
      if (sessionStorage.getItem(KEY)) return true;
      sessionStorage.setItem(KEY, '1');
    } catch (e) { /* حالتِ خصوصی: هر بارگذاری یک بار، اشکالی ندارد */ }
    return false;
  }
  if (skip()) return;

  var MIN = 1300, MAX = 2400, OUT = 450, t0 = Date.now(), done = false;

  /* نشان: طاقِ فانوسی (همان شکلِ .logo)، هلال و ستارهٔ هشت‌پرِ خاتم */
  var MARK =
    '<svg viewBox="0 0 120 132" focusable="false">' +
      '<defs>' +
        '<linearGradient id="nrsG" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#f3dea8"/><stop offset="1" stop-color="#cfae62"/>' +
        '</linearGradient>' +
        '<mask id="nrsM"><rect width="120" height="132" fill="#fff"/>' +
          '<circle cx="68" cy="60" r="20" fill="#000"/></mask>' +
      '</defs>' +
      '<path d="M60 4C89 4 112 26 112 58V120a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8V58C8 26 31 4 60 4Z" fill="url(#nrsG)"/>' +
      '<circle cx="58" cy="68" r="24" fill="#0b2326" mask="url(#nrsM)"/>' +
      '<rect x="78" y="44" width="8" height="8" fill="#0b2326"/>' +
      '<rect x="78" y="44" width="8" height="8" fill="#0b2326" transform="rotate(45 82 48)"/>' +
    '</svg>';

  var dots = '';
  for (var i = 0; i < 12; i++) dots += '<i style="--i:' + i + '"></i>';

  var el = d.createElement('div');
  el.id = 'nr-splash';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="nrs-stage">' +
      '<div class="nrs-glow"></div>' +
      '<div class="nrs-orbit">' + dots + '</div>' +
      '<div class="nrs-mark">' + MARK + '<span class="nrs-shine"></span></div>' +
    '</div>' +
    '<div class="nrs-name">نورستان</div>';
  (d.body || root).appendChild(el);
  root.classList.add('nr-splashing');

  function finish(){
    if (done) return;
    done = true;
    el.classList.add('out');
    setTimeout(function(){
      if (el.parentNode) el.parentNode.removeChild(el);
      root.classList.remove('nr-splashing');
      try { window.dispatchEvent(new CustomEvent('nr:splash-done')); } catch (e) {}
    }, OUT);
  }
  function ready(){ setTimeout(finish, Math.max(0, MIN - (Date.now() - t0))); }

  if (d.readyState === 'complete') ready();
  else window.addEventListener('load', ready, { once: true });
  setTimeout(finish, MAX);
  el.addEventListener('pointerdown', finish, { once: true });
  d.addEventListener('keydown', finish, { once: true });
  d.addEventListener('visibilitychange', function(){ if (d.hidden) finish(); });
})();
