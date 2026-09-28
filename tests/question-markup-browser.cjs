const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('url'),path=require('path'),assert=require('assert/strict');
const url=pathToFileURL(path.join(__dirname,'..','매입매출전표_오답연습_3문제.html')).href+'?view=all';
const key='exam-20260914-voucher-marks-v1';

async function select(root,start,end){
  await root.scrollIntoViewIfNeeded();
  return root.evaluate((element,{start,end})=>{
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())if(walker.currentNode.data.length)nodes.push(walker.currentNode);
    const locate=at=>{for(const node of nodes){if(at<=node.data.length)return [node,at];at-=node.data.length}throw Error('offset')};
    const range=document.createRange(),[a,ao]=locate(start),[b,bo]=locate(end);range.setStart(a,ao);range.setEnd(b,bo);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
    const rect=Array.from(range.getClientRects()).find(rect=>rect.width&&rect.height);
    return {x:rect.left+Math.min(4,rect.width/2),y:rect.top+rect.height/2,text:range.toString()};
  },{start,end});
}
async function open(page,root,start,end){
  const position=await select(root,start,end);
  await page.mouse.click(position.x,position.y,{button:'right'});
  assert.equal(await page.locator('.question-mark-popup').isVisible(),true,'right click opens mini popup without losing selection');
}
async function mark(page,kind){await page.locator(`[data-question-mark="${kind}"]`).click()}
async function styleAt(root,at){return root.evaluate((element,at)=>{
  const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);while(walker.nextNode()){
    const node=walker.currentNode;if(at<node.data.length)return node.parentElement.closest('.question-mark')?.className||'';at-=node.data.length;
  }return '';
},at)}

(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
    await context.route('https://**/*',route=>route.abort());page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);
    const root=page.locator('.question .prompt').first(),popup=page.locator('.question-mark-popup');
    const original=await root.textContent(),html=await root.innerHTML();
    const problemsBefore=await page.evaluate(()=>JSON.stringify(problems));
    const stateBefore=await page.evaluate(()=>localStorage.getItem('exam-20260914-voucher'));
    await root.scrollIntoViewIfNeeded();
    const bounds=await root.boundingBox(),from={x:bounds.x+60,y:bounds.y+25},to={x:bounds.x+280,y:bounds.y+25};
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();
    assert.ok(await page.evaluate(()=>getSelection().toString().length>5),'real mouse drag selects problem text');
    await page.mouse.click((from.x+to.x)/2,from.y,{button:'right'});assert.equal(await popup.isVisible(),true);
    await page.keyboard.press('Escape');
    await open(page,root,0,20);await mark(page,'highlight');await mark(page,'red');await mark(page,'underline');
    assert.match(await styleAt(root,2),/qm-highlight/);assert.match(await styleAt(root,2),/qm-red/);assert.match(await styleAt(root,2),/qm-underline/);
    await page.screenshot({path:'C:/Users/MyPC/.codex/visualizations/2026/09/01/01a05c39-c06e-7750-82bd-c9d952df7f8e/question-mark-popup.png'});
    await page.keyboard.press('Escape');assert.equal(await popup.isHidden(),true);
    await open(page,root,5,10);await mark(page,'blue');
    assert.match(await styleAt(root,6),/qm-blue/);assert.doesNotMatch(await styleAt(root,6),/qm-red/);
    assert.match(await styleAt(root,2),/qm-red/,'color replacement preserves outside range');
    await mark(page,'clear');assert.equal(await styleAt(root,6),'');assert.match(await styleAt(root,2),/qm-highlight/);
    await page.locator('.question-mark-undo').click();assert.match(await styleAt(root,6),/qm-blue/);assert.match(await styleAt(root,6),/qm-highlight/);
    assert.equal(await root.textContent(),original,'problem wording never changes');
    assert.equal(await page.evaluate(()=>JSON.stringify(problems)),problemsBefore,'problem answer/data objects untouched');
    assert.equal(await page.evaluate(()=>localStorage.getItem('exam-20260914-voucher')),stateBefore,'annotations do not alter grades/history');
    await page.reload();assert.match(await styleAt(root,6),/qm-blue/,'marks persist across reload');
    await open(page,root,0,original.length);await mark(page,'clear');assert.equal(await root.innerHTML(),html,'clearing restores original HTML, not flattened text');
    await page.keyboard.press('Escape');

    const exhibit=page.locator('.question .exhibit').filter({has:page.locator('table')}).first();
    const evidence=await exhibit.evaluate(el=>({text:el.textContent,cells:Array.from(el.querySelectorAll('th,td')).map(cell=>({tag:cell.tagName,text:cell.textContent,span:cell.getAttribute('colspan')}))}));
    await open(page,exhibit,0,evidence.text.length);await mark(page,'green');await mark(page,'highlight');
    assert.deepEqual(await exhibit.evaluate(el=>({text:el.textContent,cells:Array.from(el.querySelectorAll('th,td')).map(cell=>({tag:cell.tagName,text:cell.textContent,span:cell.getAttribute('colspan')}))})),evidence,'receipt/table structure and numbers preserved');
    assert.ok(await exhibit.locator('.qm-green.qm-highlight').count());
    const saved=await page.evaluate(key=>localStorage.getItem(key),key);
    await page.reload();assert.ok(await exhibit.locator('.qm-green.qm-highlight').count());
    // A native context menu is retained for inputs and nonselected problem text.
    await select(root,0,5);
    assert.equal(await page.locator('.supply').first().evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:20,clientY:20}))),true);
    assert.equal(await popup.isHidden(),true);
    await page.evaluate(()=>getSelection().removeAllRanges());
    assert.equal(await root.evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))),true);
    assert.equal(await popup.isHidden(),true);
    // Popup remains inside the screen at the bottom-right edge.
    await select(root,0,5);
    await root.evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:innerWidth-1,clientY:innerHeight-1})));
    assert.equal(await popup.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}),true);
    // A failed save must not change visible marks or existing saved annotations.
    await page.evaluate(key=>{const original=Storage.prototype.setItem;window.restoreMarkStorage=()=>{Storage.prototype.setItem=original};Storage.prototype.setItem=function(k,v){if(k===key)throw Error('quota');return original.call(this,k,v)}},key);
    await mark(page,'red');assert.match(await page.locator('.question-mark-status').innerText(),/저장하지 못/);
    assert.equal(await popup.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),true,'long save error stays inside viewport');
    assert.equal(await root.locator('.question-mark').count(),0);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved);
    await page.evaluate(()=>restoreMarkStorage());
    await page.keyboard.press('Escape');
    await page.evaluate(key=>localStorage.setItem(key,'{invalid'),key);await page.reload();
    await open(page,root,0,5);
    assert.equal(await page.locator('[data-question-mark="red"]').isDisabled(),true,'unreadable existing annotations are protected');
    assert.match(await page.locator('.question-mark-status').innerText(),/기존 표시를 읽지 못/);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),'{invalid','bad saved data is not overwritten');
    assert.deepEqual(errors,[]);
    await context.close();

    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await mobile.route('https://**/*',route=>route.abort());const phone=await mobile.newPage();await phone.goto(url);
    const mobileRoot=phone.locator('.prompt').first();await select(mobileRoot,0,5);
    assert.equal(await mobileRoot.evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))),true,'mobile native long-press/copy stays intact');
    assert.equal(await phone.locator('.question-mark-popup').isHidden(),true);
    assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await mobile.close();
    console.log('PASS: right-click popup, combined styles, partial clear/color replacement/undo, persistence, table/source/history preservation, native menus and save failure');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
