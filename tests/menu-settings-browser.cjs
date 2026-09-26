const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('url');
const path=require('path');
const assert=require('assert/strict');

const root=path.resolve(__dirname,'..');
const url=name=>pathToFileURL(path.join(root,name)).href;

(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url('오답_훈련센터.html'));
    await page.locator('.nav-settings-button').click();
    assert.equal(await page.locator('.menu-order-item').count(),8);
    assert.equal(await page.locator('.menu-order-item').first().innerText().then(text=>text.includes('오늘의 오답훈련')),true);
    await page.locator('.menu-order-item').first().locator('[data-move="down"]').click();
    await page.locator('.menu-save').click();
    assert.equal(await page.locator('.nav-links .nav-link').first().getAttribute('data-menu-id'),'theory');
    const saved=await page.evaluate(()=>TrainingGitHub.readUiSettings());
    assert.equal(saved.menuOrder[0],'theory');assert.ok(saved.updatedAt);
    assert.deepEqual(await page.evaluate(()=>TrainingGitHub.backupPayload().uiSettings.menuOrder),saved.menuOrder);

    await page.goto(url('이론_오답응용_5문제.html'));
    assert.equal(await page.locator('.nav-links .nav-link').first().getAttribute('data-menu-id'),'theory');
    const newer={menuOrder:['timed','home','theory','practical','voucher','special','concepts','analysis'],updatedAt:'2099-01-01T00:00:00.000Z'};
    assert.equal(await page.evaluate(value=>TrainingGitHub.mergeUiSettings(value),newer),true);
    await page.reload();
    assert.equal(await page.locator('.nav-links .nav-link').first().getAttribute('data-menu-id'),'timed');

    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),mobilePage=await mobile.newPage();
    await mobilePage.goto(url('오답_훈련센터.html'));await mobilePage.locator('.nav-settings-button').click();
    assert.equal(await mobilePage.locator('.menu-settings').getAttribute('open'),'');
    assert.equal(await mobilePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.deepEqual(errors,[]);
    await mobile.close();
    console.log('PASS: menu reorder, persistence, backup/sync merge, mobile dialog');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
