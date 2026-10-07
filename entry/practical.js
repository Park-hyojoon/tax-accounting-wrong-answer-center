// 공통 일반전표 입력기. 원래 메뉴와 출제위원 테스트가 같은 코드를 사용한다.
(function(root){
  'use strict';
  function mount(options={}){
    const host=options.root||document,questionHost=options.target||host.querySelector('#questions');

    const problems=options.problems||globalThis.loadTrainingProblems();

    const el = (s,root=host)=>root.querySelector(s);
    const els = (s,root=host)=>[...root.querySelectorAll(s)];
    const money = n=>Number(n).toLocaleString('ko-KR')+'원';
    const {num:normMoney,normMemo}=EntryGrading;
    const STORAGE_KEY='exam-20260914-practical';
    const nowIso=()=>new Date().toISOString();
    const localDate=(value=Date.now())=>{const d=new Date(value);if(Number.isNaN(d.getTime()))return'';return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
    problems.forEach(p=>{if(!p.addedDate)p.addedDate='2026-09-01'});
    const STATE_VERSION='exam-20260914-practical-schema';
    const OLD_TO_NEW_INDEX={4:0,6:1,8:2,9:3,10:4,11:5,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,24:18,25:19,26:20,27:21,28:22,29:23,30:24,31:25,32:26};
    const defaultState=()=>({schemaVersion:STATE_VERSION,startedAt:nowIso(),updatedAt:nowIso(),cards:{},fileName:`일반전표_새학습_학습기록_${localDate()}`,koAuto:true});
    let studyState=options.state||loadState();
    function migrateStateTo27(rawState={}){
      const source=rawState&&typeof rawState==='object'?rawState:{};
      if(source.schemaVersion===STATE_VERSION)return source;
      const oldCards=source.cards&&typeof source.cards==='object'?source.cards:{},cards={};
      Object.entries(OLD_TO_NEW_INDEX).forEach(([oldIndex,newIndex])=>{
        const oldCard=oldCards[oldIndex];if(!oldCard)return;
        const migratedCard={...oldCard};delete migratedCard.note;cards[newIndex]=migratedCard;
      });
      const fileName=String(source.fileName||'').replace('일반전표_33문제','일반전표_27문제');
      return {...source,schemaVersion:STATE_VERSION,migratedAt:nowIso(),cards,...(fileName?{fileName}:{})};
    }
    function loadState(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'),migrated=migrateStateTo27(raw),s=Object.assign(defaultState(),migrated);if(/^일반전표_(?:24|27|28|31|32|33|34|36|41|43|44|46)문제_학습기록_\d{4}-\d{2}-\d{2}$/.test(s.fileName||''))s.fileName=`일반전표_새학습_학습기록_${localDate()}`;Object.values(s.cards||{}).forEach(c=>{const wasCorrect=c.correct===true||(c.history||[]).some(h=>h.correct);c.passed=c.trainingCenterRestored?false:Boolean(c.passed||wasCorrect);c.archived=Boolean(c.archived);c.history=c.history||[];delete c.note});if(raw.schemaVersion!==STATE_VERSION)localStorage.setItem(STORAGE_KEY,JSON.stringify(s));return s}catch(e){return defaultState()}}
    function saveState(){if(options.save)return options.save(studyState);studyState.updatedAt=nowIso();localStorage.setItem(STORAGE_KEY,JSON.stringify(studyState))}
    function cardState(index){const s=studyState.cards[index]||(studyState.cards[index]={rows:[],graded:false,correct:false,attempts:0,wrongCount:0,history:[],passed:false,archived:false});if(s.passed===undefined)s.passed=false;if(s.archived===undefined)s.archived=false;return s}

    const {REQUIRED_ACCOUNT_CODES,accountParts}=EntryGrading;
    function accountOptionHtml(value){
      const a=accountParts(value),code=a.code||REQUIRED_ACCOUNT_CODES[a.name]||'',optionValue=code?`${code}|${a.name}`:a.name,label=code?`${code} ${a.name}`:a.name;
      return `<option value="${optionValue}">${label}</option>`;
    }
    function answerHtml(a,p){
      const extra=[a.division?`구분: ${a.division}`:'',a.partner?`거래처: ${a.partner}`:'',a.memo?`적요: ${a.memo}`:''].filter(Boolean).join(' · ');
      const code=p.requiredAccountCodes?.[a.account]||REQUIRED_ACCOUNT_CODES[a.account];
      return `<div class="answer-line"><span class="answer-side">${a.side==='D'?'차변':'대변'}</span><span>${code?`${code} `:''}${a.account}</span><span>${extra||'—'}</span><span>${money(a.amount)}</span></div>`;
    }
    function answerColumns(p){
      const column=(side,label)=>{const rows=p.answers.filter(a=>a.side===side).map(a=>answerHtml(a,p)).join('');return `<section class="answer-column"><div class="answer-column-title">${label}</div>${rows||'<div class="answer-empty">해당 없음</div>'}</section>`};
      return `<div class="answer-columns">${column('D','차변')}${column('C','대변')}</div>`;
    }

    function accountField(p){return p.accountSelect?`<select class="account" lang="ko" aria-label="계정과목 선택"><option value="">계정과목 선택</option>${p.accountOptions.map(accountOptionHtml).join('')}</select>`:'<input class="account" type="text" lang="ko" data-ko-auto autocomplete="off" placeholder="계정과목" aria-label="계정과목">'}
    function partnerField(p){return p.partnerOptions?`<select class="partner" lang="ko" aria-label="거래처 선택"><option value="">해당 없음</option>${p.partnerOptions.map(a=>`<option value="${a}">${a}</option>`).join('')}</select>`:'<select class="partner" disabled aria-label="거래처 해당 없음"><option value="">해당 없음</option></select>'}
    function rowHtml(i,p){return `<tr class="entry-row">
      <td><select class="side" aria-label="차변 또는 대변"><option value="D">차변</option><option value="C">대변</option></select></td>
      <td>${accountField(p)}</td>
      <td><input class="amount" type="text" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="금액"></td>
      <td><select class="division" aria-label="판관비 또는 제조원가 구분"><option value="">해당 없음</option><option value="판">판</option><option value="제">제</option></select></td>
      <td>${partnerField(p)}</td>
      <td><input class="memo" type="text" inputmode="numeric" autocomplete="off" placeholder="필요 시 8" aria-label="적요코드"></td>
      <td class="row-state" aria-label="채점 결과"></td>
    </tr>`}

    function questionHtml(p,i){return `<article class="question" data-index="${i}" data-added-date="${p.addedDate}">
      <div class="qhead"><span class="qnum">${i+1}</span><div><h3>${p.title}</h3><span class="tag">${p.type}</span>${p.variantOf!=null?`<span class="tag variant-badge">AI 응용문제 · 원문제 ${p.variantOf+1}번</span>`:''}</div></div>
      <p class="star-note" hidden>★ 이 문제는 특별히 훈련이 필요합니다.</p>
      ${p.exhibit?`<div class="exhibit-layout"><div class="prompt">${p.prompt}</div>${p.exhibit}</div>`:`<div class="prompt">${p.prompt}</div>`}
      <details class="entry-toggle"><summary>전표 입력 영역 열기</summary><div class="entry-toggle-body"><div class="entry-wrap"><table>
        <thead><tr><th>구분</th><th>계정과목</th><th>금액</th><th>판 / 제 선택</th><th>거래처</th><th>적요코드</th><th>결과</th></tr></thead>
        <tbody>${Array.from({length:Math.max(4,p.answers.length)},(_,r)=>rowHtml(r,p)).join('')}</tbody>
      </table></div>
      <div class="balance-panel" aria-live="polite"><div class="balance-item">차변 합계<strong class="debit-total">0원</strong></div><div class="balance-item">대변 합계<strong class="credit-total">0원</strong></div><div class="balance-item difference">차액<strong class="difference-total">0원 · 입력 대기</strong></div></div>
      <p class="tip">금액은 쉼표 없이 입력해도 됩니다. 판관비/제조원가 구분이 필요한 계정은 ‘판/제 선택’을 사용하세요.</p></div></details>
      <div class="qactions"><button class="btn check-one" type="button">채점하기</button><button class="btn secondary clear-one" type="button">이 문제 영구 삭제</button><button class="btn secondary star-one" type="button" aria-pressed="false" title="이 문제는 특별히 훈련이 필요합니다. AI가 학습기록에서 이 표시를 보면 숫자를 바꾼 응용문제 1개를 더 만듭니다.">★ 특별 훈련</button><span class="result" aria-live="polite"></span><span class="attempt-info"></span></div>
      <details class="reveal answer-box"><summary>정답 · 해설 보기</summary><div class="reveal-body">${answerColumns(p)}<p><strong>해설:</strong> ${p.explanation}</p></div></details>
    </article>`}

    questionHost.innerHTML=problems.map(questionHtml).join('');

    function setupAmount(input){
      input.addEventListener('keydown',e=>{
        if(e.key==='+' || e.code==='NumpadAdd'){
          e.preventDefault();
          const digits=input.value.replace(/\D/g,'');
          input.value=(digits?digits+'000':'000').replace(/\B(?=(\d{3})+(?!\d))/g,',');
          input.dispatchEvent(new Event('input',{bubbles:true}));
        }
      });
      input.addEventListener('input',()=>{
        const digits=input.value.replace(/\D/g,'');
        input.value=digits.replace(/\B(?=(\d{3})+(?!\d))/g,',');
      });
    }
    els('.amount').forEach(setupAmount);

    function snapshotRows(card){return els('.entry-row',card).map(row=>({side:el('.side',row).value,account:el('.account',row).value,amount:el('.amount',row).value,division:el('.division',row).value,partner:el('.partner',row).value,memo:el('.memo',row).value}))}
    function updateTotals(card){
      let debit=0,credit=0;
      els('.entry-row',card).forEach(row=>{const value=normMoney(el('.amount',row).value);if(el('.side',row).value==='D')debit+=value;else credit+=value});
      el('.debit-total',card).textContent=money(debit);el('.credit-total',card).textContent=money(credit);
      const diff=Math.abs(debit-credit),balanced=debit>0&&debit===credit,panel=el('.balance-panel',card);
      panel.classList.toggle('balanced',balanced);el('.difference-total',card).textContent=debit===0&&credit===0?'0원 · 입력 대기':balanced?'0원 · 차·대 일치':`${money(diff)} · ${debit>credit?'차변 초과':'대변 초과'}`;
    }
    function markChanged(card){
      const s=cardState(card.dataset.index);s.rows=snapshotRows(card);s.graded=false;delete s.correct;
      card.classList.remove('correct','wrong');delete card.dataset.graded;delete card.dataset.correct;
      const result=el('.result',card);result.className='result';result.textContent='입력 내용이 자동 저장되었습니다.';
      updateTotals(card);saveState();updateProgress()
    }
    function renderAttempt(card){const s=cardState(card.dataset.index);el('.attempt-info',card).textContent=`채점 ${s.attempts||0}회 · 틀림 ${s.wrongCount||0}회`}
    const DIRECT_INTAKE_INDICES=new Set([...(options.directIndices||problems.map((_,index)=>index)),...problems.flatMap((p,index)=>p.registrationKind==='daily-practice'?[index]:[])]);
    const todayView=new URLSearchParams(location.search).get('view')==='today';
    const typeView=(new URLSearchParams(location.search).get('type')||'').trim();
    const starView=new URLSearchParams(location.search).get('view')==='star';
    // 응용문제의 원문제도 기기의 ★ 상태와 관계없이 같은 묶음에 표시한다.
    const variantSourceIndices=new Set(problems.filter(p=>p.variantOf!=null).map(p=>p.variantOf));
    function restoreCard(card){
      const s=cardState(card.dataset.index),rows=els('.entry-row',card);
      const index=Number(card.dataset.index),problemOf=problems[index]||{},isDirect=DIRECT_INTAKE_INDICES.has(index);
      if(!options.embedded&&(s.deleted||!TrainingSeason.matches(problems[index]))){card.hidden=true;return}
      card.hidden=options.embedded?false:starView?!(s.starred||!isDirect||variantSourceIndices.has(index)):!isDirect?true:Boolean(s.passed||s.archived||(todayView&&card.dataset.addedDate!==localDate()));
      el('.star-one',card).setAttribute('aria-pressed',String(Boolean(s.starred)));el('.star-note',card).hidden=!s.starred;
      (s.rows||[]).forEach((saved,i)=>{if(!rows[i])return;el('.side',rows[i]).value=saved.side||'D';el('.account',rows[i]).value=saved.account||'';el('.amount',rows[i]).value=saved.amount||'';el('.division',rows[i]).value=saved.division||'';el('.partner',rows[i]).value=saved.partner||'';el('.memo',rows[i]).value=saved.memo||''});
      if(s.graded){card.dataset.graded='true';card.dataset.correct=String(Boolean(s.correct));card.classList.toggle('correct',Boolean(s.correct));card.classList.toggle('wrong',!s.correct);const result=el('.result',card);result.className='result '+(s.correct?'ok':'no');result.textContent=s.correct?'정답입니다!':`마지막 채점은 오답입니다. (${s.matched||0}/${problems[Number(card.dataset.index)].answers.length}개 분개 일치)`}
      updateTotals(card);renderAttempt(card)
    }
    els('.question').forEach(restoreCard);

    function readRows(card){return els('.entry-row',card).map((row,index)=>{
      const selected=accountParts(el('.account',row).value);
      return {
      row,index,side:el('.side',row).value,account:selected.name,accountCode:selected.code,amount:normMoney(el('.amount',row).value),division:el('.division',row).value,partner:el('.partner',row).value,memo:normMemo(el('.memo',row).value),
      filled:Boolean(el('.account',row).value.trim()||el('.amount',row).value.trim()||el('.division',row).value||el('.partner',row).value||el('.memo',row).value.trim())
    }}).filter(r=>r.filled)}

    const isMatch=EntryGrading.practicalMatch;

    function grade(card,scroll=false){
      const p=problems[Number(card.dataset.index)], rows=readRows(card), used=new Set();
      els('.entry-row',card).forEach(r=>{el('.row-state',r).textContent='';r.style.background=''});
      const best=EntryGrading.practical(p,rows);
      const matched=best.hits.length;
      best.hits.forEach(found=>{el('.row-state',found.row).textContent='✓';found.row.style.background='#effcf6'});
      rows.filter(r=>!best.hits.includes(r)).forEach(r=>{el('.row-state',r.row).textContent='✕';r.row.style.background='#fff2f2'});
      const ok=best.ok;
      card.dataset.graded='true';card.dataset.correct=String(ok);card.classList.toggle('correct',ok);card.classList.toggle('wrong',!ok);
      const result=el('.result',card);result.className='result '+(ok?'ok':'no');
      result.textContent=ok?'정답입니다!':`다시 확인해보세요. (${matched}/${best.set.length}개 분개 일치)`;
      const s=cardState(card.dataset.index);s.rows=snapshotRows(card);s.graded=true;s.correct=ok;s.matched=matched;s.attempts=(s.attempts||0)+1;if(ok){s.passed=true;s.passedAt=nowIso();delete s.trainingCenterRestored;delete s.selfPassed;delete s.selfPassedAt}else{s.wrongCount=(s.wrongCount||0)+1;s.passed=false;s.trainingCenterRestored=true;s.restoredAt=nowIso();delete s.selfPassed;delete s.selfPassedAt}s.history=s.history||[];s.history.push({at:nowIso(),correct:ok,matched,rows:snapshotRows(card)});saveState();renderAttempt(card);
      options.onGrade?.(card,{correct:ok,matched,wrongLabels:ok?[]:['분개 행']});updateProgress();if(scroll)card.scrollIntoView({behavior:'smooth',block:'center'});return ok;
    }

    function archiveCard(card){
      if(!confirm('이 문제를 영구 삭제할까요?\n목록·통계에서 완전히 사라지고 복구할 수 없습니다.'))return;
      studyState.cards[Number(card.dataset.index)]={deleted:true,deletedAt:nowIso()};saveState();card.dataset.typeFilterBaseHidden='true';card.hidden=true;updateProgress();
    }

    function toggleStar(card){
      const s=cardState(card.dataset.index);s.starred=!s.starred;if(s.starred)s.starredAt=nowIso();else delete s.starredAt;saveState();
      el('.star-one',card).setAttribute('aria-pressed',String(s.starred));el('.star-note',card).hidden=!s.starred;
    }

    els('.question').forEach(card=>{
      el('.check-one',card).addEventListener('click',()=>grade(card));
      el('.clear-one',card).addEventListener('click',()=>archiveCard(card));
      el('.star-one',card).addEventListener('click',()=>toggleStar(card));
      els('.entry-row input,.entry-row select',card).forEach(x=>{x.addEventListener('input',()=>markChanged(card));x.addEventListener('change',()=>markChanged(card))});
    });

    const questionOrder=els('.question');
    questionOrder.forEach(card=>{card.dataset.typeFilterBaseHidden=String(card.hidden)});

    function updateProgress(){
      if(options.embedded){options.onProgress?.(studyState);return}
      const cards=els('.question').filter(c=>!c.hidden&&!c.classList.contains('repeat-filter-hidden')),graded=cards.filter(c=>c.dataset.graded==='true').length,correct=cards.filter(c=>c.dataset.correct==='true').length;
      const wrong=Object.values(studyState.cards).reduce((n,s)=>n+(s.wrongCount||0),0);
      el('#progressText').textContent=`채점 ${graded} / ${cards.length} · 정답 ${correct} · 누적 오답 ${wrong}`;
      el('#progressFill').style.width=(cards.length?graded/cards.length*100:100)+'%';
      if(!cards.length){el('#grandScore').textContent='현재 노출할 문제가 없습니다.';el('#grandMessage').textContent='통과한 문제는 학습 상태에서 다시 볼 수 있습니다.'}
      else if(graded){el('#grandScore').textContent=`${correct} / ${cards.length}문제 정답`;el('#grandMessage').textContent=graded===cards.length?(correct===cards.length?'모두 맞았습니다. 기본기가 아주 탄탄합니다!':'정답과 해설을 확인한 뒤 다시 입력해보세요.'):'아직 채점하지 않은 문제가 있습니다.'}
      else{el('#grandScore').textContent='아직 채점하지 않았습니다.';el('#grandMessage').textContent='각 문제의 ‘채점하기’ 또는 채점해 보세요.'}
    }

    if(!options.embedded){
    el('#recordFileName').value=studyState.fileName||defaultState().fileName;
    el('#koAuto').checked=studyState.koAuto!==false;
    el('#recordFileName').addEventListener('input',e=>{studyState.fileName=e.target.value;saveState()});
    el('#koAuto').addEventListener('change',e=>{studyState.koAuto=e.target.checked;saveState();resetKoreanBuffers()});
    el('#copyPath').addEventListener('click',async()=>{
      const path='D:\\00. 학습센터\\03. 기출문제 연습코너\\또 틀렸다!';
      try{await navigator.clipboard.writeText(path);el('#saveStatus').textContent='폴더 경로를 복사했습니다.'}catch(e){el('#saveStatus').textContent='경로를 복사하지 못했습니다. 화면의 경로를 직접 복사해 주세요.'}
    });

    function safeFileName(raw,suffix=''){
      let name=(raw||'일반전표_학습기록').replace(/[<>:"/\\|?*\x00-\x1F]/g,'-').trim().replace(/\.+$/,'').replace(/\.md$/i,'');
      return `${name}${suffix}.md`
    }
    function fmtDate(iso){try{return new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'medium'}).format(new Date(iso))}catch(e){return iso}}
    function cleanRows(rows){return (rows||[]).filter(r=>String(r.account||'').trim()||normMoney(r.amount)||r.division||String(r.partner||'').trim()||String(r.memo||'').trim())}
    function mdSafe(value){return String(value??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ')}
    function rowTable(rows,answerMode=false){
      const lines=['| 차/대변 | 계정과목 | 금액 | 판/제 | 거래처 | 적요 |','|---|---|---:|---|---|---|'];
      const list=answerMode?rows:cleanRows(rows);
      if(!list.length){lines.push('| - | 입력 없음 | 0원 | - | - | - |');return lines}
      list.forEach(r=>{const account=accountParts(r.account),code=account.code||REQUIRED_ACCOUNT_CODES[account.name]||'',label=code?`${code} ${account.name}`:account.name;lines.push(`| ${r.side==='D'?'차변':'대변'} | ${mdSafe(label)||'미입력'} | ${money(answerMode?r.amount:normMoney(r.amount))} | ${r.division||'-'} | ${mdSafe(r.partner)||'-'} | ${r.memo||'-'} |`)});return lines
    }
    function buildTodayRecord(today=localDate()){
      const all=problems.map((p,i)=>{const s=cardState(i),todayHistory=(s.history||[]).filter(h=>!h.cancelledAt&&localDate(h.at)===today);return{p,i,s,todayHistory}}),list=all.filter(x=>x.todayHistory.length);
      const attempts=list.reduce((n,x)=>n+x.todayHistory.length,0),wrong=list.reduce((n,x)=>n+x.todayHistory.filter(h=>!h.correct).length,0),correct=attempts-wrong;
      const lines=['# 전산회계 1급 일반전표 오늘 학습기록','',`- 학습 날짜: ${today}`,`- 저장 시각: ${fmtDate(nowIso())}`,`- 오늘 학습한 문제: ${list.length}/${problems.length}문제`,`- 오늘 채점 시도: ${attempts}회`,`- 오늘 정답 시도: ${correct}회`,`- 오늘 오답 시도: ${wrong}회`,`- 기록 범위: 오늘 날짜의 채점 이력이 있는 문제와 오늘 이력만`,'','## 오늘 자주 틀린 유형',''];
      const ranked={};list.forEach(x=>{const count=x.todayHistory.filter(h=>!h.correct).length;if(count)ranked[x.p.type]=(ranked[x.p.type]||0)+count});const rankedList=Object.entries(ranked).sort((a,b)=>b[1]-a[1]);
      if(rankedList.length)rankedList.forEach(([type,n])=>lines.push(`- ${type}: ${n}회 틀림`));else lines.push('- 오늘 기록된 오답이 없습니다.');lines.push('');
      if(!list.length)lines.push('## 오늘 학습 문제','', '- 오늘 채점한 문제가 없습니다.','');
      list.forEach(({p,s,todayHistory},order)=>{
        const last=todayHistory[todayHistory.length-1],todayWrong=todayHistory.filter(h=>!h.correct).length;
        lines.push(`## ${order+1}. ${p.title} (${p.type})`,'',`**문제:** ${p.prompt}`,'',`- 오늘 마지막 결과: ${last.correct?'정답':'오답'}`,...(s.selfPassed?[`- 스스로 정답 인정(통과): ${fmtDate(s.selfPassedAt)}`]:[]),`- 오늘 채점 횟수: ${todayHistory.length}회`,`- 오늘 틀린 횟수: ${todayWrong}회`,'','### 현재 입력','',...rowTable(s.rows||[]),'','### 정답','',...rowTable(p.answers,true),'',`**해설:** ${p.explanation}`,'','### 오늘 채점 이력','');
        todayHistory.forEach((h,n)=>{lines.push(`#### 오늘 ${n+1}차 시도 · ${fmtDate(h.at)} · ${h.source==='notebook'?'노트 학습 · 직접 표시 / ':''}${h.correct?'정답':'오답'} (${h.matched}/${p.answers.length}개 일치)`,'',...(h.timing?[`- 시간 훈련: ${(h.timing.elapsedMs/1000).toFixed(1)}초 / 목표 ${h.timing.targetSeconds}초${h.timing.assisted?' (해설 참고)':''}`,'']:[]),...rowTable(h.rows||[]),'')});
        lines.push('---','')
      });
      const starred=all.filter(x=>x.s.starred);
      if(starred.length){lines.push('## ★ 특별 훈련이 필요한 문제 (사용자 표시)','','사용자가 「★ 특별 훈련」으로 표시한 문제입니다. 응용문제가 없는 문제는 같은 구조로 숫자·날짜·거래처만 바꾼 응용문제를 **1개씩만** 만들어 `variantOf`에 원문제 인덱스를 적어 추가해 주세요.','');starred.forEach(x=>{const hasVariant=problems.some(q=>q.variantOf===x.i);lines.push(`- [${x.i+1}] ${x.p.title} (${x.p.type}) · 표시 ${fmtDate(x.s.starredAt||'')} · 응용문제 ${hasVariant?'있음':`없음 → 추가 필요 (variantOf:${x.i})`}`)});lines.push('')}
      lines.push('## AI에게 전달할 요청 예시','', '> 이 오늘 학습기록에서 틀린 문제와 반복해서 헷갈린 유형을 분석해 주세요. 같은 전표 구조를 유지하면서 숫자·날짜·상황을 바꾼 전산회계 1급 실무 응용문제를 만들어 주세요.','');
      return lines.join('\n')
    }
    function createTodayRecord(){const date=localDate(),filename=safeFileName(el('#recordFileName').value),content=buildTodayRecord(date);return{date,filename,content}}
    window.createGeneralJournalTodayRecord=createTodayRecord;
    async function saveLocalRecord({filename:name,content},githubFailure=''){
      const status=el('#saveStatus'),prefix=githubFailure?`GitHub 저장 실패: ${githubFailure}. `:'';
      try{
        if('showSaveFilePicker' in window){const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'Markdown 학습기록',accept:{'text/markdown':['.md']}}]});const writable=await handle.createWritable();await writable.write(content);await writable.close();status.textContent=`${prefix}${handle.name} 파일을 이 기기에 저장했습니다.`;return}
      }catch(e){if(e.name==='AbortError'){status.textContent=`${prefix}로컬 저장을 취소했습니다.`;return}}
      const blob=new Blob([content],{type:'text/markdown;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);status.textContent=`${prefix}${name} 파일을 이 기기에 다운로드했습니다.`
    }
    async function saveTodayRecord(){
      const payload=createTodayRecord(),status=el('#saveStatus'),github=window.TrainingGitHub;
      if(await github?.canSaveRemote?.()){
        status.textContent='GitHub에 오늘 학습기록을 저장하고 있습니다.';
        try{await github.saveDailyRecord('practical',payload.date,payload.content);status.textContent=`${payload.date} 일반전표 오늘 학습기록을 GitHub에 저장했습니다.`;return}
        catch(error){await saveLocalRecord(payload,error?.message||'알 수 없는 오류');return}
      }
      await saveLocalRecord(payload)
    }
    el('#saveTodayRecord').addEventListener('click',saveTodayRecord);
    el('#resetLearning').addEventListener('click',()=>{if(confirm('새 기출 오답의 전표 입력, 채점 이력과 틀린 횟수를 모두 지울까요?')){localStorage.removeItem(STORAGE_KEY);location.reload()}});

    // 영문 자판 상태의 일반적인 두벌식 입력을 한글로 조합한다.
    }
    const C_MAP={r:'ㄱ',R:'ㄲ',s:'ㄴ',e:'ㄷ',E:'ㄸ',f:'ㄹ',a:'ㅁ',q:'ㅂ',Q:'ㅃ',t:'ㅅ',T:'ㅆ',d:'ㅇ',w:'ㅈ',W:'ㅉ',c:'ㅊ',z:'ㅋ',x:'ㅌ',v:'ㅍ',g:'ㅎ'};
    const V_MAP={k:'ㅏ',o:'ㅐ',i:'ㅑ',O:'ㅒ',j:'ㅓ',p:'ㅔ',u:'ㅕ',P:'ㅖ',h:'ㅗ',y:'ㅛ',n:'ㅜ',b:'ㅠ',m:'ㅡ',l:'ㅣ'};
    const CHO=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    const JUNG=['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
    const JONG=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    const V_COMB={'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ','ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ','ㅡㅣ':'ㅢ'};
    const F_COMB={'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ','ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ','ㄹㅂ':'ㄼ','ㄹㅅ':'ㄽ','ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ','ㅂㅅ':'ㅄ'};
    const isC=x=>CHO.includes(x),isV=x=>JUNG.includes(x);
    function romanToHangul(raw){const j=[...raw].map(x=>C_MAP[x]||V_MAP[x]||x);let out='',i=0;while(i<j.length){const x=j[i];if(isC(x)&&isV(j[i+1])){let cho=CHO.indexOf(x),v=j[i+1];i+=2;if(isV(j[i])&&V_COMB[v+j[i]]){v=V_COMB[v+j[i]];i++}let f='';if(isC(j[i])&&JONG.includes(j[i])){const c1=j[i],c2=j[i+1],after=j[i+2];if(isV(c2)){}else if(isC(c2)&&F_COMB[c1+c2]&&!isV(after)){f=F_COMB[c1+c2];i+=2}else{f=c1;i++}}out+=String.fromCharCode(0xAC00+cho*588+JUNG.indexOf(v)*28+JONG.indexOf(f))}else if(isV(x)&&isV(j[i+1])&&V_COMB[x+j[i+1]]){out+=V_COMB[x+j[i+1]];i+=2}else{out+=x;i++}}return out}
    function resetKoreanBuffers(){els('[data-ko-auto]').forEach(x=>{x.dataset.koRaw='';x.dataset.koBase=x.value})}
    function setupKoreanInput(field){field.dataset.koRaw='';field.dataset.koBase=field.value;field.addEventListener('focus',()=>{field.dataset.koRaw='';field.dataset.koBase=field.value});field.addEventListener('blur',()=>{field.dataset.koRaw='';field.dataset.koBase=field.value});field.addEventListener('keydown',e=>{if(el('#koAuto')?.checked===false||e.ctrlKey||e.altKey||e.metaKey)return;const raw=field.dataset.koRaw||'',atEnd=field.selectionStart===field.value.length&&field.selectionEnd===field.value.length;if(e.key==='Backspace'&&raw&&atEnd){e.preventDefault();const next=raw.slice(0,-1);field.dataset.koRaw=next;field.value=(field.dataset.koBase||'')+romanToHangul(next);field.dispatchEvent(new Event('input',{bubbles:true}));return}if(/^[A-Za-z]$/.test(e.key)&&atEnd){e.preventDefault();if(!raw)field.dataset.koBase=field.value;const next=raw+e.key;field.dataset.koRaw=next;field.value=(field.dataset.koBase||'')+romanToHangul(next);field.dispatchEvent(new Event('input',{bubbles:true}));return}field.dataset.koRaw='';field.dataset.koBase=field.value})}
    els('[data-ko-auto]').forEach(setupKoreanInput);
    updateProgress();
    function buildStarView(){
      if(!starView)return;
      document.title='★ 특별 훈련 · 일반전표';
      const sortLabel=el('.sort-label');if(sortLabel)sortLabel.hidden=true;
      const title=el('.section-title');if(title)title.hidden=true;
      const grand=el('.grand');if(grand)grand.hidden=true;
      els('.nav-link').forEach(a=>{const on=a.classList.contains('nav-star');a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
      const current=document.querySelector('.nav-current');if(current)current.textContent='★ 특별 훈련';
      const box=questionHost,groups=new Map();
      els('.question').filter(c=>!c.hidden).forEach(card=>{const p=problems[Number(card.dataset.index)];if(!groups.has(p.type))groups.set(p.type,[]);groups.get(p.type).push(card)});
      const tools='<div class="star-tools"><button class="btn secondary star-open-all" type="button">보기</button><button class="btn secondary star-close-all" type="button">접기</button></div>';
      if(!groups.size){box.innerHTML='<div class="notice">★ 표시한 문제가 아직 없습니다. 「일반전표 입력」에서 문제 아래의 「★ 특별 훈련」 버튼을 누르면 이곳에 유형별로 모입니다.</div>';return}
      const wrap=document.createElement('div');wrap.className='star-view';wrap.innerHTML=tools;
      groups.forEach((cards,type)=>{
        const group=document.createElement('section');group.className='star-group';group.innerHTML=`<h2 class="star-group-title">${type}<small>${cards.length}문제</small></h2>`;
        cards.sort((a,b)=>{const pa=problems[Number(a.dataset.index)],pb=problems[Number(b.dataset.index)];const ka=pa.variantOf!=null?pa.variantOf:Number(a.dataset.index),kb=pb.variantOf!=null?pb.variantOf:Number(b.dataset.index);return ka-kb||Number(pa.variantOf!=null)-Number(pb.variantOf!=null)||Number(a.dataset.index)-Number(b.dataset.index)});
        cards.forEach(card=>{
          const p=problems[Number(card.dataset.index)],s=cardState(card.dataset.index),item=document.createElement('details');item.className='star-item';
          item.innerHTML=`<summary><span class="qnum">${Number(card.dataset.index)+1}</span><span>${p.title}</span>${p.variantOf!=null?`<span class="tag variant-badge">응용문제</span>`:'<span class="tag">기존 문제</span>'}<span class="star-item-meta">채점 ${s.attempts||0}회 · 틀림 ${s.wrongCount||0}회${s.passed?' · 통과':''}</span></summary>`;
          item.appendChild(card);group.appendChild(item);
        });
        wrap.appendChild(group);
      });
      wrap.insertAdjacentHTML('beforeend',tools);box.replaceChildren(wrap);
      els('.star-open-all').forEach(b=>b.addEventListener('click',()=>els('details.star-item').forEach(d=>{d.open=true})));
      els('.star-close-all').forEach(b=>b.addEventListener('click',()=>els('details.star-item').forEach(d=>{d.open=false})));
    }
    if(!options.embedded)buildStarView();
    function installTypeFilter(){
      const input=el('#typeFilter'),options=el('#typeFilterOptions'),status=el('#typeFilterStatus');
      const normalize=value=>String(value||'').trim().replace(/\s+/g,'').toLocaleLowerCase('ko-KR');
      const available=[...new Set(questionOrder.filter(card=>card.dataset.typeFilterBaseHidden!=='true').map(card=>problems[Number(card.dataset.index)]?.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
      options.replaceChildren(...available.map(type=>{const option=document.createElement('option');option.value=type;return option}));
      function applyTypeFilter(){
        const query=normalize(input.value);let visible=0;
        questionOrder.forEach(card=>{
          const baseHidden=card.dataset.typeFilterBaseHidden==='true',matches=TrainingSeason.matches(problems[Number(card.dataset.index)])&&(!query||normalize(problems[Number(card.dataset.index)]?.type).includes(query));
          if(starView){
            const item=card.closest('details.star-item');if(!item)return;
            card.hidden=!matches;item.hidden=!matches;if(matches)visible++;
          }else{card.hidden=baseHidden||!matches;if(!card.hidden)visible++}
        });
        if(starView)els('.star-group').forEach(group=>{const count=els('details.star-item',group).filter(item=>!item.hidden).length;group.hidden=count===0;const small=el('.star-group-title small',group);if(small)small.textContent=`${count}문제`});
        status.textContent=query?`검색 결과 ${visible}문제`:`전체 ${visible}문제`;
        if(query&&!starView&&!visible){
          const specialCount=questionOrder.filter(card=>!DIRECT_INTAKE_INDICES.has(Number(card.dataset.index))&&normalize(problems[Number(card.dataset.index)]?.type).includes(query)).length;
          if(specialCount){const link=document.createElement('a');link.className='open-link';link.href=`일반전표_기본연습_24문제.html?view=star&type=${encodeURIComponent(input.value.trim())}`;link.textContent=`★ 특별훈련 ${specialCount}문제 보기`;status.append(' · ',link)}
        }
        updateProgress();
        if(query&&!visible){el('#grandScore').textContent='검색 결과가 없습니다.';el('#grandMessage').textContent='유형 태그의 일부 글자만 입력하거나 「전체」를 눌러보세요.'}
      }
      input.value=typeView;input.addEventListener('input',applyTypeFilter);
      el('#clearTypeFilter').addEventListener('click',()=>{input.value='';applyTypeFilter();input.focus()});
      applyTypeFilter();
    }
    if(!options.embedded)installTypeFilter();
    (function(){
    if(options.embedded)return;
    if(typeof window.TrainingGitHub?.installSyncBar!=='function'){const button=document.querySelector('#syncAll');if(button)button.addEventListener('click',()=>alert('동기화 기능을 불러오지 못했습니다. Ctrl+F5로 새로고침한 뒤 다시 눌러주세요.'));return}
    TrainingGitHub.installSyncBar({onNeedToken:({mobile})=>{if(mobile)TrainingGitHub.showToast('처음 한 번만 오답 훈련센터 홈 아래쪽에서 GitHub 토큰을 연결한 뒤 다시 눌러주세요.',8000)}});
  })();

    if(options.embedded)els('.clear-one,.star-one,.star-note').forEach(element=>element.remove());
    return {state:studyState,save:saveState,refresh:updateProgress,grade,readRows,snapshotRows,isMatch,updateTotals,questionHtml,dispose(){}};

  }
  root.PracticalEntry={mount};
})(globalThis);
