(function(){
  'use strict';
  const questions=document.querySelector('#questions');if(!questions)return;
  const KEY='exam-20260914-voucher-marks-v1';
  const kinds=['blue','red','green','highlight','underline'],colors=kinds.slice(0,3);
  const blocks=new Map(),undo=[];
  const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  questions.querySelectorAll('.question').forEach(card=>{
    for(const type of ['prompt','exhibit'])card.querySelectorAll('.'+type).forEach((root,index)=>{
      if(root.parentElement.closest('[data-question-mark-block]'))return;
      const id='voucher:'+card.dataset.index+':'+type+':'+index;
      root.dataset.questionMarkBlock=id;
      blocks.set(id,{root,text:root.textContent,template:root.cloneNode(true)});
    });
  });
  if(!blocks.size)return;
  const style=document.createElement('style');
  style.textContent=`
    .question [data-question-mark-block]{user-select:text;-webkit-user-select:text}
    .question-mark-popup{position:fixed;z-index:10020;box-sizing:border-box;width:340px;max-width:calc(100vw - 16px);padding:10px;border:1px solid #bac6d3;border-radius:12px;background:white;box-shadow:0 8px 28px #10243a33;color:#24384c;font:14px/1.5 system-ui,sans-serif}
    .question-mark-popup[hidden]{display:none}.question-mark-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .question-mark-popup button{display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:36px;padding:5px 8px;border:1px solid #d1dbe5;border-radius:7px;background:white;color:#24384c;font:inherit;white-space:nowrap;cursor:pointer}
    .question-mark-popup button:hover,.question-mark-popup button:focus-visible{background:#eef5fc;outline:2px solid #427da9;outline-offset:1px}
    .question-mark-popup button:disabled{opacity:.45;cursor:default}.question-mark-swatch{display:block;width:18px;height:18px;border-radius:4px}
    .question-mark-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px}.question-mark-footer button{flex:none;min-height:28px;padding:2px 8px}.question-mark-status{min-width:0;margin:0;line-height:1.5}
    .qm-blue{color:#0076a8!important}.qm-red{color:#c62828!important}.qm-green{color:#16723a!important}.qm-highlight{background:#fff200!important;box-decoration-break:clone;-webkit-box-decoration-break:clone}.qm-underline{text-decoration-line:underline;text-decoration-thickness:.12em;text-underline-offset:.18em}
    .question-mark-hint{color:#52677d;font-size:14px;line-height:1.6}
    @media(pointer:coarse){.question-mark-hint{display:none}}@media print{.question-mark-popup,.question-mark-hint{display:none!important}}
  `;
  document.head.append(style);
  const hint=document.createElement('p');hint.className='question-mark-hint';hint.textContent='문제의 글자를 드래그 → 오른쪽 클릭: 글자색·형광펜·밑줄 (이 브라우저에 저장)';questions.before(hint);
  const popup=document.createElement('div');popup.className='question-mark-popup';popup.hidden=true;
  popup.setAttribute('role','toolbar');popup.setAttribute('aria-label','선택한 문제 글자 표시');
  popup.innerHTML=`<div class="question-mark-actions">
    <button type="button" data-question-mark="blue" aria-label="파란 글자색" title="파란 글자색"><span class="question-mark-swatch" style="background:#0076a8"></span></button>
    <button type="button" data-question-mark="red" aria-label="빨간 글자색" title="빨간 글자색"><span class="question-mark-swatch" style="background:#c62828"></span></button>
    <button type="button" data-question-mark="green" aria-label="초록 글자색" title="초록 글자색"><span class="question-mark-swatch" style="background:#16723a"></span></button>
    <button type="button" data-question-mark="highlight" aria-label="노란 형광펜" title="노란 형광펜"><span style="background:#fff200;color:#24384c;padding:0 3px">가</span></button>
    <button type="button" data-question-mark="underline" aria-label="밑줄" title="밑줄"><span style="text-decoration:underline">가</span></button>
    <button type="button" data-question-mark="clear" aria-label="선택한 글자의 표시 지우기" title="선택한 글자의 표시 지우기">지움</button>
    <button type="button" class="question-mark-undo" aria-label="직전 표시 되돌리기" title="직전 표시 되돌리기" disabled>↶</button>
  </div><div class="question-mark-footer"><p class="question-mark-status" role="status" aria-live="polite"></p><button type="button" class="question-mark-close" aria-label="글자 표시 팝업 닫기">닫기</button></div>`;
  document.body.append(popup);
  const status=popup.querySelector('.question-mark-status'),undoButton=popup.querySelector('.question-mark-undo');
  let marks={},pending=[],readable=true;
  function valid(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length<=2000&&Object.entries(value).every(([id,entry])=>/^voucher:\d+:(prompt|exhibit):\d+$/.test(id)&&entry&&typeof entry.text==='string'&&entry.text.length<=100000&&Array.isArray(entry.spans)&&entry.spans.length<=3000&&entry.spans.every(span=>span&&kinds.includes(span.kind)&&Number.isInteger(span.start)&&Number.isInteger(span.end)&&span.start>=0&&span.end>span.start&&span.end<=entry.text.length))}
  function load(){try{const raw=localStorage.getItem(KEY),value=raw?JSON.parse(raw):{};if(!valid(value))throw Error('format');marks=value;readable=true}catch(_){readable=false}}
  function spansFor(id){const block=blocks.get(id),entry=marks[id];return entry?.text===block.text?entry.spans:[]}
  function renderBlock(id){
    const block=blocks.get(id),spans=spansFor(id),template=block.template.cloneNode(true);
    const walker=document.createTreeWalker(template,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    let offset=0;
    for(const node of nodes){
      const start=offset,end=start+node.data.length;offset=end;
      const intersect=spans.filter(span=>span.start<end&&span.end>start);if(!intersect.length)continue;
      const boundaries=[...new Set([start,end,...intersect.flatMap(span=>[Math.max(start,span.start),Math.min(end,span.end)])])].sort((a,b)=>a-b),fragment=document.createDocumentFragment();
      for(let i=0;i<boundaries.length-1;i++){
        const from=boundaries[i],to=boundaries[i+1],text=node.data.slice(from-start,to-start),styles=kinds.filter(kind=>intersect.some(span=>span.kind===kind&&span.start<=from&&span.end>=to));
        if(!styles.length)fragment.append(document.createTextNode(text));
        else{const marked=document.createElement('span');marked.className='question-mark '+styles.map(kind=>'qm-'+kind).join(' ');marked.textContent=text;fragment.append(marked)}
      }
      node.replaceWith(fragment);
    }
    block.root.replaceChildren(...template.childNodes);
  }
  function endpointBlock(node){const element=node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;return element?.closest('[data-question-mark-block]')}
  function offset(root,node,at){const range=document.createRange();range.selectNodeContents(root);range.setEnd(node,at);return range.toString().length}
  function selected(){
    const selection=getSelection();if(!selection||selection.isCollapsed||selection.rangeCount!==1)return [];
    const range=selection.getRangeAt(0),startRoot=endpointBlock(range.startContainer),endRoot=endpointBlock(range.endContainer);
    if(!startRoot||!endRoot||!blocks.has(startRoot.dataset.questionMarkBlock)||!blocks.has(endRoot.dataset.questionMarkBlock)||!range.toString().trim())return [];
    const found=[];
    for(const [id,block] of blocks){
      if(!block.root.getClientRects().length||!range.intersectsNode(block.root))continue;
      const start=block.root.contains(range.startContainer)?offset(block.root,range.startContainer,range.startOffset):0;
      const end=block.root.contains(range.endContainer)?offset(block.root,range.endContainer,range.endOffset):block.text.length;
      if(end>start)found.push({id,start,end});
    }
    return found;
  }
  function hide(){popup.hidden=true;pending=[]}
  function place(x,y){const rect=popup.getBoundingClientRect();popup.style.left=Math.max(8,Math.min(x,innerWidth-rect.width-8))+'px';popup.style.top=Math.max(8,Math.min(y,innerHeight-rect.height-8))+'px'}
  function report(message){status.textContent=message;if(!popup.hidden)place(parseFloat(popup.style.left)||8,parseFloat(popup.style.top)||8)}
  function save(next){
    if(!readable){report('기존 표시를 읽지 못해 저장을 중지했습니다.');return false}
    try{if(!valid(next))throw Error('format');localStorage.setItem(KEY,JSON.stringify(next));marks=next;return true}catch(_){report('저장하지 못했습니다. 기존 표시는 그대로 유지됩니다.');return false}
  }
  function trim(spans,selection,kind){return spans.flatMap(span=>{
    if((kind!=='clear'&&(colors.includes(kind)?!colors.includes(span.kind):span.kind!==kind))||span.end<=selection.start||span.start>=selection.end)return [span];
    const kept=[];if(span.start<selection.start)kept.push({...span,end:selection.start});if(span.end>selection.end)kept.push({...span,start:selection.end});return kept;
  })}
  function apply(kind){
    if(!pending.length)return;
    const next={...marks},before=new Map();
    for(const selection of pending){
      const block=blocks.get(selection.id);if(!before.has(selection.id))before.set(selection.id,copy(marks[selection.id]));
      let spans=trim(spansFor(selection.id),selection,kind);
      if(kind!=='clear')spans.push({start:selection.start,end:selection.end,kind});
      if(spans.length)next[selection.id]={text:block.text,spans};else delete next[selection.id];
    }
    if(!save(next))return;
    undo.push(before);if(undo.length>30)undo.shift();undoButton.disabled=false;
    before.forEach((_,id)=>renderBlock(id));getSelection()?.removeAllRanges();report('저장됨 · 다른 표시도 추가 가능');
  }
  document.addEventListener('contextmenu',event=>{
    // 휴대폰의 길게 누르기/복사 메뉴와 전표 입력칸의 기본 메뉴는 유지한다.
    if(matchMedia('(pointer:coarse)').matches||event.target.closest('input,textarea,select,button,a,[contenteditable]')){hide();return}
    const found=selected(),target=event.target.closest('[data-question-mark-block]');
    if(!found.length||!target||!found.some(item=>item.id===target.dataset.questionMarkBlock)){hide();return}
    event.preventDefault();pending=found;popup.hidden=false;
    popup.querySelectorAll('[data-question-mark]').forEach(button=>{button.disabled=!readable});
    status.textContent=readable?'선택한 글자에 적용 · 이 브라우저에 저장':'기존 표시를 읽지 못해 저장을 중지했습니다.';
    const rect=getSelection().getRangeAt(0).getBoundingClientRect();place(event.clientX||rect.left,event.clientY||rect.bottom);
    if(!event.clientX&&!event.clientY)popup.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
  });
  popup.addEventListener('pointerdown',event=>{if(event.target.closest('button'))event.preventDefault()});
  popup.querySelectorAll('[data-question-mark]').forEach(button=>button.addEventListener('click',()=>apply(button.dataset.questionMark)));
  popup.querySelector('.question-mark-close').addEventListener('click',hide);
  undoButton.addEventListener('click',()=>{
    if(!undo.length)return;const before=undo[undo.length-1],next={...marks};
    before.forEach((entry,id)=>{if(entry===undefined)delete next[id];else next[id]=copy(entry)});
    if(!save(next))return;undo.pop();before.forEach((_,id)=>renderBlock(id));undoButton.disabled=!undo.length;getSelection()?.removeAllRanges();pending=[];
    popup.querySelectorAll('[data-question-mark]').forEach(button=>{button.disabled=true});report('직전 표시를 되돌렸습니다.');
  });
  document.addEventListener('pointerdown',event=>{if(!popup.hidden&&!popup.contains(event.target)&&event.button!==2)hide()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!popup.hidden){event.preventDefault();hide()}});
  window.addEventListener('scroll',event=>{if(!popup.contains(event.target))hide()},true);
  window.addEventListener('resize',hide);
  window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){hide();undo.length=0;undoButton.disabled=true;load();blocks.forEach((_,id)=>renderBlock(id))}});
  load();blocks.forEach((_,id)=>{if(spansFor(id).length)renderBlock(id)});
})();
