const fs=require('fs');
const src=fs.readFileSync('build_duas.js','utf8');
eval(src.split('const items=[]')[0]);
const l=fs.readFileSync('quran.txt','utf8').split('\n')[2];
const a='اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ';
const b='الْقَيُّومُ';
const A=pat(a), B=pat(b);
console.log('A len',A.length,'B len',B.length);
console.log(JSON.stringify(A));
console.log(JSON.stringify(B));
const re=new RegExp(A+'[\\s\\S]*?'+B);
console.log('test A part:', new RegExp(A).test(l));
console.log('test B part:', new RegExp(B).test(l));
console.log('combined:', re.test(l));
// try manual index approach
const mA=new RegExp(A).exec(l); console.log('mA', mA && mA[0] && mA[0].length, JSON.stringify(mA&&mA[0]));
const mB=new RegExp(B).exec(l); console.log('mB', mB && mB.index);
const tail=l.slice(0);
console.log('test B on remainder:', new RegExp(B).test(tail.slice(mA[0].length)));
