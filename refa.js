const fs=require('fs');
const R=require('./pool_rolls_u.json');
const dec=s=>s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&apos;/g,"'");
const U=s=>String(s).replace(/[ً-ْٰـ]/g,'').replace(/[أإآاٱ]/g,'ا').replace(/[ىي]/g,'ي').replace(/ة/g,'ه').replace(/[ؤئء]/g,'').replace(/[^؀-ۿ ]/g,' ').replace(/ +/g,' ').trim();
const cache={};
let ok=0;
for(const r of R){
  if(r.fa && r.fa.length>3) continue;
  if(!cache[r.f]){ try{cache[r.f]=fs.readFileSync('rolls/'+r.f,'utf8');}catch(e){cache[r.f]=null;} }
  const h=cache[r.f]; if(!h) continue;
  const blocks=h.split('class="leftboxs2');
  for(const b of blocks){
    const mi=b.match(/<span class="ON">([\s\S]*?)<\/span>([\s\S]*?)<span class="wow zoomIn spfoot">/);
    if(!mi) continue;
    const ar=dec(mi[2].replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
    if(U(ar)!==U(r.ar)) continue;
    const fi=b.match(/<div class="farsi">([\s\S]*?)<\/div>/);
    if(fi){ r.fa=dec(fi[1].replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim(); if(r.fa) ok++; }
    break;
  }
}
fs.writeFileSync('pool_rolls_u.json',JSON.stringify(R));
console.log('now with fa:',R.filter(x=>x.fa&&x.fa.length>3).length,'/',R.length,'newly',ok);
