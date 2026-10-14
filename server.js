#!/usr/bin/env node
'use strict';
/* ═══════════════════════════════════════════════════════════════════
   نورستان ۱۵ — سرور محفل چندنفره
   · WebSocket واقعی با پیاده‌سازی دستی RFC 6455 (بدون هیچ وابستگی npm)
   · HTTP برای سرو کردن خود برنامه (تا با موبایل/لپ‌تاپ دیگر بازش کنی)
   · منطق بازی سمت سرور اعتبارسنجی می‌شود: نوبت، خانه‌های مجاز، پایان بازی
   · روم تا ۸ بازیکن + حالت تماشاچی برای نفرات بعدی
   · واکنش زنده، «در حال نوشتن…»، مذاکرهٔ صوتی اختیاری (WebRTC) و دوستی‌ها
   · لیدربورد و فهرست دوستان روی دیسک ذخیره می‌شود

   اجرا:   node server.js
   متغیرها: PORT (پیش‌فرض 8787)  HOST  NOOR_ADMIN_PASS  NOOR_DATA  NOOR_ORIGIN
            NOOR_SMS_KEY  NOOR_SMS_DEVICE  NOOR_SMS_ENDPOINT  NOOR_SMS_ON
            NOOR_SMS_TIMEOUT (میلی‌ثانیه، پیش‌فرض ۳۰۰۰۰)
            NOOR_SMS_MAX_HOUR (سقف کلِ پیامک در ساعت، پیش‌فرض ۴۰)
            NOOR_SMS_MAX_IP (سقف هر نشانی در ساعت، پیش‌فرض ۲۰)
            NOOR_SMS_MAX_PHONE (سقف هر شماره در ۱۰ دقیقه، پیش‌فرض ۳)
            NOOR_DEBUG_SMS=1 (ثبتِ بدنهٔ خامِ پاسخِ textbee در لاگ — برای عیب‌یابی)

   ⚠️ NOOR_ADMIN_PASS هیچ مقدار جانشینی ندارد. اگر ستش نکنی، پنل مدیریت روی
      سرور کار نمی‌کند. این عمدی است: پیش‌تر مقدار جانشین «noor2024» بود و
      رمزِ مدیر داخل مخزن عمومی منتشر می‌شد.
   ═══════════════════════════════════════════════════════════════════ */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

/* ─────────────── تنظیمات ─────────────── */
const PORT        = +(process.env.PORT || 8787);
const HOST        = process.env.HOST || '0.0.0.0';
/* ── رمز مدیر ──
   فقط از متغیر محیطی. پیش‌تر مقدار جانشین «noor2024» بود — یعنی رمزِ مدیر در
   مخزن عمومی منتشر می‌شد و هر کسی که سورس را می‌خواند، مدیرِ سرور بود.
   حالا اگر NOOR_ADMIN_PASS ست نشده باشد، احراز هویت مدیر روی سرور کار نمی‌کند
   (پیام‌های مدیریتی رد می‌شوند) و سرور روشن می‌ماند. عمداً «رمز تازه چاپ کن»
   هم نمی‌کنیم: رمزی که در لاگ بنشیند، رمز نیست. */
const ADMIN_PASS  = process.env.NOOR_ADMIN_PASS || '';
const ADMIN_HASH  = ADMIN_PASS ? sha256Hex(ADMIN_PASS) : '';
const DATA_FILE   = process.env.NOOR_DATA || path.join(__dirname, 'noorestan-data.json');
/* خاستگاهِ مجاز. در تولید *باید* داده شود (B14): با `*`، پاسخ‌ها برای هر
   دامنه‌ای خواندنی‌اند و CSP/HSTS هم بی‌معنا می‌شوند. */
const NOOR_ORIGIN = (process.env.NOOR_ORIGIN || '').replace(/\/+$/, '');
const PROD        = /^(1|true)$/i.test(process.env.NOOR_PRODUCTION || '');
const ALLOW_ORIGIN= NOOR_ORIGIN || '*';
const NS          = 'noorestan';
const VERSION     = (() => {
  /* نسخه از package.json خوانده می‌شود (B22): «۱۵.۰» در-banner در حالی بود
     که مخزن ۱۷ بود — اعلامِ نادرست، راهنمایِ باگ‌گزار را گم می‌کند. */
  try{ return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version || '0'; }
  catch(e){ return process.env.NOOR_VERSION || '0'; }
})();

/* ── پیکربندیِ امنیت (فاز ۲ ممیزی) ── */
const TRUST_PROXY   = process.env.NOOR_TRUST_PROXY === '1';
const TRUST_HOPS    = Math.max(1, Number(process.env.NOOR_TRUST_HOPS || 1) || 1);
const HSTS_HEADER   = process.env.NOOR_HSTS || '';
const CSP_MODE      = process.env.NOOR_CSP === 'enforce' ? 'enforce'
                    : (process.env.NOOR_CSP === 'off' ? 'off' : 'report-only');
const ADMIN_HTTP_OK = process.env.NOOR_ALLOW_HTTP_ADMIN === '1';
/* کفِ این عدد ۲ است، نه ۱۶: «سقفِ نشست‌ها» کنترلی است که مدیر عمداً تنگ
   می‌کند (و آزمون‌ها همان تنگی را می‌سنجند). بی مقدار، یا مقداری که عدد
   نیست، همان ۵۰۰۰ می‌ماند. */
const TOKEN_MAX     = Math.max(2, Number(process.env.NOOR_TOKEN_MAX || 5000) || 5000);
const WS_MAX_IP     = Math.max(1, Number(process.env.NOOR_WS_MAX_IP || 24) || 24);
const WS_HELLO_MS   = Math.max(2000, Number(process.env.NOOR_WS_HELLO_MS || 10000) || 10000);
const LB_MAX        = Math.max(100, Number(process.env.NOOR_LB_MAX || 20000) || 20000);
const LB_STEP_HOUR  = Math.max(50, Number(process.env.NOOR_LB_STEP_HOUR || 5000) || 5000);
const FR_COOLDOWN_MS = Number(process.env.NOOR_FR_COOLDOWN_SEC ?? 300) * 1000;
const wsByIp = new Map();   // ip -> شمارِ سوکتِ باز (B7)
const RETENTION_DAYS= Number(process.env.NOOR_RETENTION_DAYS ?? 120);
const IP_SALT       = process.env.NOOR_IP_SALT || 'noorestan-ip-v1';
const VERIFY_MAX_HOUR = Number(process.env.NOOR_VERIFY_MAX_HOUR || 30);
/* تولیدِ بی‌خاستگاهِ مشخص پذیرفته نیست (B14): `*` روی HTTPS یعنی هر دامنه‌ای
   پاسخ‌ها را می‌خواند. سرور بالا نمی‌آید تا این اشتباه بی‌صدا نماند. */
if(PROD && !NOOR_ORIGIN){
  console.error('❌ نورستان در حالتِ تولید (NOOR_PRODUCTION=1) بی NOOR_ORIGIN بالا نمی‌آید.');
  console.error('   مثال: NOOR_ORIGIN=https://noorestan.app NOOR_HSTS="max-age=31536000; includeSubDomains"');
  process.exit(1);
}

const LIMITS = {
  msgBytes:      16 * 1024,   // حداکثر حجم هر پیام
  sdpBytes:       8 * 1024,   // حداکثر حجم پیام مذاکرهٔ صوتی
  nameLen:       20,
  roomNameLen:   24,
  chatLen:      200,
  textLen:      300,
  rooms:         60,          // حداکثر روم همزمان
  roomMembers:    8,          // نسخهٔ ۱۵: از ۲ به ۸ بازیکن رسید
  roomSpectators:12,          // نفرات بعدی تماشاچی می‌شوند
  roomsPerClient: 3,          // حداکثر روم ساخته‌شده توسط یک نفر
  ratePer5s:     40,          // حداکثر پیام در ۵ ثانیه
  friendsPerUser:60,
  idleMs:     45000,          // قطع اتصال اگر هیچ پیامی نیاید
  maxClients:   500
};

/* فقط همین واکنش‌ها پذیرفته می‌شوند (همان فهرست Reactions.SET در کلاینت) */
const REACTIONS = ['❤️','😂','😮','👏','🌟','🤲','🙏','🔥'];

