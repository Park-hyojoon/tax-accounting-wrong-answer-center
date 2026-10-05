(function(){
  'use strict';
  const E=window.ExaminerEngine,$=selector=>document.querySelector(selector),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const circled=['①','②','③','④'];
  let analysis,pilot,library=[],state=E.empty(),activeTrial='',pending=null,locked=false,loading=null,ready=false;
  const uid=prefix=>prefix+'-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  const now=()=>new Date().toISOString();
  const notice=(message,error=false)=>{const s=$('#status');s.textContent=message;s.classList.toggle('error',error)};
  const selectedStyles=()=>[...document.querySelectorAll('#style-options input:checked')].map(i=>i.value);
  const packs=()=>[pilot,...state.packs,...library.filter(p=>!state.packs.some(saved=>saved.id===p.id))];
  const newestPack=()=>findPack(library.at(-1)?.id||state.packs.at(-1)?.id||pilot.id);
  const findPack=id=>packs().find(p=>p.id===id);
  const latest=(list,filter)=>list.filter(filter).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||b.id.localeCompare(a.id))[0];
  function save(next){
    if(locked){notice('기존 테스트 기록을 읽지 못해 저장을 막았습니다. 원본을 보존한 상태에서 복구가 필요합니다.',true);return false}
    try{const checked=E.validateState(next,analysis,pilot);localStorage.setItem(E.KEY,JSON.stringify(checked));state=checked;return true}catch(error){notice('저장하지 못했습니다. 기존 기록과 입력은 보존됩니다. '+error.message,true);return false}
  }
  function tableHtml(t){const widths=t.headers.length===2?[22,78]:t.headers.length===3?[29,27,44]:[];return `<div class="table-wrap" tabindex="0" aria-label="${esc(t.caption)}"><table>${widths.length?`<colgroup>${widths.map(w=>`<col style="width:${w}%">`).join('')}</colgroup>`:''}<caption>${esc(t.caption)}</caption><thead><tr>${t.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
  const references=refs=>refs.length?`<ul>${refs.map(r=>`<li class="reference"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a></li>`).join('')}</ul>`:'';
  function loadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('분석 자료를 읽지 못했습니다. 새로고침 후 다시 시도해 주세요.'))};document.head.append(script)})}
  function renderPickers(){
    const previous=$('#pack-select').value;
    $('#pack-select').innerHTML=packs().map(p=>`<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
    $('#pack-select').value=findPack(previous)?previous:newestPack().id;
    $('#trial-select').innerHTML='<option value="">테스트를 선택하세요</option>'+state.trials.slice().reverse().map(t=>`<option value="${esc(t.id)}">${esc(new Date(t.at).toLocaleString('ko-KR'))} · ${esc(findPack(t.packId).label)} · ${t.questionIds.length}문항</option>`).join('');$('#trial-select').value=activeTrial;
  }
  function renderAnalysis(){
    $('#analysis-summary').textContent=`${analysis.rounds.join('·')}회 · 이론 ${analysis.records.length}문항. 정답·해설 요약, 출제 포인트와 함정, 문장·선택지 유형을 한 번 구조화했습니다. ${analysis.coverage.limitation}`;
    const filter=$('#frequency-filter').value,search=$('#concept-search').value.trim().toLowerCase();
    const rows=analysis.concepts.filter(c=>{const n=c.frequency.rounds.length;return (!search||(c.label+c.area+c.point+c.trap).toLowerCase().includes(search))&&(filter==='all'||filter==='frequent'&&n>=3||filter==='occasional'&&n>0&&n<3||filter==='unseen'&&n===0)});
    $('#concept-rows').innerHTML=rows.map(c=>`<tr><td><small>${esc(c.area)}</small><br><b>${esc(c.label)}</b><p class="scope-note">${esc(c.frequency.label)}</p></td><td>${c.frequency.questions}문항 / 75문항<br>${c.frequency.rounds.length?esc(c.frequency.rounds.join('·')+'회'):'관찰되지 않음'}<br><small>장기 미출제 판정 불가</small></td><td>${esc(c.point)}<br><small>함정 후보: ${esc(c.trap)}</small></td></tr>`).join('')||'<tr><td colspan="3">조건에 맞는 개념이 없습니다.</td></tr>';
    $('#patterns').innerHTML=`<p>${esc(analysis.patterns.sentences)}</p><p>${Object.entries(analysis.patterns.counts).map(([k,v])=>`${esc(k)} ${v}문항`).join(' · ')}</p><ul>${analysis.patterns.distractors.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><p class="hint">세부 출제 포인트와 함정은 AI 분석 의견입니다. 실제 수험생의 실수 이유를 추정한 기록이 아닙니다.</p>`;
    $('#scope-references').innerHTML=analysis.scope.references.map(r=>`<li class="reference"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a></li>`).join('');
  }
  function renderQuestions(){
    const trial=state.trials.find(t=>t.id===activeTrial);
    $('#practice').hidden=!trial;
    if(!trial){$('#questions').replaceChildren();$('#trial-summary').textContent='';return}
    $('#practice-title').textContent=findPack(trial.packId).label;
    const pack=findPack(trial.packId);let done=0,correct=0;
    $('#questions').innerHTML=trial.questionIds.map((id,i)=>{
      const q=pack.questions.find(q=>q.id===id),a=latest(state.attempts,a=>a.trialId===trial.id&&a.questionId===id),ev=latest(state.evaluations,e=>e.packId===pack.id&&e.questionId===id);
      if(a){done++;if(a.correct)correct++}
      return `<article class="question" data-id="${esc(id)}"><span class="tag">${esc(q.area)}</span> <h3>${i+1}. ${esc(q.title)}</h3><p class="prompt">${esc(q.prompt)}</p>${q.table?tableHtml(q.table):''}<fieldset class="choices"><legend class="hint">정답 하나를 선택하세요</legend>${q.choices.map((c,n)=>`<label class="choice"><input type="radio" name="choice-${esc(id)}" value="${n}" ${a?.choice===n?'checked':''}><span>${circled[n]} ${esc(c)}</span></label>`).join('')}</fieldset><button class="grade" type="button">채점하기</button><p class="grade-result ${a?(a.correct?'ok':'wrong'):''}" role="status">${a?(a.correct?'정답입니다.':'다시 확인해 보세요.')+' · 테스트 기록에만 저장':''}</p><details class="answer"><summary>정답·해설 보기</summary><div class="answer-content"><b>정답 ${circled[q.answer]}</b><p>${esc(q.explanation)}</p><ol>${q.distractorReasons.map((r,n)=>`<li>${circled[n]} ${esc(r)}</li>`).join('')}</ol></div><div class="quick-feedback"><p><b>풀어 보니 어땠나요?</b> <span class="hint">선택 사항</span></p><div class="feedback-actions"><button type="button" data-feedback="surprise">낯설지만 납득돼요</button><button type="button" data-feedback="familiar">이미 익숙해요</button><button type="button" data-feedback="forced">억지스럽거나 범위가 의심돼요</button></div><p class="quick-feedback-status hint" role="status">${ev?'평가가 저장되어 있습니다.':''}</p></div></details><details><summary>출제 의도·범위 근거와 AI 자체 검토</summary><div class="audit-content"><p class="hint">${q.styles.map(esc).join(' · ')}</p><p><b>출제 의도</b> ${esc(q.intent)}</p><p><b>함정 후보</b> ${esc(q.trap)}</p><p><b>기출과 다른 지점</b> ${esc(q.novelty)}</p><p><b>계산 부담</b> ${esc(q.calculationLoad)}</p><p><b>범위 경계</b> ${esc(q.boundary)}</p><p><b>근거</b> ${esc(q.basis)}</p>${references(q.references)}<p class="hint">개념 연결: ${q.conceptIds.map(c=>esc(analysis.concepts.find(x=>x.id===c).label)).join(' · ')}<br>관련 기출: ${q.sourceRefs.length?esc(q.sourceRefs.join(', ')):'표본에 직접 대응 문항 없음'}<br>${pack.id===pilot.id?'이 시범본은 정답 형식과 풀이를 AI가 1차 검토했습니다.':'가져오기 형식 검사는 회계 정답을 인증하지 않습니다. 정답·풀이·근거를 별도로 검토하세요.'} 실제 시험 적합성은 아래 사용자 평가로 검토합니다.</p></div></details><details class="quality"><summary>이 문제가 출제위원다운가요? · 품질 평가</summary><p class="hint">0 없음/미흡 · 1 일부 · 2 뚜렷함. 항목마다 좋은 방향이 다릅니다. 해당하지 않는 항목은 미평가로 두세요.</p><div class="review-grid">${E.RUBRIC.map(([key,label,hint])=>`<label>${esc(label)}<small>${esc(hint)}</small><select data-rating="${key}"><option value="">미평가 / 해당 없음</option>${[0,1,2].map(v=>`<option value="${v}" ${ev?.ratings?.[key]===v?'selected':''}>${v} · ${['없음/미흡','일부','뚜렷함'][v]}</option>`).join('')}</select></label>`).join('')}</div><label class="stack">검토 의견<textarea class="quality-note" maxlength="2000" rows="3" placeholder="어색한 선택지, 근거가 부족한 부분, 예상 밖이지만 납득된 지점">${esc(ev?.note||'')}</textarea></label><button class="save-quality" type="button">품질 평가 저장</button><p class="evaluation-status" role="status">${ev?'저장된 사용자 평가가 있습니다. 이전 평가는 이력으로 보존됩니다.':'아직 사용자 평가 전입니다.'}</p></details></article>`;
    }).join('');
    $('#trial-summary').textContent=`${trial.questionIds.length}문항 중 ${done}문항 풀이 · 정답 ${correct}개`;
  }
  async function prepare(){
    if(ready)return true;
    if(loading)return loading;
    const button=$('#start-mode');button.disabled=true;$('#open-tools').disabled=true;button.textContent='문제 준비 중…';
    loading=(async()=>{
      try{
        await Promise.all([window.ExaminerAnalysis?Promise.resolve():loadScript('analysis.js?v=1'),window.ExaminerPilot?Promise.resolve():loadScript('questions.js?v=1'),window.ExaminerLibrary?Promise.resolve():loadScript('library.js?v=1')]);
        analysis=window.ExaminerAnalysis;pilot=E.validatePack(window.ExaminerPilot,analysis);
        if(!Array.isArray(window.ExaminerLibrary)||window.ExaminerLibrary.length>20)throw Error('새 문제 목록을 확인할 수 없습니다.');
        library=window.ExaminerLibrary.map(p=>E.validatePack(p,analysis));
        if(new Set([pilot.id,...library.map(p=>p.id)]).size!==library.length+1)throw Error('새 문제 목록의 이름이 중복되었습니다.');
        try{const raw=localStorage.getItem(E.KEY);state=raw?E.validateState(JSON.parse(raw),analysis,pilot):E.empty()}catch(error){locked=true;notice('기존 테스트 기록을 읽지 못했습니다. 덮어쓰지 않고 보존합니다. '+error.message,true)}
        for(const p of library){const saved=state.packs.find(s=>s.id===p.id);if(saved&&JSON.stringify(saved)!==JSON.stringify(p))throw Error('이미 풀었던 문제와 새 목록의 내용이 다릅니다. 기존 기록을 보존하고 확인이 필요합니다.')}
        $('#style-options').innerHTML=[...E.STYLES,'출제위원 랜덤'].map(s=>'<label class="style-option"><input type="checkbox" value="'+esc(s)+'" '+(E.DEFAULT_STYLES.includes(s)?'checked':'')+'>'+esc(s)+'</label>').join('');
        $('#mode').hidden=false;$('#open-tools').hidden=true;activeTrial=state.trials.at(-1)?.id||'';renderPickers();renderAnalysis();renderQuestions();ready=true;
        $('#ready-note').textContent=library.length?'새로 추가된 문제부터 열립니다. 풀던 문제는 이어서 풀 수 있습니다.':'현재 준비된 시범 6문제를 풀 수 있습니다. 새 출제는 ‘새 문제 부탁하기’를 이용하세요.';
        return true;
      }catch(error){notice('문제를 불러오지 못했습니다. '+error.message,true);return false}
      finally{button.disabled=false;$('#open-tools').disabled=false;button.textContent='문제 풀기';loading=null}
    })();
    return loading;
  }
  async function start(){
    if(!await prepare())return;
    if(locked){notice('기존 기록을 보존하고 있습니다. 복구 후 문제를 열 수 있습니다.',true);return}
    const p=newestPack(),previous=state.trials.filter(t=>t.packId===p.id).at(-1);
    if(previous){activeTrial=previous.id;renderPickers();renderQuestions();notice('풀던 문제를 이어서 엽니다.');focusPractice()}
    else createTrial(p.id,true);
  }
  function focusPractice(){$('#practice-title').focus({preventScroll:true});$('#practice').scrollIntoView({block:'start'})}
  function createTrial(packId=null,quick=false){
    try{
      const p=findPack(packId||$('#pack-select').value),selected=quick?p.questions.slice(0,8):E.selectQuestions(p,selectedStyles(),Number($('#count').value));
      if(!selected.length)throw Error('선택한 스타일의 문제가 없습니다. 다른 스타일을 고르세요.');
      const t={id:uid('trial'),at:now(),packId:p.id,questionIds:selected.map(q=>q.id)},next=E.clone(state);
      if(p.id!==pilot.id&&!next.packs.some(saved=>saved.id===p.id))next.packs.push(E.clone(p));
      next.trials.push(t);if(!save(next))return;
      activeTrial=t.id;renderPickers();renderQuestions();notice(selected.length+'문제를 열었습니다.');focusPractice();
    }catch(error){notice(error.message,true)}
  }
  function quickQuality(card,kind){
    const trial=state.trials.find(t=>t.id===activeTrial),previous=latest(state.evaluations,e=>e.packId===trial.packId&&e.questionId===card.dataset.id);
    const ratings={...(previous?.ratings||{})};
    if(kind==='forced')ratings.forced=2;else{ratings.surprise=kind==='surprise'?2:0;if(kind==='surprise')ratings.forced=0}
    const next=E.clone(state);next.evaluations.push({id:uid('evaluation'),at:now(),packId:trial.packId,questionId:card.dataset.id,ratings,note:previous?.note||''});
    if(save(next)){
      card.querySelector('.quick-feedback-status').textContent='의견을 저장했습니다. 감사합니다.';
      card.querySelector('.evaluation-status').textContent='평가가 저장되어 있습니다.';
      card.querySelectorAll('[data-rating]').forEach(s=>s.value=ratings[s.dataset.rating]??'');
      notice('의견을 저장했습니다.');
    }
  }
  function grade(card){
    const input=card.querySelector('input[type=radio]:checked');if(!input){card.querySelector('.grade-result').textContent='정답 하나를 먼저 선택하세요.';return}
    const t=state.trials.find(t=>t.id===activeTrial),q=findPack(t.packId).questions.find(q=>q.id===card.dataset.id),choice=Number(input.value),next=E.clone(state);
    next.attempts.push({id:uid('attempt'),at:now(),trialId:t.id,questionId:q.id,choice,correct:choice===q.answer});if(!save(next))return;
    const r=card.querySelector('.grade-result');r.textContent=(choice===q.answer?'정답입니다.':'다시 확인해 보세요.')+' · 테스트 기록에만 저장';r.className='grade-result '+(choice===q.answer?'ok':'wrong');card.querySelector('.answer').open=true;const completed=t.questionIds.map(id=>latest(state.attempts,a=>a.trialId===t.id&&a.questionId===id));$('#trial-summary').textContent=`${t.questionIds.length}문항 · 채점한 문제 ${completed.filter(Boolean).length} · 정답 ${completed.filter(a=>a?.correct).length}. 기존 훈련 기록에는 합산하지 않습니다.`;notice('테스트 채점 기록을 저장했습니다.');
  }
  function quality(card){
    const ratings={};card.querySelectorAll('[data-rating]').forEach(s=>{if(s.value!=='')ratings[s.dataset.rating]=Number(s.value)});const note=card.querySelector('.quality-note').value;
    if(!Object.keys(ratings).length&&!note.trim()){notice('평가 항목이나 검토 의견을 하나 이상 입력해 주세요.',true);return}
    const trial=state.trials.find(t=>t.id===activeTrial),next=E.clone(state);next.evaluations.push({id:uid('evaluation'),at:now(),packId:trial.packId,questionId:card.dataset.id,ratings,note});
    if(save(next)){card.querySelector('.evaluation-status').textContent='사용자 품질 평가를 저장했습니다. 이전 평가도 보존됩니다.';notice(ratings.forced===2?'범위·억지 문제로 평가했습니다. 이 문제는 확장 검토에서 보류 대상으로 확인해야 합니다.':'품질 평가를 저장했습니다. 정답률과 별도로 검토합니다.');}
  }
  function download(name,text,type='application/json'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function stage(){
    try{const raw=$('#import-text').value;if(raw.length>250000)throw Error('문제 JSON이 너무 큽니다. 8문항 이하의 작은 묶음을 사용하세요.');const p=E.validatePack(JSON.parse(raw),analysis);if(findPack(p.id))throw Error('이미 있는 묶음 ID입니다. 새 고유 ID를 사용해 주세요.');pending=p;
      $('#pending').innerHTML=`<h3>${esc(p.label)} · ${p.questions.length}문항 · 검토 대기</h3><p class="warning">형식만 통과했습니다. 정답과 범위는 승인 전입니다. 특히 표본 밖 개념의 링크와 단일 정답 여부를 확인하세요.</p>${p.questions.map(q=>`<details class="pending-question"><summary>${esc(q.title)}</summary><p>${esc(q.prompt)}</p>${q.table?tableHtml(q.table):''}<ol>${q.choices.map(c=>`<li>${esc(c)}</li>`).join('')}</ol><p>정답 ${circled[q.answer]} · ${esc(q.explanation)}</p><p>출제 의도: ${esc(q.intent)}<br>기출과 다른 지점: ${esc(q.novelty)}<br>근거: ${esc(q.basis)}<br>범위: ${esc(q.boundary)}</p>${references(q.references)}</details>`).join('')}<p><label><input id="review-confirm" type="checkbox"> 근거·범위·선택지·단일 정답을 검토했고 이 테스트에서 사용하겠습니다.</label></p><button id="approve-import" class="primary" type="button" disabled>검토한 묶음 사용</button>`;notice('형식 검사 통과. 검토 승인 전에는 문제나 기록을 저장하지 않습니다.');
    }catch(error){pending=null;$('#pending').replaceChildren();notice('가져오기를 보류합니다. '+error.message,true)}
  }
  async function readFile(file,limit){if(!file)throw Error('파일을 선택해 주세요.');if(file.size>limit)throw Error('파일이 너무 큽니다.');return file.text()}
  $('#start-mode').addEventListener('click',start);
  $('#open-trial').addEventListener('click',()=>createTrial());
  $('#open-tools').addEventListener('click',()=>prepare());
  $('#request-help').addEventListener('click',()=>{$('#request-guide').hidden=false;$('#request-help').setAttribute('aria-expanded','true');$('#copy-quick-request').focus()});
  $('#copy-quick-request').addEventListener('click',async()=>{try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText($('#quick-request').value);$('#copy-status').textContent='복사했습니다. 지금 대화하던 AI 채팅에 붙여넣고 보내 주세요.'}catch{const t=$('#quick-request');t.focus();t.select();$('#copy-status').textContent='자동 복사가 안 되어 문장을 선택했습니다. 직접 복사하거나 채팅에 같은 문장을 입력해 주세요.'}});
  $('#trial-select').addEventListener('change',()=>{activeTrial=$('#trial-select').value;renderQuestions();if(activeTrial)focusPractice()});
  $('#frequency-filter').addEventListener('change',renderAnalysis);$('#concept-search').addEventListener('input',renderAnalysis);
  $('#questions').addEventListener('click',event=>{const card=event.target.closest('.question');if(!card)return;if(event.target.closest('.grade'))grade(card);if(event.target.closest('.save-quality'))quality(card);const feedback=event.target.closest('[data-feedback]');if(feedback)quickQuality(card,feedback.dataset.feedback)});
  $('#make-request').addEventListener('click',()=>{try{const text=E.buildRequest(analysis,selectedStyles(),Number($('#count').value));$('#request-text').value=text;$('#copy-request').disabled=false;$('#download-request').disabled=false;$('#request-size').textContent=`${text.length.toLocaleString('ko-KR')}자. 압축된 개념별 빈도·판단 포인트만 포함하며 원문 75개를 반복 첨부하지 않습니다. 토큰 수·요금은 사용 AI에 따라 다릅니다.`;notice('출제 요청을 만들었습니다. 아직 AI 호출이나 문제 생성은 하지 않았습니다.')}catch(error){notice(error.message,true)}});
  $('#copy-request').addEventListener('click',async()=>{try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText($('#request-text').value);notice('요청을 복사했습니다. AI 대화에 붙여넣으세요.')}catch{const t=$('#request-text');t.focus();t.select();notice('자동 복사가 불가능한 환경입니다. 선택된 요청을 직접 복사하거나 파일로 저장해 주세요.')}});
  $('#download-request').addEventListener('click',()=>download('출제위원-요청.txt',$('#request-text').value,'text/plain;charset=utf-8'));
  $('#question-file').addEventListener('change',async event=>{try{$('#import-text').value=await readFile(event.target.files[0],250000);stage()}catch(error){notice(error.message,true)}finally{event.target.value=''}});
  $('#stage-import').addEventListener('click',stage);
  $('#pending').addEventListener('change',event=>{if(event.target.id==='review-confirm')$('#approve-import').disabled=!event.target.checked});
  $('#pending').addEventListener('click',event=>{if(event.target.id!=='approve-import'||!pending||!$('#review-confirm').checked)return;const next=E.clone(state);next.packs.push(pending);if(save(next)){const id=pending.id;pending=null;$('#pending').replaceChildren();$('#import-text').value='';renderPickers();$('#pack-select').value=id;notice('검토한 묶음을 추가했습니다. 기존 시범 묶음과 기록은 보존됩니다. 위에서 시범 문제 열기를 누르세요.')}});
  $('#export-state').addEventListener('click',()=>{if(locked){notice('읽을 수 없는 기록을 빈 백업으로 덮어 표현하지 않습니다. 먼저 원본 복구가 필요합니다.',true);return}download('출제위원-테스트-기록.json',JSON.stringify(state,null,2));notice('이 테스트의 기록만 내려받았습니다. 기존 훈련 기록·토큰은 포함하지 않습니다.')});
  $('#restore-state').addEventListener('change',async event=>{try{const incoming=JSON.parse(await readFile(event.target.files[0],2000000)),merged=E.mergeState(state,incoming,analysis,pilot);if(save(merged)){activeTrial=state.trials.at(-1)?.id||'';renderPickers();renderQuestions();notice('같은 시즌의 테스트 기록을 합쳤습니다. 기존 훈련 기록은 변경하지 않았습니다.')}}catch(error){notice('복원을 중단하고 기존 기록을 보존합니다. '+error.message,true)}finally{event.target.value=''}});
})();
