/* Phase 2 real HTTP/WebSocket tests with a FAKE SMS provider. No real SMS/payment.
   node _phase2-integration-tests.js
   BROWSER=1 adds actual UI login/migration/role-boundary checks (Playwright/Chromium).
*/
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const PORT=Number(process.env.TEST_PORT||8899),BASE=`http://127.0.0.1:${PORT}`,PASS='test-only-management-password';
const sockets=[],hits=[];let child,browser,checks=0;
function ok(name,condition=true){assert(condition,name);checks++;console.log('PASS',name);}
async function api(route,body){const r=await fetch(BASE+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
function smsCode(phone){return hits.filter(h=>h.recipients?.includes(phone)&&/\d{5}/.test(h.message)).at(-1)?.message.match(/\b\d{5}\b/)?.[0];}
async function login(n){const phone='0912000'+String(n).padStart(4,'0');let r=await api('/api/otp/request',{phone});assert(r.body.success);assert(!JSON.stringify(r.body).includes(smsCode(phone)));r=await api('/api/otp/verify',{phone,code:smsCode(phone),userId:'usr_'+'f'.repeat(20)});assert(r.body.success);return {...r.body,phone};}
async function socket(auth,admin=false){
 const ws=new WebSocket(`ws://127.0.0.1:${PORT}`);sockets.push(ws);const queue=[],waiters=[];
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);queue.push(m);for(const w of [...waiters])if(w.pred(m)){clearTimeout(w.timer);waiters.splice(waiters.indexOf(w),1);w.resolve(m);}});
 const take=(pred,ms=3000)=>{const m=queue.find(pred);if(m)return Promise.resolve(m);return new Promise((resolve,reject)=>{const w={pred,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('message timeout '+pred));},ms)};waiters.push(w);});};
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 const welcome=await take(m=>m.t==='welcome');
 const send=m=>ws.send(JSON.stringify({ns:'noorestan',from:welcome.id,...m}));
 const c={ws,queue,take,send,id:welcome.id,clear(){queue.length=0;}};
 if(auth){send({t:'hello',name:'آزمون',...(admin?{adminToken:auth}:{userToken:auth})});await take(m=>m.t==='authenticated');}
 return c;
}
const fake=http.createServer((req,res)=>{let b='';req.on('data',x=>b+=x);req.on('end',()=>{hits.push(JSON.parse(b));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true,data:{_id:'fake-sms',status:'pending'}}));});});
(async()=>{
 fs.mkdirSync('tmp/phase2',{recursive:true});await new Promise(r=>fake.listen(0,'127.0.0.1',r));
 child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',NOOR_DATA:path.join(__dirname,'tmp/phase2/integration-'+Date.now()+'.json'),NOOR_ADMIN_PASS:PASS,NOOR_SMS_KEY:'fake-test-key',NOOR_SMS_DEVICE:'fake-device',NOOR_SMS_ENDPOINT:`http://127.0.0.1:${fake.address().port}/sms`,NOOR_SMS_MAX_IP:'500',NOOR_SMS_MAX_HOUR:'1000'}});
 let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('server did not start: '+logs)),8000);child.stdout.on('data',()=>{if(logs.includes('برای خروج')){clearTimeout(t);resolve();}});child.on('exit',()=>{clearTimeout(t);reject(Error(logs));});});
 const unauthorized=await socket();unauthorized.send({t:'room:create',name:'unauthenticated'});await unauthorized.take(m=>m.t==='auth:error');ok('unauthenticated WebSocket cannot create rooms');
 const users=[];for(let i=1;i<=11;i++)users.push(await login(i));
 ok('SMS API never returns the code; codes verified through fake provider');
 ok('server creates distinct stable IDs despite identical claimed IDs',new Set(users.map(u=>u.id)).size===11&&users.every(u=>u.id!=='usr_'+'f'.repeat(20)));
 let r=await api('/api/account/me',{token:users[0].token});ok('server validates regular account',r.body.id===users[0].id);
 r=await api('/api/account/me',{token:'0'.repeat(64)});ok('forged token rejected',r.status===401);
 r=await api('/api/payments/account',{token:'0'.repeat(64)});ok('payment account rejects forged credentials',r.status===401);
 r=await api('/api/payments/create',{token:users[0].token,pack:'coins250',coins:999999,mode:'sandbox'});ok('client payload cannot enable server-disabled payments',r.status===400);
 const adm=await api('/api/admin/login',{pass:PASS});assert(adm.body.success);
 r=await api('/api/admin/whoami',{token:users[0].token});ok('user token is not admin authority',!r.body.admin);
 r=await api('/api/account/me',{token:adm.body.token});ok('admin token is not user authority',r.status===401);
 const mixed=await socket(users[0].token);mixed.send({t:'hello',adminToken:adm.body.token});await mixed.take(m=>m.t==='auth:error');ok('regular socket cannot upgrade its role via a second hello');
 const a=await socket(users[0].token),b=await socket(users[1].token),c=await socket(users[2].token);
 a.send({t:'admin:users',token:adm.body.token});await a.take(m=>m.t==='room:error');ok('user connection cannot change role via an admin message');
 const admin=await socket(adm.body.token,true);admin.send({t:'room:create'});await admin.take(m=>m.t==='room:error');ok('admin connection cannot play as a regular user');
 a.clear();a.send({t:'room:create',game:'dooz',name:'آزمون قطع اتصال'});const room=(await a.take(m=>m.t==='room:joined')).code;
 b.send({t:'room:join',code:room});await b.take(m=>m.t==='room:joined');a.send({t:'room:start'});await a.take(m=>m.t==='game'&&m.phase==='start');
 b.clear();b.send({t:'room:start'});await b.take(m=>m.t==='room:error');ok('non-host cannot restart a server round');
 a.send({t:'room:game',index:0});await a.take(m=>m.t==='game'&&m.state?.board[0]==='X');
 c.send({t:'room:join',code:room});const joined=await c.take(m=>m.t==='room:joined');const snap=await c.take(m=>m.t==='game');
 ok('late join is a spectator and preserves the started board',joined.spectator&&snap.state.board[0]==='X');
 c.clear();c.send({t:'chat',text:'سلام از تماشاچی'});await b.take(m=>m.t==='chat'&&m.text==='سلام از تماشاچی');ok('spectator chat reaches room');
 c.send({t:'room:leave'});await c.take(m=>m.t==='room:left');b.clear();b.send({t:'room:game',index:1});const move=await b.take(m=>m.t==='game'&&m.state?.board[1]==='O');ok('spectator departure does not reset active game',move.state.board[0]==='X');
 b.clear();a.ws.close();await b.take(m=>m.t==='game:cancelled');const heir=await b.take(m=>m.t==='room:update'&&m.host===b.id);ok('host disconnect cancels current round and transfers host',!!heir);
 b.send({t:'room:leave'});await b.take(m=>m.t==='room:left');
 const lobby=[];for(let i=1;i<11;i++)lobby.push(await socket(users[i].token));
 lobby[0].send({t:'room:create',game:'esmfamil'});const code=(await lobby[0].take(m=>m.t==='room:joined')).code;
 for(let i=1;i<7;i++){lobby[i].send({t:'room:join',code});await lobby[i].take(m=>m.t==='room:joined');}
 lobby[7].send({t:'room:join',code});lobby[8].send({t:'room:join',code});
 const races=await Promise.all([lobby[7],lobby[8]].map(x=>x.take(m=>m.t==='room:joined')));
 ok('concurrent last-slot joins: exactly one player and one spectator',races.filter(x=>!x.spectator).length===1&&races.filter(x=>x.spectator).length===1);
 for(const route of ['/server.js','/payments.js','/.git/HEAD','/tmp/phase2/index.before.html','/noorestan-data.json','/_tests.js'])ok('private static path blocked: '+route,(await fetch(BASE+route)).status===404);
 lobby[0].clear();lobby[0].send({t:'room:start'});await lobby[0].take(m=>m.t==='game'&&m.phase==='round');lobby[0].clear();lobby[2].ws.close();await lobby[0].take(m=>m.t==='game:cancelled');ok('non-host mid-round disconnect cancels round');
 admin.clear();admin.send({t:'admin:user:block',id:users[9].id,token:adm.body.token});await admin.take(m=>m.t==='admin:users');r=await api('/api/account/me',{token:users[9].token});ok('blocked user token rejected immediately',r.status===401);
 admin.clear();admin.send({t:'admin:user:delete',id:users[10].id,token:adm.body.token});await admin.take(m=>m.t==='admin:users');r=await api('/api/account/me',{token:users[10].token});ok('deleted user token revoked',r.status===401);
 const badPhone='09120000990';await api('/api/otp/request',{phone:badPhone});const actual=smsCode(badPhone),wrong=actual==='11111'?'22222':'11111';for(let i=0;i<3;i++)r=await api('/api/otp/verify',{phone:badPhone,code:wrong});ok('three wrong OTP attempts burn the code',r.status===429&&r.body.burned);r=await api('/api/otp/verify',{phone:badPhone,code:actual});ok('burned code cannot be reused',r.status===410);
 r=await api('/api/account/logout',{token:users[2].token});assert(r.body.success);r=await api('/api/account/me',{token:users[2].token});ok('logout revokes token on server',r.status===401);
 await api('/api/admin/login',{pass:'wrong-password'});r=await api('/api/admin/login',{pass:PASS});ok('server enforces failed-login backoff',r.status===429);
 if(process.env.BROWSER==='1'){
  const {chromium}=require('playwright'),bundle=require('@sparticuz/chromium').default;
  browser=await chromium.launch({executablePath:await bundle.executablePath(),args:bundle.args.filter(x=>!x.includes('disable-web-security')),headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER ERROR',e.message);});
  await page.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());
  await page.addInitScript(()=>{if(window.top===window&&!localStorage.getItem('phase2-fixture')){localStorage.setItem('phase2-fixture','1');localStorage.setItem('noorestan_v14',JSON.stringify({_v:15,gate:'guest',xp:180,score:230,badges:{first:true},stats:{plays:4},settings:{onboarded:true}}));}});
  await page.goto(BASE);await page.evaluate(()=>Splash.hide(true));await page.waitForSelector('#gtPhone');
  ok('no guest button; guest migration warning and export available',await page.locator('#gtExport').count()===1&&await page.locator('#gtGuest').count()===0);
  await page.locator('#gtPhone').fill('09129999999');await page.locator('#gtSend').click();await page.waitForSelector('#gtCode');
  await page.locator('#gtCode').fill(smsCode('09129999999'));await page.locator('#gtOk').click();await page.waitForFunction(()=>Session.user());
  ok('full SMS UI flow preserves guest XP and badges',await page.evaluate(()=>Store.get('xp')===180&&Store.get('badges').first&&Store.get('guestMigration').claimed));
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));
  ok('Sudoku/payment UI are not loaded on initial entry',!resources.some(u=>/sudoku\.(js|css)|payments-ui\.js/.test(u)));
  await page.evaluate(()=>{Store.set('vip',true);Store.set('paidBalance',999999);});
  const paid=await page.evaluate(()=>PaidAccount.refresh());ok('localStorage VIP/balance tampering grants no paid authority',paid.balance===0&&Object.keys(paid.items).length===0);
  await page.evaluate(()=>Games.sudoku());await page.waitForSelector('[data-sudoku-level="easy"]');await page.click('[data-sudoku-level="easy"]');
  await page.waitForSelector('.sudoku-grid');ok('Sudoku renders 81 cells',await page.locator('[data-cell]').count()===81);
  await page.setViewportSize({width:390,height:1100});await page.evaluate(()=>document.querySelector('#toasts').innerHTML='');await page.screenshot({path:'screenshots/phase2-sudoku.png',animations:'disabled'});await page.setViewportSize({width:390,height:844});
  const cell=await page.evaluate(()=>SudokuUI.selected);await page.click('#sdNotes');await page.click('[data-number="3"]');
  ok('pencil mark does not fill the cell',await page.evaluate(i=>SudokuUI.notes[i].includes(3)&&SudokuUI.values[i]===0,cell));
  await page.click('#sdUndo');ok('undo restores notes',await page.evaluate(i=>SudokuUI.notes[i].length===0,cell));
  await page.click('#sdNotes');await page.click('#sdCheck');
  const wrong=await page.evaluate(i=>SudokuUI.state.solution[i]%9+1,cell);await page.click(`[data-number="${wrong}"]`);
  ok('optional error indication',await page.locator(`[data-cell="${cell}"]`).evaluate(e=>e.classList.contains('error')));
  await page.locator(`[data-cell="${cell}"]`).focus();await page.keyboard.press(String(wrong));
  ok('typing a digit preserves Sudoku keyboard focus',await page.evaluate(i=>document.activeElement.dataset.cell===String(i),cell));
  await page.keyboard.press('ArrowRight');ok('Sudoku arrow navigation keeps focus on selection',await page.evaluate(()=>document.activeElement.dataset.cell===String(SudokuUI.selected)));
  ok('row/column/box highlighting',await page.locator('.sudoku-cell.related').count()===21);
  await page.click('#pgRestart');ok('restart asks about losing current round',await page.locator('#modalBox').textContent().then(t=>t.includes('پیشرفت همین دور')));await page.click('#mNo');
  ok('cancel restart preserves current input',await page.evaluate(i=>SudokuUI.values[i]!==0,cell));
  await page.click('#pgRestart');await page.click('#mYes');ok('confirm restart clears round input',await page.evaluate(()=>SudokuUI.values.every((v,i)=>v===SudokuUI.state.puzzle[i])));
  const coins=await page.evaluate(()=>Wallet.get());
  const settlement=await page.evaluate(()=>{SudokuUI.values=SudokuUI.state.solution.slice();SudokuUI.finish();const first=JSON.stringify({wallet:Store.get('wallet'),xp:Store.get('xp'),stats:Store.get('stats')});SudokuUI.finish();return first===JSON.stringify({wallet:Store.get('wallet'),xp:Store.get('xp'),stats:Store.get('stats')});});
  ok('second Sudoku settlement changes neither coins, XP nor statistics',settlement);
  ok('Sudoku reward settles once and records completion',await page.evaluate(c=>Wallet.get()>=c+8&&Store.get('completed').sudoku&&Store.get('best').sudoku===80,coins));
  for(const kind of ['quiz','surah','scramble','memory','match','dooz','esmfamil','hadith','imams','dua']){
   await page.evaluate(kind=>{UI.closeModal();if(kind==='dooz')DoozEngine.start(false);else if(kind==='esmfamil')EsmFamilEngine.start(false);else Games[kind]();},kind);
   ok('in-round restart control: '+kind,await page.locator('#pgRestart').isVisible());
  }
  await page.evaluate(()=>AyahEmbed.open());await page.waitForSelector('#ayahFrame');
  ok('external game controls beneath frame',await page.evaluate(()=>document.querySelector('.ayah-under').getBoundingClientRect().top>=document.querySelector('#ayahFrame').getBoundingClientRect().bottom-2));
  ok('external two-player limitation explicit',await page.locator('#ayahFrameStatus').textContent().then(t=>t.includes('هنوز در دسترس نیست')));
  await page.evaluate(async()=>{Router.go('home');await AyahEmbed.exiting;});ok('leaving external game removes frame',await page.locator('#ayahFrame').count()===0);
  await page.evaluate(()=>{Router.go('me');Me.tab='profile';Me.render();});ok('profile has no retired guest-connect path',await page.locator('#pfConnect').count()===0&&!await page.locator('#meBody').textContent().then(t=>t.includes('الان مهمانی')));
  await page.evaluate(()=>{Router.go('me');Me.tab='settings';Me.render();});
  ok('regular settings contain no SMS secrets/server address',await page.locator('#setServer,#smsKey,#smsDev').count()===0);
  await page.evaluate(()=>PaidAccount.open());await page.waitForFunction(()=>!!window.PaymentUI&&document.querySelector('#modalBox')?.textContent.includes('پرداخت هنوز'));
  ok('payment UI lazy-loads on demand and clearly labels sandbox/disabled state',await page.locator('#modalBox').textContent().then(t=>t.includes('پول واقعی دریافت نمی‌شود')));await page.evaluate(()=>UI.closeModal());
  const self=await page.evaluate(()=>selfTest());ok('updated built-in selfTest',self.ok);if(!self.ok)console.log(self.rows.filter(r=>!r.ok));
  await page.evaluate(()=>{UI.closeModal();Router.go('home');});
  const exported=await page.evaluate(()=>{Store.set('vip',true);Store.set('adminHash','secret-test');return PersonalData.export();});
  ok('personal export excludes token/admin/phone/VIP data',!/(userToken|adminHash|adminToken|phone|vip|secret-test)/i.test(exported));
  const ownership=await page.evaluate(()=>{
   const id=Store.get('progressOwner'),phone=Store.get('phone'),xp=Store.get('xp'),token=Store.get('userToken');
   PersonalData.import(JSON.stringify({format:'noorestan-personal',progress:{xp,adminToken:'forged',userToken:'forged',vip:true}}));
   const safe=Store.get('userToken')===token&&!Session.admin();Session.accept('usr_'+ '0'.repeat(20),'09120009999');const empty=Store.get('xp')===0&&!Store.get('badges').first;Store.set('xp',17);Session.accept(id,phone);
   return safe&&empty&&Store.get('xp')===xp&&Store.get('badges').first&&Store.get('guestMigration').owner===id;
  });ok('safe import and account switching cannot duplicate migrated guest progress',ownership);
  await page.evaluate(()=>{Store.set('isAdmin',true);Router.go('admin');});await page.waitForSelector('#adminPassword');
  ok('localStorage admin flag cannot open management',await page.evaluate(()=>!Session.admin()&&document.querySelector('#adminMain').classList.contains('hide')));
  await page.locator('#adminPassword').fill(PASS);await page.locator('#adminSignIn').click();await page.waitForFunction(()=>Session.admin());
  ok('admin has separate layout without regular navigation',!await page.locator('#nav').isVisible());
  await page.reload();await page.waitForFunction(()=>Session.admin()).catch(async e=>{console.error('RELOAD STATE',await page.evaluate(()=>({role:Session.role,gate:Gate.shown,hash:location.hash,hasToken:Admin.hasToken(),host:Host.yes(),text:document.querySelector('#gate')?.innerText})));throw e;});ok('admin reload revalidates role and keeps user navigation hidden',!await page.locator('#nav').isVisible());
  await page.evaluate(()=>Router.go('home'));ok('admin cannot navigate into regular user screens',await page.locator('#s-admin').evaluate(e=>e.classList.contains('active')));
  await page.evaluate(()=>document.querySelector('#toasts').innerHTML='');await page.screenshot({path:'screenshots/phase2-admin.png',animations:'disabled'});
  await page.evaluate(()=>Store.set('adminTokenExp',1));await page.reload();await page.waitForSelector('#adminPassword');ok('expired client admin session requires login again',await page.evaluate(()=>!Session.admin()));
  await page.locator('#adminPassword').fill(PASS);await page.locator('#adminSignIn').click();await page.waitForFunction(()=>Session.admin());
  await page.locator('#adminExit').click();await page.waitForSelector('#gtPhone');
  ok('admin logout returns to SMS entry',await page.evaluate(()=>!Session.admin()&&!Session.user()));
  await page.screenshot({path:'screenshots/phase2-sms-entry.png',animations:'disabled'});
  await page.evaluate(()=>{localStorage.removeItem('noorestan_v14');});await page.reload();await page.waitForSelector('#gtPhone');
  await page.locator('#gtPhone').fill('09129999998');await page.locator('#gtSend').click();await page.waitForSelector('#gtCode');await page.locator('#gtCode').fill(smsCode('09129999998'));await page.locator('#gtOk').click();await page.waitForFunction(()=>Session.user());
  ok('fresh account SMS entry opens four-step onboarding',await page.evaluate(()=>Store.get('xp')===0&&Onboarding.SLIDES.length===4)&&await page.locator('#onbNext').isVisible());
  for(let i=0;i<4;i++)await page.click('#onbNext');ok('onboarding completes without reopening Gate',await page.evaluate(()=>Store.get('settings').onboarded&&!Gate.shown));
  await page.evaluate(()=>{Store.set('userTokenExp',1);Router.go('home');});ok('expired user session cannot enter regular screens',await page.locator('#gtPhone').isVisible());
  ok('no browser runtime errors',errors.length===0);if(errors.length)console.log(errors);
 }
 console.log(`RESULT ${checks} checks passed; fake SMS provider, real local HTTP/WebSocket${browser?', real Chromium UI':''}.`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();for(const s of sockets)s.close();if(child)child.kill('SIGTERM');fake.closeAllConnections();fake.close();});
