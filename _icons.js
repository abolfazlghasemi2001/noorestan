/* ═══════════════════════════════════════════════════════════════════
   تولید آیکن‌های نورستان — PNG واقعی، بدون هیچ کتابخانهٔ بیرونی.
   PNG فقط چند تکه است: امضا + IHDR + IDAT (zlib) + IEND، و zlib در خود
   Node هست. پس برای «ن» نیازی به فونت‌ریستر یا ابزار تصویر نیست:
   خودِ شکل با ریاضیِ فاصلهٔ علامت‌دار (SDF) و فرانمونه‌برداری کشیده می‌شود.
   ═══════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const zlib = require('zlib');

/* ── کدگذار PNG ── */
const TAB = (() => { const t = new Int32Array(256);
  for(let n = 0; n < 256; n++){ let c = n;
    for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c; }
  return t; })();
function crc32(buf){
  let c = 0xFFFFFFFF;
  for(let i = 0; i < buf.length; i++) c = TAB[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba){
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for(let y = 0; y < h; y++){
    raw[y * (stride + 1)] = 0;                       // فیلتر ۰ = بدون فیلتر
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ── ابزار هندسی ── */
const hypot = Math.hypot;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const mix = (a, b, t) => a + (b - a) * t;
function hex(h){ const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function sdRoundRect(px, py, w, h, r){
  const qx = Math.abs(px - w / 2) - (w / 2 - r), qy = Math.abs(py - h / 2) - (h / 2 - r);
  return Math.min(Math.max(qx, qy), 0) + hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}
function sdCircle(px, py, cx, cy, r){ return hypot(px - cx, py - cy) - r; }
function sdCapsule(px, py, ax, ay, bx, by, r){
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return hypot(px - (ax + t * dx), py - (ay + t * dy)) - r;
}
/* کمانِ ضخیم با سرِ گرد. زاویه‌ها درجه، در دستگاه «y به پایین»:
   ۰ = راست، ۹۰ = پایین، ۱۸۰ = چپ، ۲۷۰ = بالا. زاویه همیشه صعودی است،
   پس کمانی که از ۳۰۰ به ۶۰ می‌رود را باید ۳۰۰→۴۲۰ نوشت. */
function sdArc(px, py, cx, cy, R, T, a0, a1){
  const dx = px - cx, dy = py - cy;
  let ang = Math.atan2(dy, dx) * 180 / Math.PI;
  if(ang < 0) ang += 360;
  const dist = hypot(dx, dy);
  if(ang >= a0 && ang <= a1) return Math.abs(dist - R) - T / 2;
  const e0 = [cx + R * Math.cos(a0 * Math.PI / 180), cy + R * Math.sin(a0 * Math.PI / 180)];
  const e1 = [cx + R * Math.cos(a1 * Math.PI / 180), cy + R * Math.sin(a1 * Math.PI / 180)];
  return Math.min(hypot(px - e0[0], py - e0[1]), hypot(px - e1[0], py - e1[1])) - T / 2;
}

/* ── شکل «ن» در جعبهٔ ۱۰۰×۱۰۰ ──
   ن = کاسه‌ای کم‌عمق که از پایین می‌گذرد، دُمی که از سرِ راست کاسه بالا
   می‌رود، و نقطه‌ای بالای آن. کاسه از ۰ درجه (راست) تا ۱۶۸ درجه (چپ، کمی
   پایین‌تر) می‌آید تا بازوی چپ کوتاه‌تر از راست باشد؛ اگر دو سر هم‌ارتفاع
   باشند شکل به «U» لاتین می‌ماند نه «ن». */
const G = (() => {
  /* کاسهٔ کم‌عمق: کمان فقط ۲۰→۱۶۰ درجه می‌گیرد، نه نیم‌دایرهٔ کامل.
     با نیم‌دایره، عمق و پهنا برابر می‌شود و شکل به «U» لاتین می‌ماند؛
     با ۱۴۰ درجه، عمق/پهنا ≈ ۰٫۳۵ می‌شود که نسبتِ درستِ «ن» است. */
  const cx = 46, cy = 46, R = 34, T = 13, a0 = 20, a1 = 160;
  const rad = d => d * Math.PI / 180;
  const rx = cx + R * Math.cos(rad(a0)), ry = cy + R * Math.sin(rad(a0));
  return {
    cx, cy, R, T, a0, a1,
    tail: { ax: rx, ay: ry, bx: rx + 9, by: 29 },   // دُم از سرِ راست کاسه بالا می‌رود
    dot:  { cx: 46, cy: 28, r: 8 }                  // نقطه بالای میانِ کاسه، هم‌ارتفاع با سرِ دُم
  };
})();
function sdNoon(u, v){
  return Math.min(
    sdArc(u, v, G.cx, G.cy, G.R, G.T, G.a0, G.a1),
    sdCapsule(u, v, G.tail.ax, G.tail.ay, G.tail.bx, G.tail.by, G.T / 2),
    sdCircle(u, v, G.dot.cx, G.dot.cy, G.dot.r)
  );
}
/* کادر واقعی حرف — از هندسه حساب می‌شود تا وسط‌چین دقیق باشد */
const GB = (() => {
  const c = Math.cos(G.a1 * Math.PI / 180), s = Math.sin(G.a1 * Math.PI / 180);
  const lx = G.cx + G.R * c, ly = G.cy + G.R * s;      // سرِ چپ کاسه
  const rx = G.cx + G.R;                               // سرِ راست کاسه (۰ درجه)
  const h = G.T / 2 + 1;
  return { x0: Math.min(lx, G.tail.bx) - h, x1: Math.max(rx, G.tail.bx) + h,
           y0: G.dot.cy - G.dot.r - 1,      y1: Math.max(G.cy + G.R, ly) + h };
})();
/* نقشهٔ طرح → پیکسل. حرف کمی پایین‌تر از مرکز می‌نشیند چون نقطه بالای آن
   فضای خالی می‌سازد و بی این جابه‌جایی چشم آن را «بالا افتاده» می‌بیند. */
function gmap(S, maskable){
  const w = GB.x1 - GB.x0, h = GB.y1 - GB.y0;
  const k = S * (maskable ? 0.56 : 0.72) / Math.max(w, h);
  return { k,
    ox: S / 2 - (GB.x0 + GB.x1) / 2 * k,
    oy: S / 2 - (GB.y0 + GB.y1) / 2 * k + S * 0.015 };
}

/* ── رنگ‌آمیزی یک پیکسل ── */
function paint(px, py, S, maskable){
  const m = gmap(S, maskable);
  const u = (px - m.ox) / m.k, v = (py - m.oy) / m.k;   // دستگاه حرف
  let r = 0, g = 0, b = 0, a = 0;

  /* ۱) زمینه: مربع گرد با گرادیان سرد و هالهٔ گرم پایین */
  const bgA = clamp01(0.5 - sdRoundRect(px, py, S, S, maskable ? S / 2 : S * 0.22) / 1.2);
  if(bgA > 0){
    const t = clamp01(py / S);
    const c1 = hex('#1b2946'), c2 = hex('#0a1020');
    r = mix(c1[0], c2[0], t); g = mix(c1[1], c2[1], t); b = mix(c1[2], c2[2], t);
    const glow = clamp01(1 - hypot(px - S * .5, py - S * .82) / (S * .62)) ** 2 * .48;
    r = mix(r, 245, glow); g = mix(g, 178, glow); b = mix(b, 78, glow);
    a = bgA;
  }

  /* ۲) هالهٔ نور — حلقهٔ نازک دور حرف، هم‌خانوادهٔ هالهٔ پردهٔ آغازین.
     در دستگاه حرف حساب می‌شود تا ضخامتش با اندازهٔ آیکن تغییر نکند. */
  if(a > 0){
    const ring = Math.abs(hypot(u - G.cx, v - G.cy) - 48) - 1.1;
    const ha = clamp01(0.5 - ring) * .22;
    if(ha > 0){ r = mix(r, 255, ha); g = mix(g, 228, ha); b = mix(b, 165, ha); }
  }

  /* ۳) خودِ حرف با گرادیان طلایی — لبه‌ای به نرمیِ یک پیکسل */
  const na = clamp01(0.5 - sdNoon(u, v) / (1.15 / m.k));
  if(na > 0){
    const t = clamp01((v - GB.y0) / (GB.y1 - GB.y0));
    const c1 = hex('#ffe08f'), c2 = hex('#dfa02b');
    r = mix(r, mix(c1[0], c2[0], t), na);
    g = mix(g, mix(c1[1], c2[1], t), na);
    b = mix(b, mix(c1[2], c2[2], t), na);
    a = na + a * (1 - na);
  }
  return [r, g, b, clamp01(a)];
}

function draw(S, maskable){
  const buf = Buffer.alloc(S * S * 4);
  const SS = 3;                                  // فرانمونه‌برداری ۳×۳
  for(let y = 0; y < S; y++){
    for(let x = 0; x < S; x++){
      let R = 0, G2 = 0, B = 0, A = 0;
      for(let sy = 0; sy < SS; sy++) for(let sx = 0; sx < SS; sx++){
        const p = paint(x + (sx + .5) / SS, y + (sy + .5) / SS, S, maskable);
        R += p[0] * p[3]; G2 += p[1] * p[3]; B += p[2] * p[3]; A += p[3];
      }
      const n = SS * SS, o = (y * S + x) * 4, aa = A / n;
      /* R/A میانگینِ وزنیِ رنگ است و در بازهٔ ۰..۲۵۵ می‌افتد، نه ۰..۱.
         پس پیش از گرد کردن باید بر ۲۵۵ تقسیم شود؛ وگرنه clamp01 همه را
         به ۱ می‌چسباند و آیکن یک‌دست سیاه می‌شود. */
      buf[o]     = A ? Math.round(clamp01(R / A / 255) * 255) : 0;
      buf[o + 1] = A ? Math.round(clamp01(G2 / A / 255) * 255) : 0;
      buf[o + 2] = A ? Math.round(clamp01(B / A / 255) * 255) : 0;
      buf[o + 3] = Math.round(clamp01(aa) * 255);
    }
  }
  return encodePNG(S, S, buf);
}

/* ── پیش‌نمای متنی: تنها راه دیدن شکل بدون مرورگر ── */
function preview(S = 46, maskable = false){
  let out = '';
  for(let y = 0; y < S; y++){
    for(let x = 0; x < S; x++){
      const [r, g, b, a] = paint(x + .5, y + .5, S, maskable);
      const lum = (r * .3 + g * .6 + b * .1) / 255;
      out += a < .35 ? ' ' : lum > .60 ? '#' : lum > .42 ? '+' : lum > .26 ? ':' : '.';
    }
    out += '\n';
  }
  return out;
}
if(require.main === module && process.argv[2] === 'preview'){
  console.log(preview(46, process.argv[3] === 'mask'));
  process.exit(0);
}

const OUT = 'assets/images/icons/';
const FILES = [
  ['icon-192.png',        192, false],
  ['icon-512.png',        512, false],
  ['maskable-512.png',    512, true],
  ['apple-touch-icon.png',180, false],
  ['favicon-32.png',       32, false]
];
for(const [name, size, mask] of FILES){
  fs.writeFileSync(OUT + name, draw(size, mask));
  console.log('✅', name, fs.statSync(OUT + name).size, 'بایت');
}