/* ─────────────── ابزار ─────────────── */
function sha256Hex(s){ return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function sha1B64(s){ return crypto.createHash('sha1').update(String(s)).digest('base64'); }
function now(){ return Date.now(); }
function code6(){ return String(Math.floor(100000 + Math.random() * 900000)); }
/* حذف نویسه‌های کنترلی (۰x00–0x1F و 0x7F) و بریدن به طول مجاز */
/* نامی که کاربر هنوز انتخاب نکرده. یک ثابت است — نه رشته‌ای پراکنده در
   چند جا — چون معنایش از خودِ مقدار مهم‌تر است: «این آدم هنوز نامی
   نگفته». پایین‌تر در `hello` همین فرق تعیین می‌کند که نامِ فرستاده‌شدهٔ
   کلاینت پذیرفته شود یا نامِ کارنامه. */
const DEFAULT_USER_NAME = 'بازیکن';

/* نویسه‌های «بی‌نقشِ مخرب» (B18): کنترلی‌ها، نشان‌هایِ دوسمتیِ Unicode
   (U+202A…U+202E و U+2066…U+2069)، نشانهٔ نویسهٔ عربی U+061C،
   نیم‌پردهٔ U+00AD، ZWSP/LRM/RLM و BOM.
   چرا U+202E خطرناک است؟ یک نویسه در *انتهای* رشته، ظاهرِ کلِ خط را برعکس
   می‌کند: نامِ «alireza‮faq» در فهرستِ مدیر «qaf‮azerila» دیده می‌شود — جعلِ
   هویت با همان دو نویسه ممکن است. فهرست‌ها و پیام‌های محفل از همین راه‌اند.
   U+200C (نیم‌فاصله) و U+200D (ZWNJِ ایموجی) عمداً نمی‌روند؛ حذفشان فارسیِ
   نورستان را می‌شکست («می‌شود» ← «میشود») و ایموجی‌های ترکیبی را می‌بست. */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD\u0600-\u0605\u061C\u00AD\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;
function scrub(v){ return String(v == null ? '' : v).replace(INVISIBLE, ''); }

function clampStr(v, n){
  /* فقط مقدارهای ساده؛ شیءِ دستکاری‌شده (مثلاً {"toString":null}) پیش‌تر
     String() را می‌ترکاند و کلِ پیام بی‌پاسخ می‌ماند. */
  if(v == null || (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean')) return '';
  return scrub(v).trim().slice(0, n); }
function ts(){ return new Date().toTimeString().slice(0, 8); }
function log(...a){ console.log(`[${ts()}]`, ...a); }

/* ─────────────── وضعیت سرور ─────────────── */
const clients = new Map();   // id -> client
const rooms   = new Map();   // code -> room
let leaderboard = [];
let friends     = {};        // uid -> [uid دوست‌ها]   (B8: نام هویت نیست)
const friendsNames = new Map();  // uid -> آخرین نامِ دیده‌شده (برای نمایش)
let reports       = [];        // گزارش‌های کاربر (B18) — در حلقهٔ ۲۰۰تایی
let pendingFriends = new Map();  // fromId -> {toId, at}
let stats = { startedAt: now(), totalConnections: 0, totalMessages: 0, totalGames: 0, peakOnline: 0 };

/* ─────────────── ذخیره‌سازی ─────────────── */
function loadData(){
  try{
    if(fs.existsSync(DATA_FILE)){
      const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if(Array.isArray(d.leaderboard)) leaderboard = d.leaderboard;
      if(d.friends && typeof d.friends === 'object') friends = d.friends;
      if(Array.isArray(d.reports)) reports = d.reports.slice(-100);
      /* نشست‌های ذخیره‌شده (B6). ردیفِ منقضی بار نمی‌شود، وگرنه فایلِ داده
         پر می‌شد از مُرده‌ها و هر ری‌استارت کندتر. */
      if(d.sessions && typeof d.sessions === 'object'){
        let back = 0;
        for(const [h, s] of Object.entries(d.sessions)){
          if(!s || typeof s !== 'object') continue;
          if(!USER_ID_RE.test(String(s.id || '')) || !/^09\d{9}$/.test(String(s.phone || ''))) continue;
          if(!(+s.exp > now())) continue;
          userSessions.set(String(h), { id: s.id, phone: s.phone, exp: +s.exp, at: +s.at || 0 });
          back++;
        }
        if(back) log(`🔑 ${back} نشستِ کاربر از پیش خوانده شد (ری‌استارت، بی کدِ تازه)`);
      }
      if(Object.keys(friends).length) friendsMigrate();   // B8: نام‌محور → شناسه‌محور
      /* رمز مدیر از فایل داده خوانده نمی‌شود.
         پیش‌تر اگر این کلید در فایل بود، همان رمزِ مدیر می‌شد — یعنی یک منبع
         دوم و پنهان برای رمز، که با «فقط از متغیر محیطی» در تضاد است. حالا
         تنها منبع، NOOR_ADMIN_PASS است و فایل داده هیچ نقشی در ورود ندارد. */
      if(d.adminHash) log('ℹ️ هشِ رمزِ داخل فایل داده نادیده گرفته شد — رمز مدیر فقط از NOOR_ADMIN_PASS می‌آید');
      if(d.stats) stats = { ...stats, ...d.stats, startedAt: stats.startedAt };
      /* کارنامهٔ کاربران. رکوردِ بی‌شکل دور انداخته می‌شود: یک ردیفِ خراب
         نباید فهرستِ کاربران را خراب کند یا کلیدِ تکراری بسازد. */
      if(Array.isArray(d.users)){
        for(const u of d.users){
          if(!u || typeof u !== 'object') continue;
          const phone = String(u.phone || '');
          const id = String(u.id || '');
          if(!/^09\d{9}$/.test(phone) || !USER_ID_RE.test(id)) continue;
          if(userByPhone.has(phone) || userById.has(id)) continue;
          const rec = { id, phone, name: clampStr(u.name, LIMITS.nameLen) || 'بازیکن',
                        joinedAt: Math.max(0, +u.joinedAt || 0),
                        lastLogin: Math.max(0, +u.lastLogin || 0),
                        visits: Math.max(0, +u.visits || 0), plays: Math.max(0, +u.plays || 0),
                        score: Math.max(0, +u.score || 0), level: Math.max(1, +u.level || 1),
                        blocked: !!u.blocked, lastIp: String(u.lastIp || '').slice(0, 45),
                        welcomed: !!u.welcomed,
                        welcomedAt: Math.max(0, +u.welcomedAt || 0),
                        welcomeTries: Math.max(0, +u.welcomeTries || 0),
                        ips: Array.isArray(u.ips) ? u.ips.slice(0, 5).map(x => String(x).slice(0, 45)) : [] };
          userByPhone.set(phone, rec);
          userById.set(id, phone);
        }
      }
      log(`📂 بارگذاری شد: ${leaderboard.length} رکورد، ${Object.keys(friends).length} کاربر با دوست، ${userByPhone.size} کاربر ثبت‌شده`);
    }
  }catch(e){ log('⚠️ خواندن فایل داده ناموفق:', e.message); }
}

function snapshot(){
  return {
    leaderboard, friends,
    /* کارنامهٔ کاربران — بی هیچ نشانی از نشست‌ها و کدهای در جریان. نشانه و
       کد، رازِ زنده‌اند و روی دیسک نمی‌نشینند. */
    users: [...userByPhone.values()].map(u => ({
      id: u.id, phone: u.phone, name: u.name, joinedAt: u.joinedAt,
      lastLogin: u.lastLogin, visits: u.visits || 0, plays: u.plays || 0,
      score: u.score || 0, level: u.level || 1, blocked: !!u.blocked,
      welcomed: !!u.welcomed, welcomedAt: u.welcomedAt || 0,
      lastIp: u.lastIp || '', ips: (u.ips || []).slice(0, 5)
    })),
    reports: reports.slice(-100),
    /* هشِ نشست‌ها (B6) — با همان سقفِ TOKEN_MAX و بی هیچ نشانهٔ خام. */
    sessions: Object.fromEntries([...userSessions.entries()]
      .filter(([, s]) => s && s.exp > now())
      .sort((a, b) => b[1].at - a[1].at).slice(0, TOKEN_MAX)),
    stats: { totalConnections: stats.totalConnections, totalMessages: stats.totalMessages,
             totalGames: stats.totalGames, peakOnline: stats.peakOnline }
  };
}

let saveTimer = null;
/* نوشتنِ اتمی: اول فایلِ موقت، fsync، بعد rename. پیش‌تر قطعِ برق یا kill
   وسطِ نوشتن، JSONِ نیمه‌کاره می‌گذاشت و بارِ بعد همهٔ داده‌ها خالی بالا می‌آمد. */
function writeDataAtomic(){
  const tmp = DATA_FILE + '.tmp';
  const fd = fs.openSync(tmp, 'w', 0o600);
  try{ fs.writeFileSync(fd, JSON.stringify(snapshot(), null, 2)); fs.fsyncSync(fd); }
  finally{ fs.closeSync(fd); }
  try{ if(fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak'); }catch(_){}
  fs.renameSync(tmp, DATA_FILE);
}
function saveData(immediate){
  if(immediate){
    if(saveTimer){ clearTimeout(saveTimer); saveTimer = null; }
    try{ writeDataAtomic(); }
    catch(e){ log('⚠️ ذخیره ناموفق:', e.message); }
    return;
  }
  if(saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try{ writeDataAtomic(); }
    catch(e){ log('⚠️ ذخیره ناموفق:', e.message); }
  }, 800);
}

/* ─────────────── لایه WebSocket (RFC 6455) ─────────────── */
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(key){ return sha1B64(key + GUID); }

function parseFrames(buf){
  const frames = [];
  let off = 0;
  while(off + 2 <= buf.length){
    const b0 = buf[off], b1 = buf[off + 1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let p = off + 2;
    if(len === 126){ if(p + 2 > buf.length) break; len = buf.readUInt16BE(p); p += 2; }
    else if(len === 127){ if(p + 8 > buf.length) break; const hi = buf.readUInt32BE(p), lo = buf.readUInt32BE(p + 4); len = hi * 4294967296 + lo; p += 8; }
    if(len > LIMITS.msgBytes * 4) throw new Error('frame too large');
    let mask = null;
    if(masked){ if(p + 4 > buf.length) break; mask = buf.subarray(p, p + 4); p += 4; }
    if(p + len > buf.length) break;
    const payload = Buffer.from(buf.subarray(p, p + len));
    if(masked) for(let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    off = p + len;
    frames.push({ fin, opcode, payload, masked, rsv: (b0 & 0x70) !== 0 });
  }
  return { frames, rest: buf.subarray(off) };
}

function encodeFrame(payload, opcode = 0x1){
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
  const len = data.length;
  let header;
  if(len < 126){
    header = Buffer.alloc(2);
    header[1] = len;
  } else if(len < 65536){
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, data]);
}

/* ─────────────── ارسال پیام ─────────────── */
function envelope(env){ return { ns: NS, from: 'server', to: '*', ...env }; }

/* «خاموش کردنِ یک آدم» با «خاموش کردنِ یک تب» فرق دارد: نشانهٔ کاربر نشانهٔ
   آدم است، پس هر دو را می‌پذیریم و هر دو را در فهرستِ خاموشی می‌گذاریم. */
function clientByUid(uid){
  if(!uid) return null;
  for(const x of clients.values()) if(x.uid === uid) return x;
  return null;
}

function sendRaw(c, env){
  if(!c || c.sock.destroyed || !c.ready) return;
  if(!c.known && !['welcome','auth:error'].includes(env.t))return;
  const payload = JSON.stringify(envelope(env));
  if(Buffer.byteLength(payload, 'utf8') > LIMITS.msgBytes * 4){ log('⚠️ پیام بزرگ حذف شد'); return; }
  /* فشارِ برگشتی: گیرنده‌ای که نمی‌خواند، بافرِ خروجی را بی‌پایان پر می‌کرد */
  if(c.sock.writableLength > 1024 * 1024){ if(c.closeClient) c.closeClient('گیرندهٔ کند'); else c.sock.destroy(); return; }
  try{ c.sock.write(encodeFrame(payload)); }catch(e){ /* سوکت مرده */ }
}

/* B18: «خاموش‌کردن» همین‌جا اجرا می‌شود — در تنگه‌ای که همهٔ پیام‌های
   رو‌در‌رو از آن می‌گذرند؛ پس پوششِ چت، واکنش، تایپ و مذاکرهٔ صوتی با هم
   تمام است (بی این، خاموش‌کردن فقط چت را می‌گرفت و صدا همان‌جا می‌ماند). */
function sendTo(id, env){
  const to = clients.get(id);
  if(!to) return;
  if(env && to.muted && to.muted.size){
    const from = [env.from, env.uid].filter(Boolean);
    if(from.some(x => to.muted.has(x))) return;
  }
  sendRaw(to, env);
}

function sendRoom(code, env){
  const r = rooms.get(code);
  if(!r) return;
  for(const m of r.members) sendTo(m.id, env);
}

/* ارسال به همهٔ اعضای روم جز یک نفر (برای «تایپ»، «واکنش» و مذاکرهٔ صوتی) */
function sendRoomExcept(code, exceptId, env){
  const r = rooms.get(code);
  if(!r) return;
  for(const m of r.members) if(m.id !== exceptId) sendTo(m.id, env);
}

function sendLobby(env){
  for(const c of clients.values()) if(!c.room && !(env.from && c.muted && c.muted.has(env.from))) sendRaw(c, env);
}
function sendLobbyExcept(exceptId, env){
  for(const c of clients.values())
    if(!c.room && c.id !== exceptId && !(env.from && c.muted && c.muted.has(env.from))) sendRaw(c, env);
}

/* ─────────────── حضور ─────────────── */
function peerList(){
  return [...clients.values()].filter(c=>c.known&&c.role==='user').map(c => ({
    id: c.id, name: c.name, level: c.level, score: c.score,
    room: c.room || null, spectator: !!c.spectator, since: c.since
  }));
}
let peersSig = '';
function pushPeers(force){
  const list = peerList();
  const sig = JSON.stringify(list);
  /* تفاضلی (B19): بی تغییر، پخش نمی‌شود. `force` برای لحظه‌های لازم است
     (ورود/خروج، نشستِ تازه) که خودِ فهرست عوض نشده ولی دیدِ کاربر تازه‌است. */
  if(!force && sig === peersSig) return;
  peersSig = sig;
  for(const c of clients.values()) sendRaw(c, { t: 'peers', to: c.id, list, online: list.length });
}

const playersOf   = r => r.members.filter(m => !m.spectator);
const spectatorsOf = r => r.members.filter(m =>  m.spectator);
const memberView  = m => ({ id: m.id, name: m.name, level: m.level, score: m.score, spectator: !!m.spectator });

function roomList(){
  return [...rooms.values()].map(r => ({
    code: r.code, name: r.name, game: r.game,
    count: playersOf(r).length, max: LIMITS.roomMembers,
    spec: spectatorsOf(r).length,
    host: r.hostId, started: !!r.state
  }));
}
function pushRooms(){ const list = roomList(); for(const c of clients.values()) sendRaw(c, { t: 'rooms', to: c.id, list }); }

function roomUpdate(r){
  sendRoom(r.code, { t: 'room:update', to: 'room:' + r.code, code: r.code, host: r.hostId,
                     members: r.members.map(memberView) });
}

/* ─────────────── منطق بازی ─────────────── */
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const LETTERS = ['ا','ب','پ','ت','ث','ج','چ','ح','خ','د','ر','ز','ژ','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ک','گ','ل','م','ن','و','ه','ی'];

function winnerOf(board){
  for(const [a, b, c] of LINES)
    if(board[a] && board[a] === board[b] && board[a] === board[c]) return { line: [a, b, c], player: board[a] };
  return null;
}

function sendGameSnapshot(r,c){
  const st=r.state;if(!st)return;
  if(r.game==='dooz')sendRaw(c,{t:'game',to:c.id,game:r.game,phase:'start',state:st,seated:true});
  else if(st.phase==='results')sendRaw(c,{t:'game',to:c.id,game:r.game,phase:'results',letter:st.letter,round:st.round,
    results:playersOf(r).map(m=>({id:m.id,name:m.name,answers:st.answers[m.id]||{},score:st.scores[m.id]||0}))});
  else if(st.phase==='done')sendRaw(c,{t:'game',to:c.id,game:r.game,phase:'done',scores:st.scores});
  else sendRaw(c,{t:'game',to:c.id,game:r.game,phase:'round',letter:st.letter,round:st.round,total:st.total,players:playersOf(r).length});
}

function startGame(r){
  const players = playersOf(r);
  stats.totalGames++;
  saveData();
  if(r.game === 'dooz'){
    /* دونفره: میزبان X، اولین بازیکن دیگر O — بقیه تماشاچی می‌شوند */
    const opp = players.find(m => m.id !== r.hostId);
    r.state = { board: Array(9).fill(null), turn: 'X', over: false, winner: null, last: -1,
                sides: { X: r.hostId, O: opp ? opp.id : null } };
    sendRoom(r.code, { t: 'game', to: 'room:' + r.code, game: 'dooz', phase: 'start',
                       state: r.state, seated: !!r.state.sides.O });
  } else {
    r.state = { letter: LETTERS[Math.floor(Math.random() * LETTERS.length)], round: 1, total: 3,
                phase: 'round', answers: {}, scores: {} };
    sendRoom(r.code, { t: 'game', to: 'room:' + r.code, game: 'esmfamil', phase: 'round',
                       letter: r.state.letter, round: 1, total: 3, players: players.length });
  }
}

function doozMove(r, c, index){
  const st = r.state;
  if(!st || st.over) return;
  if(c.spectator) return;                                       // تماشاچی بازی نمی‌کند
  if(st.sides[st.turn] !== c.id) return;                        // نوبت تو نیست
  if(!Number.isInteger(index) || index < 0 || index > 8 || st.board[index]) return;  // حرکت نامعتبر
  st.board[index] = st.turn;
  st.last = index;
  const w = winnerOf(st.board);
  if(w){ st.over = true; st.winner = w.player; }
  else if(st.board.every(Boolean)){ st.over = true; st.winner = 'D'; }
  else st.turn = st.turn === 'X' ? 'O' : 'X';
  sendRoom(r.code, { t: 'game', to: 'room:' + r.code, game: 'dooz', phase: 'state', state: st });
}

function esmSubmit(r, c, msg){
  const st = r.state;
  if(!st || st.phase !== 'round') return;
  if(c.spectator) return;                                       // تماشاچی جواب نمی‌دهد
  const answers = {};
  if(msg.answers && typeof msg.answers === 'object')
    for(const [k, v] of Object.entries(msg.answers).slice(0, 8)) answers[clampStr(k, 16)] = clampStr(v, 40);
  st.answers[c.id] = answers;
  st.scores[c.id] = Math.max(0, Math.min(500, +msg.score || 0));
  const players = playersOf(r);
  if(Object.keys(st.answers).length >= players.length){
    st.phase = 'results';
    sendRoom(r.code, { t: 'game', to: 'room:' + r.code, game: 'esmfamil', phase: 'results',
      round: st.round, letter: st.letter,
      results: players.map(m => ({ id: m.id, name: m.name, answers: st.answers[m.id] || {}, score: st.scores[m.id] || 0 })) });
  } else {
    sendRoom(r.code, { t: 'game', to: 'room:' + r.code, game: 'esmfamil', phase: 'waiting',
      got: Object.keys(st.answers).length, total: players.length });
  }
}

function esmNext(r, c){
  const st = r.state;
  if(!st || r.hostId !== c.id || st.phase !== 'results') return;   // فقط میزبان
  if(st.round >= st.total){
    st.phase = 'done';
    sendRoom(r.code, { t: 'game', to: 'room:' + r.code, game: 'esmfamil', phase: 'done', scores: st.scores });
  } else {
    st.round++; st.letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    st.phase = 'round'; st.answers = {}; st.scores = {};
    sendRoom(r.code, { t: 'game', to: 'room:' + r.code, game: 'esmfamil', phase: 'round',
                       letter: st.letter, round: st.round, total: st.total, players: playersOf(r).length });
  }
}

/* ─────────────── خروج از روم ─────────────── */
function leaveRoom(c, silent){
  if(!c.room) return;
  const r = rooms.get(c.room);
  const wasSpectator = !!c.spectator;
  c.room = null; c.spectator = false;
  if(!r) return;
  r.members = r.members.filter(m => m.id !== c.id);
  if(!silent) sendTo(c.id, { t: 'room:left', to: c.id });
  if(r.members.length === 0){
    rooms.delete(r.code);
    log(`🏠 روم ${r.code} بسته شد`);
  } else {
    /* میزبان رفته؟ میزبانی به اولین بازیکن باقی‌مانده می‌رسد و بازی ریست می‌شود */
    if(r.hostId === c.id){
      const heir = playersOf(r)[0] || r.members[0];
      r.hostId = heir.id;
      r.state = null;
      log(`👑 میزبانی روم ${r.code} به ${heir.name} رسید`);
    }
    if(!wasSpectator){r.state = null;sendRoom(r.code,{t:'game:cancelled',to:'room:'+r.code,msg:'بازیکن از روم خارج شد؛ این دور پایان یافت.'});}
    /* اگر بازی دونفره بود و یکی رفت، نفر بعدی به‌جایش بازیکن می‌شود */
    if(r.game === 'dooz' && playersOf(r).length < 2){
      const promoted = spectatorsOf(r)[0];
      if(promoted){ promoted.spectator = false; sendTo(promoted.id, { t: 'room:update', to: promoted.id, code: r.code, host: r.hostId, members: r.members.map(memberView) }); }
    }
    roomUpdate(r);
    sendRoom(r.code, { t: 'chat', to: 'room:' + r.code, sys: true,
                       text: wasSpectator ? 'یک تماشاچی از روم خارج شد' : 'یک بازیکن از روم خارج شد' });
  }
  pushRooms();
}

/* ─────────────── دوستی‌ها ─────────────── */
/* ── دوستی (B8) ──
   ساختارِ پیشین «نام -> [نام]» بود و سه سرگردانی از همان می‌آمد:
   • کاربری که نامش را عوض می‌کرد، فهرستِ دوستانش را می‌باخت (کلید رفته بود)
     و در فهرستِ دیگران به نامِ کهنه می‌ماند؛
   • دو نفر با یک نام، در عمل یک کارنامه می‌شدند — دوستیِ یک نفر به دیگری
     می‌چسبید؛
   • «کاربرِ آفلاین» قابل تشخیص نبود جز با نگاه به نام.
   کلید حالا `usr_…` است (شناسه‌ای که سرور می‌سازد و عوض نمی‌شود) و نام تنها
   برای نمایش نگه داشته می‌شود. */
function linkFriends(a, b){
  if(!a || !b || a === b) return;
  for(const [x, y] of [[a, b], [b, a]]){
    if(!Array.isArray(friends[x])) friends[x] = [];
    if(!friends[x].includes(y)) friends[x].unshift(y);
    friends[x] = friends[x].slice(0, LIMITS.friendsPerUser);
  }
  saveData();
}
function friendNote(uid, name){
  if(!uid || !name) return;
  if(friendsNames.get(uid) !== name){ friendsNames.set(uid, name); saveData(); }
}
/* ثبتِ رکوردِ کارنامه. نام از *اتصال* می‌آید، نه از پیام؛ وگرنه هر کس
   می‌توانست به نامِ دیگری امتیاز بنشاند. */
function lbPut(c, score){
  /* B8+B9: کلیدِ رکورد «آدم» است، نه رشتهٔ نام. دو «بازیکن»ِ هم‌نام پیش‌تر یک
     خانه را share می‌کردند و رکوردِ یکی به دیگری می‌چسبید. نام برای نمایش است
     و شناسهٔ کاربر برای هویت؛ رکوردهایِ کهنهٔ بی‌شناسه با همان نام خوانده
     می‌شوند تا جدولِ کسی خراب نشود. */
  const name = c.name || DEFAULT_USER_NAME;
  const key  = c.uid || name;
  const ex = leaderboard.find(l => (l.uid || l.name) === key);
  if(ex){
    ex.score = Math.max(ex.score, score);
    ex.name = name; ex.uid = c.uid || ex.uid || null; ex.at = now();
  }
  else leaderboard.push({ name, uid: c.uid || null, score, at: now() });
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 30);
  saveData();
  for(const cl of clients.values()) sendRaw(cl, { t: 'lb', to: cl.id, list: leaderboard });
}


function friendListFor(c){
  const ids = friends[c.uid || c.name] || [];
  const byUid = new Map([...clients.values()].map(x => [x.uid || x.name, x]));
  return ids.map(uid => {
    const on = byUid.get(uid);
    return {
      uid,
      name: on ? on.name : (friendsNames.get(uid) || 'دوست نورستانی'),
      online: !!on,
      id: on ? on.id : null,
      level: on ? on.level : null,
      score: on ? on.score : null
    };
  });
}
/* مهاجرتِ دادهٔ نام‌محور: کلیدها و مقدارها به شناسهٔ صاحبشان تبدیل می‌شوند.
   نامِ دوباره‌دار یا نامی که کاربرش ثبت‌نام نکرده، کنار می‌نشیند — بهتر از
   آنکه دوستی‌ای به آدمِ اشتباه بچسبد. */
function friendsMigrate(){
  const byName = new Map();
  for(const rec of userByPhone.values()){
    byName.set(rec.name, byName.has(rec.name) ? null : rec.id);
  }
  const next = {};
  let moved = 0, lost = 0;
  for(const key of Object.keys(friends)){
    const list = Array.isArray(friends[key]) ? friends[key] : [];
    const from = USER_ID_RE.test(key) ? key : byName.get(key);
    if(!from){ lost += list.length; continue; }
    const arr = [];
    for(const n of list){
      const isName = !USER_ID_RE.test(n);
      const to = isName ? byName.get(n) : n;
      if(!to){ lost++; continue; }
      if(to !== from && !arr.includes(to)) arr.push(to);
      if(isName) friendNote(to, n);
    }
    if(arr.length){ next[from] = arr.slice(0, LIMITS.friendsPerUser); moved++; }
  }
  friends = next;
  if(moved || lost){
    saveData();
    log(`🤝 فهرستِ دوستی به شناسه منتقل شد: ${moved} کارنامه${lost ? `، ${lost} ردیفِ بی‌صاحب افتاد` : ''}`);
  }
}


/* ─────────────── پردازش پیام کلاینت ─────────────── */
function handleMessage(c, msg){
  stats.totalMessages++;
  if(!msg || typeof msg !== 'object') return;

  /* محدودیت نرخ */
  const t = now();
  c.stamps = c.stamps.filter(x => t - x < 5000);
  if(c.stamps.length >= LIMITS.ratePer5s){
    if(!c.warnedAt || t - c.warnedAt > 5000){
      c.warnedAt = t;
      sendRaw(c, { t: 'room:error', to: c.id, msg: 'سرعت ارسال پیام زیاد است' });
    }
    return;
  }
  c.stamps.push(t);
  c.lastSeen = t;

  /* احراز هویت مدیر — با *نشانهٔ نشست*، نه با هشِ رمز.
     پیش‌تر کلاینت هش را می‌فرستاد و سرور مقایسه می‌کرد؛ یعنی هش بدلِ رمز شده
     بود. حالا نشانه‌ای که سرور خودش ساخته و در حافظه دارد می‌آید، و هر بار
     دوباره سنجیده می‌شود تا اتصالِ کهنه اختیارش را از دست بدهد.
     `msg.hash` عمداً دیگر خوانده *نمی‌شود*: پذیرفتنِ هر دو راه، راهِ قدیمی را
     زنده نگه می‌داشت. */
  if(typeof msg.token === 'string'){
    if(adminAlive(msg.token)){
      c.isAdmin = true;
      c.adminExp = now() + ADMIN_SESSION_MS;
      c.adminToken = msg.token;
    }else{
      c.isAdmin = false;
      c.adminExp = 0;
    }
  }

  if(msg.t==='hello'){
    if(msg.adminToken && adminAlive(msg.adminToken) && c.role!=='user'){
      c.role='admin';c.known=true;c.adminToken=msg.adminToken;c.isAdmin=true;
      c.adminExp=adminSessions.get(msg.adminToken).exp;
      sendRaw(c,{t:'authenticated',to:c.id,role:'admin'});return;
    }
    /* مسدود، پیش از هر پاسخِ عمومی.
       `userTokenGet` برای کاربرِ مسدود نال می‌دهد (درست)، ولی اگر همین‌جا
       به آن نال بسنده کنیم، پیام «ورود پیامکی لازم است» می‌رود — یعنی
       کاربری که مسدود شده، تشویق می‌شود دوباره و دوباره کد بخواهد و
       سهمیهٔ پیامکش را بسوزاند، بی آنکه بداند دسترسیش بسته است. پس اول
       مسدودبودن سنجیده می‌شود و علتِ راستین گفته می‌شود. */
    const peek=userTokenPeek(msg.userToken);
    if(peek && !c.isAdmin){
      const blocked=userOf(peek.phone);
      if(blocked && blocked.blocked){
        c.known=true;                       // تا این یک پیام از صافیِ sendRaw بگذرد
        sendRaw(c,{t:'notif',to:c.id,title:'دسترسی بسته است',
                   desc:'این شماره مسدود شده — با مدیر تماس بگیر',icon:'🚫'});
        log(`🚫 کاربرِ مسدود رد شد (${blocked.id})`);
        Timers_sleep_close(c);return;
      }
    }
    const auth=userTokenGet(msg.userToken);
    if(!auth || c.role==='admin'){
      sendRaw(c,{t:'auth:error',to:c.id,msg:'ورود پیامکی لازم است'});Timers_sleep_close(c);return;
    }
    c.role='user';c.userToken=msg.userToken;c.known=true;
    sendRaw(c,{t:'authenticated',to:c.id,role:'user'});
  }else{
    const valid=c.role==='admin'?isAdminNow(c):c.role==='user'&&userTokenGet(c.userToken);
    if(!valid){sendRaw(c,{t:'auth:error',to:c.id,msg:'نشست معتبر نیست'});Timers_sleep_close(c);return;}
    const adminAction=String(msg.t).startsWith('admin:');
    if((adminAction && c.role!=='admin') || (c.role==='admin'&&!adminAction&&!['hb','bye'].includes(msg.t))){
      sendRaw(c,{t:'room:error',to:c.id,msg:'این عملیات برای این نوع حساب مجاز نیست'});return;
    }
  }

  /* گیرندهٔ مستقیم — برای پیام‌های نقطه‌به‌نقطه (دوستی و مذاکرهٔ صوتی) */
  const direct = (msg.to && msg.to !== '*' && !String(msg.to).startsWith('room:'))
    ? clients.get(String(msg.to)) : null;

  switch(msg.t){
    case 'hello': {
      c.name = clampStr(msg.name, LIMITS.nameLen) || DEFAULT_USER_NAME;
      c.level = Math.max(1, Math.min(999, +msg.level || 1));
      c.score = Math.max(0, +msg.score || 0);
      c.known = true;

      /* ── هویتِ تأییدشده ──
         تنها راهِ اینکه سرور باور کند این اتصال مالِ فلان شماره است، نشانهٔ
         نشستی است که خودش پس از تأییدِ پیامک داده. `userId` تنها، ادعاست:
         هر کسی می‌تواند شناسهٔ دیگری را بنویسد. پس اگر نشانه نبود، اتصال
         مهمان می‌ماند — همان‌طور که پیش‌تر همه بودند. */
      const uTok = userTokenGet(msg.userToken);
      if(uTok){
        const rec = userOf(uTok.phone);
        if(rec && !rec.blocked){
          c.user = rec;
          c.phone = rec.phone;
          c.uid = rec.id;
          /* نام: کارنامه مقدم است — اما فقط اگر کاربر واقعاً نامی گفته
             باشد. پیش‌تر مقدارِ پیش‌فرضِ «بازیکن» هم «نامِ ثبت‌شده» حساب
             می‌شد و نامی را که کلاینت فرستاده بود می‌بلعید؛ نتیجه این بود
             که در لابی و روم همه «بازیکن» دیده می‌شدند، بی آنکه کسی نامی
             نگفته باشد. نامِ پیش‌فرض یعنی «نامی ندارد»، نه «نامش این است».
             و اگر کارنامه هنوز بی‌نام است، نامی که همین حالا رسیده همان
             نامی است که کاربر برای خودش خواسته — پس در کارنامه می‌نشیند
             تا دفعهٔ بعد از اول درست باشد. */
          if(rec.name && rec.name !== DEFAULT_USER_NAME) c.name = rec.name;
          else if(c.name && c.name !== DEFAULT_USER_NAME){ rec.name = c.name; }
          rec.plays = Math.max(rec.plays || 0, 0);
          rec.lastLogin = now();
          saveData();
          c.name = clampStr(c.name, LIMITS.nameLen) || DEFAULT_USER_NAME;
          friendNote(c.uid, c.name);   // B8: نامِ روزِ آخر، برای فهرستِ دوست‌ها
        }
        /* مسدودبودن اینجا سنجیده نمی‌شود: دروازهٔ بالای `hello` پیش‌تر
           آن را بسته و علتش را هم گفته است. گذاشتنِ یک شاخهٔ دوم اینجا
           فقط کدِ مرده می‌ساخت — و کدِ مرده در مسیرِ امنیت یعنی خواننده
           بعدی نمی‌داند کدام شاخه واقعاً اجرا می‌شود. */
      }else if(msg.userId && !USER_ID_RE.test(String(msg.userId))){
        /* شناسهٔ بی‌شکل نادیده گرفته می‌شود؛ ولی چیزی که مهم است این است که
           *هیچ* اختیاری به آن داده نمی‌شود. */
        log(`ℹ️ شناسهٔ بی‌شکل از ${c.id} نادیده گرفته شد`);
      }

      log(`👤 ${c.name} (${c.id}) وارد شد${c.phone ? ' — کاربرِ ثبت‌شده' : ''}`);
      sendRaw(c, { t: 'peers', to: c.id, list: peerList(), online: clients.size });
      sendRaw(c, { t: 'rooms', to: c.id, list: roomList() });
      sendRaw(c, { t: 'lb', to: c.id, list: leaderboard.slice(0, 30) });
      sendRaw(c, { t: 'friends', to: c.id, list: friendListFor(c) });
      /* کارنامهٔ خودش — بی هیچ رازی. کلاینت از این‌جا می‌فهمد پیامکِ
         خوش‌آمدگویی رفت یا نه. */
      if(c.user) sendRaw(c, { t: 'me', to: c.id, ...userMeView(c.user) });
      pushPeers();
      pushRooms();
      break;
    }
    case 'hb': break;

    case 'rooms:list':
      sendRaw(c, { t: 'rooms', to: c.id, list: roomList() });
      break;

    case 'room:create': {
      if(rooms.size >= LIMITS.rooms){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'سرور پر است — بعداً امتحان کن' }); return; }
      if(c.room){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'اول از روم فعلی خارج شو' }); return; }
      if(c.roomsMade >= LIMITS.roomsPerClient){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'حد ساخت روم تمام شد' }); return; }
      let code; let guard = 0;
      do { code = code6(); } while(rooms.has(code) && ++guard < 50);
      const r = { code, name: clampStr(msg.name, LIMITS.roomNameLen) || 'روم',
                  game: msg.game === 'esmfamil' ? 'esmfamil' : 'dooz',
                  hostId: c.id, members: [c], state: null, createdAt: now() };
      rooms.set(code, r);
      c.room = code; c.roomsMade = (c.roomsMade || 0) + 1; c.spectator = false;
      sendRaw(c, { t: 'room:joined', to: c.id, code, name: r.name, game: r.game, host: r.hostId,
                   isHost: true, spectator: false, max: LIMITS.roomMembers, members: r.members.map(memberView) });
      log(`🏠 روم ${code} ساخته شد توسط ${c.name}`);
      pushRooms();
      break;
    }

    case 'room:join': {
      const code = clampStr(msg.code, 6);
      const r = rooms.get(code);
      if(!r){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'رومی با این کد پیدا نشد' }); return; }
      if(r.members.some(m => m.id === c.id)){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'خودت در این رومی' }); return; }

      /* نسخهٔ ۱۵: روم تا ۸ بازیکن؛ نفرات بعدی خودکار تماشاچی می‌شوند */
      const full = !!r.state || playersOf(r).length >= LIMITS.roomMembers;
      if(full && spectatorsOf(r).length >= LIMITS.roomSpectators){
        sendRaw(c, { t: 'room:error', to: c.id, msg: 'روم پر است — حتی جای تماشاچی هم نیست' }); return;
      }
      if(c.room) leaveRoom(c, true);
      c.spectator = full;
      r.members.push(c);
      c.room = code;
      sendRaw(c, { t: 'room:joined', to: c.id, code, name: r.name, game: r.game, host: r.hostId,
                   isHost: r.hostId === c.id, spectator: c.spectator, max: LIMITS.roomMembers,
                   members: r.members.map(memberView) });
      if(c.spectator) sendRaw(c, { t: 'spectate', to: c.id, reason: 'full' });
      roomUpdate(r);
      sendGameSnapshot(r,c);
      sendRoom(code, { t: 'chat', to: 'room:' + code, sys: true,
                       text: c.spectator ? `${c.name} به‌عنوان تماشاچی وارد شد` : `${c.name} وارد روم شد` });
      log(`➡️ ${c.name} ${c.spectator ? '(تماشاچی) ' : ''}به روم ${code} پیوست`);
      pushRooms();
      break;
    }

    /* ورود مستقیم با حالت تماشاچی، حتی وقتی جا هست */
    case 'room:spectate': {
      const r = rooms.get(clampStr(msg.code, 6));
      if(!r){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'رومی با این کد پیدا نشد' }); return; }
      if(spectatorsOf(r).length >= LIMITS.roomSpectators){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'جای تماشاچی پر است' }); return; }
      if(c.room) leaveRoom(c, true);
      c.spectator = true;
      r.members.push(c);
      c.room = r.code;
      sendRaw(c, { t: 'room:joined', to: c.id, code: r.code, name: r.name, game: r.game, host: r.hostId,
                   isHost: r.hostId === c.id, spectator: true, max: LIMITS.roomMembers,
                   members: r.members.map(memberView) });
      sendRaw(c, { t: 'spectate', to: c.id, reason: 'asked' });
      roomUpdate(r);
      sendGameSnapshot(r,c);
      pushRooms();
      break;
    }

    case 'room:leave':
      leaveRoom(c, false);
      break;

    case 'room:start': {
      const r = rooms.get(c.room);
      if(!r || r.hostId !== c.id){sendRaw(c,{t:'room:error',to:c.id,msg:'فقط میزبان می‌تواند بازی را آغاز کند'});return;}                       // فقط میزبان
      /* B17: `room:start` بی‌نگاه به حالتِ روم `startGame()` را می‌ranج داد؛
         یعنی یک کلیکِ دوتایی (یا پیامِ دست‌کاری‌شده) تخته را پاک می‌کرد و
         امتیازهای میانهٔ همان دست می‌سوخت، در حالی که همه هنوز سرِ همان
         دست بودند و «برنده» عوض می‌شد. */
      /* B17: یک کلیکِ دوتایی (یا پیامِ دست‌کاری‌شده) تخته را پاک می‌کرد و
         امتیازهای میانهٔ همان دست می‌سوخت. «بازی از نو»یِ واقعی اما کارِ
         کاربر است، آن هم پس از گفت‌وگوی تأیید — کلاینت در همان مسیر `force`
         می‌فرستد؛ و دستِ *تمام‌شده* هم که هیچ‌وقت مانع نبود (rematch). */
      if(r.state && !r.state.over && !msg.force){
        sendRaw(c, { t: 'room:error', to: c.id, msg: 'دستِ جاری تمام شود، بعد شروع کن (یا از «بازی از نو» استفاده کن)' });
        return;
      }
      if(msg.game && msg.game !== r.game && ['dooz','esmfamil'].includes(msg.game)) r.game = msg.game;
      const players = playersOf(r);
      if(players.length < 2){
        sendRaw(c, { t: 'room:error', to: c.id, msg: 'بازیکن دوم هنوز نیامده' });
        return;
      }
      /* اگر دونفره است و بیش از دو بازیکن داریم، بقیه در این دست تماشاچی می‌شوند */
      if(r.game === 'dooz' && players.length > 2){
        players.slice(2).forEach(m => { m.spectator = true; sendTo(m.id, { t: 'spectate', to: m.id, reason: 'dooz' }); });
        roomUpdate(r);
      }
      startGame(r);
      log(`🎮 بازی ${r.game} در روم ${r.code} شروع شد (${playersOf(r).length} بازیکن)`);
      break;
    }

    case 'room:game': {
      const r = rooms.get(c.room);
      if(!r || !r.state) return;
      if(r.game === 'dooz' && !msg.phase) doozMove(r, c, +msg.index);
      else if(r.game === 'esmfamil'){
        if(msg.phase === 'next') esmNext(r, c);
        else esmSubmit(r, c, msg);
      }
      break;
    }

    case 'chat': {
      const text = clampStr(msg.text, LIMITS.chatLen);   // B18: نویسه‌های مخرب پاک می‌شوند
      if(!text) return;
      /* B18: سقفِ چت. «۴۰ پیام در ۵ ثانیه» برای *کلِ* ترافیکِ یک اتصال بود؛
         چتِ یک‌نفره می‌توانست صفحهٔ بقیه را با سیلِ پیام پر کند و هیچ‌کس
         حرفِ دیگری را نبیند. یک پیام در ثانیه برای نوشتنِ انسانی کافی است. */
      if(now() - (c.chatAt || 0) < 1000){
        sendRaw(c, { t: 'chat:slow', to: c.id, wait: 1 });
        return;
      }
      c.chatAt = now();
      const env = { t: 'chat', from: c.id, name: c.name, uid: c.uid || '', text };
      if(c.room) sendRoom(c.room, { ...env, to: 'room:' + c.room });
      else sendLobby({ ...env, to: '*' });
      break;
    }


    /* ── نسخهٔ ۱۵: «در حال نوشتن…» ── */
    case 'typing': {
      const env = { t: 'typing', from: c.id, name: c.name };
      if(c.room) sendRoomExcept(c.room, c.id, { ...env, to: 'room:' + c.room });
      else sendLobbyExcept(c.id, env);
      break;
    }

    /* ── B18: «خاموش‌کردن» و «گزارش» ──
       این دو در نسخهٔ پیشین نبود: کاربرِ آزار‌دیده نه می‌توانست کسی را
       بی‌صدا کند نه چیزی گزارش دهد؛ تنها راه، آمدنِ مدیر بود.
       خاموش‌کردن در همین نشست نگه داشته می‌شود و ادعای «دائمی» ندارد —
       چون ماندنِ آن روی دیسک یعنی پرونده‌سازیِ متقابل؛ برای آرامشِ همین
       لحظه کافی است. */
    case 'mute:add': case 'mute:remove': {
      const who = clampStr(msg.id || msg.to, 24);
      const other = clients.get(who) || clientByUid(who);
      if(!other || other.id === c.id){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'کاربر پیدا نشد' }); return; }
      c.muted = c.muted || new Set();
      const mk = x => [x.id, x.uid].filter(Boolean);
      if(msg.t === 'mute:add') mk(other).forEach(x => c.muted.add(x));
      else mk(other).forEach(x => c.muted.delete(x));
      sendRaw(c, { t: 'mute:ok', to: c.id, id: other.id, muted: c.muted.has(other.id) });
      log(`${msg.t === 'mute:add' ? '🔇' : '🔊'} ${c.name}، ${other.name} را ${msg.t === 'mute:add' ? 'خاموش' : 'باز'} کرد`);
      break;
    }

    case 'report:user': {
      const who = clampStr(msg.id || msg.to, 24);
      const other = clients.get(who) || clientByUid(who);
      if(!other){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'کاربر پیدا نشد' }); return; }
      const reason = clampStr(msg.reason, 120);
      c.repAt = c.repAt || new Map();
      const last = c.repAt.get(other.id) || 0;
      if(now() - last < 60000){
        sendRaw(c, { t: 'report:wait', to: c.id, waitSec: Math.ceil((60000 - (now() - last)) / 1000) });
        return;
      }
      c.repAt.set(other.id, now());
      reports.push({ at: now(), by: c.uid || '', byName: c.name, who: other.uid || '',
                     whoName: other.name, room: c.room || '', reason });
      if(reports.length > 200) reports = reports.slice(-200);
      saveData();
      sendRaw(c, { t: 'report:ok', to: c.id, msg: 'گزارش ثبت شد؛ مدیر بررسی می‌کند' });
      for(const cl of clients.values())
        if(isAdminNow(cl)) sendRaw(cl, { t: 'report:new', to: cl.id, name: other.name, reason, room: c.room || '' });
      log(`🚩 گزارشِ کاربر ${other.name} از ${c.name}${reason ? ' — ' + reason : ''}`);
      break;
    }


    /* ── نسخهٔ ۱۵: واکنش زندهٔ محفل ── */
    case 'react': {
      const emoji = clampStr(msg.emoji, 8);
      if(!REACTIONS.includes(emoji)) return;                    // فقط واکنش‌های شناخته‌شده
      const env = { t: 'react', from: c.id, name: c.name, emoji };
      if(c.room) sendRoomExcept(c.room, c.id, { ...env, to: 'room:' + c.room });
      else sendLobbyExcept(c.id, env);
      break;
    }

    /* ── نسخهٔ ۱۵: مذاکرهٔ صوتی اختیاری (WebRTC) ──
       سرور فقط پیام‌ها را رد می‌کند؛ صدا هیچ‌وقت از سرور نمی‌گذرد. */
    case 'rtc': {
      if(!c.room) return;                                       // فقط داخل روم
      const body = msg.sdp ? { sdp: msg.sdp } : (msg.ice ? { ice: msg.ice } : null);
      if(!body) return;
      if(JSON.stringify(body).length > LIMITS.sdpBytes){ log('⚠️ پیام مذاکرهٔ صوتی بزرگ حذف شد'); return; }
      const target = direct && direct.room === c.room ? direct.id : null;
      const env = { t: 'rtc', from: c.id, name: c.name, ...body };
      if(target) sendTo(target, env);
      else sendRoomExcept(c.room, c.id, { ...env, to: 'room:' + c.room });
      break;
    }

    /* ── نسخهٔ ۱۵: دوستی‌ها ── */
    case 'friend:req': {
      const target = direct;
      if(!target || target.id === c.id) return;
      /* B16 — یک نفر که پشتِ سرِ هم درخواست می‌فرستد، صفِ «در انتظارِ پاسخ» را
         پر می‌کرد و هر بار به طرفِ مقابل پیام می‌رفت. برای هر (فرستنده ← گیرنده)
         یک مکث؛ درخواستِ تکراری با پیامِ خودمانی رد می‌شود تا کاربر نداند چه شد. */
      c.frAt = c.frAt || new Map();
      const coolAt = c.frAt.get(target.id) || 0;
      if(now() - coolAt < FR_COOLDOWN_MS){
        sendRaw(c, { t: 'friend:error', to: c.id, msg: 'درخواستِ قبلی‌ات بی‌پاسخ است — '
          + Math.ceil((FR_COOLDOWN_MS - (now() - coolAt)) / 1000) + ' ثانیه بعد دوباره بفرست' });
        break;
      }
      c.frAt.set(target.id, now());
      pendingFriends.set(c.id, { toId: target.id, at: now() });
      sendTo(target.id, { t: 'friend:req', from: c.id, name: c.name });
      break;
    }
    case 'friend:ok': {
      const target = direct;
      if(!target) return;
      const p = pendingFriends.get(target.id);
      /* بی درخواستِ زنده، پذیرش معنا ندارد (پیش‌تر دوستیِ یک‌طرفه جعل می‌شد) */
      if(!p || p.toId !== c.id || now() - p.at > 120000) return;
      pendingFriends.delete(target.id);
      linkFriends(c.uid || c.name, target.uid || target.name);
      sendTo(target.id, { t: 'friend:ok', from: c.id, name: c.name });
      sendRaw(c, { t: 'friends', to: c.id, list: friendListFor(c) });
      sendRaw(target, { t: 'friends', to: target.id, list: friendListFor(target) });
      log(`🤝 ${c.name} و ${target.name} دوست شدند`);
      break;
    }
    case 'friend:no': {
      const target = direct;
      if(!target) return;
      pendingFriends.delete(target.id);
      sendTo(target.id, { t: 'friend:no', from: c.id, name: c.name });
      break;
    }
    case 'friend:list':
      sendRaw(c, { t: 'friends', to: c.id, list: friendListFor(c) });
      break;

    case 'lb:get':
      sendRaw(c, { t: 'lb', to: c.id, list: leaderboard.slice(0, 30) });
      break;

    case 'lb:put': {
      /* B9: امتیاز پیش‌تر «ادعایِ بدون سقفِ کلاینت» بود: `score: 999999999`
         در صدرِ جدول می‌نشست. بازی در دستگاهِ کاربر جریان دارد، پس سرور
         راستی را نمی‌بیند — ولی می‌تواند «باورکردنی» را بپاید:
         • سقفِ مطلق (NOOR_LB_MAX، نه ۱e۹)؛
         • رشدِ هر نشست محدود به یک گامِ ساعتی؛ نخستین ادعایِ یک نشست آزادتر
           است، چون بازیِ آفلاین واقعیت دارد و کاربرِ آفلاین نباید مجازات
           شود — ولی همان هم تا LB_MAX؛
         • کارنامه در این مسیر پایین نمی‌آید، تا بهانهٔ پاک‌کردنِ رکوردِ
           دیگری نشود؛
         • و نرخ: یک ثبت در ثانیه — کوبیدنِ این مسیر هم ارزانیِ سرویس‌دهی است. */
      const want = Number.isFinite(msg.score) ? Math.floor(msg.score) : -1;
      if(want < 0){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'امتیاز معتبر نیست' }); return; }
      if(now() - (c.lbAt || 0) < 1000) return;
      c.lbAt = now();
      const prev = c.score || 0;
      const hours = Math.max(1, Math.ceil((now() - (c.since || now())) / 3600000));
      const first = !c.scoreSeen;
      if(!first){
        const ceil = Math.min(LB_MAX, prev + LB_STEP_HOUR * hours);
        if(want > ceil){
          sendRaw(c, { t: 'room:error', to: c.id, msg: 'رشدِ امتیاز در این نشست بیش از حدِ مجاز است' });
          return;
        }
      }
      const score = Math.max(prev, Math.min(want, LB_MAX));
      c.scoreSeen = true;
      c.score = score;
      if(c.user){ c.user.score = Math.max(c.user.score || 0, score); }
      lbPut(c, score);
      break;
    }

    case 'admin:broadcast': {
      if(!isAdminNow(c)){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'دسترسی مدیر لازم است' }); return; }
      const title = clampStr(msg.title, 60), desc = clampStr(msg.desc, LIMITS.textLen);
      if(!title || !desc) return;
      log(`📢 اعلان سراسری: ${title}`);
      for(const cl of clients.values()) sendRaw(cl, { t: 'notif', to: cl.id, title, desc, icon: '📢' });
      break;
    }

    case 'admin:room:close': {
      if(!isAdminNow(c)) return;
      const code = clampStr(msg.code, 6);
      const r = rooms.get(code);
      if(!r) return;
      log(`🛑 مدیر روم ${code} را بست`);
      for(const m of r.members){
        sendTo(m.id, { t: 'room:left', to: m.id });
        sendTo(m.id, { t: 'notif', to: m.id, title: 'روم بسته شد', desc: 'مدیر این روم را بست', icon: '🛑' });
        const cl = clients.get(m.id);
        if(cl){ cl.room = null; cl.spectator = false; }
      }
      rooms.delete(code);
      pushRooms();
      break;
    }

    /* ── کارهای مدیر روی کاربران ──
       هر کدام با نشانهٔ نشستِ مدیر سنجیده می‌شود. کاربر با `id` یا `phone`
       شناخته می‌شود؛ پنل ادمین هر دو را نشان می‌دهد. */
    case 'admin:user:block':
    case 'admin:user:unblock':
    case 'admin:user:delete':
    case 'admin:user:sms': {
      if(!isAdminNow(c)) return;
      const rec = userLookup(msg);
      if(!rec){ sendRaw(c, { t: 'admin:user:err', to: c.id, msg: 'کاربر پیدا نشد' }); return; }

      if(msg.t === 'admin:user:block' || msg.t === 'admin:user:unblock'){
        rec.blocked = msg.t === 'admin:user:block';
        saveData();
        log(`${rec.blocked ? '🚫' : '✅'} مدیر کاربر ${rec.id} را ${rec.blocked ? 'مسدود' : 'آزاد'} کرد`);
        /* کاربرِ آنلاین بی‌درنگ بیرون می‌رود. مسدودکردنِ کسی که همچنان
           بازی می‌کند، مسدودکردن نیست. */
        if(rec.blocked){
          for(const cl of clients.values()){
            if(cl.phone === rec.phone){
              sendRaw(cl, { t: 'notif', to: cl.id, title: 'دسترسی بسته شد',
                            desc: 'این شماره از طرف مدیر مسدود شد', icon: '🚫' });
              cl.closeClient('مسدود شد');
            }
          }
        }
        pushAdminUsers();
        break;
      }

      if(msg.t === 'admin:user:delete'){
        const had = users_sessions_drop(rec);
        log(`🗑 مدیر کاربر ${rec.id} را حذف کرد (${had} نشست باطل شد)`);
        pushAdminUsers();
        break;
      }

      /* پیامکِ مدیریتی به کاربر.
         `handleMessage` همگام است و عمداً همگام می‌ماند؛ اگر async می‌شد، هر
         استثنا یک ردشدنِ بی‌گیر می‌ساخت. پس فرستادن جدا می‌شود و نتیجه‌اش
         بعداً به مدیر می‌رسد. */
      if(!smsConfigured()){ sendRaw(c, { t: 'admin:user:err', to: c.id, msg: 'پیامک روی سرور تنظیم نشده' }); return; }
      const text = clampStr(msg.text, LIMITS.textLen);
      if(!text){ sendRaw(c, { t: 'admin:user:err', to: c.id, msg: 'متن پیامک خالی است' }); return; }
      const lim = smsAllow(rec.phone, 'admin');
      if(!lim.ok){ sendRaw(c, { t: 'admin:user:err', to: c.id, msg: lim.why }); return; }
      adminSmsTo(c, rec, text);
      break;
    }

    case 'admin:users': {
      if(!isAdminNow(c)) return;
      sendRaw(c, { t: 'admin:users', to: c.id, list: userListView() });
      break;
    }

    case 'admin:stats': {
      if(!isAdminNow(c)) return;
      sendRaw(c, { t: 'admin:stats', to: c.id, stats: serverStats() });
      break;
    }

    case 'bye':
      sendRaw(c, { t: 'bye', to: c.id });
      break;
  }
}

