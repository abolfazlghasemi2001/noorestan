'use strict';
/* پرداخت آزمایشی: قیمت، تأیید، مانده و مالکیت فقط در سرور. تک‌پردازه، دفتر اتمیک مستقل. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const PACKS=Object.freeze({coins250:{title:'۲۵۰ سکهٔ آزمایشی',amount:100000,coins:250},coins600:{title:'۶۰۰ سکهٔ آزمایشی',amount:200000,coins:600}});
const ITEMS=Object.freeze({'theme-desert':250,avapack:150});
function createPayments({file,auth,mode='disabled',publicUrl='',merchant='00000000-0000-4000-8000-000000000001',fetcher=fetch}){
 let state={version:1,orders:{},accounts:{}};const locks=new Map();
 if(fs.existsSync(file)){state=JSON.parse(fs.readFileSync(file,'utf8'));if(state.version!==1||!state.orders||!state.accounts)throw Error('Payment ledger invalid');}
 let origin='';try{const u=new URL(publicUrl);if(u.protocol==='https:'&&!u.username&&!u.password)origin=u.origin;}catch(e){}
 const enabled=mode==='sandbox'&&!!origin&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(merchant);
 const view=o=>({id:o.id,title:o.title,amount:o.amount,currency:'IRR',coins:o.coins,status:o.status,reference:o.reference||'',at:o.at,mode:'sandbox'});
 const key=id=>'sandbox:'+id;
 function account(id){return state.accounts[key(id)]||{balance:0,items:{}};}
 function info(id){return {enabled,mode:enabled?'sandbox':'disabled',balance:account(id).balance,items:{...account(id).items},packs:PACKS,shop:ITEMS,receipts:Object.values(state.orders).filter(o=>o.user===id).sort((a,b)=>b.at-a.at).slice(0,100).map(view)};}
 function commit(fn){
  const next=structuredClone(state);fn(next);fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp';let fd;
  try{fd=fs.openSync(tmp,'w',0o600);fs.writeFileSync(fd,JSON.stringify(next));fs.fsyncSync(fd);fs.closeSync(fd);fd=null;fs.renameSync(tmp,file);state=next;}
  finally{if(fd!==undefined&&fd!==null)fs.closeSync(fd);}
 }
 async function provider(action,payload){
  const res=await fetcher('https://sandbox.zarinpal.com/pg/v4/payment/'+action+'.json',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({merchant_id:merchant,...payload}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!res.ok)throw Error('provider unavailable');return (await res.json()).data;
 }
 async function create(id,pack){
  if(!enabled)throw Error('پرداخت آزمایشی هنوز آماده نیست');
  if(!Object.hasOwn(PACKS,pack))throw Error('بسته نامعتبر');
  if(Object.keys(state.orders).length>=10000)throw Error('دفتر پرداخت نیاز به رسیدگی مدیر دارد');
  if(Object.values(state.orders).filter(o=>o.user===id&&o.at>Date.now()-60000).length>=5)throw Error('کمی صبر کن');
  const p=PACKS[pack],order={id:crypto.randomBytes(24).toString('hex'),user:id,pack,title:p.title,amount:p.amount,coins:p.coins,at:Date.now(),mode:'sandbox',status:'requesting'};
  commit(s=>{s.orders[order.id]=order;});
  try{
   const r=await provider('request',{amount:order.amount,currency:'IRR',description:order.title,callback_url:origin+'/api/payments/callback?order='+order.id});
   if(r?.code!==100||!/^S[a-zA-Z0-9]{20,80}$/.test(r.authority))throw Error('پاسخ درگاه معتبر نیست');
   if(Object.values(state.orders).some(o=>o.authority===r.authority))throw Error('شناسهٔ تکراری درگاه');
   commit(s=>{Object.assign(s.orders[order.id],{authority:r.authority,status:'pending'});});
   return {order:order.id,redirect:'https://sandbox.zarinpal.com/pg/StartPay/'+r.authority};
  }catch(e){commit(s=>{s.orders[order.id].status='request_failed';});throw Error('ارتباط با درگاه تأیید نشد؛ هزینه‌ای در برنامه ثبت نشده است.');}
 }
 async function verify(id,authority,status){
  if(locks.has(id))return locks.get(id);
  const task=(async()=>{
   const o=state.orders[id];if(!enabled||!o||o.mode!=='sandbox'||!o.authority||o.authority!==authority)throw Error('تراکنش پیدا نشد');
   if(o.status==='paid')return view(o);
   if(status!=='OK'){commit(s=>{s.orders[id].status='cancelled';});return view(state.orders[id]);}
   let r;try{r=await provider('verify',{amount:o.amount,authority:o.authority});}
   catch(e){commit(s=>{s.orders[id].status='unconfirmed';});return view(state.orders[id]);}
   if(![100,101].includes(r?.code)||!/^\d+$/.test(String(r.ref_id))||Number(r.ref_id)<=0){commit(s=>{s.orders[id].status='failed';});return view(state.orders[id]);}
   commit(s=>{
    const order=s.orders[id];if(order.status==='paid')return;
    const wallet=s.accounts[key(order.user)]||(s.accounts[key(order.user)]={balance:0,items:{}});
    wallet.balance+=order.coins;order.status='paid';order.reference=String(r.ref_id);order.verifiedAt=Date.now();
   });
   return view(state.orders[id]);
  })();locks.set(id,task);try{return await task;}finally{locks.delete(id);}
 }
 function spend(id,item){
  if(!enabled||!Object.hasOwn(ITEMS,item))throw Error('کالا در دسترس نیست');
  commit(s=>{
   const wallet=s.accounts[key(id)];if(wallet?.items[item])throw Error('این کالا قبلاً خریده شده');
   if(!wallet||wallet.balance<ITEMS[item])throw Error('سکهٔ آزمایشی کافی نیست');
   wallet.balance-=ITEMS[item];wallet.items[item]=true;
  });return info(id);
 }
 async function body(req){let b='';for await(const chunk of req){b+=chunk;if(b.length>4096)throw Error('درخواست بزرگ است');}return JSON.parse(b||'{}');}
 async function handle(req,res,url){
  const hdr={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  const json=(code,value)=>{res.writeHead(code,hdr);res.end(JSON.stringify(value));};
  try{
   if(url.pathname==='/api/payments/callback'){
    const o=await verify(url.searchParams.get('order'),url.searchParams.get('Authority'),url.searchParams.get('Status'));
    // Status in the redirect is never authority; the client reloads receipts from this ledger.
    res.writeHead(303,{'Location':'/?payment='+encodeURIComponent(o.id)+'#me','Cache-Control':'no-store'});return res.end();
   }
   if(req.method!=='POST')return json(405,{success:false,error:'فقط POST'});
   const b=await body(req),user=auth(b.token);if(!user)return json(401,{success:false,error:'ورود پیامکی لازم است'});
   if(url.pathname==='/api/payments/account')return json(200,{success:true,...info(user.id)});
   if(url.pathname==='/api/payments/create')return json(200,{success:true,...await create(user.id,b.pack)});
   if(url.pathname==='/api/payments/spend')return json(200,{success:true,...spend(user.id,b.item)});
   return json(404,{success:false});
  }catch(e){return json(400,{success:false,error:/^[\u0600-\u06ff]/.test(e.message)?e.message:'ثبت یا خواندن پرداخت ممکن نیست؛ با پشتیبانی تماس بگیر.'});}
 }
 return {create,verify,spend,info,handle};
}
module.exports={createPayments,PACKS,ITEMS};
