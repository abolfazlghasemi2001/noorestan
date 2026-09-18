const fs=require('fs');
let h=fs.readFileSync(process.argv[2],'utf8');
h=h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');
h=h.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|h[1-6]|tr|td)>/gi,'\n');
h=h.replace(/<[^>]+>/g,' ');
const dec=s=>s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x([0-9a-f]+);/gi,(m,c)=>String.fromCodePoint(parseInt(c,16))).replace(/&#(\d+);/g,(m,c)=>String.fromCodePoint(+c));
h=dec(h);
h=h.replace(/[ \t ]+/g,' ').replace(/\n{2,}/g,'\n');
process.stdout.write(h);
