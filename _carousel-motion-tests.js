// Dependency-free behavioral checks against the real carousel controller.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('index.html', 'utf8');
function element(){
  const classes = new Set(), listeners = {};
  return {style:{},dataset:{},clientWidth:360,inert:false,listeners,
    classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(c,on){on?classes.add(c):classes.delete(c)}},
    addEventListener(n,fn){listeners[n]=fn},setAttribute(){},contains(){return false},
    setPointerCapture(){},releasePointerCapture(){},closest(){return null}};
}
const root=element(), track=element(), home=element(), pause=element();
home.classList.add('active');
const slides=Array.from({length:3},element), dots=Array.from({length:3},element);
const win=element(), doc=element();let delay, now=1000;
const context={window:win,document:doc,FX:{reduced:false},Icon:{of:()=>''},Date,
 U:{$:s=>({'#homeSlider':root,'.promo-panels':track,'#slidePause':pause,'#s-home':home}[s]),$$:s=>s==='.promo-panel'?slides:s==='[data-dot]'?dots:[],now:()=>now},
 Timers:{after(fn,ms){delay=ms;return 1},clear(){}},Set};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const HomeCarousel ='),source.indexOf('const AyahEmbed ='))+';this.carousel=HomeCarousel;',context);
const c=context.carousel;c.init();assert.equal(delay,5000);
const event=(x,y=0,type='pointermove')=>({clientX:x,clientY:y,pointerId:1,button:0,target:root,type});
function down(){root.listeners.pointerdown(event(0,0,'pointerdown'))}
function move(x,y=0){now+=16;root.listeners.pointermove(event(x,y))}
function up(x,type='pointerup'){win.listeners[type](event(x,0,type))}
down();move(90);up(90);assert.equal(c.index,1);assert.equal(track.style.transform,'');
down();move(35);move(-35);assert.equal(slides[2].style.opacity,'');up(-35,'pointercancel');
assert(slides.every(s=>s.style.opacity===''));assert(!c.pauses.has('touch'));
context.FX.reduced=true;down();move(90);up(90);assert.equal(c.index,2);assert(!c.pauses.has('touch'));assert.equal(c.timer,null);
context.FX.reduced=false;down();move(5,40);up(5);assert.equal(c.index,2);
c.show(-7);assert.equal(c.index,2);assert.equal(slides.filter(s=>!s.inert).length,1);
down();move(90);win.listeners.blur({type:'blur'});assert.equal(c.index,2);assert.equal(c.drag,null);assert(!c.pauses.has('touch'));
c.pause('hover',true);assert.equal(c.timer,null);c.pause('hover',false);assert.equal(delay,5000);
doc.hidden=true;c.schedule();assert.equal(c.timer,null);
console.log('PASS: cadence, inertia, direction reversal, cancellation, reduced-motion swipe, vertical scrolling, wrap, inert, blur, hover and hidden-tab pause');
