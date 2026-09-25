(function(){
  if(!new URLSearchParams(location.search).has('weakness'))return;
  const main=document.querySelector('main');if(!main)return;
  const data=window.TrainingWeaknessData||{groups:[],total:0};
  const files={theory:'이론_오답응용_5문제.html',practical:'일반전표_기본연습_24문제.html',voucher:'매입매출전표_오답연습_3문제.html'};
  const subjects={theory:'이론',practical:'일반전표',voucher:'매입매출전표'};
  const state=Object.fromEntries(Object.keys(files).map(subject=>{
    try{return [subject,JSON.parse(localStorage.getItem('exam-20260914-'+subject)||'{}')]}catch(_){return [subject,{}]}
  }));
  const groups=data.groups.map(group=>({...group,refs:group.refs.filter(ref=>!window.TrainingSeason.isCompleted(ref.subject,ref.id,state[ref.subject]))})).filter(group=>group.refs.length);
  main.replaceChildren();
  const style=document.createElement('style');style.textContent='.weak-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.weak-toolbar button{padding:10px 14px;border:1px solid #cdd2d9;border-radius:7px;background:white;color:#374151;font:inherit;cursor:pointer}.weak-toolbar button[aria-pressed=true]{background:#4b5563;color:white}.weak-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:12px}.weak-card{padding:16px;border:1px solid #d5d9df;border-radius:8px;background:white}.weak-card h3{margin:0 0 8px;font-size:18px}.weak-card p{font-size:14px;color:#5b6470}.weak-card a{display:inline-block;padding:8px 10px;margin:4px;border:1px solid #cdd2d9;border-radius:5px;color:#334155;text-decoration:none}.weak-card details{margin-top:8px;font-size:14px}.weak-card summary{cursor:pointer}.weak-card small{display:block;color:#606975}';document.head.append(style);
  const heading=document.createElement('h2');heading.textContent='특별훈련 · 3회 이상 반복 약점';main.append(heading);
  const intro=document.createElement('p');intro.textContent=`직접 제출한 오답 ${data.total}건을 분석했습니다. 훈련센터 채점 횟수·테스트 기록·AI 응용문제 수는 포함하지 않습니다. 같은 문제는 재오답 연결 근거, 유사 유형은 유형·태그, 큰 개념은 분류 규칙으로 묶습니다.`;main.append(intro);
  const bar=document.createElement('div');bar.className='weak-toolbar';main.append(bar);
  const grid=document.createElement('div');grid.className='weak-grid';main.append(grid);
  function link(refs,label){const a=document.createElement('a');const subject=refs[0].subject;const url=new URL(files[subject],location.href);url.searchParams.set('view','all');url.searchParams.set('fresh','1');url.searchParams.set('weakrefs',refs.map(r=>r.id).join(','));a.href=url.href;a.textContent=label;return a}
  function render(kind){
    grid.replaceChildren();bar.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));
    const active=groups.filter(g=>g.kind===kind);
    if(!active.length){const p=document.createElement('p');p.textContent=data.groups.some(g=>g.kind===kind)?'이 묶음의 문제는 모두 통과했습니다. 다시 학습하려면 학습 상태에서 통과를 해제해 주세요.':'직접 제출 기록에서 3회 이상 확인된 묶음이 아직 없습니다.';grid.append(p);return}
    for(const group of active){const card=document.createElement('article');card.className='weak-card';const h=document.createElement('h3');h.textContent=group.label;card.append(h);
      const count=document.createElement('p');count.textContent=`직접 제출 ${group.count}건 · 연결 문제 ${group.refs.length}개 · 최근 ${group.last}`;card.append(count);
      for(const subject of Object.keys(files)){const refs=group.refs.filter(r=>r.subject===subject);if(refs.length)card.append(link(refs,subjects[subject]+' 다시 풀기 ('+refs.length+')'))}
      const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='포함된 문제 보기';detail.append(summary);group.refs.forEach(ref=>{const item=document.createElement('div');item.append(link([ref],ref.title));detail.append(item)});card.append(detail);grid.append(card);
    }
  }
  for(const [kind,label] of [['same','같은 문제 3회 이상'],['type','유사 유형 3회 이상'],['concept','큰 개념 3회 이상']]){const b=document.createElement('button');b.type='button';b.dataset.kind=kind;b.textContent=label+' · '+groups.filter(g=>g.kind===kind).length;b.onclick=()=>render(kind);bar.append(b)}
  render('type');
})();
