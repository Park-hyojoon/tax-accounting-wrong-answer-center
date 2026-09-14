(function(){
  'use strict';
  const style=document.createElement('link');style.rel='stylesheet';style.href='season.css?v=4';document.head.append(style);
  const params=new URLSearchParams(location.search);
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function matches(p){return (!params.get('exam')||String(p.examRound)===params.get('exam'))&&(!params.get('tag')||(p.tags||[]).includes(params.get('tag')))}
  function select(label,values,key){
    const el=document.createElement('label');el.textContent=label+' ';const field=document.createElement('select');field.setAttribute('aria-label',label);
    field.add(new Option('전체',''));[...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true})).forEach(x=>field.add(new Option(key==='exam'?x+'회':x,x)));
    field.value=params.get(key)||'';
    field.onchange=()=>{const url=new URL(location.href);field.value?url.searchParams.set(key,field.value):url.searchParams.delete(key);location.href=url.href};el.append(field);return el;
  }
  function install(problems,adapter){
    const host=document.querySelector('.toolbar,.dashboard')||document.querySelector('main');
    const bar=document.createElement('div');bar.className='season-filters';
    bar.append(select('기출 회차',problems.map(p=>p.examRound),'exam'),select('유형 태그',problems.flatMap(p=>p.tags||[p.type]),'tag'));
    const clear=document.createElement('a');const clean=new URL(location.href);['exam','tag','type'].forEach(k=>clean.searchParams.delete(k));clear.href=clean.href;clear.textContent='필터 해제';bar.append(clear);
    host?.classList.add('study-toolbar');host?.prepend(bar);
    document.body.classList.add('study-page');
    if(adapter?.theory)document.body.classList.add('study-theory');
    if(params.get('view')==='star')document.body.classList.add('study-star');
    document.querySelectorAll('.question').forEach(card=>{
      const p=card.dataset.id?problems.find(x=>String(x.id)===card.dataset.id):problems[Number(card.dataset.index)];if(!p)return;
      if(p.examRound){const origin=document.createElement('p');origin.className='season-origin';origin.textContent=`${p.examRound}회 · ${p.sourceQuestionNo||''}번 원문에서 만든 응용문제`;card.querySelector('.qhead')?.after(origin)}
      const brief=card.querySelector('.question-brief'),workspace=card.querySelector('.answer-workspace');
      if(brief&&workspace){while(brief.firstChild)workspace.append(brief.firstChild);brief.remove()}
    });
    if(adapter)notebook(problems,adapter,bar);
    if(!problems.length){const box=document.createElement('section');box.className='season-welcome';box.innerHTML='<span class="season-kicker">NEW CHAPTER</span><h2>다음 기출 오답부터<br>차근차근 쌓아가세요.</h2><p>회차와 틀린 문제를 보내주시면 원문은 회차별 MD로 보관하고,<br>숫자와 조건을 바꾼 응용문제를 이곳에 등록합니다.</p><a href="오답_훈련센터.html">학습 홈으로</a>';host?.after(box)}
  }
  function notebook(problems,a,bar){
    const cards=[...document.querySelectorAll('.question')],theory=a.theory;
    const key=c=>theory?c.dataset.id:c.dataset.index;
    const get=(id,k)=>theory?a.state[k]?.[id]:a.state.cards?.[id]?.[k];
    const put=(id,k,v)=>{const target=theory?(a.state[k]??={}):(a.state.cards[id]??={});target[theory?id:k]=v};
    const status=document.createElement('select');status.setAttribute('aria-label','학습 상태');
    [['active','학습할 문제'],['passed','통과한 문제'],['all','전체 기록']].forEach(([v,t])=>status.add(new Option(t,v)));
    status.value=params.get('status')||'active';bar.insertBefore(status,bar.lastChild);
    status.onchange=()=>{const url=new URL(location.href);url.searchParams.set('status',status.value);location.href=url.href};
    function visibility(card){
      const id=key(card),p=theory?problems.find(p=>p.id===id):problems[Number(id)],passed=!!get(id,'passed'),star=!!get(id,'starred');
      const search=document.querySelector('#typeFilter')?.value||params.get('type')||'';
      const match=matches(p)&&(!search||p.type.includes(search))&&(params.get('view')!=='today'||p.addedDate===new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10));
      const special=params.get('view')==='star',hasVariant=problems.some(x=>x.variantOf===(theory?id:Number(id)));
      card.hidden=!!get(id,'deleted')||!match||(special&&!star&&p.variantOf==null&&!hasVariant)||(status.value==='passed'?!passed:status.value==='active'&&passed&&!star&&!special);
      card.dataset.typeFilterBaseHidden=String(card.hidden);
    }
    const notice=document.createElement('div');notice.className='notebook-toast';notice.hidden=true;notice.setAttribute('role','status');document.body.append(notice);
    let noticeTimer;
    function report(text,undo){
      clearTimeout(noticeTimer);notice.replaceChildren(document.createTextNode(text+' '));
      if(undo){const b=document.createElement('button');b.type='button';b.textContent='되돌리기';b.onclick=()=>{undo();report('되돌렸습니다.')};notice.append(b)}
      notice.hidden=false;noticeTimer=setTimeout(()=>{notice.hidden=true},undo?5000:2500);
    }
    function refresh(card){visibility(card);a.refresh();const id=key(card),history=get(id,'history')||[];
      const count=history.filter(h=>!h.cancelledAt).length,wrong=history.filter(h=>h.correct===false&&!h.cancelledAt).length;
      const label=card.querySelector('.attempt,.attempt-info');if(label)label.textContent=`학습 ${count}회 · 틀림 ${wrong}회`;
      const correct=get(id,theory?'checked':'correct');card.dataset.graded=String(correct===true||correct===false);card.dataset.correct=String(correct===true);a.refresh();
    }
    cards.forEach(card=>{
      const id=key(card),actions=card.querySelector('.qactions,.actions');if(!actions)return;
      const more=document.createElement('details');more.className='question-more';const summary=document.createElement('summary');summary.textContent='더보기';more.append(summary);
      const remove=actions.querySelector('.archive-one,.clear-one');if(remove)more.append(remove);actions.append(more);
      const button=(text,fn,cls)=>{const b=document.createElement('button');b.type='button';b.className='btn secondary '+cls;b.textContent=text;b.onclick=fn;return b};
      function mark(correct){
        const before={};['passed','passedAt','selfPassed','selfPassedAt','trainingCenterRestored','restoredAt','correct','checked','graded'].forEach(k=>before[k]=get(id,k));
        const history=get(id,'history')||[],at=new Date().toISOString(),event={id:crypto.randomUUID(),at,correct,source:'notebook'};
        history.push(event);put(id,'history',history);put(id,'attempts',history.filter(h=>!h.cancelledAt).length);if(!theory)put(id,'wrongCount',history.filter(h=>h.correct===false&&!h.cancelledAt).length);
        put(id,'passed',correct);put(id,theory?'checked':'correct',correct);put(id,'selfPassed',correct);put(id,'selfPassedAt',correct?at:null);
        put(id,'trainingCenterRestored',!correct);put(id,correct?'passedAt':'restoredAt',at);if(!theory)put(id,'graded',true);
        a.save();refresh(card);card.querySelector('.result').textContent=correct?'노트 학습 · 직접 통과':'노트 학습 · 다시 연습';
        report(correct?'통과로 기록했습니다.':'오답으로 기록했습니다.',()=>{
          event.cancelledAt=new Date().toISOString();event.correct=null;
          Object.entries(before).forEach(([k,v])=>put(id,k,v??null));
          if(!before.passed){put(id,'trainingCenterRestored',true);put(id,'restoredAt',event.cancelledAt)}
          put(id,'attempts',history.filter(h=>!h.cancelledAt).length);if(!theory)put(id,'wrongCount',history.filter(h=>h.correct===false&&!h.cancelledAt).length);
          a.save();refresh(card);card.querySelector('.result').textContent='직접 표시를 되돌렸습니다.';
        });
      }
      actions.prepend(button('✓ 알고 있어요 · 통과',()=>mark(true),'notebook-pass'),button('↻ 틀렸어요 · 다시 연습',()=>mark(false),'notebook-wrong'));
      const restore=button('다시 학습하기',()=>{const at=new Date().toISOString();put(id,'passed',false);put(id,'archived',false);put(id,'selfPassed',false);put(id,'trainingCenterRestored',true);put(id,'restoredAt',at);a.save();refresh(card);report('학습할 문제로 옮겼습니다. 기존 기록은 보존됩니다.')},'notebook-restore');
      if(get(id,'passed'))actions.prepend(restore);
      visibility(card);
    });
    a.refresh();
  }
  function catalog(meta,sources){
    // Secondary settings stay available without lengthening the daily study screen.
    for(const [id,label] of [['backupSection','동기화 설정 · 학습기록 백업']]){
      const section=document.getElementById(id);if(!section)continue;
      const details=document.createElement('details');details.className='season-settings';
      const summary=document.createElement('summary');summary.textContent=label;details.append(summary);
      section.querySelector('.section-heading')?.remove();while(section.firstChild)details.append(section.firstChild);section.append(details);
    }
    const host=document.querySelector('#seasonCatalog');if(!host)return;
    const entries=window.TrainingSeasonCatalog||[];
    if(!entries.length)document.getElementById('frequentSection')?.setAttribute('hidden','');
    if(!host.dataset.tagsOnly){
      const descriptions={theory:'헷갈리는 개념을 정확하게',practical:'계정과 차·대변을 차근차근',voucher:'KcLep과 익숙한 입력 흐름'};
      const wrap=document.createElement('div');wrap.className='season-subjects';
      ['theory','practical','voucher'].forEach(key=>{const a=document.createElement('a');a.className='season-subject '+key;a.href=sources[key].file;a.innerHTML=`<span>${escape(sources[key].label)}</span><strong>${entries.filter(e=>e.subject===key).length}<small> 문제</small></strong><p>${descriptions[key]}</p><b>훈련 시작 ↗</b>`;wrap.append(a)});host.append(wrap);
    }
    if(!entries.length){const p=document.createElement('p');p.className='season-empty';p.textContent='새 학습이 준비되었습니다. 아직 등록된 기출 오답은 없습니다.';host.append(p);return}
    const groups=document.createElement('div');groups.className='season-catalog';
    const title=document.createElement('h3');title.textContent='tag';groups.append(title);
    const tags=new Map(),seen=new Set();
    entries.filter(e=>!e.variant&&e.variantOf==null).forEach(e=>{
      const id=e.subject+':'+e.id;if(seen.has(id))return;seen.add(id);
      [...new Set(e.tags?.length?e.tags:[e.type])].filter(Boolean).forEach(tag=>{if(!tags.has(tag))tags.set(tag,[]);tags.get(tag).push(e)});
    });
    const ranked=[...tags].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0],'ko'));
    const colors=['#155E9C','#70ABC9','#8FC4D8'];
    ranked.forEach(([tag,rows],index)=>{
      const subjects=[...new Set(rows.map(e=>e.subject))],a=document.createElement('a');a.className='season-tag';
      a.textContent=tag+' · '+rows.length;a.title=rows.length+'문제 · 모든 회차 · 통과한 문제 포함';
      a.href=subjects.length===1?sources[subjects[0]].file+'?tag='+encodeURIComponent(tag)+'&status=all':'오답_훈련센터.html?tag='+encodeURIComponent(tag);
      if(index<3){a.style.backgroundColor=colors[index];a.style.color=index===0?'#fff':'#173042';a.dataset.rank=String(index+1)}
      groups.append(a);
    });host.append(groups);
    // A shared tag spanning subjects opens each existing trainer, without loading all question data on home.
    const selected=params.get('tag'),selectedRows=tags.get(selected);
    if(selectedRows){
      const panel=document.createElement('section');panel.className='section';const heading=document.createElement('h2');heading.textContent=selected+' · '+selectedRows.length+'문제';panel.append(heading);
      [...new Set(selectedRows.map(e=>e.subject))].forEach(subject=>{const frame=document.createElement('iframe');frame.title=sources[subject].label+' · '+selected;frame.src=sources[subject].file+'?tag='+encodeURIComponent(selected)+'&status=all';frame.style.cssText='width:100%;height:80vh;border:1px solid #d5d9df;margin-top:12px';panel.append(frame)});
      document.querySelector('main')?.prepend(panel);
    }
  }
  window.TrainingSeason={matches,install,catalog};
})();
