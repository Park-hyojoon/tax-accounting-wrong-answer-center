const {pathToFileURL}=require('node:url'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
let playwright;
try{playwright=require(process.env.EXAMINER_PLAYWRIGHT_PATH||'playwright')}catch(error){if(process.env.EXAMINER_PLAYWRIGHT_PATH)throw error;playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))}
const {chromium}=playwright;
const root=path.join(__dirname,'..'),base=pathToFileURL(path.join(root,'examiner-test/index.html')).href,hub=pathToFileURL(path.join(root,'오답_훈련센터.html')).href;
const out=process.env.EXAMINER_ARTIFACT_DIR||path.join(root,'examiner-test/artifacts');fs.mkdirSync(out,{recursive:true});
const key='exam-20260914-examiner-test-v1',coreKeys=['exam-20260914-theory','exam-20260914-practical','exam-20260914-voucher'];

async function openDetails(page,...ids){for(const id of ids)await page.locator('#'+id).evaluate(el=>el.open=true)}
(async()=>{
  const executablePath=process.env.EXAMINER_BROWSER_PATH||(process.platform==='win32'?path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'):undefined);
  const browser=await chromium.launch({executablePath,headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await context.route('https://**/*',route=>route.abort());
    await context.addInitScript(({coreKeys})=>{window.ExaminerLibrary=[];for(const k of coreKeys)if(localStorage.getItem(k)===null)localStorage.setItem(k,JSON.stringify({sentinel:k,history:[{id:'keep-record',correct:true,cancelledAt:'2026-10-04'}]}))},{coreKeys});
    await page.goto(base);assert.equal(await page.locator('#mode').isHidden(),true);assert.ok(!requests.some(r=>r.includes('/analysis.js')||r.includes('/questions.js')));
    assert.equal(await page.locator('#advanced').evaluate(el=>el.open),false);assert.equal(await page.locator('.main-actions button:visible').count(),2);
    await page.screenshot({path:out+'/examiner-simple-desktop.png'});
    // A short request names the destination; no analysis download or fake AI call.
    await page.locator('#request-help').click();assert.match(await page.locator('#request-guide').innerText(),/바로 그 AI 채팅/);assert.match(await page.locator('#quick-request').inputValue(),/6개.*테스트에 추가/);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copiedRequest=text}}));
    await page.locator('#copy-quick-request').click();assert.equal(await page.evaluate(()=>window.copiedRequest),await page.locator('#quick-request').inputValue());assert.ok(!requests.some(r=>r.includes('/analysis.js')));
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));await page.locator('#copy-quick-request').click();assert.match(await page.locator('#copy-status').innerText(),/직접 복사/);
    const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),coreKeys);
    // One click opens questions, with no prerequisite selections.
    await page.locator('#start-mode').click();await page.locator('.question').first().waitFor();assert.equal(await page.locator('.question').count(),6);assert.equal(await page.locator('.question .tag:visible').count(),6);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).trials.length,key),1);
    const answer=await page.evaluate(()=>window.ExaminerPilot.questions.find(q=>q.id===document.querySelector('.question').dataset.id).answer),card=page.locator('.question').first();
    await card.locator('input[value="'+answer+'"]').check();await card.locator('.grade').click();assert.match(await card.locator('.grade-result').innerText(),/정답/);assert.equal(await card.locator('.answer').evaluate(d=>d.open),true);
    await card.locator('[data-feedback=surprise]').click();assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).evaluations.at(-1).ratings.surprise,key),2);
    await card.locator('.quality summary').click();await card.locator('[data-rating=sentence]').selectOption('2');await card.locator('.quality-note').fill('문장은 자연스럽고 계산을 늘리지 않았음');await card.locator('.save-quality').click();
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).attempts.length,key),1);assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).evaluations.length,key),2);
    await openDetails(page,'advanced','transfer-panel');await page.locator('#make-request').click();assert.match(await page.locator('#request-text').inputValue(),/질문 방향 바꾸기 2문항/);assert.ok((await page.locator('#request-text').inputValue()).length<30000);
    const snapshot=await page.evaluate(key=>localStorage.getItem(key),key);await page.reload();await page.locator('#start-mode').click();await page.locator('.question').first().waitFor();assert.match(await page.locator('.grade-result').first().innerText(),/정답/);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),snapshot);
    // Advanced imports and all earlier data remain usable.
    const incoming=await page.evaluate(()=>{const p=JSON.parse(JSON.stringify(window.ExaminerPilot));p.id='import-one';p.label='가져온 묶음';p.questions=p.questions.slice(0,1);p.questions[0].id='import-question';p.questions[0].title='<img src=x onerror="window.injection=1">';return p});
    await openDetails(page,'advanced','transfer-panel','import-panel');await page.locator('#import-text').fill(JSON.stringify(incoming));await page.locator('#stage-import').click();assert.equal(await page.locator('#approve-import').isDisabled(),true);assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).packs.length,key),0);assert.equal(await page.locator('#pending img').count(),0);
    await page.locator('#review-confirm').check();await page.locator('#approve-import').click();assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).packs.length,key),1);await openDetails(page,'practice-options');await page.locator('#open-trial').click();assert.equal(await page.locator('.question').count(),1);assert.equal(await page.locator('.question img').count(),0);
    await openDetails(page,'backup-panel');const downloadPromise=page.waitForEvent('download');await page.locator('#export-state').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/출제위원/);const saved=await download.path();await page.locator('#restore-state').setInputFiles(saved);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('합쳤'));
    const existing=await page.evaluate(key=>localStorage.getItem(key),key);const foreign={schemaVersion:1,season:'old',packs:[],trials:[],attempts:[],evaluations:[]};await page.locator('#restore-state').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(foreign))});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('중단'));assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),existing);
    assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),coreKeys),before);
    await page.locator('#pack-select').selectOption('committee-pilot-20261005');for(const box of await page.locator('#style-options input').all())await box.uncheck();await page.locator('#style-options input[value="예외규정"]').check();await page.locator('#open-trial').click();assert.equal(await page.locator('.question').count(),1);
    requests.length=0;await page.goto(hub);assert.equal(await page.locator('a[href="examiner-test/index.html"]').count(),1);assert.ok(!requests.some(r=>r.includes('/examiner-test/')));
    await page.goto(base);await page.evaluate(key=>localStorage.setItem(key,'{bad-json'),key);await page.locator('#start-mode').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('보존'));assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'{bad-json');assert.equal(await page.locator('.question').count(),0);
    await page.evaluate(key=>localStorage.removeItem(key),key);await page.reload();await page.evaluate(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw Error('quota exceeded');return set.call(this,k,v)}},key);await page.locator('#start-mode').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('저장하지 못'));assert.equal(await page.locator('.question').count(),0);
    // Newly published problems require no manual import; snapshots survive catalogue removal.
    const published={...incoming,id:'published-one',label:'새로 출제한 문제',questions:incoming.questions.map(q=>({...q,title:'새 문제',id:'published-question'}))};
    const libraryContext=await browser.newContext(),libPage=await libraryContext.newPage();
    await libraryContext.addInitScript(p=>{window.ExaminerLibrary=JSON.parse(sessionStorage.getItem('test-catalog')||JSON.stringify([p]))},published);
    await libPage.goto(base);await libPage.locator('#start-mode').click();await libPage.locator('.question').first().waitFor();assert.equal(await libPage.locator('.question').count(),1);assert.match(await libPage.locator('#practice-title').innerText(),/새로 출제한/);
    assert.equal(await libPage.evaluate(key=>JSON.parse(localStorage.getItem(key)).packs[0].id,key),'published-one');
    await libPage.locator('.choice input').first().check();await libPage.locator('.grade').click();const stored=await libPage.evaluate(key=>localStorage.getItem(key),key);
    await libPage.evaluate(()=>sessionStorage.setItem('test-catalog','[]'));await libPage.reload();await libPage.locator('#start-mode').click();await libPage.locator('.question').first().waitFor();assert.equal(await libPage.evaluate(key=>localStorage.getItem(key),key),stored);
    const second={...published,id:'published-two',label:'두 번째 새 묶음'};await libPage.evaluate(p=>sessionStorage.setItem('test-catalog',JSON.stringify([p])),second);await libPage.reload();await libPage.locator('#start-mode').click();await libPage.locator('.question').first().waitFor();assert.equal(await libPage.locator('#practice-title').innerText(),second.label);assert.equal(await libPage.evaluate(key=>JSON.parse(localStorage.getItem(key)).attempts.length,key),1);
    const secondStored=await libPage.evaluate(key=>localStorage.getItem(key),key);
    await libPage.evaluate(p=>{p.questions[0].prompt='같은 ID의 다른 내용';sessionStorage.setItem('test-catalog',JSON.stringify([p]))},second);await libPage.reload();await libPage.locator('#start-mode').click();await libPage.waitForFunction(()=>document.querySelector('#status').textContent.includes('내용이 다릅니다'));assert.equal(await libPage.evaluate(key=>localStorage.getItem(key),key),secondStored);
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),phone=await mobile.newPage();await mobile.addInitScript(()=>{window.ExaminerLibrary=[]});await mobile.route('https://**/*',route=>route.abort());phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);await phone.screenshot({path:out+'/examiner-simple-mobile.png'});
    await phone.locator('#start-mode').click();await phone.locator('.question').first().waitFor();assert.equal(await phone.locator('.question').count(),6);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const receipt=phone.locator('.question').filter({has:phone.locator('table')}).first();await receipt.evaluate(el=>el.scrollIntoView({block:'start'}));assert.ok(await receipt.locator('.table-wrap').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await phone.screenshot({path:out+'/examiner-mobile.png'});
    await openDetails(phone,'advanced','analysis-panel');assert.ok(await phone.locator('#concept-rows').evaluate(e=>e.closest('.table-wrap').scrollWidth>e.closest('.table-wrap').clientWidth));assert.deepEqual(errors,[]);
    console.log('PASS: two-action entry, clear short request and copy fallback, one-click play/resume, quick feedback, automatic published packs and preserved snapshots, advanced import/backup, record isolation, conflict/corrupt/quota protection and mobile layout');
    await libraryContext.close();await mobile.close();await context.close();
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
