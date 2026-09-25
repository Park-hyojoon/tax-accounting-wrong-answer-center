const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),out=path.join(os.tmpdir(),'vat-concept-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(root,'개념_정리.html')).href);
   assert.equal(await page.locator('.chapter').count(),8);
   assert.equal(await page.locator('.answer:visible').count(),0);
   await page.locator('.quiz button').first().click();assert.equal(await page.locator('.answer:visible').count(),1);
   assert.equal(await page.locator('.chapter:visible').count(),8);
   const sizes=await page.evaluate(()=>({body:getComputedStyle(document.querySelector('.chapter>p:not(.focus):not(.key)')).fontSize,table:getComputedStyle(document.querySelector('td')).fontSize,toc:getComputedStyle(document.querySelector('.toc a')).fontSize,overflow:document.documentElement.scrollWidth>innerWidth}));
   assert.equal(sizes.body,sizes.table);assert.equal(sizes.body,sizes.toc);assert.equal(sizes.overflow,false);
   await page.evaluate(()=>{const node=document.querySelector('.key').firstChild,range=document.createRange();range.setStart(node,0);range.setEnd(node,7);const s=getSelection();s.removeAllRanges();s.addRange(range)});
   await page.waitForFunction(()=>!document.querySelector('[data-mark="highlight"]').disabled);
   await page.locator('[data-mark="highlight"]').click();
   await page.locator('[data-mark="underline"]').click();
   await page.locator('[data-mark="bold"]').click();
   assert.ok(await page.locator('.key .mark-highlight.mark-underline.mark-bold').count());
   await page.reload();assert.ok(await page.locator('.key .mark-highlight.mark-underline.mark-bold').count());
   await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('.key'));getSelection().removeAllRanges();getSelection().addRange(range)});
   await page.waitForFunction(()=>!document.querySelector('[data-mark="clear"]').disabled);await page.locator('[data-mark="clear"]').click();assert.equal(await page.locator('.key .mark-highlight').count(),0);
   await page.locator('#undoMark').click();assert.ok(await page.locator('.key .mark-highlight').count());
   await page.locator('.note-editor summary').first().click();
   const note='발급 면제는 과세 면제가 아니다.\n<내 메모 & 확인>';
   await page.locator('textarea').first().fill(note);await page.reload();
   assert.equal(await page.locator('textarea').first().inputValue(),note);
   await page.locator('.backup-tools summary').click();
   let savedBackup;
   for(const [button,ext] of [['downloadMd','md'],['downloadTxt','txt'],['backupNotes','json']]){
    const waiting=page.waitForEvent('download');await page.locator('#'+button).click();const file=await waiting;
    const content=fs.readFileSync(await file.path(),'utf8');assert.ok(content.includes(ext==='json'?JSON.stringify(note).slice(1,-1):note));
    if(ext==='md'){assert.ok(content.includes('법령 확인:'));assert.ok(content.includes('정답:'));assert.ok(content.includes('<mark><u><strong>'));}
    if(ext==='json')savedBackup=JSON.parse(content.replace(/^\uFEFF/,''));
   }
   const backup=savedBackup;backup.notes.invoice='다른 기기에서 정리한 메모';
   await page.evaluate(()=>localStorage.removeItem('exam-20260914-concept-marks-v1'));await page.reload();
   assert.equal(await page.locator('.key .mark-highlight').count(),0);await page.locator('.backup-tools summary').click();
   page.once('dialog',d=>d.accept());
   await page.locator('#importNotes').setInputFiles({name:'notes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
   await page.waitForLoadState();await page.waitForFunction(()=>document.querySelector('textarea').value==='다른 기기에서 정리한 메모');
   assert.ok(await page.locator('.key .mark-highlight.mark-underline.mark-bold').count(),'backup restores text annotations');
   await page.screenshot({path:path.join(out,`concept-${width}.png`),fullPage:false});
   await page.locator('#invoice').screenshot({path:path.join(out,`chapter-${width}.png`)});
   if(width===1440){await page.pdf({path:path.join(out,'notes-print.pdf'),format:'A4',printBackground:true});}
   for(const file of ['오답_훈련센터.html','이론_오답응용_5문제.html','일반전표_기본연습_24문제.html','매입매출전표_오답연습_3문제.html','약점_분석_임시.html']){
    await page.goto(pathToFileURL(path.join(root,file)).href);
    assert.equal(await page.locator('a.nav-concepts').count(),1,file);
    if(width===390)await page.locator('.nav-menu-toggle').click();
    assert.equal(await page.locator('a.nav-concepts').isVisible(),true,file);
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: 8 chapters, answer reveal, readable tables/menu, mobile width, private notes persistence, downloads/import, navigation. QA: '+out);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
