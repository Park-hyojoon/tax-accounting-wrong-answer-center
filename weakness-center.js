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
  let source=['submitted','all'].includes(params.get('weaknessSource'))?params.get('weaknessSource'):'recent',kind='type',subjectFilter='all';

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
    '.weak-empty{grid-column:1/-1;padding:20px;background:white;border:1px solid #d5d9df;border-radius:8px;line-height:1.7}',
    '.weak-profile{margin:20px 0;padding:20px;border:1px solid #d5d9df;border-radius:10px;background:white}',
    '.weak-profile h3{margin:0 0 8px;font-size:20px}.weak-profile p{line-height:1.7;margin:8px 0}',
    '.weak-profile-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:center}',
    '.weak-profile svg{display:block;width:100%;max-width:460px;margin:auto;height:auto}',
    '.weak-profile-list{list-style:none;padding:0;margin:0}.weak-profile-list li{display:grid;grid-template-columns:1fr auto;gap:6px 12px;padding:12px 0;border-bottom:1px solid #e5e7eb}',
    '.weak-profile-meta{grid-column:1/-1;color:#5b6470}.weak-profile-list [data-status=weak] strong{color:#a33b26}.weak-profile-list [data-status=strong] strong{color:#26754b}',
    '.weak-profile-note{color:#5b6470}.weak-profile-tip{padding:12px 14px;background:#f1f5f9;border-radius:7px;overflow-wrap:anywhere}',
    '@media(max-width:760px){.weak-profile{padding:14px}.weak-profile-body{grid-template-columns:1fr;gap:4px}}'
  ].join('');
  document.head.append(style);
  const heading=document.createElement('h2');heading.textContent='특별훈련 · 반복 약점';main.append(heading);
  const sources=document.createElement('div');sources.className='weak-toolbar weak-sources';sources.setAttribute('aria-label','약점 기록 구분');main.append(sources);
  const profile=document.createElement('section');profile.className='weak-profile';profile.setAttribute('aria-labelledby','weakProfileTitle');main.append(profile);
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
    if(source==='all')url.searchParams.set('reviewAll','1');
    a.href=url.href;a.textContent=label;return a;
  }
  function filter(label,value,selected,action){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.kind=value;b.setAttribute('aria-pressed',String(value===selected));b.onclick=action;bar.append(b);
  }
  function empty(message){const p=document.createElement('p');p.className='weak-empty';p.textContent=message;grid.append(p)}
  const axes=[
    {label:'회계 기초·수익/비용',lines:['회계 기초','수익·비용']},
    {label:'재고자산·매출원가',lines:['재고자산','매출원가']},
    {label:'유형·무형자산',lines:['유형·무형','자산']},
    {label:'금융·부채·자본',lines:['금융·부채','자본']},
    {label:'원가회계',lines:['원가회계','배부·공손']},
    {label:'부가세·매입매출전표',lines:['부가세','매입매출전표']}
  ];
  function axisOf(ref){
    const text=[ref.type,...(ref.tags||[])].join(' ');
    if(ref.subject==='voucher'||/부가가치세|부가세|간이과세|세금계산서/.test(text))return 5;
    if(/재고자산|상품재고|매출원가|순실현가능|이동평균|재고감모/.test(text))return 1;
    if(/원가회계|제조간접|직접노무|종합원가|개별원가|공손|원가행태|준변동|준고정|완성품환산/.test(text))return 4;
    if(/유형자산|무형자산|감가상각|개발비|자본적지출|수익적지출|건설중인/.test(text))return 2;
    if(/유가증권|매도가능|단기매매|사채|차입|채권|어음|외화|외환|자본금|주식|증자|이익잉여|충당부채|퇴직연금|대손|정기예금|선납세금/.test(text))return 3;
    return 0;
  }
  function learningProfile(states){
    const result=axes.map(axis=>({...axis,total:0,correct:0,wrong:0,score:null})),seen=new Set();
    for(const ref of catalog){
      if(!files[ref.subject]||seen.has(refKey(ref)))continue;seen.add(refKey(ref));
      const state=states[ref.subject]||{};
      const card=ref.subject==='theory'?{deleted:state.deleted?.[ref.id],history:state.history?.[ref.id]}:state.cards?.[ref.id];
      if(!card||card.deleted)continue;
      let latest=null,time=-Infinity;
      for(const event of Array.isArray(card.history)?card.history:[]){
        const at=Date.parse(event?.at);
        if(event?.cancelledAt||event?.source==='notebook'||typeof event?.correct!=='boolean'||!Number.isFinite(at))continue;
        if(at>=time){latest=event;time=at}
      }
      if(!latest)continue;
      const axis=result[axisOf(ref)];axis.total++;if(latest.correct)axis.correct++;else axis.wrong++;
    }
    result.forEach(axis=>{if(axis.total)axis.score=Math.round(axis.correct/axis.total*100)});
    return result;
  }
  function renderProfile(states){
    const scores=learningProfile(states),total=scores.reduce((sum,axis)=>sum+axis.total,0);
    profile.replaceChildren();
    const title=document.createElement('h3');title.id='weakProfileTitle';title.textContent='나의 강점·취약점';profile.append(title);
    const description=document.createElement('p');description.textContent='현재 시즌의 이론·일반전표·매입매출전표를 6개 학습 영역으로 묶었습니다. 바깥쪽에 가까울수록 최근 정답률이 높습니다.';profile.append(description);
    const body=document.createElement('div');body.className='weak-profile-body';profile.append(body);
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 460 380');svg.setAttribute('role','img');svg.setAttribute('aria-labelledby','weakRadarTitle weakRadarDescription');
    const node=(tag,attributes,text)=>{const el=document.createElementNS(ns,tag);Object.entries(attributes||{}).forEach(([key,value])=>el.setAttribute(key,value));if(text!==undefined)el.textContent=text;svg.append(el);return el};
    node('title',{id:'weakRadarTitle'},'학습 영역별 최근 정답률 육각형 그래프');
    node('desc',{id:'weakRadarDescription'},scores.map(axis=>axis.label+': '+(axis.score===null?'채점 기록 없음':axis.score+'%, '+axis.total+'문제')).join('. '));
    const point=(i,radius)=>{const angle=-Math.PI/2+i*Math.PI/3;return [230+Math.cos(angle)*radius,190+Math.sin(angle)*radius]};
    for(const level of [.25,.5,.75,1])node('polygon',{points:scores.map((_,i)=>point(i,106*level).join(',')).join(' '),fill:'none',stroke:'#d6dee7','stroke-width':1});
    scores.forEach((axis,i)=>{
      const [x,y]=point(i,106);node('line',{x1:230,y1:190,x2:x,y2:y,stroke:axis.total?'#b7c6d5':'#d6dee7','stroke-dasharray':axis.total?'none':'4 4'});
      const [lx,ly]=point(i,148);axis.lines.forEach((line,j)=>node('text',{x:lx,y:ly+(j-0.5)*17,'text-anchor':'middle',fill:'#334155','font-size':14},line));
    });
    node('text',{x:238,y:88,fill:'#64748b','font-size':12},'100%');
    node('text',{x:238,y:139,fill:'#64748b','font-size':12},'50%');
    if(scores.every(axis=>axis.score!==null))node('polygon',{points:scores.map((axis,i)=>point(i,106*axis.score/100).join(',')).join(' '),fill:'#3283bd', 'fill-opacity':.18,stroke:'#3283bd','stroke-width':2.5});
    else scores.forEach((axis,i)=>{const next=scores[(i+1)%6];if(axis.score!==null&&next.score!==null){const [x1,y1]=point(i,106*axis.score/100),[x2,y2]=point((i+1)%6,106*next.score/100);node('line',{x1,y1,x2,y2,stroke:'#3283bd','stroke-width':2.5})}});
    scores.forEach((axis,i)=>{if(axis.score===null)return;const [cx,cy]=point(i,106*axis.score/100);const dot=node('circle',{cx,cy,r:5,fill:axis.total<3?'#64748b':axis.score<60?'#b64630':axis.score>=80?'#26754b':'#3283bd'});const hint=document.createElementNS(ns,'title');hint.textContent=axis.label+' '+axis.score+'%';dot.append(hint)});
    if(!total)node('text',{x:230,y:196,'text-anchor':'middle',fill:'#64748b','font-size':14},'아직 채점 기록이 없습니다');
    body.append(svg);
    const list=document.createElement('ul');list.className='weak-profile-list';body.append(list);
    scores.forEach((axis,i)=>{
      const status=!axis.total?'unseen':axis.total<3?'few':axis.score<60?'weak':axis.score>=80?'strong':'practice';
      const statusLabel={unseen:'미평가',few:'기록 적음 · 잠정',weak:'복습 우선',strong:'최근 안정적',practice:'연습 중'}[status];
      const row=document.createElement('li');row.dataset.axis=String(i);row.dataset.status=status;
      const label=document.createElement('span');label.textContent=axis.label;
      const rate=document.createElement('strong');rate.className='weak-profile-rate';rate.textContent=axis.score===null?'기록 없음':axis.score+'%';
      const meta=document.createElement('span');meta.className='weak-profile-meta';meta.textContent=axis.total?'최근 정답 '+axis.correct+' / 채점 '+axis.total+'문제 · '+statusLabel:'아직 실제 채점 기록이 없습니다 · '+statusLabel;
      row.append(label,rate,meta);list.append(row);
    });
    const priority=scores.filter(axis=>axis.wrong).sort((a,b)=>a.correct/a.total-b.correct/b.total||b.wrong-a.wrong);
    const tip=document.createElement('p');tip.className='weak-profile-tip';
    tip.textContent=priority.length?'참고 보완 순서: '+priority.map(axis=>axis.label+(axis.total<3?' (잠정)':'')).join(' → ')+'. 최근 정답률이 낮은 순서이며, 학습 순서를 강제하지 않습니다.':total?'최근 채점 결과에는 남은 오답이 없습니다. 미평가 영역은 아직 강점으로 판단하지 않습니다.':'참고 보완 순서는 채점 기록이 쌓이면 표시됩니다.';
    profile.append(tip);
    const note=document.createElement('p');note.className='weak-profile-note';note.textContent='문항별 마지막 실제 채점 1건만 반영합니다. 직접 제출 횟수·자가 통과·노트 표시·취소·삭제 기록은 점수에서 제외합니다. 채점 3문제 미만은 잠정이며, 60% 미만은 복습 우선, 80% 이상은 최근 안정적으로 표시합니다. 등록된 오답 연습 기준이지 시험 전체 실력 점수는 아닙니다. 기록 없는 축에는 점을 그리지 않습니다.';profile.append(note);
  }
  function render(){
    const states=readStates(),seen=new Set(),recent=[];
    renderProfile(states);
    for(const ref of catalog){
      if(!files[ref.subject]||seen.has(refKey(ref)))continue;seen.add(refKey(ref));
      const review=progress.recentReview(ref.subject,ref.id,states[ref.subject]);
      if(review)recent.push({...ref,...review});
    }
    recent.sort((a,b)=>Date.parse(b.lastAt)-Date.parse(a.lastAt)||refKey(a).localeCompare(refKey(b)));
    const groups=data.groups.map(group=>({...group,refs:group.refs.filter(ref=>!progress.isCompleted(ref.subject,ref.id,states[ref.subject]))})).filter(group=>group.refs.length);
    const allSubmitted=(data.all||[]).filter(ref=>files[ref.subject]);
    sources.querySelector('[data-source=recent]').textContent='훈련 중 오답 · '+recent.length+'문제';
    sources.querySelector('[data-source=submitted]').textContent='직접 제출 반복 · '+groups.length+'묶음';
    sources.querySelector('[data-source=all]').textContent='모든 기출문제 오답 복습 · '+allSubmitted.length+'문제';
    sources.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.source===source)));
    bar.replaceChildren();batch.replaceChildren();grid.replaceChildren();
    if(source==='all'){
      intro.textContent='이 메뉴에 넣도록 전달한 기출 오답만 모았습니다. 통과 여부와 관계없이 이론·일반전표·매입매출전표로 나누어 다시 풀 수 있습니다.';
      for(const [subject,label] of [['all','전체'],...Object.entries(subjects)]){
        const count=allSubmitted.filter(ref=>subject==='all'||ref.subject===subject).length;
        filter(label+' · '+count,subject,subjectFilter,()=>{subjectFilter=subject;render()});
      }
      const visible=allSubmitted.filter(ref=>subjectFilter==='all'||ref.subject===subjectFilter);
      for(const subject of Object.keys(files)){
        const refs=visible.filter(ref=>ref.subject===subject);
        if(refs.length)batch.append(link(refs,subjects[subject]+' '+refs.length+'문제 이어 풀기'));
      }
      if(!visible.length)empty('등록된 기출 오답이 없습니다.');
      for(const ref of visible){
        const card=document.createElement('article');card.className='weak-card weak-all-card';card.dataset.subject=ref.subject;card.dataset.id=String(ref.id);
        const badge=document.createElement('span');badge.className='weak-badge';badge.textContent=subjects[ref.subject];card.append(badge);
        if(progress.isCompleted(ref.subject,ref.id,states[ref.subject])){const done=document.createElement('span');done.className='weak-badge';done.textContent='통과 기록 있음';card.append(done)}
        const title=document.createElement('h3');title.textContent=ref.title;card.append(title);
        const detail=document.createElement('p');detail.textContent=ref.type+(ref.examRound?' · '+ref.examRound+'회':'');card.append(detail);
        card.append(link([ref],'복습하기'));grid.append(card);
      }
      return;
    }
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
  for(const value of ['recent','submitted','all']){
    const button=document.createElement('button');button.type='button';button.dataset.source=value;
    button.onclick=()=>{source=value;const url=new URL(location.href);url.searchParams.set('weaknessSource',source);history.replaceState(null,'',url.href);render()};sources.append(button);
  }
  window.addEventListener('storage',event=>{if(event.key===null||/^exam-20260914-(theory|practical|voucher)$/.test(event.key))render()});
  window.addEventListener('pageshow',event=>{if(event.persisted)render()});
  render();
})();
