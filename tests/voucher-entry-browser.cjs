const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('url');
const path=require('path');
const assert=require('assert/strict');

const root=path.resolve(__dirname,'..');

(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root,'매입매출전표_오답연습_3문제.html')).href+'?view=all&fresh=1');
    await page.waitForTimeout(300);

    const card=page.locator('.question').filter({hasText:'영업부 거래처 선물세트 구입'}).first();
    assert.equal(await card.count(),1,'target voucher card');
    await card.locator('.voucher-type').selectOption('54.불공');
    await card.locator('.supply').fill('165000');
    await card.locator('.supply').press('Enter');
    assert.equal(await card.locator('.supply').inputValue(),'150,000');
    assert.equal(await card.locator('.vat').inputValue(),'15,000');
    assert.equal(await card.locator('.card-company').isDisabled(),true);
    assert.equal(await card.locator('.service-fee').isDisabled(),true);
    assert.equal(await card.locator('.zero-rate').isDisabled(),true);
    assert.equal(await card.locator('.deduct-reason').isEnabled(),true);

    await card.locator('.voucher-type').selectOption('57.카과');
    assert.equal(await card.locator('.card-company').isEnabled(),true);
    assert.equal(await card.locator('.service-fee').isEnabled(),true);
    assert.equal(await card.locator('.zero-rate').isDisabled(),true);
    assert.equal(await card.locator('.deduct-reason').isDisabled(),true);

    await card.locator('.voucher-type').selectOption('52.영세');
    assert.equal(await card.locator('.card-company').isDisabled(),true);
    assert.equal(await card.locator('.service-fee').isDisabled(),true);
    assert.equal(await card.locator('.zero-rate').isEnabled(),true);
    assert.equal(await card.locator('.deduct-reason').isDisabled(),true);

    await card.locator('.journal').focus();
    await card.locator('.journal').press('3');
    assert.equal(await card.locator('.journal').inputValue(),'혼합');
    assert.equal(await card.locator('.journal option:checked').textContent(),'혼합(3)');

    const exemptCard=page.locator('.question').filter({hasText:'영업부 차량 운용리스료 카드 결제'}).first();
    await exemptCard.locator('.voucher-type').selectOption('53.면세');
    assert.equal(await exemptCard.locator('.card-company').isDisabled(),true,'53.면세는 윗단 카드사 입력 대상이 아님');
    assert.deepEqual(errors,[]);
    console.log('PASS: VAT split, journal number keys, type-driven extra fields');
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exit(1)});
