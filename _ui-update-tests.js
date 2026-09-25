/* Browser acceptance checks for the 28-item update.
   Dev-only: npm install --no-save --no-package-lock playwright @sparticuz/chromium
   Serve the repository first; BASE_URL defaults to http://localhost:8080.
   Set CHROMIUM_PATH to use an already installed browser. Output stays in tmp/.
   CAROUSEL_MS defaults to 180000 (three real minutes, not a mocked timer).
*/
const fs = require('fs');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
fs.mkdirSync('tmp/acceptance', {recursive:true});
const results = [], errors = [];
function ok(name, value, detail){
  results.push({name, ok:!!value, detail});
  console.log(`${value ? 'PASS' : 'FAIL'} ${name}${detail ? ': '+JSON.stringify(detail) : ''}`);
}
(async () => {
  const bundled = process.env.CHROMIUM_PATH ? null : require('@sparticuz/chromium').default;
  const browser = await chromium.launch({
    executablePath:process.env.CHROMIUM_PATH || await bundled.executablePath(),
    args:bundled ? bundled.args.filter(x=>!x.includes('disable-web-security')) : ['--no-sandbox'],
    headless:true
  });
  async function pageFor(options={}){
    const context = await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',serviceWorkers:'block',...options});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    // Optional recitation/font services are deliberately unavailable in these shell tests.
    await page.route('**/*', route => route.request().url().startsWith(BASE) ? route.continue() : route.abort());
    await page.addInitScript(() => {
      // Only suppress first-run overlays, retaining fresh application defaults.
      if(window.top !== window) return;
      localStorage.setItem('noorestan_v14', JSON.stringify({_v:15,settings:{onboarded:true},gate:'guest'}));
    });
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{Splash.hide();Onboarding.close(true);Gate.close();});
    await page.waitForTimeout(900);
    return page;
  }
  const p = await pageFor({reducedMotion:'reduce'});
  const self = await p.evaluate(()=>selfTest());
  ok('selfTest all rows',self.ok, {pass:self.pass,total:self.total});
  ok('initial reduced-motion has no autoplay timer',await p.evaluate(()=>HomeCarousel.timer===null));
  ok('self-hosted Lalezar loaded',await p.evaluate(async()=>{await document.fonts.load('400 24px Lalezar');return document.fonts.check('400 24px Lalezar');}));
  for(const theme of ['dark','light']){
    await p.evaluate(t=>{Store.update(d=>{d.settings.themeChosen=false;});Theme.set(t,true);},theme);
    for(const [width,height] of [[320,568],[390,844],[844,390],[1440,1000]]){
      await p.setViewportSize({width,height});
      for(const screen of ['home','settings','records','online','shop','collection','missions','admin']){
        await p.evaluate(screen=>{
          UI.closeModal();
          if(screen==='settings'||screen==='records'){Router.go('me');Me.tab=screen;Me.render();}
          else if(screen==='shop') Shop.open();
          else if(screen==='collection') Collection.open();
          else if(screen==='missions') Missions.open();
          else if(screen==='admin'){Store.set('isAdmin',true);Router.go('admin');Admin.currentTab='users';Admin.renderTab();}
          else Router.go(screen);
          Store.update(d=>d.quran.readSize=54);Fonts.apply(Store.get('fonts'));
        },screen);
        await p.waitForTimeout(60);
        const overflow = await p.evaluate(()=>{
          const visible = b => b.getBoundingClientRect().width>0 && (!b.closest('.promo-panel') || b.closest('.is-active'));
          return {page:document.body.scrollWidth > innerWidth+2,
            buttons:[...document.querySelectorAll('.btn')].filter(visible).filter(b=>b.scrollWidth>b.clientWidth+2 || b.scrollHeight>b.clientHeight+2).map(b=>({id:b.id,text:b.textContent.trim()}))};
        });
        ok(`${theme} ${width}x${height} ${screen} no clipped buttons`,!overflow.page && !overflow.buttons.length,overflow.page||overflow.buttons.length ? overflow:undefined);
      }
    }
    await p.setViewportSize({width:390,height:844});
    await p.evaluate(()=>{UI.closeModal();Router.go('home');HomeCarousel.show(0);document.querySelector('#toasts').innerHTML='';});
    await p.screenshot({path:`tmp/acceptance/home-${theme}.png`,animations:'disabled'});
    await p.evaluate(()=>Shop.open());
    await p.screenshot({path:`tmp/acceptance/shop-${theme}.png`,animations:'disabled'});
  }
  // Very large UI text + the longest label actually rendered by the settings page.
  await p.evaluate(()=>{UI.closeModal();Router.go('me');Me.tab='settings';Me.render();});
  const stress=await p.evaluate(()=>{
    const buttons=[...document.querySelectorAll('#meBody .btn, #meContent .btn, #s-me .btn')];
    const label=buttons.map(b=>b.textContent.trim()).sort((a,b)=>b.length-a.length)[0];
    const b=buttons.find(b=>b.id==='setFontDisp')||buttons[0];
    b.textContent=label;b.style.fontSize='24px';
    return {label,width:b.clientWidth,scrollWidth:b.scrollWidth,height:b.clientHeight,scrollHeight:b.scrollHeight};
  });
  ok('longest settings label at 24px plus Quran size 54',stress.scrollWidth<=stress.width+2 && stress.scrollHeight<=stress.height+2,stress);
  // Both device color modes and live changes, without overwriting an explicit preference.
  await p.evaluate(()=>{Store.update(d=>d.settings.themeChosen=false);Theme.fromSystem();});
  await p.emulateMedia({colorScheme:'light'});await p.waitForTimeout(100);
  ok('device light theme',await p.evaluate(()=>Theme.cur()==='light'));
  await p.emulateMedia({colorScheme:'dark'});await p.waitForTimeout(100);
  ok('device dark theme',await p.evaluate(()=>Theme.cur()==='dark'));
  await p.evaluate(()=>Theme.set('royal'));await p.emulateMedia({colorScheme:'light'});await p.waitForTimeout(100);
  ok('explicit palette survives OS change',await p.evaluate(()=>Theme.cur()==='royal'));
  await p.evaluate(()=>{UI.closeModal();Router.go('home');Install.open();Recite.cur={s:1,a:1};Recite.state='paused';QuranUI.syncMini();});
  await p.waitForTimeout(300);
  ok('install banner clears mini player',await p.evaluate(()=>{
    const a=document.querySelector('#ib').getBoundingClientRect(),b=document.querySelector('#miniQ').getBoundingClientRect();return a.bottom<=b.top;
  }));
  await p.evaluate(()=>{Recite.cur=null;Recite.state='idle';QuranUI.syncMini();Install.hide();});
  // Parent frame remains in its container, including rotation. Cross-origin content is NOT asserted here.
  for(const [width,height] of [[320,568],[390,844],[844,390],[1440,1000]]){
    await p.setViewportSize({width,height});
    await p.evaluate(()=>{UI.closeModal();Games.ayahlight();});
    const bounds=await p.evaluate(()=>{
      const f=document.querySelector('#ayahFrame'),r=f.getBoundingClientRect(),s=f.parentElement.getBoundingClientRect();
      return {src:f.src,left:r.left,right:r.right,width:innerWidth,inside:r.left>=s.left && r.right<=s.right,scroll:getComputedStyle(f.parentElement).overflow};
    });
    ok(`embed parent bounds ${width}x${height}`,bounds.inside&&bounds.left>=0&&bounds.right<=width&&bounds.src.endsWith('?embed=true'),bounds);
    await p.evaluate(()=>Router.go('home'));
    ok('leaving game removes cross-origin frame',await p.locator('#ayahFrame').count()===0);
  }
  // Complete the preserved OFFLINE fallback, not the inaccessible remote Arena game.
  for(const size of [{width:390,height:844},{width:1440,height:1000}]){
    await p.setViewportSize(size);
    for(const mode of ['order','missing','surah']){
      await p.evaluate(mode=>{AyahLight.open();AyahLight.mode=mode;AyahLight.start();},mode);
      for(let i=0;i<10;i++){
        const outside=await p.evaluate(()=>{
          const r=document.querySelector('.ayah-stage').getBoundingClientRect();
          return [...document.querySelectorAll('.ayah-stage button')].filter(b=>{const q=b.getBoundingClientRect();return q.left<r.left-1||q.right>r.right+1||q.bottom>r.bottom+1;}).map(b=>b.textContent);
        });
        assert.deepEqual(outside,[],'offline game control outside stage');
        if(mode==='order'){
          const count=await p.locator('[data-word]').count();
          for(let n=0;n<count;n++) await p.locator(`[data-word="${n}"]`).click();
          await p.locator('#ayahCheck').click();
        }else{
          const answer=await p.evaluate(()=>{const q=AyahLight.qs[AyahLight.i];const w=q.t.split(/\s+/);return AyahLight.mode==='surah'?q.s:w[Math.floor(w.length/2)];});
          await p.locator('[data-choice]').filter({hasText:answer}).first().click();
        }
        await p.locator('.ayah-actions .btn.ok,.ayah-choices .btn.ok').click();
      }
      ok(`offline ${mode} full round at ${size.width}`,await p.evaluate(()=>AyahLight.right===10 && !!document.querySelector('.ayah-result')));
    }
  }
  const auto=p;
  await auto.emulateMedia({reducedMotion:'no-preference',colorScheme:'dark'});
  await auto.evaluate(()=>{UI.closeModal();Theme.set('dark',true);});
  await auto.evaluate(()=>Router.go('home'));await auto.mouse.move(0,0);
  const observation=Number(process.env.CAROUSEL_MS||180000), start=Date.now();
  const indices=[];
  while(Date.now()-start<observation){await auto.waitForTimeout(4600);indices.push(await auto.evaluate(()=>HomeCarousel.index));}
  ok('carousel advances continuously in real time',indices.length>=3&&new Set(indices).size===3,{milliseconds:Date.now()-start,samples:indices});
  const area=await auto.locator('#homeSlider').boundingBox();
  await auto.dispatchEvent('#homeSlider','pointerdown',{pointerId:99,pointerType:'touch',button:0,clientX:area.x+40,clientY:area.y+80});
  let held=await auto.evaluate(()=>HomeCarousel.index);await auto.waitForTimeout(5200);
  ok('touch hold pauses advance',held===await auto.evaluate(()=>HomeCarousel.index));
  await auto.dispatchEvent('#homeSlider','pointercancel',{pointerId:99,pointerType:'touch',clientX:area.x+40,clientY:area.y+80});
  ok('pointer cancellation releases pause',await auto.evaluate(()=>!HomeCarousel.pauses.has('touch')));
  await auto.locator('#homeSlider').hover();
  let before=await auto.evaluate(()=>HomeCarousel.index);await auto.waitForTimeout(5200);
  ok('hover pauses advance',before===await auto.evaluate(()=>HomeCarousel.index));
  await auto.mouse.move(0,0);await auto.locator('[data-dot="1"]').focus();
  before=await auto.evaluate(()=>HomeCarousel.index);await auto.waitForTimeout(5200);
  ok('keyboard focus pauses advance',before===await auto.evaluate(()=>HomeCarousel.index));
  await auto.evaluate(()=>document.activeElement.blur());
  await auto.emulateMedia({reducedMotion:'reduce'});await auto.waitForTimeout(100);
  before=await auto.evaluate(()=>HomeCarousel.index);await auto.waitForTimeout(10000);
  ok('live reduced-motion stops timer',before===await auto.evaluate(()=>HomeCarousel.index)&&await auto.evaluate(()=>HomeCarousel.timer===null));
  const root=await auto.locator('#homeSlider').boundingBox();
  await auto.mouse.move(root.x+root.width/3,root.y+100);await auto.mouse.down();
  await auto.mouse.move(root.x+root.width/3+100,root.y+100,{steps:5});await auto.mouse.up();
  ok('manual swipe still works with reduced motion',await auto.evaluate(()=>HomeCarousel.index)===(before+1)%3);
  ok('hidden slides inert',await auto.evaluate(()=>[...document.querySelectorAll('.promo-panel')].every((s,i)=>s.inert===(i!==HomeCarousel.index))));
  await auto.locator('[data-dot="0"]').click();
  ok('navigation dots choose slide',await auto.evaluate(()=>HomeCarousel.index===0));
  await auto.screenshot({path:'tmp/acceptance/desktop-dark.png',animations:'disabled'});
  await auto.context().close();
  ok('no browser runtime errors',errors.length===0,errors);
  await browser.close();
  fs.writeFileSync('tmp/acceptance/results.json',JSON.stringify(results,null,2));
  console.log(`${results.filter(x=>x.ok).length}/${results.length} checks passed`);
  process.exitCode=results.some(x=>!x.ok)?1:0;
})().catch(e=>{console.error(e);fs.writeFileSync('tmp/acceptance/results.json',JSON.stringify({results,error:String(e)},null,2));process.exit(1);});
