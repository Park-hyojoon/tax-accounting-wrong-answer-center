const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {pathToFileURL}=require('url'),path=require('path'),assert=require('assert/strict');
const url=pathToFileURL(path.join(__dirname,'..','매입매출전표_오답연습_3문제.html')).href+'?view=all';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage();page.on('pageerror',error=>console.error(error.message));await page.goto(url);
  const index=await page.evaluate(()=>problems.length-1);
  await page.evaluate(index=>{
   localStorage.setItem('exam-20260914-voucher',JSON.stringify({cards:{[index]:{voucher:{type:'11.과세',trade:'sales',supply:'5,000,000'},rows:[{side:'C',account:'기계장치',amount:'5,000,000',autoRole:'base'}],graded:true,correct:false,attempts:5,wrongCount:5,history:[{at:'2026-10-01T09:00:00+09:00',correct:false,voucher:{type:'11.과세',supply:'5,000,000'},rows:[]}],starred:true}}}));
   for(const subject of ['theory','practical','voucher'])localStorage.setItem(`exam-20260914-${subject}-marks-v1`,'{}');
   localStorage.removeItem('exam-20260914-marks-cleared-20261001');
  },index);
  await page.goto(url);
  const card=page.locator(`.question[data-index="${index}"]`);
  assert.equal(await card.locator('.supply').inputValue(),'');
  assert.equal(await card.locator('.account').first().inputValue(),'');
  assert.equal(await page.evaluate(index=>state.cards[index].wrongCount,index),5);
  assert.equal(await page.evaluate(index=>state.cards[index].history.length,index),1);
  assert.equal(await card.getByText('이전 제출 답안 보기',{exact:true}).count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('exam-20260914-theory-marks-v1')),null);
  await card.locator('.supply').evaluate(element=>{element.value='123,000';element.dispatchEvent(new Event('input',{bubbles:true}))});await page.reload();
  assert.equal(await card.locator('.supply').inputValue(),'123,000','reload restores active draft');
  assert.equal(await page.evaluate(()=>formatNumber('5,000,000')),'5,000,000');
  await page.goto(url);assert.equal(await card.locator('.supply').inputValue(),'','new visit starts blank');
  assert.equal(await page.evaluate(index=>state.cards[index].history.length,index),1);
  console.log('PASS: fresh visits, reload drafts, preserved history, old mark removal and comma amounts');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
