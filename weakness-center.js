(function(){
  'use strict';
  const params=new URLSearchParams(location.search);
  if(!params.has('weakness'))return;
  const main=document.querySelector('main');if(!main)return;
  const data=window.TrainingWeaknessData||{groups:[],total:0};
  const catalog=window.TrainingSeasonCatalog||[];
  const progress=window.TrainingGitHub;
  const files={theory:'이론_오답응용_5문제.html',practical:'일반전표_기본연습_24문제.html',voucher:'매입매출전표_오답연습_3문제.html'};
  const subjects={theory:'이론',practical:'일반전표',voucher:'매입매출전표'};
  const refKey=ref=>ref.subject+':'+ref.id;
  const repeated=new Set(data.groups.flatMap(group=>group.refs.map(refKey)));
  const formatDate=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  let source=params.get('weaknessSource')==='submitted'?'submitted':'recent',kind='type',subjectFilter='all';

  main.replaceChildren();
  const style=document.createElement('style');
  style.textContent=[
    '.weak-toolbar,.weak-batch{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}',
    '.weak-toolbar button{padding:10px 14px;border:1px solid #cdd2d9;border-radius:7px;background:white;color:#374151;font:inherit;cursor:pointer}',
    '.weak-toolbar button[aria-pressed=true]{background:#4b5563;color:white}',
    '.weak-sources button{font-weight:700}.weak-description{line-height:1.7;color:#4b5563}',
    '.weak-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:12px}',
    '.weak-card{padding:16px;border:1px solid #d5d9df;border-radius:8px;background:white;min-width:0}',
    '.weak-card h3{margin:8px 0;font-size:18px;overflow-wrap:anywhere}',
    '.weak-card p{font-size:14px;color:#5b6470;line-height:1.6}',
    '.weak-card a,.weak-batch a{display:inline-block;padding:8px 10px;margin:4px;border:1px solid #cdd2d9;border-radius:5px;color:#334155;text-decoration:none;overflow-wrap:anywhere}',
    '.weak-card details{margin-top:8px;font-size:14px}.weak-card summary{cursor:pointer}',
    '.weak-badge{display:inline-block;padding:4px 8px;margin:0 6px 4px 0;border-radius:5px;background:#eef2f6;color:#475569;font-size:13px}',
    '.weak-badge.repeat{background:#fff1d6;color:#865000}',
    '.weak-empty{grid-column:1/-1;padding:20px;background:white;border:1px solid #d5d9df;border-radius:8px;line-height:1.7}'
  ].join('');
  document.head.append(style);
  const heading=document.createElement('h2');heading.textContent='특별훈련 · 반복 약점';main.append(heading);
  const sources=document.createElement('div');sources.className='weak-toolbar weak-sources';sources.setAttribute('aria-label','약점 기록 구분');main.append(sources);
  const intro=document.createElement('p');intro.className='weak-description';main.append(intro);
  const bar=document.createElement('div');bar.className='weak-toolbar';bar.setAttribute('aria-label','문제 분류');main.append(bar);
  const batch=document.createElement('div');batch.className='weak-batch';main.append(batch);
  const grid=document.createElement('div');grid.className='weak-grid';main.append(grid);

  function readStates(){return Object.fromEntries(Object.keys(files).map(subject=>{
    try{return [subject,JSON.parse(localStorage.getItem('exam-20260914-'+subject)||'{}')||{}]}catch(_){return [subject,{}]}
  }))}
  function link(refs,label){
    const a=document.createElement('a'),url=new URL(files[refs[0].subject],location.href);
    url.searchParams.set('view','all');url.searchParams.set('fresh','1');url.searchParams.set('weakrefs',refs.map(r=>r.id).join(','));url.searchParams.set('weaknessSource',source);
    a.href=url.href;a.textContent=label;return a;
  }
  function filter(label,value,selected,action){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.kind=value;b.setAttribute('aria-pressed',String(value===selected));b.onclick=action;bar.append(b);
  }
  function empty(message){const p=document.createElement('p');p.className='weak-empty';p.textContent=message;grid.append(p)}
  function render(){
    const states=readStates(),seen=new Set(),recent=[];
    for(const ref of catalog){
      if(!files[ref.subject]||seen.has(refKey(ref)))continue;seen.add(refKey(ref));
      const review=progress.recentReview(ref.subject,ref.id,states[ref.subject]);
      if(review)recent.push({...ref,...review});
    }
    recent.sort((a,b)=>Date.parse(b.lastAt)-Date.parse(a.lastAt)||refKey(a).localeCompare(refKey(b)));
    const groups=data.groups.map(group=>({...group,refs:group.refs.filter(ref=>!progress.isCompleted(ref.subject,ref.id,states[ref.subject]))})).filter(group=>group.refs.length);
    sources.querySelector('[data-source=recent]').textContent='훈련 중 오답 · '+recent.length+'문제';
    sources.querySelector('[data-source=submitted]').textContent='직접 제출 반복 · '+groups.length+'묶음';
    sources.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.source===source)));
    bar.replaceChildren();batch.replaceChildren();grid.replaceChildren();
    if(source==='recent'){
      intro.textContent=progress.reviewSince.replaceAll('-','.')+'부터 채점에서 틀렸거나 ‘틀렸어요 · 다시 연습’으로 표시한 문제입니다. 정답·통과하면 다음 방문부터 빠지고, 다시 틀리면 돌아옵니다. 날짜가 남아 있는 학습기록을 기준으로 모읍니다.';
      for(const [subject,label] of [['all','전체'],...Object.entries(subjects)]){
        const count=recent.filter(ref=>subject==='all'||ref.subject===subject).length;
        filter(label+' · '+count,subject,subjectFilter,()=>{subjectFilter=subject;render()});
      }
      const visible=recent.filter(ref=>subjectFilter==='all'||ref.subject===subjectFilter);
      for(const subject of Object.keys(files)){
        const refs=visible.filter(ref=>ref.subject===subject);
        if(refs.length)batch.append(link(refs,subjects[subject]+' '+refs.length+'문제 이어 풀기'));
      }
      if(!visible.length)empty('현재 다시 풀 훈련 중 오답이 없습니다. '+progress.reviewSince.replaceAll('-','.')+' 이후 틀린 문제가 여기에 자동으로 모입니다.');
      for(const ref of visible){
        const card=document.createElement('article');card.className='weak-card weak-recent-card';card.dataset.subject=ref.subject;card.dataset.id=String(ref.id);
        const badge=document.createElement('span');badge.className='weak-badge';badge.textContent=subjects[ref.subject];card.append(badge);
        if(repeated.has(refKey(ref))){const repeat=document.createElement('span');repeat.className='weak-badge repeat';repeat.textContent='반복 약점에도 포함';card.append(repeat)}
        const title=document.createElement('h3');title.textContent=ref.title;card.append(title);
        const detail=document.createElement('p');detail.textContent='시작일 이후 오답 '+ref.count+'회 · 최근 '+formatDate.format(new Date(ref.lastAt));card.append(detail);
        card.append(link([ref],'다시 풀기'));grid.append(card);
      }
      return;
    }
    intro.textContent='직접 제출한 오답 '+data.total+'건에서 다시 제출된 같은 문제 또는 3회 이상 확인된 유사 유형·큰 개념을 모았습니다. 훈련 중 채점 횟수와 별도로 집계하며, 각 묶음에서는 미통과 문제만 보여줍니다.';
    for(const [value,label] of [['same','다시 제출한 같은 문제'],['type','유사 유형 3회 이상'],['concept','큰 개념 3회 이상']])filter(label+' · '+groups.filter(g=>g.kind===value).length,value,kind,()=>{kind=value;render()});
    const active=groups.filter(group=>group.kind===kind);
    if(!active.length)empty(data.groups.some(group=>group.kind===kind)?'이 분류에 남은 미통과 문제가 없습니다.':'이 분류에 해당하는 반복 제출 기록이 아직 없습니다.');
    for(const group of active){
      const card=document.createElement('article');card.className='weak-card';
      const title=document.createElement('h3');title.textContent=group.label;card.append(title);
      const count=document.createElement('p');count.textContent=(group.resubmitted?'같은 문제 재제출 ':'직접 제출 ')+group.count+'건 · 남은 문제 '+group.refs.length+'개 · 최근 '+group.last;card.append(count);
      for(const subject of Object.keys(files)){const refs=group.refs.filter(ref=>ref.subject===subject);if(refs.length)card.append(link(refs,subjects[subject]+' 다시 풀기 ('+refs.length+')'))}
      const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='포함된 문제 보기';detail.append(summary);
      group.refs.forEach(ref=>{const item=document.createElement('div');item.append(link([ref],ref.title));detail.append(item)});card.append(detail);grid.append(card);
    }
  }
  for(const value of ['recent','submitted']){
    const button=document.createElement('button');button.type='button';button.dataset.source=value;
    button.onclick=()=>{source=value;const url=new URL(location.href);url.searchParams.set('weaknessSource',source);history.replaceState(null,'',url.href);render()};sources.append(button);
  }
  window.addEventListener('storage',event=>{if(event.key===null||/^exam-20260914-(theory|practical|voucher)$/.test(event.key))render()});
  window.addEventListener('pageshow',event=>{if(event.persisted)render()});
  render();
})();
