const https=require('https');
const extra=process.argv[4]?JSON.parse(process.argv[4]):{};
const body=JSON.stringify(Object.assign({Text:process.argv[2],PageSize:+(process.argv[3]||5),SearchType:'smart',isFullText:true},extra));
function go(tries){const req=https.request({hostname:'hadith.inoor.ir',path:'/service/api/elastic/v2/ElasticHadithList',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'User-Agent':'Mozilla/5.0'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{
 let j;try{j=JSON.parse(d)}catch(e){if(tries>0)return go(tries-1);console.log('PARSE FAIL');return}
 console.log('total:',j.totalCount,'returned:',(j.data&&j.data.resultList||[]).length);
 (j.data&&j.data.resultList||[]).forEach(x=>{
   console.log('--- id',x.hadithId,'| src:',x.bookTitle,'vol'+x.vol,'pg'+x.pageNum,'|',String(x.qaelTitleList),'| toc:',String(x.tocInfo));
   console.log('TEXT:',x.text);
   console.log('SHORT:',x.shortText,'| SAMPLE:',x.textSample,'| NOERAB:',x.textNoErab);
   console.log('TR:',JSON.stringify(x.translateList||[]).slice(0,900));
 });
});});req.on('error',e=>{if(tries>0)return go(tries-1);console.log('ERR',e.message)});req.write(body);req.end();}
go(2);
