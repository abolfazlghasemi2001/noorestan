const https=require('https');const fs=require('fs');
const list=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out={};
function search(q,cb){
 const p='/search/'+encodeURIComponent(q.trim().replace(/ +/g,'_'));
 const req=https.request({hostname:'lib.eshia.ir',path:p,headers:{'User-Agent':'Mozilla/5.0'}},res=>{let d=[];res.on('data',c=>d.push(c));res.on('end',()=>{
  let b=Buffer.concat(d).toString('utf8');
  b=b.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');
  b=b.replace(/<\/(p|div|li|h[1-6]|tr|td)>/gi,'\n').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ');
  b=b.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&laquo;/g,'«').replace(/&raquo;/g,'»').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n');
  const segs=b.split('نام کتاب').slice(1).map(s=>s.split('\n').map(x=>x.trim()).filter(x=>x.length));
  cb(segs.map(s=>({book:(s[0]||'').slice(0,90), snip:(s.slice(1,4).join(' ')||'').slice(0,200)})));
 });});
 req.on('error',e=>cb([{book:'ERR:'+e.message,snip:''}]));req.end();
}
let i=0;
(function next(){
 if(i>=list.length){fs.writeFileSync('verify_out.json',JSON.stringify(out,null,1));console.log('done');return;}
 const it=list[i++];
 search(it.q,r=>{out[it.id]={q:it.q,hits:r.length,top:r.slice(0,4)};console.log(it.id,r.length,(r[0]||{}).book);setTimeout(next,250);});
})();