function serverStats(){
  let players = 0, specs = 0;
  for(const r of rooms.values()){ players += playersOf(r).length; specs += spectatorsOf(r).length; }
  return { version: VERSION, online: clients.size, rooms: rooms.size, peakOnline: stats.peakOnline,
           playersInRooms: players, spectators: specs, friends: Object.keys(friends).length,
           totalConnections: stats.totalConnections, totalMessages: stats.totalMessages,
           totalGames: stats.totalGames, uptimeSec: Math.round((now() - stats.startedAt) / 1000),
           leaderboardSize: leaderboard.length };
}

/* ─────────────── پیامک (‏textbee.dev) ───────────────
   چرا سرور واسطه می‌شود و کلاینت مستقیم نمی‌زند؟ چون کلید textbee یک
   اعتبار خرج‌شدنی است. اگر در `index.html` بنشیند، هر کسی که صفحه را باز
   کند (یا سورسش را ببیند) کلید را برمی‌دارد و می‌تواند به حساب صاحبش
   پیامک بفرستد. این‌جا کلید در محیط سرور می‌ماند: NOOR_SMS_KEY و
   NOOR_SMS_DEVICE. کلاینت فقط می‌گوید «به این شماره این کد را بفرست».

   دو محافظ، چون این نقطهٔ پایانی بی احراز هویت است و روی شبکهٔ محلی باز
   است:
   ۱. **قالب ثابت.** سرور متن آزاد نمی‌پذیرد؛ فقط {code} یا {test}. پس
      نمی‌شود از آن مثل رلهٔ پیامک استفاده کرد.
   ۲. **کران نرخ.** هر شماره ۳ پیامک در ۱۰ دقیقه، هر IP ۲۰ در ساعت، و
      سقف کل ۴۰ در ساعت — سقف کل، محافظ اصلی اعتبار است.

   بی این دو، یک اسکریپت روی همان وای‌فای می‌توانست تا آخرین ریال اعتبار
   پیامک بفرستد. */
