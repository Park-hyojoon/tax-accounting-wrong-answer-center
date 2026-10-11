(function(){
  'use strict';
  function install(problems,adapter){
    const params=new URLSearchParams(location.search),inReview=params.get('review')==='1',subject=adapter.subject||(adapter.theory?'theory':'practical');
    if(window.TrainingComboReview?.active('exam-20260914-review-combo')){
      const sources=TrainingGitHub.SOURCES;
      TrainingComboReview.install({key:'exam-20260914-review-combo',subject,sources,returnURL:'review.html',history:(kind,id)=>{
        let state=adapter.state;if(kind!==subject){try{state=JSON.parse(localStorage.getItem(sources[kind].key)||'{}')}catch(_){return[]}}
        return(kind==='theory'?state.history?.[id]:state.cards?.[id]?.history)||[];
      }});return;
    }
    const link=document.createElement('a');link.className='open-link';link.href='review.html';link.textContent=inReview?'오늘 복습 목록으로':'오늘 복습 시작';
    const heading=document.querySelector('.page-head h1')||document.querySelector('main h1')||document.querySelector('h1');
    if(heading){const row=document.createElement('div');row.className='review-heading-row';heading.before(row);row.append(heading,link)}else document.querySelector('main')?.prepend(link);
    const result=document.createElement('p');result.className='review-entry-result';result.setAttribute('role','status');result.hidden=true;
    if(inReview)document.querySelector('.page-head')?.append(result);
    const refs=problems.map((p,i)=>({...p,subject,id:adapter.theory?p.id:i}));
    const ids=new Set((params.get('weakrefs')||'').split(',').filter(Boolean));
    function update(){
      if(!inReview)return;
      const groups=TrainingReview.analyze(refs,{[subject]:adapter.state});
      const target=groups.find(g=>g.entries.some(e=>ids.has(String(e.id))));
      if(!target)return;
      result.textContent=target.practicedToday?`오늘 연습 완료 · 이 유형의 다음 복습일: ${TrainingReview.day(target.due)}`:'';result.hidden=!result.textContent;
    }
    document.addEventListener('click',e=>{if(e.target.closest('.check-one,.notebook-pass,.notebook-wrong,.notebook-toast button'))setTimeout(update,0)},true);
    update();
  }
  window.TrainingReviewUI={install};
})();
