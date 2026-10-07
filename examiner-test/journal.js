(function(root,factory){
  'use strict';const api=factory(typeof module==='object'&&module.exports?require('../entry/grading.js'):root.EntryGrading);if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaminerJournal=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(G){
  'use strict';
  const KEY='exam-20260914-examiner-journal-v1',SEASON='exam-20260914';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const norm=value=>String(value??'').normalize('NFKC').replace(/㈜|\(주\)/g,'주').replace(/[\s·._-]/g,'').toLowerCase();
  const number=value=>{const s=String(value??'').replace(/[,\s원]/g,'');return /^\d+$/.test(s)?Number(s):NaN};
  const fresh=()=>({schemaVersion:1,season:SEASON,drafts:{},history:[]});
  const clone=value=>JSON.parse(JSON.stringify(value));
  const fields=['date','type','supply','vat','supplier','electronic','journal'];
  // KcLep 매입매출전표 유형코드 26종과 보조 입력값. 매입매출전표 화면(매입매출전표_오답연습_3문제.html)의 목록과 같다.
  const TYPES=[...G.TYPES.sales,...G.TYPES.purchase],JOURNALS=['현금','외상','혼합','카드'];
  const {CARD_TYPES,ZERO_RATE_TYPES,DEDUCT_REASON_TYPES,CARD_COMPANIES,ZERO_RATE_REASONS,DEDUCT_REASONS}=G;
  const EXTRAS=[['cardCompany','카드사',CARD_TYPES,CARD_COMPANIES],['zeroRateType','영세율 구분',ZERO_RATE_TYPES,ZERO_RATE_REASONS],['deductReason','불공제 사유',DEDUCT_REASON_TYPES,DEDUCT_REASONS]];
  const GROSS_TYPES=new Set(['14.건별','17.카과','22.현과','57.카과','61.현과']),TEN_PERCENT=new Set(['11.과세','51.과세','54.불공',...GROSS_TYPES]);
  const REVIEW_LABELS={copy:'기출 복사 여부',textbook:'교재형 수준',sentence:'시험 문장',choices:'선택지·입력 구성',peripheral:'주변부 활용',absence:'최근 미출제',exception:'예외규정',surprise:'뜻밖의 판단 지점',forced:'억지·범위 이탈'};
  function normalizeRow(row){return {side:row.side||'',account:norm(row.account),amount:number(row.amount),division:norm(row.division),partner:norm(row.partner)}}
  function sameRows(input,expected){return Array.isArray(input)&&G.practical({answers:expected},input).ok}
  function check(question,entry){
    const problem=toProblem(question);
    if(question.kind==='practical'){const result=G.practical(problem,entry.rows||[]);return {correct:result.ok,missing:result.ok?[]:['분개 행']}}
    const v={...(entry.voucher||{}),zeroRate:entry.voucher?.zeroRate??entry.voucher?.zeroRateType};
    const result=G.voucher(problem,v,entry.rows||[]),names={'신용카드사':'카드사','불공제사유':'불공제 사유'};return {correct:result.correct,missing:result.wrongLabels.map(label=>names[label]||label)};
  }
  const optionalText=(value,max)=>value===undefined||value===null||(typeof value==='string'&&value.length<=max);
  function validateBank(bank){
    if(!Array.isArray(bank)||bank.length>200)throw Error('전표 문제 목록을 읽지 못했습니다.');
    const ids=new Set();
    for(const q of bank){if(!q||!['practical','voucher'].includes(q.kind)||!q.id||!/^[a-z0-9_-]{1,100}$/i.test(q.id)||ids.has(q.id)||!q.title||!q.prompt||!Array.isArray(q.rows)||!q.rows.length||q.rows.length>6)throw Error('전표 문제의 구성 또는 ID를 확인해 주세요.');ids.add(q.id);
      if(q.rows.some(r=>!r||!['D','C'].includes(r.side)||typeof r.account!=='string'||!r.account.trim()||!Number.isInteger(r.amount)||r.amount<=0||!['',undefined,'판','제'].includes(r.division)||!optionalText(r.partner,80)))throw Error('정답 분개 행의 차대·계정·금액·부문을 확인해 주세요.');
      if(q.kind==='voucher'){
        const v=q.voucher;if(!v||fields.some(f=>v[f]===undefined))throw Error('매입매출전표 필수 항목을 확인해 주세요.');
        if(!TYPES.includes(v.type)||!JOURNALS.includes(v.journal)||!['여','부'].includes(v.electronic)||!Number.isInteger(v.supply)||v.supply<0||!Number.isInteger(v.vat)||v.vat<0||!/^\d{4}-\d{2}-\d{2}$/.test(v.date))throw Error('매입매출전표의 유형·금액·날짜 형식을 확인해 주세요.');
        for(const [key,,,list]of EXTRAS)if(v[key]&&!list.includes(v[key]))throw Error('매입매출전표 보조 항목 값을 확인해 주세요.');
      }
      for(const key of ['explanation','intent','trap','novelty','calculationLoad','basis','boundary','batchLabel'])if(!optionalText(q[key],2400))throw Error('전표 문제 설명 항목의 형식을 확인해 주세요.');
      if(q.styles!==undefined&&(!Array.isArray(q.styles)||q.styles.some(s=>typeof s!=='string'||s.length>40)))throw Error('전표 문제 스타일 형식을 확인해 주세요.');
      if(q.review!==undefined&&typeof q.review!=='string'&&(typeof q.review!=='object'||Array.isArray(q.review)||Object.values(q.review).some(v=>typeof v!=='string'||v.length>600)))throw Error('전표 문제 검토 메모 형식을 확인해 주세요.');
      if(q.exhibit&&(!Array.isArray(q.exhibit.headers)||!Array.isArray(q.exhibit.rows)||q.exhibit.rows.some(r=>!Array.isArray(r)||r.length!==q.exhibit.headers.length)))throw Error('전표 문제 자료표의 행과 열을 확인해 주세요.');
      const debit=q.rows.filter(r=>r.side==='D').reduce((a,r)=>a+r.amount,0),credit=q.rows.filter(r=>r.side==='C').reduce((a,r)=>a+r.amount,0);
      if(debit<=0||debit!==credit)throw Error('정답 분개의 차변과 대변이 일치하지 않습니다.');
    }
    return bank;
  }
  // 자동 점검: 시험 문제로서 의심되는 표면 신호. 정답을 인증하지 않는다.
  function lintItem(q){
    const notes=[],add=(level,text)=>notes.push({level,text});
    if(q.kind==='voucher'){const v=q.voucher;
      if(TEN_PERCENT.has(v.type)&&Math.abs(Math.round(v.supply*0.1)-v.vat)>1)add('주의','세액이 공급가액의 10%와 다릅니다.');
      if(/영세|면세|수출|면건|카면|카영|현면|현영/.test(v.type)&&v.vat!==0)add('주의','영세율·면세 유형인데 세액이 0원이 아닙니다.');
      for(const [key,label,set]of EXTRAS)if(set.has(v.type)&&!v[key])add('주의',label+' 정답이 비어 있습니다.');
      if(/\b\d{2}\.(과세|영세|면세|건별|간이|수출|카과|카면|카영|면건|전자|현과|현면|현영|불공|수입|금전)/.test(q.prompt+' '+q.title))add('주의','지문이나 제목에 유형코드가 드러나 있습니다.');
    }
    if(/함정|예외규정|장기 ?미출제|주변부|출제위원/.test(q.title+' '+q.prompt))add('주의','제목이나 지문에 출제 의도를 드러내는 말이 있습니다.');
    if(!q.review||typeof q.review!=='object')add('참고','9개 기준 자기 검토 메모가 없는 문항입니다.');
    else{const cautions=Object.values(q.review).filter(v=>/^\s*주의/.test(v)).length;if(cautions>=2)add('주의','AI 자기 검토에서 주의 항목이 '+cautions+'개입니다.')}
    return notes;
  }
  function reviewHtml(review){
    if(!review)return '';
    if(typeof review==='string')return '<p>'+esc(review)+'</p>';
    const rows=Object.keys(REVIEW_LABELS).map(k=>'<tr><th>'+esc(REVIEW_LABELS[k])+'</th><td>'+esc(review[k]||'기록 없음')+'</td></tr>').join('');
    return '<div class="table-wrap review-table"><table><caption>9개 기준 AI 1차 검토 (사람의 검증·시험 적합성 인증 아님)</caption><tbody>'+rows+'</tbody></table></div>';
  }
  const lintHtml=notes=>notes.length?'<ul class="lint-list">'+notes.map(n=>'<li><b>'+esc(n.level)+'</b> '+esc(n.text)+'</li>').join('')+'</ul>':'<p class="hint">자동 점검에서 걸린 표면 신호가 없습니다.</p>';
  function validateState(state){
    if(!state||state.schemaVersion!==1||state.season!==SEASON||!state.drafts||typeof state.drafts!=='object'||Array.isArray(state.drafts)||!Array.isArray(state.history)||state.history.length>2000)throw Error('다른 시즌 또는 잘못된 전표 연습 기록입니다.');
    const validId=value=>typeof value==='string'&&/^[a-z0-9_-]{1,100}$/i.test(value);
    for(const [key,draft]of Object.entries(state.drafts))if(!validId(key)||!draft||!Array.isArray(draft.rows)||draft.rows.length>6||!draft.voucher||typeof draft.voucher!=='object')throw Error('전표 입력 기록을 확인해 주세요.');
    const ids=new Set();for(const h of state.history){if(!h||!validId(h.id)||ids.has(h.id)||!validId(h.questionId)||!h.entry||!Array.isArray(h.entry.rows)||typeof h.correct!=='boolean'||!Number.isFinite(Date.parse(h.at)))throw Error('전표 채점 기록을 확인해 주세요.');ids.add(h.id)}
    return clone(state);
  }
  function auditHtml(q){
    const meta=[['출제 의도',q.intent],['함정 후보',q.trap],['기출과 다른 판단',q.novelty],['계산 부담',q.calculationLoad],['범위 경계',q.boundary],['근거',q.basis]].filter(([,v])=>v).map(([k,v])=>'<p><b>'+k+'</b> '+esc(v)+'</p>').join('');
    return '<details class="audit"><summary>출제 근거와 난이도 점검</summary><div class="audit-content">'+(q.styles?.length?'<p class="hint">'+q.styles.map(esc).join(' · ')+'</p>':'')+meta+(typeof q.review==='string'?'<p>'+esc(q.review)+'</p>':reviewHtml(q.review))+'<h4>자동 점검</h4>'+lintHtml(lintItem(q))+'<p class="hint">제공된 기출 처리 기준과 분개를 우선해 점검했습니다. 실제 시험 문항이라는 뜻은 아닙니다.</p></div></details>'}
  function collect(){
    const base=validateBank(clone(globalThis.ExaminerJournalBank||[])),batches=Array.isArray(globalThis.ExaminerJournalLibrary)?globalThis.ExaminerJournalLibrary:[];
    const added=[];for(const batch of batches.slice().reverse())for(const item of (batch&&Array.isArray(batch.items)?batch.items:[]))added.push({...clone(item),batchLabel:String(batch.label||'새 출제').slice(0,60)});
    return validateBank([...added,...base]);
  }
  let activeEditor=null;
  const resources=new Map(),base=typeof document==='undefined'?null:new URL('.',document.currentScript.src);
  function resource(path,style=false){
    const url=new URL(path,base).href;if(resources.has(url))return resources.get(url);
    const pending=new Promise((resolve,reject)=>{const element=document.createElement(style?'link':'script');if(style){element.rel='stylesheet';element.href=url}else element.src=url;element.onload=resolve;element.onerror=()=>{element.remove();resources.delete(url);reject(Error('공통 전표 입력기를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'))};document.head.append(element)});
    resources.set(url,pending);return pending;
  }
  async function loadEditor(kind){
    await Promise.all([globalThis.EntryAccounts?Promise.resolve():resource('../entry/accounts.js?v=1'),globalThis.TrainingSearchPicker?Promise.resolve():resource('../account-search.js?v=5'),resource('../entry/common.css?v=1',true),resource('../entry/'+kind+'.css?v=1',true)]);
    const name=kind==='practical'?'PracticalEntry':'VoucherEntry';
    if(!globalThis[name])await resource('../entry/'+kind+'.js?v=4');
    return globalThis[name];
  }
  function exhibitHtml(exhibit){
    if(!exhibit)return '';
    return '<figure class="exhibit exhibit-table"><figcaption>'+esc(exhibit.caption)+'</figcaption><table><thead><tr>'+exhibit.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+exhibit.rows.map(row=>'<tr>'+row.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></figure>';
  }
  // 문제 형식과 기록만 연결한다. 입력 화면과 채점은 entry/의 공통 입력기가 맡는다.
  function toProblem(q,partners=[]){
    const allAccounts=globalThis.EntryAccounts||[],accounts=[...new Set([...allAccounts,...q.rows.map(r=>r.account)])];
    const p={id:q.id,title:esc(q.title),prompt:esc(q.prompt).replace(/\n/g,'<br>'),explanation:esc(q.explanation||''),type:q.kind==='practical'?'일반전표 입력':'매입매출전표 입력',addedDate:String(q.createdAt||'2026-10-05').slice(0,10),exhibit:exhibitHtml(q.exhibit)};
    if(q.kind==='practical')return {...p,answers:clone(q.rows),accountSelect:true,accountOptions:accounts,partnerOptions:[...new Set([...q.rows.map(r=>r.partner).filter(Boolean),...partners,'㈜한빛상사','㈜새봄상사'])]};
    const v={...q.voucher,zeroRate:q.voucher.zeroRate??q.voucher.zeroRateType};
    const variants=[{journal:v.journal,rows:clone(q.rows)}];
    if(v.journal==='현금')variants.push({journal:v.journal,rows:clone(q.rows.filter(r=>r.account!=='현금'))});
    return {...p,item:'',accounts,suppliers:[...new Set([v.supplier,...partners,'㈜한빛상사','㈜새봄상사'].filter(Boolean))],voucher:v,variants,cardAuto:v.journal==='카드'};
  }
  function runtimeDraft(kind,draft){
    const rows=clone(draft?.rows||[]);
    if(kind==='practical')rows.forEach(r=>{r.account=r.accountValue||(r.accountCode?r.accountCode+'|'+r.account:r.account)});
    const voucher={...(draft?.voucher||{})};if(voucher.zeroRateType!==undefined&&voucher.zeroRate===undefined)voucher.zeroRate=voucher.zeroRateType;
    return {rows,voucher};
  }
  function legacyEntry(kind,card){
    const rows=clone(card.rows||[]),voucher={...(card.voucher||{})};
    if(kind==='practical')rows.forEach(row=>{const parsed=G.accountParts(row.account);row.accountValue=row.account;row.account=parsed.name;row.accountCode=parsed.code});
    if(voucher.zeroRate!==undefined)voucher.zeroRateType=voucher.zeroRate;
    return {rows,voucher};
  }
  async function mount(kind){
    const Editor=await loadEditor(kind);
    let bank;try{bank=collect()}catch(error){bank=validateBank(globalThis.ExaminerJournalBank||[]);document.querySelector('#status').textContent='새로 추가된 전표 문제의 형식에 문제가 있어 시범 문제만 엽니다. '+error.message}
    const selected=bank.filter(q=>q.kind===kind),section=document.querySelector('#journal-practice'),target=document.querySelector('#journal-questions');if(!selected.length)throw Error('이 분야의 준비된 문제가 없습니다.');
    let state,locked=false;try{const raw=localStorage.getItem(KEY);state=raw?validateState(JSON.parse(raw)):fresh()}catch(error){state=fresh();locked=true;document.querySelector('#status').textContent='전표 연습 기록을 읽지 못해 저장을 멈췄습니다. 기존 기록은 보존됩니다.'}
    const save=next=>{if(locked)return false;try{localStorage.setItem(KEY,JSON.stringify(validateState(next)));state=next;return true}catch{document.querySelector('#status').textContent='전표 연습을 저장하지 못했습니다. 기존 기록은 보존됩니다.';return false}};
    activeEditor?.dispose();document.querySelector('#practice').hidden=true;section.hidden=false;document.querySelector('#journal-title').textContent=kind==='practical'?'일반전표 입력':'매입매출전표 입력';document.querySelector('#journal-intro').textContent='준비된 '+selected.length+'문제입니다. 기존 전표 입력기에서 입력하고 채점하세요. 새 문제가 먼저 보이며, 기록은 이 테스트에만 저장됩니다.';
    target.innerHTML='<div class="entry-'+kind+'" data-entry-host="'+kind+'"></div>';
    const host=target.firstElementChild,seen=new Map(),runtimeState={cards:{}},partners=bank.flatMap(q=>[q.voucher?.supplier,...q.rows.map(r=>r.partner)]).filter(Boolean);
    selected.forEach((q,index)=>{const history=state.history.filter(h=>h.questionId===q.id),saved=state.drafts[q.id],draft=runtimeDraft(kind,saved),last=history.at(-1);runtimeState.cards[index]={...draft,graded:typeof saved?.graded==='boolean'?saved.graded:Boolean(last),correct:saved?.correct??last?.correct??false,attempts:history.length,wrongCount:history.filter(h=>!h.correct).length,history:history.map(h=>({at:h.at,correct:h.correct,...runtimeDraft(kind,h.entry)}))};seen.set(index,history.length)});
    let initializing=true;
    const persist=runtime=>{
      if(initializing)return true;
      const next=clone(state),updatedCounts=new Map(seen);
      selected.forEach((q,index)=>{const card=runtime.cards[index];if(!card)return;next.drafts[q.id]={...legacyEntry(kind,card),graded:Boolean(card.graded),...(typeof card.correct==='boolean'?{correct:card.correct}:{})};const oldCount=seen.get(index)||0;for(const h of (card.history||[]).slice(oldCount))next.history.push({id:'journal-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2)),at:h.at,questionId:q.id,entry:legacyEntry(kind,h),correct:h.correct});updatedCounts.set(index,(card.history||[]).length)});
      if(JSON.stringify(next)===JSON.stringify(state))return true;
      if(!save(next))return false;for(const [index,count]of updatedCounts)seen.set(index,count);return true;
    };
    const answerSelector=kind==='practical'?'.reveal':'.answer-reveal';
    activeEditor=Editor.mount({root:host,target:host,problems:selected.map(q=>toProblem(q,partners)),state:runtimeState,save:persist,embedded:true,onGrade(card){card.querySelector(answerSelector).open=true}});
    initializing=false;
    host.querySelectorAll('.question').forEach((card,index)=>{
      const q=selected[index];card.classList.add('journal-card');card.dataset.id=q.id;card.querySelector('.check-one').classList.add('grade-journal');card.querySelector('.result').classList.add('grade-result');card.querySelector(answerSelector).classList.add('answer');
      if(q.batchLabel)card.querySelector('.qhead').insertAdjacentHTML('beforeend','<span class="batch-tag">'+esc(q.batchLabel)+'</span>');
      const answer=card.querySelector(kind==='practical'?'.reveal-body':'.detail-body');answer.insertAdjacentHTML('beforeend',auditHtml(q));
      if(kind==='practical')card.querySelector('.entry-toggle').open=true;
      if(locked)card.querySelectorAll('input,select,button').forEach(input=>input.disabled=true);
    });
    target.insertAdjacentHTML('beforeend','<details class="journal-backup"><summary>이 전표 연습 기록 백업·복원</summary><button type="button" id="journal-export">기록 파일 저장</button><label class="file-button">기록 파일 불러오기<input type="file" id="journal-import" accept=".json,application/json"></label></details>');
    target.querySelector('#journal-export').onclick=()=>{if(locked){document.querySelector('#status').textContent='기존 기록을 읽지 못했습니다. 빈 기록으로 백업하지 않습니다.';return}const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='출제위원-전표-기록.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
    target.querySelector('#journal-import').onchange=async event=>{try{const file=event.target.files[0];if(!file||file.size>2000000)throw Error('파일 크기를 확인해 주세요.');const incoming=validateState(JSON.parse(await file.text())),next=clone(state),known=new Map(next.history.map(h=>[h.id,h]));for(const h of incoming.history){if(known.has(h.id)&&JSON.stringify(known.get(h.id))!==JSON.stringify(h))throw Error('같은 ID의 다른 기록이 있습니다.');if(!known.has(h.id))next.history.push(h)}for(const [id,draft]of Object.entries(incoming.drafts))if(!(id in next.drafts))next.drafts[id]=draft;if(save(next)){await mount(kind);document.querySelector('#status').textContent='전표 연습 기록을 합쳤습니다.'}}catch(error){document.querySelector('#status').textContent='기록을 합치지 않았습니다. '+error.message}finally{event.target.value=''}};
    document.querySelector('#journal-title').focus({preventScroll:true});section.scrollIntoView({block:'start'});return {warning:locked};
  }
  return {KEY,TYPES,JOURNALS,CARD_COMPANIES,ZERO_RATE_REASONS,DEDUCT_REASONS,normalizeRow,sameRows,check,validateBank,validateState,lintItem,reviewHtml,toProblem,mount};
});
