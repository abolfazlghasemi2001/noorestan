/* اجرای کنترل‌های فازهای بازطراحی بازی‌ها
 * اجرا: node tools/run-game-refactor-checks.js
 */
const { spawnSync } = require('node:child_process');
const checks = [
  ['catalog', 'tests/game-catalog.test.js'],
  ['migration', 'tests/game-migration.test.js'],
  ['result contract', 'games/result-contract.test.js'],
  ['result bridge', 'games/result-bridge.test.js']
];
let failed = false;
for (const [name, file] of checks) {
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8' });
  if (r.status !== 0) { failed = true; console.error(`FAIL ${name}\n${r.stderr || r.stdout}`); }
  else console.log(`PASS ${name}`);
}
if (failed) process.exitCode = 1;
