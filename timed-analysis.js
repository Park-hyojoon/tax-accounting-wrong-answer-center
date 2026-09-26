(function(){
  'use strict';
  const T={
    files:{practical:'일반전표_기본연습_24문제.html',voucher:'매입매출전표_오답연습_3문제.html'},
    read:key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}}},
    clock:ms=>{const s=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`},
    esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  };
  if(!document.getElementById('timedStyle')){const link=document.createElement('link');link.id='timedStyle';link.rel='stylesheet';link.href='timed-training.css?v=20';document.head.append(link)}
  const host=document.createElement('section');host.className='panel timed-analysis';host.id='timedAnalysis';
  host.innerHTML='<h2>시간 훈련 · 속도와 정확도</h2><p class="description">채점한 시간 훈련만 집계합니다. 곡선은 풀이 순서별 소요시간이며 점에 마우스를 올리거나 눌러 결과를 확인할 수 있습니다. 미채점·취소 기록은 제외합니다.</p><label>분야 <select class="timed-subject"><option value="all">전체</option><option value="practical">일반전표</option><option value="voucher">매입매출전표</option></select></label><label>유형 <select class="timed-type"><option value="">전체</option></select></label><label><input type="checkbox" class="timed-assisted"> 해설 참고 풀이 포함</label><p class="timed-summary"></p><div class="timed-chart-scroll timed-trend"></div><p class="timed-point-info" role="status"></p><p class="description">파란색: 소요시간 곡선 · 초록 점: 정답 · 주황 점: 오답 · 회색 점선: 각 풀이의 목표시간</p><div class="timed-chart-scroll timed-types"></div>';
  document.querySelector('main').append(host);
  const subject=host.querySelector('.timed-subject'),type=host.querySelector('.timed-type'),include=host.querySelector('.timed-assisted');
  function records(){const seen=new Set(),out=[];for(const s of ['practical','voucher']){const state=T.read('exam-20260914-'+s);for(const [index,card] of Object.entries(state.cards||{})){for(const h of card.history||[]){if(h.source!=='timed'||h.cancelledAt||typeof h.correct!=='boolean'||!Number.isFinite(h.timing?.elapsedMs)||h.timing.elapsedMs<0)continue;const key=s+':'+(h.id||JSON.stringify(h));if(seen.has(key))continue;seen.add(key);out.push({...h,subject:s,index,type:h.problemType||'유형 미기록'})}}}return out.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))}
  function refresh(){const all=records(),types=[...new Set(all.filter(x=>subject.value==='all'||x.subject===subject.value).map(x=>x.type))].sort((a,b)=>a.localeCompare(b,'ko')),prev=type.value;type.replaceChildren(new Option('전체',''));types.forEach(x=>type.add(new Option(x,x)));type.value=types.includes(prev)?prev:'';
    const rows=all.filter(x=>(subject.value==='all'||x.subject===subject.value)&&(!type.value||x.type===type.value)&&(include.checked||!x.timing.assisted));
    const correct=rows.filter(x=>x.correct).length,avg=rows.reduce((n,x)=>n+x.timing.elapsedMs,0)/(rows.length||1),within=rows.filter(x=>x.correct&&x.timing.elapsedMs<=x.timing.targetSeconds*1000).length;
    host.querySelector('.timed-summary').textContent=rows.length?`총 ${rows.length}회 · 정답 ${correct}회 / 오답 ${rows.length-correct}회 · 평균 ${T.clock(avg)} · 목표시간 내 정답 ${within}회`:'아직 채점한 시간 훈련 기록이 없습니다.';
    const trend=host.querySelector('.timed-trend'),info=host.querySelector('.timed-point-info');info.textContent='';
    if(!rows.length){trend.innerHTML='<div class="empty">시간 훈련에서 타이머를 시작하고, 정지 후 채점하면 그래프가 생깁니다.</div>';host.querySelector('.timed-types').replaceChildren();return}
    const plot=rows.slice(-60),W=850,H=270,L=58,R=25,top=25,bottom=45,max=Math.max(60,...plot.map(x=>Math.max(x.timing.elapsedMs/1000,x.timing.targetSeconds)))*1.1;
    const x=i=>L+(plot.length===1?(W-L-R)/2:i/(plot.length-1)*(W-L-R)),y=s=>H-bottom-s/max*(H-top-bottom);
    function curve(values){return values.map((v,i)=>i?`C ${x(i-1)+(x(i)-x(i-1))/2} ${y(values[i-1])} ${x(i-1)+(x(i)-x(i-1))/2} ${y(v)} ${x(i)} ${y(v)}`:`M ${x(i)} ${y(v)}`).join(' ')}
    const desc=r=>`${new Date(r.at).toLocaleString('ko-KR')} · ${r.type} · ${r.correct?'정답':'오답'} · ${T.clock(r.timing.elapsedMs)} / 목표 ${T.clock(r.timing.targetSeconds*1000)}${r.timing.assisted?' · 해설 참고':''}`;
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 ${plot.length}회 소요시간과 목표시간 곡선"><title>시간 훈련 결과</title>`;
    for(let i=0;i<=4;i++){const val=max*i/4;svg+=`<line x1="${L}" x2="${W-R}" y1="${y(val)}" y2="${y(val)}" stroke="#e5ecf2"/><text x="${L-8}" y="${y(val)+4}" text-anchor="end" font-size="12" fill="#52667a">${Math.round(val)}초</text>`}
    svg+=`<path d="${curve(plot.map(r=>r.timing.targetSeconds))}" fill="none" stroke="#8a97a5" stroke-dasharray="5 5"/><path d="${curve(plot.map(r=>r.timing.elapsedMs/1000))}" fill="none" stroke="#72b7e6" stroke-width="3"/>`;
    if(plot.length===1)svg+=`<line x1="${L}" x2="${W-R}" y1="${y(plot[0].timing.targetSeconds)}" y2="${y(plot[0].timing.targetSeconds)}" stroke="#8a97a5" stroke-dasharray="5 5"/>`;
    plot.forEach((r,i)=>{svg+=`<circle class="chart-point" data-point="${i}" cx="${x(i)}" cy="${y(r.timing.elapsedMs/1000)}" r="6" fill="${r.correct?'#64a47f':'#ce823e'}" tabindex="0" role="button" aria-label="${T.esc(desc(r))}"><title>${T.esc(desc(r))}</title></circle>`});
    svg+=`<text x="${L}" y="${H-10}" font-size="12" fill="#52667a">${rows.length-plot.length+1}번째 풀이</text><text x="${W-R}" y="${H-10}" text-anchor="end" font-size="12" fill="#52667a">${rows.length}번째 풀이 (최근 ${plot.length}회)</text></svg>`;trend.innerHTML=svg;
    trend.querySelectorAll('[data-point]').forEach(dot=>{const show=()=>info.textContent=desc(plot[Number(dot.dataset.point)]);dot.onclick=show;dot.onfocus=show;dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show()}}});
    const groups=new Map();rows.forEach(r=>{const key=r.subject+'|'+r.type,g=groups.get(key)||{subject:r.subject,type:r.type,index:r.index,n:0,wrong:0,total:0,within:0};g.n++;g.wrong+=!r.correct;g.total+=r.timing.elapsedMs;g.within+=r.correct&&r.timing.elapsedMs<=r.timing.targetSeconds*1000;groups.set(key,g)});
    host.querySelector('.timed-types').innerHTML='<h3>유형별 반복 오답</h3><table><thead><tr><th>유형 · 눌러서 재훈련</th><th>오답 / 풀이</th><th>오답률</th><th>평균시간</th><th>시간 내 정답</th></tr></thead><tbody>'+[...groups.values()].sort((a,b)=>b.wrong-a.wrong||b.total/b.n-a.total/a.n).map(g=>`<tr><td><a href="${T.files[g.subject]}?timed=1&amp;status=all&amp;type=${encodeURIComponent(g.type)}">${g.subject==='practical'?'일반':'매입매출'} · ${T.esc(g.type)}</a></td><td>${g.wrong} / ${g.n}</td><td>${Math.round(g.wrong/g.n*100)}%</td><td>${T.clock(g.total/g.n)}</td><td>${g.within}회</td></tr>`).join('')+'</tbody></table>';
  }
  [subject,type,include].forEach(x=>x.addEventListener('change',refresh));window.addEventListener('storage',refresh);window.addEventListener('pageshow',refresh);refresh();
})();
