const https=require('https');
const extra=process.argv[4]?JSON.parse(process.argv[4]):{};
const body=JSON.stringify(Object.assign({Text:process.argv[2],PageSize:+(process.argv[3]||5),SearchType:'smart',isFullText:true},extra));
const req=https.request({hostname:'hadith.inoor.ir',path:'/service/api/elastic/v2/ElasticHadithList',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'User-Agent':'Mozilla/5.0'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{
 let j;try{j=JSON.parse(d)}catch(e){console.log('PARSE FAIL',d.slice(0,300));return}
 console.log('total:',j.totalCount,'returned:',(j.data&&j.data.resultList||[]).length);
 (j.data&&j.data.resultList||[]).forEach(x=>{
   const tr=(x.translateList||[]).map(t=>t.text).join(' || ');
   console.log('--- id',x.hadithId,'| src:',x.bookTitle,'ج'+x.vol,'ص'+x.pageNum,'| qael:',String(x.qaelTitleList));
   console.log('AR:',x.text||x.shortText||x.textSample);
   if(tr)console.log('FA:',tr);
 });
});});
req.on('error',e=>console.log('ERR',e.message));
req.write(body);req.end();
