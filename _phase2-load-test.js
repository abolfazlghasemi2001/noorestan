/* Cold front-door comparison against the theme checkpoint before auth/game/payment changes.
   BASELINE_HTML may point to another explicitly identified baseline. No real SMS/PSP calls.
   CDP: 750 kbit/s down, 250 kbit/s up, 150 ms latency, 4x CPU; 3 runs each by default.
   Service workers blocked: this measures page-critical load, NOT PWA installation/precache.
*/
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const baseline=process.env.BASELINE_HTML||'tmp/phase2/security-before/index.html';
if(!fs.existsSync(baseline))throw Error('Provide BASELINE_HTML: original checkpoint HTML is needed.');
const before=fs.readFileSync(baseline),after=fs.readFileSync('index.html'),runs=Number(process.env.RUNS||3),results=[];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://fixture.invalid');let data,ext='.html';
 if(url.pathname==='/before')data=before;else if(url.pathname==='/after')data=after;
 else if(url.pathname.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});return res.end('{}');}
 else{
  const file=path.resolve(__dirname,'.'+url.pathname);if(!file.startsWith(__dirname+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
  data=fs.readFileSync(file);ext=path.extname(file);
 }
 res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-store','Content-Length':data.length});res.end(data);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const BASE='http://127.0.0.1:'+server.address().port;
 const bundle=require('@sparticuz/chromium').default;
 let browser;
 try{for(let run=1;run<=runs;run++)for(const version of ['before','after']){
  browser=await chromium.launch({executablePath:await bundle.executablePath(),args:bundle.args.filter(a=>!a.includes('disable-web-security')),headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
  await page.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:750000/8,uploadThroughput:250000/8});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto(BASE+'/'+version,{waitUntil:'load',timeout:90000});await page.waitForFunction(()=>typeof Gate!=='undefined'&&Gate.shown);await page.waitForTimeout(1000);
  const metric=await page.evaluate(()=>{
   const nav=performance.getEntriesByType('navigation')[0],resources=performance.getEntriesByType('resource'),all=[nav,...resources];
   return {fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,domMs:nav.domContentLoadedEventEnd,loadMs:nav.loadEventEnd,transferBytes:all.reduce((n,r)=>n+r.transferSize,0),bodyBytes:all.reduce((n,r)=>n+r.encodedBodySize,0),requests:all.length,lazyGameOrPayment:resources.filter(r=>/sudoku\.(js|css)|payments-ui\.js/.test(r.name)).map(r=>r.name),resources:all.map(r=>({url:new URL(r.name).pathname,bytes:r.transferSize}))};
  });results.push({version,run,...metric});console.log(version,run,JSON.stringify(metric));await context.close();await browser.close();
 }}finally{if(browser)await browser.close();}
 const median=xs=>xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)],summary={};
 for(const version of ['before','after']){const set=results.filter(r=>r.version===version);summary[version]=Object.fromEntries(['fcpMs','domMs','loadMs','transferBytes','bodyBytes','requests'].map(k=>[k,median(set.map(r=>r[k]))]));}
 const report={baseline,baselineSha256:crypto.createHash('sha256').update(before).digest('hex'),currentSha256:crypto.createHash('sha256').update(after).digest('hex'),conditions:'750 kbit/s down; 250 kbit/s up; 150ms latency; CPU 4x; mobile 390x844; no compression; cold cache; SW blocked',summary,results};
 fs.mkdirSync('tmp/phase2',{recursive:true});fs.writeFileSync('tmp/phase2/load-results.json',JSON.stringify(report,null,2));console.log('SUMMARY',JSON.stringify(summary));
 if(results.some(r=>r.lazyGameOrPayment.length))throw Error('Noncritical games/payment eagerly loaded');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{server.closeAllConnections();server.close();});
