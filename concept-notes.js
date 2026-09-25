(function(){
  'use strict';
  const data=window.VAT_CONCEPTS,KEY='exam-20260914-concept-notes-v1',allowed=new Set(data.sections.map(s=>s.id));
  const status=document.getElementById('saveStatus');
  let notes={},storageFailed=false;
  function validNotes(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([id,text])=>allowed.has(id)&&typeof text==='string'&&text.length<=100000)}
  try{const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);if(!validNotes(saved))throw Error('Invalid notes');notes=saved}}
  catch(_){storageFailed=true;status.textContent='저장된 메모를 읽지 못했습니다. 새 메모는 다운로드로 보관하세요.';status.classList.add('error')}
  function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node}
  function save(){
    if(storageFailed)return false;
    try{localStorage.setItem(KEY,JSON.stringify(notes));status.textContent='이 브라우저에 저장됨 · '+new Date().toLocaleTimeString('ko-KR');return true}
    catch(_){storageFailed=true;status.textContent='브라우저 저장에 실패했습니다. 메모 백업 또는 MD·TXT로 내려받아 보관하세요.';status.classList.add('error');return false}
  }
  document.getElementById('readingIntro').textContent=data.intro;
  data.studyPlan.forEach(text=>document.getElementById('studyPlan').append(el('li',text)));
  for(const s of data.sections){
    const nav=el('a',s.title);nav.href='#'+s.id;document.getElementById('contents').append(nav);
    const section=el('section',undefined,'chapter');section.id=s.id;
    section.append(el('p',s.focus,'focus'),el('h2',s.title),el('p',s.key,'key'));
    s.paragraphs.forEach(text=>section.append(el('p',text)));
    const table=el('table'),thead=el('thead'),tr=el('tr');s.headers.forEach(text=>{const th=el('th',text);th.scope='col';tr.append(th)});thead.append(tr);table.append(thead);
    const tbody=el('tbody');s.rows.forEach(row=>{const tr=el('tr');row.forEach(text=>tr.append(el('td',text)));tbody.append(tr)});table.append(tbody);
    const tableWrap=el('div',undefined,'table-wrap');tableWrap.append(table);section.append(tableWrap);
    if(s.details){const ul=el('ul');s.details.forEach(text=>ul.append(el('li',text)));section.append(ul)}
    const trap=el('div',undefined,'trap');trap.append(el('strong','선택지에서 조심할 말'),el('span',s.trap));section.append(trap);
    const quizzes=el('div',undefined,'quiz-block');quizzes.append(el('h3','표를 가리고, 먼저 답해보세요'));
    s.quiz.forEach((item,i)=>{const quiz=el('div',undefined,'quiz');quiz.append(el('p',`${i+1}. ${item.q}`));const answer=el('div',item.a,'answer');answer.hidden=true;answer.id=`${s.id}-answer-${i}`;const button=el('button','정답·이유 보기');button.type='button';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',answer.id);button.onclick=()=>{answer.hidden=!answer.hidden;button.setAttribute('aria-expanded',String(!answer.hidden));button.textContent=answer.hidden?'정답·이유 보기':'정답 접기'};quiz.append(button,answer);quizzes.append(quiz)});section.append(quizzes);
    const editor=el('details',undefined,'note-editor');editor.append(el('summary','내 말로 정리하기 · 직접 쓰기'),el('p',s.notePrompt));
    const input=el('textarea');input.value=notes[s.id]||'';input.maxLength=100000;input.setAttribute('aria-label',s.title+' 나의 정리');input.placeholder='표를 보지 않고 설명한 뒤, 빠진 조건을 덧붙여보세요.';
    const message=el('div',input.value?'저장된 메모를 불러왔습니다.':'입력하면 이 기기에 자동 저장됩니다.','note-status');message.setAttribute('role','status');
    const print=el('div',undefined,'note-print');
    function updatePrint(){print.textContent=input.value?'나의 정리\n'+input.value:'';print.classList.toggle('has-note',!!input.value)}
    input.oninput=()=>{notes[s.id]=input.value;const ok=save();message.textContent=ok?'저장됨':'자동 저장되지 않았습니다. 상단에서 백업을 내려받으세요.';message.classList.toggle('error',!ok);updatePrint()};
    updatePrint();editor.append(input,message);section.append(editor,print);
    const references=el('details',undefined,'references');references.append(el('summary','근거 확인 · '+data.updated));s.sources.forEach(id=>{const source=data.sources[id],link=el('a',source.title);link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';references.append(link)});section.append(references);
    document.getElementById('chapters').append(section);
  }
  const markup=window.ConceptMarkup.create(document.getElementById('chapters'));
  const nav=document.querySelector('.top-nav'),toolbar=document.getElementById('markToolbar');
  const resize=new ResizeObserver(()=>{document.documentElement.style.setProperty('--concept-nav-height',nav.offsetHeight+'px');document.documentElement.style.setProperty('--concept-toolbar-height',toolbar.offsetHeight+'px')});resize.observe(nav);resize.observe(toolbar);
  function markdown(formatted=true){const out=[`# ${data.title}`,'',data.scope,`법령 확인: ${data.updated}`,'',data.intro,'',...data.studyPlan.map(s=>'- '+s),''];
    const content=node=>formatted?markup.html(node):node.textContent;
    data.sections.forEach(s=>{const section=document.getElementById(s.id);out.push('## '+content(section.querySelector('h2')),'',content(section.querySelector('.key')),'');section.querySelectorAll(':scope > p:not(.focus):not(.key)').forEach(p=>out.push(content(p),''));const table=section.querySelector('table');out.push('| '+[...table.rows[0].cells].map(content).join(' | ')+' |','| '+s.headers.map(()=>'---').join(' | ')+' |');[...table.rows].slice(1).forEach(row=>out.push('| '+[...row.cells].map(content).join(' | ')+' |'));out.push('');section.querySelectorAll(':scope > ul li').forEach(p=>out.push('- '+content(p)));out.push('','주의: '+content(section.querySelector('.trap span')),'','### 확인 질문','');section.querySelectorAll('.quiz').forEach(q=>out.push('질문: '+content(q.querySelector('p')),'정답: '+content(q.querySelector('.answer')),''));if(notes[s.id])out.push('### 나의 정리','',notes[s.id],'');out.push('근거:');s.sources.forEach(id=>out.push(`[${data.sources[id].title}](${data.sources[id].url})`));out.push('')});return out.join('\n')}
  function text(){return markdown(false).replace(/^#{1,3} /gm,'').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g,'$1: $2').replace(/^\|(?: --- \|)+\s*$/gm,'')}
  function download(content,type,name){const blob=new Blob(['\ufeff',content],{type}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
  document.getElementById('downloadMd').onclick=()=>download(markdown(),'text/markdown;charset=utf-8','부가가치세_개념과_나의정리.md');
  document.getElementById('downloadTxt').onclick=()=>download(text(),'text/plain;charset=utf-8','부가가치세_개념과_나의정리.txt');
  document.getElementById('backupNotes').onclick=()=>download(JSON.stringify({format:'vat-concept-notes',version:2,season:'exam-20260914',exportedAt:new Date().toISOString(),notes,marks:markup.export()},null,2),'application/json','부가세_표시와_메모_백업.json');
  document.getElementById('importNotes').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>4000000)throw Error('size');const backup=JSON.parse((await file.text()).replace(/^\uFEFF/,''));if(backup.format!=='vat-concept-notes'||![1,2].includes(backup.version)||backup.season!=='exam-20260914'||!validNotes(backup.notes)||(backup.version===2&&!markup.valid(backup.marks)))throw Error('format');if(!confirm('백업에 들어 있는 메모와 표시를 불러올까요? 같은 항목의 현재 내용은 백업 내용으로 바뀝니다.'))return;notes={...notes,...backup.notes};if(!save())return;if(backup.version===2)markup.import(backup.marks);location.reload()}catch(_){status.textContent='백업을 불러오지 못했습니다. 이 화면에서 받은 파일인지, 브라우저 저장공간이 있는지 확인하세요.';status.classList.add('error')}finally{event.target.value=''}};
  let printState=[];
  window.addEventListener('beforeprint',()=>{printState=[...document.querySelectorAll('.reading-guide details,.references')].map(d=>[d,d.open]);printState.forEach(([d])=>{d.open=true})});
  window.addEventListener('afterprint',()=>{printState.forEach(([d,open])=>{d.open=open});printState=[]});
  document.getElementById('printNotes').onclick=()=>window.print();
})();
