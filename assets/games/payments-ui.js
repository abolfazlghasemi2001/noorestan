/* رابط پرداخت تنبل: نه کد پذیرندگی، نه تصمیمِ تأیید در مرورگر. */
window.PaymentUI={
 busy:false,
 async open(){
  if(!Session.user())return Gate.open();
  UI.modal('<div role="status">در حال دریافت خریدها از سرور…</div>');
  const data=await PaidAccount.refresh();
  if(!Session.user())return;
  if(!data){UI.modal('<h3>خریدها در دسترس نیست</h3><p>اتصال را بررسی کن و دوباره تلاش کن. پرداختی در این صفحه تأیید نشده است.</p>');return;}
  const statuses={requesting:'در انتظار درگاه',pending:'در انتظار پرداخت',paid:'موفق — آزمایشی',cancelled:'لغوشده',request_failed:'ارتباط با درگاه ناموفق',unconfirmed:'تأیید نشده؛ نیازمند بررسی',failed:'ناموفق'};
  UI.modal(`<h3>خرید آزمایشی و رسیدها</h3><p class="gt-note">این محیط سندباکس است؛ پول واقعی دریافت نمی‌شود. سکه‌ها و خریدهای این بخش آزمایشی و جدا از سکه‌های بازی‌اند.</p>
  <p>ماندهٔ تأییدشدهٔ سرور: <b>${U.fa(data.balance||0)}</b> سکهٔ آزمایشی</p>
  ${data.enabled?`<div class="list">${Object.entries(data.packs).map(([id,p])=>`<div class="card"><b>${U.esc(p.title)}</b><p>${U.fa(p.amount)} ریال · آزمایشی</p><button class="btn" data-pack="${U.esc(id)}">رفتن به درگاه آزمایشی</button></div>`).join('')}</div>
  <h4>خرج سکهٔ آزمایشی در فروشگاه</h4><div class="row" style="gap:8px;flex-wrap:wrap">${Object.entries(data.shop).map(([id,price])=>`<button class="btn gh" data-paid-item="${U.esc(id)}" ${data.items[id]||data.balance<price?'disabled':''}>${U.esc(Shop.find(id)?.name||id)} · ${U.fa(price)} سکه${data.items[id]?' · داری':''}</button>`).join('')}</div>`:'<p>پرداخت هنوز توسط مدیریت فعال نشده است.</p>'}
  <h4 style="margin-top:22px">رسیدهای همین حساب</h4><div class="list">${data.receipts.map(r=>`<div class="card"><b>${U.esc(r.title)}</b><p>${U.esc(statuses[r.status]||'نیازمند بررسی')} · ${U.fa(r.amount)} ریال</p><small>${U.esc(U.jalali(r.at))} · ${r.reference?'شماره پیگیری: '+U.esc(r.reference):'شماره پیگیری ندارد'}</small><details><summary>شناسهٔ رسید</summary><code dir="ltr">${U.esc(r.id)}</code></details></div>`).join('')||'<p class="tiny">هنوز رسیدی ثبت نشده است.</p>'}</div><p class="tiny" id="paidMessage" role="status"></p>`,box=>{
   U.$$('[data-pack]',box).forEach(b=>b.onclick=()=>UI.confirm('به درگاه آزمایشی بروی؟ این پرداخت واقعی نیست.',()=>this.checkout(b.dataset.pack)));
   U.$$('[data-paid-item]',box).forEach(b=>b.onclick=()=>this.spend(b.dataset.paidItem));
  });
 },
 async checkout(pack){
  if(this.busy||!Session.user())return;this.busy=true;
  try{
   const token=Store.get('userToken'),r=await SMS.req('/api/payments/create',{body:{token,pack}}),j=r.json;
   if(token!==Store.get('userToken')||!Session.user())return;
   if(!r.ok||!j?.success)throw Error(j?.error||'ارتباط با درگاه برقرار نشد');
   const url=new URL(j.redirect);if(url.origin!=='https://sandbox.zarinpal.com'||!url.pathname.startsWith('/pg/StartPay/S'))throw Error('نشانی درگاه معتبر نیست');
   location.assign(url.href);
  }catch(e){UI.toast(e.message,'err');}finally{this.busy=false;}
 },
 async spend(item){
  if(this.busy||!Session.user())return;this.busy=true;
  try{const token=Store.get('userToken'),r=await SMS.req('/api/payments/spend',{body:{token,item}});if(!Session.user()||token!==Store.get('userToken'))return;if(!r.ok||!r.json?.success)throw Error(r.json?.error||'خرید انجام نشد');await this.open();UI.toast('خرید آزمایشی روی سرور ثبت شد.','ok');}
  catch(e){UI.toast(e.message,'err');}finally{this.busy=false;}
 }
};
