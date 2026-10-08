const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const crypto=require('node:crypto'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
// Captured before the 2026-10-08 typography change, at both viewport sizes.
const voucherFontDigest='8b6a3a5e419a47045642a17fc498a75b5f123d9cc37d5e07d18c7b0344cb0078';
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{const samples={};for(const width of [390,1440]){const context=await browser.newContext({viewport:{width,height:950}});await context.route('https://**/*',r=>r.abort());const page=await context.newPage();
for(const file of ['매입매출전표_오답연습_3문제.html','review.html','일반전표_기본연습_24문제.html','이론_오답응용_5문제.html','오답_훈련센터.html?weakness=1','개념_정리.html','examiner-test/index.html']){
const parts=file.split('?');await page.goto(pathToFileURL(path.join(root,parts[0])).href+(parts[1]?'?'+parts[1]:''));await page.evaluate(()=>document.fonts.ready);
if(file.startsWith('매입'))samples[width]=await page.locator('.question').first().evaluate(q=>[q,...q.querySelectorAll('*')].map(e=>getComputedStyle(e).fontSize));
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),file+' no page overflow');
const small=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>!e.closest('.entry-voucher .question')&&e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&parseFloat(getComputedStyle(e).fontSize)<14).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.trim().slice(0,30),size:getComputedStyle(e).fontSize})));assert.deepEqual(small,[],file+' minimum text size');
if(width>760 && await page.locator('.page-head').count()){const bounds=await page.evaluate(()=>({title:document.querySelector('.page-title')?.getBoundingClientRect().top,brand:document.querySelector('.nav-brand')?.getBoundingClientRect().top,date:document.querySelector('.page-date')?.getBoundingClientRect().right,head:document.querySelector('.page-head')?.getBoundingClientRect().right}));assert.ok(Math.abs(bounds.title-bounds.brand)<=1,file+' aligned heading '+JSON.stringify(bounds));assert.ok(bounds.date<=bounds.head,file+' date right');}
if(file==='review.html')await page.screenshot({path:path.join(root,'output/typography-'+width+'.png'),fullPage:true});
}await context.close();}
for(const sizes of Object.values(samples))assert.equal(crypto.createHash('sha256').update(JSON.stringify(sizes)).digest('hex'),voucherFontDigest,'voucher question fonts unchanged');console.log('Typography, heading alignment and voucher preservation passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
