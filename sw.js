/* ═══════════════════════════════════════════════════════════════════
   نورستان ۱۷ — Service Worker
   راهبرد: پوستهٔ برنامه پیش‌ذخیره و «اول کش»؛ تصویر و فونت «اول کش با
   تازه‌سازی پس‌زمینه»؛ متن قرآن «اول شبکه با واپس‌روی به کش»؛ و صوت
   و ویدئو **کامل به مرورگر واگذار** می‌شود (بی رهگیری).

   هیچ‌وقت نسخهٔ قدیمی را به کاربر تحمیل نمی‌کند: با تغییر CACHE هر بار
   کش پیشین پاک می‌شود.

   نسخهٔ ۱۶: صفحهٔ آفلاین سفارشی (offline.html) به پیش‌ذخیره اضافه شد و
   واپس‌رویِ رفت‌وبرگشت‌ها اول به آن می‌رسد. آیکن‌ها هم از webp/jpg
   ساختگی به PNGهای واقعی عوض شدند — پیش‌تر این مسیرها به فایل‌هایی
   اشاره می‌کردند که وجود نداشتند و کروم به‌خاطرشان نصب را پیشنهاد نمی‌داد.

   نسخهٔ ۱۷: باگِ «صوت در PWA پخش نمی‌شود ولی بی سرویس‌ورکر می‌شود» رفع
   شد. ریشه‌اش در همین فایل بود، نه در برنامه. شرح کامل بالای isMedia().

   نسخهٔ ۱۸: هیچ تغییرِ رفتاری‌ای نیست — فقط شمارهٔ کش یکی جلو رفت.
   دلیلش: کاربر پس از فازِ آیکن‌ها (a89fa17) هنوز ایموجیِ 👤🎮🌐🎧🏠 را در
   نوارِ پایین می‌دید، در حالی که سند روی دیسک از همان کامیت SVGِ درون‌خطی
   دارد. یعنی نسخهٔ کهنه در کشِ مرورگر مانده بود.

   نسخهٔ ۱۹: بازی «نور آیه‌ها» و بنر چرخشی Swiper به پوسته افزوده شد.
   بالا رفتن نسخه لازم است تا نصب‌های قبلی، index.html تازه را به‌جای
   پوستهٔ کش‌شدهٔ نسخهٔ ۱۸ دریافت کنند. `activate` کش‌های کهنه را پاک می‌کند.
   ═══════════════════════════════════════════════════════════════════ */

const CACHE = 'noorestan-20';
const SHELL = 'noorestan-shell-20';
const MEDIA = 'noorestan-media-20';
const TEXT  = 'noorestan-text-20';

/* صفحهٔ آفلاین جدا نگه داشته می‌شود چون هم پیش‌ذخیره می‌شود و هم مسیر
   واپس‌روی است؛ تک‌منبع بودنش از اختلاف دو جای کد جلوگیری می‌کند. */
const OFFLINE = './offline.html';
const SHELL_PAGE = './index.html';

/* پوستهٔ برنامه — اگر یکی از این‌ها نبود، نصب شکست می‌خورد.
   پس فقط چیزهایی که واقعاً وجود دارند این‌جا می‌آیند. */
const PRECACHE = [
  './',
  SHELL_PAGE,
  './manifest.json',
  OFFLINE,
  './assets/images/icons/icon.svg',
  './assets/images/icons/icon-192.png',
  './assets/images/icons/favicon-32.png'
];

