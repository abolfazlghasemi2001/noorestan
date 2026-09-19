const https=require('https');
const body=JSON.stringify(Object.assign({Text:process.argv[2],PageSize:+(process.argv[3]||3),SearchType:'smart',isFullText:true},process.argv[4]?JSON.parse(process.argv[4]):{}));
function go(t){const req=https.request({hostname:'hadith.inoor.ir',path:'/service/api/elastic/v2/ElasticHadithList',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'User-Agent':'Mozilla/5.0'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{if(t>0&&d[0]==='<')return go(t-1);require('fs').writeFileSync('raw.json',d);console.log(d.length);});});req.on('error',e=>{if(t>0)return go(t-1);console.log('ERR',e.message)});req.write(body);req.end();}
go(2);