const SMS_KEY      = process.env.NOOR_SMS_KEY || '';
const SMS_DEVICE   = process.env.NOOR_SMS_DEVICE || '';
const SMS_ON       = process.env.NOOR_SMS_ON !== '0';
const SMS_ENDPOINT = process.env.NOOR_SMS_ENDPOINT || 'https://api.textbee.dev/api/v1/gateway/send-sms';
/* ۳۰ ثانیه، نه ۲۰. textbee گاهی کند پاسخ می‌دهد و ۲۰ ثانیه زود تمام می‌شد.
   مهم‌تر: «تمام شدن وقت» یعنی «نمی‌دانم»، نه «نشد» — پیامک ممکن است رفته باشد.
   با NOOR_SMS_TIMEOUT قابل تغییر است (آزمون از این راه مسیر «تمام شدن وقت» را
   در کسری از ثانیه می‌سنجد، نه با ۳۰ ثانیه انتظار). بین ۱ تا ۱۲۰ ثانیه بسته
   می‌شود تا یک مقدار غلط، سرور را بی‌دفاع نکند. */
const SMS_TIMEOUT  = Math.min(120000, Math.max(1000,
                       Number(process.env.NOOR_SMS_TIMEOUT) || 30000));

/* سقف‌های ساعتی با متغیر محیطی تنظیم‌شدنی‌اند: هر نصب الگوی ترافیک خودش را
   دارد و بی این، تنها راهِ تنظیم، ویرایشِ کد بود و هر به‌روزرسانی آن را
   پاک می‌کرد. کف و سقف دارند تا یک مقدار غلط (منفی، صفر، بی‌نهایت) سرور را
   بی‌دفاع نکند — همان کاری که با NOOR_SMS_TIMEOUT کردیم. */
const smsEnvCap = (name, def, lo, hi) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= lo ? Math.min(hi, Math.floor(n)) : def;
};

const SMS_LIMIT = {
  perPhoneMs:  10 * 60 * 1000,
  perPhoneMax: smsEnvCap('NOOR_SMS_MAX_PHONE', 3,  1, 100),
  perIpHour:   smsEnvCap('NOOR_SMS_MAX_IP',    20, 1, 5000),
  globalHour:  smsEnvCap('NOOR_SMS_MAX_HOUR',  40, 1, 20000)
};
const smsByPhone = new Map();   // phone -> [at, …]
const smsByIp    = new Map();   // ip    -> [at, …]
let   smsGlobal  = [];

function smsConfigured(){ return SMS_ON && !!SMS_KEY && !!SMS_DEVICE; }

/* پنجرهٔ زمانی را می‌بُرد و همان آرایه را برمی‌گرداند */
function smsPrune(arr, win){
  const t = now();
  while(arr.length && t - arr[0] > win) arr.shift();
  return arr;
}
/* دو نیمه: «سنجش» و «ثبت». پیامکی که به درگاه نرسیده (خطای شبکه، timeout)
   نباید سهمیۀ کاربر را بسوزاند — کاربر چیزی دریافت نکرده و هزینه‌ای هم
   تراکنش نشده است. پس مسیرهایِ دلخواه (خوش‌آمدگویی) اول سنجش می‌کنند و
   تنها با sent/pending ثبت می‌کنند. */
function smsAllow(phone, ip, opt){
  const count = !opt || opt.count !== false;
  const note  = () => smsNote(phone, ip);
  const t = now();
  const ph = smsPrune(smsByPhone.get(phone) || [], SMS_LIMIT.perPhoneMs);
  if(ph.length >= SMS_LIMIT.perPhoneMax) return { ok: false, why: 'به این شماره تازه چند پیامک رفته — کمی بعد امتحان کن' };
  const ia = smsPrune(smsByIp.get(ip) || [], 3600000);
  if(ia.length >= SMS_LIMIT.perIpHour) return { ok: false, why: 'از این نشانی درخواست زیاد آمده' };
  smsGlobal = smsPrune(smsGlobal, 3600000);
  if(smsGlobal.length >= SMS_LIMIT.globalHour) return { ok: false, why: 'سقف ساعتی پیامک سرور پر شد' };
  if(count) note();
  return { ok: true };
}
function smsNote(phone, ip){
  const t = now();
  const ph = smsPrune(smsByPhone.get(phone) || [], SMS_LIMIT.perPhoneMs);
  const ia = smsPrune(smsByIp.get(ip) || [], 3600000);
  ph.push(t); ia.push(t);
  smsGlobal = smsPrune(smsGlobal, 3600000); smsGlobal.push(t);
  smsByPhone.set(phone, ph); smsByIp.set(ip, ia);
}

/* همان متن‌هایی که در کلاینت هم هست. تک‌منبع نیستند (سرور و کلاینت جدا
   اجرا می‌شوند) ولی هر دو ثابت‌اند و آزمون دارند. */
/* B13: پیامکِ فارسی در UCS-2 است — ۷۰ نویسه در هر جزء. متنِ پیشین ۹۲ نویسه
   بود و دو جزء خرج می‌کرد (دو برابر هزینه، و روی برخی درگاه‌ها پیامِ نصفه).
   قالبِ تازه ≤۷۰ نویسه است و دمِ «@domain #code» را دارد — همان چیزی که
   اندروید برای پرکردنِ خودکارِ کد (WebOTP) لازم دارد؛ کلاینت هم `autocomplete
   ="one-time-code"` را از قبل روی فیلد گذاشته است. */
function smsOtpDomain(){
  try{ return NOOR_ORIGIN ? new URL(NOOR_ORIGIN).hostname : 'noorestan.app'; }
  catch(e){ return 'noorestan.app'; }
}
function smsOtpMessage(code){
  const dom = smsOtpDomain();
  const head = '🌟 نورستان\n🔐 کد تأیید شما: ' + code + '\n⏱ ۲ دقیقه\n';
  const tail = '@' + dom + ' #' + code;
  const msg = head + tail;
  return msg.length <= 70 ? msg : ('🌟 نورستان\n🔐 کد: ' + code + '\n' + tail);
}
function smsTestMessage(){
  return '🌟 نورستان\n✅ آزمایش اتصال پیامک با موفقیت انجام شد.';
}
/* پیامکِ خوش‌آمدگویی — یک بار برای هر شماره، پس از نخستین ورودِ موفق.
   متن مستقیم است، نه الگو (pattern)؛ الگو در تنظیماتِ textbee ساخته
   می‌شود و متنِ پویا (شناسهٔ کاربر) را پشتیبانی نمی‌کند. */
function smsWelcomeMessage(userId){
  /* یک جزء (B13): پیامکِ فارسی در UCS-2 است و ۷۰ نویسه جا می‌دهد. متنِ پیشین
     چهار خط و ۱۰۵ نویسه بود — دو جزء، دو برابر هزینه، و ادعای «۱۵ بازی» که
     با ۲۱ بازیِ امروز نمی‌خواند (B22). شناسه می‌ماند چون تنها ارجاعِ
     پشتیبانی است؛ بقیهٔ «تبلیغ» از پیامک بیرون رفت. */
  return '🌟 نورستان — خوش آمدید\n🆔 ' + String(userId || '').slice(0, 30);
}

/* شماره در لاگ ماسک می‌شود. برای پیگیریِ «کدام شماره» بستنِ چهار رقمِ
   آخر و اول کافی است و بقیه‌اش نباید در فایلِ لاگ بماند. */
function maskPhone(phone){
  const p = String(phone || '').replace(/\D/g, '');
  if(p.length < 8) return '***';
  return p.slice(0, 4) + '***' + p.slice(-4);
}

/* ── داوری پاسخ textbee ──
   قرارداد واقعی (بر پایهٔ پاسخ خود textbee):
     موفق : { success: true, data: { _id: 'abc123', status: 'pending' } }
     خطا  : { success: false, message: 'Invalid API key' }
   ولی به هیچ‌کدام تکیه نمی‌کنیم: هر نشانه‌ای از موفقیت کافی است («success: true»
   یا وجود _id / messageId / id) و هر نشانه‌ای از شکست، خطا.

   سه حالت داریم، نه دو حالت:
     sent    → قطعاً پذیرفته شد
     failed  → قطعاً رد شد (سرور خودش گفت خطا)
     pending → نمی‌دانیم: وقت تمام شد، شبکه پاسخ نداد، یا ۵xx.
               پیامک ممکن است رسیده باشد، پس نباید «نشد» گزارش شود.

   چرا pending لازم است: پیش‌تر هر «نمی‌دانم» به «نشد» ترجمه می‌شد و کاربری که
   پیامکش رسیده بود، خطا می‌دید و کد را وارد نمی‌کرد. */
/* سدِ بازگویی کلید.
   اگر سرویس بیرونی (یا پروکسی میان راه) کلید را داخل متن خطا بازگو کند، آن متن
   عیناً به کاربر و به گزارش سرور می‌رفت. هرجا خطایی از بیرون می‌آید، از این
   صافی می‌گذرد. */
function smsRedact(s){
  let out = String(s == null ? '' : s);
  if(SMS_KEY) out = out.split(SMS_KEY).join('«کلید»');
  return out;
}

/* ── نشانه‌های وضعیت در بدنهٔ textbee ──
   textbee وضعیت را در `data.status` می‌گذارد و مقادیرش با زمان عوض می‌شود
   (نخست `pending` یعنی در صف، بعد `sent`، بعد `delivered`). پیش‌تر فقط
   `_id` و `success` نگاه می‌شد؛ پاسخِ سالمی که این دو را نداشت ولی
   `data.status: 'pending'` داشت، «خوانده‌نشده» شمرده می‌شد و کاربری که
   پیامکش رسیده بود، ۲۰۲ و «⏳» می‌گرفت. */
const SMS_OK_STATUS  = ['pending', 'queued', 'sent', 'delivered', 'accepted',
                        'success', 'ok', 'scheduled', 'submitted', 'processed'];
const SMS_BAD_STATUS = ['failed', 'error', 'rejected', 'invalid', 'undelivered',
                        'blocked', 'expired', 'cancelled', 'bounced'];

function smsVerdict(status, ok, j, raw){
  /* ۰ یعنی درخواست به هیچ نتیجه‌ای نرسید */
  if(!status)
    return { state: 'pending', error: 'پاسخی از textbee نیامد (وقت تمام شد یا شبکه)' };

  /* ── پاسخِ راستینِ textbee کجا نشانه می‌گذارد ──
     یک نمونهٔ واقعی از نصبِ زنده:

       { "data": { "success": true,
                   "message": "SMS added to queue for processing",
                   "smsBatchId": "6aaee39579e3d1b79fc1d770",
                   "recipientCount": 1 } }

     هیچ `success`ی در ریشه نیست، `data.status` هم نیست، و شناسه
     `smsBatchId` نام دارد نه `_id`. هر سه باید دیده شوند؛ وگرنه «رفت» را
     از راهِ حدس می‌فهمیم و شناسهٔ پیگیری را از دست می‌دهیم. */
  const isObj = !!j && typeof j === 'object';
  const d  = isObj && j.data && typeof j.data === 'object' ? j.data : {};
  const id = isObj ? (j._id || j.messageId || j.id || d._id || d.messageId || d.id ||
                      d.smsBatchId || '') : '';
  const ds = isObj ? String(d.status || j.status || '').toLowerCase() : '';
  const okMark  = isObj && (j.success === true || d.success === true || !!id ||
                            SMS_OK_STATUS.indexOf(ds) >= 0);
  /* `error` عمداً، نه `message`: در پاسخِ *موفق*، `data.message` توضیحِ
     کامیابی است («در صف نشست») و در پاسخِ خطا هم متنِ خطا در `j.message`
     می‌آید. اگر `message` را نشانهٔ شکست بگیریم، پاسخِ موفق را «نشد»
     می‌خوانیم — دقیقاً همان اشتباهی که کاربر را بی‌دلیل می‌ترساند. */
  const badMark = isObj && (j.success === false || d.success === false || !!j.error ||
                            !!d.error || SMS_BAD_STATUS.indexOf(ds) >= 0);

  /* نشانهٔ صریحِ شکست بر موفقیت مقدم است: اگر textbee گفته «نشد»، گفتنِ «شد»
     کاربر را به انتظارِ کدی می‌نشاند که هرگز نمی‌آید. */
  if(badMark){
    /* `d.message` عمداً در فهرست نیست: در پاسخِ خطا هم ممکن است متنِ خودِ
       پیامک باشد، و متنِ پیامکِ ما *کدِ تأیید* را در خود دارد. علتِ خطا
       به کلاینت و به لاگ می‌رود، پس کد نباید از این راه بیرون بزند. */
    const why = smsRedact(j.error || d.error || j.message || '');
    const byStatus = ds && SMS_BAD_STATUS.indexOf(ds) >= 0;
    const denied = j.success === false || d.success === false;
    return { state: 'failed',
             error: why || (byStatus ? `textbee وضعیتِ «${ds}» را گزارش کرد`
                          : denied ? 'textbee درخواست را نپذیرفت'
                          : ('HTTP ' + status)) };
  }
  if(okMark)
    return { state: 'sent', id: String(id || ds) };

  /* ۲xx با بدنهٔ *JSON* ولی بی هیچ نشانه: دهانه درخواست را پذیرفت. اینجا
     «نمی‌دانم» گفتن، کاربری را که پیامکش رسیده بود پشتِ «⏳» می‌نشاند؛
     و اگر پیامک نرسیده باشد، «ارسال دوباره» هست — راهِ بازگشت ارزان است.
     ولی بدنهٔ *غیرِ*JSON (صفحهٔ HTML پروکسی، بدنهٔ خالی) همچنان «نامعلوم»
     می‌ماند: ۲۰۰ با بدنهٔ HTML یعنی پاسخ از دهانهٔ textbee نیامده. */
  if(ok && isObj) return { state: 'sent', id: '', guessed: true };

  /* ۵xx خطای موقت است؛ درخواست ممکن است بعداً پذیرفته شود */
  if(status >= 500) return { state: 'pending', error: 'textbee الان در دسترس نیست (HTTP ' + status + ')' };

  /* ۲xx با بدنهٔ *تهی* هم پذیرش است: دهانه جواب داد و چیزی برای گفتن نداشت.
     (بدنهٔ غیرِتهیِ غیرِJSON اینجا نمی‌آید — آن یکی صفحهٔ HTMLِ پروکسی است.) */
  if(ok && !String(raw == null ? '' : raw).trim())
    return { state: 'sent', id: '', guessed: true };

  if(ok) return { state: 'pending', error: 'پاسخ textbee خوانده نشد' };
  return { state: 'failed', error: smsRedact((isObj && (j.error || j.message)) || ('HTTP ' + status)) };
}

/* پاسخ textbee هرگز عیناً به کلاینت نمی‌رود؛ فقط state و شناسهٔ پیام و error.
   این‌طور هیچ چیز اضافه‌ای — از جمله خود کلید — بیرون نمی‌ریزد.

   بدنه با res.text() خوانده می‌شود نه res.json(): اگر textbee به‌جای JSON یک
   صفحهٔ خطای HTML برگرداند، res.json() بی‌صدا null می‌داد و ما دلیل شکست را
   گم می‌کردیم. حالا متن را داریم و در گزارش سرور می‌نویسیم. */
async function smsSend(phone, message){
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), SMS_TIMEOUT);
  const t0 = Date.now();
  try{
    const res = await fetch(SMS_ENDPOINT, {
      method: 'POST',
      headers: { 'x-api-key': SMS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: SMS_DEVICE, recipients: [phone], message }),
      signal: ctrl.signal
    });
    let raw = '', j = null;
    try{ raw = await res.text(); }catch(e){}
    try{ j = raw ? JSON.parse(raw) : null; }catch(e){}
    const v = smsVerdict(res.status, res.ok, j, raw);
    const ms = Date.now() - t0;
    /* بدنهٔ خامِ پاسخ، فقط با NOOR_DEBUG_SMS=1 و فقط پس از عبور از smsRedact.
       بی صافی، اگر textbee کلید را در پاسخش بازگو کند، کلید در لاگ می‌نشیند —
       همان چیزی که خودِ برنامه در جای دیگر جلوگیری می‌کند. */
    if(process.env.NOOR_DEBUG_SMS === '1')
      log('🔍 textbee خام: ' + smsRedact(raw.slice(0, 500)));
    if(j){
      log(`📡 textbee → HTTP ${res.status} در ${ms}ms · ${v.state}` +
          (v.guessed ? ' (بی نشانه — از ۲xx حدس زده شد)' : '') +
          (v.id ? ' · ' + v.id : '') + (v.error ? ' · ' + v.error : ''));
    }else{
      /* بدنهٔ غیر-JSON ممکن است بازگویی کلید باشد؛ در آن صورت ثبت نمی‌شود */
      const leak = !!SMS_KEY && raw.includes(SMS_KEY);
      log(`📡 textbee → HTTP ${res.status} در ${ms}ms · ${v.state} · بدنهٔ غیر-JSON: ` +
          (leak ? '(حاوی کلید — ثبت نشد)' : (raw.slice(0, 120) || '(خالی)')));
    }
    return v;
  }catch(e){
    const abort = !!e && e.name === 'AbortError';
    log(`📡 textbee → بی‌پاسخ در ${Date.now() - t0}ms · ` +
        (abort ? `وقت ${SMS_TIMEOUT / 1000} ثانیه‌ای تمام شد` : ('خطای شبکه: ' + (e && e.message))));
    return { state: 'pending',
             error: abort ? `textbee تا ${SMS_TIMEOUT / 1000} ثانیه پاسخ نداد`
                          : 'اتصال به textbee برقرار نشد' };
  }finally{ clearTimeout(tid); }
}