/* تصویرها و فونت‌ها — نبودنشان ایرادی ندارد */
const OPTIONAL = [
  /* قلمِ پایهٔ برنامه، میزبانی‌شده روی خودمان. بی اینها برنامه با قلمِ
     پیش‌فرضِ سیستم بالا می‌آید؛ نبودشان نصب را نمی‌شکند ولی ظاهر را
     عوض می‌کند، پس هر سه وزن پیش‌ذخیره می‌شوند. */
  './assets/fonts/lalezar-arabic-400.woff2',
  './assets/images/promo/courtyard.svg',
  './assets/images/promo/recitation.svg',
  './assets/images/promo/night.svg',
  './assets/fonts/vazirmatn-regular.woff2',
  './assets/fonts/vazirmatn-bold.woff2',
  './assets/fonts/vazirmatn-extrabold.woff2',
  './assets/images/icons/icon-512.png',
  './assets/images/icons/maskable-512.png',
  './assets/images/icons/apple-touch-icon.png',
  './assets/README.md'
  /* نسخهٔ ۱۷: چهار مسیرِ splash/tile/mushaf/panorama از این فهرست رفتند.
     هیچ‌کدام فایل نداشتند و هر نصب چهار درخواستِ محکوم‌به‌شکست می‌فرستاد
     (خطا گرفته می‌شد، پس نصب نمی‌شکست — ولی هر بار چهار خطای شبکه در
     کنسول و چهار گردشِ بی‌فایده). جایشان نگارهٔ SVGِ درون‌خطیِ Art است که
     نه فایل می‌خواهد و نه شبکه. اگر روزی عکسِ واقعی گذاشتی، همان‌جا
     فهرستش کن. */
];

const MAX_MEDIA = 120;      // حداکثر شمار فایل رسانه‌ای در کش
const MAX_TEXT  = 260;      // حداکثر پاسخ متنی (سوره‌ها) در کش

/* ── رسانه (صوت/ویدئو): کامل واگذار به مرورگر ──────────────────────
   چرا این شاخه پیش از همه می‌آید و چرا هیچ respondWith ندارد؟

   عنصر <audio> که بدون crossOrigin ساخته شود، درخواستش را با حالت
   no-cors می‌فرستد. پاسخِ چنین درخواستی «مبهم» (opaque) است:
   type === 'opaque'، status === 0 و ok === false و بدنه‌اش خواندنی نیست.

   راهبرد پیشین (networkFirst) پاسخ را با معیار res.ok می‌سنجید. برای
   صوت، ok همیشه false است، پس «bad status» می‌دید، به کش می‌زد که خالی
   بود، و در نهایت یک ۵۰۳ با بدنهٔ JSON برمی‌گرداند. مرورگر جای صدا،
   JSON می‌گرفت و پخش شکست می‌خورد. با حذف سرویس‌ورکر همان درخواست بی
   واسطه به سرور می‌رفت و کار می‌کرد — دقیقاً همان چیزی که کاربر دید.

   حالا هیچ لایه‌ای میان مرورگر و سرور نیست. سه چیز هم‌زمان درست می‌ماند:
   • هدر Range دست‌نخورده می‌رسد. پخش‌کننده‌ها برای ورق‌زدن در فایل با
     Range درخواست می‌فرستند و پاسخش ۲۰۶ است؛ Cache API در put() برای
     ۲۰۶ استثنا می‌دهد، پس هر طرحی که صوت را کش کند شکننده است.
   • Content-Type همان است که سرور گفته (audio/mpeg برای mp3، audio/ogg
     برای ogg) — سرویس‌ورکر نه عوضش می‌کند و نه از دستش می‌دهد.
   • هدرهای CORS دست‌نخورده‌اند؛ crossOrigin نه ست می‌شود و نه لازم است.

   تشخیص عمداً چندلایه است، چون هیچ‌کدام تنها کافی نیست: destination را
   مرورگر پر می‌کند و مطمئن‌ترین نشانه است، ولی در تست‌های نودی خالی
   می‌ماند؛ پسوند نشانی هم هست، ولی بعضی CDNها بی پسوند سرو می‌کنند. */
const EXT_MEDIA  = /\.(mp3|mp4|m4a|m4b|ogg|oga|opus|weba|wav|aac|flac|webm)$/i;
const HOST_MEDIA = /(^|\.)(everyayah\.com|islamic\.network|quranicaudio\.com|mp3quran\.net)$/i;

function isMedia(req, url){
  if(req.destination === 'audio' || req.destination === 'video') return true;
  if(EXT_MEDIA.test(url.pathname)) return true;
  if(HOST_MEDIA.test(url.hostname)) return true;
  /* هر درخواست جزءبه‌جزء: پاسخ ۲۰۶ را نه می‌توان کش کرد و نه بازنویسی */
  if(req.headers && req.headers.get('range')) return true;
  return false;
}

