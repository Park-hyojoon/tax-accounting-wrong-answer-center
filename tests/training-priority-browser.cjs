const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files={theory:'이론_오답응용_5문제.html',practical:'일반전표_기본연습_24문제.html',voucher:'매입매출전표_오답연습_3문제.html'};
const url=file=>pathToFileURL(path.join(root,file)).href;
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
   const sort=async value=>{if(width===390)await page.locator('.mobile-filter-open').click();await page.selectOption('#sortOrder',value);if(width===390)await page.locator('.mobile-filter-apply').click()};
   page.on('pageerror',e=>errors.push(e.message));
   await context.route('https://**/*',route=>route.abort());
   for(const [subject,file] of Object.entries(files)){
    await page.goto(url(file)+'?view=all');
    const fixture=await page.evaluate(subject=>{
     const rows=Array.from(document.querySelectorAll('.question')).slice(-4),ids=rows.map(c=>c.dataset.id||Number(c.dataset.index));
     const at=offset=>new Date(Date.now()-offset*60000).toISOString();
     const wrong=(id,offset)=>({id,correct:false,at:at(offset)});
     const cards={
      [ids[0]]:{history:[wrong('single',1)],attempts:1,wrongCount:1},
      [ids[1]]:{history:[wrong('repeat-a',3),wrong('repeat-b',2)],attempts:2,wrongCount:2},
      [ids[2]]:{attempts:999,wrongCount:999,history:[]},
      [ids[3]]:{passed:true,passedAt:at(1),history:[{id:'pass',correct:true,at:at(1)}]}
     };
     const existing=JSON.parse(localStorage.getItem('exam-20260914-'+subject)||'{}');
     const state=subject==='theory'?{}:{cards,schemaVersion:existing.schemaVersion};
     if(subject==='theory')for(const [id,card] of Object.entries(cards))for(const [key,value] of Object.entries(card))(state[key]||={})[id]=value;
     localStorage.setItem('exam-20260914-'+subject,JSON.stringify(state));return {ids,history:cards[ids[1]].history};
    },subject);
    await page.reload();
    assert.equal(await page.locator('#sortOrder').inputValue(),'priority',subject+' default ranking');
    const attr=subject==='theory'?'data-id':'data-index',repeated=page.locator(`.question[${attr}="${fixture.ids[1]}"]`);
    assert.equal(await page.locator('.question:visible').first().getAttribute(attr),String(fixture.ids[1]),subject+' actual repeat first');
    assert.match(await repeated.locator('.priority-note').innerText(),/연속 오답 2회/);
    const options=await page.locator('.current-training-select option').allTextContents();
    assert.ok(options.some(t=>t.includes('연속 오답 2회')),subject+' TOP 10 uses correct subject state');
    await sort('repeatWrong');
    assert.equal(await repeated.isVisible(),true);
    assert.equal(await page.locator(`.question[${attr}="${fixture.ids[0]}"]`).isVisible(),false,'single mistake excluded in repeat-only mode');
    await sort('registered');
    assert.equal(await page.locator(`.question[${attr}="${fixture.ids[0]}"]`).isVisible(),true,'sort restores filtered cards');
    await sort('priority');
    await repeated.locator('.notebook-pass').click();
    await page.waitForFunction(({subject,id})=>!TrainingSeason.priority(subject,id,JSON.parse(localStorage.getItem('exam-20260914-'+subject))).active,{subject,id:fixture.ids[1]});
    await page.waitForTimeout(50);
    assert.equal(await repeated.locator('.priority-note').isVisible(),false,'pass removes priority reason');
    await page.locator('.notebook-toast button').click();
    await page.waitForFunction(({subject,id})=>TrainingSeason.priority(subject,id,JSON.parse(localStorage.getItem('exam-20260914-'+subject))).wrongStreak===2,{subject,id:fixture.ids[1]});
    await page.waitForTimeout(50);
    assert.match(await repeated.locator('.priority-note').innerText(),/연속 오답 2회/,'undo restores rank');
    const history=await page.evaluate(({subject,id})=>{const s=JSON.parse(localStorage.getItem('exam-20260914-'+subject));return (subject==='theory'?s.history[id]:s.cards[id].history).slice(0,2)},{subject,id:fixture.ids[1]});
    assert.deepEqual(history,fixture.history,'original learning history preserved');
    if(subject==='theory'){
     const answer=await page.evaluate(id=>problems.find(p=>p.id===id).answer,fixture.ids[1]);
     await repeated.locator(`input[type=radio]:not([value="${answer}"])`).first().check();
    }
    await repeated.locator('.check-one').click();
    await page.waitForFunction(({subject,id})=>TrainingSeason.priority(subject,id,JSON.parse(localStorage.getItem('exam-20260914-'+subject))).wrongStreak===3,{subject,id:fixture.ids[1]});
    await page.waitForTimeout(50);
    assert.match(await repeated.locator('.priority-note').innerText(),/연속 오답 3회/,'actual grading updates priority immediately');
   }
   const histories=()=>Object.fromEntries(['theory','practical','voucher'].map(subject=>{const s=JSON.parse(localStorage.getItem('exam-20260914-'+subject)||'{}');return [subject,subject==='theory'?s.history:Object.fromEntries(Object.entries(s.cards||{}).filter(([,c])=>c.history?.length).map(([id,c])=>[id,c.history]))]}));
   const snapshot=await page.evaluate(histories);
   await page.goto(url('오답_훈련센터.html')+'?weakness=1&weaknessSource=recent');
   const top=page.locator('.weak-priority-card');assert.ok(await top.count()>0);assert.ok(await top.count()<=10);
   assert.match(await top.first().innerText(),/연속 오답 3회/);
   await page.locator('.weak-priority').screenshot({path:path.join('C:/Users/MyPC/.codex/visualizations/2026/09/01/01a05c39-c06e-7750-82bd-c9d952df7f8e',`priority-${width}.png`)});
   assert.deepEqual(await page.evaluate(histories),snapshot,'ranking preserves learning history');
   const target=await top.first().locator('a').getAttribute('href');
   assert.equal(new URL(target).searchParams.get('weakrefs').split(',').length,1,'immediate practice scopes a single question');
   await page.goto(target);await page.waitForURL(u=>!u.searchParams.has('fresh'));
   assert.equal(await page.locator('.question:visible').count(),1,'one-click practice hides unrelated questions');
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: PC/mobile shared priority sort, actual repeats, pass/undo, preserved history and one-click TOP 10 practice');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
