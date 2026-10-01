const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const now=Date.parse('2026-10-02T08:00:00Z');
const sandbox={console,URL,URLSearchParams,Date:class extends Date{static now(){return now}},location:{search:'',href:'https://example.test/home.html'},localStorage:{getItem:()=>null},document:{createElement:()=>({}),head:{append(){}}}};
sandbox.window=sandbox;
for(const file of ['github-learning-sync.js','season-ui.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),sandbox);
const api=sandbox.TrainingSeason;
const event=(id,correct,at,extra={})=>({id,correct,at,...extra});
const wrong=(id,extra={})=>event(id,false,'2026-10-01T08:00:00Z',extra);
function state(subject,cards){
 if(subject!=='theory')return {cards};
 const result={};for(const [id,card] of Object.entries(cards))for(const [key,value] of Object.entries(card)){const field=key==='correct'?'checked':key;(result[field]||={})[id]=value}return result;
}
for(const subject of ['theory','practical','voucher']){
 const need=card=>api.priority(subject,0,state(subject,{0:card}),{now});
 test(subject+': repeated recent errors beat single error and notebook flags',()=>{
  const repeat=need({history:[wrong('a'),event('b',false,'2026-10-02T07:00:00Z')]}),single=need({history:[wrong('c')]}),note=need({history:[wrong('d',{source:'notebook'})]});
  assert.equal(repeat.wrongStreak,2);assert.ok(api.comparePriority(repeat,single)<0);assert.ok(api.comparePriority(single,note)<0);assert.equal(note.wrongStreak,0);
 });
 test(subject+': legacy totals, cutoff, cancelled, deleted and archived are not current weakness',()=>{
  assert.equal(need({wrongCount:999,attempts:999,history:[{correct:false}]}).band,0);
  assert.equal(need({history:[event('old',false,'2026-09-25T14:59:59Z')]}).band,0);
  assert.equal(need({history:[wrong('cancel',{cancelledAt:'2026-10-02T07:00:00Z'})]}).band,0);
  for(const key of ['deleted','archived'])assert.equal(need({[key]:true,history:[wrong(key)]}).active,false);
 });
 test(subject+': pass removes priority, re-error resets streak, undo restores it',()=>{
  const history=[wrong('a'),event('b',false,'2026-10-01T09:00:00Z'),event('pass',true,'2026-10-01T10:00:00Z')];
  assert.equal(need({history,passed:true,passedAt:history[2].at}).active,false);
  const after=need({history:[...history,event('again',false,'2026-10-02T07:00:00Z')],passed:true,passedAt:history[2].at});
  assert.equal(after.active,true);assert.equal(after.wrongStreak,1);assert.equal(after.recentWrong,3);assert.equal(after.recentAttempts,4);
  const undone=need({history:[...history.slice(0,2),{...history[2],correct:null,cancelledAt:'2026-10-02T07:00:00Z'}],passedAt:history[2].at});
  assert.equal(undone.wrongStreak,2);
 });
 test(subject+': duplicate device events deduplicate and cancellation wins',()=>{
  const a=wrong('a'),b=event('b',false,'2026-10-02T07:00:00Z');
  assert.equal(need({history:[b,a,a]}).wrongStreak,2);
  assert.equal(need({history:[a,{...a,cancelledAt:b.at},a]}).wrongStreak,0);
 });
 test(subject+': tag count cannot outrank demonstrated weakness; ranking is read-only',()=>{
  const cards={0:{history:[wrong('a'),event('b',false,'2026-10-02T07:00:00Z')]},1:{history:[wrong('c')]},2:{passed:true,history:[event('pass',true,'2026-10-02T07:00:00Z')]}};
  const s=state(subject,cards),snapshot=JSON.stringify(s);
  const entries=[{subject,id:0,tags:['반복 취약']},{subject,id:1,tags:['단발 취약']},{subject,id:2,tags:['통과']},...Array.from({length:100},(_,i)=>({subject,id:i+3,tags:['많은 미풀이']}))];
  const groups=api.rankTags(entries,{[subject]:s});
  assert.equal(groups.length,2);assert.equal(groups[0].tag,'반복 취약');assert.equal(groups[1].tag,'단발 취약');assert.equal(JSON.stringify(s),snapshot);
 });
 test(subject+': older error is lower priority; last five cap and future errors excluded',()=>{
  const late=Date.parse('2026-10-25T08:00:00Z'),s=state(subject,{0:{history:[wrong('a'),wrong('b')]},1:{history:[event('c',false,'2026-10-24T08:00:00Z')]}});
  assert.ok(api.comparePriority(api.priority(subject,1,s,{now:late}),api.priority(subject,0,s,{now:late}))<0);
  assert.equal(need({history:[event('future',false,'2026-10-03T00:00:00Z')]}).wrongStreak,0);
  assert.equal(need({history:Array.from({length:9},(_,i)=>event(String(i),false,new Date(now-i*1000).toISOString()))}).recentAttempts,5);
 });
}
test('practice URL scopes questions and resets only answer fields via existing fresh flow',()=>{
 const url=new URL(api.priorityUrl('voucher.html',[{id:3},{id:4}],'함정'));
 assert.equal(url.searchParams.get('weakrefs'),'3,4');assert.equal(url.searchParams.get('sort'),'priority');assert.equal(url.searchParams.get('fresh'),'1');
});
