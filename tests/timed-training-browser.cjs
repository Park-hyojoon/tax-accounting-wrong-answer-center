// Isolated browser storage; no real learner history or remote sync is modified.
const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),url=(file,query='')=>pathToFileURL(path.join(root,file)).href+query;
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await context.route('https://**/*',route=>route.abort());
 try{
  await page.goto(url('일반전표_기본연습_24문제.html','?timed=1'));
  await page.waitForFunction(()=>window.TrainingTimed?.active?.current);
  assert.equal(await page.locator('.question:visible').count(),1);
  assert.equal(await page.locator('.question:visible .entry-wrap').evaluate(x=>x.inert),true);
  await page.keyboard.press('Control+Alt+Space');
  assert.equal(await page.evaluate(()=>TrainingTimed.active.pending.phase),'running');
  // Complete a real problem through the adapted controls; final credit filled by Enter.
  await page.evaluate(()=>{const card=TrainingTimed.active.current,rows=[...card.querySelectorAll('.entry-row')],p=problems[card.dataset.index];p.answers.forEach((a,i)=>{const r=rows[i],s=r.querySelector('.side');s.value=a.side;s.dispatchEvent(new Event('change',{bubbles:true}));const account=r.querySelector('.timed-account');account.value=JSON.stringify([a.account,a.division||'']);account.dispatchEvent(new Event('change',{bubbles:true}));const partner=r.querySelector('.partner');partner.value=a.partner||'';partner.dispatchEvent(new Event('change',{bubbles:true}));if(i<p.answers.length-1){const amount=r.querySelector(a.side==='D'?'.timed-debit':'.timed-credit');amount.value=String(a.amount);amount.dispatchEvent(new Event('input',{bubbles:true}))}else r.querySelector(a.side==='D'?'.timed-debit':'.timed-credit').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))});});
  assert.equal(await page.locator('.question:visible .timed-difference').textContent(),'0');
  await page.keyboard.press('Control+Space');
  assert.equal(await page.evaluate(()=>TrainingTimed.active.pending.phase),'stopped');
  await page.locator('.question:visible .check-one').click();
  const first=await page.evaluate(()=>studyState.cards[TrainingTimed.active.current.dataset.index].history.at(-1));
  assert.equal(first.correct,true);assert.equal(first.source,'timed');assert.ok(first.id);assert.ok(first.timing.elapsedMs>=0);
  assert.equal(await page.locator('.question:visible .check-one').isDisabled(),true);
  const snapshot=await page.evaluate(()=>JSON.stringify(studyState.cards[0].history));
  await page.locator('.timer-retry').click();assert.equal(await page.evaluate(()=>JSON.stringify(studyState.cards[0].history)),snapshot);
  // Settings start immediately; reject duplicate shortcut and preserve key combination specificity.
  await page.locator('.timer-config').click();await page.locator('.timer-minutes').fill('01');await page.locator('.timer-seconds').fill('30');
  await page.locator('.shortcut-start').focus();await page.keyboard.press('Control+Alt+KeyS');
  await page.locator('.shortcut-stop').focus();await page.keyboard.press('Control+Alt+KeyD');
  await page.locator('.timer-save').click();assert.equal(await page.evaluate(()=>TrainingTimed.active.pending.targetSeconds),90);
  await page.keyboard.press('Control+Space');assert.equal(await page.evaluate(()=>TrainingTimed.active.pending.phase),'running');
  await page.keyboard.press('Control+Alt+KeyD');assert.equal(await page.evaluate(()=>TrainingTimed.active.pending.phase),'stopped');
  await page.locator('.question:visible .check-one').click();
  assert.equal(await page.evaluate(()=>studyState.cards[0].history.at(-1).correct),false);
  // Timer resumes by timestamp after reload and displays overtime without erasing input.
  await page.locator('.timer-retry').click();await page.keyboard.press('Control+Alt+KeyS');
  await page.evaluate(()=>{TrainingTimed.active.pending.startedMs=Date.now()-100000;saveState()});
  await page.reload();await page.waitForFunction(()=>window.TrainingTimed?.active?.pending?.phase==='running');
  assert.ok((await page.locator('.timer-dial strong').textContent()).startsWith('+'));
  await page.keyboard.press('Control+Alt+KeyD');
  await page.locator('.question:visible .check-one').click();
  // Switching to another subject is explicit and starts in ready mode.
  await page.goto(url('매입매출전표_오답연습_3문제.html','?timed=1'));
  await page.waitForFunction(()=>window.TrainingTimed?.active?.current);
  await page.keyboard.press('Control+Alt+KeyS');
  await page.evaluate(()=>{const card=TrainingTimed.active.current,p=problems[card.dataset.index],variant=p.variants.find(x=>x.journal==='혼합')||p.variants[0],s=cs(card.dataset.index);s.voucher={...p.voucher,trade:'purchase',journal:variant.journal,item:p.item};s.rows=variant.rows.map(x=>({...x,summary:x.summary||'',accountCode:x.accountCode||''}));restore(card)});
  await page.keyboard.press('Control+Alt+KeyD');await page.locator('.question:visible .check-one').click();
  assert.equal(await page.evaluate(()=>state.cards[0].history.at(-1).correct),true);
  assert.equal(await page.evaluate(()=>state.cards[0].history.at(-1).source),'timed');
  // Existing backup/merge must retain timing and stable history IDs, without duplication.
  const merged=await page.evaluate(()=>{const payload=TrainingGitHub.backupPayload(),a=payload.states.practical,b=structuredClone(a),event=b.cards[0].history[0];event.cancelledAt=new Date().toISOString();event.correct=null;const result=TrainingGitHub.mergeState('practical',a,b),again=TrainingGitHub.mergeState('practical',result,a);return {before:a.cards[0].history.length,after:again.cards[0].history.length,cancelled:again.cards[0].history[0].cancelledAt,timing:again.cards[0].history[0].timing,source:again.cards[0].history[0].source,voucher:payload.states.voucher.cards[0].history[0].timing}});
  assert.equal(merged.before,merged.after);assert.ok(merged.cancelled);assert.ok(merged.timing);assert.ok(merged.voucher);assert.equal(merged.source,'timed');
  await page.goto(url('약점_분석_임시.html'));await page.waitForSelector('#timedAnalysis svg');
  assert.equal(await page.locator('#timedAnalysis .chart-point').count(),4);
  assert.ok((await page.locator('.timed-summary').textContent()).includes('정답 2회 / 오답 2회'));
  await page.locator('.timed-subject').selectOption('voucher');assert.equal(await page.locator('#timedAnalysis .chart-point').count(),1);
  await page.screenshot({path:path.join(root,'또 틀렸다!','timed-analysis-test.png'),fullPage:true});
  await page.goto(url('일반전표_기본연습_24문제.html','?timed=1&status=all'));
  await page.waitForSelector('.timer-panel');await page.screenshot({path:path.join(root,'또 틀렸다!','timed-desktop-test.png'),fullPage:true});
  const before=await page.locator('.timer-panel').boundingBox();await page.evaluate(()=>scrollTo(0,500));const after=await page.locator('.timer-panel').boundingBox();assert.equal(before.y,after.y);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
  const width=await page.evaluate(()=>({width:document.documentElement.scrollWidth,view:innerWidth}));assert.ok(width.width<=width.view+1,JSON.stringify(width));
  await page.screenshot({path:path.join(root,'또 틀렸다!','timed-mobile-test.png'),fullPage:true});
  // Negative difference fills a debit, and opening the solution marks assisted practice.
  await page.locator('.timer-retry').click();await page.keyboard.press('Control+Alt+KeyS');
  const negative=await page.evaluate(()=>{const card=TrainingTimed.active.current,[r0,r1]=card.querySelectorAll('.entry-row');r0.querySelector('.side').value='C';r0.querySelector('.side').dispatchEvent(new Event('change',{bubbles:true}));r0.querySelector('.timed-credit').value='300';r0.querySelector('.timed-credit').dispatchEvent(new Event('input',{bubbles:true}));const acc=r1.querySelector('.timed-account');acc.value=JSON.stringify(['선급비용','']);acc.dispatchEvent(new Event('change',{bubbles:true}));r1.querySelector('.timed-debit').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return {side:r1.querySelector('.side').value,amount:r1.querySelector('.amount').value,diff:card.querySelector('.timed-difference').textContent}});
  assert.deepEqual(negative,{side:'D',amount:'300',diff:'0'});
  await page.locator('.question:visible .answer-box summary').click();await page.waitForFunction(()=>TrainingTimed.active.pending.assisted===true);await page.keyboard.press('Control+Alt+KeyD');
  await page.goto(url('일반전표_기본연습_24문제.html'));assert.equal(await page.locator('.timer-panel').count(),0);assert.equal(await page.locator('.timed-kclep').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: shortcuts, balance Enter, real grading, duplicate prevention, retry history, reload/overtime, both subjects, analysis, responsive layout, normal-mode isolation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
