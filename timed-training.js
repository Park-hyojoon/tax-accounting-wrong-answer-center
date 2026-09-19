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
  function style(){if(document.getElementById('timedStyle'))return;const link=document.createElement('link');link.id='timedStyle';link.rel='stylesheet';link.href='timed-training.css?v=1';document.head.append(link)}
  function install(problems,a){
    if(new URLSearchParams(location.search).get('timed')!=='1')return;
    style();document.body.classList.add('timed-mode');document.title='시간 훈련 · '+(a.subject==='practical'?'일반전표':'매입매출전표');
    const savePanel=document.querySelector('.save-panel');if(savePanel){const details=document.createElement('details');details.className='timed-records';details.innerHTML='<summary>오늘 학습기록 저장</summary>';savePanel.before(details);details.append(savePanel)}
    let settings={...defaults,...read(settingsKey)},current=null;
    const cards=[...document.querySelectorAll('.question')];
    const state=card=>a.state.cards[card.dataset.index]||(a.state.cards[card.dataset.index]={history:[]});
    const pending=()=>current?state(current).timedPending:null;
    const bar=document.createElement('section');bar.className='timed-bar';
    bar.innerHTML=`<strong>시간 훈련</strong><a href="${files.practical}?timed=1" class="${a.subject==='practical'?'selected':''}">일반전표</a><a href="${files.voucher}?timed=1" class="${a.subject==='voucher'?'selected':''}">매입매출전표</a><label>회차 <select class="time-exam"><option value="">전체</option></select></label><label>유형 <select class="time-type"><option value="">전체</option></select></label><label>학습 상태 <select class="time-status"><option value="active">미통과 문제</option><option value="all">전체 기록 · 다시 훈련</option></select></label><label>문제 <select class="time-question"></select></label><button type="button" class="time-next">다음 문제</button><span class="time-count"></span>`;
    document.querySelector('#questions').before(bar);
    const exam=bar.querySelector('.time-exam'),type=bar.querySelector('.time-type'),status=bar.querySelector('.time-status'),select=bar.querySelector('.time-question');
    [...new Set(problems.map(p=>p.examRound))].sort((x,y)=>x-y).forEach(x=>exam.add(new Option(x+'회',x)));
    [...new Set(problems.map(p=>p.type))].sort((x,y)=>x.localeCompare(y,'ko')).forEach(x=>type.add(new Option(x,x)));
    const params=new URLSearchParams(location.search);exam.value=params.get('exam')||'';type.value=params.get('type')||'';if(params.get('status')==='all')status.value='all';
    const panel=document.createElement('aside');panel.className='timer-panel';panel.setAttribute('aria-label','시간 훈련 타이머');
    panel.innerHTML='<button class="timer-dial" type="button" aria-label="타이머 시작"><span><strong>1:00</strong><small>클릭하여 시작</small></span></button><p class="timer-state" role="status">시작 대기</p><div class="timer-buttons"><button type="button" class="timer-stop">정지</button><button type="button" class="timer-config">설정</button><button type="button" class="timer-retry">다시 풀기</button></div><p class="timer-help"></p>';
    document.body.append(panel);
    const dialog=document.createElement('dialog');dialog.className='timer-settings';dialog.setAttribute('aria-labelledby','timerTitle');
    dialog.innerHTML='<h2 id="timerTitle">시간 · 단축키 설정</h2><div class="timer-wheels"><label>분<select class="timer-minutes" aria-label="목표 분"></select></label><label>초<select class="timer-seconds" aria-label="목표 초"></select></label></div><label class="timer-shortcut">시작<input readonly class="shortcut-start" aria-label="시작 단축키" placeholder="원하는 키 조합을 누르세요"></label><label class="timer-shortcut">정지<input readonly class="shortcut-stop" aria-label="정지 단축키" placeholder="원하는 키 조합을 누르세요"></label><p>단축키 칸을 누른 후 원하는 조합을 입력하세요. Ctrl 또는 Alt를 포함해 주세요.</p><p class="timer-error" role="alert"></p><button class="timer-defaults" type="button">기본값</button> <button class="timer-cancel" type="button">취소</button> <button class="timer-save" type="button">저장 · 시작</button>';
    document.body.append(dialog);
    const minutes=dialog.querySelector('.timer-minutes'),seconds=dialog.querySelector('.timer-seconds');
    for(let i=0;i<60;i++){minutes.add(new Option(String(i).padStart(2,'0'),i));seconds.add(new Option(String(i).padStart(2,'0'),i))}
    function message(text){panel.querySelector('.timer-state').textContent=text}
    function draw(){const p=pending(),elapsed=p?(p.elapsedMs??Math.max(0,Date.now()-p.startedMs)):0,target=(p?.targetSeconds||settings.targetSeconds)*1000,remaining=target-elapsed;
      panel.querySelector('.timer-dial strong').textContent=(remaining<0?'+':'')+clock(Math.abs(remaining));
      panel.querySelector('.timer-dial small').textContent=p?.phase==='running'?(remaining<0?'초과 시간':'남은 시간'):p?.phase==='stopped'||p?.phase==='graded'?'측정 완료':'클릭하여 시작';
      panel.style.setProperty('--timer-fill',Math.max(0,Math.min(100,remaining/target*100))+'%');panel.classList.toggle('overtime',remaining<0);
      panel.querySelector('.timer-stop').disabled=p?.phase!=='running';panel.querySelector('.timer-config').disabled=p?.phase==='running';
      panel.querySelector('.timer-help').textContent=`시작 ${settings.start}\n정지 ${settings.stop}`;
    }
    function lock(value){if(!current)return;current.querySelectorAll('.entry-wrap,.kclep-shell').forEach(x=>x.inert=value)}
    function start(){if(!current)return;const p=pending();if(p?.phase==='running')return;if(p?.phase==='stopped'){message('채점 후 다시 풀기를 눌러주세요.');return}if(p?.phase==='graded'){message('다시 풀기 또는 다음 문제를 선택하세요.');return}
      current.querySelectorAll('details').forEach(x=>x.open=false);lock(false);
      state(current).timedPending={id:crypto.randomUUID(),phase:'running',startedMs:Date.now(),targetSeconds:settings.targetSeconds,assisted:false};a.save();message('측정 중 · 입력을 마치면 정지');draw();
      const first=current.querySelector('.entry-row .side,.date-month,.voucher-type');first?.focus({preventScroll:true});
    }
    function stop(){const p=pending();if(p?.phase!=='running')return;p.elapsedMs=Math.max(0,Date.now()-p.startedMs);p.stoppedAt=new Date().toISOString();p.phase='stopped';a.save();lock(true);message(`완료 ${clock(p.elapsedMs)} · 채점해주세요`);draw()}
    function reset(){if(!current)return;const p=pending();if(p&&(p.phase==='running'||p.phase==='stopped')&&!confirm('이번 미채점 측정을 버리고 다시 시작할까요? 이전 채점 이력은 보존됩니다.'))return;
      delete state(current).timedPending;lock(false);a.clear(current);current.querySelectorAll('details').forEach(x=>x.open=false);current.querySelector('.check-one').disabled=false;current.querySelector('.check-one').textContent='채점하기';lock(true);a.save();message('입력 초기화 · 시작 대기');current.dispatchEvent(new Event('input',{bubbles:true}));draw();
    }
    function passed(s){return !s.trainingCenterRestored&&(s.passed||s.correct===true||(s.history||[]).some(h=>h.correct===true&&!h.cancelledAt))}
    function eligible(card){const p=problems[card.dataset.index],s=state(card);return !s.deleted&&(!exam.value||String(p.examRound)===exam.value)&&(!type.value||p.type===type.value)&&(status.value==='all'||!passed(s)||['running','stopped'].includes(s.timedPending?.phase))}
    function show(card){if(current&&current!==card&&pending()?.phase==='running'){message('먼저 타이머를 정지해주세요.');select.value=current.dataset.index;return}
      current=card||null;cards.forEach(c=>c.hidden=c!==current);if(!current){message('선택한 범위에 미통과 문제가 없습니다. 전체 기록을 선택하면 다시 훈련할 수 있습니다.');draw();return}
      select.value=current.dataset.index;sessionStorage.setItem('exam-20260914-timed-last-'+a.subject,current.dataset.index);
      const address=new URL(location.href);for(const [key,value] of [['exam',exam.value],['type',type.value],['status',status.value],['problem',current.dataset.index]]){value?address.searchParams.set(key,value):address.searchParams.delete(key)}history.replaceState(null,'',address.href);
      const p=pending();if(!p){a.clear(current);current.querySelectorAll('details').forEach(x=>x.open=false);message('준비되면 타이머를 시작하세요.')}else message(p.phase==='running'?'진행 중인 측정을 이어갑니다.':p.phase==='stopped'?`완료 ${clock(p.elapsedMs)} · 채점해주세요`:'채점 완료 · 다시 풀기 또는 다음 문제');
      current.querySelector('.check-one').disabled=p?.phase==='graded';lock(p?.phase!=='running');current.dispatchEvent(new Event('input',{bubbles:true}));draw();
    }
    function list(prefer){select.replaceChildren();const visible=cards.filter(eligible);visible.forEach(c=>{const p=problems[c.dataset.index];select.add(new Option(`${Number(c.dataset.index)+1}. ${p.title}`,c.dataset.index))});bar.querySelector('.time-count').textContent=`${visible.length}문제`;show(visible.find(c=>c.dataset.index===String(prefer))||visible[0])}
    cards.forEach(card=>{
      if(a.subject==='practical')practicalShell(card);
      card.querySelectorAll('details').forEach(detail=>detail.addEventListener('toggle',()=>{if(detail.open&&current===card&&pending()?.phase==='running'){pending().assisted=true;a.save();message('해설 확인 · 참고 풀이로 기록합니다.')}}));
      card.querySelector('.check-one').addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();if(card!==current)return;stop();const p=pending();if(!p||p.phase!=='stopped'){message('타이머를 시작한 뒤 풀고 채점해주세요.');return}
        a.grade(card);const h=state(card).history.at(-1);h.id=p.id;h.source='timed';h.timing={elapsedMs:p.elapsedMs,targetSeconds:p.targetSeconds,startedAt:new Date(p.startedMs).toISOString(),stoppedAt:p.stoppedAt,assisted:p.assisted};h.problemType=problems[card.dataset.index].type;h.problemId=problems[card.dataset.index].id;p.phase='graded';a.save();card.hidden=false;event.currentTarget.disabled=true;lock(true);message(`${h.correct?'정답':'오답'} · ${clock(p.elapsedMs)}${p.assisted?' · 참고 풀이':''}`);draw();
      },true);
    });
    for(const field of [exam,type,status])field.addEventListener('change',()=>{if(pending()?.phase==='running')stop();list()});
    select.onchange=()=>show(cards.find(c=>c.dataset.index===select.value));
    bar.querySelector('.time-next').onclick=()=>{if(pending()?.phase==='running'){message('먼저 타이머를 정지해주세요.');return}const i=current?Number(current.dataset.index):-1,available=cards.filter(eligible);const next=available.find(c=>Number(c.dataset.index)>i)||available.find(c=>c!==current);if(next){list(next.dataset.index)}else{message('다음 미통과 문제가 없습니다. 전체 기록에서 다시 훈련할 수 있습니다.')}};
    panel.querySelector('.timer-dial').onclick=start;panel.querySelector('.timer-stop').onclick=stop;panel.querySelector('.timer-retry').onclick=reset;
    const loadSettings=s=>{minutes.value=Math.floor(s.targetSeconds/60);seconds.value=s.targetSeconds%60;dialog.querySelector('.shortcut-start').value=s.start;dialog.querySelector('.shortcut-stop').value=s.stop};
    panel.querySelector('.timer-config').onclick=()=>{loadSettings(settings);dialog.querySelector('.timer-error').textContent='';dialog.showModal()};
    dialog.querySelector('.timer-cancel').onclick=()=>dialog.close();dialog.querySelector('.timer-defaults').onclick=()=>loadSettings(defaults);
    dialog.querySelectorAll('input').forEach(input=>input.addEventListener('keydown',e=>{if(e.key==='Tab'||e.key==='Escape')return;e.preventDefault();if(e.code&&!['ControlLeft','ControlRight','AltLeft','AltRight','ShiftLeft','ShiftRight','MetaLeft','MetaRight'].includes(e.code)&&(e.ctrlKey||e.altKey))input.value=chord(e)}));
    dialog.querySelector('.timer-save').onclick=()=>{const next={targetSeconds:Number(minutes.value)*60+Number(seconds.value),start:dialog.querySelector('.shortcut-start').value,stop:dialog.querySelector('.shortcut-stop').value};if(!next.targetSeconds||next.start===next.stop){dialog.querySelector('.timer-error').textContent='목표는 1초 이상, 시작과 정지는 서로 다른 키로 지정해주세요.';return}settings=next;localStorage.setItem(settingsKey,JSON.stringify(settings));dialog.close();draw();start()};
    document.addEventListener('keydown',e=>{if(dialog.open||e.repeat)return;const key=chord(e);if(key===settings.start||key===settings.stop){e.preventDefault();e.stopImmediatePropagation();key===settings.start?start():stop()}},true);
    document.addEventListener('click',e=>{if(pending()?.phase==='running'&&e.target.closest('a')){e.preventDefault();message('먼저 타이머를 정지한 뒤 이동해주세요.')}},true);
    window.addEventListener('beforeunload',e=>{if(pending()?.phase==='running'){e.preventDefault();e.returnValue=''}});
    document.addEventListener('visibilitychange',draw);
    const running=cards.find(c=>state(c).timedPending?.phase==='running'&&!state(c).deleted);
    list(params.get('problem')||running?.dataset.index||sessionStorage.getItem('exam-20260914-timed-last-'+a.subject));
    setInterval(draw,200);
    global.TrainingTimed.active={start,stop,reset,get current(){return current},get pending(){return pending()}};
  }
  function practicalShell(card){
    const wrap=card.querySelector('.entry-wrap'),table=wrap.querySelector('table');
    const shell=document.createElement('section');shell.className='timed-kclep';wrap.before(shell);
    shell.innerHTML='<div class="timed-kclep-title">일반전표입력 · 시간 훈련</div><div class="timed-kclep-tools">계정과목 검색 · Enter 다음 칸 · 금액 +키 000</div><div class="timed-kclep-status"><span>대차차액: <strong class="timed-difference">0</strong></span><small>양수는 대변 부족 · 음수는 차변 부족</small></div>';
    shell.append(wrap);const balance=card.querySelector('.balance-panel');shell.append(balance);
    table.querySelector('thead').innerHTML='<tr><th>구분</th><th>계정과목</th><th>거래처</th><th>적요코드</th><th>차변</th><th>대변</th><th>결과</th></tr>';
    const preview=document.createElement('div');preview.className='timed-preview';shell.append(preview);
    const rows=[...table.querySelectorAll('.entry-row')];
    rows.forEach(row=>{
      const cells=[...row.children],side=row.querySelector('.side'),original=row.querySelector('.amount'),division=row.querySelector('.division'),account=row.querySelector('.account');
      cells[2].classList.add('time-hidden-cell');cells[3].classList.add('time-hidden-cell');
      // Keep the existing grading fields and listeners, and adapt only the visible input layout.
      const debit=document.createElement('td'),credit=document.createElement('td');debit.innerHTML='<input class="timed-money timed-debit" inputmode="numeric" aria-label="차변 금액">';credit.innerHTML='<input class="timed-money timed-credit" inputmode="numeric" aria-label="대변 금액">';
      row.replaceChildren(cells[0],cells[1],cells[4],cells[5],debit,credit,cells[6],cells[2],cells[3]);
      const d=debit.firstChild,c=credit.firstChild;
      const opts=[...account.options].map(o=>({value:o.value,label:o.textContent}));
      const expense=/^(보험료|임차료|퇴직급여|수수료비용|복리후생비|운반비|급여|여비교통비|기업업무추진비|소모품비|감가상각비|전력비|수도광열비|경상연구개발비|지급수수료|교육훈련비)$/;
      const ui=account.cloneNode(false);ui.className='timed-account account';account.className='account timed-original-account';account.hidden=true;account.tabIndex=-1;account.after(ui);
      opts.forEach(o=>(expense.test(o.label)?['판','제']:['']).forEach(part=>ui.add(new Option(o.label+(part?`(${part})`:''),JSON.stringify([o.value,part])))));ui.value=JSON.stringify(['','']);
      ui.addEventListener('change',()=>{const [value,part]=JSON.parse(ui.value);account.value=value;division.value=part;account.dispatchEvent(new Event('change',{bubbles:true}));(row.querySelector('.partner:not(:disabled)')||row.querySelector('.memo')).focus()});
      ui.addEventListener('account-selected',()=>{(row.querySelector('.partner:not(:disabled)')||row.querySelector('.memo')).focus()});
      function reflect(){d.disabled=side.value!=='D';c.disabled=side.value!=='C';d.value=side.value==='D'?original.value:'';c.value=side.value==='C'?original.value:'';ui.value=JSON.stringify([account.value,division.value])}
      side.addEventListener('change',reflect);original.addEventListener('input',reflect);
      side.addEventListener('keydown',e=>{if(e.key==='3'||e.key==='4'){e.preventDefault();side.value=e.key==='3'?'D':'C';side.dispatchEvent(new Event('change',{bubbles:true}));ui.focus()}});
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
