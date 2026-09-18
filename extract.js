const fs=require('fs');
const f=process.argv[2];
let h=fs.readFileSync(f,'utf8');
// strip scripts/styles
h=h.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ');
// focus on main content
let m=h.match(/<div[^>]*id="mw-content-text"[\s\S]*/i);
if(m) h=m[0];
h=h.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|h[1-6]|tr)>/gi,'\n');
h=h.replace(/<[^>]+>/g,' ');
h=h.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#160;/g,' ');
h=h.replace(/[ \t]+/g,' ');
h=h.split('\n').map(s=>s.trim()).filter(s=>s.length>0).join('\n');
console.log(h);