/* کش کردنِ چه پاسخی درست است؟
   فقط ۲۰۰ کامل. دو چیز را باید رد کرد و هر دو واقعاً پیش می‌آیند:
   • ۲۰۶ (Partial Content) — Cache API در put() استثنا می‌دهد.
   • پاسخ مبهم — نه بدنه‌اش خواندنی است و نه status معتبری دارد.
   درخواست‌های CORSِ موفق (type === 'cors') مجازند؛ همین‌ها هستند که
   فونت jsDelivr را آفلاین نگه می‌دارند. */
function storable(res){
  if(!res || res.status !== 200) return false;
  if(res.type === 'opaque' || res.type === 'opaqueredirect') return false;
  return true;
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    /* addAll اگر یکی شکست بخورد همه را باطل می‌کند، پس هر کدام جدا
       افزوده می‌شود؛ ولی OFFLINE استثناست: بی آن، وعدهٔ «آفلاین باز
       می‌شود» توخالی است، پس نبودش باید نصب را واقعاً بشکند. */
    await Promise.all(PRECACHE.map(u =>
      c.add(new Request(u, { cache: 'reload' }))
        .catch(err => {
          if(u === OFFLINE) throw err;
          return null;
        })));
    const opt = await caches.open(CACHE);
    await Promise.all(OPTIONAL.map(u =>
      opt.add(new Request(u, { cache: 'reload' })).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = new Set([CACHE, SHELL, MEDIA, TEXT]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k)));
    if(self.registration.navigationPreload)
      await self.registration.navigationPreload.disable();
    await self.clients.claim();
  })());
});

/* ── ابزارها ── */
async function trim(name, max){
  try{
    const c = await caches.open(name);
    const keys = await c.keys();
    if(keys.length <= max) return;
    /* قدیمی‌ترین‌ها اول می‌روند (ترتیب درج) */
    for(const k of keys.slice(0, keys.length - max)) await c.delete(k);
  }catch(e){}
}

