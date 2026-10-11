const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const C=require('../../05. 전산세무2급/js/core.js'),F=require('../../05. 전산세무2급/tests/fixtures.cjs');
const root=path.resolve(__dirname,'../..'),url=p=>pathToFileURL(path.join(root,p)).href;
async function stationary(page,card){
 await card.locator('.check-one').scrollIntoViewIfNeeded();
 const before=await page.evaluate(()=>({y:scrollY,order:[...document.querySelectorAll('.question')].map(c=>c.dataset.index)}));
 await card.locator('.check-one').click();await page.waitForTimeout(180);
 const after=await page.evaluate(()=>({y:scrollY,order:[...document.querySelectorAll('.question')].map(c=>c.dataset.index)}));
 assert.deepEqual(after.order,before.order,'grading does not move cards');assert.ok(Math.abs(after.y-before.y)<60,JSON.stringify({before,after}));
}
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const context=await b.newContext({viewport:{width:1440,height:900}});await context.route('https://**/*',r=>r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base='03. 기출문제 연습코너/';await page.goto(url(base+'review.html'));await page.locator('#comboStart').click();
 const snapshot=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('exam-20260914-review-combo')));for(const s of ['practical','voucher','theory'])assert.equal(snapshot.subjects[s].length,3);
 await page.locator('#reviewList .open-link').first().click();await page.locator('.combo-tabs').waitFor();assert.equal(await page.locator('.question:visible').count(),3);
 const practicalURL=page.url();const p=page.locator('.question:visible').first();await p.locator('.entry-toggle').evaluate(el=>el.open=true);await p.locator('.amount').first().fill('123456');
 await page.locator('.combo-tab[data-subject=voucher]').click();await page.locator('.combo-tabs').waitFor();assert.equal(await page.locator('.question:visible').count(),3);await page.locator('.question:visible').first().locator('.supply').fill('765432');
 const voucherURL=page.url();await stationary(page,page.locator('.question:visible').nth(1));
 await page.locator('.combo-tab[data-subject=theory]').click();await page.locator('.combo-tabs').waitFor();assert.equal(await page.locator('.question:visible').count(),3);await page.locator('.question:visible').first().locator('input[type=radio]').first().check();
 await page.locator('.combo-tab[data-subject=practical]').click();await page.locator('.combo-tabs').waitFor();assert.equal(await page.locator('.question:visible').first().locator('.amount').first().inputValue(),'123,456');
 await page.goto(voucherURL);await page.locator('.combo-tabs').waitFor();assert.equal(await page.locator('.question:visible').first().locator('.supply').inputValue(),'765,432');
 assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('exam-20260914-review-combo')).subjects),snapshot.subjects);
 await page.goto(url(base+'매입매출전표_오답연습_3문제.html')+'?view=all&weakrefs=121,2,128');await page.locator('.question:visible').nth(1).waitFor();await stationary(page,page.locator('.question:visible').nth(1));
 console.log('PASS accounting: fixed 3×3, tab drafts, grading scroll/order');
 const state=C.fresh();state.items=['practical','voucher','theory'].flatMap(s=>[0,1,2].map(i=>{const p=F[s](s+'-'+i);if(s==='voucher')p.initialEntry={subject:s,voucher:{...p.voucher,journal:p.variants[0].journal},rows:C.clone(p.variants[0].rows)};return C.validateItem(p)}));
 await page.goto(url('05. 전산세무2급/index.html'));await page.locator('h1').waitFor();await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:C.KEY,state});
 await page.goto(url('05. 전산세무2급/pages/review.html'));await page.locator('#combo-start').click();await page.locator('.combo-tabs').waitFor();
 await page.locator('.combo-tab[data-subject=practical]').click();await page.locator('.question').nth(2).waitFor();await page.locator('.amount').first().fill('654321');
 await page.locator('.combo-tab[data-subject=voucher]').click();await page.locator('.question').nth(2).waitFor();await page.locator('.supply').first().fill('345678');await stationary(page,page.locator('.question').nth(1));
 assert.equal(await page.locator('.question').nth(1).getAttribute('data-correct'),'true','correct grading stays in place too');assert.match(await page.locator('.combo-tab[data-subject=voucher]').innerText(),/1\/3/);
 await page.locator('.combo-tab[data-subject=theory]').click();await page.locator('.theory-card').nth(2).waitFor();
 await page.locator('.theory-card').first().locator('input[value="1"]').check();await page.locator('.theory-card').nth(1).locator('input[value="1"]').check();assert.equal(await page.locator('.theory-card input:checked').count(),2);
 await page.locator('.theory-card').first().locator('.check-one').click();assert.match(await page.locator('.combo-tab[data-subject=theory]').innerText(),/1\/3/);
 await page.locator('.combo-tab[data-subject=practical]').click();await page.locator('.question').nth(2).waitFor();assert.equal(await page.locator('.amount').first().inputValue(),'654,321');
 await page.locator('.combo-tab[data-subject=voucher]').click();await page.locator('.question').nth(2).waitFor();assert.equal(await page.locator('.supply').first().inputValue(),'345,678');
 await page.setViewportSize({width:390,height:850});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile width');
 assert.deepEqual(errors,[]);console.log('PASS Semuon: 3×3, independent theory radios, progress, draft return, stationary grading, mobile width');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
