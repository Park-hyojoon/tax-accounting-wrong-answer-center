const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('url');
const path=require('path');
const assert=require('assert/strict');

(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(pathToFileURL(path.resolve(__dirname,'..','일반전표_기본연습_24문제.html')).href+'?view=all&fresh=1');
    const card=page.locator('.question').filter({hasText:'외화장기차입금 일부 상환'}).first();
    const table=card.locator('.exhibit-table table');
    assert.equal(await table.count(),1);
    assert.equal(await table.locator('tr').count(),4);
    const text=await table.innerText();
    for(const value of ['차입일','직전 결산일','상환일','1,150원/$','1,180원/$','1,240원/$'])assert.ok(text.includes(value),value);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    console.log('PASS: foreign loan exchange-rate source table renders on mobile');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
