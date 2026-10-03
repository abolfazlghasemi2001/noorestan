/* اجرای محلی: node tools/verify-game-contract.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const files = ['games/ayah-builder.html', 'games/hadith-rush.html', 'games/noor-pairs.html'];
const errors = [];
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/g)].map(m => m[1]);
  const common = scripts.indexOf('common.js');
  const loader = scripts.indexOf('contract-loader.js');
  if (common < 0 || loader < 0 || common > loader) errors.push(`${file}: باید common.js پیش از contract-loader.js بیاید`);
}
assert.deepEqual(errors, [], errors.join('\n'));
console.log('game contract activation: ready');