/* بدنهٔ JSON با سقف اندازه — بی سقف، یک درخواست بزرگ حافظه را می‌خورد */
function readJson(req, max){
  /* قطعه‌ها در بافرِ خام جمع می‌شوند (B15): `buf += c` هر قطعه را جدا به
     رشتهٔ UTF-۸ تبدیل می‌کند، پس اگر برشِ TCP وسطِ یک نویسهٔ چندقدری بیفتد
     (متنِ فارسی)، آن نویسه FDD و JSON می‌سوزد. سقفِ اندازه هم باید با
     «بایت» سنجیده شود، نه با «تعدادِ نویسهٔ رشته». */
  return new Promise(resolve => {
    let n = 0;
    const parts = [];
    req.on('data', c => {
      n += c.length;
      if(n > max){ try{ req.destroy(); }catch(e){} resolve(null); return; }
      parts.push(c);
    });
    req.on('end', () => {
      if(!parts.length) return resolve({});
      const txt = Buffer.concat(parts).toString('utf8');
      try{ resolve(txt ? JSON.parse(txt) : {}); }catch(e){ resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}
/* نشانیِ کلاینت. پشتِ هر پروکسی (nginx، Frp، Cloudflare) تمامِ کاربران یک
   IP می‌شوند و سقف‌های per-IP بی‌معنا — پس XFF تنها با NOOR_TRUST_PROXY=1
   خوانده می‌شود و از آن هم فقط شماره‌ای که پروکسیِ خودمان افزوده (B5). */
function clientIp(req){
  const sock = (req.socket && req.socket.remoteAddress) || '?';
  if(!TRUST_PROXY) return sock;
  const raw = String(req.headers['x-forwarded-for'] || '');
  if(!raw) return sock;
  const list = raw.split(',').map(x => x.trim()).filter(Boolean);
  if(!list.length) return sock;
  const i = Math.max(0, list.length - TRUST_HOPS);
  return list[i] || sock;
}
/* نشانیِ هش‌شده، برای هرچیزِ ماندگار (B20): سهمیه‌ها در حافظه به خودِ نشانی
   نیاز دارند، ولی روی دیسک ردپای قابل‌بازگشت نمی‌گذاریم. */
function ipKey(ip){ return 'ip:' + sha256Hex(IP_SALT + '|' + String(ip || '')).slice(0, 20); }
function isLocalAddr(ip){
  const a = String(ip || '').replace(/^::ffff:/, '');
  return a === '127.0.0.1' || a === '::1' || /^127\./.test(a) ||
         /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a) ||
         /^f[cd][0-9a-f]{2}:/i.test(a) || /^fe80:/i.test(a);
}
/* آیا اتصال از مسیرِ رمزنگاری‌شده آمده؟ خودِ TLS، یا پروکسیِ موردِ اعتماد که
   X-Forwarded-Proto را گفته است. */
function isHttps(req){
  if(req.socket && req.socket.encrypted) return true;
  if(!TRUST_PROXY) return false;
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}
/* رقم فارسی/عربی به لاتین */
function digits(s){
  return String(s ?? '').replace(/[۰-۹٠-٩]/g, ch => {
    const i = '۰۱۲۳۴۵۶۷۸۹'.indexOf(ch);
    return String(i >= 0 ? i : '٠١٢٣٤٥٦٧٨٩'.indexOf(ch));
  });
}

/* ─────────────── کدِ تأیید و هویتِ کاربر — روی سرور ───────────────
   پیش‌تر کلاینت خودش کد را می‌ساخت، هشش را در localStorage می‌گذاشت و خودش
   هم می‌سنجید. یعنی «تأییدِ شماره» سنجشی روی همان دستگاهی بود که باید
   تأیید می‌شد: کاربرِ متین می‌توانست پلهٔ کد را رد کند. حالا کد فقط اینجا
   ساخته می‌شود، فقط اینجا می‌ماند، و یک‌بارمصرف است. */
const OTP_TTL_MS   = 2 * 60 * 1000;
const OTP_MAX_TRIES = 3;
/* B12 — دو چیز لازم بود: قفلِ «شماره» و طولِ کد. قفل همین‌جا کامل شد
   (otpTries + otpNoteFail/otpLockLeft در /api/otp/verify)؛ کدِ تازه دیگر
   شمارنده را صفر نمی‌کند و پس از چهار تلاشِ ناموفق، حتی کدِ درست هم رد
   می‌شود. طولِ کد را *قابل‌تنظیم* کردیم و پیش‌فرض روی ۵ ماند، چون رقمِ کد
   قراردادی دوطرفه است: OTP.LEN در کلاینت، جعبه‌های کد، و آزمون‌های
   _tests.js/_servertest.js هر دو «پنج‌رقمی» را می‌سنجند. رفتن به ۶ یک
   کامیتِ جداست (سرور + کلاینت + آزمون‌ها + شمارۀ کش sw با هم) — سرور
   آماده است: NOOR_OTP_LEN=6 کافی است. یک‌طرفه عوضش نکردیم تا ورودِ
   کاربرانِ موجود نشکند. */
const OTP_LEN      = Math.max(4, Math.min(8, Number(process.env.NOOR_OTP_LEN || 5) || 5));
const OTP_PHONE_TRIES = Math.max(2, Number(process.env.NOOR_OTP_PHONE_TRIES || 4) || 4);
/* دقته: کفِ این عدد *دقیقه* است، نه ثانیه — یک بار `Math.max(60, …)` نوشته
   شد و «حداقلِ سی دقیقه» عملاً شصت دقیقه می‌شد. */
const OTP_LOCK_MS  = Math.max(5, Number(process.env.NOOR_OTP_LOCK_MIN || 30) || 30) * 60 * 1000;
const OTP_SPACING_MS = Math.max(0, Number(process.env.NOOR_OTP_SPACING_SEC ?? 60) || 0) * 1000;
const OTP_DAILY    = Math.max(1, Number(process.env.NOOR_OTP_DAILY || 6) || 6);
const OTP_SWEEP_MS = 60 * 1000;
const USER_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;   // نشانهٔ کاربر: ۳۰ روز

const otps       = new Map();   // phone -> { hash, salt, exp, tries, at }
const verifyByIp = new Map();   // ip -> [at, …]
const otpTries   = new Map();   // phone -> { n, until, at, last }  (B12)
const otpDaily   = new Map();   // phone -> [at, …]                  (B12)
const userByPhone = new Map();  // phone -> record
const userById    = new Map();  // id -> phone
const userTokens  = new Map();  // token -> { id, phone, exp, at }
/* B6 — دو ایرادِ نشستِ کاربر همین‌جا حل شد:
   ۱) نشست فقط در حافظه بود؛ هر ری‌استارتِ سرویس همه را بیرون می‌انداخت و
      کاربر باید از نو کد پیامکی می‌گرفت — روی موبایلِ با‌دیتا یعنی یک
      پیامکِ هزینه‌دار برای «همان نشستی که دیروز داشت».
   ۲) سقفِ رشد «شد ۵۰۰ تا، صد تای اول را بر دار» بود. `at` هیچ‌وقت موقع
      استفاده تازه نمی‌شد، پس آن ۱۰۰ تا «کم‌مصرف‌ترین»ها نبودند،
      «اولین‌هایی که نصب کردند» بودند — کاربرِ فعالِ روزِ اول، وسطِ کار
      نشانه‌اش را می‌باخت و از محفل بیرون می‌افتاد.
   روی دیسک *هشِ* نشانه می‌نشیند، نه خودِ نشانه: اگر فایلِ داده بیفتد،
   با خواندنش نمی‌شود وارد حسابی شد. */
let userSessions = new Map();   // sha256(salt|token) -> { id, phone, exp, at }
const TOKEN_H_SALT = 'noorestan-sess-v1';
function tokenH(t){ return sha256Hex(TOKEN_H_SALT + '|' + t); }
function tokensTrim(){
  if(userTokens.size <= TOKEN_MAX) return 0;
  const list = [...userTokens.entries()].sort((a, b) => a[1].at - b[1].at);
  const drop = list.slice(0, userTokens.size - TOKEN_MAX);
  for(const [t] of drop){ userTokens.delete(t); userSessions.delete(tokenH(t)); }
  return drop.length;
}

/* کد پنج‌رقمی از مولدِ رمزنگاری‌شده. `randomInt` بازهٔ [0, n) را یکنواخت
   می‌دهد؛ باقی‌ماندهٔ ساده توزیع را کج می‌کرد و حدس‌زدن را آسان‌تر. */
/* طول از OTP_LEN (B12). پیش‌تر بازه سخت‌کدِ ۱۰۰۰۰..۱۰۰۰۰۰ بود؛ حالا
   [10^(n-1), 10^n) — یکنواخت، و رقمِ نخست هرگز صفر نمی‌شود. */
function otpCode(){ const lo = Math.pow(10, OTP_LEN - 1); return String(crypto.randomInt(lo, lo * 10)); }
function otpHash(code, salt){ return sha256Hex(salt + '|' + code + '|noorestan-otp'); }
function otpSalt(){ return crypto.randomBytes(16).toString('hex'); }

/* کدِ در جریانِ یک شماره، و اگر کهنه است دور ریخته می‌شود. */
function otpGet(phone){
  const st = otps.get(phone);
  if(!st) return null;
  if(now() > st.exp){ otps.delete(phone); return null; }
  return st;
}

/* سقفِ تلاشِ بررسی — جدا از سقفِ ارسال. بی این، کدِ پنج‌رقمی را می‌شد در
   چند دقیقه جارو کرد: ۱۰۰٬۰۰۰ حالت، و ۳ تلاش برای هر کد. */
/* ── قفلِ per-phone (B12) ──
   شمارنده به «کدِ جاری» گره نخورده است: کدِ تازه، قفل را نمی‌شکند. بی این،
   سه تلاشِ اشتباه فقط همان کد را می‌سوزاند و مهاجم با یک درخواستِ تازه سه
   تلاشِ دیگر می‌خرید — آسمانی مجازی برای جاروکردنِ کدِ ۵ رقمی. */
function otpLockLeft(phone){
  const st = otpTries.get(phone);
  return (st && st.until && st.until > now()) ? Math.max(1, Math.round((st.until - now()) / 60000)) : 0;
}
function otpNoteFail(phone){
  const t = now();
  const st = otpTries.get(phone) || { n: 0, until: 0, at: 0, last: 0 };
  if(t - (st.at || 0) > 60 * 60 * 1000) st.n = 0;
  st.n = (st.n || 0) + 1; st.at = t;
  let waitMin = 0;
  if(st.n >= OTP_PHONE_TRIES){ st.until = t + OTP_LOCK_MS; st.n = 0; waitMin = OTP_LOCK_MS / 60000; }
  otpTries.set(phone, st);
  return waitMin;
}
function otpSendAllow(phone){
  const t = now();
  const left = otpLockLeft(phone);
  if(left) return { ok: false, locked: true, waitMin: left,
                    why: 'چند بار کدِ اشتباه داده شد — ' + left + ' دقیقه صبر کن' };
  const st = otpTries.get(phone);
  if(st && st.last && t - st.last < OTP_SPACING_MS)
    return { ok: false, why: 'کدِ تازه ' + Math.ceil((OTP_SPACING_MS - (t - st.last)) / 1000) + ' ثانیه بعد فرستاده می‌شود' };
  const day = (otpDaily.get(phone) || []).filter(x => t - x < 24 * 3600 * 1000);
  otpDaily.set(phone, day);
  if(day.length >= OTP_DAILY) return { ok: false, why: 'سقفِ کدِ این شماره در شبانه‌روز پر شده است' };
  return { ok: true };
}
function otpSendNote(phone){
  const t = now();
  const st = otpTries.get(phone) || { n: 0, until: 0, at: 0, last: 0 };
  st.last = t; otpTries.set(phone, st);
  const day = [...(otpDaily.get(phone) || []), t].filter(x => t - x < 24 * 3600 * 1000);
  otpDaily.set(phone, day.slice(-12));
}
function otpOkClear(phone){ const st = otpTries.get(phone); if(st){ st.n = 0; st.until = 0; } }

function verifyAllow(ip){
  const t = now();
  const list = (verifyByIp.get(ip) || []).filter(x => t - x < 60 * 60 * 1000);
  verifyByIp.set(ip, list);
  if(list.length >= VERIFY_MAX_HOUR) return { ok: false, why: 'تلاشِ زیاد برای بررسیِ کد — یک ساعت دیگر' };
  list.push(t);
  return { ok: true };
}

/* ── کارنامهٔ کاربر ──
   هویتِ پایدار شماره است و `usr_…` دستهٔ آن. شناسه را کلاینت می‌سازد (چون
   برنامه باید آفلاین هم کار کند) ولی سرور آن را بی‌چون‌وچرا قبول نمی‌کند:
   شکلش را می‌سنجد و فقط با تأییدِ پیامک به شماره می‌بنددش. پس مرجعِ
   «این شناسه مال کیست» اینجاست، نه در دستگاهِ کاربر. */
const USER_ID_RE = /^usr_[0-9a-f]{20}$/;

function userOf(phone){ return userByPhone.get(phone) || null; }

/* کاربرِ مسدود کمی بعد قطع می‌شود تا پیامِ «چرا» به او برسد. قطعِ بی‌درنگ،
   پیام را در همان سوکتِ مرده گم می‌کرد. */
function Timers_sleep_close(c){ setTimeout(() => { try{ c.closeClient('مسدود'); }catch(e){} }, 900); }

function userBind(phone, id, ip){
  const t = now();
  let rec = userByPhone.get(phone);
  if(!rec){
    rec = { id: 'usr_' + crypto.randomBytes(10).toString('hex'),
            phone, name: DEFAULT_USER_NAME, joinedAt: t, lastLogin: 0, visits: 0,
            plays: 0, score: 0, level: 1, blocked: false, lastIp: '', ips: [],
            welcomed: false, welcomedAt: 0, welcomeTries: 0 };
    userByPhone.set(phone, rec);
  }
/* یادداشت تاریخی؛ شناسه اکنون تنها در سرور ساخته می‌شود و پایدار می‌ماند. */
/* شناسهٔ تازه از همان شماره: دستهٔ قدیمی رها و تازه ثبت می‌شود. دو
       شناسه برای یک شماره نگه نمی‌داریم، وگرنه «حذف کاربر» یکی را جا
       می‌گذاشت. */
  userById.set(rec.id, phone);
  rec.lastLogin = t;
  rec.visits = (rec.visits || 0) + 1;
  /* B20: روی دیسک، نشانیِ هش‌شده می‌نشیند (نه خام) و تنها سه ردیف می‌ماند.
     سهمیه‌های درون‌حافظه همچنان با نشانیِ واقعی کار می‌کنند. */
  const ikey = ip ? ipKey(ip) : '';
  if(ikey && rec.lastIp !== ikey){
    rec.lastIp = ikey;
    rec.ips = [ikey, ...(rec.ips || []).filter(x => x !== ikey)].slice(0, 3);
  }
  rec.updatedAt = now();
  saveData();
  return rec;
}

/* اعتبارِ سکه در سرور (B10). دفترِ پرداخت پس از تأییدِ درگاه این را صدا
   می‌زند؛ عدد روی دستگاه کاربر نمی‌نشیند که بشود دست‌کاریش کرد. */
function creditCoins(userId, coins, order){
  const phone = userById.get(userId);
  if(!phone) return false;
  const rec = userOf(phone);
  if(!rec) return false;
  rec.coins = Math.max(0, (rec.coins || 0) + Math.floor(Number(coins) || 0));
  rec.coinLog = [{ at: now(), coins: Math.floor(Number(coins) || 0), order: String((order && order.id) || '').slice(0, 64) },
                 ...(rec.coinLog || [])].slice(0, 40);
  rec.updatedAt = now();
  saveData();
  return true;
}

function userTokenNew(id, phone){
  const token = crypto.randomBytes(32).toString('hex');
  const rec = { id, phone, exp: now() + USER_TOKEN_MS, at: now() };
  userTokens.set(token, rec);
  userSessions.set(tokenH(token), { id, phone, exp: rec.exp, at: rec.at });
  const n = tokensTrim();
  if(n) log(`🧹 ${n} نشستِ کم‌مصرف بسته شد (سقفِ زنده: ${TOKEN_MAX})`);
  saveData();
  return token;
}
/* نگاهِ بی‌داوری به نشانه: رکورد را برمی‌گرداند بی آنکه اعتبارسنجی یا
   پاک کند. چرا لازم شد؟ چون کاربرِ مسدود باید *علتِ راستین* را بشنود،
   و `userTokenGet` — درست — برای او نال می‌دهد؛ پس پیش از آن باید
   بتوان فهمید «نشانه‌ای بوده و صاحبش مسدود است». */
function userTokenPeek(token){
  if(typeof token !== 'string' || token.length !== 64) return null;
  const hit = userTokens.get(token);
  if(hit) return hit;
  /* نشانه‌ای که در حافظه نیست ولی *معتبر* است (سرور ری‌استارت شده) از
     ردیفِ هش‌شده روی دیسک زنده می‌شود؛ منقضی همان‌جا دور می‌رود. */
  const st = userSessions.get(tokenH(token));
  if(!st) return null;
  if(now() > st.exp){ userSessions.delete(tokenH(token)); return null; }
  const rec = { id: st.id, phone: st.phone, exp: st.exp, at: now() };
  userTokens.set(token, rec);
  return rec;
}
function userTokenGet(token){
  const s = userTokenPeek(token);
  if(!s) return null;
  /* نشانهٔ کاربرِ مسدود *باطل* است ولی *پاک* نمی‌شود. مسدودکردن
     برگشت‌پذیر است؛ اگر نشانه همان‌جا پاک می‌شد، کاربر پس از آزاد شدن
     باید از نو کد پیامکی می‌گرفت — مجازاتی که مدیر نخواسته بود. */
  const rec = userOf(s.phone);
  if(now() > s.exp || !rec || rec.id !== s.id){ userTokenDrop(token); return null; }
  if(rec.blocked) return null;
  s.at = now();                       // LRU: استفاده، نشانه را تازه نگه می‌دارد
  const st = userSessions.get(tokenH(token));
  if(st) st.at = s.at;
  return s;
}
function userTokenDrop(token){
  userTokens.delete(token);
  userSessions.delete(tokenH(token));
  saveData();
}


function userDrop(rec){
  if(!rec) return false;
  userByPhone.delete(rec.phone);
  userById.delete(rec.id);
  for(const [tok, st] of [...userTokens]) if(st && st.phone === rec.phone) userTokens.delete(tok);
  for(const [h, st] of [...userSessions]) if(st && st.phone === rec.phone) userSessions.delete(h);
  saveData();
  return true;
}
/* دیدِ عمومی — بی نشانی از IP و بی هیچ چیزی که به کارِ سوء بیاید. */
function userView(rec){
  if(!rec) return null;
  return { id: rec.id, phone: rec.phone, name: rec.name, joinedAt: rec.joinedAt,
           lastLogin: rec.lastLogin, visits: rec.visits || 0, plays: rec.plays || 0,
           score: rec.score || 0, level: rec.level || 1, blocked: !!rec.blocked,
           welcomed: !!rec.welcomed, welcomedAt: rec.welcomedAt || 0,
           online: [...clients.values()].some(c => c.phone === rec.phone) };
}
/* ── پیامکِ خوش‌آمدگویی ──
   فقط یک بار برای هر شماره، پس از نخستین ورودِ موفق، و *هرگز* جلوی ورود را
   نمی‌گیرد: اگر نرفت، فقط در لاگ می‌ماند.

   `welcomed` تنها با ارسالِ موفق نشان می‌خورد (اگر نشانِ بی‌قید می‌زدیم، یک
   قطعیِ گذرا خوش‌آمدگویی را برای همیشه از بین می‌برد). ولی همان نشانِ
   «موفق» یعنی یک شمارهٔ خراب می‌توانست با هر ورود یک تلاشِ تازه بفرستد؛
   پس سقفِ تلاش هم دارد. */
const WELCOME_MAX_TRIES = 3;

async function welcomeSmsOnce(rec){
  if(!rec) return { state: 'skipped', why: 'no_user' };
  if(rec.welcomed) return { state: 'skipped', why: 'already_welcomed' };
  if((rec.welcomeTries || 0) >= WELCOME_MAX_TRIES) return { state: 'skipped', why: 'gave_up' };
  if(!smsConfigured()) return { state: 'skipped', why: 'not_configured' };
  /* B13: خوش‌آمدگویی از همین صافیِ پیامک می‌گذرد. پیش‌تر مستقیم smsSend
     می‌کرد؛ یعنی مسیری که سقفِ per-phone/per-IP را دور می‌زد و با یک
     ورودِ دوباره می‌توانست بی‌هزینه پیامک بفرستد. */
  /* سطلِ per-IP این‌جا «خودِ کاربر» است (شناسهٔ کاربر)، نه یک رشتهٔ مشترک؛
     وگرنه سهمیهٔ خوش‌آمدگوییِ همهٔ کاربران در یک سطل می‌نشست. */
  const lim = smsAllow(rec.phone, 'usr:' + rec.id, { count: false });
  if(!lim.ok) return { state: 'skipped', why: 'rate:' + lim.why };
  rec.welcomeTries = (rec.welcomeTries || 0) + 1;
  saveData();
  let out;
  try{ out = await smsSend(rec.phone, smsWelcomeMessage(rec.id)); }
  catch(e){ out = { state: 'failed', error: smsRedact(e && e.message) }; }
  if(out.state === 'sent' || out.state === 'pending'){
    /* سهمیه تنها وقتی ثبت می‌شود که پیامک واقعاً راه افتاده باشد. */
    smsNote(rec.phone, 'usr:' + rec.id);
  }
  if(out.state === 'sent'){
    rec.welcomed = true;
    rec.welcomedAt = now();
    saveData();
    pushMe(rec);        // پروفایلِ همان کاربر زنده به‌روز شود
  }
  const stamp = out.state === 'sent' ? '📨' : out.state === 'pending' ? '⏳' : '⚠️';
  /* شماره ماسک می‌شود — این لاگ بی‌ربط به پیگیریِ کد است و نباید شمارهٔ
     کاملِ کاربران را یک‌جا جمع کند. */
  log(`${stamp} خوش‌آمد → ${maskPhone(rec.phone)} · ${out.state}` +
      (out.state === 'sent' ? '' : ' — ' + (out.error || '')));
  return out;
}

/* کارنامهٔ خودِ کاربر برای خودش. از userView جدا است چون آن یکی راهِ دیدِ
   *مدیر* است و میدانِ بیشتری دارد (پلاک، مسدودی، آنلاین). */
function userMeView(rec){
  if(!rec) return null;
  return { id: rec.id, phone: rec.phone, name: rec.name, joinedAt: rec.joinedAt,
           plays: rec.plays || 0, score: rec.score || 0, level: rec.level || 1,
           welcomed: !!rec.welcomed, welcomedAt: rec.welcomedAt || 0 };
}
/* کارنامهٔ تازه را به همان کاربرِ آنلاین می‌فرستد. بی این، پس از رفتنِ
   پیامکِ خوش‌آمد، پروفایل تا اتصالِ بعدی «⏳ در راه» می‌ماند. */
function pushMe(rec){
  const v = userMeView(rec);
  if(!v) return;
  for(const c of clients.values())
    if(c.user === rec) sendRaw(c, { t: 'me', to: c.id, ...v });
}

/* فهرستِ ادمین — مرتب بر تازگیِ ورود */
function userListView(limit = 200){
  return [...userByPhone.values()]
    .sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0))
    .slice(0, limit).map(userView);
}

/* پیامکِ مدیر به کاربر — ناهمگام، بی‌آنکه مسیرِ پیامِ ورودی را ناهمگام کند.
   نتیجهٔ واقعی به مدیر می‌رسد: «sent» و «pending» و «failed» با هم یکی
   نمی‌شوند و مدیر باید بداند کدام پیش آمده. */
async function adminSmsTo(c, rec, text){
  let out;
  try{
    out = await smsSend(rec.phone, '🌟 نورستان\n' + text);
  }catch(e){
    out = { state: 'failed', error: 'فرستادن پیامک شکست خورد' };
  }
  sendRaw(c, { t: 'admin:user:sms', to: c.id, id: rec.id, state: out.state,
               error: out.state === 'sent' ? '' : (out.error || '') });
  log(`${out.state === 'sent' ? '📨' : out.state === 'pending' ? '⏳' : '⚠️'} پیامکِ مدیر → ${rec.id} · ${out.state}`);
}

/* کاربر را با شناسه یا شماره پیدا می‌کند — پنل ادمین هر دو را دارد */
function userLookup(msg){
  const id = String(msg.id || '');
  if(USER_ID_RE.test(id)){
    const ph = userById.get(id);
    if(ph) return userByPhone.get(ph) || null;
  }
  const phone = digits(msg.phone || '').replace(/\D/g, '');
  if(/^09\d{9}$/.test(phone)) return userByPhone.get(phone) || null;
  return null;
}
function users_sessions_drop(rec){
  /* نشست‌های همان شماره هم باطل می‌شود؛ وگرنه «حذفِ کاربر» فقط نام را از
     کارنامه می‌برد و نشانه‌اش تا انقضا کار می‌کرد (و با ری‌استارت از نو زنده
     می‌شد). شمارش بر پایهٔ هشِ نشانه است تا حافظه و دیسک دو بار شمرده نشوند. */
  const gone = new Set();
  for(const [tok, st] of [...userTokens]) if(st && st.phone === rec.phone){ userTokens.delete(tok); gone.add(tokenH(tok)); }
  for(const [h, st] of [...userSessions]) if(st && st.phone === rec.phone){ userSessions.delete(h); gone.add(h); }
  userDrop(rec);
  saveData();
  /* کاربرِ آنلاین هم قطع می‌شود. */
  for(const cl of clients.values()) if(cl.phone === rec.phone) cl.closeClient('حساب حذف شد');
  return gone.size;
}
/* فهرستِ تازه برای همهٔ مدیرانِ آنلاین — تا دو مدیر دو چیزِ متفاوت نبینند. */
function pushAdminUsers(){
  const list = userListView();
  for(const cl of clients.values())
    if(isAdminNow(cl)) sendRaw(cl, { t: 'admin:users', to: cl.id, list });
}

/* ─────────────── نشستِ مدیر ───────────────
   پیش‌تر کلاینت *هشِ* رمز را با هر پیامِ مدیریتی می‌فرستاد و سرور فقط آن را با
   هشِ خودش مقایسه می‌کرد. دو ایراد داشت: هش عملاً بدلِ رمز شده بود (روی سیم
   می‌رفت و هر که می‌دیدش مدیر می‌شد) و هیچ راهی برای باطل‌کردنش نبود.
   حالا رمز یک بار به /api/admin/login می‌رود، مقایسه در سرور انجام می‌شود، و
   سرور یک نشانهٔ نشست برمی‌گرداند: ۳۲ بایت تصادفی، با انقضا، قابلِ باطل‌کردن،
   و فقط در حافظهٔ سرور. کلاینت دیگر رمز و هش را هیچ‌جا نگه نمی‌دارد. */
const ADMIN_SESSION_MS   = 12 * 60 * 60 * 1000;
const ADMIN_MAX_SESSIONS = 32;
const ADMIN_TRY_MS       = 15 * 60 * 1000;
const ADMIN_MAX_TRIES    = 6;
const adminSessions = new Map();   // token -> { at, exp }
const adminBackoff = new Map();
const adminTries    = new Map();   // ip -> [at, …]

/* دروازه بسته است تا وقتی NOOR_ADMIN_PASS ست شده باشد. */
const adminGateOpen = () => !!ADMIN_HASH;

/* مقایسهٔ زمان‌ثابت. با === می‌شد از روی زمانِ پاسخ، هش را نویسه‌به‌نویسه
   ساخت. طول‌ها اگر یکی نبود، همان‌جا رد می‌شود (طولِ هشِ sha256 همیشه ۶۴ است
   و خودش راز نیست). */
function sameHash(a, b){
  if(typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a, 'utf8'), y = Buffer.from(b, 'utf8');
  if(x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

function adminAllow(ip){
  const t = now();
  const backoff=adminBackoff.get(ip);
  if(backoff && t<backoff.until)return {ok:false,why:'کمی صبر کنید و دوباره تلاش کنید'};
  const list = (adminTries.get(ip) || []).filter(x => t - x < ADMIN_TRY_MS);
  adminTries.set(ip, list);
  if(list.length >= ADMIN_MAX_TRIES)
    return { ok: false, why: `تلاشِ زیاد — ${Math.ceil((ADMIN_TRY_MS - (t - list[0])) / 60000)} دقیقه دیگر` };
  list.push(t);
  return { ok: true };
}
function adminForget(ip){ adminTries.delete(ip);adminBackoff.delete(ip); }

function adminNewToken(){
  const token = crypto.randomBytes(32).toString('hex');
  /* سقفِ نشست‌های زنده: قدیمی‌ترین می‌رود تا نگاشت بی‌کران رشد نکند و
     نشست‌های فراموش‌شده تا ابد زنده نمانند. */
  if(adminSessions.size >= ADMIN_MAX_SESSIONS){
    let old = null;
    for(const [t, s] of adminSessions) if(!old || s.at < old.s.at) old = { t, s };
    if(old) adminSessions.delete(old.t);
  }
  adminSessions.set(token, { at: now(), exp: now() + ADMIN_SESSION_MS });
  return token;
}
/* نشانهٔ معتبر؟ منقضی همان‌جا پاک می‌شود. */
function adminAlive(token){
  if(typeof token !== 'string' || token.length !== 64) return false;
  const s = adminSessions.get(token);
  if(!s) return false;
  if(now() > s.exp){ adminSessions.delete(token); return false; }
  return true;
}
/* آیا این اتصال، همین حالا، مدیر است؟ `c.isAdmin` تنها کافی نیست: اتصالی که
   ۱۲ ساعت باز بماند باید خودش اختیارش را از دست بدهد. */
const isAdminNow = c => !!c && c.role==='admin' && !!c.isAdmin && adminAlive(c.adminToken);

function adminPruneSessions(){
  const t = now();
  let n = 0;
  for(const [tok, s] of adminSessions) if(t > s.exp){ adminSessions.delete(tok); n++; }
  return n;
}

/* ─────────────── هندلر upgrade ─────────────── */
const server = http.createServer((req, res) => {
  /* مرزِ خطا برای هر درخواست: پیش‌تر یک JSONِ دست‌کاری‌شده استثنای
     ناهمگام می‌انداخت و درخواست بی‌پاسخ آویزان می‌ماند. */
  Promise.resolve().then(() => handleHttp(req, res)).catch(err => {
    log('⚠️ خطای درخواست HTTP:', err && err.message);
    if(res.headersSent){ try{ res.destroy(); }catch(_){} return; }
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ success: false, error: 'درخواست نامعتبر است' }));
  });
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;

server.on('upgrade', (req, sock) => {
  const origin = req.headers.origin;
  if(ALLOW_ORIGIN !== '*' && origin && origin !== ALLOW_ORIGIN){
    sock.write('HTTP/1.1 403 Forbidden\r\n\r\n'); sock.destroy(); return;
  }
  const key = req.headers['sec-websocket-key'];
  if(req.headers.upgrade?.toLowerCase() !== 'websocket' || !key){
    sock.write('HTTP/1.1 400 Bad Request\r\n\r\n'); sock.destroy(); return;
  }
  /* B7: سقفِ اتصالِ هم‌زمان به ازای هر نشانی. بی آن، یک اسکریپت با چند
     هزار سوکتِ بی‌درودِ باز می‌توانست حافظه را پر کند (هر اتصال یک آبجکت
     + بافر نگه می‌دارد و تا idleMs زنده می‌ماند). با NOOR_TRUST_PROXY این
     شمارش پشتِ پروکسی هم معنا دارد؛ نشانی‌هایِ درون‌شبکه آزادند تا آزمون‌ها
     و توسعه‌دهندهٔ محلی گیر نکنند. */
  const peerIp = clientIp(req);
  const perIp = wsByIp.get(peerIp) || 0;
  if(WS_MAX_IP > 0 && perIp >= WS_MAX_IP && !isLocalAddr(peerIp)){
    log(`🚫 اتصالِ بیش از سقف از ${peerIp} (${perIp} سوکتِ باز) — رد شد`);
    sock.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); sock.destroy(); return;
  }
  if(clients.size >= LIMITS.maxClients){
    sock.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); sock.destroy(); return;
  }
  sock.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n'
  );
  sock.setNoDelay(true);

  /* شناسه را سرور تعیین می‌کند و بلافاصله اعلام می‌شود؛
     این‌طور کلاینت قبل از هر پیام دیگری هویت قطعی می‌گیرد. */
  let id; do { id = 'u-' + crypto.randomBytes(5).toString('hex'); } while(clients.has(id));
  const c = {
    id, sock, name: DEFAULT_USER_NAME, level: 1, score: 0,
    room: null, spectator: false, ready: true, known: false, isAdmin: false,
    since: now(), lastSeen: now(), stamps: [], roomsMade: 0
  };
  clients.set(c.id, c);
  wsByIp.set(peerIp, (wsByIp.get(peerIp) || 0) + 1);
  c.ip = peerIp;
  stats.totalConnections++;
  stats.peakOnline = Math.max(stats.peakOnline, clients.size);
  sendRaw(c, { t: 'welcome', to: c.id, id: c.id, server: 'noorestan', version: VERSION,
               online: clients.size, limits: LIMITS });

  let buffer = Buffer.alloc(0);

  sock.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    if(buffer.length > LIMITS.msgBytes * 8){   // محافظت از حافظه
      log('⚠️ سرریز بافر — اتصال بسته شد');
      sock.destroy(); return;
    }
    let parsed;
    try{ parsed = parseFrames(buffer); }
    catch(e){
      log('⚠️ فریم نامعتبر:', e.message);
      try{ sock.write(encodeFrame('', 0x8)); }catch(_){}
      sock.destroy(); return;
    }
    buffer = parsed.rest;
    for(const f of parsed.frames){
      /* RFC 6455: فریمِ کلاینت باید ماسک‌دار باشد، بیت‌های RSV صفر، و
         فریمِ کنترلی تکه‌نشده و ≤۱۲۵ بایت. */
      if(!f.masked || f.rsv || ((f.opcode & 0x8) && (!f.fin || f.payload.length > 125))){
        try{ sock.write(encodeFrame(Buffer.from([0x03, 0xEA]), 0x8)); }catch(_){}
        closeClient('فریمِ نامعتبر'); return;
      }
      if(f.opcode === 0x8){
        /* دست‌دادنِ بستن: همان کد را برمی‌گردانیم تا کلاینت تمیز ببندد */
        try{ sock.write(encodeFrame(f.payload.subarray(0, 2), 0x8)); }catch(_){}
        closeClient('کلاینت بست'); return;
      }
      if(f.opcode === 0x9){ try{ sock.write(encodeFrame(f.payload, 0xA)); }catch(e){} continue; }
      /* pong، نفسِ *احراز شده* را تازه می‌کند (B7). بی این شرط، یک سوکتِ
         بی‌درود با چند فریمِ خالی تا ابد باز می‌ماند و جای اتصال‌های واقعی
         را در سقفِ کلی می‌گرفت. */
      if(f.opcode === 0xA){ if(c.known) c.lastSeen = now(); continue; }
      let data;
      if(f.opcode === 0x0){                       // ادامهٔ پیامِ تکه‌تکه
        if(!c.frag){ closeClient('ادامه بی‌آغاز'); return; }
        c.frag.push(f.payload);
        c.fragBytes += f.payload.length;
        if(c.fragBytes > LIMITS.msgBytes){ closeClient('پیام بزرگ'); return; }
        if(!f.fin) continue;
        data = Buffer.concat(c.frag); c.frag = null; c.fragBytes = 0;
      } else if(f.opcode === 0x1){
        if(c.frag){ closeClient('پیامِ تکه‌تکهٔ ناتمام'); return; }
        if(!f.fin){ c.frag = [f.payload]; c.fragBytes = f.payload.length; continue; }
        data = f.payload;
      } else continue;                            // باینری پشتیبانی نمی‌شود
      if(data.length > LIMITS.msgBytes){ closeClient('پیام بزرگ'); return; }   // بایت، نه نویسه
      let msg;
      try{ msg = JSON.parse(data.toString('utf8')); }catch(e){ continue; }
      if(!msg || typeof msg !== 'object' || msg.ns !== NS) continue;   // فقط پیام‌های همین برنامه
      try{ handleMessage(c, msg); }
      catch(err){
        log(`⚠️ پیامِ نامعتبر از ${c.id}:`, err && err.message);
        sendRaw(c, { t: 'error', to: c.id, error: 'پیام نامعتبر' });
      }
    }
  });

  let closed = false;
  const closeClient = (why) => {
    if(closed) return;                       // فقط یک‌بار
    closed = true;
    log(`👋 خروج ${c.name} (${c.id}) — ${why}`);
    leaveRoom(c, true);
    clients.delete(c.id);
    if(c.ip){ const n = (wsByIp.get(c.ip) || 1) - 1; if(n > 0) wsByIp.set(c.ip, n); else wsByIp.delete(c.ip); }
    pendingFriends.delete(c.id);
    try{ sock.destroy(); }catch(e){}
    pushPeers(); pushRooms();
  };
  c.closeClient = closeClient;

  sock.on('error', () => closeClient('خطای سوکت'));
  sock.on('close', () => closeClient('اتصال بسته شد'));
});

