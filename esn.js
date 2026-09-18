const https=require('https');
const q=process.argv[2].trim().replace(/ +/g,'_');
const pg=process.argv[3]?'?page='+process.argv[3]:'';
function go(t){const req=https.request({hostname:'lib.eshia.ir',path:'/search/'+encodeURIComponent(q)+pg,headers:{'User-Agent':'Mozilla/5.0'}},res=>{let d=[];res.on('data',c=>d.push(c));res.on('end',()=>{
 let b=Buffer.concat(d).toString('utf8');
 b=b.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');
 b=b.replace(/<\/(p|div|li|h[1-6]|tr|td)>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ');
 b=b.replace(/&nbsp;/g,' ').replace(/&laquo;/g,'«').replace(/&raquo;/g,'»').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n');
 const segs=b.split('نام کتاب');
 for(let i=1;i<segs.length;i++){const s=segs[i].split(/\n/).map(x=>x.trim()).filter(x=>x.length);console.log('== '+s[0].slice(0,110));console.log('   '+s.slice(1,4).join(' ').slice(0,340));}
 console.log('segs',segs.length-1);
});});req.on('error',e=>{if(t>0)return go(t-1);console.log('ERR',e.message)});req.end();}
go(2);
