const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path'),{pathToFileURL}=require('url'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const pages={theory:'이론_오답응용_5문제.html',practical:'일반전표_기본연습_24문제.html',voucher:'매입매출전표_오답연습_3문제.html'};
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const errors=[];
 try{
 for(const [subject,file] of Object.entries(pages)){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.join(root,file)).href;
  await page.goto(url);
  const count=await page.locator('.question:visible').count();assert.ok(count>0);
  await page.locator('.notebook-wrong').first().click();
  let before=await page.evaluate(s=>JSON.parse(localStorage.getItem('exam-20260914-'+s)),subject);
  await page.locator('.notebook-toast button').click();
  let after=await page.evaluate(s=>JSON.parse(localStorage.getItem('exam-20260914-'+s)),subject);
  const get=s=>subject==='theory'?s.history[Object.keys(s.history)[0]]:s.cards[0].history;
  assert.equal(get(after)[0].correct,null);assert.ok(get(after)[0].cancelledAt);
  const merged=await page.evaluate(({subject,before,after})=>TrainingGitHub.mergeState(subject,before,after),{subject,before,after});
  assert.equal(get(merged).length,1);assert.ok(get(merged)[0].cancelledAt);
  await page.locator('.notebook-pass').first().click();
  assert.equal(await page.locator('.question:visible').count(),count-1);
  await page.reload();assert.equal(await page.locator('.question:visible').count(),count-1);
  await page.selectOption('[aria-label="학습 상태"]','passed');await page.waitForURL(/status=passed/);
  assert.equal(await page.locator('.question:visible').count(),1);
  await page.locator('.notebook-restore:visible').click();
  await page.goto(url);assert.equal(await page.locator('.question:visible').count(),count);
  const history=await page.evaluate(s=>JSON.parse(localStorage.getItem('exam-20260914-'+s)),subject);assert.equal(get(history).length,2);
  const exported=await page.evaluate(s=>s==='theory'?buildMarkdown():s==='practical'?buildTodayRecord():todayRecordPayload().content,subject);
  assert.ok(exported.includes('노트 학습 · 직접 표시'),subject+' export provenance');
  const sync=await page.evaluate(({subject,history})=>TrainingGitHub.mergeState(subject,history,history),{subject,history});assert.equal(get(sync).length,2);assert.ok(!JSON.stringify(sync).includes('"deleted":true'));
  if(subject==='practical'){
    assert.ok(await page.locator('.entry-wrap th').first().evaluate(e=>e.getBoundingClientRect().height<=36),'compact table heading');
    await page.screenshot({path:path.join(root,'또 틀렸다!','등록','compact-practical.png')});
  }
  await page.locator('.star-one').first().click();
  await page.goto(url+'?view=star');assert.equal(await page.locator('.question').count()>0,true);
  const group=page.locator('details.star-item').first();if(await group.count())await group.evaluate(e=>e.open=true);
  await page.locator('.notebook-pass:visible').first().click();assert.ok(await page.locator('.question:visible').count()>0,'star stays visible');
  await page.goto(url);
  if(subject==='voucher'){
    const widths=await page.locator('.question').first().evaluate(c=>({card:c.clientWidth,shell:c.querySelector('.kclep-shell').getBoundingClientRect().width}));assert.ok(widths.shell>widths.card*.9,JSON.stringify(widths));
    await page.screenshot({path:path.join(root,'또 틀렸다!','등록','compact-voucher.png')});
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow '+subject);
  await context.close();
 }
 const home=await browser.newPage({viewport:{width:1440,height:1000}});await home.goto(pathToFileURL(path.join(root,'오답_훈련센터.html')).href);
 assert.ok(await home.locator('.hero').evaluate(e=>e.getBoundingClientRect().height<85),'compact home header');await home.close();
 assert.deepEqual(errors,[]);console.log('PASS: notebook actions, undo merge, reload preservation, restoration, full width, mobile layout');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
