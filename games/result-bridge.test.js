/* قرارداد آداپتور: نتیجهٔ قدیمی باید به مدل جدید برسد */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const contract = fs.readFileSync('games/result-contract.js', 'utf8');
const bridge = fs.readFileSync('games/result-bridge.js', 'utf8');
const calls = [];
const context = { globalThis: {}, Date, G: { result: value => { calls.push(value); return value; } } };
context.globalThis.G = context.G;
vm.runInNewContext(contract, context);
vm.runInNewContext(bridge, context);
context.G.result({ key: 'ayahbuilder_1', game: 'آیه‌ساز', score: 100, stars: 2 });
assert.equal(calls[0].gameId, 'ayah-builder');
assert.equal(calls[0].key, 'ayah-builder');
assert.equal(calls[0].score, 100);
assert.equal(calls[0].stars, 2);
assert.equal(calls[0].mode, 'solo');
assert.equal(context.G.result.__noorestanBridge, true);
console.log('game result bridge: ok');
