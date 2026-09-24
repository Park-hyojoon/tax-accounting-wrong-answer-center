const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path'),{pathToFileURL}=require('url'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const home=pathToFileURL(path.join(root,'오답_훈련센터.html')).href;
   await page.goto(home+'?weakness=1');
   assert.ok(await page.locator('.weak-card').count());
   const before=await page.locator('.weak-grid').innerText();
   await page.evaluate(()=>localStorage.setItem('exam-20260914-theory',JSON.stringify({history:{fake:[{correct:false},{correct:false},{correct:false}]},wrongCount:999,starred:{fake:true}})));
   await page.reload();assert.equal(await page.locator('.weak-grid').innerText(),before);
   const link=page.locator('.weak-card>a').filter({hasText:'이론'}).first();const url=await link.getAttribute('href');assert.ok(url);
   const ids=new URL(url).searchParams.get('weakrefs').split(',');
   await page.evaluate(ids=>localStorage.setItem('exam-20260914-theory',JSON.stringify({passed:Object.fromEntries(ids.map(id=>[id,true])),history:Object.fromEntries(ids.map(id=>[id,[{at:'2026-09-23',correct:true}]])),starred:{fake:true}})),ids);
   await page.goto(url);await page.waitForURL(u=>!u.searchParams.has('fresh'));
   assert.equal(await page.locator('.question:visible').count(),ids.length);
   const theoryCard=page.locator('.question:visible').first();
   await theoryCard.locator('input[type="radio"]').first().check();
   assert.equal(await page.locator('.question:visible').count(),ids.length,'theory selection must not hide an ungraded weakness question');
   assert.equal(await theoryCard.locator('.check-one').isVisible(),true,'grading button remains available');
   await theoryCard.locator('.check-one').click();
   assert.equal(await page.locator('.question:visible').count(),ids.length,'graded theory weakness question remains visible for review');
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('exam-20260914-theory')));
   assert.ok(saved.passed[ids[0]]);assert.equal(saved.history[ids[0]].length,1);assert.deepEqual(saved.starred,{});
   assert.equal(await page.locator('.star-one:visible').count(),0);
   for(const file of ['오답_훈련센터.html','이론_오답응용_5문제.html','일반전표_기본연습_24문제.html','매입매출전표_오답연습_3문제.html','약점_분석_임시.html']){
    await page.goto(pathToFileURL(path.join(root,file)).href);
    const special=page.locator('.top-nav a.nav-star');
    assert.equal(await special.count(),1,`${file}: weakness menu link`);
    assert.ok((await special.getAttribute('href')).endsWith('오답_훈련센터.html?weakness=1'),`${file}: weakness link target`);
    if(width===390){await page.locator('.nav-menu-toggle').click();assert.equal(await special.isVisible(),true,`${file}: mobile weakness menu link`)}
   }
   for(const [subject,label] of [['practical','일반전표'],['voucher','매입매출전표']]){
    await page.goto(home+'?weakness=1');
    const target=await page.locator('.weak-card>a').filter({hasText:label}).first().getAttribute('href');
    const refs=new URL(target).searchParams.get('weakrefs').split(',');
    await page.evaluate(({subject,refs})=>localStorage.setItem('exam-20260914-'+subject,JSON.stringify({schemaVersion:6,cards:Object.fromEntries(refs.map(id=>[id,{passed:true,history:[{at:'2026-09-23',correct:true}],starred:true}]))})),{subject,refs});
    await page.goto(target);await page.waitForURL(u=>!u.searchParams.has('fresh'));
    assert.equal(await page.locator('.question:visible').count(),refs.length,subject);
    await page.locator('.question:visible .notebook-wrong').first().click();
    assert.equal(await page.locator('.question:visible').count(),refs.length,subject+' after self marking');
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: PC/mobile weakness lists, ignores test history, passed-problem replay, history retained, old stars cleared');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
