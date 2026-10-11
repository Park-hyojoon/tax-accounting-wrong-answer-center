const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('url');
const path=require('path');
const assert=require('node:assert/strict');

const root=path.resolve(__dirname,'..');
const url=name=>pathToFileURL(path.join(root,name)).href;

(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url('review.html'));
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('sidebar-collapsed')),false);
    assert.match(await page.locator('.review-muted').first().evaluate(el=>getComputedStyle(el).fontFamily),/NanumGothic/);
    assert.match(await page.locator('.nav-link').first().evaluate(el=>getComputedStyle(el).fontFamily),/학습센터 둥근글꼴/);
    await page.keyboard.press('Control+b');
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('sidebar-collapsed')),true);
    assert.equal(await page.locator('.top-nav').getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('.sidebar-reopen').isVisible(),true);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).paddingLeft),'0px');
    await page.locator('#reviewLimit').focus();
    await page.keyboard.press('Control+b');
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('sidebar-collapsed')),true);
    await page.goto(url('이론_오답응용_5문제.html')+'?view=all');
    console.log('theory page:',page.url(),'questions:',await page.locator('.question').count(),'errors:',errors,'body:',(await page.locator('body').innerText()).slice(0,300));
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('sidebar-collapsed')),true);
    assert.match(await page.locator('.question .prompt').first().evaluate(el=>getComputedStyle(el).fontFamily),/NanumGothic/);
    assert.match(await page.locator('.question .detail-body').first().evaluate(el=>getComputedStyle(el).fontFamily),/NanumGothic/);
    await page.locator('.sidebar-reopen').click();
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('sidebar-collapsed')),false);
    assert.equal(await page.locator('.top-nav').getAttribute('aria-hidden'),null);
    await page.keyboard.press('Control+b');
    await page.keyboard.press('Control+b');
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('sidebar-collapsed')),false);
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS: reading font, Ctrl+B sidebar toggle, persistence, editable-field guard');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
