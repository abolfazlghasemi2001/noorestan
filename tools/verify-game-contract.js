/* اجرای محلی: node tools/verify-game-contract.js
 * این نگهبان قبل از فعال‌کردن bridge، ترتیب بارگذاری هر بازی را کنترل می‌کند.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const files = ['games/ayah-builder.html', 'games/hadith-rush.html', 'games/noor-pairs.html'];
const required = ['common.js', 'result-contract.js', 'result-bridge.js'];
const errors = [];
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/g)].map(m => m[1]);
  const positions = required.map(name => scripts.indexOf(name));
  if (positions.some(i => i < 0)) errors.push(`${file}: قرارداد مشترک هنوز به صفحه وصل نشده است`);
  else if (!(positions[0] < positions[1] && positions[1] < positions[2])) errors.push(`${file}: ترتیب common.js → result-contract.js → result-bridge.js اشتباه است`);
}
try { assert.deepEqual(errors, []); console.log('game contract loading: ok'); }
catch { console.error(errors.join('\n')); process.exitCode = 1; }
