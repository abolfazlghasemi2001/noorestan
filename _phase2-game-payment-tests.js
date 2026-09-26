const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {generate,countSolutions}=require('./assets/games/sudoku');
const {createPayments}=require('./payments');
let passed=0;const ok=(name,v)=>{assert(v,name);passed++;console.log('PASS',name);};
// Independent array/set solver, deliberately not sharing generator bitmask code.
function solutions(grid,limit=2){let count=0;const a=grid.slice();function go(){if(count>=limit)return;let at=-1,candidates=null;for(let i=0;i<81;i++)if(!a[i]){const used=new Set();for(let j=0;j<81;j++)if(Math.floor(i/9)===Math.floor(j/9)||i%9===j%9||Math.floor(i/27)===Math.floor(j/27)&&Math.floor(i%9/3)===Math.floor(j%9/3))used.add(a[j]);const c=[1,2,3,4,5,6,7,8,9].filter(n=>!used.has(n));if(!c.length)return;if(!candidates||c.length<candidates.length){at=i;candidates=c;}if(c.length===1)break;}if(at<0){count++;return;}for(const n of candidates){a[at]=n;go();if(count>=limit)break;}a[at]=0;}go();return count;}
(async()=>{
 let seed=149871;const rng=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;},seen=new Set();
 for(const level of ['easy','medium','hard']){
  const grids=[];for(let i=0;i<20;i++){const p=generate(level,rng);assert.equal(countSolutions(p.puzzle),1);assert.equal(solutions(p.puzzle),1);assert.equal(countSolutions(p.solution),1);assert(p.puzzle.every((v,i)=>!v||v===p.solution[i]));seen.add(p.puzzle.join(''));grids.push(p.clues);}
  ok(level+': 20 uniquely solvable puzzles (independent solver), clue range '+Math.min(...grids)+'–'+Math.max(...grids),true);
 }
 ok('60 distinct puzzles',seen.size===60);ok('empty grid has multiple solutions',countSolutions(Array(81).fill(0))===2);
 const invalid=Array(81).fill(0);invalid[0]=invalid[1]=1;ok('invalid board has no solutions',countSolutions(invalid)===0);
 fs.mkdirSync('tmp/phase2',{recursive:true});const file=path.resolve('tmp/phase2/payment-test-'+Date.now()+'.json');let n=0,verifies=0,mode='ok',requests=[];
 const fetcher=async(url,opts)=>{
  const b=JSON.parse(opts.body);requests.push({url,body:b});
  if(url.endsWith('/request.json'))return {ok:true,json:async()=>({data:{code:100,authority:'S'+String(++n).padStart(35,'0')}})};
  verifies++;if(mode==='timeout')throw Error('network timeout');
  return {ok:true,json:async()=>({data:mode==='fail'?{code:-51}:mode==='badref'?{code:100}:{code:mode==='already'?101:100,ref_id:1234+n}})};
 };
 const config={file,auth:()=>null,mode:'sandbox',publicUrl:'https://noorestan.example',fetcher};const pay=createPayments(config);
 let c=await pay.create('user-a','coins250');let authority=c.redirect.split('/').pop();
 ok('request uses server catalog amount and fixed callback origin',requests[0].body.amount===100000&&requests[0].body.currency==='IRR'&&requests[0].body.callback_url.startsWith('https://noorestan.example/api/payments/callback?order='));
 await assert.rejects(pay.verify(c.order,'S'+'x'.repeat(35),'OK'));ok('unknown authority cannot grant coins',pay.info('user-a').balance===0);
 const dup=await Promise.all(Array.from({length:8},()=>pay.verify(c.order,authority,'OK')));
 ok('concurrent callbacks verify and grant exactly once',verifies===1&&dup.every(x=>x.status==='paid')&&pay.info('user-a').balance===250);
 await pay.verify(c.order,authority,'OK');ok('sequential replay cannot double-credit',pay.info('user-a').balance===250&&verifies===1);
 const reloaded=createPayments(config);await reloaded.verify(c.order,authority,'OK');ok('idempotency survives process restart',reloaded.info('user-a').balance===250&&verifies===1);
 ok('other account cannot inherit balance',pay.info('user-b').balance===0);
 const bought=pay.spend('user-a','theme-desert');ok('server authorizes shop purchase and decrements balance',bought.items['theme-desert']&&bought.balance===0);
 assert.throws(()=>pay.spend('user-a','avapack'));assert.throws(()=>pay.spend('user-b','theme-desert'));ok('insufficient funds and other account rejected',true);
 c=await pay.create('user-b','coins600');authority=c.redirect.split('/').pop();const prior=verifies;await pay.verify(c.order,authority,'NOK');ok('failed/cancelled receipt, no verification or grant',verifies===prior&&pay.info('user-b').balance===0&&pay.info('user-b').receipts[0].status==='cancelled');
 mode='fail';await pay.verify(c.order,authority,'OK');ok('forged OK callback is not proof of payment',pay.info('user-b').balance===0&&pay.info('user-b').receipts[0].status==='failed');
 mode='timeout';await pay.verify(c.order,authority,'OK');ok('provider timeout stays unconfirmed without grant',pay.info('user-b').balance===0&&pay.info('user-b').receipts[0].status==='unconfirmed');
 mode='badref';await pay.verify(c.order,authority,'OK');ok('success code without reference rejected',pay.info('user-b').balance===0);
 mode='already';await pay.verify(c.order,authority,'OK');ok('provider 101 recovers an unconfirmed order exactly once',pay.info('user-b').balance===600);
 ok('all receipts explicitly marked sandbox',pay.info('user-a').receipts.every(r=>r.mode==='sandbox'));
 const disabled=createPayments({...config,mode:'disabled'});assert.throws(()=>disabled.spend('user-b','avapack'));await assert.rejects(disabled.create('user-b','coins250'));ok('sandbox balance cannot authorize purchases when sandbox disabled',!disabled.info('user-b').enabled);
 await assert.rejects(pay.create('user-b','__proto__'));ok('unknown product keys rejected',true);
 const open=fs.openSync;fs.openSync=(name,...args)=>{if(name===file+'.tmp')throw Error('simulated disk full');return open(name,...args);};
 try{assert.throws(()=>pay.spend('user-b','avapack'));}finally{fs.openSync=open;}
 ok('disk-write failure grants no in-memory entitlement',!pay.info('user-b').items.avapack&&pay.info('user-b').balance===600);
 const listeners={},vm=require('node:vm');
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{URL,location:{origin:'https://test.invalid'},self:{addEventListener:(t,fn)=>listeners[t]=fn}});
 let intercepted=false;for(const pathname of ['/api/otp/status','/api/payments/callback','/api/account/me'])listeners.fetch({request:{method:'GET',mode:'navigate',url:'https://test.invalid'+pathname},respondWith(){intercepted=true;}});
 ok('service worker never intercepts API or payment callbacks',!intercepted);
 console.log(`RESULT ${passed} checks passed. Payment responses are SIMULATED; no gateway transaction occurred.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
