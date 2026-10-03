/* تست قرارداد نتیجهٔ مشترک، بدون وابستگی */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('games/result-contract.js', 'utf8');
const context = { globalThis: {}, Date };
vm.runInNewContext(source, context);
const R = context.globalThis.NoorestanGameResult;

const normalized = R.normalize({ gameId: 'ayah-builder', score: '41.6', stars: 4, completion: 2, mode: 'weird' });
assert.equal(normalized.gameId, 'ayah-builder');
assert.equal(normalized.score, 42);
assert.equal(normalized.stars, 3);
assert.equal(normalized.completion, 1);
assert.equal(normalized.mode, 'solo');
assert.deepEqual(normalized.metadata, {});
assert.ok(normalized.at > 0);
assert.throws(() => R.normalize({ score: 3 }), /gameId is required/);
assert.equal(R.legacy({ gameId: 'noor-pairs', title: 'جفت نور', score: 10, stars: 2 }).key, 'noor-pairs');
console.log('game result contract: ok');
