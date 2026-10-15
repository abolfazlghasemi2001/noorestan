// Connection discovery must recover after a transient health failure.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/app/app-1-3bce8fb8d2.js'), 'utf8');
const hostSource = source.slice(source.indexOf('const Host = {'), source.indexOf('\nconst Net = {'));
let healthy = false, calls = 0;
const context = vm.createContext({
  location: { protocol: 'https:', host: 'hoosna1402.ir' },
  SMS: { async req() { calls++; return { ok: healthy, json: { ok: true, service: 'noorestan' } }; } }
});
vm.runInContext(hostSource + '\nglobalThis.host = Host;', context);
(async () => {
  const host = context.host;
  const first = host.ready();
  assert.equal(host.ready(), first, 'parallel health checks share one request');
  assert.equal(await first, false);
  healthy = true;
  assert.equal(await host.ready(), true, 'a failed probe must not be cached forever');
  assert.equal(host.defaultUrl(), 'wss://hoosna1402.ir');
  await host.ready();
  assert.equal(calls, 2, 'successful discovery stays cached');
  await host.ready(true);
  assert.equal(calls, 3, 'manual reconnect checks health again');
  assert.ok(source.includes('Net.connect(Host.defaultUrl() || savedUrl)'), 'same-origin server wins over stale stored address');
  assert.ok(!source.includes('if(savedUrl){ Net.connect(savedUrl); return; }'));
  console.log('Connection regression tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
