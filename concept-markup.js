(function(){
  'use strict';
  const KEY='exam-20260914-concept-marks-v1',kinds=['underline','highlight','bold'];
  const clone=x=>JSON.parse(JSON.stringify(x));
  const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.ConceptMarkup={create(root){
    const blocks=new Map(),toolbar=document.getElementById('markToolbar'),status=document.getElementById('markStatus'),history=[];
    root.querySelectorAll('.chapter').forEach(section=>section.querySelectorAll('h2,:scope > p,th,td,li,.trap span,.quiz > p,.answer').forEach((node,i)=>{const id=section.id+'-'+i;node.dataset.markBlock=id;blocks.set(id,{node,text:node.textContent})}));
    let marks={},pending=[],unreadable=false;
    function valid(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length<=2000&&Object.values(value).every(b=>b&&typeof b.text==='string'&&b.text.length<=100000&&Array.isArray(b.spans)&&b.spans.length<=2000&&b.spans.every(s=>kinds.includes(s.kind)&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.end>s.start&&s.end<=b.text.length))}
    try{const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);if(!valid(saved))throw Error('format');marks=saved}}
    catch(_){unreadable=true;status.textContent='기존 표시를 읽지 못했습니다. 이 화면의 표시는 다운로드로 보관하세요.'}
    function segments(id){const block=blocks.get(id),entry=marks[id],spans=entry?.text===block.text?entry.spans:[];
      const boundaries=[...new Set([0,block.text.length,...spans.flatMap(s=>[s.start,s.end])])].sort((a,b)=>a-b);
      return boundaries.slice(0,-1).map((start,i)=>({text:block.text.slice(start,boundaries[i+1]),styles:kinds.filter(kind=>spans.some(s=>s.kind===kind&&s.start<=start&&s.end>=boundaries[i+1]))}));
    }
    function render(){for(const [id,block] of blocks){block.node.replaceChildren();for(const part of segments(id)){if(!part.styles.length)block.node.append(document.createTextNode(part.text));else{const span=document.createElement('span');span.className=part.styles.map(s=>'mark-'+s).join(' ');span.textContent=part.text;block.node.append(span)}}}}
    function persist(){if(unreadable){status.textContent='자동 저장할 수 없습니다. 표시·메모 백업을 내려받으세요.';return false}try{localStorage.setItem(KEY,JSON.stringify(marks));return true}catch(_){status.textContent='표시 저장에 실패했습니다. 표시·메모 백업으로 보관하세요.';return false}}
    function remember(){history.push(clone(marks));if(history.length>30)history.shift();document.getElementById('undoMark').disabled=false}
    function offset(node,container,at){const range=document.createRange();range.selectNodeContents(node);range.setEnd(container,at);return range.toString().length}
    function readSelection(){const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return [];
      const range=selection.getRangeAt(0),found=[];
      for(const [id,block] of blocks){if(!block.node.getClientRects().length||!range.intersectsNode(block.node))continue;const start=block.node.contains(range.startContainer)?offset(block.node,range.startContainer,range.startOffset):0;const end=block.node.contains(range.endContainer)?offset(block.node,range.endContainer,range.endOffset):block.text.length;if(end>start)found.push({id,start,end})}return found;
    }
    function buttons(){toolbar.querySelectorAll('[data-mark]').forEach(b=>{b.disabled=!pending.length})}
    document.addEventListener('selectionchange',()=>{const found=readSelection();if(found.length){pending=found;status.textContent=`${found.reduce((n,s)=>n+s.end-s.start,0)}자 선택 · 적용할 표시를 누르세요.`;buttons()}});
    document.addEventListener('pointerdown',event=>{if(toolbar.contains(event.target))return;pending=[];buttons()});
    toolbar.querySelectorAll('button').forEach(b=>b.addEventListener('pointerdown',event=>event.preventDefault()));
    toolbar.querySelectorAll('[data-mark]').forEach(button=>button.onclick=()=>{
      if(!pending.length)return;remember();const kind=button.dataset.mark;
      for(const selected of pending){const block=blocks.get(selected.id);let spans=marks[selected.id]?.text===block.text?marks[selected.id].spans:[];
        if(kind==='clear'){spans=spans.flatMap(s=>{if(s.end<=selected.start||s.start>=selected.end)return [s];const kept=[];if(s.start<selected.start)kept.push({...s,end:selected.start});if(s.end>selected.end)kept.push({...s,start:selected.end});return kept})}
        else if(!spans.some(s=>s.kind===kind&&s.start===selected.start&&s.end===selected.end)){spans=[...spans,{start:selected.start,end:selected.end,kind}]}
        if(spans.length)marks[selected.id]={text:block.text,spans};else delete marks[selected.id];
      }
      render();window.getSelection()?.removeAllRanges();if(persist())status.textContent='표시 저장됨 · 같은 선택에 다른 표시를 더할 수 있습니다.';
    });
    document.getElementById('undoMark').onclick=()=>{if(!history.length)return;marks=history.pop();render();const saved=persist();pending=[];buttons();document.getElementById('undoMark').disabled=!history.length;if(saved)status.textContent='직전 표시 변경을 되돌렸습니다.'};
    render();buttons();
    return {valid,export:()=>clone(marks),import(value){if(!valid(value))throw Error('marks');remember();let skipped=0;for(const [id,b] of Object.entries(value)){if(blocks.get(id)?.text===b.text)marks[id]=clone(b);else skipped++}render();if(!persist())throw Error('storage');return skipped},html(node){const id=node.dataset.markBlock;if(!id)return escape(node.textContent);return segments(id).map(part=>{let text=escape(part.text);if(part.styles.includes('bold'))text='<strong>'+text+'</strong>';if(part.styles.includes('underline'))text='<u>'+text+'</u>';if(part.styles.includes('highlight'))text='<mark>'+text+'</mark>';return text}).join('')}};
  }};
})();
