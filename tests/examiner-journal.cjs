const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'examiner-test/journal-bank.js'),'utf8'),context);
const bank=JSON.parse(JSON.stringify(context.window.ExaminerJournalBank)),J=require('../examiner-test/journal.js');
const entry=q=>({voucher:Object.fromEntries(Object.entries(q.voucher||{}).map(([key,value])=>[key,String(value)])),rows:q.rows.map(r=>({side:r.side,account:r.account,amount:String(r.amount),division:r.division||'',partner:r.partner||''}))});
test('two general and two sales-purchase vouchers have balanced, distinct reviewed answers',()=>{
  J.validateBank(bank);assert.equal(bank.filter(q=>q.kind==='practical').length,2);assert.equal(bank.filter(q=>q.kind==='voucher').length,2);
  assert.equal(new Set(bank.map(q=>q.id)).size,4);
  for(const q of bank){assert.ok(J.check(q,entry(q)).correct);assert.ok(q.review&&q.novelty&&q.explanation)}
});
test('journal matching ignores row order and normalizes company name but rejects missing or extra rows and mandatory fields',()=>{
  const q=bank.find(q=>q.id==='committee-practical-note-20261005'),input=entry(q);input.rows.reverse();input.rows[0].partner='(주)푸른상회';assert.ok(J.check(q,input).correct);
  input.rows[0].partner='다른 회사';assert.equal(J.check(q,input).correct,false);
  input.rows[0].partner='㈜푸른상회';input.rows.push({...input.rows[0]});assert.equal(J.check(q,input).correct,false);
  const wage=bank.find(q=>q.id==='committee-practical-payroll-20261005'),wrong=entry(wage);wrong.rows.find(r=>r.account==='복리후생비').division='';assert.deepEqual(J.check(wage,wrong).missing,['분개 행']);
});
test('voucher date, type, amount, tax, supplier, electronic status and journal are independently graded',()=>{
  const q=bank.find(q=>q.kind==='voucher');for(const [key,value] of Object.entries({date:'2026-10-16',type:'51.과세',supply:'2100000',vat:'0',supplier:'다른 회사',electronic:'부',journal:'카드'})){const input=entry(q);input.voucher[key]=value;const result=J.check(q,input);assert.equal(result.correct,false);assert.equal(result.missing.length,1)}
  const input=entry(q);input.rows.reverse();input.voucher.supply='2,000,000원';assert.ok(J.check(q,input).correct);
});
test('journal state rejects foreign seasons without mutating earlier valid records',()=>{
  const state={schemaVersion:1,season:'exam-20260914',drafts:{},history:[{id:'one',at:'2026-10-05T12:00:00Z',questionId:bank[0].id,entry:entry(bank[0]),correct:true}]};
  assert.equal(J.validateState(state).history.length,1);assert.throws(()=>J.validateState({...state,season:'old'}));assert.equal(state.history.length,1);
});