/* ─────────────── HTTP ─────────────── */
const zlib = require('zlib');
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  /* B3: «قبله‌نما» موقعیت می‌خواهد و «محفل صوتی» میکروفن. بستنشان با
     Permissions-Policy یعنی شکستِ بی‌صدای همان دو قابلیت. دوربین و
     interest-cohort بسته می‌مانند (برنامه هیچ‌کدام را نمی‌خواهد). */
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(self), display-capture=(), interest-cohort=()'
};
/* ── Content-Security-Policy (B14) ──
   پیش‌فرض Report-Only: گزارشِ نقض‌ها بی‌شکستنِ هیچ صفحه‌ای؛ برای حالتِ
   اجرایی NOOR_CSP=enforce. `games/*.html` هنوز اسکریپتِ درون‌خطی دارد
   (بدنهٔ بازی در همان فایل است)؛ تا بیرون‌کشیدنشان در فاز ۴، همان‌ها
   'unsafe-inline' می‌گیرند و بدنهٔ برنامه سخت‌گیر می‌ماند. */
const CSP_BASE = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
  "media-src 'self' blob: data: https://everyayah.com https://*.everyayah.com https://mp3quran.net https://*.mp3quran.net https://quranicaudio.com https://*.quranicaudio.com https://islamic.network https://*.islamic.network",
  "manifest-src 'self'",
  "worker-src 'self'",
  "connect-src " + ["'self'", 'https://api.alquran.cloud', 'https://cdn.jsdelivr.net',
                    NOOR_ORIGIN ? NOOR_ORIGIN.replace(/^http/, 'ws') : 'wss: ws:'].join(' ')
].join('; ');
const CSP_STRICT = "script-src 'self'; " + CSP_BASE;
const CSP_GAMES  = "script-src 'self' 'unsafe-inline'; " + CSP_BASE;
function cspHeaders(p){
  if(CSP_MODE === 'off') return {};
  const body = (/^\/games(\/|$)/.test(p) ? CSP_GAMES : CSP_STRICT) +
               (process.env.NOOR_CSP_REPORT ? '; report-uri ' + process.env.NOOR_CSP_REPORT : '');
  return CSP_MODE === 'enforce' ? { 'Content-Security-Policy': body }
                                : { 'Content-Security-Policy-Report-Only': body };
}
function secHeaders(req, p){
  const h = { ...SECURITY_HEADERS, ...cspHeaders(p) };
  /* HSTS تنها با نشانیِ صریح (B14): سرورِ HTTP که HSTS بفرستد، مرورگر را
     قفلِ بی‌بازگشت می‌کند. */
  if(HSTS_HEADER) h['Strict-Transport-Security'] = HSTS_HEADER;
  return h;
}
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.avif':'image/avif',
  '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.m4a':'audio/mp4', '.wav':'audio/wav',
  '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf',
  '.txt':'text/plain; charset=utf-8', '.md':'text/markdown; charset=utf-8',
  '.map':'application/json; charset=utf-8', '.wasm':'application/wasm'
};

/* ── چه چیزهایی سرو می‌شوند (B4) ──
   فهرستِ پیش‌ذخیرهٔ سرویس‌ورکر و این صافی باید یکی باشند: sw.js نشانی‌های
   `/games/`، `/hadith-bank.js` و `/_quran-ref.json` را می‌خواست و سرور ۴۰۴
   می‌داد — سه درخواستِ شکسته در هر نصب. پس:
   • مسیرِ پوشه (با `/` پایان) به index.html همان پوشه می‌رسد؛
   • دو فایلِ دادهٔ ریشه (بانک حدیث، ارجاع قرآن) صریحاً بازند؛
   • بقیهٔ فایل‌های ریشه (پشتیبان، README، داده) بسته می‌مانند.
   `_check-scripts.js` و `tests/server.test.js` هر دو این هم‌خوانی را می‌سنجند. */
const ROOT_FILES = new Set(['/index.html', '/sw.js', '/manifest.json', '/offline.html',
                            '/hadith-bank.js', '/_quran-ref.json', '/favicon.ico', '/robots.txt']);
const ASSET_RE = /^\/assets\/(fonts|images|styles|games|app)\/[a-zA-Z0-9_.\/-]+$/;
const GAME_RE  = /^\/games\/[a-zA-Z0-9_.\/-]+$/;
function staticPath(p){
  if(p === '/') return '/index.html';
  if(ROOT_FILES.has(p)) return p;
  if(ASSET_RE.test(p) || GAME_RE.test(p)){
    try{
      const f = path.join(__dirname, p);
      if(fs.existsSync(f) && !fs.statSync(f).isDirectory()) return p;
    }catch(e){}
    return null;
  }
  if(p.endsWith('/') && (GAME_RE.test(p + 'index.html') || ASSET_RE.test(p + 'index.html'))) return p + 'index.html';
  return null;
}

