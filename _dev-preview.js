#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   _dev-preview.js — پیش‌نمای محلیِ نورستان برای دیدنِ کاروسل (ابزار توسعه)

   مشکل چه بود؟
     ورود به برنامه فقط با پیامکِ واقعی ممکن است و کدِ پنج‌رقمی هیچ‌جا
     چاپ نمی‌شود. پس در یک پیش‌نمای محلی، کاربر پشتِ دروازه می‌ماند و
     خانه را — یعنی همان‌جا که کاروسل هست — نمی‌بیند.

   این ابزار چه می‌کند؟
     ۱) `server.js` را روی 127.0.0.1 بالا می‌آورد و `NOOR_SMS_ENDPOINT`
        را به یک فرستندهٔ ساختگیِ محلی می‌دهد.
     ۲) همهٔ درخواست‌ها (و ارتقای WebSocket) را از یک پورتِ عمومی روی
        0.0.0.0 به آن سرور پروکسی می‌کند.
     ۳) فقط یک نشانیِ اضافه دارد: `/__code` — کدِ آخرین پیامکِ ساختگی.

   هیچ بخشی از برنامه را تغییر نمی‌دهد: نه `server.js`، نه `index.html`.
   رمزِ مدیر و فرستندهٔ پیامک، هر دو فقط در همین فرآیندِ توسعه هستند.

   اجرا:  node _dev-preview.js [پورت_عمومی]
   ورود:  هر شمارهٔ موبایلی → «ارسال کد» → کد را از `/__code` بردار.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PUB_PORT = +(process.argv[2] || process.env.PORT || 8790);   // 0.0.0.0 — پیش‌نمای کاربر
const APP_PORT = PUB_PORT + 1;                                      // 127.0.0.1 — خودِ برنامه
const SMS_PORT = PUB_PORT + 2;                                      // 127.0.0.1 — فرستندهٔ ساختگی
const ADMIN_PASS = process.env.NOOR_ADMIN_PASS || 'dev-preview-only';
const DATA_FILE = path.join(os.tmpdir(), 'noor-preview-data.json');

/* ── فرستندهٔ پیامکِ ساختگی: کد را نگه می‌دارد، هیچ‌جا نمی‌فرستد ── */
let lastCode = '', lastPhone = '', hits = 0;
const sms = http.createServer((req, res) => {
  if(req.method === 'POST' && req.url.startsWith('/sms')){
    let b = ''; req.on('data', x => b += x);
    req.on('end', () => {
      hits++;
      try{
        const j = JSON.parse(b);
        lastPhone = j.recipients ? String(j.recipients) : '';
        lastCode = (String(j.message || '').match(/\b(\d{5})\b/) || [])[1] || '';
      }catch(e){}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { _id: 'dev-preview', status: 'pending' } }));
    });
    return;
  }
  res.writeHead(404); res.end();
});

const CODE_PAGE = () => `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>کدِ ورودِ پیش‌نما</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080d18;color:#e8eefc;
font-family:Vazirmatn,system-ui,Tahoma,sans-serif}main{text-align:center;padding:24px}
b{display:block;font-size:44px;letter-spacing:8px;color:#f5c451;margin:14px 0;direction:ltr}
small{color:#8fa0c4;line-height:2;display:block}code{color:#f5c451}</style></head><body><main>
<h1 style="font-size:18px">کدِ ورودِ پیش‌نمای محلی</h1>
<b>${lastCode || '— — — — —'}</b>
<small>شماره: <code>${lastPhone || '(هنوز درخواستی نیامده)'}</code><br>
تعدادِ پیامکِ ساختگی: <code>${hits}</code><br>
این صفحه را پس از زدنِ «ارسال کد» در برنامه تازه کن (F5).<br>
هیچ پیامکی واقعاً فرستاده نشده — این فقط ابزارِ توسعه است.</small>
<p><a href="/" style="color:#4d9fff">← بازگشت به برنامه</a></p></main></body></html>`;

/* ── پروکسی: همه‌چیز به برنامه، جز `/__code` ── */
const proxy = http.createServer((req, res) => {
  if(req.url === '/__code' || req.url.startsWith('/__code?')){
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(CODE_PAGE());
  }
  const up = http.request({ host: '127.0.0.1', port: APP_PORT, method: req.method,
                            path: req.url, headers: req.headers }, down => {
    res.writeHead(down.statusCode || 502, down.headers);
    down.pipe(res);
  });
  up.on('error', e => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('سرورِ برنامه پاسخ نداد: ' + e.message);
  });
  req.pipe(up);
});

/* ارتقای WebSocket — محفلِ آنلاین بدون این کار نمی‌کرد */
proxy.on('upgrade', (req, client, head) => {
  const up = net.connect(APP_PORT, '127.0.0.1', () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for(let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(lines.join('\r\n') + '\r\n\r\n');
    if(head && head.length) up.write(head);
    up.pipe(client); client.pipe(up);
  });
  up.on('error', () => client.destroy());
  client.on('error', () => up.destroy());
});

sms.listen(SMS_PORT, '127.0.0.1', () => {
  const app = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(APP_PORT), HOST: '127.0.0.1', NOOR_DATA: DATA_FILE,
           NOOR_ADMIN_PASS: ADMIN_PASS, NOOR_SMS_KEY: 'dev-preview', NOOR_SMS_DEVICE: 'dev-preview',
           NOOR_SMS_ENDPOINT: `http://127.0.0.1:${SMS_PORT}/sms`,
           NOOR_SMS_MAX_IP: '5000', NOOR_SMS_MAX_HOUR: '5000' },
    stdio: ['ignore', 'inherit', 'inherit']
  });
  const stop = () => { try{ app.kill(); }catch(e){} process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  app.on('exit', c => { console.log(`سرورِ برنامه بسته شد (کد ${c})`); process.exit(c || 0); });

  proxy.listen(PUB_PORT, '0.0.0.0', () => {
    console.log(`\n🌟 پیش‌نمای نورستان`);
    console.log(`   برنامه (عمومی) : http://0.0.0.0:${PUB_PORT}   ← همین را باز کن`);
    console.log(`   کدِ ورود       : http://0.0.0.0:${PUB_PORT}/__code`);
    console.log(`   سرورِ داخلی    : 127.0.0.1:${APP_PORT}   (پیامکِ ساختگی: ${SMS_PORT})`);
    console.log(`   داده           : ${DATA_FILE}`);
    console.log(`\n   ورود: هر شمارهٔ موبایلی → «ارسال کد» → کد را از /__code بردار.\n`);
  });
});
