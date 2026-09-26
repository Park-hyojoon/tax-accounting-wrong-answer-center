const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path'),{pathToFileURL}=require('url'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const files={theory:'이론_오답응용_5문제.html',practical:'일반전표_기본연습_24문제.html',voucher:'매입매출전표_오답연습_3문제.html'};
const url=file=>pathToFileURL(path.join(root,file)).href;
const home=url('오답_훈련센터.html')+'?weakness=1';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:1000}});
   await context.route('https://**/*',route=>route.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(home);
   assert.equal(await page.locator('.weak-recent-card').count(),0);
   assert.equal(await page.locator('[data-source=recent]').getAttribute('aria-pressed'),'true');
   const evidence=await page.evaluate(()=>JSON.stringify(TrainingWeaknessData));
   const refs=await page.evaluate(()=>{const repeated=new Set(TrainingWeaknessData.groups.flatMap(g=>g.refs.map(r=>r.subject+':'+r.id)));return Object.fromEntries(['theory','practical','voucher'].map(subject=>[subject,TrainingSeasonCatalog.find(ref=>ref.subject===subject&&(subject!=='theory'||repeated.has(subject+':'+ref.id)))]))});
   for(const subject of Object.keys(files)){
    const ref=refs[subject],selector=subject==='theory'?'.question[data-id="'+ref.id+'"]':'.question[data-index="'+ref.id+'"]';
    const queue=()=>page.locator('.weak-recent-card[data-subject="'+subject+'"][data-id="'+ref.id+'"]');
    await page.goto(url(files[subject])+'?view=all&weakrefs='+encodeURIComponent(ref.id));
    const card=page.locator(selector);
    if(subject==='theory'){
     const answer=await page.evaluate(id=>problems.find(p=>p.id===id).answer,ref.id);
     await card.locator('input[value="'+((answer+1)%4)+'"]').check();
     assert.equal(await page.evaluate(id=>(state.history[id]||[]).length,ref.id),0,'selection alone does not count');
    }
    await card.locator('.check-one').click();assert.equal(await card.isVisible(),true);
    await page.goto(home);assert.equal(await queue().count(),1,subject+' first graded error is queued');
    assert.equal(await page.evaluate(()=>JSON.stringify(TrainingWeaknessData)),evidence,'practice errors do not inflate direct evidence');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no horizontal overflow');
    if(subject==='theory')assert.equal(await queue().locator('.repeat').count(),1,'overlap is labelled');
    const retry=await queue().locator('a').getAttribute('href');
    await page.goto(retry);await page.waitForURL(u=>!u.searchParams.has('fresh'));
    await card.locator('.notebook-pass').click();assert.equal(await card.isVisible(),true,'leave the answer visible this visit');
    await page.locator('.notebook-toast button').click();
    await page.goto(home);assert.equal(await queue().count(),1,'undo pass restores review');
    await page.goto(retry);await page.waitForURL(u=>!u.searchParams.has('fresh'));
    await card.locator('.notebook-pass').click();
    if(subject==='theory'){
     const answer=await page.evaluate(id=>problems.find(p=>p.id===id).answer,ref.id);
     await card.locator('input[value="'+((answer+1)%4)+'"]').check();
    }
    // The question remains available while reviewing; another graded error reopens it.
    await card.locator('.check-one').click();
    await page.goto(home);assert.equal(await queue().count(),1,subject+' wrong after pass reopens review');
    await page.goto(retry);await page.waitForURL(u=>!u.searchParams.has('fresh'));
    if(subject==='theory'){
     const answer=await page.evaluate(id=>problems.find(p=>p.id===id).answer,ref.id);
     await card.locator('input[value="'+answer+'"]').check();await card.locator('.check-one').click();
    }else await card.locator('.notebook-pass').click();
    await page.goto(home);assert.equal(await queue().count(),0,subject+' completed review is removed');
    await page.goto(retry);await page.waitForURL(u=>!u.searchParams.has('fresh'));
    assert.equal(await card.isVisible(),false,'old retry link cannot expose completed question');
   }
   // A new notebook error can be cancelled without leaving a review entry.
   await page.goto(url(files.theory));
   const fresh=page.locator('.question:visible').first(),freshId=await fresh.getAttribute('data-id');
   await fresh.locator('.notebook-wrong').click();await page.locator('.notebook-toast button').click();
   await page.goto(home);assert.equal(await page.locator('.weak-recent-card[data-id="'+freshId+'"]').count(),0);
   // Actual timed grading shares the same review queue.
   await page.goto(url(files.practical)+'?timed=1');await page.waitForFunction(()=>window.TrainingTimed?.active?.current);
   const timedId=await page.evaluate(()=>TrainingTimed.active.current.dataset.index);
   await page.locator('.question:visible .check-one').click();
   assert.equal(await page.evaluate(id=>studyState.cards[id].history.at(-1).source,timedId),'timed');
   await page.goto(home);assert.equal(await page.locator('.weak-recent-card[data-subject=practical][data-id="'+timedId+'"]').count(),1);
   await page.locator('[data-source=submitted]').click();assert.ok(await page.locator('.weak-card').count()>0);
   await page.reload();assert.equal(await page.locator('[data-source=submitted]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>JSON.stringify(TrainingWeaknessData)),evidence);
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: PC/mobile first-error queue, separate direct evidence, pass/undo/reopen, timed grading');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
