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
let adminHashCurrent = ADMIN_HASH;
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
      log(`📂 بارگذاری شد: ${leaderboard.length} رکورد، ${Object.keys(friends).length} کاربر با دوست`);
    }
  }catch(e){ log('⚠️ خواندن فایل داده ناموفق:', e.message); }
}

function snapshot(){
  return {
    leaderboard, friends,
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

  /* احراز هویت ادمین.
     دروازه باید صریحاً بسته باشد: اگر adminHashCurrent خالی باشد (یعنی
     NOOR_ADMIN_PASS ست نشده)، مقایسهٔ سادهٔ رشته‌ای هر هشِ خالیِ کلاینت را
     قبول می‌کرد و پنل مدیر برای همه باز می‌شد. */
  if(msg.hash && typeof msg.hash === 'string'){
    c.isAdmin = !!adminHashCurrent && msg.hash === adminHashCurrent;
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
      log(`👤 ${c.name} (${c.id}) وارد شد`);
      sendRaw(c, { t: 'peers', to: c.id, list: peerList(), online: clients.size });
      sendRaw(c, { t: 'rooms', to: c.id, list: roomList() });
      sendRaw(c, { t: 'lb', to: c.id, list: leaderboard.slice(0, 30) });
      sendRaw(c, { t: 'friends', to: c.id, list: friendListFor(c) });
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
      if(!c.isAdmin){ sendRaw(c, { t: 'room:error', to: c.id, msg: 'دسترسی مدیر لازم است' }); return; }
      const title = clampStr(msg.title, 60), desc = clampStr(msg.desc, LIMITS.textLen);
      if(!title || !desc) return;
      log(`📢 اعلان سراسری: ${title}`);
      for(const cl of clients.values()) sendRaw(cl, { t: 'notif', to: cl.id, title, desc, icon: '📢' });
      break;
    }

    case 'admin:room:close': {
      if(!c.isAdmin) return;
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

    case 'admin:stats': {
      if(!c.isAdmin) return;
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

const SMS_LIMIT = {
  perPhoneMs:  10 * 60 * 1000,
  perPhoneMax: 3,
  perIpHour:   20,
  globalHour:  40
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

function smsVerdict(status, ok, j){
  /* ۰ یعنی درخواست به هیچ نتیجه‌ای نرسید */
  if(!status)
    return { state: 'pending', error: 'پاسخی از textbee نیامد (وقت تمام شد یا شبکه)' };

  if(j && typeof j === 'object'){
    const d  = (j.data && typeof j.data === 'object') ? j.data : {};
    const id = j._id || j.messageId || j.id || d._id || d.messageId || d.id || '';
    if(j.success === true || id) return { state: 'sent', id: String(id || '') };
    const why = smsRedact(j.message || j.error || '');
    if(j.success === false || why) return { state: 'failed', error: why || ('HTTP ' + status) };
  }

  /* ۲۰۰ ولی نه نشانهٔ موفقیت و نه شکست ⇒ نمی‌دانیم */
  if(ok) return { state: 'pending', error: 'پاسخ textbee خوانده نشد' };
  /* ۵xx خطای موقت است؛ درخواست ممکن است بعداً پذیرفته شود */
  if(status >= 500) return { state: 'pending', error: 'textbee الان در دسترس نیست (HTTP ' + status + ')' };
  return { state: 'failed', error: smsRedact((j && (j.message || j.error)) || ('HTTP ' + status)) };
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
    const v = smsVerdict(res.status, res.ok, j);
    const ms = Date.now() - t0;
    if(j){
      log(`📡 textbee → HTTP ${res.status} در ${ms}ms · ${v.state}` +
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

  /* ── پیامک ──
     /status هیچ‌وقت کلید را برنمی‌گرداند — فقط «دارم یا نه». */
  if(p === '/api/otp/status'){
    res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8',
                         'Access-Control-Allow-Origin': ALLOW_ORIGIN,
                         'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ configured: smsConfigured(), on: SMS_ON,
                                    device: SMS_DEVICE ? '…' + SMS_DEVICE.slice(-4) : '' }));
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

    let message, kind;
    if(body.test === true){ message = smsTestMessage(); kind = 'آزمایشی'; }
    else {
      const code = digits(body.code).replace(/\D/g, '');
      if(code.length !== 5) return no(400, 'کد پنج‌رقمی لازم است');
      message = smsOtpMessage(code); kind = 'کد تأیید';
    }

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
  console.log(`  رمز مدیر سرور : ${adminHashCurrent
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
