/* سودوکو: تولید جدول یکتاپاسخ و شمارش پاسخ با انتخاب خانهٔ کم‌گزینه. بدون بانک سؤال. */
(function(root){
 'use strict';
 const digits=[1,2,3,4,5,6,7,8,9],levels={easy:42,medium:34,hard:28};
 const shuffle=(a,r=Math.random)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const box=i=>Math.floor(i/27)*3+Math.floor(i%9/3);
 function countSolutions(input,limit=2){
  if(!Array.isArray(input)||input.length!==81)return 0;
  const a=input.slice(),rows=Array(9).fill(0),cols=Array(9).fill(0),boxes=Array(9).fill(0);let count=0;
  for(let i=0;i<81;i++){
   const v=a[i];if(!Number.isInteger(v)||v<0||v>9)return 0;if(!v)continue;
   const r=Math.floor(i/9),c=i%9,b=box(i),bit=1<<v;
   if((rows[r]|cols[c]|boxes[b])&bit)return 0;rows[r]|=bit;cols[c]|=bit;boxes[b]|=bit;
  }
  function search(){
   if(count>=limit)return;
   let index=-1,mask=0,best=10;
   for(let i=0;i<81;i++)if(!a[i]){
    const m=1022&~(rows[Math.floor(i/9)]|cols[i%9]|boxes[box(i)]);
    let n=0;for(let bits=m;bits;bits&=bits-1)n++;
    if(!n)return;if(n<best){index=i;mask=m;best=n;if(n===1)break;}
   }
   if(index<0){count++;return;}
   const r=Math.floor(index/9),c=index%9,b=box(index);
   for(const v of digits)if(mask&(1<<v)){
    const bit=1<<v;a[index]=v;rows[r]|=bit;cols[c]|=bit;boxes[b]|=bit;search();
    a[index]=0;rows[r]^=bit;cols[c]^=bit;boxes[b]^=bit;if(count>=limit)return;
   }
  }
  search();return count;
 }
 function generate(level='easy',random=Math.random){
  if(!Object.hasOwn(levels,level))throw Error('Unknown difficulty');
  const groups=()=>shuffle([0,1,2],random).flatMap(g=>shuffle([0,1,2],random).map(n=>g*3+n));
  const rows=groups(),cols=groups(),nums=shuffle(digits,random);
  const solution=rows.flatMap(r=>cols.map(c=>nums[(r*3+Math.floor(r/3)+c)%9]));
  const puzzle=solution.slice();let clues=81;
  for(const i of shuffle(Array.from({length:81},(_,i)=>i),random)){
   if(clues<=levels[level])break;const old=puzzle[i];puzzle[i]=0;
   if(countSolutions(puzzle)===1)clues--;else puzzle[i]=old;
  }
  return {puzzle,solution,level,clues};
 }
 const core={generate,countSolutions,levels};
 if(typeof module!=='undefined'&&module.exports){module.exports=core;return;}
 root.NoorSudoku=core;
 const UIState={
  names:{easy:'آسان',medium:'متوسط',hard:'دشوار'},selected:0,notesOn:false,check:false,history:[],state:null,
  open(){
   if(!Session.user())return Gate.open();Router.go('play');RoundControl.clear();
   U.$('#pgTitle').textContent='سودوکو';U.$('#pgSub').textContent='هر سطر، ستون و کادر: اعداد ۱ تا ۹، بدون تکرار';U.$('#pgBar').innerHTML='';
   U.$('#pgBody').innerHTML=`<div class="card"><h3>سطح را انتخاب کن</h3><p class="tiny">همهٔ جدول‌ها دقیقاً یک پاسخ دارند. سطح‌ها با تعداد خانه‌های راهنما متفاوت‌اند.</p><div class="row sudoku-levels">${Object.keys(levels).map(l=>`<button class="btn" data-sudoku-level="${l}">${this.names[l]}</button>`).join('')}</div></div>`;
   U.$$('[data-sudoku-level]').forEach(b=>b.onclick=()=>this.start(b.dataset.sudokuLevel));U.prog(0,{cap:'جدول'});
  },
  start(level='easy'){
   if(!Session.user())return Gate.open();Timers.clearPage();Router.go('play');
   this.state={...generate(level),at:Date.now(),done:false};this.values=this.state.puzzle.slice();this.notes=Array.from({length:81},()=>[]);this.history=[];
   this.selected=this.values.indexOf(0);this.notesOn=false;this.check=false;Stats.track('sudoku');
   U.$('#pgTitle').textContent='سودوکو · '+this.names[level];U.$('#pgSub').textContent='یک جدول، یک پاسخ';
   U.$('#pgBar').innerHTML='<span id="sudokuClock" class="pill">۰:۰۰</span><span class="pill">رکورد: '+U.fa(Progress.recordLabel('sudoku_'+level)||'—')+' ثانیه</span>';
   RoundControl.set(()=>this.start(level));this.render();
   Timers.every(()=>{const e=U.$('#sudokuClock');if(e&&!this.state.done)e.textContent=U.fmtTime((Date.now()-this.state.at)/1000);},1000);
  },
  set(value){
   const s=this.state,i=this.selected;if(!s||s.done||s.puzzle[i])return;
   this.history.push({values:this.values.slice(),notes:this.notes.map(n=>n.slice())});if(this.history.length>100)this.history.shift();
   if(this.notesOn&&value){this.values[i]=0;this.notes[i]=this.notes[i].includes(value)?this.notes[i].filter(v=>v!==value):[...this.notes[i],value].sort();}
   else{this.values[i]=value;this.notes[i]=[];}
   if(this.values.every((v,i)=>v===s.solution[i]))this.finish();else this.render();
  },
  undo(){const h=this.history.pop();if(!h||this.state.done)return;this.values=h.values;this.notes=h.notes;this.render();},
  render(){
   const s=this.state,i=this.selected;if(!s)return;
   const active=document.activeElement,inside=active?.closest('.sudoku-wrap');
   const focus=inside?(active.dataset.cell!==undefined?`[data-cell="${i}"]`:active.dataset.number!==undefined?`[data-number="${active.dataset.number}"]`:active.id?'#'+active.id:null):null;
   const row=Math.floor(i/9),col=i%9;
   U.$('#pgBody').innerHTML=`<div class="sudoku-wrap"><div class="sudoku-tools"><button class="btn gh sm" id="sdNotes" aria-pressed="${this.notesOn}">یادداشت: ${this.notesOn?'روشن':'خاموش'}</button><button class="btn gh sm" id="sdCheck" aria-pressed="${this.check}">بررسی خطا: ${this.check?'روشن':'خاموش'}</button><button class="btn gh sm" id="sdUndo" ${this.history.length?'':'disabled'}>واگرد</button></div>
   <div class="sudoku-grid" role="group" aria-label="جدول سودوکو">${this.values.map((v,j)=>{
    const related=Math.floor(j/9)===row||j%9===col||box(j)===box(i),error=this.check&&v&&v!==s.solution[j];
    return `<button class="sudoku-cell ${s.puzzle[j]?'given':''} ${related?'related':''} ${j===i?'selected':''} ${v&&v===this.values[i]?'same':''} ${error?'error':''}" data-cell="${j}" aria-label="سطر ${Math.floor(j/9)+1} ستون ${j%9+1}، ${v?U.fa(v):'خالی'}${s.puzzle[j]?'، راهنما':''}" aria-pressed="${j===i}" tabindex="${j===i?'0':'-1'}">${v?U.fa(v):`<span class="sudoku-notes">${digits.map(n=>`<small>${this.notes[j].includes(n)?U.fa(n):''}</small>`).join('')}</span>`}</button>`;
   }).join('')}</div><div class="sudoku-pad">${digits.map(n=>`<button class="btn gh" data-number="${n}">${U.fa(n)}</button>`).join('')}<button class="btn gh" data-number="0">پاک</button></div><p class="tiny" role="status">${this.check?'خانه‌های دارای پاسخ نادرست مشخص می‌شوند.':'بررسی خطا خاموش است؛ با آرامش حل کن.'} با کلیدهای جهت و اعداد هم می‌توانی بازی کنی.</p></div>`;
   const area=U.$('.sudoku-wrap');
   U.$$('[data-cell]',area).forEach(b=>b.onclick=()=>{this.selected=+b.dataset.cell;this.render();U.$(`[data-cell="${this.selected}"]`).focus({preventScroll:true});});
   U.$$('[data-number]',area).forEach(b=>b.onclick=()=>this.set(+b.dataset.number));
   U.$('#sdNotes').onclick=()=>{this.notesOn=!this.notesOn;this.render();};U.$('#sdCheck').onclick=()=>{this.check=!this.check;this.render();};U.$('#sdUndo').onclick=()=>this.undo();
   area.onkeydown=e=>{
    if(e.target.matches('.sudoku-tools button'))return;
    const n=U.unfa(e.key);if(/^[1-9]$/.test(n)){e.preventDefault();this.set(+n);}
    else if(['Backspace','Delete','0'].includes(n)){e.preventDefault();this.set(0);}
    else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(n)){e.preventDefault();this.selected=Math.max(0,Math.min(80,this.selected+({ArrowUp:-9,ArrowDown:9,ArrowLeft:-1,ArrowRight:1})[n]));this.render();U.$(`[data-cell="${this.selected}"]`).focus({preventScroll:true});}
   };
   if(focus)area.querySelector(focus)?.focus({preventScroll:true});
   const total=81-s.clues,filled=this.values.filter((v,j)=>v&&!s.puzzle[j]).length;U.prog(filled/total*100,{cur:filled,total,cap:'خانه'});
  },
  finish(){
   const s=this.state;if(s.done)return;s.done=true;Timers.clearPage();
   const seconds=Math.max(1,Math.round((Date.now()-s.at)/1000)),points={easy:80,medium:120,hard:180}[s.level];
   Progress.award({game:'sudoku',pts:points,ok:true});Progress.record('sudoku',points);Progress.record('sudoku_'+s.level,seconds,false);
   Store.update(d=>{d.stats.puzzles++;d.stars.sudoku=Math.max(d.stars.sudoku||0,{easy:1,medium:2,hard:3}[s.level]);d.completed.sudoku=true;});Wallet.earn({easy:8,medium:12,hard:18}[s.level],'حل سودوکو');checkBadges();
   U.prog(100,{cur:81,total:81,cap:'تمام'});U.$('#pgBody').innerHTML=`<div class="card" role="status"><h3>آفرین! جدول کامل شد.</h3><p>${U.fa(seconds)} ثانیه · ${U.fa(points)} امتیاز و تجربه</p><button class="btn" id="sdAnother">جدول تازه</button></div>`;
   U.$('#sdAnother').onclick=()=>this.start(s.level);
  }
 };
 root.SudokuUI=UIState;
})(typeof window==='undefined'?globalThis:window);
