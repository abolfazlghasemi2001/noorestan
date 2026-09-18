const https=require('https');
const body=JSON.stringify({HadithId:+process.argv[2],Type:process.argv[3]||'hadith'});
function go(t){const req=https.request({hostname:'hadith.inoor.ir',path:'/service/api/elastic/ElasticHadithById',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'User-Agent':'Mozilla/5.0'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{let j;try{j=JSON.parse(d)}catch(e){if(t>0)return go(t-1);return console.log('FAIL',d.slice(0,300))}console.log(JSON.stringify(j.data,null,1).slice(0,4000));});});req.on('error',e=>{if(t>0)return go(t-1);console.log('ERR',e.message)});req.write(body);req.end();}
go(2);
