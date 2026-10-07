// 출제위원 화면의 「지금 출제하기」 전체 흐름을 실제 브라우저로 확인한다.
// tests/examiner-auto-e2e.py 가 임시 폴더, 가짜 Codex를 쓰는 도우미(포트 8791), 임시 웹 서버(포트 8792)를 준비한 뒤 이 파일을 실행한다.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict');
const web=process.env.EXAMINER_WEB||'http://127.0.0.1:8792',helper=process.env.EXAMINER_HELPER||'http://127.0.0.1:8791';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.EXAMINER_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await context.addInitScript(url=>{try{localStorage.setItem('tax-accounting-helper-url',url)}catch{}},helper);
    await page.goto(web+'/examiner-test/index.html');
    assert.equal(await page.locator('#request-guide').isHidden(),true);
    await page.locator('#request-help').click();
    await page.waitForFunction(()=>document.querySelector('#auto-state').dataset.ok==='1');
    assert.match(await page.locator('#auto-state').innerText(),/연결되었습니다/);
    assert.equal(await page.locator('#manual-request').evaluate(d=>d.open),false);
    // 문항 수 조절과 합계
    await page.locator('#auto-theory').selectOption('1');await page.locator('#auto-practical').selectOption('1');await page.locator('#auto-voucher').selectOption('1');
    assert.match(await page.locator('#auto-total').innerText(),/합계 3문항/);
    await page.locator('#auto-theory').selectOption('4');await page.locator('#auto-practical').selectOption('4');await page.locator('#auto-voucher').selectOption('4');
    assert.equal(await page.locator('#auto-run').isDisabled(),true);
    await page.locator('#auto-theory').selectOption('1');await page.locator('#auto-practical').selectOption('1');await page.locator('#auto-voucher').selectOption('1');
    assert.equal(await page.locator('#auto-run').isDisabled(),false);
    // 출제 → 독립 재풀이 → 자동 등록
    await page.locator('#auto-run').click();
    await page.waitForFunction(()=>/추가했습니다/.test(document.querySelector('#auto-state').textContent),null,{timeout:60000});
    const result=await page.locator('#auto-result').innerText();
    assert.match(result,/이론 1문항 · 전표 2문항/);assert.match(result,/걸러진 후보 3건/);
    assert.equal(await page.locator('[data-open]').count(),3);
    // 새로 추가된 이론 문제가 바로 열린다
    await page.locator('[data-open=theory]').click();
    await page.locator('.question').first().waitFor();
    assert.equal(await page.locator('.question').count(),1);
    assert.match(await page.locator('#practice-title').innerText(),/자동 출제/);
    const card=page.locator('.question').first();
    assert.equal(await card.locator('.audit').isHidden(),true);
    await card.locator('input[value="1"]').check();await card.locator('.grade').click();
    assert.match(await card.locator('.grade-result').innerText(),/정답/);
    const audit=await card.locator('.audit').evaluate(d=>{d.open=true;return d.innerText});
    assert.match(audit,/9개 기준 AI 1차 검토/);assert.match(audit,/독립 재풀이 일치/);assert.match(audit,/자동 점검/);assert.match(audit,/인증 아님/);
    assert.equal(await card.locator('.audit .review-table tr').count(),9);
    assert.match(await page.locator('#trial-summary').innerText(),/AI가 후보를 거른 과정/);
    // 전표 문제도 새 묶음이 먼저 보이고, 매입·매출별 유형코드과 보조 항목이 입력창에 있다
    await page.locator('#start-mode').click();await page.locator('[data-subject=voucher]').click();
    await page.locator('.journal-card').first().waitFor();
    assert.equal(await page.locator('.journal-card').count(),3);
    assert.match(await page.locator('.journal-card').first().innerText(),/자동 출제/);
    assert.equal(await page.locator('.journal-card').first().locator('.voucher-type option').count(),13);
    await page.locator('#start-mode').click();await page.locator('[data-subject=practical]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.journal-card').length===3);
    // 같은 묶음은 다시 추가되지 않고, 새로고침 후에도 보존된다
    await page.reload();
    await page.locator('#start-mode').click();await page.locator('[data-subject=theory]').click();
    await page.locator('.question').first().waitFor();assert.match(await page.locator('#practice-title').innerText(),/자동 출제/);
    assert.deepEqual(errors,[]);
    // 도우미가 없으면 수동 안내로 바뀐다
    const offline=await browser.newContext(),offlinePage=await offline.newPage();
    await offline.addInitScript(()=>{try{localStorage.setItem('tax-accounting-helper-url','http://127.0.0.1:9')}catch{}});
    await offlinePage.goto(web+'/examiner-test/index.html');await offlinePage.locator('#request-help').click();
    await offlinePage.waitForFunction(()=>/꺼져 있거나/.test(document.querySelector('#auto-state').textContent));
    assert.equal(await offlinePage.locator('#manual-request').evaluate(d=>d.open),true);assert.equal(await offlinePage.locator('#auto-run').isDisabled(),true);
    console.log('PASS: 도우미 연결 표시, 문항 수 제한, 출제→재풀이→자동 등록, 새 문제 바로 열기, 검토표·자동 점검, 전표 묶음 우선 표시, 새로고침 보존, 도우미 없음 안내');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
