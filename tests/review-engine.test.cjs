const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../review-engine.js'),G=require('../entry/grading.js');
const now=Date.parse('2026-10-08T12:00:00+09:00');
const entry=(id,type,subject='practical')=>({id,type,subject,title:type,tags:['일반전표',type]});
const event=(date,correct,extra={})=>({at:date+'T09:00:00+09:00',correct,...extra});
test('types share spacing across questions but never across subjects',()=>{
 const entries=[entry(0,'어음'),entry(1,'어음'),entry(0,'어음','voucher')];
 const groups=R.analyze(entries,{practical:{cards:{0:{history:[event('2026-10-06',true)]}}}},now);
 assert.equal(groups.length,2);assert.equal(groups[0].entries.length,2);assert.equal(groups[0].candidate.id,1);assert.equal(groups[1].category,'new');
});
test('unseen types, maintenance and errors all enter a balanced queue across subjects',()=>{
 const entries=[],states={};
 for(const subject of ['practical','voucher','theory']){
  const cards={};for(let id=0;id<6;id++){entries.push(entry(id,'유형'+id,subject));cards[id]={history:id%3===0?[]:[event('2026-10-01',id%3===1)]}}
  states[subject]=subject==='theory'?{history:Object.fromEntries(Object.entries(cards).map(([id,c])=>[id,c.history]))}:{cards};
 }
 const groups=R.analyze(entries,states,now),queue=R.select(groups,{now});
 assert.equal(queue.length,6);for(const subject of ['practical','voucher','theory'])assert.equal(queue.filter(g=>g.subject===subject).length,2);
 assert.deepEqual(new Set(queue.map(g=>g.category)),new Set(['maintenance','new','due']));
 assert.deepEqual(queue,R.select(groups,{now}));
});
test('same day corrections never inflate spacing, and next study day advances it',()=>{
 const entries=[entry(0,'어음')],history=[event('2026-10-06',false),event('2026-10-06',true),event('2026-10-07',true)];
 let group=R.analyze(entries,{practical:{cards:{0:{history}}}},now)[0];
 assert.equal(group.streak,1);assert.equal(group.interval,1);assert.equal(R.day(group.due),'2026-10-08');
 history.push(event('2026-10-08',true));group=R.analyze(entries,{practical:{cards:{0:{history}}}},now)[0];
 assert.equal(group.interval,3);assert.equal(R.day(group.due),'2026-10-11');assert.equal(R.select([group],{now}).length,0);
});
test('cancelled, duplicate, future, undated and deleted records do not create progress',()=>{
 const entries=[entry(0,'어음'),entry(1,'삭제')],history=[event('2026-10-07',false,{id:'a'}),event('2026-10-07',false,{id:'a',cancelledAt:'2026-10-07T01:00:00Z'}),{correct:true},event('2026-11-01',true)];
 const groups=R.analyze(entries,{practical:{cards:{0:{history},1:{deleted:true,history:[]}}}},now);
 assert.equal(groups.length,1);assert.equal(groups[0].category,'new');
});
test('repeated fields count separate days, not repeated clicks',()=>{
 const history=[event('2026-10-05',false,{wrongLabels:['세액','세액']}),event('2026-10-05',false,{wrongLabels:['세액']}),event('2026-10-06',false,{wrongLabels:['세액']})];
 const groups=R.analyze([entry(0,'카드','voucher')],{voucher:{cards:{0:{history}}}},now);
 assert.deepEqual(groups[0].fields,[['세액',2]]);
});
test('passed items stay scheduled; future reviews are not forced into balanced queue',()=>{
 const history=['2026-10-01','2026-10-02','2026-10-05','2026-10-07'].map(d=>event(d,true));
 const groups=R.analyze([entry(0,'어음')],{practical:{cards:{0:{passed:true,archived:true,history}}}},now);
 assert.equal(groups[0].interval,14);assert.equal(R.select(groups,{now}).length,0);
 assert.equal(R.select(groups,{now,mode:'focus',type:groups[0].key}).length,1);
});
test('daily target is bounded and never manufactures extra reviews',()=>{
 const entries=Array.from({length:8},(_,i)=>entry(i,'유형'+i)),cards=Object.fromEntries(entries.slice(0,6).map(e=>[e.id,{history:[event('2026-10-08',true)]}]));
 assert.equal(R.select(R.analyze(entries,{practical:{cards}},now),{now,limit:6}).length,0);
});
test('diagnostics preserve grading and isolate an observed division error',()=>{
 const problem={answers:[{side:'D',account:'복리후생비',amount:100,division:'제'},{side:'C',account:'현금',amount:100}]};
 const rows=[{side:'D',account:'복리후생비',amount:100,division:'판'},{side:'C',account:'현금',amount:100}];
 const grade=G.practical(problem,rows);assert.equal(grade.ok,false);assert.deepEqual(grade.wrongLabels,['판매비·제조경비 구분']);
 rows[0].division='제';assert.equal(G.practical(problem,rows).ok,true);assert.deepEqual(G.practical(problem,rows).wrongLabels,[]);
});
test('a different question revealing a weakness overrides same-type success that day',()=>{
 const entries=[entry(0,'어음'),entry(1,'어음')];
 const cards={0:{history:[event('2026-10-01',true),event('2026-10-03',true),event('2026-10-07',true)]},1:{history:[{at:'2026-10-07T11:00:00+09:00',correct:false,wrongLabels:['차변·대변']}]}};
 const g=R.analyze(entries,{practical:{cards}},now)[0];assert.equal(g.interval,1);assert.equal(g.category,'due');assert.equal(g.sessions.at(-1).correct,false);
});
test('already studied subjects count toward the daily balance',()=>{
 const entries=Array.from({length:6},(_,i)=>entry(i,'유형'+i,'practical')).concat(Array.from({length:4},(_,i)=>entry(i,'유형'+i,'voucher')),Array.from({length:4},(_,i)=>entry(i,'유형'+i,'theory')));
 const groups=R.analyze(entries,{practical:{cards:{0:{history:[event('2026-10-08',true)]},1:{history:[event('2026-10-08',true)]}}}},now);
 const queue=R.select(groups,{now});assert.equal(queue.length,4);assert.equal(queue.filter(g=>g.subject==='practical').length,0);
});
test('broad focus topics filter questions without combining their schedules',()=>{
 const entries=[{...entry(0,'도서 구입','voucher'),tags:['53.면세']},{...entry(1,'보험료','voucher'),tags:['53.면세']},{...entry(2,'기념품','voucher'),tags:['57.카과']},{...entry(3,'업무추진비','voucher'),tags:['54.불공']}];
 const groups=R.analyze(entries,{},now);assert.equal(groups.length,4);
 assert.equal(R.select(groups,{now,mode:'focus',focusTopic:'taxable'}).length,2);
 assert.equal(R.topic(entries[2]),'evidence');assert.equal(R.topic(entries[3]),'nondeduct');assert.ok(R.TOPICS.length<=9);
});
