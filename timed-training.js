(function(global){
  'use strict';
  const files={practical:'일반전표_기본연습_24문제.html',voucher:'매입매출전표_오답연습_3문제.html'};
  const settingsKey='exam-20260914-timer-settings';
  const defaults={targetSeconds:60,start:'Ctrl+Alt+Space',stop:'Ctrl+Space'};
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(String(v||'').replace(/[^0-9-]/g,''))||0;
  const money=n=>Number(n).toLocaleString('ko-KR');
  const clock=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
  const chord=e=>[e.ctrlKey?'Ctrl':'',e.altKey?'Alt':'',e.shiftKey?'Shift':'',e.metaKey?'Meta':'',e.code==='Space'?'Space':e.code].filter(Boolean).join('+');
  function style(){if(document.getElementById('timedStyle'))return;const link=document.createElement('link');link.id='timedStyle';link.rel='stylesheet';link.href='timed-training.css?v=19';document.head.append(link)}
  function install(problems,a){
    if(new URLSearchParams(location.search).get('timed')!=='1')return;
    style();document.body.classList.add('timed-mode');document.title='시간 훈련 · '+(a.subject==='practical'?'일반전표':'매입매출전표');
    const savePanel=document.querySelector('.save-panel');if(savePanel){const details=document.createElement('details');details.className='timed-records';details.innerHTML='<summary>오늘 학습기록 저장</summary>';savePanel.before(details);details.append(savePanel)}
    let settings={...defaults,...read(settingsKey)},current=null,paper=false,visible=[];
    const cards=[...document.querySelectorAll('.question')];
    const state=card=>a.state.cards[card.dataset.index]||(a.state.cards[card.dataset.index]={history:[]});
    const pendingOf=card=>card?state(card).timedPending:null,pending=()=>pendingOf(current);
    function markNotebook(card,correct){
      const s=state(card),at=new Date().toISOString(),event={id:crypto.randomUUID(),at,correct,source:'notebook'};
      s.history=s.history||[];s.history.push(event);s.attempts=s.history.filter(h=>!h.cancelledAt).length;s.wrongCount=s.history.filter(h=>h.correct===false&&!h.cancelledAt).length;
      s.passed=correct;s.correct=correct;s.graded=true;s.selfPassed=correct;s.selfPassedAt=correct?at:null;s.trainingCenterRestored=!correct;
      if(correct){s.passedAt=at;delete s.restoredAt}else{s.restoredAt=at;delete s.passedAt}
      card.dataset.graded='true';card.dataset.correct=String(correct);card.classList.toggle('correct',correct);card.classList.toggle('wrong',!correct);
      const result=card.querySelector('.result');if(result){result.className='result '+(correct?'ok':'no');result.textContent=correct?'노트 학습 · 직접 통과':'노트 학습 · 다시 연습'}
      const attempt=card.querySelector('.attempt,.attempt-info');if(attempt)attempt.textContent=`학습 ${s.attempts}회 · 틀림 ${s.wrongCount}회`;
      a.save();a.refresh?.();populateTop();draw();
    }
    function addNotebookButtons(card){const actions=card.querySelector('.qactions,.actions');if(!actions||actions.querySelector('.notebook-pass'))return;const make=(text,correct,cls)=>{const button=document.createElement('button');button.type='button';button.className='btn secondary '+cls;button.textContent=text;button.addEventListener('click',()=>markNotebook(card,correct));return button};actions.prepend(make('✓ 알고 있어요 · 통과',true,'notebook-pass'),make('↻ 틀렸어요 · 다시 연습',false,'notebook-wrong'))}
    function placeVoucherAnswerBelow(card){const brief=card.querySelector('.question-brief'),answer=brief?.querySelector('.answer-reveal'),workspace=card.querySelector('.answer-workspace');if(!answer||!workspace)return;workspace.append(answer);if(!brief.children.length)brief.remove()}
    const bar=document.createElement('section');bar.className='timed-bar';
    bar.innerHTML=`<a href="${files.practical}?timed=1" class="timed-tab ${a.subject==='practical'?'selected':''}">일반전표</a><a href="${files.voucher}?timed=1" class="timed-tab ${a.subject==='voucher'?'selected':''}">매입매출전표</a><label>회차 <select class="time-exam"><option value="">전체</option></select></label><label>유형 <select class="time-type"><option value="">전체</option></select></label><label class="time-top-label">현재 훈련 필요 TOP 10 <select class="time-top"><option value="">계산 중</option></select></label><label>학습 상태 <select class="time-status"><option value="active">미통과 문제</option><option value="all">전체 기록 · 다시 훈련</option></select></label><label>문제 <select class="time-question"></select></label><b class="time-count"></b>`;
    document.querySelector('#questions').before(bar);
    const exam=bar.querySelector('.time-exam'),type=bar.querySelector('.time-type'),top=bar.querySelector('.time-top'),status=bar.querySelector('.time-status'),select=bar.querySelector('.time-question');
    [...new Set(problems.map(p=>p.examRound))].sort((x,y)=>x-y).forEach(x=>exam.add(new Option(x+'회',x)));
    [...new Set(problems.map(p=>p.type))].sort((x,y)=>x.localeCompare(y,'ko')).forEach(x=>type.add(new Option(x,x)));
    const params=new URLSearchParams(location.search);{const asked=params.get('exam'),rounds=problems.map(p=>Number(p.examRound)||0);exam.value=asked===null?String(Math.max(0,...rounds)||''):asked==='all'?'':asked}type.value=params.get('type')||'';if(params.get('status')==='all')status.value='all';
    const panel=document.createElement('aside');panel.className='timer-panel';panel.setAttribute('aria-label','시간 훈련 타이머');
    panel.innerHTML='<button class="timer-dial" type="button" aria-label="타이머 시작"><span><strong>1:00</strong></span></button><div class="timer-buttons"><div class="timer-pair"><button type="button" class="timer-pause" aria-label="일시정지" title="일시정지"><span aria-hidden="true">❚❚</span></button><button type="button" class="timer-resume" aria-label="계속" title="계속"><span aria-hidden="true">▶</span></button></div><button type="button" class="timer-retry">초기화</button><button type="button" class="timer-config">설정</button></div><div class="timer-jump"><button type="button" class="jump-top" aria-label="맨 위로" title="맨 위로"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V5M5 11l7-7 7 7"/></svg></button><button type="button" class="jump-bottom" aria-label="맨 아래로" title="맨 아래로"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v15M5 13l7 7 7-7"/></svg></button></div>';
    document.body.append(panel);
    const dialog=document.createElement('dialog');dialog.className='timer-settings';dialog.setAttribute('aria-labelledby','timerTitle');
    dialog.innerHTML='<div class="timer-head"><h2 id="timerTitle">시간 · 단축키 설정</h2><button class="timer-close" type="button" aria-label="닫기">X</button></div><div class="timer-wheels"><label>분<input class="timer-minutes" type="text" inputmode="numeric" maxlength="2" autocomplete="off" aria-label="목표 분" value="01"></label><label>초<input class="timer-seconds" type="text" inputmode="numeric" maxlength="2" autocomplete="off" aria-label="목표 초" value="00"></label><button class="timer-save" type="button">완료</button></div><label class="timer-shortcut">시작<input readonly class="shortcut-start" aria-label="시작 단축키" placeholder="원하는 키 조합을 누르세요"></label><label class="timer-shortcut">정지<input readonly class="shortcut-stop" aria-label="정지 단축키" placeholder="원하는 키 조합을 누르세요"></label><p class="timer-error" role="alert"></p>';
    document.body.append(dialog);
    const minutes=dialog.querySelector('.timer-minutes'),seconds=dialog.querySelector('.timer-seconds');
    for(const box of [minutes,seconds]){box.addEventListener('focus',()=>box.select());box.addEventListener('input',()=>{box.value=box.value.replace(/[^0-9]/g,'').slice(0,2)});box.addEventListener('blur',()=>{box.value=String(Math.min(59,Number(box.value)||0)).padStart(2,'0')})}
    function message(){}
    const live=p=>Math.max(0,(p.pausedAt||Date.now())-p.startedMs-(p.pausedTotalMs||0));
    function place(){if(matchMedia('(max-width:760px)').matches){panel.style.left='';panel.style.right='';return}const wrap=document.querySelector('main.wrap');if(!wrap)return;const r=wrap.getBoundingClientRect(),pad=parseFloat(getComputedStyle(wrap).paddingRight)||0,w=panel.offsetWidth;panel.style.left=Math.max(0,Math.min(r.right-pad+12,innerWidth-w-8))+'px';panel.style.right='auto'}
    function draw(){const p=pending(),elapsed=p?(p.elapsedMs??live(p)):0,target=(p?.targetSeconds||settings.targetSeconds)*1000,remaining=target-elapsed;
      panel.querySelector('.timer-dial strong').textContent=(remaining<0?'+':'')+clock(Math.abs(remaining));
      
      panel.style.setProperty('--timer-fill',Math.max(0,Math.min(100,remaining/target*100))+'%');panel.classList.toggle('overtime',remaining<0);
      const on=p?.phase==='running';panel.querySelector('.timer-pause').disabled=!on||!!p.pausedAt;panel.querySelector('.timer-resume').disabled=!on||!p.pausedAt;panel.querySelector('.timer-config').disabled=on;place();
    }
    function lockCard(card,value){if(card)card.querySelectorAll('.entry-wrap,.kclep-shell').forEach(x=>x.inert=value)}
    function lock(value){lockCard(current,value)}
    function start(){if(paper&&pending()?.phase!=='running'){const f=document.activeElement?.closest?.('.question');const vis=visible.filter(c=>!c.hidden);const inView=f&&vis.includes(f)?f:vis.find(c=>{const r=c.getBoundingClientRect();return r.bottom>innerHeight*0.3})||current;if(inView&&inView!==current)show(inView)}if(!current)return;const p=pending();if(p?.phase==='running'){if(p.pausedAt)resume();return}if(p)return;
      current.querySelectorAll('details').forEach(x=>x.open=false);lock(false);
      state(current).timedPending={id:crypto.randomUUID(),phase:'running',startedMs:Date.now(),pausedTotalMs:0,targetSeconds:settings.targetSeconds,assisted:false};a.save();message('측정 중 · 입력을 마치면 정지');draw();
    }
    function stopCard(card){const p=pendingOf(card);if(p?.phase!=='running')return false;p.elapsedMs=live(p);delete p.pausedAt;p.stoppedAt=new Date().toISOString();p.phase='stopped';a.save();return true}
    function stop(){if(!stopCard(current))return;draw()}
    function pause(){const p=pending();if(p?.phase!=='running'||p.pausedAt)return;p.pausedAt=Date.now();a.save();draw()}
    function resume(){const p=pending();if(p?.phase!=='running'||!p.pausedAt)return;p.pausedTotalMs=(p.pausedTotalMs||0)+Date.now()-p.pausedAt;delete p.pausedAt;a.save();draw()}
    function resetCard(card){delete state(card).timedPending;lockCard(card,false);a.clear(card);card.querySelectorAll('details').forEach(x=>x.open=false);const b=card.querySelector('.check-one');b.disabled=false;b.textContent='채점하기';lockCard(card,false);card.dispatchEvent(new Event('input',{bubbles:true}))}
    function redo(){if(paper){visible.forEach(resetCard);a.save();show(visible[0]);window.scrollTo({top:0,behavior:'smooth'})}else if(current){resetCard(current);a.save()}draw()}
    function reset(){if(!current||!pending())return;delete state(current).timedPending;a.save();draw()}
    function passed(s){return !s.trainingCenterRestored&&(s.passed||s.correct===true||(s.history||[]).some(h=>h.correct===true&&!h.cancelledAt))}
    function populateTop(prefer=top.value||params.get('top')||''){
      const tags=new Map();problems.forEach((problem,index)=>{const card=cards[index],s=card?state(card):{};if(problem.variantOf!=null||problem.sourceQuestionNo===''||passed(s))return;[...new Set(problem.tags?.length?problem.tags:[problem.type])].filter(Boolean).forEach(tag=>{if(!tags.has(tag))tags.set(tag,[]);tags.get(tag).push(problem)})});
      const ranked=[...tags].sort((x,y)=>y[1].length-x[1].length||x[0].localeCompare(y[0],'ko')).slice(0,10);top.replaceChildren(new Option(ranked.length?'학습 유형 선택':'현재 훈련할 미통과 문제가 없습니다.',''));ranked.forEach(([tag,items],index)=>top.add(new Option(`${index+1}. ${tag} · ${items.length}문제`,tag)));top.disabled=!ranked.length;top.value=[...top.options].some(option=>option.value===prefer)?prefer:'';
    }
    populateTop(params.get('top')||'');
    function eligible(card){const p=problems[card.dataset.index],s=state(card),tags=p.tags?.length?p.tags:[p.type];return !s.deleted&&(!exam.value||String(p.examRound)===exam.value)&&(!type.value||p.type===type.value)&&(!top.value||tags.includes(top.value))&&(!!exam.value||status.value==='all'||!passed(s)||['running','stopped'].includes(s.timedPending?.phase))}
    function prepareCard(card){const p=pendingOf(card);if(!p){a.clear(card);card.querySelectorAll('details').forEach(x=>x.open=false)}card.querySelector('.check-one').disabled=p?.phase==='graded';lockCard(card,p?.phase==='graded');card.dispatchEvent(new Event('input',{bubbles:true}))}
    function show(card){if(current&&current!==card&&pending()?.phase==='running')return;
      current=card||null;cards.forEach(c=>{c.hidden=paper?!visible.includes(c):c!==current;c.classList.toggle('timed-active',paper&&c===current)});if(!current){draw();return}
      select.value=current.dataset.index;markList();sessionStorage.setItem('exam-20260914-timed-last-'+a.subject,current.dataset.index);
      const address=new URL(location.href);for(const [key,value] of [['exam',exam.value||'all'],['type',type.value],['top',top.value],['status',status.value],['problem',current.dataset.index]]){value?address.searchParams.set(key,value):address.searchParams.delete(key)}history.replaceState(null,'',address.href);
      if(!paper)prepareCard(current);draw();
    }
    const listBox=document.createElement('section');listBox.className='timed-list';document.querySelector('#questions').after(listBox);
    function markList(){listBox.querySelectorAll('button').forEach(b=>b.classList.toggle('current',!!current&&b.dataset.index===current.dataset.index))}
    function renderList(){listBox.innerHTML='';const redoBtn=document.createElement('button');redoBtn.type='button';redoBtn.className='timed-redo';redoBtn.textContent=paper?'처음부터 다시 풀기':'이 문제 다시 풀기';redoBtn.onclick=redo;if(paper){const b=document.createElement('button');b.type='button';b.className='timed-grade-all';b.textContent='전체 채점하기';b.onclick=()=>{visible.forEach(c=>{const p=pendingOf(c);if(p?.phase!=='graded'&&(p||c.querySelector('.entry-row .amount')?.value||c.querySelector('.timed-original-account')?.value))gradeCard(c,true)});draw()};listBox.append(b,redoBtn);return}
      const groups=new Map();visible.forEach(c=>{const r=problems[c.dataset.index].examRound||0;(groups.get(r)||groups.set(r,[]).get(r)).push(c)});
      [...groups.keys()].sort((x,y)=>x-y).forEach(r=>{const box=document.createElement('div');box.className='timed-list-group';const head=document.createElement('h4');head.textContent=`${r?r+'회':'기타'} · ${groups.get(r).length}문제`;box.append(head);
        groups.get(r).forEach(c=>{const p=problems[c.dataset.index],b=document.createElement('button');b.type='button';b.dataset.index=c.dataset.index;b.textContent=`${Number(c.dataset.index)+1}. ${p.title}`;
          b.onclick=()=>{if(pending()?.phase==='running')return;show(c)};box.append(b)});listBox.append(box)});listBox.append(redoBtn);markList()}
    function list(prefer){select.replaceChildren();paper=!!exam.value;document.body.classList.toggle('timed-paper',paper);visible=cards.filter(eligible);visible.forEach(c=>{const p=problems[c.dataset.index];select.add(new Option(`${Number(c.dataset.index)+1}. ${p.title}`,c.dataset.index))});renderList();bar.querySelector('.time-count').textContent='현재 '+visible.length+'문제';if(paper)visible.forEach(prepareCard);
      show(visible.find(c=>c.dataset.index===String(prefer))||(paper?visible.find(c=>!pendingOf(c)):null)||visible[0])}
    function gradeCard(card,quiet){let p=pendingOf(card);if(p?.phase==='graded')return;if(!p){a.grade(card);const h=state(card).history.at(-1);if(h){h.source='timed';h.problemType=problems[card.dataset.index].type;h.problemId=problems[card.dataset.index].id}state(card).timedPending={id:crypto.randomUUID(),phase:'graded',elapsedMs:0,targetSeconds:settings.targetSeconds};a.save();populateTop();card.querySelector('.check-one').disabled=true;lockCard(card,true);draw();return}
      if(p.phase==='running'){stopCard(card);}
      p=pendingOf(card);if(p.phase!=='stopped'){draw();return}
      a.grade(card);const h=state(card).history.at(-1);h.id=p.id;h.source='timed';h.timing={elapsedMs:p.elapsedMs,targetSeconds:p.targetSeconds,startedAt:new Date(p.startedMs).toISOString(),stoppedAt:p.stoppedAt,assisted:p.assisted};h.problemType=problems[card.dataset.index].type;h.problemId=problems[card.dataset.index].id;p.phase='graded';a.save();populateTop();card.hidden=false;card.querySelector('.check-one').disabled=true;lockCard(card,true);
      draw();
    }
    cards.forEach(card=>{
      if(a.subject==='practical')practicalShell(card);
      else placeVoucherAnswerBelow(card);
      addNotebookButtons(card);
      card.addEventListener('pointerdown',()=>{if(paper&&current!==card&&pending()?.phase!=='running'&&!pendingOf(card))show(card)},true);
      card.querySelectorAll('details').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open&&current===card&&pending()?.phase==='running'){pending().assisted=true;a.save();message('해설 확인 · 참고 풀이로 기록합니다.')}}));
      card.querySelector('.check-one').addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();if(!paper&&card!==current)return;gradeCard(card)},true);
    });
    for(const field of [exam,type,status])field.addEventListener('change',()=>{if(pending()?.phase==='running')stop();list()});
    top.addEventListener('change',()=>{if(pending()?.phase==='running')stop();exam.value='';type.value='';status.value='active';list()});
    select.onchange=()=>show(cards.find(c=>c.dataset.index===select.value));
    panel.querySelector('.timer-dial').onclick=()=>pending()?.phase==='running'?stop():start();panel.querySelector('.timer-pause').onclick=pause;panel.querySelector('.timer-resume').onclick=resume;panel.querySelector('.timer-retry').onclick=reset;panel.querySelector('.jump-top').onclick=()=>window.scrollTo({top:0,behavior:'instant'});panel.querySelector('.jump-bottom').onclick=()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});window.addEventListener('resize',place);
    const loadSettings=s=>{minutes.value=String(Math.floor(s.targetSeconds/60)).padStart(2,'0');seconds.value=String(s.targetSeconds%60).padStart(2,'0');dialog.querySelector('.shortcut-start').value=s.start;dialog.querySelector('.shortcut-stop').value=s.stop};
    panel.querySelector('.timer-config').onclick=()=>{loadSettings(settings);dialog.querySelector('.timer-error').textContent='';dialog.showModal()};
    dialog.querySelector('.timer-close').onclick=()=>dialog.close();
    dialog.querySelectorAll('.shortcut-start,.shortcut-stop').forEach(input=>input.addEventListener('keydown',e=>{if(e.key==='Tab'||e.key==='Escape')return;e.preventDefault();if(e.code&&!['ControlLeft','ControlRight','AltLeft','AltRight','ShiftLeft','ShiftRight','MetaLeft','MetaRight'].includes(e.code)&&(e.ctrlKey||e.altKey))input.value=chord(e)}));
    dialog.querySelector('.timer-save').onclick=()=>{const next={targetSeconds:(Number(minutes.value)||0)*60+Math.min(59,Number(seconds.value)||0),start:dialog.querySelector('.shortcut-start').value,stop:dialog.querySelector('.shortcut-stop').value};if(!next.targetSeconds||next.start===next.stop){dialog.querySelector('.timer-error').textContent='목표는 1초 이상, 시작과 정지는 서로 다른 키로 지정해주세요.';return}settings=next;localStorage.setItem(settingsKey,JSON.stringify(settings));dialog.close();draw();start()};
    document.addEventListener('keydown',e=>{if(dialog.open||e.repeat)return;const key=chord(e);if(e.ctrlKey&&e.altKey&&!e.shiftKey&&e.code==='KeyR'){e.preventDefault();e.stopImmediatePropagation();reset();return}if(key===settings.start||key===settings.stop){e.preventDefault();e.stopImmediatePropagation();key===settings.start||pending()?.phase!=='running'?start():stop()}},true);
    document.addEventListener('click',e=>{if(pending()?.phase==='running'&&e.target.closest('a')){e.preventDefault();message('먼저 타이머를 정지한 뒤 이동해주세요.')}},true);
    window.addEventListener('beforeunload',e=>{if(pending()?.phase==='running'){e.preventDefault();e.returnValue=''}});
    document.addEventListener('visibilitychange',draw);
    const running=cards.find(c=>state(c).timedPending?.phase==='running'&&!state(c).deleted);
    list(params.get('problem')||running?.dataset.index||sessionStorage.getItem('exam-20260914-timed-last-'+a.subject));
    setInterval(draw,200);
    global.TrainingTimed.active={start,stop,pause,resume,reset,get current(){return current},get pending(){return pending()}};
  }
  function practicalShell(card){
    const wrap=card.querySelector('.entry-wrap'),table=wrap.querySelector('table');
    const shell=document.createElement('section');shell.className='timed-kclep';wrap.before(shell);
    shell.innerHTML='<div class="timed-kclep-tools">계정과목 검색 · Enter 다음 칸 · 금액 +키 000</div><div class="timed-kclep-status"><span>대차차액: <strong class="timed-difference">0</strong></span><small>양수는 대변 부족 · 음수는 차변 부족</small></div>';
    shell.append(wrap);const balance=card.querySelector('.balance-panel');shell.append(balance);
    table.querySelector('thead').innerHTML='<tr><th>구분</th><th>계정과목</th><th>거래처</th><th>적요코드</th><th>차변</th><th>대변</th><th>결과</th></tr>';
    const preview=document.createElement('div');preview.className='timed-preview';shell.append(preview);
    const rows=[...table.querySelectorAll('.entry-row')];
    rows.forEach(row=>{
      const cells=[...row.children],side=row.querySelector('.side'),original=row.querySelector('.amount'),division=row.querySelector('.division'),account=row.querySelector('.account');
      cells[2].classList.add('time-hidden-cell');cells[3].classList.add('time-hidden-cell');
      const sideText=document.createElement('input');sideText.className='timed-side-text';sideText.setAttribute('aria-label','구분 (3 차변, 4 대변)');side.classList.add('timed-side-hidden');side.tabIndex=-1;side.after(sideText);side.addEventListener('focus',()=>sideText.focus({preventScroll:true}));
      // 기존 거래처 select를 유지해야 원래 저장·채점 listener와 검색 선택지가 함께 보존된다.
      const partner=row.querySelector('.partner');partner.classList.add('timed-partner-select');partner.lang='ko';
      // Keep the existing grading fields and listeners, and adapt only the visible input layout.
      const debit=document.createElement('td'),credit=document.createElement('td');debit.innerHTML='<input class="timed-money timed-debit" inputmode="numeric" aria-label="차변 금액">';credit.innerHTML='<input class="timed-money timed-credit" inputmode="numeric" aria-label="대변 금액">';
      row.replaceChildren(cells[0],cells[1],cells[4],cells[5],debit,credit,cells[6],cells[2],cells[3]);
      const d=debit.firstChild,c=credit.firstChild;
      const opts=[...account.options].map(o=>({value:o.value,label:o.textContent}));
      const expense=/^(보험료|임차료|퇴직급여|수수료비용|복리후생비|운반비|급여|여비교통비|기업업무추진비|소모품비|감가상각비|전력비|수도광열비|경상연구개발비|지급수수료|교육훈련비|세금과공과|차량유지비|수선비|통신비|도서인쇄비|광고선전비|잡급|사무용품비|수수료비용|외주가공비|가스수도료|잡비|포장비|견본비|협회비)$/;
      const ui=account.cloneNode(false);ui.className='timed-account account';account.className='account timed-original-account';account.hidden=true;account.tabIndex=-1;account.after(ui);
      const splitNames=new Set(problems.flatMap(q=>[...(q.answers||[]),...(q.alternateAnswers||[]).flat()]).filter(x=>x.division).flatMap(x=>String(x.account).split('/')));opts.forEach(o=>(expense.test(o.label)||splitNames.has(o.label)?['판','제']:['']).forEach(part=>ui.add(new Option(o.label+(part?`(${part})`:''),JSON.stringify([o.value,part])))));ui.value=JSON.stringify(['','']);
      function nextAfterAccount(){const partnerField=row.querySelector('.partner:not(:disabled)');if(partnerField&&global.TrainingSearchPicker)global.TrainingSearchPicker.open(partnerField);else (partnerField||row.querySelector('.memo')).focus()}
      ui.addEventListener('change',()=>{const [value,part]=JSON.parse(ui.value);account.value=value;division.value=part;account.dispatchEvent(new Event('change',{bubbles:true}))});
      ui.addEventListener('account-selected',nextAfterAccount);
      partner.addEventListener('partner-selected',()=>row.querySelector('.memo').focus());
      function reflect(){sideText.value=side.value==='C'?'대변':'차변';d.disabled=side.value!=='D';c.disabled=side.value!=='C';d.value=side.value==='D'?original.value:'';c.value=side.value==='C'?original.value:'';ui.value=JSON.stringify([account.value,division.value])}
      side.addEventListener('change',reflect);original.addEventListener('input',reflect);
      sideText.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ui.focus();return}const k={Digit3:'3',Numpad3:'3',Digit4:'4',Numpad4:'4'}[e.code]||e.key;if((k==='3'||k==='4')&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();side.value=k==='3'?'D':'C';side.dispatchEvent(new Event('change',{bubbles:true}));ui.focus()}});
      sideText.addEventListener('change',()=>{const v=sideText.value;if(/대|4|C/i.test(v))side.value='C';else if(/차|3|D/i.test(v))side.value='D';side.dispatchEvent(new Event('change',{bubbles:true}));reflect()});sideText.addEventListener('focus',()=>sideText.select());
      [d,c].forEach(input=>{
        input.addEventListener('input',()=>{input.value=money(num(input.value)).replace(/^0$/,'');original.value=input.value;original.dispatchEvent(new Event('input',{bubbles:true}));render()});
        input.addEventListener('keydown',e=>{if(e.key==='+'){e.preventDefault();input.value=String(num(input.value))+'000';input.dispatchEvent(new Event('input',{bubbles:true}))}});
      });
      reflect();
      row.addEventListener('keydown',e=>{
        if(e.key!=='Enter'||e.ctrlKey||e.altKey||e.isComposing||e.target===ui)return;e.preventDefault();
        if(e.target===d||e.target===c){if(!num(original.value)&&account.value){const diff=rows.filter(r=>r!==row).reduce((n,r)=>n+(r.querySelector('.side').value==='D'?1:-1)*num(r.querySelector('.amount').value),0);if(diff){side.value=diff>0?'C':'D';side.dispatchEvent(new Event('change',{bubbles:true}));original.value=money(Math.abs(diff));original.dispatchEvent(new Event('input',{bubbles:true}));render()}}rows[rows.indexOf(row)+1]?.querySelector('.side').focus();}
        else {const fields=[...row.querySelectorAll('select,input')].filter(x=>!x.disabled&&!x.hidden&&!x.closest('.time-hidden-cell'));fields[fields.indexOf(e.target)+1]?.focus()}
      });
      row._timedReflect=reflect;
    });
    function render(){let debit=0,credit=0;const body=[];rows.forEach(row=>{row._timedReflect();const amount=num(row.querySelector('.amount').value),side=row.querySelector('.side').value,account=row.querySelector('.timed-account');if(side==='D')debit+=amount;else credit+=amount;if(amount||row.querySelector('.timed-original-account').value)body.push(`<tr><td>${esc(account.selectedOptions[0]?.textContent)}</td><td>${esc(row.querySelector('.partner').value)}</td><td>${side==='D'?money(amount):''}</td><td>${side==='C'?money(amount):''}</td></tr>`)});const diff=debit-credit,out=shell.querySelector('.timed-difference');out.textContent=money(diff);out.dataset.zero=String(diff===0);preview.classList.toggle('unbalanced',diff!==0);preview.innerHTML=`<h4>대체 전표 · 입력 내역</h4><table><thead><tr><th>계정과목</th><th>거래처</th><th>차변</th><th>대변</th></tr></thead><tbody>${body.join('')||'<tr><td colspan="4">입력 대기</td></tr>'}<tr><td colspan="2">합계</td><td>${money(debit)}</td><td>${money(credit)}</td></tr></tbody></table>`}
    card.addEventListener('input',render);card.addEventListener('change',render);render();
  }
  global.TrainingTimed={install,clock,chord,style,files,read,esc};
})(window);
