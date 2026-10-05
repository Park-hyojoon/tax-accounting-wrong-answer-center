(function(){
  'use strict';
  const style=document.createElement('link');style.rel='stylesheet';style.href='season.css?v=22';document.head.append(style);
  const params=new URLSearchParams(location.search);
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function isCompleted(subject,id,state={}){
    return window.TrainingGitHub.isCompleted(subject,id,state);
  }
  // Read only dated, uncancelled events; cumulative counters never create a weakness.
  function priority(subject,id,state={},options={}){
    const card=subject==='theory'?Object.fromEntries(['history','deleted','archived','passedAt','selfPassed','selfPassedAt','trainingCenterRestored'].map(key=>[key,state[key]?.[id]])):state.cards?.[id]||{};
    const now=options.now??Date.now(),cutoff=Date.parse(window.TrainingGitHub.reviewSince+'T00:00:00+09:00'),seen=new Map();
    for(const event of Array.isArray(card.history)?card.history:[]){const key=event?.id||JSON.stringify(event);if(!seen.has(key)||event?.cancelledAt)seen.set(key,event)}
    const events=[...seen.values()].filter(event=>event&&!event.cancelledAt&&typeof event.correct==='boolean'&&Number.isFinite(Date.parse(event.at))&&Date.parse(event.at)>=cutoff&&Date.parse(event.at)<=now).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    const passTime=value=>{const time=Date.parse(value);return Number.isFinite(time)&&time<=now&&!([...seen.values()].some(event=>event?.cancelledAt&&event.at===value))?time:0};
    const lastPass=Math.max(0,...events.filter(event=>event.correct).map(event=>Date.parse(event.at)),passTime(card.passedAt),card.selfPassed?passTime(card.selfPassedAt):0);
    const current=events.filter(event=>!event.correct&&Date.parse(event.at)>lastPass),actual=current.filter(event=>event.source!=='notebook');
    const recent=events.filter(event=>event.source!=='notebook').slice(-5),recentWrong=recent.filter(event=>!event.correct).length;
    const active=!card.deleted&&!card.archived&&!isCompleted(subject,id,state),lastAt=current.length?Date.parse(current.at(-1).at):0;
    const actualLast=actual.length?Date.parse(actual.at(-1).at):0,fresh=actualLast>=now-14*86400000;
    const band=!active?-1:actual.length>=2?(fresh?6:4):actual.length?(fresh?5:3):current.length?2:(card.trainingCenterRestored||options.recurrent)?1:0;
    const result={subject,id,active,band,wrongStreak:actual.length,noteWrong:current.length-actual.length,recentWrong,recentAttempts:recent.length,lastAt,rate:recent.length?(recentWrong+1)/(recent.length+2):0,recurrent:Boolean(options.recurrent)};
    result.reason=actual.length?`연속 오답 ${actual.length}회 · 최근 ${recent.length}회 중 ${recentWrong}회 오답`:current.length?'노트에서 다시 연습으로 표시':band===1?(options.recurrent?'기출 원문 재제출 · 재풀이 확인 필요':'다시 학습할 문제'):recent.length?'현재 남은 오답 없음':'아직 실제 채점 전';
    return result;
  }
  function comparePriority(a,b){return b.band-a.band||Math.min(b.wrongStreak,5)-Math.min(a.wrongStreak,5)||b.rate-a.rate||b.recentWrong-a.recentWrong||b.lastAt-a.lastAt}
  function rankTags(entries,states){
    const tags=new Map(),seen=new Set();
    for(const entry of entries){
      const key=entry.subject+':'+entry.id;if(seen.has(key))continue;seen.add(key);
      const need=priority(entry.subject,entry.id,states[entry.subject]||{},{recurrent:entry.recurrenceOf});if(!need.active||need.band<=0)continue;
      for(const tag of [...new Set(entry.tags?.length?entry.tags:[entry.type])].filter(Boolean)){if(!tags.has(tag))tags.set(tag,[]);tags.get(tag).push({...entry,priority:need})}
    }
    return [...tags].map(([tag,rows])=>{rows.sort((a,b)=>comparePriority(a.priority,b.priority)||String(a.id).localeCompare(String(b.id)));return {tag,rows,best:rows[0].priority}}).sort((a,b)=>comparePriority(a.best,b.best)||a.tag.localeCompare(b.tag,'ko')).slice(0,10);
  }
  function subjectOf(adapter){return adapter.subject||(adapter.theory?'theory':'practical')}
  function practiceRefs(problems,adapter){return problems.map((problem,index)=>({...problem,subject:subjectOf(adapter),id:adapter.theory?problem.id:index}))}
  function priorityUrl(file,refs,tag){const url=new URL(file,location.href);url.searchParams.set('view','all');url.searchParams.set('fresh','1');url.searchParams.set('sort','priority');url.searchParams.set('weakrefs',refs.map(ref=>ref.id).join(','));url.searchParams.set('weaknessSource','recent');if(tag)url.searchParams.set('tag',tag);return url.href}
  function sortQuestions(problems,adapter){
    const field=document.querySelector('#sortOrder'),box=document.querySelector('#questions');if(!field||!box)return;
    const subject=subjectOf(adapter),cards=[...box.querySelectorAll('.question')],order=new Map(cards.map((card,index)=>[card,index]));
    if([...field.options].some(option=>option.value===params.get('sort')))field.value=params.get('sort');
    function refresh(){
      const mode=field.value,list=cards.map(card=>{
        const id=adapter.theory?card.dataset.id:Number(card.dataset.index),problem=adapter.theory?problems.find(p=>p.id===id):problems[id],need=priority(subject,id,adapter.state,{recurrent:problem?.recurrenceOf});
        const history=(adapter.theory?adapter.state.history?.[id]:adapter.state.cards?.[id]?.history)||[],valid=history.filter(event=>event&&!event.cancelledAt&&typeof event.correct==='boolean'&&Number.isFinite(Date.parse(event.at)));
        return {card,id,need,index:order.get(card),added:card.dataset.addedDate||'',attempts:valid.length,wrong:valid.filter(event=>!event.correct).length,last:Math.max(0,...valid.map(event=>Date.parse(event.at)))};
      });
      list.sort((a,b)=>{
        if(mode==='priority'||mode==='repeatWrong')return comparePriority(a.need,b.need)||a.index-b.index;
        if(mode==='wrong')return b.wrong-a.wrong||a.index-b.index;
        if(mode==='unattempted')return Number(a.attempts>0)-Number(b.attempts>0)||a.index-b.index;
        if(mode==='recentAttempt')return b.last-a.last||a.index-b.index;
        if(mode==='recentRegistered')return b.added.localeCompare(a.added)||b.index-a.index;
        return a.index-b.index;
      });
      const groups=new Map();
      for(const item of list){
        const repeated=item.need.active&&(item.need.wrongStreak>=2||item.need.noteWrong>=2||item.need.recurrent);
        item.card.classList.toggle('repeat-filter-hidden',mode==='repeatWrong'&&!repeated);
        let note=item.card.querySelector('.priority-note');if(!note){note=document.createElement('p');note.className='priority-note';note.style.cssText='font-size:14px;color:#52677d;margin:6px 0 12px';item.card.querySelector('.qhead')?.after(note)}
        note.textContent=item.need.reason;note.hidden=item.need.band<=0;
        const wrapper=item.card.closest('details.star-item');
        if(wrapper){const group=wrapper.parentElement;group.append(wrapper);if(!groups.has(group))groups.set(group,item)}else box.append(item.card);
      }
      for(const group of groups.keys())group.parentElement.append(group);
      document.querySelector('.current-training-filter')?.refreshCurrentTraining?.();adapter.refresh();
    }
    field.addEventListener('change',refresh);
    document.addEventListener('click',event=>{if(event.target.closest('.check-one,.notebook-pass,.notebook-wrong,.notebook-restore,.notebook-toast button'))setTimeout(refresh,0)},true);
    refresh();
  }
  function matches(p){return (!params.get('exam')||String(p.examRound)===params.get('exam'))&&(!params.get('tag')||(p.tags||[]).includes(params.get('tag')))}
  function select(label,values,key){
    const el=document.createElement('label');const name=document.createElement('span');name.className='season-filter-name';name.textContent=label;el.append(name);const field=document.createElement('select');field.setAttribute('aria-label',label);
    field.add(new Option('전체',''));[...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true})).forEach(x=>field.add(new Option(key==='exam'?x+'회':x,x)));
    field.value=params.get(key)||'';
    field.onchange=()=>{const url=new URL(location.href);field.value?url.searchParams.set(key,field.value):url.searchParams.delete(key);location.href=url.href};el.append(field);return el;
  }
  function install(problems,adapter){
    const weakIds=new Set((params.get('weakrefs')||'').split(',').filter(Boolean));
    if(weakIds.size&&adapter){
      document.body.classList.add('weakness-practice');
      const weaknessSource=params.get('weaknessSource');
      const labels={recent:'훈련 중 오답 다시 풀기',submitted:'직접 제출 반복 약점 다시 풀기',all:'모든 기출문제 오답 복습'};
      const target=document.createElement('p');target.textContent=labels[weaknessSource]||labels.submitted;
      const back=document.createElement('a');back.href='오답_훈련센터.html?weakness=1&weaknessSource='+(weaknessSource||'submitted');back.textContent=' 약점 목록으로';target.append(back);document.querySelector('main')?.prepend(target);
    }
    if(params.get('timed')==='1'&&!adapter?.theory){
      document.body.classList.add('study-page');
      document.querySelectorAll('.question').forEach(card=>{const p=problems[Number(card.dataset.index)];if(!p)return;const origin=document.createElement('p');origin.className='season-origin';origin.textContent=`${p.examRound||''}회 · ${p.sourceQuestionNo||''} 원문에서 만든 응용문제`;card.querySelector('.qhead')?.after(origin)});
      return;
    }
    // A tag is a fresh practice entry point: clear only the current answer fields
    // once, while retaining pass state, attempts, wrong counts, and full history.
    if(params.get('fresh')==='1'&&(params.get('tag')||weakIds.size)&&adapter){
      const targets=problems.map((problem,index)=>({problem,index})).filter(x=>weakIds.size?weakIds.has(String(adapter.theory?x.problem.id:x.index)):matches(x.problem));
      if(adapter.theory){
        for(const {problem} of targets){
          if(adapter.state.answers)delete adapter.state.answers[problem.id];
          if(adapter.state.checked)delete adapter.state.checked[problem.id];
        }
      }else{
        for(const {index} of targets){
          const card=adapter.state.cards?.[index];if(!card)continue;
          ['voucher','rows','graded','correct','matched'].forEach(key=>delete card[key]);
        }
      }
      adapter.save();
      const clean=new URL(location.href);clean.searchParams.delete('fresh');
      location.replace(clean.href);return;
    }
    const host=document.querySelector('.toolbar,.dashboard')||document.querySelector('main');
    const bar=document.createElement('div');bar.className='season-filters';
    // Keep the study controls in the learner's reading order: sort, round, tag, then TOP 10.
    const sortLabel=host?.querySelector('.sort-label');if(sortLabel)bar.append(sortLabel);
    bar.append(select('기출 회차',problems.map(p=>p.examRound),'exam'),select('유형 태그',problems.flatMap(p=>p.tags||[p.type]),'tag'));
    if(adapter)bar.append(currentTrainingSelect(problems,adapter));
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
    if(adapter){notebook(problems,adapter,bar);sortQuestions(problems,adapter)}
    if(host)mobileFilters(host,bar);
    if(!problems.length){const box=document.createElement('section');box.className='season-welcome';box.innerHTML='<span class="season-kicker">NEW CHAPTER</span><h2>다음 기출 오답부터<br>차근차근 쌓아가세요.</h2><p>회차와 틀린 문제를 보내주시면 원문은 회차별 MD로 보관하고,<br>숫자와 조건을 바꾼 응용문제를 이곳에 등록합니다.</p><a href="오답_훈련센터.html">학습 홈으로</a>';host?.after(box)}
  }
  function currentTrainingSelect(problems,adapter){
    const label=document.createElement('label');label.className='current-training-filter';const name=document.createElement('span');name.className='season-filter-name';name.textContent='현재 훈련 필요 TOP 10';label.append(name);
    const field=document.createElement('select');field.className='current-training-select';field.setAttribute('aria-label','현재 훈련 필요 TOP 10');
    let ranked=[];
    label.refreshCurrentTraining=()=>{ranked=rankTags(practiceRefs(problems,adapter),{[subjectOf(adapter)]:adapter.state});field.replaceChildren(new Option(ranked.length?'취약 유형 선택 · 바로 풀기':'현재 확인된 취약 유형이 없습니다.',''));ranked.forEach(({tag,rows,best},index)=>field.add(new Option(`${index+1}. ${tag} · ${rows.length}문제 · ${best.reason}`,tag)));field.disabled=!ranked.length};
    field.onchange=()=>{const selected=ranked.find(group=>group.tag===field.value);if(selected)location.href=priorityUrl(location.pathname,selected.rows,selected.tag)};
    label.title='최근 14일의 반복 오답을 먼저 보고, 연속 오답·최근 5회 결과로 정렬합니다. 채점 전 문제 수는 취약점 순위에 반영하지 않습니다.';
    label.append(field);label.refreshCurrentTraining();return label;
  }
  function mobileFilters(host,bar){
    const media=matchMedia('(max-width:760px)'),anchor=document.createComment('filter toolbar');host.before(anchor);
    const compact=document.createElement('div');compact.className='mobile-filter-bar';
    const open=document.createElement('button');open.type='button';open.className='mobile-filter-open';open.textContent='☷ 설정';open.setAttribute('aria-haspopup','dialog');
    const hint=document.createElement('span');hint.textContent='정렬 · 검색';compact.append(open,hint);anchor.after(compact);
    const dialog=document.createElement('dialog');dialog.className='mobile-filter-dialog';dialog.setAttribute('aria-labelledby','mobileFilterTitle');
    dialog.innerHTML='<header><h2 id="mobileFilterTitle">정렬 · 검색 설정</h2><button type="button" class="mobile-filter-close" aria-label="설정 닫기">×</button></header><div class="mobile-filter-content"></div><footer><button type="button" class="mobile-filter-apply">문제 보기</button></footer>';
    document.body.append(dialog);
    const fields=[...bar.querySelectorAll('[aria-label="기출 회차"],[aria-label="유형 태그"]')],keys=['exam','tag'];let snapshot=[];
    bar.addEventListener('change',event=>{if(dialog.open&&fields.includes(event.target))event.stopImmediatePropagation()},true);
    function close(){dialog.close()}
    open.onclick=()=>{snapshot=fields.map(f=>f.value);dialog.showModal();document.body.classList.add('mobile-filter-active')};
    dialog.querySelector('.mobile-filter-close').onclick=close;
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close()}});
    dialog.addEventListener('close',()=>{fields.forEach((f,i)=>{if(snapshot[i]!==undefined)f.value=snapshot[i]});document.body.classList.remove('mobile-filter-active');if(media.matches)open.focus()});
    dialog.querySelector('.mobile-filter-apply').onclick=()=>{const url=new URL(location.href);fields.forEach((f,i)=>{f.value?url.searchParams.set(keys[i],f.value):url.searchParams.delete(keys[i])});if(url.href!==location.href)location.href=url.href;else close()};
    function layout(){if(media.matches){dialog.querySelector('.mobile-filter-content').append(host);compact.hidden=false}else{if(dialog.open)close();anchor.after(host);compact.hidden=true}}
    media.addEventListener('change',layout);layout();
  }
  function notebook(problems,a,bar){
    const cards=[...document.querySelectorAll('.question')],theory=a.theory;
    // Keep newly passed questions visible until this page is reloaded or revisited,
    // so learners can review the answer and explanation immediately after grading.
    const passedThisVisit=new Set();
    const key=c=>theory?c.dataset.id:c.dataset.index;
    const get=(id,k)=>theory?a.state[k]?.[id]:a.state.cards?.[id]?.[k];
    const put=(id,k,v)=>{const target=theory?(a.state[k]??={}):(a.state.cards[id]??={});target[theory?id:k]=v};
    function visibility(card){
      const id=key(card),p=theory?problems.find(p=>p.id===id):problems[Number(id)],passed=isCompleted(subjectOf(a),id,a.state),star=!!get(id,'starred');
      const search=document.querySelector('#typeFilter')?.value||params.get('type')||'';
      const match=matches(p)&&(!search||p.type.includes(search))&&(params.get('view')!=='today'||p.addedDate===new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10));
      const special=params.get('view')==='star',hasVariant=problems.some(x=>x.variantOf===(theory?id:Number(id)));
      const weakIds=new Set((params.get('weakrefs')||'').split(',').filter(Boolean));
      const showPassed=params.get('showPassed')!=='0';
      // 통과 기록을 보존하며 기본 목록에서도 복습할 수 있게 표시한다.
      card.hidden=!!get(id,'deleted')||!match||(weakIds.size?!weakIds.has(String(id)):(special&&!star&&p.variantOf==null&&!hasVariant))||(passed&&!showPassed&&(weakIds.size||!passedThisVisit.has(String(id))));
      card.dataset.typeFilterBaseHidden=String(card.hidden);
      if(special){
        const item=card.closest('details.star-item');if(item)item.hidden=card.hidden;
        const group=item?.closest('.star-group');if(group){const visible=[...group.querySelectorAll('details.star-item')].filter(x=>!x.hidden);group.hidden=visible.length===0;const count=group.querySelector('.star-group-title small');if(count)count.textContent=`${visible.length}문제`}
      }
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
        const keptBefore=passedThisVisit.has(String(id));
        const before={};['passed','passedAt','selfPassed','selfPassedAt','trainingCenterRestored','restoredAt','correct','checked','graded'].forEach(k=>before[k]=get(id,k));
        const history=get(id,'history')||[],at=new Date().toISOString(),event={id:crypto.randomUUID(),at,correct,source:'notebook'};
        history.push(event);put(id,'history',history);put(id,'attempts',history.filter(h=>!h.cancelledAt).length);if(!theory)put(id,'wrongCount',history.filter(h=>h.correct===false&&!h.cancelledAt).length);
        put(id,'passed',correct);put(id,theory?'checked':'correct',correct);put(id,'selfPassed',correct);put(id,'selfPassedAt',correct?at:null);
        put(id,'trainingCenterRestored',!correct);put(id,correct?'passedAt':'restoredAt',at);if(!theory)put(id,'graded',true);
        if(correct)passedThisVisit.add(String(id));else passedThisVisit.delete(String(id));
        card.dataset.passedThisVisit=String(correct);
        a.save();refresh(card);card.querySelector('.result').textContent=correct?'노트 학습 · 직접 통과':'노트 학습 · 다시 연습';
        report(correct?'통과로 기록했습니다.':'오답으로 기록했습니다.',()=>{
          event.cancelledAt=new Date().toISOString();event.correct=null;
          if(keptBefore)passedThisVisit.add(String(id));else passedThisVisit.delete(String(id));
          card.dataset.passedThisVisit=String(keptBefore);
          Object.entries(before).forEach(([k,v])=>put(id,k,v??null));
          if(!before.passed){put(id,'trainingCenterRestored',true);put(id,'restoredAt',event.cancelledAt)}
          put(id,'attempts',history.filter(h=>!h.cancelledAt).length);if(!theory)put(id,'wrongCount',history.filter(h=>h.correct===false&&!h.cancelledAt).length);
          a.save();refresh(card);card.querySelector('.result').textContent='직접 표시를 되돌렸습니다.';
        });
      }
      actions.prepend(button('✓ 알고 있어요 · 통과',()=>mark(true),'notebook-pass'),button('↻ 틀렸어요 · 다시 연습',()=>mark(false),'notebook-wrong'));
      const restore=button('다시 학습하기',()=>{const at=new Date().toISOString();passedThisVisit.delete(String(id));card.dataset.passedThisVisit='false';put(id,'passed',false);put(id,'archived',false);put(id,'selfPassed',false);put(id,'trainingCenterRestored',true);put(id,'restoredAt',at);a.save();refresh(card);report('학습할 문제로 옮겼습니다. 기존 기록은 보존됩니다.')},'notebook-restore');
      if(get(id,'passed'))actions.prepend(restore);
      card.querySelector('.check-one')?.addEventListener('click',()=>setTimeout(()=>{if(get(id,'passed'))passedThisVisit.add(String(id));else passedThisVisit.delete(String(id));card.dataset.passedThisVisit=String(passedThisVisit.has(String(id)));visibility(card);a.refresh()},0));
      visibility(card);
    });
    a.refresh();
  }
  function catalog(meta,sources){
    // Secondary settings stay available without lengthening the daily study screen.
    for(const [id,label] of [['backupSection','동기화 설정 · 학습기록 백업']]){
      const section=document.getElementById(id);if(!section)continue;
      const details=document.createElement('details');details.className='season-settings';details.open=true;
      const summary=document.createElement('summary');summary.textContent=label;details.append(summary);
      section.querySelector('.section-heading')?.remove();while(section.firstChild)details.append(section.firstChild);section.append(details);
    }
    const host=document.querySelector('#seasonCatalog');if(!host)return;
    const entries=window.TrainingSeasonCatalog||[];
    if(!host.dataset.tagsOnly){
      const descriptions={theory:'헷갈리는 개념을 정확하게',practical:'계정과 차·대변을 차근차근',voucher:'KcLep과 익숙한 입력 흐름'};
      const wrap=document.createElement('div');wrap.className='season-subjects';
      ['theory','practical','voucher'].forEach(key=>{const a=document.createElement('a');a.className='season-subject '+key;a.href=sources[key].file;a.innerHTML=`<span>${escape(sources[key].label)}</span><strong>${entries.filter(e=>e.subject===key).length}<small> 문제</small></strong><p>${descriptions[key]}</p><b>훈련 시작 ↗</b>`;wrap.append(a)});host.append(wrap);
    }
    if(!entries.length){const p=document.createElement('p');p.className='season-empty';p.textContent='새 학습이 준비되었습니다. 아직 등록된 기출 오답은 없습니다.';host.append(p);return}
    const groups=document.createElement('div');groups.className='season-catalog';
    const title=document.createElement('h3');title.textContent='tag';groups.append(title);
    const subjectOrder=['theory','practical','voucher'],tags=new Map(),subjectTags=new Map(subjectOrder.map(subject=>[subject,new Map()])),seen=new Set();
    const learningState={theory:readState('exam-20260914-theory'),practical:readState('exam-20260914-practical'),voucher:readState('exam-20260914-voucher')};
    function readState(key){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}}}
    const isPassed=entry=>isCompleted(entry.subject,entry.id,learningState[entry.subject]);
    entries.filter(e=>!e.variant&&e.variantOf==null&&e.questionNo!=='').forEach(e=>{
      const id=e.subject+':'+e.id;if(seen.has(id))return;seen.add(id);
      [...new Set(e.tags?.length?e.tags:[e.type])].filter(Boolean).forEach(tag=>{
        if(!tags.has(tag))tags.set(tag,[]);tags.get(tag).push(e);
        const scoped=subjectTags.get(e.subject);if(scoped){if(!scoped.has(tag))scoped.set(tag,[]);scoped.get(tag).push(e)}
      });
    });
    const colors=['#155E9C','#286FA4','#3B7FAC','#4E8FB4','#619FBC','#74AEC5','#86BACD','#97C5D4','#A5CDDA','#B3D5E0'];
    const activeColors=['#A9470B','#B9570F','#C96816','#D87920','#E58A32','#EC9B47','#F1AB5B','#F4BA70','#F6C784','#F8D398'];
    subjectOrder.forEach(subject=>{
      const section=document.createElement('details');section.className='season-tag-group';section.open=true;
      const heading=document.createElement('summary');heading.className='season-tag-heading';heading.innerHTML=`${escape(sources[subject].label)} · 기출 오답 누적 <small>TOP 10</small>`;section.append(heading);
      const list=document.createElement('div');list.className='season-tag-list';
      [...subjectTags.get(subject)].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0],'ko')).forEach(([tag,rows],index)=>{
        const a=document.createElement('a');a.className='season-tag';a.textContent=tag+' · '+rows.length;a.title=`${sources[subject].label} ${rows.length}문제 · 모든 회차 · 통과 문제 포함`;
        a.href=sources[subject].file+'?tag='+encodeURIComponent(tag)+'&fresh=1';
        if(index<10){a.style.backgroundColor=colors[index];a.style.color=index<5?'#fff':'#173042';a.dataset.rank=String(index+1)}
        list.append(a);
      });section.append(list);
      const currentHeading=document.createElement('h5');currentHeading.className='season-tag-heading season-current-heading';currentHeading.innerHTML='현재 훈련 필요 <small>TOP 10</small>';section.append(currentHeading);
      const currentList=document.createElement('div');currentList.className='season-tag-list season-current-list';
      const activeTags=rankTags(entries.filter(entry=>entry.subject===subject),learningState);
      activeTags.forEach(({tag,rows,best},index)=>{const a=document.createElement('a');a.className='season-tag season-current-tag';a.textContent=tag+' · '+rows.length+'문제 · '+best.reason;a.title=`${sources[subject].label} · ${best.reason}`;a.href=priorityUrl(sources[subject].file,rows,tag);a.style.backgroundColor=activeColors[index];a.style.color=index<6?'#fff':'#5B2A0A';a.dataset.rank=String(index+1);currentList.append(a)});
      if(!activeTags.length){const done=document.createElement('span');done.className='season-current-empty';done.textContent='현재 확인된 취약 유형이 없습니다. 채점 전 문제는 정렬에서 찾아볼 수 있습니다.';currentList.append(done)}
      section.append(currentList);groups.append(section);
    });host.append(groups);
    if(host.dataset.tagsOnly){
      groups.querySelectorAll('.season-tag-list:not(.season-current-list)').forEach((list,index)=>{
        list.classList.add('season-tag-list-collapsible','is-collapsed');list.id=`seasonTagList${index+1}`;
        const more=document.createElement('button');more.type='button';more.className='season-tag-more';more.textContent='더 보기';more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls',list.id);
        more.onclick=()=>{const collapsed=list.classList.toggle('is-collapsed');more.textContent=collapsed?'더 보기':'접기';more.setAttribute('aria-expanded',String(!collapsed))};list.after(more);
        requestAnimationFrame(()=>{if(list.scrollHeight<=list.clientHeight+2){list.classList.remove('is-collapsed','season-tag-list-collapsible');more.remove()}});
      });
    }
    // A shared tag spanning subjects opens each existing trainer, without loading all question data on home.
    window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()},{once:true});
    window.addEventListener('storage',event=>{if(/^exam-20260914-(theory|practical|voucher)$/.test(event.key||''))location.reload()},{once:true});
    const selected=params.get('tag'),selectedRows=tags.get(selected);
    if(selectedRows){
      const panel=document.createElement('section');panel.className='section';const heading=document.createElement('h2');heading.textContent=selected+' · '+selectedRows.length+'문제';panel.append(heading);
      [...new Set(selectedRows.map(e=>e.subject))].forEach(subject=>{const frame=document.createElement('iframe');frame.title=sources[subject].label+' · '+selected;frame.src=sources[subject].file+'?tag='+encodeURIComponent(selected)+'&fresh=1';frame.style.cssText='width:100%;height:80vh;border:1px solid #d5d9df;margin-top:12px';panel.append(frame)});
      document.querySelector('main')?.prepend(panel);
    }
  }
  window.TrainingSeason={matches,install,catalog,isCompleted,priority,comparePriority,rankTags,priorityUrl};
})();
