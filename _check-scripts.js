// Syntax check every inline script without evaluating the application.
const fs = require('fs');
const cp = require('child_process');
const os = require('os');
const path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noorestan-check-'));
try {
  let count = 0;
  for (const m of fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    if (!m[1].trim()) continue;
    const file = path.join(dir, `inline-${++count}.js`);
    fs.writeFileSync(file, m[1]);
    cp.execFileSync(process.execPath, ['--check', file], {stdio:'inherit'});
  }
  console.log(`${count} inline script(s): node --check OK`);
} finally { fs.rmSync(dir, {recursive:true, force:true}); }