let paymentService=null;
async function handleHttp(req, res){
  let p;try{p=decodeURIComponent(new URL(req.url,'http://x').pathname);}catch(e){res.writeHead(400);return res.end('400');}

  if(p.startsWith('/api/payments/')){
    /* B10 — سه چیز همین‌جا درست شد:
       ۱) تاجرِ جانشین نبود. `00000000-…-000000000001` باقالبِ UUID می‌گرفت و
          `enabled` روشن می‌شد؛ یعنی سرورِ نیمه‌پیکربندی به درگاهِ ناشناس
          درخواست می‌فرستاد. بی تاجر: fail-closed.
       ۲) استثنای سرویس فقط ۵۰۳ می‌شد و خودِ علت در لاگ نمی‌نشست — کاربر
          «پرداخت در دسترس نیست» می‌دید و مدیر هیچ. حالا علت لاگ می‌شود.
       ۳) دفترِ سکه از کارنامهٔ دستگاه جداست (همین سرویس) و `/api/coins`
          همان را می‌دهد تا کلاینتِ متین نتواند سکه بیافریند. */
    const mode = process.env.NOOR_PAYMENTS || 'disabled';
    const merchant = process.env.NOOR_ZARINPAL_MERCHANT || '';
    if(mode !== 'disabled' && !/^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(merchant)){
      log('⚠️ پرداخت: NOOR_ZARINPAL_MERCHANT تنظیم نشده — سرویس روشن نمی‌شود (fail-closed)');
      res.writeHead(503, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
                           'Access-Control-Allow-Origin': ALLOW_ORIGIN });
      return res.end(JSON.stringify({ success:false, error:'پیکربندیِ پرداخت کامل نیست؛ با پشتیبانی تماس بگیر.' }));
    }
    try{
      if(!paymentService) paymentService = require('./payments').createPayments({
        file: DATA_FILE + '.payments.json', auth: userTokenGet, mode,
        publicUrl: process.env.NOOR_PUBLIC_URL || '', merchant,
        onCredit: (id, coins, order) => creditCoins(id, coins, order)
      });
      return await paymentService.handle(req, res, new URL(req.url, 'http://x'));
    }catch(e){
      log('⚠️ سرویس پرداخت خطا داد: ' + ((e && e.message) || e));
      res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin': ALLOW_ORIGIN});
      return res.end(JSON.stringify({success:false,error:'پرداخت در دسترس نیست؛ با پشتیبانی تماس بگیر.'}));
    }
  }
  /* موجودیِ سکه از سرور (B10): میزبانِ واقعیِ عدد، دفترِ پرداخت است. */
  if(p === '/api/coins'){
    const tok = String(req.headers.authorization || '').replace(/^Bearer +/, '').trim();
    const au = userTokenGet(tok);
    const hdr = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
                  'Access-Control-Allow-Origin': ALLOW_ORIGIN };
    if(!au){ res.writeHead(401, hdr); return res.end(JSON.stringify({ success:false, error:'ورود لازم است' })); }
    let bal = 0, items = {}, enabled = false;
    try{
      const rec = userOf(au.phone);
      bal = (rec && rec.coins) || 0;
      items = (rec && rec.items) || {};
    }catch(e){}
    res.writeHead(200, hdr);
    return res.end(JSON.stringify({ success:true, coins: bal, items, enabled }));
  }

  /* پیش‌پرواز CORS. برنامه معمولاً هم‌خاستگاه است و پیش‌پرواز نمی‌فرستد،
     ولی اگر از file:// یا نشانی دیگری باز شود، همین جواب می‌دهد. */
  if(req.method === 'OPTIONS' && p.startsWith('/api/')){
    res.writeHead(204, { 'Access-Control-Allow-Origin': ALLOW_ORIGIN,
                         'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                         'Access-Control-Allow-Headers': 'Content-Type',
                         'Access-Control-Max-Age': '600' });
    return res.end();
  }

  /* سلامت (B20): فقط زنده‌بودن + شناسهٔ ثابتِ سرویس. نسخه، شمارِ آنلاین،
     اتاق‌ها و حجمِ کارنامه چهرهٔ ترافیکِ سرور را می‌داد؛ آمارِ کامل امن
     مانده و تنها /api/stats با نشستِ مدیر آن را می‌دهد. نشانِ ثابت کمک
     می‌کند کلاینت سرورِ خودِ نورستان را از پاسخِ عمومیِ {ok:true} بازشناسد. */
  if(p === '/health' || p === '/api/health'){
    res.writeHead(200, { 'Content-Type':'application/json', 'Cache-Control':'no-store',
                         'Access-Control-Allow-Origin': ALLOW_ORIGIN });
    return res.end('{"ok":true,"service":"noorestan"}');
  }
  if(p === '/api/stats'){
    const tok = String(req.headers['x-admin-token'] || '').trim() ||
                String(req.headers.authorization || '').replace(/^Bearer +/, '');
    if(!adminAlive(tok)){
      res.writeHead(401, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
                           'Access-Control-Allow-Origin': ALLOW_ORIGIN });
      return res.end(JSON.stringify({ success:false, error:'نشستِ مدیر لازم است' }));
    }
    res.writeHead(200, { 'Content-Type':'application/json', 'Cache-Control':'no-store',
                         'Access-Control-Allow-Origin': ALLOW_ORIGIN });
    return res.end(JSON.stringify(serverStats()));
  }
  if(p === '/api/leaderboard' || p === '/api/rooms'){
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!userTokenGet(token)){res.writeHead(401,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':ALLOW_ORIGIN});return res.end(JSON.stringify({success:false,error:'ورود لازم است'}));}
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify(p.endsWith('rooms')?{rooms:roomList()}:leaderboard));
  }
  if(p === '/api/account/me' || p === '/api/account/logout'){
    const hdr={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':ALLOW_ORIGIN};
    if(req.method!=='POST'){res.writeHead(405,hdr);return res.end('{}');}
    const body=await readJson(req,2048),auth=body&&userTokenGet(body.token);
    if(!auth){res.writeHead(401,hdr);return res.end(JSON.stringify({success:false}));}
    if(p.endsWith('/logout')){userTokenDrop(body.token);for(const c of [...clients.values()])if(c.userToken===body.token)c.closeClient('خروج از حساب');}
    res.writeHead(200,hdr);return res.end(JSON.stringify({success:true,id:auth.id,phone:auth.phone}));
  }

  /* ── ورودِ مدیر ──
     تنها جایی که رمزِ مدیر روی سیم می‌رود، و آن هم یک بار. پاسخ، نشانهٔ
     نشست است — نه رمز، نه هش. رمز و نشانه هیچ‌گاه لاگ نمی‌شوند. */
  if(p.startsWith('/api/admin/')){
    const hdr = { 'Content-Type':'application/json; charset=utf-8',
                  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
                  'Cache-Control': 'no-store' };
    const no = (code, error) => { res.writeHead(code, hdr);
      return res.end(JSON.stringify({ success: false, error })); };
    const ok = obj => { res.writeHead(200, hdr);
      return res.end(JSON.stringify({ success: true, ...obj })); };

    if(req.method !== 'POST') return no(405, 'فقط POST');
    if(!adminGateOpen())
      return no(503, 'رمز مدیر روی سرور تنظیم نشده (NOOR_ADMIN_PASS) — ورود مدیر روی سرور ممکن نیست');

    const ip = clientIp(req);

    /* B14: «رمزِ مدیر روی HTTP» یعنی رمزِ روی سیمِ باز — و پاسخِ همین مسیر
       نشستی می‌دهد که کل پنل را باز می‌کند. پس از بیرونِ شبکهٔ درون‌شبکه تنها
       روی HTTPS پذیرفته می‌شود؛ `x-forwarded-proto` هم فقط با NOOR_TRUST_PROXY
       باور می‌شود. برای آزمایشِ آگاهانه: NOOR_ALLOW_HTTP_ADMIN=1. */
    if(!ADMIN_HTTP_OK && !isHttps(req) && !isLocalAddr(ip)){
      log(`🚫 تلاشِ ورودِ مدیر روی HTTP از ${ip} — رد شد`);
      return no(403, 'ورودِ مدیر تنها روی HTTPS ممکن است (برای آزمایش: NOOR_ALLOW_HTTP_ADMIN=1)');
    }

    if(p === '/api/admin/login'){
      const body = await readJson(req, 1024);
      if(!body) return no(400, 'بدنهٔ درخواست خوانده نشد');
      const pass = String(body.pass || '');
      /* پیش از بررسیِ رمز، سقفِ تلاش. وگرنه همین مسیر می‌شد درِ حدس‌زدن.
         رمزِ بد هم شکلِ پاسخش با رمزِ درست یکی نیست ولی زمانش یکی است. */
      const lim = adminAllow(ip);
      if(!lim.ok){ log(`🚫 ورودِ مدیر رد شد (${ip}): ${lim.why}`); return no(429, lim.why); }
      if(!sameHash(sha256Hex(pass), ADMIN_HASH)){
        const fails=Math.min(12,(adminBackoff.get(ip)?.fails||0)+1);
        adminBackoff.set(ip,{fails,until:now()+Math.min(300000,1000*2**(fails-1))});
        log(`🚫 رمزِ مدیر اشتباه (${ip})`);
        return no(401, 'رمز اشتباه است');
      }
      adminForget(ip);
      const token = adminNewToken();
      log(`👑 ورودِ مدیر (${ip}) — نشست تا ${Math.round(ADMIN_SESSION_MS / 3600000)} ساعت`);
      return ok({ token, exp: ADMIN_SESSION_MS });
    }

    if(p === '/api/admin/logout'){
      const body = await readJson(req, 1024);
      if(body && adminAlive(body.token)){
        adminSessions.delete(body.token);
        for(const c of [...clients.values()])if(c.adminToken===body.token)c.closeClient('خروج مدیریت');
        log('👑 نشستِ مدیر باطل شد');
      }
      /* بیرون‌رفتن همیشه «موفق» است؛ وگرنه وجودِ یک نشست را تأیید می‌کرد. */
      return ok({});
    }

    if(p === '/api/admin/whoami'){
      const body = await readJson(req, 1024);
      return ok({ admin: !!(body && adminAlive(body.token)) });
    }

    return no(404, 'چنین مسیری نیست');
  }

  /* ── پیامک ──
     /status هیچ‌وقت کلید را برنمی‌گرداند — فقط «دارم یا نه». */
  if(p === '/api/otp/status'){
    res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8',
                         'Access-Control-Allow-Origin': ALLOW_ORIGIN,
                         'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ configured: smsConfigured(), on: SMS_ON,
                                    device: SMS_DEVICE ? '…' + SMS_DEVICE.slice(-4) : '' }));
  }

  /* ── ساخت و فرستادنِ کد، روی سرور ──
     کد اینجا ساخته می‌شود و هرگز به کلاینت نمی‌رود. پیش‌تر کلاینت کد را
     می‌ساخت و با پیامک می‌فرستاد؛ یعنی خودش هم می‌دانستش و می‌توانست
     بی‌نیاز از پیامک تأییدش کند. */
  if(p === '/api/otp/request'){
    const hdr = { 'Content-Type':'application/json; charset=utf-8',
                  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
                  'Cache-Control': 'no-store' };
    const no = (code, error) => { res.writeHead(code, hdr);
      return res.end(JSON.stringify({ success: false, state: 'failed', error: smsRedact(error) })); };

    if(req.method !== 'POST') return no(405, 'فقط POST');
    if(!smsConfigured()) return no(503, 'کلید پیامک روی سرور تنظیم نشده (NOOR_SMS_KEY / NOOR_SMS_DEVICE)');

    const body = await readJson(req, 2048);
    if(!body) return no(400, 'بدنهٔ درخواست خوانده نشد');

    const phone = digits(body.phone).replace(/\D/g, '');
    if(!/^09\d{9}$/.test(phone)) return no(400, 'شمارهٔ موبایل معتبر نیست');

    /* سد پیش از ساختِ کد: بی آن، هر درخواست یک کد و یک پیامک می‌ساخت و
       شمارندهٔ تلاش‌ها را پر می‌کرد. */
    const lim = smsAllow(phone, clientIp(req));
    if(!lim.ok){ log(`🚫 پیامک رد شد (${maskPhone(phone)} · ${clientIp(req)}): ${lim.why}`); return no(429, lim.why); }

    /* B12 — سیاستِ کد، پیش از ساختنِ کد: فاصلۀ دو ارسال به یک شماره، و
       سقفِ شبانه‌روزِ همان شماره. این دو *روی شمارۀ تلفن* است (نه IP) تا
       یک شمارهٔ مشترک (خانواده، دفتر) همسایه‌ها را نسوزاند؛ سقفِ IP و سقفِ
       کلیِ سرور را همان `smsAllow` بالا نگهبانی می‌کند. */
    const pol = otpSendAllow(phone);
    if(!pol.ok){
      log(`🚫 کد تأیید نگرفتیم (${maskPhone(phone)} · ${clientIp(req)}): ${pol.why}`);
      return no(429, pol.why);
    }

    const code = otpCode();
    const salt = otpSalt();
    otps.set(phone, { hash: otpHash(code, salt), salt, exp: now() + OTP_TTL_MS,
                      tries: 0, at: now() });

    const out = await smsSend(phone, smsOtpMessage(code));
    const stamp = out.state === 'sent' ? '📨' : out.state === 'pending' ? '⏳' : '⚠️';
    /* شماره در لاگ می‌ماند (برای پیگیری)، ولی خودِ کد هرگز — نه اینجا، نه در
       هیچ لاگ دیگری. */
    log(`${stamp} کد تأیید → ${maskPhone(phone)} · ${out.state}` +
        (out.state === 'sent' ? (out.id ? ' · ' + out.id : '') : ' — ' + out.error));

    /* ارسال نشد ⇒ کد هم نباید بماند. وگرنه کدی در حافظه می‌ماند که کاربر
       نگرفته و کسی هم نمی‌داند. */
    if(out.state === 'failed'){ otps.delete(phone); return no(502, out.error); }
    /* «فرستاده شد» را ثبت کن تا فاصله و سقفِ شبانه‌روز سنجیده بمانند.
       اگر درگاه فقط صف را پذیرفت (pending) هم می‌شماریم؛ پیامکِ دوتایی
       خرجِ کاربر است، نه فقط خرجِ ما. */
    if(out.state === 'sent' || out.state === 'pending') otpSendNote(phone);

    if(out.state === 'pending'){
      res.writeHead(202, hdr);
      return res.end(JSON.stringify({ success: false, pending: true, state: 'pending',
                                      error: out.error, ttl: OTP_TTL_MS }));
    }
    res.writeHead(200, hdr);
    return res.end(JSON.stringify({ success: true, state: 'sent', len: OTP_LEN,
                                    ttl: OTP_TTL_MS, id: out.id || '' }));
  }

  /* ── بررسیِ کد ──
     یک‌بارمصرف: با موفقیت، کد پاک می‌شود. کدِ منقضی هم پاک می‌شود.
     پاسخِ موفق، نشانهٔ نشستِ کاربر است — نه خودِ کد. */
  if(p === '/api/otp/verify'){
    const hdr = { 'Content-Type':'application/json; charset=utf-8',
                  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
                  'Cache-Control': 'no-store' };
    const no = (code, error, extra) => { res.writeHead(code, hdr);
      return res.end(JSON.stringify({ success: false, error, ...(extra || {}) })); };

    if(req.method !== 'POST') return no(405, 'فقط POST');
    const body = await readJson(req, 2048);
    if(!body) return no(400, 'بدنهٔ درخواست خوانده نشد');

    const phone = digits(body.phone).replace(/\D/g, '');
    if(!/^09\d{9}$/.test(phone)) return no(400, 'شمارهٔ موبایل معتبر نیست');

    const ip = clientIp(req);
    /* قفلِ شماره (B12) پیش از هر چیز: پس از چند تلاشِ ناموفق، حتی کدِ درستِ
       همان شماره هم پذیرفته نمی‌شود. بی این، «سه تلاش» عملاً بی‌سقف بود:
       کدِ تازه شمارندهٔ کد را صفر می‌کرد و مهاجم می‌توانست بی‌پایان جارو کند. */
    const lockLeft = otpLockLeft(phone);
    if(lockLeft){
      log(`⛔ تلاش روی کدِ قفل‌شده (${maskPhone(phone)}) — ${lockLeft} دقیقه صبر`);
      return no(429, 'چند بار کدِ اشتباه داده شد — ' + lockLeft + ' دقیقه دیگر دوباره تلاش کن',
                { locked: true, waitMin: lockLeft });
    }
    const lim = verifyAllow(ip);
    if(!lim.ok){ log(`🚫 بررسیِ کد رد شد (${ip}): ${lim.why}`); return no(429, lim.why); }

    /* شکلِ کد پیش از نگاه به حالت سنجیده می‌شود: پرسشی که از پیش غلط است
       نباید به ما بگوید برای این شماره کدی هست یا نه. */
    const code = digits(body.code).replace(/\D/g, '');
    if(code.length !== OTP_LEN) return no(400, `کد ${OTP_LEN} رقمی است`);

    const st = otpGet(phone);
    if(!st){
      /* «کدی که نیست» هم یک تلاش است. بی این ثبت، مهاجم کافی بود صبر کند تا
         کد بسوزد و بعد با هر درخواستِ تازه شمارندهٔ قفلِ شماره را صفر ببیند
         — یعنی قفل عملاً بسته نمی‌شد (B12). */
      const waitMin0 = otpNoteFail(phone);
      return no(410, waitMin0 ? 'چند بار کدِ اشتباه — ' + waitMin0 + ' دقیقه صبر کن'
                              : 'کد منقضی شد — کد تازه بگیر',
                { expired: true, locked: !!waitMin0, waitMin: waitMin0 });
    }

    /* نمکِ رکورد عوض نمی‌شود تا سنجش معنادار بماند */
    const okCode = sameHash(otpHash(code, st.salt), st.hash);
    if(!okCode){
      st.tries = (st.tries || 0) + 1;
      /* قفلِ شماره هم جلو می‌رود؛ پاک‌کردنِ کدِ سوخته دیگر شمارنده را
       بی‌گناه نمی‌کند (B12). */
      const waitMin = otpNoteFail(phone);
      if(st.tries >= OTP_MAX_TRIES){
        otps.delete(phone);
        log(`🚫 کدِ تأیید سه بار اشتباه (${maskPhone(phone)}) — کد سوخت`);
        return no(429, waitMin ? 'چند بار کدِ اشتباه — ' + waitMin + ' دقیقه صبر کن'
                               : 'سه بار اشتباه — کد سوخت، کد تازه بگیر',
                  { burned: true, locked: !!waitMin, waitMin });
      }
      log(`⚠️ کدِ تأیید اشتباه (${maskPhone(phone)}) — ${OTP_MAX_TRIES - st.tries} تلاش مانده`
          + (waitMin ? ` · شماره قفل شد (${waitMin} دقیقه)` : ''));
      return no(401, `کد اشتباه است — ${OTP_MAX_TRIES - st.tries} تلاش مانده`,
                { left: OTP_MAX_TRIES - st.tries, locked: !!waitMin, waitMin });
    }

    /* درست بود: کد سوخت، کاربر به شماره بسته شد، نشست صادر شد. */
    otps.delete(phone);
    otpOkClear(phone);              // قفلِ تلاش‌ها تنها با کدِ درست باز می‌شود
    const wasNew = !userOf(phone);
    const rec = userBind(phone, String(body.userId || ''), ip);
    const token = userTokenNew(rec.id, phone);
    /* پیامکِ خوش‌آمدگویی — ولی *نه* پیش از پاسخ. اگر منتظرش بمانیم، کندیِ
       textbee ورودِ کاربر را معطل می‌کند و کاربری که پیامکش رفته، پشتِ
       صفحهٔ انتظار می‌ماند.

       شرط، «نخستین ورود» نیست بلکه «هنوز نرفته». اگر فقط به نخستین ورود
       گره می‌خورد، یک قطعیِ گذرا در همان لحظه یعنی کاربر هرگز خوش‌آمد
       نمی‌گرفت — چون ورودِ دوم دیگر «نخستین» نیست. «یک بار برای همیشه»
       همچنان برجاست: نشانِ `welcomed` فقط با ارسالِ موفق می‌خورد و
       `welcomeSmsOnce` خودش سقفِ تلاش را نگه می‌دارد. */
    /* B13: خوش‌آمدگویی تنها برای *نوآمد* — کاربرِ بازگشتی که یک بار
       خوش‌آمد نگرفته (چون پیامکش رفته یا ویژگی تازه است) دوباره پیامک
       نمی‌گیرد؛ هزینه‌اش را کاربرِ قدیمی نمی‌دهد. */
    /* B13: کاربرِ بازگشتی معاف است، ولی «نوآمد» فقط در همان روزِ ثبت‌نام است:
     اگر پیامکِ خوش‌آمد به هر دلیلی نرسیده باشد، ورودِ دومِ همان روز فرصتِ
     دوباره را می‌دهد (آزمونِ _servertest «فرصتِ دوباره نمی‌سوزد» همین است) و
     کاربرِ یک‌ماهه دیگر پیامک نمی‌گیرد. */
  const sayHi = !rec.welcomed && (wasNew || now() - (rec.joinedAt || 0) < 24 * 3600 * 1000);
    if(sayHi){
      Promise.resolve()
        .then(() => welcomeSmsOnce(rec))
        .catch(e => log('⚠️ خوش‌آمدگویی ناموفق:', (e && e.message) || e));
    }
    log(`✅ شماره تأیید شد → ${rec.id}`);
    res.writeHead(200, hdr);
    return res.end(JSON.stringify({ success: true, token, id: rec.id, name: rec.name,
                                    first: wasNew, welcomed: !!rec.welcomed,
                                    exp: USER_TOKEN_MS }));
  }

  if(p === '/api/otp/send'){
    const hdr = { 'Content-Type':'application/json; charset=utf-8',
                  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
                  'Cache-Control': 'no-store' };
    /* هر «قطعاً نشد» با state=failed می‌رود تا کلاینت مجبور نباشد از کد HTTP
       حدس بزند؛ و هرگز با «نامعلوم» اشتباه گرفته نشود. متن خطا از صافی کلید
       می‌گذرد (smsRedact) چون ممکن است از بیرون آمده باشد. */
    const no = (code, error) => {
      res.writeHead(code, hdr);
      return res.end(JSON.stringify({ success: false, state: 'failed', error: smsRedact(error) }));
    };

    if(req.method !== 'POST') return no(405, 'فقط POST');
    if(!smsConfigured()) return no(503, 'کلید پیامک روی سرور تنظیم نشده (NOOR_SMS_KEY / NOOR_SMS_DEVICE)');

    const body = await readJson(req, 2048);
    if(!body) return no(400, 'بدنهٔ درخواست خوانده نشد');

    const phone = digits(body.phone).replace(/\D/g, '');
    if(!/^09\d{9}$/.test(phone)) return no(400, 'شمارهٔ موبایل معتبر نیست');

    /* فقط پیامکِ آزمایشی.
       پیش‌تر این مسیر کدِ *کلاینت* را هم می‌پذیرفت و می‌فرستاد؛ یعنی هر کسی
       می‌توانست هر شماره‌ای را با متنِ دلخواه — از جمله «کد تأیید» — بمباران
       کند. کدِ تأیید حالا فقط در /api/otp/request و روی سرور ساخته می‌شود. */
    if(body.test !== true) return no(400, 'این مسیر فقط پیامکِ آزمایشی می‌فرستد — کدِ تأیید از /api/otp/request');
    const message = smsTestMessage(), kind = 'آزمایشی';

    const lim = smsAllow(phone, clientIp(req));
    if(!lim.ok){ log(`🚫 پیامک رد شد (${maskPhone(phone)} · ${clientIp(req)}): ${lim.why}`); return no(429, lim.why); }

    const out = await smsSend(phone, message);
    const stamp = out.state === 'sent' ? '📨' : out.state === 'pending' ? '⏳' : '⚠️';
    log(`${stamp} پیامک ${kind} → ${maskPhone(phone)} · ${out.state}` +
        (out.state === 'sent' ? (out.id ? ' · ' + out.id : '') : ' — ' + out.error));

    /* «نمی‌دانیم» با «نشد» یکی نیست. برای pending کد ۲۰۲ می‌فرستیم، نه ۵۰۲، تا
       کلاینت کاربر را از صفحهٔ کد بیرون نکند؛ شاید پیامک رسیده باشد و فقط
       پاسخش گم شده باشد. */
    if(out.state === 'pending'){
      res.writeHead(202, hdr);
      return res.end(JSON.stringify({ success: false, pending: true, state: 'pending',
                                      error: out.error }));
    }
    if(out.state !== 'sent') return no(502, out.error);

    /* شناسهٔ پیام (مثل abc123) امن است؛ کلید هرگز. */
    res.writeHead(200, hdr);
    return res.end(JSON.stringify({ success: true, state: 'sent', id: out.id || '' }));
  }

  const allowedPath = staticPath(p);
  if(!allowedPath){res.writeHead(404);return res.end('404');}
  p = allowedPath;
  if(p.includes('..')||p.includes('\\')){res.writeHead(403);return res.end('403');}
  let file = p === '/' ? '/index.html' : p;
  /* جلوگیری از فرار از پوشهٔ برنامه با ../ */
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(__dirname, file);
  if(!full.startsWith(__dirname)){ res.writeHead(403); return res.end('403'); }
  if(!fs.existsSync(full) || fs.statSync(full).isDirectory()){
    /* اگر index.html نبود، مناسب‌ترین نسخهٔ دیگر را بده (فایل پشتیبان هرگز سرو نمی‌شود) */
    if(p === '/' || p === '/index.html'){
      const cands = fs.readdirSync(__dirname)
        .filter(f => /\.html$/i.test(f) && !/\.bak\.html$/i.test(f) && !/^_/i.test(f))
        .sort((a, b) => (b.match(/\d+/g) || []).join('').localeCompare((a.match(/\d+/g) || []).join(''), undefined, { numeric: true }));
      const idx = cands.find(f => /^index\.html$/i.test(f));
      if(idx) return serveFile(path.join(__dirname, idx), res);
      if(cands[0]) return serveFile(path.join(__dirname, cands[0]), res);
    }
    res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' });
    return res.end('<h1 dir="rtl">۴۰۴ — پیدا نشد</h1><p dir="rtl"><a href="/">خانه</a></p>');
  }
  serveFile(full, res);
}

