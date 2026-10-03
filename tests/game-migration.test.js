/* پوشش مهاجرت: هر بازی مستقل باید قرارداد قدیمی نتیجه را داشته باشد تا bridge آن را کنترل کند. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const files = [
  ['games/ayah-builder.html', 'ayah-builder'],
  ['games/hadith-rush.html', 'hadith-rush'],
  ['games/noor-pairs.html', 'noor-pairs']
];
for (const [file, id] of files) {
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /G\.result\(\{/);
  assert.match(html, /key:/);
  assert.match(html, /stars:/);
  assert.match(html, new RegExp(id === 'ayah-builder' ? 'ayahbuilder_' : id === 'hadith-rush' ? 'hadithrush' : 'noorpairs_'));
}
const catalog = fs.readFileSync('games/catalog.js', 'utf8');
for (const [, id] of files) assert.match(catalog, new RegExp(id));
console.log('game migration coverage: ok');
