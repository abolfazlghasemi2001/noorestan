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
const ALLOW_ORIGIN= process.env.NOOR_ORIGIN || '*';
const NS          = 'noorestan';
const VERSION     = '15.0';

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
function clampStr(v, n){ return String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, n); }
function ts(){ return new Date().toTimeString().slice(0, 8); }
function log(...a){ console.log(`[${ts()}]`, ...a); }

/* ─────────────── وضعیت سرور ─────────────── */
const clients = new Map();   // id -> client
const rooms   = new Map();   // code -> room
let leaderboard = [];
let friends     = {};        // نام -> [نام دوستان]  (تنها هویت پایدار کاربر، نام اوست)
let pendingFriends = new Map();  // fromId -> {toId, at}
let stats = { startedAt: now(), totalConnections: 0, totalMessages: 0, totalGames: 0, peakOnline: 0 };

/* ─────────────── ذخیره‌سازی ─────────────── */
function loadData(){
  try{
    if(fs.existsSync(DATA_FILE)){
      const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if(Array.isArray(d.leaderboard)) leaderboard = d.leaderboard;
      if(d.friends && typeof d.friends === 'object') friends = d.friends;
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
    stats: { totalConnections: stats.totalConnections, totalMessages: stats.totalMessages,
             totalGames: stats.totalGames, peakOnline: stats.peakOnline }
  };
}

let saveTimer = null;
function saveData(immediate){
  if(immediate){
    if(saveTimer){ clearTimeout(saveTimer); saveTimer = null; }
    try{ fs.writeFileSync(DATA_FILE, JSON.stringify(snapshot(), null, 2)); }
    catch(e){ log('⚠️ ذخیره ناموفق:', e.message); }
    return;
  }
  if(saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try{ fs.writeFileSync(DATA_FILE, JSON.stringify(snapshot(), null, 2)); }
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
    frames.push({ fin, opcode, payload });
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

function sendRaw(c, env){
  if(!c || c.sock.destroyed || !c.ready) return;
  const payload = JSON.stringify(envelope(env));
  if(payload.length > LIMITS.msgBytes){ log('⚠️ پیام بزرگ حذف شد'); return; }
  try{ c.sock.write(encodeFrame(payload)); }catch(e){ /* سوکت مرده */ }
}

function sendTo(id, env){ sendRaw(clients.get(id), env); }

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
  for(const c of clients.values()) if(!c.room) sendRaw(c, env);
}
function sendLobbyExcept(exceptId, env){
  for(const c of clients.values()) if(!c.room && c.id !== exceptId) sendRaw(c, env);
}

/* ─────────────── حضور ─────────────── */
function peerList(){
  return [...clients.values()].map(c => ({
    id: c.id, name: c.name, level: c.level, score: c.score,
    room: c.room || null, spectator: !!c.spectator, since: c.since
  }));
}
function pushPeers(){
  const list = peerList();
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
    r.state = null;
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
function linkFriends(a, b){
  if(!a || !b || a === b) return;
  for(const [x, y] of [[a, b], [b, a]]){
    if(!Array.isArray(friends[x])) friends[x] = [];
    if(!friends[x].includes(y)) friends[x].unshift(y);
    friends[x] = friends[x].slice(0, LIMITS.friendsPerUser);
  }
  saveData();
}

function friendListFor(c){
  const names = friends[c.name] || [];
  const onlineByName = new Map([...clients.values()].map(x => [x.name, x]));
  return names.map(n => {
    const on = onlineByName.get(n);
    return { name: n, online: !!on, id: on ? on.id : null, level: on ? on.level : null, score: on ? on.score : null };
  });
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

  /* گیرندهٔ مستقیم — برای پیام‌های نقطه‌به‌نقطه (دوستی و مذاکرهٔ صوتی) */
  const direct = (msg.to && msg.to !== '*' && !String(msg.to).startsWith('room:'))
    ? clients.get(String(msg.to)) : null;

  switch(msg.t){
    case 'hello': {
      c.name = clampStr(msg.name, LIMITS.nameLen) || 'بازیکن';
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
          /* نام و امتیازِ اعلامی با کارنامهٔ ثبت‌شده هم‌تراز می‌شود. */
          c.name = rec.name || c.name;
          rec.plays = Math.max(rec.plays || 0, 0);
          rec.lastLogin = now();
          saveData();
          c.name = clampStr(c.name, LIMITS.nameLen) || 'بازیکن';
        }else if(rec && rec.blocked){
          /* مسدود: با خبر می‌فرستیمش بیرون. بی صدا قطع نمی‌کنیم تا کاربر
             بداند چرا و بیهوده تلاش نکند. */
          sendRaw(c, { t: 'notif', to: c.id, title: 'دسترسی بسته است',
                       desc: 'این شماره مسدود شده — با مدیر تماس بگیر', icon: '🚫' });
          log(`🚫 کاربرِ مسدود رد شد (${rec.id})`);
          Timers_sleep_close(c);
          return;
        }
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
      const full = playersOf(r).length >= LIMITS.roomMembers;
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
      r.state = null;
      roomUpdate(r);
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
      pushRooms();
      break;
    }

    case 'room:leave':
      leaveRoom(c, false);
      break;

    case 'room:start': {
      const r = rooms.get(c.room);
      if(!r || r.hostId !== c.id) return;                       // فقط میزبان
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
      const text = clampStr(msg.text, LIMITS.chatLen);
      if(!text) return;
      if(c.room) sendRoom(c.room, { t: 'chat', to: 'room:' + c.room, from: c.id, name: c.name, text });
      else sendLobby({ t: 'chat', to: '*', from: c.id, name: c.name, text });
      break;
    }

    /* ── نسخهٔ ۱۵: «در حال نوشتن…» ── */
    case 'typing': {
      const env = { t: 'typing', from: c.id, name: c.name };
      if(c.room) sendRoomExcept(c.room, c.id, { ...env, to: 'room:' + c.room });
      else sendLobbyExcept(c.id, env);
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
      pendingFriends.set(c.id, { toId: target.id, at: now() });
      sendTo(target.id, { t: 'friend:req', from: c.id, name: c.name });
      break;
    }
    case 'friend:ok': {
      const target = direct;
      if(!target) return;
      const p = pendingFriends.get(target.id);
      if(p && p.toId === c.id) pendingFriends.delete(target.id);
      linkFriends(c.name, target.name);
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
      const name = clampStr(msg.name, LIMITS.nameLen) || c.name;
      const score = Math.max(0, Math.min(1e9, +msg.score || 0));
      const ex = leaderboard.find(l => l.name === name);
      if(ex) { ex.score = Math.max(ex.score, score); ex.at = now(); }
      else leaderboard.push({ name, score, at: now() });
      leaderboard.sort((a, b) => b.score - a.score);
      leaderboard = leaderboard.slice(0, 30);
      saveData();
      for(const cl of clients.values()) sendRaw(cl, { t: 'lb', to: cl.id, list: leaderboard });
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
function smsAllow(phone, ip){
  const t = now();
  const ph = smsPrune(smsByPhone.get(phone) || [], SMS_LIMIT.perPhoneMs);
  if(ph.length >= SMS_LIMIT.perPhoneMax) return { ok: false, why: 'به این شماره تازه چند پیامک رفته — کمی بعد امتحان کن' };
  const ia = smsPrune(smsByIp.get(ip) || [], 3600000);
  if(ia.length >= SMS_LIMIT.perIpHour) return { ok: false, why: 'از این نشانی درخواست زیاد آمده' };
  smsGlobal = smsPrune(smsGlobal, 3600000);
  if(smsGlobal.length >= SMS_LIMIT.globalHour) return { ok: false, why: 'سقف ساعتی پیامک سرور پر شد' };
  ph.push(t); ia.push(t); smsGlobal.push(t);
  smsByPhone.set(phone, ph); smsByIp.set(ip, ia);
  return { ok: true };
}

/* همان متن‌هایی که در کلاینت هم هست. تک‌منبع نیستند (سرور و کلاینت جدا
   اجرا می‌شوند) ولی هر دو ثابت‌اند و آزمون دارند. */
function smsOtpMessage(code){
  return '🌟 نورستان\n' +
         '🔐 کد تأیید ثبت‌نام شما: ' + code + '\n' +
         '⏱ اعتبار: ۲ دقیقه\n' +
         '⚠️ این کد را با کسی به اشتراک نگذارید.';
}
function smsTestMessage(){
  return '🌟 نورستان\n✅ آزمایش اتصال پیامک با موفقیت انجام شد.';
}
/* پیامکِ خوش‌آمدگویی — یک بار برای هر شماره، پس از نخستین ورودِ موفق.
   متن مستقیم است، نه الگو (pattern)؛ الگو در تنظیماتِ textbee ساخته
   می‌شود و متنِ پویا (شناسهٔ کاربر) را پشتیبانی نمی‌کند. */
function smsWelcomeMessage(userId){
  return '🌟 به نورستان خوش آمدید\n' +
         '📱 شناسه شما: ' + userId + '\n' +
         '🎯 ۱۵ بازی و حفظ قرآن در انتظار شماست\n' +
         '🚀 از همین امروز شروع کنید\n' +
         'نورستان';
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
  return new Promise(resolve => {
    let n = 0, buf = '';
    req.on('data', c => {
      n += c.length;
      if(n > max){ try{ req.destroy(); }catch(e){} resolve(null); return; }
      buf += c;
    });
    req.on('end', () => { try{ resolve(buf ? JSON.parse(buf) : {}); }catch(e){ resolve(null); } });
    req.on('error', () => resolve(null));
  });
}
function clientIp(req){
  return (req.socket && req.socket.remoteAddress) || '?';
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
const OTP_LEN      = 5;
const OTP_SWEEP_MS = 60 * 1000;
const USER_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;   // نشانهٔ کاربر: ۳۰ روز

const otps       = new Map();   // phone -> { hash, salt, exp, tries, at }
const verifyByIp = new Map();   // ip -> [at, …]
const userByPhone = new Map();  // phone -> record
const userById    = new Map();  // id -> phone
const userTokens  = new Map();  // token -> { id, exp, at }

/* کد پنج‌رقمی از مولدِ رمزنگاری‌شده. `randomInt` بازهٔ [0, n) را یکنواخت
   می‌دهد؛ باقی‌ماندهٔ ساده توزیع را کج می‌کرد و حدس‌زدن را آسان‌تر. */
function otpCode(){ return String(crypto.randomInt(10000, 100000)); }
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
function verifyAllow(ip){
  const t = now();
  const list = (verifyByIp.get(ip) || []).filter(x => t - x < 60 * 60 * 1000);
  verifyByIp.set(ip, list);
  if(list.length >= 30) return { ok: false, why: 'تلاشِ زیاد برای بررسیِ کد — یک ساعت دیگر' };
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
    rec = { id: USER_ID_RE.test(id) ? id : 'usr_' + crypto.randomBytes(10).toString('hex').slice(0, 20),
            phone, name: 'بازیکن', joinedAt: t, lastLogin: 0, visits: 0,
            plays: 0, score: 0, level: 1, blocked: false, lastIp: '', ips: [],
            welcomed: false, welcomedAt: 0, welcomeTries: 0 };
    userByPhone.set(phone, rec);
  }else if(USER_ID_RE.test(id) && rec.id !== id){
    /* شناسهٔ تازه از همان شماره: دستهٔ قدیمی رها و تازه ثبت می‌شود. دو
       شناسه برای یک شماره نگه نمی‌داریم، وگرنه «حذف کاربر» یکی را جا
       می‌گذاشت. */
    userById.delete(rec.id);
    rec.id = id;
  }
  userById.set(rec.id, phone);
  rec.lastLogin = t;
  rec.visits = (rec.visits || 0) + 1;
  if(ip && rec.lastIp !== ip){
    rec.lastIp = ip;
    rec.ips = [ip, ...(rec.ips || []).filter(x => x !== ip)].slice(0, 5);
  }
  saveData();
  return rec;
}

function userTokenNew(id, phone){
  const token = crypto.randomBytes(32).toString('hex');
  userTokens.set(token, { id, phone, exp: now() + USER_TOKEN_MS, at: now() });
  /* سقفِ ساده: قدیمی‌ترین‌ها می‌روند. بی سقف، نگاشت تا ابد رشد می‌کرد. */
  if(userTokens.size > 500){
    const list = [...userTokens.entries()].sort((a, b) => a[1].at - b[1].at);
    for(let i = 0; i < 100 && i < list.length; i++) userTokens.delete(list[i][0]);
  }
  return token;
}
function userTokenGet(token){
  if(typeof token !== 'string' || token.length !== 64) return null;
  const s = userTokens.get(token);
  if(!s) return null;
  if(now() > s.exp){ userTokens.delete(token); return null; }
  return s;
}
/* حذفِ کاربر: هم از شماره، هم از شناسه، هم نشست‌هایش. */
function userDrop(rec){
  if(!rec) return false;
  userByPhone.delete(rec.phone);
  userById.delete(rec.id);
  for(const [tok, s] of userTokens) if(s.phone === rec.phone) userTokens.delete(tok);
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
  rec.welcomeTries = (rec.welcomeTries || 0) + 1;
  saveData();
  let out;
  try{ out = await smsSend(rec.phone, smsWelcomeMessage(rec.id)); }
  catch(e){ out = { state: 'failed', error: smsRedact(e && e.message) }; }
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
  let n = 0;
  for(const [tok, s] of userTokens) if(s.phone === rec.phone){ userTokens.delete(tok); n++; }
  userDrop(rec);
  /* کاربرِ آنلاین هم قطع می‌شود. */
  for(const cl of clients.values()) if(cl.phone === rec.phone) cl.closeClient('حساب حذف شد');
  return n;
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
  const list = (adminTries.get(ip) || []).filter(x => t - x < ADMIN_TRY_MS);
  adminTries.set(ip, list);
  if(list.length >= ADMIN_MAX_TRIES)
    return { ok: false, why: `تلاشِ زیاد — ${Math.ceil((ADMIN_TRY_MS - (t - list[0])) / 60000)} دقیقه دیگر` };
  list.push(t);
  return { ok: true };
}
function adminForget(ip){ adminTries.delete(ip); }

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
const isAdminNow = c => !!c && !!c.isAdmin && now() < (c.adminExp || 0);

function adminPruneSessions(){
  const t = now();
  let n = 0;
  for(const [tok, s] of adminSessions) if(t > s.exp){ adminSessions.delete(tok); n++; }
  return n;
}

/* ─────────────── هندلر upgrade ─────────────── */
const server = http.createServer(handleHttp);

server.on('upgrade', (req, sock) => {
  const origin = req.headers.origin;
  if(ALLOW_ORIGIN !== '*' && origin && origin !== ALLOW_ORIGIN){
    sock.write('HTTP/1.1 403 Forbidden\r\n\r\n'); sock.destroy(); return;
  }
  const key = req.headers['sec-websocket-key'];
  if(req.headers.upgrade?.toLowerCase() !== 'websocket' || !key){
    sock.write('HTTP/1.1 400 Bad Request\r\n\r\n'); sock.destroy(); return;
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
    id, sock, name: 'بازیکن', level: 1, score: 0,
    room: null, spectator: false, ready: true, known: false, isAdmin: false,
    since: now(), lastSeen: now(), stamps: [], roomsMade: 0
  };
  clients.set(c.id, c);
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
      if(f.opcode === 0x8){ closeClient('کلاینت بست'); return; }
      if(f.opcode === 0x9){ try{ sock.write(encodeFrame(f.payload, 0xA)); }catch(e){} continue; }
      if(f.opcode === 0xA){ c.lastSeen = now(); continue; }
      if(f.opcode !== 0x1) continue;             // فقط متن
      const text = f.payload.toString('utf8');
      if(text.length > LIMITS.msgBytes){ c.sock.destroy(); return; }
      let msg;
      try{ msg = JSON.parse(text); }catch(e){ continue; }
      if(msg.ns !== NS) continue;                            // فقط پیام‌های همین برنامه
      handleMessage(c, msg);
    }
  });

  let closed = false;
  const closeClient = (why) => {
    if(closed) return;                       // فقط یک‌بار
    closed = true;
    log(`👋 خروج ${c.name} (${c.id}) — ${why}`);
    leaveRoom(c, true);
    clients.delete(c.id);
    pendingFriends.delete(c.id);
    try{ sock.destroy(); }catch(e){}
    pushPeers(); pushRooms();
  };
  c.closeClient = closeClient;

  sock.on('error', () => closeClient('خطای سوکت'));
  sock.on('close', () => closeClient('اتصال بسته شد'));
});

/* ─────────────── HTTP ─────────────── */
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

async function handleHttp(req, res){
  const u = new URL(req.url, 'http://x');
  const p = decodeURIComponent(u.pathname);

  /* پیش‌پرواز CORS. برنامه معمولاً هم‌خاستگاه است و پیش‌پرواز نمی‌فرستد،
     ولی اگر از file:// یا نشانی دیگری باز شود، همین جواب می‌دهد. */
  if(req.method === 'OPTIONS' && p.startsWith('/api/')){
    res.writeHead(204, { 'Access-Control-Allow-Origin': ALLOW_ORIGIN,
                         'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                         'Access-Control-Allow-Headers': 'Content-Type',
                         'Access-Control-Max-Age': '600' });
    return res.end();
  }

  if(p === '/health' || p === '/api/health'){
    res.writeHead(200, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin': ALLOW_ORIGIN });
    return res.end(JSON.stringify({ ok: true, ...serverStats() }));
  }
  if(p === '/api/leaderboard'){
    res.writeHead(200, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin': ALLOW_ORIGIN });
    return res.end(JSON.stringify(leaderboard));
  }
  if(p === '/api/rooms'){
    res.writeHead(200, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin': ALLOW_ORIGIN });
    return res.end(JSON.stringify({ rooms: roomList(), maxPlayers: LIMITS.roomMembers,
                                    maxSpectators: LIMITS.roomSpectators }));
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

    if(p === '/api/admin/login'){
      const body = await readJson(req, 1024);
      if(!body) return no(400, 'بدنهٔ درخواست خوانده نشد');
      const pass = String(body.pass || '');
      /* پیش از بررسیِ رمز، سقفِ تلاش. وگرنه همین مسیر می‌شد درِ حدس‌زدن.
         رمزِ بد هم شکلِ پاسخش با رمزِ درست یکی نیست ولی زمانش یکی است. */
      const lim = adminAllow(ip);
      if(!lim.ok){ log(`🚫 ورودِ مدیر رد شد (${ip}): ${lim.why}`); return no(429, lim.why); }
      if(!sameHash(sha256Hex(pass), ADMIN_HASH)){
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
    if(!lim.ok){ log(`🚫 پیامک رد شد (${phone}): ${lim.why}`); return no(429, lim.why); }

    const code = otpCode();
    const salt = otpSalt();
    otps.set(phone, { hash: otpHash(code, salt), salt, exp: now() + OTP_TTL_MS,
                      tries: 0, at: now() });

    const out = await smsSend(phone, smsOtpMessage(code));
    const stamp = out.state === 'sent' ? '📨' : out.state === 'pending' ? '⏳' : '⚠️';
    /* شماره در لاگ می‌ماند (برای پیگیری)، ولی خودِ کد هرگز — نه اینجا، نه در
       هیچ لاگ دیگری. */
    log(`${stamp} کد تأیید → ${phone} · ${out.state}` +
        (out.state === 'sent' ? (out.id ? ' · ' + out.id : '') : ' — ' + out.error));

    /* ارسال نشد ⇒ کد هم نباید بماند. وگرنه کدی در حافظه می‌ماند که کاربر
       نگرفته و کسی هم نمی‌داند. */
    if(out.state === 'failed'){ otps.delete(phone); return no(502, out.error); }

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
    const lim = verifyAllow(ip);
    if(!lim.ok){ log(`🚫 بررسیِ کد رد شد (${ip}): ${lim.why}`); return no(429, lim.why); }

    /* شکلِ کد پیش از نگاه به حالت سنجیده می‌شود: پرسشی که از پیش غلط است
       نباید به ما بگوید برای این شماره کدی هست یا نه. */
    const code = digits(body.code).replace(/\D/g, '');
    if(code.length !== OTP_LEN) return no(400, `کد ${OTP_LEN} رقمی است`);

    const st = otpGet(phone);
    if(!st) return no(410, 'کد منقضی شد — کد تازه بگیر', { expired: true });

    /* نمکِ رکورد عوض نمی‌شود تا سنجش معنادار بماند */
    const okCode = sameHash(otpHash(code, st.salt), st.hash);
    if(!okCode){
      st.tries = (st.tries || 0) + 1;
      if(st.tries >= OTP_MAX_TRIES){
        otps.delete(phone);
        log(`🚫 کدِ تأیید سه بار اشتباه (${phone}) — کد سوخت`);
        return no(429, 'سه بار اشتباه — کد سوخت، کد تازه بگیر', { burned: true });
      }
      log(`⚠️ کدِ تأیید اشتباه (${phone}) — ${OTP_MAX_TRIES - st.tries} تلاش مانده`);
      return no(401, `کد اشتباه است — ${OTP_MAX_TRIES - st.tries} تلاش مانده`,
                { left: OTP_MAX_TRIES - st.tries });
    }

    /* درست بود: کد سوخت، کاربر به شماره بسته شد، نشست صادر شد. */
    otps.delete(phone);
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
    const sayHi = !rec.welcomed;
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
    if(!lim.ok){ log(`🚫 پیامک رد شد (${phone}): ${lim.why}`); return no(429, lim.why); }

    const out = await smsSend(phone, message);
    const stamp = out.state === 'sent' ? '📨' : out.state === 'pending' ? '⏳' : '⚠️';
    log(`${stamp} پیامک ${kind} → ${phone} · ${out.state}` +
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
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream',
                       'Cache-Control': fresh ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(full).pipe(res);
}

/* ─────────────── حلقه‌های دوره‌ای ─────────────── */
setInterval(() => {
  const t = now();
  let changed = false;
  for(const [id, c] of clients){
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

setInterval(() => { if(clients.size) pushPeers(); }, 5000);
setInterval(() => { if(clients.size) pushRooms(); }, 12000);
setInterval(saveData, 30000);
/* نشست‌های منقضی هر دقیقه پاک می‌شوند. `adminAlive` خودش هم منقضی را
   دور می‌ریزد، ولی نشستی که دیگر پرسیده نمی‌شود تا ابد در حافظه می‌ماند. */
setInterval(() => {
  /* کدهای منقضی و بی‌مصرف پاک می‌شوند؛ نگه‌داشتنشان نه فایده‌ای دارد و نه
     ایمن است. */
  const t = now();
  for(const [ph, st] of otps) if(t > st.exp) otps.delete(ph);
  for(const [tok, st] of userTokens) if(t > st.exp) userTokens.delete(tok);
  const n = adminPruneSessions();
  if(n) log(`🔒 ${n} نشستِ منقضیِ مدیر پاک شد`);
  /* سابقهٔ تلاشِ آدرس‌هایی که دیگر نمی‌آیند هم پاک می‌شود؛ وگرنه نگاشت
     به‌ازای هر آدرسِ دیده‌شده یک ردیف نگه می‌داشت. */
  for(const [ip, list] of adminTries){
    const live = list.filter(x => t - x < ADMIN_TRY_MS);
    if(live.length) adminTries.set(ip, live); else adminTries.delete(ip);
  }
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
  console.log('  🌟  نورستان ۱۵ — سرور محفل');
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
  console.log('  • در صفحه «محفل» آدرس ws://... بالا را وارد کن');
  console.log('  • چند دستگاه در یک روم = بازی واقعی گروهی');
  console.log('  برای خروج Ctrl+C');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n💾 ذخیره داده‌ها...');
  saveData(true);
  log('👋 خاموش شد');
  process.exit(0);
});
process.on('uncaughtException', e => log('❌ خطای پیش‌بینی‌نشده:', e.message));
