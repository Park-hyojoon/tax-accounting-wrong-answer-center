(function(root,factory){
  'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrainingReview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DAY=86400000,INTERVALS=[1,3,7,14,30];
  const normalize=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');
  const day=value=>new Date(new Date(value).getTime()+9*3600000).toISOString().slice(0,10);
  // Keep the readable canonical identity: no lossy hash, question number or exam round.
  const typeKey=entry=>entry.subject+':'+normalize(entry.reviewType||entry.type||(entry.tags||[]).slice().sort().join(' · ')||'미분류');
  const TOPICS=[['assets','자산·채권·채무'],['income','자본·수익·비용'],['cost','원가계산'],['taxable','과세·면세 구분'],['evidence','카드·현금영수증'],['zero','영세율·수출'],['nondeduct','매입세액 불공제'],['correction','전표 수정'],['other','기타 기본개념']];
  // Broad navigation only: retain the original fine-grained spacing identities.
  function topic(entry){
    const text=[entry.type,...(entry.tags||[])].join(' ');
    if(/일반전표 삭제|오류 수정|오류수정|입력 수정|전표.*수정|수정.*전표/.test(text))return'correction';
    if(entry.subject==='voucher'){
      const codes=(entry.tags||[]).map(t=>/^([0-9]{2})\./.exec(t)?.[1]).filter(Boolean);
      if(codes.includes('54')||/불공제|불공/.test(text))return'nondeduct';
      if(codes.some(c=>['12','16','19','24','52','59'].includes(c))||/영세율|수출|구매확인서|내국신용장/.test(text))return'zero';
      if(codes.some(c=>['17','18','22','23','57','58','61','62'].includes(c))||/카드|현금영수증/.test(text))return'evidence';
      return'taxable';
    }
    if(/원가회계|종합원가|개별원가|배부|완성품환산|공손|원가행태/.test(text))return'cost';
    if(/부가가치세|매입세액|과세대상|사업자등록/.test(text))return /불공제/.test(text)?'nondeduct':/영세율|수출/.test(text)?'zero':'taxable';
    if(/자본|수익|비용|급여|퇴직|이익|손익|손실/.test(text))return'income';
    if(/자산|재고|상품|제품|채권|채무|어음|보증금|차입|대여|유가증권|현금|예금/.test(text))return'assets';
    return'other';
  }
  function cardState(entry,states){const state=states[entry.subject]||{};return entry.subject==='theory'?{history:state.history?.[entry.id],deleted:state.deleted?.[entry.id]}:state.cards?.[entry.id]||{}}
  function events(entry,states,now){
    const seen=new Map();
    for(const event of cardState(entry,states).history||[]){const key=event.id||JSON.stringify(event);if(!seen.has(key)||event.cancelledAt)seen.set(key,event)}
    return [...seen.values()].filter(e=>!e.cancelledAt&&typeof e.correct==='boolean'&&Number.isFinite(Date.parse(e.at))&&Date.parse(e.at)<=now).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  }
  function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0}
  function analyze(entries,states={},now=Date.now()){
    const groups=new Map(),seen=new Set();
    for(const entry of entries){
      if(!['theory','practical','voucher'].includes(entry.subject))continue;
      const ref=entry.subject+':'+entry.id;if(seen.has(ref)||cardState(entry,states).deleted)continue;seen.add(ref);
      const key=typeKey(entry);if(!groups.has(key))groups.set(key,{key,subject:entry.subject,label:entry.reviewType||entry.type||'미분류',entries:[],events:[],tags:new Set()});
      const group=groups.get(key),history=events(entry,states,now);group.entries.push({...entry,history});
      for(const tag of entry.tags||[])group.tags.add(tag);
      group.events.push(...history.map(e=>({...e,questionId:entry.id})));
    }
    return [...groups.values()].map(group=>{
      group.events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||String(a.questionId).localeCompare(String(b.questionId)));
      // Use each question's first attempt per day; a failed transfer to a different
      // question must not be hidden by an earlier success on the same type.
      const days=new Map();for(const e of group.events){const date=day(e.at);if(!days.has(date))days.set(date,new Map());const questions=days.get(date);if(!questions.has(e.questionId))questions.set(e.questionId,e)}
      const sessions=[...days.values()].map(questions=>{const attempts=[...questions.values()];return {...attempts[0],correct:attempts.every(e=>e.correct),wrongLabels:[...new Set(attempts.filter(e=>e.source!=='notebook').flatMap(e=>e.wrongLabels||[]))],source:attempts.every(e=>e.source==='notebook')?'notebook':'review'}});let streak=0;
      for(const e of sessions)streak=e.correct?streak+1:0;
      const last=sessions.at(-1),lastEvent=group.events.at(-1),interval=last?(last.correct?INTERVALS[Math.min(streak-1,INTERVALS.length-1)]:1):0;
      const due=last?Date.parse(day(last.at)+'T00:00:00+09:00')+interval*DAY:0;
      const recent=sessions.slice(-5),failures=recent.filter(e=>!e.correct).length;
      const fieldCounts=new Map();
      for(const e of recent){if(e.source==='notebook')continue;for(const label of new Set(e.wrongLabels||[]))fieldCounts.set(label,(fieldCounts.get(label)||0)+1)}
      const fields=[...fieldCounts].filter(([,count])=>count>=2).sort((a,b)=>b[1]-a[1]);
      const practicedToday=Boolean(lastEvent&&day(lastEvent.at)===day(now));
      const category=!last?'new':due>now?'scheduled':last.correct?'maintenance':'due';
      // Rotate within a type, favoring unseen then least recently practiced items.
      const candidates=[...group.entries].sort((a,b)=>{
        const ta=Date.parse(a.history.at(-1)?.at)||0,tb=Date.parse(b.history.at(-1)?.at)||0;
        return ta-tb||hash(day(now)+':'+a.subject+':'+a.id)-hash(day(now)+':'+b.subject+':'+b.id);
      });
      return {...group,tags:[...group.tags],sessions,streak,interval,due,category,practicedToday,failures,fields,candidate:candidates[0]};
    });
  }
  function select(groups,{now=Date.now(),limit=6,mode='balanced',subject='',type='',focusTopic=''}={}){
    const eligible=groups.filter(g=>(!subject||g.subject===subject)&&(!type||g.key===type)&&(!focusTopic||g.entries.some(e=>topic(e)===focusTopic)));
    const completed=eligible.filter(g=>g.practicedToday).length;
    const count=Math.max(0,Math.min(30,Number(limit)||6)-(mode==='balanced'?completed:0));
    let pool=eligible.filter(g=>mode==='focus'?(type||focusTopic||g.failures>0):!g.practicedToday&&g.category!=='scheduled');
    if(mode==='focus')return pool.sort((a,b)=>b.failures-a.failures||a.due-b.due||a.key.localeCompare(b.key)).slice(0,count);
    const output=[],subjects=['practical','voucher','theory'],categories=['maintenance','new','due'];
    const usedSubjects=new Map(),usedCategories=new Map();
    for(const g of eligible.filter(g=>g.practicedToday))usedSubjects.set(g.subject,(usedSubjects.get(g.subject)||0)+1);
    while(pool.length&&output.length<count){
      pool.sort((a,b)=>(usedSubjects.get(a.subject)||0)-(usedSubjects.get(b.subject)||0)||(usedCategories.get(a.category)||0)-(usedCategories.get(b.category)||0)||categories.indexOf(a.category)-categories.indexOf(b.category)||a.due-b.due||hash(day(now)+a.key)-hash(day(now)+b.key)||subjects.indexOf(a.subject)-subjects.indexOf(b.subject));
      const chosen=pool.shift();output.push(chosen);usedSubjects.set(chosen.subject,(usedSubjects.get(chosen.subject)||0)+1);usedCategories.set(chosen.category,(usedCategories.get(chosen.category)||0)+1);
    }
    return output;
  }
  return {DAY,INTERVALS,TOPICS,topic,day,typeKey,events,analyze,select};
});
