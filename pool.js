const fs=require('fs');
const dec=s=>s.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'')
 .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
 .replace(/&#x([0-9a-f]+);/gi,(m,c)=>String.fromCodePoint(parseInt(c,16))).replace(/&#(\d+);/g,(m,c)=>String.fromCodePoint(+c))
 .replace(/\s+/g,' ').trim();
const dir=process.argv[2];
const out=[];
for(const f of fs.readdirSync(dir)){
 const h=fs.readFileSync(dir+'/'+f,'utf8');
 const blocks=h.split('class="leftboxs2');
 for(let i=1;i<blocks.length;i++){
  const b=blocks[i];
  const mAr=b.match(/<span class="ON">([\s\S]*?)<\/span>([\s\S]*?)<span class="wow zoomIn spfoot">/);
  const mSrc=b.match(/id="foot"\s+title="([^"]*)"/);
  const mFa=b.match(/<span class="ONF">([\s\S]*?)<\/span>([\s\S]*?)<\/div>/);
  if(mAr) out.push({f, ar:dec(mAr[2]), fa:mFa?dec(mFa[2]).replace(/نكته\s*:[\s\S]*$/,''):'', src:mSrc?mSrc[1]:''});
 }
}
console.log(JSON.stringify(out,null,1));
