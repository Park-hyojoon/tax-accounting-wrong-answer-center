const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const url=name=>pathToFileURL(path.resolve(__dirname,'..',name)).href;
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});await context.route('https://**/*',r=>r.abort());
  await page.goto(url('review.html'));
  assert.equal(await page.locator('#reviewList .review-row').count(),6);
  assert.equal(await page.locator('#focusTypeLabel').isVisible(),false);
  assert.equal(await page.locator('.nav-link[data-menu-id=review]').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile dashboard width');
  await page.evaluate(()=>document.fonts.ready);
  if(width>760){
   const nav=await page.locator('.top-nav').evaluate(nav=>({width:nav.clientWidth,scrollWidth:nav.scrollWidth,height:nav.clientHeight,scrollHeight:nav.scrollHeight,footer:nav.querySelector('.nav-foot').getBoundingClientRect().bottom,font:getComputedStyle(nav.querySelector('.nav-link')).fontSize}));
   assert.equal(nav.scrollWidth,nav.width,'no horizontal sidebar overflow');assert.equal(nav.scrollHeight,nav.height,'no vertical sidebar overflow');assert.ok(nav.footer<=950);assert.equal(nav.font,'20px');
   await page.setViewportSize({width,height:600});assert.ok(await page.locator('.nav-foot').evaluate(el=>el.getBoundingClientRect().bottom<=600),'footer reachable on shorter screen');await page.setViewportSize({width,height:950});
  }
  await page.screenshot({path:path.resolve(__dirname,'../output/review-'+width+'.png'),fullPage:true});
  for(const subject of ['practical','voucher','theory']){
   await page.selectOption('#reviewSubject',subject);
   const href=await page.locator('#reviewList .open-link').first().getAttribute('href');
   await page.goto(href);await page.waitForFunction(()=>!new URLSearchParams(location.search).has('fresh'));
   const card=page.locator('.question:visible');assert.equal(await card.count(),1,subject+' single problem');
   assert.equal(await page.locator('.review-heading-row .open-link').count(),1);
   assert.equal(await page.locator('.review-entry-panel').count(),0);
   if(subject==='theory'){await card.locator('input[type=radio]').first().check()}
   await card.locator('.check-one').click();
   await page.waitForFunction(()=>document.querySelector('.review-entry-result').textContent.includes('다음 복습일'));
   const before=await page.evaluate(subject=>JSON.parse(localStorage.getItem('exam-20260914-'+subject)),subject);
   const history=subject==='theory'?Object.values(before.history).flat():Object.values(before.cards).flatMap(c=>c.history||[]);
   assert.ok(history.length);if(subject==='practical')assert.ok(history.at(-1).wrongLabels.length);
   await page.locator('.review-heading-row .open-link').click();
   await page.waitForFunction(()=>document.querySelector('#reviewSummary')?.textContent.length>0);
   assert.match(await page.locator('#reviewSummary').innerText(),/오늘 연습한 유형 1개/);
  }
  await page.selectOption('#reviewSubject','');
  assert.match(await page.locator('#reviewSummary').innerText(),/오늘 연습한 유형 3개/);
  assert.equal(await page.locator('#reviewList .review-row').count(),3,'daily cap survives navigation');
  await page.selectOption('#reviewMode','focus');assert.equal(await page.locator('#focusTypeLabel').isVisible(),true);
  assert.ok(await page.locator('#focusType option').count()<=10);
  await page.selectOption('#focusType',{index:1});assert.ok(await page.locator('#reviewList .review-row').count()>0);
  // A previously passed theory question must remain visible while entering a new answer.
  const fixture=await page.evaluate(()=>{
   const e=TrainingSeasonCatalog.find(e=>e.subject==='theory'),key='exam-20260914-theory',s=JSON.parse(localStorage.getItem(key)||'{}');
   s.history||={};s.passed||={};s.passedAt||={};const at=new Date(Date.now()-2*86400000).toISOString();
   s.history[e.id]=[{id:'old-pass',at,correct:true}];s.passed[e.id]=true;s.passedAt[e.id]=at;localStorage.setItem(key,JSON.stringify(s));return e;
  });
  await page.goto(url('이론_오답응용_5문제.html')+'?review=1&view=all&fresh=1&weakrefs='+fixture.id);
  await page.waitForFunction(()=>!new URLSearchParams(location.search).has('fresh'));
  await page.locator('.question:visible input[type=radio]').first().check();
  assert.equal(await page.locator('.question:visible').count(),1);
  await page.locator('.question:visible .check-one').click();
  const preserved=await page.evaluate(id=>JSON.parse(localStorage.getItem('exam-20260914-theory')).history[id][0],fixture.id);
  assert.equal(preserved.id,'old-pass');assert.equal(preserved.correct,true);
  await page.locator('.nav-brand').evaluate(el=>el.click());
  await page.waitForURL(/%EC%9D%BC%EB%B0%98|일반전표/);
  assert.match(await page.locator('.page-head h1').innerText(),/일반전표/);
  assert.equal(await page.locator('.review-entry-panel').count(),0);
  assert.equal(await page.locator('.review-heading-row .open-link').innerText(),'오늘 복습 시작');
  assert.match(await page.locator('.question .prompt').first().evaluate(el=>getComputedStyle(el).fontFamily),/학습센터 문제글꼴/);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.resolve(__dirname,'../output/practical-heading-'+width+'.png')});
  await page.goto(url('오답_훈련센터.html'));await page.waitForURL(/%EC%9D%BC%EB%B0%98|일반전표/);
  await page.goto(url('오답_훈련센터.html')+'?weakness=1');assert.match(await page.locator('.nav-current').textContent(),/특별훈련/);
  await page.goto(url('review.html'));
  await page.evaluate(()=>localStorage.setItem('exam-20260914-practical','{broken'));await page.reload();
  assert.match(await page.locator('#reviewSummary').innerText(),/읽지 못했습니다/);assert.equal(await page.locator('#reviewList .open-link').count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('exam-20260914-practical')),'{broken');
  assert.deepEqual(errors,[]);await context.close();
 }console.log('PASS: desktop/mobile review, all three editors, daily limit, focused practice, passed theory, history preservation, corrupt-state protection');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
