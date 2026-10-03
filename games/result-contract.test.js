/* تست قرارداد نتیجهٔ مشترک، بدون وابستگی */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('games/result-contract.js', 'utf8');
const context = { globalThis: {}, Date };
vm.runInNewContext(source, context);
const R = context.globalThis.NoorestanGameResult;

assert.deepEqual(R.normalize({ gameId: 'ayah-builder', score: '41.6', stars: 4, completion: 2, mode: 'weird' }), {
  gameId: 'ayah-builder', score: 42, stars: 3, completion: 1, mode: 'solo', metadata: {}, at: assert.anything
});
assert.throws(() => R.normalize({ score: 3 }), /gameId is required/);
assert.equal(R.legacy({ gameId: 'noor-pairs', title: 'جفت نور', score: 10, stars: 2 }).key, 'noor-pairs');
console.log('game result contract: ok');
