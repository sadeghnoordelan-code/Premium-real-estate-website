const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
const assert=require('assert/strict');
const url=process.env.BOREAL_TEST_URL||'http://localhost:5173';
const fallbackOnly=process.argv.includes('--fallback-only');
const results=fallbackOnly ? JSON.parse(fs.readFileSync('verification/motion-results.json','utf8')).filter(x=>!String(x.test||'').includes('fallback')) : [];
async function wait(page,selector){await page.waitForSelector(selector,{state:'attached',timeout:45000});}
async function gesture(page,mobile){
 if(!mobile){await page.mouse.wheel(0,120);return;}
 await page.evaluate(()=>{
  const dispatch=(type,y)=>{
   const event=new Event(type,{bubbles:true,cancelable:true});
   Object.defineProperty(event,'touches',{value:y==null?[]:[{identifier:1,target:document.body,clientX:100,clientY:y}]});
   window.dispatchEvent(event);
  };
  dispatch('touchstart',600);dispatch('touchmove',400);dispatch('touchend',null);
 });
}
async function run(browser,name,width,height,extra={}){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<1024,hasTouch:width<1024,deviceScaleFactor:width===844?2:1,...extra});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await wait(page,'html[data-booted]');await wait(page,'#hero[data-ready]');
  await page.waitForTimeout(250);
  const boot=await page.evaluate(()=>({mode:document.querySelector('#hero').dataset.mode,shown:window.__heroDiag.shown,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  assert(boot.shown>=0,'hero has no presented frame'); assert(!boot.overflow,'horizontal overflow at boot');
  await gesture(page,width<1024);await page.waitForTimeout(450);
  let diag=await page.evaluate(()=>({...window.__heroDiag,time:document.querySelector('video').currentTime}));assert(diag.current>0,'wheel does not advance film');assert(diag.done>0||diag.mode==='frames','seeks never complete');
  if(diag.mode==='video')assert(diag.time>0.03,'decoder did not present the requested frame');
  // The modal must receive wheel and keyboard input without advancing the film.
  if(width<1024){await page.locator('[data-burger]').click();await page.locator('.menu [data-open-booking]').click();}
  else await page.locator('.header [data-open-booking]').click();
  await page.waitForTimeout(700);
  const before=await page.evaluate(()=>window.__heroDiag.target);
  await gesture(page,width<1024);await page.locator('input[name=name]').fill('Motion QA');await page.locator('input[name=name]').press('Space');
  assert.equal(await page.evaluate(()=>window.__heroDiag.target),before,'overlay input advanced hero');
  await page.keyboard.press('Escape');await page.waitForTimeout(700);
  // Closing the dialog restores focus to its trigger; move focus back to
  // the page before exercising the film's own keyboard navigation.
  await page.evaluate(()=>document.activeElement?.blur());
  await page.keyboard.press('End');await page.waitForTimeout(1200);
  const film=await page.evaluate(()=>({time:document.querySelector('video').currentTime,duration:document.querySelector('video').duration,mode:window.__heroDiag.mode}));
  if(film.mode==='video')assert(film.time>film.duration-0.1,'final decoded video frame is unavailable');
  await page.evaluate(()=>{document.querySelector('#hero').dispatchEvent(new CustomEvent('boreal:release'));window.scrollTo(0,document.querySelector('#projects').offsetTop);});
  await page.waitForTimeout(1800);
  for(let i=0;i<3;i++){
   await page.locator('.collindex__b').nth(i).evaluate(el=>el.click());await page.waitForTimeout(1600);
   const state=await page.locator('.pshot').nth(i).evaluate(el=>{const img=el.querySelector('.pdisc__img[data-on]');const disc=el.querySelector('.pdisc').getBoundingClientRect();return {image:img.complete&&img.naturalWidth>0,revealed:el.hasAttribute('data-revealed'),sweep:getComputedStyle(img).getPropertyValue('--sweep'),mask:getComputedStyle(img).maskImage,ratio:disc.width/disc.height,active:el.hasAttribute('data-active'),inert:el.inert};});
   assert(state.image,'project '+i+' image not ready');assert(state.revealed,'project '+i+' not revealed');assert(Math.abs(state.ratio-1)<.01,'disc is not circular');assert(!state.inert,'active project is inert');
   if(width>=1024)assert(parseFloat(state.sweep)>350||extra.reducedMotion==='reduce','radial wipe never completes');
   await page.locator('.pshot').nth(i).locator('.pthumb').nth(1).evaluate(el=>el.click());await page.waitForTimeout(600);
   assert.equal(await page.locator('.pshot').nth(i).locator('.pdisc__img[data-on]').getAttribute('data-layer'),'1','thumbnail failed');
  }
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'collection horizontal overflow');
  if(width===1440||width===390)await page.screenshot({path:`verification/${name}-${width}.png`});
  if(width===1440){
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
   assert.equal(await page.locator('.pcard[inert],.pshot[inert]').count(),0,'resize leaves inert mobile cards');
   await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(600);
   assert.equal(await page.locator('.pcard[inert]').count(),2,'resize allows inactive card focus');
  }
  assert.equal(errors.length,0,errors.join('; '));results.push({browser:name,width,height,...extra,status:'pass',hero:boot.mode});
 }catch(e){results.push({browser:name,width,height,...extra,status:'fail',error:e.message});}finally{await context.close();console.log(JSON.stringify(results.at(-1)));}
}
(async()=>{
 fs.mkdirSync('verification',{recursive:true});
 for(const [engine,name,options] of [[chromium,'chromium',{channel:'msedge'}],[webkit,'webkit',{}]]){
  let browser;try{browser=await engine.launch({headless:true,...options});}catch(e){results.push({browser:name,status:'unavailable',error:e.message});continue;}
  for(const [w,h] of (fallbackOnly?[]:[[320,568],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080],[2560,1440],[1366,480],[844,390]]))await run(browser,name,w,h);
  if(!fallbackOnly)await run(browser,name,390,844,{reducedMotion:'reduce'});
  // Force the mobile frame renderer and ensure the entire film is reachable.
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
  try{
   // WebKit media loads may bypass Playwright request routing. Replace
   // the media source with a missing file to exercise an actual decode failure.
   await page.addInitScript(()=>{
    const descriptor=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
    Object.defineProperty(HTMLMediaElement.prototype,'src',{...descriptor,set(){descriptor.set.call(this,'/assets/video/intentional-test-missing.mp4');}});
   });
   await page.goto(url,{waitUntil:'domcontentloaded'});await wait(page,'#hero[data-mode=frames][data-ready]');
   await page.evaluate(()=>document.querySelector('#hero').dispatchEvent(new CustomEvent('boreal:release')));await page.waitForTimeout(1500);
   const diag=await page.evaluate(()=>({...window.__heroDiag}));assert.equal(diag.mode,'frames');assert(diag.shown>=194&&diag.shown<=195,'mobile fallback ends at incorrect frame: '+diag.shown);
   results.push({browser:name,test:'mobile fallback final frame',status:'pass',shown:diag.shown});
  }catch(e){results.push({browser:name,test:'mobile fallback',status:'fail',error:e.message});}finally{await context.close();}
  await browser.close();console.log(JSON.stringify(results.filter(x=>x.browser===name)));
 }
 fs.writeFileSync('verification/motion-results.json',JSON.stringify(results,null,2));
 if(results.some(x=>x.status!=='pass'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
