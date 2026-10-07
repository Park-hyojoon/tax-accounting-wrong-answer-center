const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const theoryHtml=fs.readFileSync(path.join(root,'이론_오답응용_5문제.html'),'utf8');
const voucherHtml=fs.readFileSync(path.join(root,'매입매출전표_오답연습_3문제.html'),'utf8');
const voucherSource=fs.readFileSync(path.join(root,'entry/voucher.js'),'utf8');
const oneLine=(html,name)=>html.split(/\r?\n/).find(line=>line.trim().startsWith('function '+name+'('));
const theoryGrade=theoryHtml.match(/    function grade\(card\)\{[\s\S]*?\n    \}/)[0];
const voucherGrade=oneLine(voucherSource,'grade');
function problemList(subject){
  const c={A:(side,account,amount,division='',memo='',partner='')=>({side,account,amount,division,memo,partner})};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'data/'+subject+'.js'),'utf8'),c);
  return c.loadTrainingProblems();
}
const theory=problemList('theory'),practical=problemList('practical'),vouchers=problemList('voucher');
function theoryContext(p,selected){
  const c={p,state:{answers:{[p.id]:selected},checked:{},attempts:{},history:{},passed:{},passedAt:{},trainingCenterRestored:{}},
    getProblem:()=>p,nowIso:()=> '2026-10-05T03:00:00Z',sessionPassed:new Set(),
    persist:()=>{},renderCard:()=>{},circled:['①','②','③','④']};
  vm.createContext(c);vm.runInContext([oneLine(theoryHtml,'acceptedTheoryAnswers'),oneLine(theoryHtml,'choiceText'),oneLine(theoryHtml,'theoryAnswerText'),theoryGrade].join('\n'),c);
  return c;
}
for(const [n,accepted] of [[8,[0,2]],[13,[0,3]]]){
  test('126 theory '+n+': every official accepted answer grades and records correctly',()=>{
    const p=theory.find(p=>p.id==='daily-20261005-exam126-theory-'+n);
    assert.ok(p);assert.deepEqual(Array.from(p.acceptedAnswers),accepted);
    for(let choice=0;choice<4;choice++){
      const c=theoryContext(p,choice),card={dataset:{id:p.id}};
      assert.equal(c.grade(card),accepted.includes(choice));
      assert.equal(c.state.history[p.id][0].correct,accepted.includes(choice));
      assert.equal(c.state.history[p.id][0].choice,choice);
      assert.equal(c.state.passed[p.id],accepted.includes(choice));
    }
    const c=theoryContext(p,accepted[0]);
    for(const n of accepted)assert.ok(c.theoryAnswerText(p).includes(c.circled[n]));
  });
}
test('single-answer theory behavior and unanswered guard remain unchanged',()=>{
  const p=theory.find(p=>p.id==='daily-20261005-exam126-theory-1');
  for(let n=0;n<4;n++){const c=theoryContext(p,n);assert.equal(c.grade({dataset:{id:p.id}}),n===p.answer);}
  const c=theoryContext(p,undefined),result={};c.$=()=>result;
  assert.equal(c.grade({dataset:{id:p.id}}),false);assert.deepEqual(Object.keys(c.state.history),[]);
});
function voucherContext(p,type,supply=p.voucher.supply){
  const s={},controls=new Map();
  const c={problems:[p],voucher:()=>({...p.voucher,type,supply,journal:'혼합'}),
    EntryGrading:require('../entry/grading.js'),options:{},CARD_TYPES:new Set(['17.카과','57.카과']),num:x=>Number(x)||0,normSupplier:x=>String(x||''),
    rows:()=>p.variants.find(v=>v.journal==='혼합').rows,
    rowsEqualForGrade:()=>({ok:true,matched:1,total:1}),$$:()=>[],
    $:selector=>{if(!controls.has(selector))controls.set(selector,{});return controls.get(selector)},
    cs:()=>s,save:()=>{},progress:()=>{},nowIso:()=> '2026-10-05T03:00:00Z',money:String};
  vm.createContext(c);vm.runInContext([oneLine(voucherSource,'acceptedVoucherTypes'),oneLine(voucherSource,'extraAnswer'),voucherGrade].join('\n'),c);
  return {c,s};
}
test('126 voucher 3: both official type alternatives accepted, wrong type/amount rejected',()=>{
  const p=vouchers.find(p=>p.id==='daily-20261005-exam126-voucher-3');assert.ok(p);
  for(const [type,ok] of [['14.건별',true],['22.현과',true],['11.과세',false],['17.카과',false]]){
    const {c,s}=voucherContext(p,type);
    assert.equal(c.grade({dataset:{index:'0'},classList:{toggle:()=>{}}}),ok);
    assert.equal(s.history[0].correct,ok);assert.equal(s.history[0].voucher.type,type);
  }
  const {c}=voucherContext(p,'22.현과',30001);
  assert.equal(c.grade({dataset:{index:'0'},classList:{toggle:()=>{}}}),false);
  assert.ok(c.extraAnswer(p).includes('14.건별 또는 22.현과'));
});
test('ordinary voucher still requires its single original type',()=>{
  const p=vouchers.find(p=>p.id==='daily-20261005-exam126-correction-1');
  for(const [type,ok] of [['16.수출',true],['12.영세',false]]){
    const {c}=voucherContext(p,type);assert.equal(c.grade({dataset:{index:'0'},classList:{toggle:()=>{}}}),ok);
  }
});
test('corrections retain source round, source number and visible before-journal tables',()=>{
  for(const round of [103,104,126,127]){
    const ps=[...practical,...vouchers].filter(p=>p.id.startsWith('daily-20261005-exam'+round+'-correction-'));
    assert.equal(ps.length,2);
    for(const p of ps){assert.equal(p.examRound,round);assert.match(p.sourceQuestionNo,/^문제4-\[[12]\]$/);assert.match(p.exhibit,/<table/);assert.match(p.exhibit,/수정 전/);}
  }
  for(const p of vouchers.filter(p=>/^daily-20261005-exam126-voucher-[12456]$/.test(p.id)))assert.match(p.exhibit,/<table/);
});
test('new voucher journal variants balance including automatic cash/card counterpart',()=>{
  for(const p of vouchers.filter(p=>/^daily-20261005-exam12[67]-/.test(p.id)))for(const v of p.variants){
    const debit=v.rows.filter(r=>r.side==='D').reduce((s,r)=>s+r.amount,0),credit=v.rows.filter(r=>r.side==='C').reduce((s,r)=>s+r.amount,0);
    if(v.journal==='혼합')assert.equal(debit,credit,p.id);
    else assert.equal(Math.abs(debit-credit),p.voucher.supply+p.voucher.vat,p.id);
  }
});
test('answer display/export uses complete accepted answer sets and inline scripts parse',()=>{
  assert.match(theoryHtml,/정답: \$\{theoryAnswerText\(p\)\}/);
  assert.match(theoryHtml,/- 정답: \$\{theoryAnswerText\(p\)\}/);
  assert.match(voucherSource,/- 유형: \$\{acceptedVoucherTypes\(p\)\.join/);
  for(const html of [theoryHtml,voucherHtml])for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
