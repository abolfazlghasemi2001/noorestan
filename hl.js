const fs=require('fs');
const h=fs.readFileSync(process.argv[2],'utf8');
const dec=s=>s.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'')
 .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
 .replace(/&#x([0-9a-f]+);/gi,(m,c)=>String.fromCodePoint(parseInt(c,16))).replace(/&#(\d+);/g,(m,c)=>String.fromCodePoint(+c))
 .replace(/\s+/g,' ').trim();
const blocks=h.split('class="leftboxs2');
const out=[];
for(let i=1;i<blocks.length;i++){
  const b=blocks[i];
  // arabic: inside <div class="hadith"> ... the <a ...> after span.ON
  const mAr=b.match(/<span class="ON">([\s\S]*?)<\/span>([\s\S]*?)<span class="wow zoomIn spfoot">/);
  const mSrc=b.match(/id="foot"\s+title="([^"]*)"/);
  const mFa=b.match(/<span class="ONF">([\s\S]*?)<\/span>([\s\S]*?)<\/div>/);
  const mNum=b.match(/hadithtxts\/[^"]*?\/\s*(\d+)\//);
  if(mAr){
    out.push({
      ar:dec(mAr[2]),
      fa:mFa?dec(mFa[2]):'',
      src:mSrc?mSrc[1]:'',
      n:mNum?mNum[1]:''
    });
  }
}
// also capture guide title
const t=h.match(/<h4[^>]*>([\s\S]*?)<\/h4>/);
console.log(JSON.stringify(out,null,1));
