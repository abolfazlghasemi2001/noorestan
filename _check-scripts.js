// Syntax-check every shipped script, including external scripts referenced by index.html.
const fs = require('fs');
const cp = require('child_process');
const os = require('os');
const path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noorestan-check-'));
try {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const scripts = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)) {
    const src = m[1];
    if (!/^https?:\/\//i.test(src)) scripts.push(path.join(__dirname, src));
  }
  let count = 0;
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!m[1].trim()) continue;
    const file = path.join(dir, `inline-${++count}.js`);
    fs.writeFileSync(file, m[1]);
    cp.execFileSync(process.execPath, ['--check', file], {stdio:'inherit'});
  }
  for (const file of scripts) {
    cp.execFileSync(process.execPath, ['--check', file], {stdio:'inherit'});
    count++;
  }
  console.log(`${count} shipped script(s): node --check OK`);
} finally { fs.rmSync(dir, {recursive:true, force:true}); }
