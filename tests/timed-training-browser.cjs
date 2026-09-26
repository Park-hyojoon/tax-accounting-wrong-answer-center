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
  assert.equal(await page.locator('.question:visible .entry-wrap').evaluate(x=>x.inert),false);
  assert.equal(await page.locator('.question:visible .notebook-pass').count(),1);assert.equal(await page.locator('.question:visible .notebook-wrong').count(),1);
  assert.equal(await page.locator('.question:visible .reset-one').count(),1);
  assert.ok(await page.locator('.time-top option').count()>1);assert.notEqual(await page.locator('.time-top-label').evaluate(x=>getComputedStyle(x).backgroundColor),'rgba(0, 0, 0, 0)');
  await page.keyboard.press('Control+Alt+Space');
  assert.equal(await page.evaluate(()=>TrainingTimed.active.pending.phase),'running');
  // Complete a real problem through the adapted controls; final credit filled by Enter.
  await page.evaluate(()=>{const card=TrainingTimed.active.current,rows=[...card.querySelectorAll('.entry-row')],p=problems[card.dataset.index],answers=[...p.answers].reverse();answers.forEach((a,i)=>{const r=rows[i],s=r.querySelector('.side');s.value=a.side;s.dispatchEvent(new Event('change',{bubbles:true}));const account=r.querySelector('.timed-account');account.value=JSON.stringify([a.account,a.division||'']);account.dispatchEvent(new Event('change',{bubbles:true}));const partner=r.querySelector('.partner');partner.value=a.partner||'';partner.dispatchEvent(new Event('change',{bubbles:true}));if(i<answers.length-1){const amount=r.querySelector(a.side==='D'?'.timed-debit':'.timed-credit');amount.value=String(a.amount);amount.dispatchEvent(new Event('input',{bubbles:true}))}else r.querySelector(a.side==='D'?'.timed-debit':'.timed-credit').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))});});
  assert.equal(await page.locator('.question:visible .timed-difference').textContent(),'0');
  await page.keyboard.press('Control+Space');
  assert.equal(await page.evaluate(()=>TrainingTimed.active.pending.phase),'stopped');
  await page.locator('.question:visible .check-one').click();
  const practicalIndex=await page.evaluate(()=>TrainingTimed.active.current.dataset.index);
  const first=await page.evaluate(()=>studyState.cards[TrainingTimed.active.current.dataset.index].history.at(-1));
  assert.equal(first.correct,true);assert.equal(first.source,'timed');assert.ok(first.id);assert.ok(first.timing.elapsedMs>=0);
  assert.equal(await page.locator('.question:visible .check-one').isDisabled(),true);
  const snapshot=await page.evaluate(index=>JSON.stringify(studyState.cards[index].history),practicalIndex);
  await page.locator('.question:visible .reset-one').click();assert.equal(await page.evaluate(index=>JSON.stringify(studyState.cards[index].history),practicalIndex),snapshot);assert.equal(await page.evaluate(()=>TrainingTimed.active.pending==null),true);assert.equal(await page.locator('.question:visible .check-one').isEnabled(),true);
  // Settings start immediately; reject duplicate shortcut and preserve key combination specificity.
  await page.locator('.timer-config').click();await page.locator('.timer-minutes').fill('01');await page.locator('.timer-seconds').fill('30');
  await page.locator('.shortcut-start').focus();await page.keyboard.press('Control+Alt+KeyS');
  await page.locator('.shortcut-stop').focus();await page.keyboard.press('Control+Alt+KeyD');
  await page.locator('.timer-save').click();assert.equal(await page.evaluate(()=>TrainingTimed.active.pending.targetSeconds),90);
  await page.keyboard.press('Control+Space');assert.equal(await page.evaluate(()=>TrainingTimed.active.pending.phase),'running');
  await page.keyboard.press('Control+Alt+KeyD');assert.equal(await page.evaluate(()=>TrainingTimed.active.pending.phase),'stopped');
  await page.locator('.question:visible .check-one').click();
  assert.equal(await page.evaluate(index=>studyState.cards[index].history.at(-1).correct,practicalIndex),false);
  // Timer resumes by timestamp after reload and displays overtime without erasing input.
  await page.locator('.timed-redo').click();await page.keyboard.press('Control+Alt+KeyS');
  await page.evaluate(()=>{TrainingTimed.active.pending.startedMs=Date.now()-100000;saveState()});
  await page.reload();await page.waitForFunction(()=>window.TrainingTimed?.active?.pending?.phase==='running');
  assert.ok((await page.locator('.timer-dial strong').textContent()).startsWith('+'));
  await page.keyboard.press('Control+Alt+KeyD');
  await page.locator('.question:visible .check-one').click();
  // Switching to another subject is explicit and starts in ready mode.
  await page.goto(url('매입매출전표_오답연습_3문제.html','?timed=1&exam=all&status=all&problem=0'));
  await page.waitForFunction(()=>window.TrainingTimed?.active?.current);
  assert.equal(await page.locator('.question:visible .reset-one').count(),1);
  assert.equal(await page.evaluate(()=>{const card=TrainingTimed.active.current,actions=card.querySelector('.qactions'),answer=card.querySelector('.answer-reveal');return answer.parentElement.classList.contains('answer-workspace')&&Boolean(actions.compareDocumentPosition(answer)&Node.DOCUMENT_POSITION_FOLLOWING)}),true);
  await page.keyboard.press('Control+Alt+KeyS');
  await page.evaluate(()=>{const card=TrainingTimed.active.current,p=problems[card.dataset.index],variant=p.variants.find(x=>x.journal==='혼합')||p.variants[0],typeNo=Number(String(p.voucher.type).match(/^\d+/)?.[0]||0),trade=typeNo>=50?'purchase':'sales';$('.trade-mode',card).value=trade;setTypeMode(card,trade,false);syncPartsFromDate(card,p.voucher.date);$('.voucher-type',card).value=p.voucher.type;$('.item-name',card).value=p.item;$('.supply',card).value=p.voucher.supply;$('.vat',card).value=p.voucher.vat;$('.supplier',card).value=p.voucher.supplier||'';$('.electronic',card).value=p.voucher.electronic||'';$('.journal',card).value=variant.journal;$('.card-company',card).value=p.voucher.cardCompany||'';$('.zero-rate',card).value=p.voucher.zeroRate||'';syncDeductReason(card);$('.deduct-reason',card).value=p.voucher.deductReason||'';clearJournalRows(card);variant.rows.forEach((row,index)=>putStoredRow($$('.entry-row',card)[index],row));applyJournalForm(card);totals(card)});
  await page.keyboard.press('Control+Alt+KeyD');await page.evaluate(()=>TrainingTimed.active.current.querySelector('.check-one').click());
  const voucherIndex=await page.evaluate(()=>TrainingTimed.active.current.dataset.index);
  const voucherResult=await page.evaluate(index=>({correct:state.cards[index].history.at(-1).correct,wrongLabels:state.cards[index].history.at(-1).wrongLabels,voucher:state.cards[index].history.at(-1).voucher}),voucherIndex);
  assert.equal(voucherResult.correct,true,JSON.stringify(voucherResult));
  assert.equal(await page.evaluate(index=>state.cards[index].history.at(-1).source,voucherIndex),'timed');
  // Existing backup/merge must retain timing and stable history IDs, without duplication.
  const merged=await page.evaluate(()=>{const payload=TrainingGitHub.backupPayload(),a=payload.states.practical,b=structuredClone(a),pk=Object.keys(b.cards).find(key=>b.cards[key].history?.length),vk=Object.keys(payload.states.voucher.cards).find(key=>payload.states.voucher.cards[key].history?.length),event=b.cards[pk].history[0];event.cancelledAt=new Date().toISOString();event.correct=null;const result=TrainingGitHub.mergeState('practical',a,b),again=TrainingGitHub.mergeState('practical',result,a);return {before:a.cards[pk].history.length,after:again.cards[pk].history.length,cancelled:again.cards[pk].history[0].cancelledAt,timing:again.cards[pk].history[0].timing,source:again.cards[pk].history[0].source,voucher:payload.states.voucher.cards[vk].history[0].timing}});
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
  const negative=await page.evaluate(()=>{const card=TrainingTimed.active.current,[r0,r1]=card.querySelectorAll('.entry-row');r0.querySelector('.side').value='C';r0.querySelector('.side').dispatchEvent(new Event('change',{bubbles:true}));r0.querySelector('.timed-credit').value='300';r0.querySelector('.timed-credit').dispatchEvent(new Event('input',{bubbles:true}));const acc=r1.querySelector('.timed-account');acc.selectedIndex=1;acc.dispatchEvent(new Event('change',{bubbles:true}));r1.querySelector('.timed-debit').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return {side:r1.querySelector('.side').value,amount:r1.querySelector('.amount').value,diff:card.querySelector('.timed-difference').textContent}});
  assert.deepEqual(negative,{side:'D',amount:'300',diff:'0'});
  await page.locator('.question:visible .answer-box summary').click();await page.waitForFunction(()=>TrainingTimed.active.pending.assisted===true);await page.keyboard.press('Control+Alt+KeyD');
  // Partner names accept ㈜ and (주) as the same spelling; partner search also uses Korean by default.
  assert.equal(await page.evaluate(()=>normText('㈜초코')===normText('(주)초코')),true);
  await page.evaluate(()=>{const exam=document.querySelector('.time-exam');exam.value='';exam.dispatchEvent(new Event('change',{bubbles:true}));const status=document.querySelector('.time-status');status.value='all';status.dispatchEvent(new Event('change',{bubbles:true}));const index=problems.findIndex(p=>p.id==='exam-103-practical-18'),question=document.querySelector('.time-question');question.value=String(index);question.dispatchEvent(new Event('change',{bubbles:true}))});
  await page.keyboard.press('Control+Alt+KeyS');
  const entryToggle=page.locator('.question:visible .entry-toggle');if(await entryToggle.count()&&await entryToggle.getAttribute('open')===null)await entryToggle.locator('summary').first().click();
  const partner=page.locator('.question:visible select.partner:not(:disabled)').first();await partner.click();
  assert.equal(await page.locator('#accountSearchTitle').textContent(),'거래처 빠른 찾기');
  await page.locator('.account-search-input').pressSequentially('qh');
  assert.equal(await page.locator('.account-search-input').inputValue(),'보');
  assert.ok((await page.locator('.account-search-list').textContent()).includes('보람은행'));
  await page.keyboard.press('Enter');assert.equal(await partner.inputValue(),'보람은행');
  // The reported three-line note-discount entry must pass even in the reverse row order.
  await page.locator('.timer-retry').click();await page.keyboard.press('Control+Alt+KeyS');
  await page.evaluate(()=>{const card=TrainingTimed.active.current,rows=[...card.querySelectorAll('.entry-row')],p=problems[card.dataset.index];[...p.answers].reverse().forEach((a,i)=>{const row=rows[i],side=row.querySelector('.side');side.value=a.side;side.dispatchEvent(new Event('change',{bubbles:true}));const account=row.querySelector('.timed-account'),wanted=[...account.options].find(o=>{try{return JSON.parse(o.value)[0]===a.account}catch(_){return false}});account.value=wanted.value;account.dispatchEvent(new Event('change',{bubbles:true}));const partner=row.querySelector('.partner');partner.value=a.partner||'';partner.dispatchEvent(new Event('change',{bubbles:true}));const amount=row.querySelector(a.side==='D'?'.timed-debit':'.timed-credit');amount.value=String(a.amount);amount.dispatchEvent(new Event('input',{bubbles:true}))})});
  await page.keyboard.press('Control+Alt+KeyD');await page.locator('.question:visible .check-one').click();
  assert.equal(await page.evaluate(()=>studyState.cards[TrainingTimed.active.current.dataset.index].history.at(-1).correct),true);
  await page.locator('.question:visible .notebook-wrong').click();assert.deepEqual(await page.evaluate(()=>{const h=studyState.cards[TrainingTimed.active.current.dataset.index].history.at(-1);return{source:h.source,correct:h.correct}}),{source:'notebook',correct:false});
  await page.locator('.question:visible .notebook-pass').click();assert.deepEqual(await page.evaluate(()=>{const h=studyState.cards[TrainingTimed.active.current.dataset.index].history.at(-1);return{source:h.source,correct:h.correct}}),{source:'notebook',correct:true});
  const topValue=await page.locator('.time-top option:not([value=""])').first().getAttribute('value');await page.locator('.time-top').selectOption(topValue);assert.equal(await page.locator('.time-exam').inputValue(),'');assert.equal(await page.locator('.question:visible').count(),1);
  await page.goto(url('일반전표_기본연습_24문제.html','?timed=1&exam=all&status=all'));await page.waitForFunction(()=>window.TrainingTimed?.active?.current);
  assert.equal(await page.evaluate(()=>[...document.querySelector('.time-question').options].some(option=>problems[option.value]?.timeTraining===false)),false);
  await page.goto(url('매입매출전표_오답연습_3문제.html','?timed=1&exam=all&status=all'));await page.waitForFunction(()=>window.TrainingTimed?.active?.current);
  assert.equal(await page.evaluate(()=>[...document.querySelector('.time-question').options].some(option=>problems[option.value]?.timeTraining===false)),false);
  await page.goto(url('일반전표_기본연습_24문제.html'));assert.equal(await page.locator('.timer-panel').count(),0);assert.equal(await page.locator('.timed-kclep').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: shortcuts, balance Enter, real grading, duplicate prevention, retry history, reload/overtime, both subjects, analysis, responsive layout, normal-mode isolation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
