/* تست بدون وابستگی برای رجیستری بازی‌ها */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('games/catalog.js', 'utf8');
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const catalog = context.globalThis.NoorestanGameCatalog;

assert.ok(catalog, 'catalog should be exposed');
assert.equal(catalog.available().length, 3, 'three standalone games are available');
assert.ok(catalog.byId('ayah-builder'));
assert.equal(catalog.filter({ subject: 'آیات و سوره‌ها' }).length, 2);
assert.equal(catalog.filter({ skill: 'حافظه و تمرکز' })[0].id, 'noor-pairs');
assert.equal(catalog.filter({ status: 'embedded' }).length, 3);
assert.equal(new Set(catalog.all.map(game => game.id)).size, catalog.all.length, 'ids must be unique');

console.log('game catalog: ok');
