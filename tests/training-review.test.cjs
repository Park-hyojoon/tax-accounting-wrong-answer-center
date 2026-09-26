const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},console};sandbox.window=sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../github-learning-sync.js'),'utf8'),sandbox);
const api=sandbox.TrainingGitHub;
const at=['2026-09-25T14:59:59.999Z','2026-09-25T15:00:00.000Z','2026-09-26T01:00:00.000Z','2026-09-26T02:00:00.000Z'];
const event=(id,correct,time,more={})=>({id,correct,at:time,...more});
function state(subject,card,updatedAt=at[3]){
  if(subject!=='theory')return {schemaVersion:'exam-20260914-practical-schema',updatedAt,cards:{0:card}};
  const s={updatedAt};for(const [key,value] of Object.entries(card))s[key==='correct'?'checked':key]={'0':value};return s;
}
for(const subject of ['theory','practical','voucher']){
  const review=card=>api.recentReview(subject,'0',state(subject,card));
  test(subject+': fixed KST cutoff, all grading sources, no legacy counts',()=>{
    assert.equal(review({wrongCount:99,correct:false,history:[event('old',false,at[0]),{correct:false,at:'bad'}]}),null);
    for(const source of [undefined,'timed','notebook'])assert.equal(review({history:[event('new',false,at[1],{source})]}).count,1);
    assert.equal(review({history:[event('cancelled',false,at[2],{cancelledAt:at[3]})]}),null);
    assert.equal(review({deleted:true,history:[event('deleted',false,at[2])]}),null);
  });
  test(subject+': wrong/pass/wrong chronology overrides stale pass flags',()=>{
    const card={passed:true,correct:true,passedAt:at[0],history:[event('pass-old',true,at[0]),event('wrong',false,at[1])]};
    assert.equal(review(card).count,1);assert.equal(api.isCompleted(subject,'0',state(subject,card)),false);
    card.history.push(event('pass',true,at[2]));card.passedAt=at[2];assert.equal(review(card),null);
    card.history.push(event('wrong-again',false,at[3]));assert.equal(review(card).count,2);
    assert.equal(api.isCompleted(subject,'0',state(subject,card)),false);
  });
  test(subject+': two-device merge preserves new failures and later passes',()=>{
    const old=state(subject,{passed:true,correct:true,passedAt:at[0],history:[event('old-pass',true,at[0])]},at[0]);
    const wrong=state(subject,{correct:false,history:[event('new-wrong',false,at[1])]},at[1]);
    for(const pair of [[old,wrong],[wrong,old]]){
      let merged=api.mergeState(subject,...pair);assert.equal(api.recentReview(subject,'0',merged).count,1);
      const card=subject==='theory'?{passed:merged.passed['0'],restored:merged.trainingCenterRestored['0']}: {passed:merged.cards[0].passed,restored:merged.cards[0].trainingCenterRestored};
      assert.equal(card.passed,false);assert.equal(card.restored,true);
      const done=state(subject,{passed:true,correct:true,passedAt:at[2],history:[event('new-pass',true,at[2])]},at[2]);
      merged=api.mergeState(subject,merged,done);merged=api.mergeState(subject,merged,wrong);
      assert.equal(api.recentReview(subject,'0',merged),null);assert.equal(api.isCompleted(subject,'0',merged),true);
    }
  });
  test(subject+': cancelled notebook failure never returns after merge',()=>{
    const wrong=state(subject,{history:[event('undo',false,at[1],{source:'notebook'})]},at[1]);
    const undone=state(subject,{history:[event('undo',null,at[1],{source:'notebook',cancelledAt:at[2]})]},at[2]);
    const merged=api.mergeState(subject,api.mergeState(subject,wrong,undone),wrong);
    assert.equal(api.recentReview(subject,'0',merged),null);
    const history=subject==='theory'?merged.history['0']:merged.cards[0].history;
    assert.equal(history.length,1);assert.ok(history[0].cancelledAt);
  });
  test(subject+': undoing a pass leaves the preceding failure unresolved',()=>{
    const history=[event('wrong',false,at[1]),event('pass',null,at[2],{source:'notebook',cancelledAt:at[3]})];
    assert.equal(review({history,passed:true,passedAt:at[2],selfPassed:true,selfPassedAt:at[2]}).count,1);
  });
}
