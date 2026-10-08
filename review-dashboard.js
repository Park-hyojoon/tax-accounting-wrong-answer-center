(function(){
  'use strict';
  const R=TrainingReview,S=TrainingGitHub.SOURCES,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id),settingsKey='exam-20260914-review-options';
  let preferences={};try{preferences=JSON.parse(localStorage.getItem(settingsKey)||'{}')}catch(_){}
  for(const [id,key] of [['reviewSubject','subject'],['reviewLimit','limit']])if([...$(id).options].some(o=>o.value===String(preferences[key])))$(id).value=preferences[key];
  function states(){return Object.fromEntries(Object.entries(S).map(([subject,s])=>{const value=JSON.parse(localStorage.getItem(s.key)||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid learning state');return[subject,value]}))}
  function link(group){const url=new URL(S[group.subject].file,location.href);url.searchParams.set('review','1');url.searchParams.set('view','all');url.searchParams.set('fresh','1');url.searchParams.set('weakrefs',group.candidate.id);return url.href}
  function dueText(g){return g.category==='new'?'첫 연습':g.practicedToday?`다음 복습 ${R.day(g.due)}`:g.due<=Date.now()?`복습 예정 ${R.day(g.due)}`:`다음 복습 ${R.day(g.due)}`}
  function render(){
    let all;try{all=R.analyze(window.TrainingSeasonCatalog||[],states())}catch(_){$('reviewSummary').textContent='학습기록을 읽지 못했습니다. 기록을 보존했으며, 복습 추천을 잠시 중단합니다. 학습기록 백업을 확인해 주세요.';for(const id of ['reviewList','reviewMistakes','reviewSchedule'])$(id).replaceChildren();return}
    const subject=$('reviewSubject').value,mode=$('reviewMode').value,limit=Number($('reviewLimit').value),oldType=$('focusType').value;
    const groups=all.filter(g=>!subject||g.subject===subject);
    $('focusType').replaceChildren(new Option('최근 오답 유형',''));
    const available=new Set(groups.flatMap(g=>g.entries.map(R.topic)));
    for(const [key,label] of R.TOPICS)if(available.has(key))$('focusType').add(new Option(label,key));
    if([...$('focusType').options].some(o=>o.value===oldType))$('focusType').value=oldType;
    $('focusTypeLabel').hidden=mode!=='focus';
    const type=$('focusType').value,queue=R.select(all,{subject,mode,limit,focusTopic:mode==='focus'?type:''});
    const done=groups.filter(g=>g.practicedToday).length;
    $('reviewSummary').textContent=`오늘 연습한 유형 ${done}개 · 복습 시점이 된 유형 ${groups.filter(g=>!g.practicedToday&&g.due&&g.due<=Date.now()).length}개 · 아직 안 푼 유형 ${groups.filter(g=>g.category==='new').length}개`;
    $('reviewListTitle').textContent=mode==='focus'?'선택한 집중훈련':'오늘의 추천';
    $('reviewList').innerHTML=queue.map(g=>`<article class="review-row"><div><span>${esc(S[g.subject].label)} · ${g.category==='new'?'새 유형':g.category==='maintenance'?'감각 유지':'다시 확인'}</span><h3>${esc(g.candidate.title)}</h3><p class="review-reason">${esc(dueText(g))} · 같은 유형 ${g.entries.length}문제 중 선택</p></div><a class="open-link" href="${esc(link(g))}">문제 풀기</a></article>`).join('')||`<p>${mode==='balanced'&&done>=limit?'오늘 목표를 채웠습니다. 다음 날 새 추천을 확인하세요.':mode==='focus'?'선택 범위에 해당하는 문제가 없습니다. 다른 주제를 선택해 주세요.':'지금 복습할 유형이 없습니다. 아래에서 다음 복습일을 확인하세요.'}</p>`;
    const fields=groups.filter(g=>g.fields.length);
    $('reviewMistakes').innerHTML=fields.map(g=>`<div class="review-row"><div><strong>${esc(S[g.subject].label)} · ${esc(g.label)}</strong><p>${g.fields.map(([label,count])=>`${esc(label)} ${count}회`).join(' · ')}</p></div><button class="btn focus-review" data-key="${esc(g.key)}" type="button">이 유형 집중훈련</button></div>`).join('')||'<p>반복 실수를 판단할 기록이 아직 충분하지 않습니다. 채점 기록이 쌓이면 표시됩니다.</p>';
    $('reviewSchedule').className='review-schedule';
    $('reviewSchedule').innerHTML='<table><thead><tr><th>분야</th><th>유형</th><th>복습 일정</th></tr></thead><tbody>'+[...groups].sort((a,b)=>a.due-b.due||a.label.localeCompare(b.label,'ko')).map(g=>`<tr><td>${esc(S[g.subject].label)}</td><td>${esc(g.label)}</td><td>${esc(dueText(g))}</td></tr>`).join('')+'</tbody></table>';
  }
  document.querySelector('.review-options').addEventListener('change',()=>{localStorage.setItem(settingsKey,JSON.stringify({subject:$('reviewSubject').value,limit:$('reviewLimit').value}));render()});
  $('reviewMistakes').addEventListener('click',e=>{const b=e.target.closest('.focus-review');if(!b)return;const entry=(window.TrainingSeasonCatalog||[]).find(e=>R.typeKey(e)===b.dataset.key);$('reviewMode').value='focus';$('focusType').value=entry?R.topic(entry):'';render();$('reviewListTitle').scrollIntoView({block:'start'})});
  window.addEventListener('pageshow',render);window.addEventListener('focus',render);window.addEventListener('storage',render);render();
})();
