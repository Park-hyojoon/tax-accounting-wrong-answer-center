const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'또 틀렸다!','검증','새학습');
const pages=['오답_훈련센터.html','이론_오답응용_5문제.html','일반전표_기본연습_24문제.html','매입매출전표_오답연습_3문제.html'];
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const errors=[];
 try{
 for(const folder of [root,fixture]){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  for(const name of pages){
   const page=await context.newPage();page.on('pageerror',e=>errors.push(name+': '+e.message));
   await page.goto(pathToFileURL(path.join(folder,name)).href);await page.waitForTimeout(200);
   const count=await page.locator('.question').count();if(name!==pages[0])assert.equal(count,folder===root?0:1,name);
   if(folder===root&&name===pages[0])await page.screenshot({path:path.join(fixture,'home-desktop.png'),fullPage:true});
   if(folder===fixture&&name===pages[0]){
     assert.equal(await page.locator('#seasonCatalog details').count(),1);
     assert.equal(await page.evaluate(()=>TrainingMistakeMemory.validate().length),0);
   }
   if(folder===fixture&&name===pages[1]){
     await page.evaluate(()=>{const p=problems[0];document.querySelector(`input[value="${p.answer}"]`).click()});
     await page.locator('.check-one').click();
     assert.equal(await page.evaluate(()=>state.checked[problems[0].id]),true);
   }
   if(folder===fixture&&name===pages[3]){
     const result=await page.evaluate(()=>{const card=document.querySelector('.question');const mode=card.querySelector('.trade-mode');mode.value='sales';mode.dispatchEvent(new Event('change',{bubbles:true}));const type=card.querySelector('.voucher-type');type.value='11.과세';type.dispatchEvent(new Event('change',{bubbles:true}));const supply=card.querySelector('.supply');supply.value='22,000,000';supply.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return [supply.value,card.querySelector('.vat').value]});
     assert.deepEqual(result,['20,000,000','2,000,000']);
     await page.screenshot({path:path.join(fixture,'voucher-desktop.png'),fullPage:true});
   }
   if(folder===fixture&&name===pages[2]){
     await page.evaluate(()=>{const card=document.querySelector('.question');const rows=[...card.querySelectorAll('.entry-row')];problems[0].answers.forEach((a,i)=>{const r=rows[i];r.querySelector('.side').value=a.side;r.querySelector('.side').dispatchEvent(new Event('change',{bubbles:true}));r.querySelector('.account').value=a.account;const division=r.querySelector('.division');if(division)division.value=a.division||'';const partner=r.querySelector('.partner');if(partner)partner.value=a.partner||'';const amount=r.querySelector('.amount');if(amount)amount.value=a.amount;});});
     await page.locator('.check-one').click();
     assert.equal(await page.evaluate(()=>studyState.cards[0].correct),true,'general journal grading');
   }
   await page.close();
  }
  const p=await context.newPage();await p.goto(pathToFileURL(path.join(folder,pages[1])).href+'?exam=999');
  assert.equal(await p.locator('.question:visible').count(),0);
  for(const name of pages.slice(1)){
    await p.goto(pathToFileURL(path.join(folder,name)).href+'?tag='+encodeURIComponent('없는 태그'));
    assert.equal(await p.locator('.question:visible').count(),0,'tag filter '+name);
  }
  await context.close();
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await mobile.newPage();await p.goto(pathToFileURL(path.join(root,pages[0])).href);
 await p.screenshot({path:path.join(fixture,'home-mobile.png'),fullPage:true});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'mobile overflow');
 const sync=await p.evaluate(()=>{const x=TrainingGitHub.backupPayload({season:'old',sourceMistakes:{entries:[{id:'old'}]}});return {season:x.season,keys:Object.keys(x.states),old:x.sourceMistakes?.entries?.some(e=>e.id==='old')}});
 assert.equal(sync.season,'exam-20260914');assert.deepEqual(sync.keys,['practical','theory','voucher']);assert.ok(!sync.old);
 const merge=await p.evaluate(()=>{const schema='exam-20260914-practical-schema';const a={schemaVersion:schema,cards:{0:{history:[{at:'2026-09-14T01:00:00Z',correct:false}],wrongCount:1}}};const b={schemaVersion:schema,cards:{0:{history:[{at:'2026-09-14T02:00:00Z',correct:false}],wrongCount:1}}};return TrainingGitHub.mergeState('practical',a,b).cards[0].history.length});assert.equal(merge,2,'same season histories merge');
 assert.deepEqual(errors,[]);
 console.log('PASS: empty and populated pages, grading, Enter VAT, exam filter, mobile layout, season isolation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
