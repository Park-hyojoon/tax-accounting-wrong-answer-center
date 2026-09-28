const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('url');
const path=require('path');
const assert=require('assert/strict');

const root=path.resolve(__dirname,'..');
const pages=['매입매출전표_오답연습_3문제.html','일반전표_기본연습_24문제.html'];
const url=name=>pathToFileURL(path.join(root,name)).href+'?view=all';

// OS 선택창 자체는 실제 휴대폰에서 표시된다. 여기서는 기본 이벤트가
// 차단되지 않는지, 선택/저장/복원과 PC 검색이 정상인지 확인한다.
async function nativeSelection(page,selector){
  const field=page.locator(selector).first();
  const allowed=await field.evaluate(select=>select.dispatchEvent(new PointerEvent('pointerdown',{
    bubbles:true,cancelable:true,pointerType:'touch'
  })));
  assert.equal(allowed,true,'touch must reach the browser native picker');
  assert.equal(await page.locator('.account-search-overlay').isHidden(),true);
  assert.equal(await page.locator('.account-search-input').evaluate(el=>el===document.activeElement),false);
  const value=await field.evaluate(select=>Array.from(select.options).find(option=>option.value&&!option.disabled&&option.value!==select.value)?.value);
  assert.ok(value,'an alternative option exists');
  await field.selectOption(value);
  assert.equal(await field.inputValue(),value,'native change applies');
  return value;
}

(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    for(const name of pages){
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(url(name));
      await page.locator('details.entry-toggle').evaluateAll(details=>details.forEach(el=>{el.open=true}));
      await page.locator('.question select.account').first().waitFor();
      const account=await nativeSelection(page,'.question select.account');
      const partnerSelector='.question select.partner:not(:disabled)';
      const partner=await page.locator(partnerSelector).count()?await nativeSelection(page,partnerSelector):null;
      await page.reload();
      assert.equal(await page.locator('.question select.account').first().inputValue(),account,'account survives reload');
      if(partner!==null)assert.equal(await page.locator(partnerSelector).first().inputValue(),partner,'partner survives reload');
      assert.deepEqual(errors,[]);
      await context.close();
    }

    const tablet=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true});
    const tabletPage=await tablet.newPage();
    await tabletPage.goto(url(pages[0]));
    assert.equal(await tabletPage.evaluate(()=>matchMedia('(pointer:coarse)').matches),true);
    await nativeSelection(tabletPage,'.question select.account');
    await tablet.close();

    const desktop=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await desktop.newPage();
    await page.goto(url(pages[0]));
    const account=page.locator('.question select.account').first();
    const option=await account.evaluate(select=>{const item=Array.from(select.options).find(el=>el.value&&!el.disabled);return {value:item.value,label:item.textContent.trim()}});
    await account.click();
    assert.equal(await page.locator('.account-search-overlay').isVisible(),true,'desktop still opens quick search');
    await page.locator('.account-search-input').fill(option.label);
    await page.locator('.account-search-overlay').getByRole('option',{name:option.label,exact:true}).click();
    assert.equal(await account.inputValue(),option.value);
    assert.equal(await page.locator('.account-search-overlay').isHidden(),true);
    await desktop.close();
    console.log('PASS: phone/tablet native selection, account/partner persistence, desktop quick search');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