function serveFile(full, res){
  const ext = path.extname(full).toLowerCase();
  /* سه فایل نباید کش HTTP شوند:
     · خود صفحه‌ها، چون نسخهٔ تازه باید بی‌درنگ بنشیند.
     · sw.js؛ اگر ساعت‌ها کش شود، به‌روزرسانی سرویس‌ورکر عقب می‌افتد و
       کاربر نسخهٔ کهنهٔ کش را نگه می‌دارد — همان چیزی که PWA نباید بکند.
     · manifest.json، چون مسیر آیکن‌ها و نام برنامه از آن می‌آید. */
  const base = path.basename(full).toLowerCase();
  const fresh = ext === '.html' || base === 'sw.js' || base === 'manifest.json';
  let st;
  try{ st = fs.statSync(full); }catch(e){ res.writeHead(404); return res.end(); }
  const etag = `W/"${st.size.toString(16)}-${Math.trunc(st.mtimeMs).toString(16)}"`;
  /* B11: «نامِ هش‌دار» تنها وقتی یعنی «تا ابد همین است» که آن عدد راستی
     از محتوای فایل آمده باشد — `nameIsContentHash` همین را امتحان می‌کند.
     اگر نخورد، فایل با همان `stale-while-revalidate` سرو می‌شود: یک روز
     کش، ولی عوض‌شدنِ فایل در بارِ بعدی دیده می‌شود (نه یک روزِ کهنه). */
  const immutable = nameIsContentHash(full, st);
  const head = {
    ...secHeaders(res.req, (res.req && res.req.url) || ''),
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': fresh ? 'no-cache'
               : (immutable ? 'public, max-age=31536000, immutable'
                                  : 'public, max-age=86400, stale-while-revalidate=604800'),
    'ETag': etag, 'Last-Modified': st.mtime.toUTCString(), 'Vary': 'Accept-Encoding'
  };
  const req = res.req;
  if(req && req.headers['if-none-match'] === etag){ res.writeHead(304, head); return res.end(); }
  /* فشرده‌سازی: index.html حدود ۱٫۱ مگابایت است؛ با gzip به‌حدود یک‌پنجم
     می‌رسد. نتیجه با همان ETag در حافظه نگه داشته می‌شود. */
  const ae = String((req && req.headers['accept-encoding']) || '');
  if(COMPRESSIBLE.has(ext) && st.size > 1024 && st.size < 8 * 1024 * 1024){
    const enc = /\bbr\b/.test(ae) ? 'br' : (/\bgzip\b/.test(ae) ? 'gzip' : '');
    if(enc){
      const key = full + '|' + enc;
      let hit = gzCache.get(key);
      if(!hit || hit.etag !== etag){
        /* B19: فشرده‌سازی همگام روی مسیرِ درخواست بود — هر بار که حافظهٔ
           فشرده‌سازی پر می‌شد یا فایل تازه می‌آمد، یک هسته برای صدها
           میلی‌ثانیه درگیر می‌شد. حالا اگر build.js کنارِ فایل، نسخهٔ
           فشرده‌اش را (`file.br` / `file.gz`) گذاشته باشد، همان خوانده
           می‌شود و کارِ سنگین از مسیرِ درخواست بیرون می‌رود؛ در غیر این‌صورت
           همان جای قبلی — ولی با نشانک، تا یک‌بار برای هر نسخه بسوزد. */
        const side = full + (enc === 'br' ? '.br' : '.gz');
        let body = null;
        try{ if(fs.existsSync(side) && fs.statSync(side).mtimeMs >= st.mtimeMs) body = fs.readFileSync(side); }catch(e){}
        if(!body){
          const raw = fs.readFileSync(full);
          body = enc === 'br'
            ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } })
            : zlib.gzipSync(raw, { level: 9 });
        }
        hit = { etag, body }; gzCache.set(key, hit);
      }
      res.writeHead(200, { ...head, 'Content-Encoding': enc, 'Content-Length': hit.body.length });
      return res.end(req.method === 'HEAD' ? undefined : hit.body);
    }
  }
  res.writeHead(200, { ...head, 'Content-Length': st.size });
  if(req && req.method === 'HEAD') return res.end();
  /* B19: `pipe` بی هندلرِ خطا. اگر فایل وسطِ خواندن برود (یا کلاینت نیمه‌ببندد
     و stream خطا بدهد)، استثنا مهارنشده پروسه را می‌اندازد. */
  const stream = fs.createReadStream(full);
  stream.on('error', err => {
    log('⚠️ خواندنِ فایل نیمه‌کاره ماند: ' + path.basename(full) + ' — ' + (err && err.code || err));
    try{ stream.destroy(); }catch(e){}
    try{ res.destroy(); }catch(e){}
  });
  if(req) req.on('close', () => { try{ stream.destroy(); }catch(e){} });
  stream.pipe(res);
}
/* B11 — نام‌های `app-1-3bce8fb8d2.js` و `style-1-….css` در این مخزن *تزئینی*
  ‌اند: هشِ محتوای خودِ فایل نیستند (آزموده شد: sha256ِ فایل با عددِ داخل نام
   نمی‌خواند). پس `immutable` روی همان‌ها یعنی «هر بار که محتوایشان عوض شد،
   کاربرانِ موجود تا ابد نسخهٔ کهنه را نگه می‌دارند». این‌جا صادقانه عمل می‌کنیم:
   • `immutable` تنها وقتی داده می‌شود که عددِ داخلِ نام، واقعاً آغازِ
     sha256ِ محتوا باشد — یعنی اگر روزی build.js نام‌ها را محتوا-نشانه کند،
     کشِ تهاجمی *خودکار* روشن می‌شود؛
   • بقیهٔ فایل‌هایِ ایستا `max-age=86400` می‌گیرند ولی با
     `stale-while-revalidate`: یک روزه‌یادِ معمولی، و اگر فایل عوض شده بود،
     بارِ بعدی همان لحظه نسخهٔ تازه را در پس‌زمینه می‌گیرد — نه یک روزِ
     کاملِ کهنه.
   سند/`sw.js`/manifest هم مثل قبل `no-cache` + ETag می‌مانند (باید هر بار
   بررسی شوند؛ کلِ PWA از همین راه تازه می‌شود). */
const HASH_NAME_RE = /-([0-9a-f]{8,16})\.(js|css|woff2|webp|png)$/;
const immuMemo = new Map();      // path|mtime|size → آیا نام، هشِ محتواست؟
function nameIsContentHash(full, st){
  const m = HASH_NAME_RE.exec(path.basename(full).toLowerCase());
  if(!m) return false;
  const key = full + '|' + st.mtimeMs + '|' + st.size;
  const hit = immuMemo.get(key);
  if(hit !== undefined) return hit;
  let ok = false;
  try{
    if(st.size < 8 * 1024 * 1024) ok = sha256Hex(fs.readFileSync(full)).startsWith(m[1]);
  }catch(e){}
  if(immuMemo.size > 400) immuMemo.clear();
  immuMemo.set(key, ok);
  return ok;
}


/* B19 — گرم‌کردنِ کاهجِ فشرده‌سازی در پس‌زمینهٔ بوت.
   فشرده‌سازیِ همگام روی مسیرِ درخواست، اولین کاربرِ هر فایل را صدها
   میلی‌ثانیه پشتِ CPU می‌گذاشت (و روی سرورِ ضعیف، همان یک فایل ۱٫۱ مگابایتی
   index.html). حالا درستِ پسِ بالا آمدن، فایل‌های بزرگ در *پس‌زمینه* و با
   توابعِ ناهمگامِ zlib فشرده می‌شوند؛ هر فایل یک چرخهٔ رویداد نفس می‌کشد تا
   حلقهٔ اصلیِ سرور برای درخواست‌های تازه قفل نشود. اگر هم چیزی گرم نشده
   باشد، مسیرِ_lazyِ پایین همان کار را می‌کند — یعنی هیچ‌چیز به گردنِ این
   بهینه‌گذاری نمی‌افتد. */
function warmCompression(){
  const roots = ['index.html', 'sw.js', 'manifest.json', 'offline.html'];
  for(const dir of ['assets/app', 'assets/styles']){
    try{ for(const f of fs.readdirSync(path.join(__dirname, dir)))
      if(/\.(js|css)$/.test(f)) roots.push(dir + '/' + f); }catch(e){}
  }
  const list = roots.map(r => path.join(__dirname, r))
    .filter(f => { try{ const st = fs.statSync(f); return st.isFile() && st.size > 1024 && st.size < 8*1024*1024; }catch(e){ return false; } })
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)
    .slice(0, 24);
  let i = 0, bytes = 0;
  const step = () => {
    if(i >= list.length){ if(bytes) log(`🗜️ ${i} فایل در پس‌زمینه فشرده شد (${(bytes/1024)|0}KB)`); return; }
    const full = list[i++];
    let st;
    try{ st = fs.statSync(full); }catch(e){ return setImmediate(step); }
    const etag = `W/"${st.size.toString(16)}-${Math.trunc(st.mtimeMs).toString(16)}"`;  // همان قالب serveFile
    const ext = path.extname(full).toLowerCase();
    const raw = (() => { try{ return fs.readFileSync(full); }catch(e){ return null; } })();
    if(!raw || !COMPRESSIBLE.has(ext)) return setImmediate(step);
    let wait = 2;
    const done = () => { if(--wait <= 0){ bytes += raw.length; setImmediate(step); } };
    zlib.brotliCompress(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } },
      (err, body) => { if(!err) gzCache.set(full + '|br', { etag, body }); done(); });
    zlib.gzip(raw, { level: 9 },
      (err, body) => { if(!err) gzCache.set(full + '|gzip', { etag, body }); done(); });
  };
  setImmediate(step);
}


const COMPRESSIBLE = new Set(['.html','.js','.css','.json','.svg','.webmanifest','.txt','.md','.map']);
const gzCache = new Map();

/* ─────────────── حلقه‌های دوره‌ای ─────────────── */
setInterval(() => {
  const t = now();
  let changed = false;
  for(const [id, c] of clients){
    /* B7: اتصالی که درود (hello) نفرستاده، «کاربرِ بی‌حوصله» نیست،
       نیم‌اتصالِ سفتهباز است — ده ثانیه مهلت، بعد بسته می‌شود. */
    if(!c.known && t - c.since > WS_HELLO_MS){
      log(`⏱ ${c.id} بی‌درود ماند — بسته شد`);
      c.closeClient('بی‌درود');
      changed = true;
      continue;
    }
    if(t - c.lastSeen > LIMITS.idleMs){
      log(`⏱ ${c.name} بی‌پاسخ — قطع شد`);
      c.closeClient('بی‌پاسخ');
      changed = true;
      continue;
    }
    if(!c.sock.destroyed){ try{ c.sock.write(encodeFrame('', 0x9)); }catch(e){} }   // ping
  }
  if(changed){ pushPeers(); pushRooms(); }
}, 15000);

/* B19: فهرستِ حضور در هر پنج ثانیه برای همه پخش می‌شد، حتی وقتی هیچ‌چیز
   عوض نشده بود (روی موبایل یعنی بیدار‌نگه‌داشتنِ رادیو بی‌دلیل). حالا
   pushPeers/pushRooms خودشان «تغییر» را می‌سنجند (امضای فهرست). */
setInterval(() => { if(clients.size) pushPeers(); }, 5000);
setInterval(() => { if(clients.size) pushRooms(); }, 12000);
/* B19: نوشتنِ دوره‌ایِ بی‌دلیلِ فایل داده حذف شد. `saveData()` خودش با
   نشانکِ زمان‌بندیِ یک‌باره کار می‌کند و هر تغییر همان را جلو می‌اندازد؛
   پس نوشتنِ هر ۳۰ ثانیه، فقط سایشِ فلش بود. */
/* نشست‌های منقضی هر دقیقه پاک می‌شوند. `adminAlive` خودش هم منقضی را
   دور می‌ریزد، ولی نشستی که دیگر پرسیده نمی‌شود تا ابد در حافظه می‌ماند. */
setInterval(() => {
  /* کدهای منقضی و بی‌مصرف پاک می‌شوند؛ نگه‌داشتنشان نه فایده‌ای دارد و نه
     ایمن است. */
  const t = now();
  for(const [ph, st] of otps) if(t > st.exp) otps.delete(ph);
  for(const [tok, st] of userTokens) if(t > st.exp) userTokens.delete(tok);
      let dead = 0;
      for(const [h, st] of userSessions) if(t > st.exp){ userSessions.delete(h); dead++; }
      if(dead) saveData();
      /* B20 — نگهداشتِ کاهش‌یافته: نشانیِ هش‌شده هم پس از سکوتِ طولانی از
         کارنامه می‌رود. پیش‌تر `ips` تا ابد می‌ماند و «برداشتِ داده تا
         حذفِ حساب» بود. */
      if(RETENTION_DAYS > 0){
        const cut = t - RETENTION_DAYS * 86400000;
        let aged = 0;
        for(const rec of userByPhone.values()){
          if((rec.lastLogin || rec.joinedAt || 0) >= cut) continue;
          if(rec.lastIp){ rec.lastIp = ''; rec.ips = []; aged++; }
        }
        if(aged){ saveData(); log(`🧽 ${aged} کارنامه پس از ${RETENTION_DAYS} روز بی‌فعالیت، نشانی‌زدایی شد`); }
      }
  const n = adminPruneSessions();
  if(n) log(`🔒 ${n} نشستِ منقضیِ مدیر پاک شد`);
  /* سابقهٔ تلاشِ آدرس‌هایی که دیگر نمی‌آیند هم پاک می‌شود؛ وگرنه نگاشت
     به‌ازای هر آدرسِ دیده‌شده یک ردیف نگه می‌داشت. */
  for(const [ip, list] of adminTries){
    const live = list.filter(x => t - x < ADMIN_TRY_MS);
    if(live.length) adminTries.set(ip, live); else adminTries.delete(ip);
  }
  /* بقیهٔ نگاشت‌های نرخ هم با کلیدِ نامطمئن (IP/شماره) پر می‌شدند و هرگز
     کوچک نمی‌شدند. */
  const prune = (map, ttl) => { for(const [k, list] of map){
    const live = Array.isArray(list) ? list.filter(x => t - x < ttl) : [];
    if(live.length) map.set(k, live); else map.delete(k); } };
  prune(verifyByIp, 3600000);
  prune(smsByIp, 3600000);
  prune(smsByPhone, SMS_LIMIT.perPhoneMs);
  for(const [ip, st] of adminBackoff) if(!st || t > (st.until || 0) + ADMIN_TRY_MS) adminBackoff.delete(ip);
}, 60000);

/* پیشنهادهای دوستی کهنه (بیش از ۲ دقیقه) پاک می‌شوند */
setInterval(() => {
  const t = now();
  for(const [from, p] of pendingFriends) if(t - p.at > 120000) pendingFriends.delete(from);
}, 60000);

/* ─────────────── راه‌اندازی ─────────────── */
function lanIPs(){
  const out = [];
  for(const list of Object.values(os.networkInterfaces() || {}))
    for(const i of list || [])
      if(i.family === 'IPv4' && !i.internal) out.push(i.address);
  return out;
}

loadData();
server.listen(PORT, HOST, () => {
  const ips = lanIPs();
  console.log('');
  console.log(`  🌟  نورستان ${VERSION} — سرور محفل`);   /* B22: نسخه از package.json */
  console.log('  ─────────────────────────────────────────');
  console.log(`  سرور روی پورت ${PORT} اجرا شد`);
  console.log(`  همین دستگاه : http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  شبکه محلی  : http://${ip}:${PORT}`));
  ips.forEach(ip => console.log(`  آدرس WS    : ws://${ip}:${PORT}`));
  console.log('  ─────────────────────────────────────────');
  /* عمداً خودِ رمز چاپ نمی‌شود. لاگ سرور می‌تواند ذخیره، فرستاده یا در
     گزارش خطا دیده شود؛ رمزی که در لاگ بنشیند، رمز نیست. */
  console.log(`  رمز مدیر سرور : ${ADMIN_HASH
    ? 'تنظیم شده (NOOR_ADMIN_PASS)'
    : '⚠️ تنظیم نشده — پنل مدیریت روی سرور کار نمی‌کند (NOOR_ADMIN_PASS را ست کن)'}`);
  /* هشدار رمز ضعیف. رد نمی‌کنیم — سرورِ در حال کار را نباید بی‌خبر بخوابانیم —
     ولی بی‌صدا هم رد نمی‌شویم. */
  if(ADMIN_PASS && ADMIN_PASS.trim().length < 8)
    console.log(`  ⚠️ هشدار      : NOOR_ADMIN_PASS کوتاه است (${ADMIN_PASS.trim().length} کاراکتر) — حداقل ۸ بگذار`);
  if(ADMIN_PASS && ['noor2024', '12345678', 'password', 'admin123', 'noorestan'].includes(ADMIN_PASS.trim().toLowerCase()))
    console.log('  ⚠️ هشدار      : NOOR_ADMIN_PASS یک رمز حدس‌زدنی است — عوضش کن');
  console.log(`  پیامک (OTP)   : ${smsConfigured()
    ? 'آماده — دستگاه …' + SMS_DEVICE.slice(-4)
    : 'تنظیم نشده — NOOR_SMS_KEY و NOOR_SMS_DEVICE را بگذار'}`);
  console.log(`  فایل داده     : ${DATA_FILE}`);
  console.log(`  ظرفیت روم     : ${LIMITS.roomMembers} بازیکن + ${LIMITS.roomSpectators} تماشاچی`);
  console.log('  ─────────────────────────────────────────');
  console.log('  • برنامه را از آدرس بالا در مرورگر باز کن');
  console.log('  • ورود کاربران با پیامک؛ ورودی مستقل مدیریت: #admin');
  console.log('  • چند دستگاه در یک روم = بازی واقعی گروهی');
  console.log('  برای خروج Ctrl+C');

  /* B19: کاهجِ فشرده‌سازی را بی‌آنکه کسی منتظر بماند گرم کن. */
  try{ warmCompression(); }catch(e){ log('⚠️ گرم‌کردنِ فشرده‌سازی نشد: ' + ((e && e.message) || e)); }
  console.log('');
});

/* خاموشیِ آرام: systemd/Docker سیگنالِ SIGTERM می‌فرستند که پیش‌تر اصلاً
   شنیده نمی‌شد و آخرین تغییرها ذخیره نمی‌شدند. */
let shuttingDown = false;
function shutdown(sig){
  if(shuttingDown) return;
  shuttingDown = true;
  console.log(`\n💾 ${sig} — ذخیره داده‌ها...`);
  for(const cl of [...clients.values()]){
    try{ cl.sock.write(encodeFrame(Buffer.from([0x03, 0xE9]), 0x8)); }catch(_){}
    try{ cl.closeClient && cl.closeClient('خاموشی سرور'); }catch(_){}
  }
  try{ saveData(true); }catch(_){}
  server.close(() => { log('👋 خاموش شد'); process.exit(0); });
  setTimeout(() => process.exit(0), 4000).unref();
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', e => log('❌ خطای پیش‌بینی‌نشده:', e && e.stack || e));
process.on('unhandledRejection', e => log('❌ وعدهٔ ردشده:', e && e.message || e));
