(function(root,factory){
  'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaminerJournal=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='exam-20260914-examiner-journal-v1',SEASON='exam-20260914';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const norm=value=>String(value??'').normalize('NFKC').replace(/㈜|\(주\)/g,'주').replace(/[\s·._-]/g,'').toLowerCase();
  const number=value=>{const s=String(value??'').replace(/[,\s원]/g,'');return /^\d+$/.test(s)?Number(s):NaN};
  const amount=value=>Number(value).toLocaleString('ko-KR')+'원';
  const fresh=()=>({schemaVersion:1,season:SEASON,drafts:{},history:[]});
  const clone=value=>JSON.parse(JSON.stringify(value));
  const fields=['date','type','supply','vat','supplier','electronic','journal'];
  const labels={date:'날짜',type:'유형',supply:'공급가액',vat:'세액',supplier:'공급처',electronic:'전자 여부',journal:'분개 유형'};
  function normalizeRow(row){return {side:row.side||'',account:norm(row.account),amount:number(row.amount),division:norm(row.division),partner:norm(row.partner)}}
  function sameRows(input,expected){
    if(!Array.isArray(input)||input.length!==expected.length)return false;
    const used=new Set();
    for(const answer of expected){const e=normalizeRow(answer),index=input.findIndex((row,i)=>{if(used.has(i))return false;const r=normalizeRow(row);return r.side===e.side&&r.account===e.account&&r.amount===e.amount&&r.division===e.division&&r.partner===e.partner});if(index<0)return false;used.add(index)}
    return true;
  }
  function check(question,entry){
    const missing=[];
    if(question.kind==='voucher')for(const key of fields){const expected=question.voucher[key],actual=entry.voucher?.[key];if(['supply','vat'].includes(key)?number(actual)!==expected:norm(actual)!==norm(expected))missing.push(labels[key])}
    if(!sameRows(entry.rows||[],question.rows))missing.push('분개 행');
    return {correct:missing.length===0,missing};
  }
  function validateBank(bank){
    if(!Array.isArray(bank)||bank.length>20)throw Error('전표 문제 목록을 읽지 못했습니다.');
    const ids=new Set();
    for(const q of bank){if(!q||!['practical','voucher'].includes(q.kind)||!q.id||ids.has(q.id)||!q.title||!q.prompt||!Array.isArray(q.rows)||!q.rows.length||q.rows.length>6)throw Error('전표 문제의 구성 또는 ID를 확인해 주세요.');ids.add(q.id);
      if(q.kind==='voucher'&&(!q.voucher||fields.some(f=>q.voucher[f]===undefined)))throw Error('매입매출전표 필수 항목을 확인해 주세요.');
      const debit=q.rows.filter(r=>r.side==='D').reduce((a,r)=>a+r.amount,0),credit=q.rows.filter(r=>r.side==='C').reduce((a,r)=>a+r.amount,0);
      if(debit<=0||debit!==credit)throw Error('정답 분개의 차변과 대변이 일치하지 않습니다.');
    }
    return bank;
  }
  function validateState(state){
    if(!state||state.schemaVersion!==1||state.season!==SEASON||!state.drafts||typeof state.drafts!=='object'||Array.isArray(state.drafts)||!Array.isArray(state.history)||state.history.length>2000)throw Error('다른 시즌 또는 잘못된 전표 연습 기록입니다.');
    const validId=value=>typeof value==='string'&&/^[a-z0-9_-]{1,100}$/i.test(value);
    for(const [key,draft]of Object.entries(state.drafts))if(!validId(key)||!draft||!Array.isArray(draft.rows)||draft.rows.length>6||!draft.voucher||typeof draft.voucher!=='object')throw Error('전표 입력 기록을 확인해 주세요.');
    const ids=new Set();for(const h of state.history){if(!h||!validId(h.id)||ids.has(h.id)||!validId(h.questionId)||!h.entry||!Array.isArray(h.entry.rows)||typeof h.correct!=='boolean'||!Number.isFinite(Date.parse(h.at)))throw Error('전표 채점 기록을 확인해 주세요.');ids.add(h.id)}
    return clone(state);
  }
  function formatRows(rows){return '<table class="journal-answer-table"><thead><tr><th>차대</th><th>계정</th><th>금액</th><th>필수 정보</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+(r.side==='D'?'차변':'대변')+'</td><td>'+esc(r.account)+'</td><td>'+amount(r.amount)+'</td><td>'+esc([r.division&&r.division+' 부문',r.partner&&'거래처 '+r.partner].filter(Boolean).join(' · '))+'</td></tr>').join('')+'</tbody></table>'}
  const option=(value,label)=>'<option value="'+esc(value)+'">'+esc(label)+'</option>';
  function fieldsHtml(q,draft){if(q.kind!=='voucher')return '';
    const v=draft?.voucher||{};
    const inputs=[['date','날짜','date'],['type','유형','select'],['supply','공급가액','text'],['vat','세액','text'],['supplier','공급처','text'],['electronic','전자','select'],['journal','분개','select']];
    const options={type:[['','선택'],['11.과세','11.과세'],['12.영세','12.영세'],['17.카과','17.카과'],['51.과세','51.과세'],['52.영세','52.영세'],['53.면세','53.면세'],['54.불공','54.불공'],['57.카과','57.카과'],['61.현과','61.현과']],electronic:[['','선택'],['여','여'],['부','부']],journal:[['','선택'],['혼합','혼합'],['현금','현금'],['카드','카드']]};
    return '<fieldset class="voucher-fields"><legend>매입매출전표 내용</legend>'+inputs.map(([key,label,type])=>'<label>'+label+(type==='select'?'<select data-field="'+key+'">'+options[key].map(([x,y])=>option(x,y)).join('')+'</select>':'<input data-field="'+key+'" type="'+type+'" '+(type==='text'&&['supply','vat'].includes(key)?'inputmode="numeric"':'')+' value="'+esc(v[key]||'')+'">')+'</label>').join('')+'</fieldset>'}
  function rowHtml(saved,i){const r=saved||{};return '<div class="journal-row" data-row="'+i+'"><label>차대<select data-part="side">'+option('','선택')+option('D','차변')+option('C','대변')+'</select></label><label>계정<input data-part="account" value="'+esc(r.account||'')+'" placeholder="계정과목"></label><label>금액<input data-part="amount" inputmode="numeric" value="'+esc(r.amount||'')+'" placeholder="원"></label><label>부문<select data-part="division">'+option('','없음')+option('판','판관비')+option('제','제조')+'</select></label><label>거래처<input data-part="partner" value="'+esc(r.partner||'')+'" placeholder="필요할 때만"></label></div>'}
  function exhibitHtml(exhibit){if(!exhibit)return '';return '<div class="table-wrap"><table><caption>'+esc(exhibit.caption)+'</caption><thead><tr>'+exhibit.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+exhibit.rows.map(row=>'<tr>'+row.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
  function cardHtml(q,draft,last){return '<article class="question journal-card" data-id="'+esc(q.id)+'"><span class="tag">'+(q.kind==='practical'?'일반전표 입력':'매입매출전표 입력')+'</span><h3>'+esc(q.title)+'</h3><p class="prompt">'+esc(q.prompt)+'</p>'+exhibitHtml(q.exhibit)+fieldsHtml(q,draft)+'<fieldset class="journal-entries"><legend>분개 입력 · 행 순서는 자유롭습니다</legend>'+Array.from({length:5},(_,i)=>rowHtml(draft?.rows?.[i],i)).join('')+'</fieldset><button class="grade-journal primary" type="button">채점하기</button><p class="grade-result" role="status">'+(last?'마지막 채점: '+(last.correct?'정답':'다시 확인'):'')+'</p><details class="answer"><summary>정답·해설 보기</summary>'+(q.kind==='voucher'?'<p><b>전표 내용</b> '+fields.map(f=>labels[f]+' '+(f==='supply'||f==='vat'?amount(q.voucher[f]):esc(q.voucher[f]))).join(' · ')+'</p>':'')+formatRows(q.rows)+'<p>'+esc(q.explanation)+'</p><details><summary>출제 근거와 난이도 점검</summary><p>'+esc(q.review)+'</p><p>기출과 다른 판단: '+esc(q.novelty)+'</p><p class="hint">제공된 123~127회 후기 요약은 참고 의견입니다. 난이도와 정답은 실제 기출 처리 기준과 분개를 우선해 점검했습니다.</p></details></details></article>'}
  function readCard(card){const v={},rows=[];card.querySelectorAll('[data-field]').forEach(el=>v[el.dataset.field]=el.value);card.querySelectorAll('.journal-row').forEach(row=>{const r={};row.querySelectorAll('[data-part]').forEach(el=>r[el.dataset.part]=el.value);if(Object.values(r).some(Boolean))rows.push(r)});return {voucher:v,rows}}
  function mount(kind){
    const bank=validateBank(globalThis.ExaminerJournalBank||[]),selected=bank.filter(q=>q.kind===kind),section=document.querySelector('#journal-practice'),target=document.querySelector('#journal-questions');if(!selected.length)throw Error('이 분야의 준비된 문제가 없습니다.');
    let state,locked=false;try{const raw=localStorage.getItem(KEY);state=raw?validateState(JSON.parse(raw)):fresh()}catch(error){state=fresh();locked=true;document.querySelector('#status').textContent='전표 연습 기록을 읽지 못해 저장을 멈췄습니다. 기존 기록은 보존됩니다.'}
    const save=next=>{if(locked)return false;try{localStorage.setItem(KEY,JSON.stringify(validateState(next)));state=next;return true}catch{document.querySelector('#status').textContent='전표 연습을 저장하지 못했습니다. 기존 기록은 보존됩니다.';return false}};
    document.querySelector('#practice').hidden=true;section.hidden=false;document.querySelector('#journal-title').textContent=kind==='practical'?'일반전표 입력':'매입매출전표 입력';document.querySelector('#journal-intro').textContent='준비된 '+selected.length+'문제입니다. 날짜·계정·금액을 입력하고 바로 아래에서 채점하세요. 전표 기록은 이 브라우저에 따로 저장됩니다.';
    target.innerHTML=selected.map(q=>cardHtml(q,state.drafts[q.id],state.history.filter(h=>h.questionId===q.id).at(-1))).join('')+'<details class="journal-backup"><summary>이 전표 연습 기록 백업·복원</summary><button type="button" id="journal-export">기록 파일 저장</button><label class="file-button">기록 파일 불러오기<input type="file" id="journal-import" accept=".json,application/json"></label></details>';
    for(const row of target.querySelectorAll('.journal-row')){const saved=state.drafts[row.closest('.journal-card').dataset.id]?.rows?.[Number(row.dataset.row)];if(saved){row.querySelector('[data-part=side]').value=saved.side||'';row.querySelector('[data-part=division]').value=saved.division||''}}
    for(const field of target.querySelectorAll('[data-field]')){const saved=state.drafts[field.closest('.journal-card').dataset.id]?.voucher?.[field.dataset.field];if(saved)field.value=saved}
    target.oninput=event=>{const card=event.target.closest('.journal-card');if(!card)return;const next=clone(state);next.drafts[card.dataset.id]=readCard(card);save(next)};
    target.onclick=event=>{const card=event.target.closest('.journal-card');if(card&&event.target.closest('.grade-journal')){const q=bank.find(x=>x.id===card.dataset.id),entry=readCard(card),result=check(q,entry),next=clone(state);next.drafts[q.id]=entry;next.history.push({id:'journal-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2)),at:new Date().toISOString(),questionId:q.id,entry,correct:result.correct});if(!save(next))return;const message=card.querySelector('.grade-result');message.textContent=result.correct?'정답입니다.':'다시 확인해 주세요: '+result.missing.join(' · ');message.className='grade-result '+(result.correct?'ok':'wrong');card.querySelector('.answer').open=true}
      if(event.target.id==='journal-export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='출제위원-전표-기록.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}};
    target.onchange=async event=>{if(event.target.id!=='journal-import')return;try{const file=event.target.files[0];if(!file||file.size>2000000)throw Error('파일 크기를 확인해 주세요.');const incoming=validateState(JSON.parse(await file.text())),next=clone(state),seen=new Map(next.history.map(h=>[h.id,h]));for(const h of incoming.history){if(seen.has(h.id)&&JSON.stringify(seen.get(h.id))!==JSON.stringify(h))throw Error('같은 ID의 다른 기록이 있습니다.');if(!seen.has(h.id))next.history.push(h)}for(const [id,draft]of Object.entries(incoming.drafts))if(!(id in next.drafts))next.drafts[id]=draft;if(save(next)){document.querySelector('#status').textContent='전표 연습 기록을 합쳤습니다.';mount(kind)}}catch(error){document.querySelector('#status').textContent='기록을 합치지 않았습니다. '+error.message}finally{event.target.value=''}};
    document.querySelector('#journal-title').focus({preventScroll:true});section.scrollIntoView({block:'start'});
  }
  return {KEY,normalizeRow,sameRows,check,validateBank,validateState,mount};
});
