(function(root){
  'use strict';
  const subjects=['practical','voucher','theory'],labels={practical:'일반전표',voucher:'매입매출전표',theory:'이론'};
  function read(key){try{const s=JSON.parse(sessionStorage.getItem(key)||'null');return s?.version===1&&subjects.every(k=>Array.isArray(s.subjects?.[k]))?s:null}catch(_){return null}}
  function write(key,s){sessionStorage.setItem(key,JSON.stringify(s));return s}
  function create(key,selections){const old=read(key),day=TrainingReview.day(Date.now());if(old?.day===day)return old;return write(key,{version:1,day,token:Date.now()+'-'+Math.random().toString(36).slice(2),startedAt:Date.now(),subjects:Object.fromEntries(subjects.map(k=>[k,[...new Set((selections[k]||[]).map(String))].slice(0,3)])),visited:{}})}
  function active(key){const p=new URLSearchParams(location.search),s=read(key);return p.get('combo')==='1'&&s&&p.get('reviewSession')===s.token?s:null}
  function url(s,subject,sources){const u=new URL(sources[subject].file,location.href);u.searchParams.set('combo','1');u.searchParams.set('reviewSession',s.token);u.searchParams.set('review','1');u.searchParams.set('view','all');u.searchParams.set('weakrefs',s.subjects[subject].join(','));u.searchParams.set('sort','registered');if(!s.visited[subject])u.searchParams.set('fresh','1');return u.href}
  function install({key,subject,sources,history,returnURL}){
    const s=active(key);if(!s)return null;
    document.body.classList.add('combo-review');
    const heading=document.querySelector('.page-head h1')||document.querySelector('main h1');
    if(!heading)return null;
    heading.textContent='복합 복습 · 세 분야 3문제씩';
    const row=heading.closest('.review-heading-row')||heading.parentElement;
    const nav=document.createElement('nav');nav.className='combo-tabs';nav.setAttribute('aria-label','복합 복습 분야');
    s.visited[subject]=true;write(key,s);
    for(const k of subjects){const a=document.createElement(s.subjects[k].length?'a':'span');a.className='combo-tab';a.dataset.subject=k;if(a.tagName==='A')a.href=url(s,k,sources);else a.setAttribute('aria-disabled','true');if(k===subject)a.setAttribute('aria-current','page');nav.append(a)}
    row.append(nav);
    const status=document.createElement('p');status.className='combo-status';status.setAttribute('role','status');
    const back=document.createElement('a');back.href=returnURL;back.textContent='오늘 복습 목록으로';back.className='combo-back';
    document.querySelector('.page-head')?.append(status,back);
    function update(){let total=0,count=0;for(const k of subjects){const ids=s.subjects[k];const done=ids.filter(id=>{const h=(history(k,id)||[]).filter(e=>!e.cancelledAt&&Date.parse(e.at)>=s.startedAt&&typeof e.correct==='boolean');return h.at(-1)?.correct===true}).length;total+=ids.length;count+=done;nav.querySelector('[data-subject="'+k+'"]').textContent=labels[k]+' 풀기 · '+done+'/'+ids.length}status.textContent='통과 '+count+' / '+total+'문제 · 분야를 바꿔도 입력한 답안은 유지됩니다.'+(total&&count===total?' 오늘의 복합 복습을 모두 마쳤습니다.':'')}
    document.addEventListener('click',e=>{if(e.target.closest('.check-one,.notebook-pass,.notebook-wrong,.notebook-restore,.notebook-toast button'))setTimeout(update,0)},true);
    document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='z')setTimeout(update,0)},true);
    update();return{session:s,update};
  }
  root.TrainingComboReview={read,create,active,url,install};
})(window);
