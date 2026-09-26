const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('url');
const path=require('path');
const assert=require('assert/strict');

(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(pathToFileURL(path.resolve(__dirname,'..','이론_오답응용_5문제.html')).href);
    for(const [id,rows,needles] of [
      ['practice-20260926-merchandise-profit-loss',2,['기초상품','당기순손익','610,000원']],
      ['exam123-overhead-allocation-recurrence-variant-20260926',4,['제조지시서#2','직접노무비','450,000원']]
    ]){
      const card=page.locator(`.question[data-id="${id}"]`),table=card.locator('table.source-table');
      assert.equal(await table.count(),1);assert.equal(await table.locator('tr').count(),rows);
      const text=await table.innerText();needles.forEach(value=>assert.ok(text.includes(value),`${id}: ${value}`));
      assert.equal(await card.locator('.data-box').evaluate(box=>box.scrollWidth>box.clientWidth),true);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    console.log('PASS: attached source tables render with mobile-contained scrolling');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