async function staleWhileRevalidate(req, name, max){
  const c = await caches.open(name);
  const hit = await c.match(req);
  const net = fetch(req).then(res => {
    if(storable(res)) c.put(req, res.clone()).then(() => trim(name, max)).catch(() => {});
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
}

async function networkFirst(req, name, max){
  const c = await caches.open(name);
  try{
    const res = await fetch(req);
    /* پاسخ مبهم هرگز خطا نیست. اگر پیش از این شرط بیاید و برگردد،
       هیچ‌وقت به شاخهٔ ۵۰۳ نمی‌رسد — و همین یک خط، باگ صدا را می‌بندد
       حتی اگر روزی صدا از مسیر isMedia خارج شود. */
    if(res && (res.type === 'opaque' || res.type === 'opaqueredirect')) return res;
    if(storable(res)){
      c.put(req, res.clone()).then(() => trim(name, max)).catch(() => {});
      return res;
    }
    /* ۲۰۶ و ۲۰۴ و مانندش: تحویل بده، ولی کش نکن */
    if(res && res.ok) return res;
    throw new Error('bad status');
  }catch(e){
    const hit = await c.match(req);
    if(hit) return hit;
    return new Response(JSON.stringify({ error: 'offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

/* آخرین سنگرِ رفت‌وبرگشت: اگر خودِ پوسته هم در کش نبود، صفحهٔ آفلاین.
   ترتیب مهم است — index.html تجربهٔ کامل برنامه است و باید مقدم باشد؛
   صفحهٔ آفلاین فقط‌وقتی می‌آید که واقعاً چیزی برای نشان دادن نباشد. */
async function navFallback(){
  const c = await caches.open(SHELL);
  return (await c.match(SHELL_PAGE)) || (await c.match('./')) ||
         (await c.match(OFFLINE)) || (await caches.match(OFFLINE)) ||
         Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;

  let url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* ۰) صوت و ویدئو — بی هیچ رهگیری. باید پیش از همهٔ شاخه‌ها باشد،
        وگرنه شاخهٔ ۱ (نشانی‌های بی‌پسوند روی دامنهٔ قاریان) یا شاخهٔ ۴
        (CDN) آن را می‌قاپد. */
  if(isMedia(req, url)) return;

  /* ۱) رفت‌وبرگشت صفحه‌ها — اول شبکه، بی‌شبکه پوسته از کش */
  if(req.mode === 'navigate'){
    e.respondWith((async () => {
      try{
        const res = await fetch(req);
        if(res && res.ok){
          const c = await caches.open(SHELL);
          c.put(SHELL_PAGE, res.clone()).catch(() => {});
          return res;
        }
        /* پاسخ خطای سرور: کش دست‌کم چیزی برای نشان دادن دارد */
        const fb = await navFallback();
        return fb && fb.status ? fb : res;
      }catch(err){
        return navFallback();
      }
    })());
    return;
  }

  /* ۲) متن قرآن (AlQuran Cloud) — اول شبکه، بی‌شبکه از کش */
  if(/api\.alquran\.cloud/.test(url.hostname)){
    e.respondWith(networkFirst(req, TEXT, MAX_TEXT));
    return;
  }

  /* ۳) فونت‌های jsDelivr و دیگر CDNها — اول کش با تازه‌سازی پس‌زمینه.
        عمداً برنمی‌گردد به «فقط هم‌خاستگاه»: فونت‌های jsDelivr هم مثل صوت
        در حالت no-cors می‌آیند، ولی برخلاف صوت پاسخشان قابل‌استفاده است و
        همین‌ها برنامه را آفلاین خوانا نگه می‌دارند. ممنوع کردن کشِ
        بین‌خاستگاهی، آفلاین بودنِ قلم را بی‌صدا می‌کشد. */
  if(/jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.hostname)){
    e.respondWith(staleWhileRevalidate(req, MEDIA, MAX_MEDIA));
    return;
  }

  /* ۴) دارایی‌های خودمان (assets/) — اول کش با تازه‌سازی پس‌زمینه */
  if(url.origin === location.origin && /\/assets\//.test(url.pathname)){
    e.respondWith(staleWhileRevalidate(req, CACHE, MAX_MEDIA));
    return;
  }

  /* ۵) هر چیز هم‌خاستگاه دیگر (index.html، manifest، sw) — اول شبکه.
        کشِ این شاخه فقط هم‌خاستگاهی است؛ درختِ پوسته نباید با پاسخ
        دامنهٔ بیرونی آلوده شود. */
  if(url.origin === location.origin){
    e.respondWith((async () => {
      try{
        const res = await fetch(req);
        if(storable(res)) (await caches.open(SHELL)).put(req, res.clone()).catch(() => {});
        return res;
      }catch(err){
        const hit = await caches.match(req);
        return hit || Response.error();
      }
    })());
  }
  /* بقیه (مثلاً STUN/TURN) به مرورگر واگذار می‌شود */
});

/* ── پیام‌های صفحه ── */
self.addEventListener('message', e => {
  const d = e.data || {};
  if(d.t === 'skipWaiting') self.skipWaiting();
  if(d.t === 'clear'){
    e.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    })());
  }
  if(d.t === 'version'){
    e.waitUntil((async () => {
      const c = await caches.open(MEDIA);
      const n = (await c.keys()).length;
      try{ e.source.postMessage({ t: 'version', cache: CACHE, media: n }); }catch(err){}
    })());
  }
});

/* ── اعلان‌ها ── */
self.addEventListener('push', e => {
  let d = { title: 'نورستان', body: 'خبر تازه‌ای هست' };
  try{ if(e.data) d = { ...d, ...e.data.json() }; }catch(err){}
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    dir: 'rtl', lang: 'fa',
    badge: './assets/images/icons/icon-192.png',
    icon: './assets/images/icons/icon-192.png',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for(const c of all){ if('focus' in c){ c.navigate(url); return c.focus(); } }
    if(self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
