(function(){
  'use strict';

  const style=document.createElement('style');
  style.textContent=`
    .account-search-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,42,73,.35)}
    .account-search-overlay[hidden]{display:none}
    .account-search-dialog{width:min(520px,100%);max-height:min(720px,88vh);display:flex;flex-direction:column;overflow:hidden;border:2px solid #82b8e8;border-radius:18px;background:#fff;box-shadow:0 20px 55px rgba(17,55,92,.28);font-family:inherit;color:#122c4c}
    .account-search-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px 10px}
    .account-search-head strong{font-size:20px}
    .account-search-close{min-width:42px;min-height:38px;border:1px solid #bfd5e8;border-radius:10px;background:#f5faff;color:#24486d;font-size:22px;cursor:pointer}
    .account-search-input{box-sizing:border-box;width:calc(100% - 32px);margin:0 16px;padding:13px 15px;border:2px solid #2d83d5;border-radius:11px;background:#fff;font:inherit;font-size:19px;color:#102f50;outline:none}
    .account-search-input:focus{box-shadow:0 0 0 4px rgba(45,131,213,.16)}
    .account-search-help{margin:8px 18px 10px;color:#55718c;font-size:14px}
    .account-search-list{margin:0 12px 14px;padding:4px;overflow:auto;border-top:1px solid #d8e6f2}
    .account-search-option{display:block;width:100%;padding:11px 13px;border:0;border-radius:9px;background:#fff;color:#183b60;text-align:left;font:inherit;font-size:18px;cursor:pointer}
    .account-search-option:hover,.account-search-option.active{background:#dff0ff;color:#063f78;font-weight:700}
    .account-search-empty{padding:22px 12px;color:#a33;text-align:center;font-size:17px}
    @media(max-width:600px){.account-search-overlay{align-items:flex-start;padding:10px}.account-search-dialog{max-height:94vh}.account-search-option{padding:13px;font-size:17px}}
  `;
  document.head.appendChild(style);

  const overlay=document.createElement('div');
  overlay.className='account-search-overlay';
  overlay.hidden=true;
  overlay.innerHTML=`<section class="account-search-dialog" role="dialog" aria-modal="true" aria-labelledby="accountSearchTitle">
    <div class="account-search-head"><strong id="accountSearchTitle">계정과목 빠른 찾기</strong><button type="button" class="account-search-close" aria-label="닫기">×</button></div>
    <input type="search" class="account-search-input" lang="ko" autocomplete="off" placeholder="예: 선납세금, 법인세비용">
    <div class="account-search-help">글자를 입력하면 해당 계정과목만 바로 표시됩니다.</div>
    <div class="account-search-list" role="listbox"></div>
  </section>`;
  document.body.appendChild(overlay);

  const input=overlay.querySelector('.account-search-input');
  const list=overlay.querySelector('.account-search-list');
  let source=null,items=[],shown=[],active=0;
  const normalized=value=>String(value||'').toLocaleLowerCase('ko-KR').replace(/\s+/g,'');

  function closePicker(){
    if(overlay.hidden)return;
    overlay.hidden=true;
    const previous=source;
    source=null;
    if(previous)previous.focus({preventScroll:true});
  }

  function choose(item){
    if(!source||!item)return;
    source.value=item.value;
    source.dispatchEvent(new Event('change',{bubbles:true}));
    closePicker();
  }

  function markActive(next){
    if(!shown.length)return;
    active=Math.max(0,Math.min(next,shown.length-1));
    list.querySelectorAll('.account-search-option').forEach((button,index)=>button.classList.toggle('active',index===active));
    list.querySelectorAll('.account-search-option')[active]?.scrollIntoView({block:'nearest'});
  }

  function render(){
    const query=normalized(input.value);
    const starts=[],contains=[];
    items.forEach(item=>{
      const name=normalized(item.label);
      if(!query||name.startsWith(query))starts.push(item);
      else if(name.includes(query))contains.push(item);
    });
    shown=starts.concat(contains);
    active=0;
    list.replaceChildren();
    if(!shown.length){
      const empty=document.createElement('div');
      empty.className='account-search-empty';
      empty.textContent='일치하는 계정과목이 없습니다.';
      list.appendChild(empty);
      return;
    }
    shown.forEach((item,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='account-search-option'+(index===0?' active':'');
      button.textContent=item.label;
      button.setAttribute('role','option');
      button.addEventListener('click',()=>choose(item));
      list.appendChild(button);
    });
  }

  function openPicker(select,prefill=''){
    if(select.disabled)return;
    source=select;
    items=Array.from(select.options).filter(option=>option.value&&!option.disabled).map(option=>({value:option.value,label:option.textContent.trim()}));
    input.value=prefill;
    overlay.hidden=false;
    render();
    requestAnimationFrame(()=>input.focus());
  }

  document.addEventListener('pointerdown',event=>{
    const select=event.target.closest?.('select.account');
    if(!select||select.disabled)return;
    event.preventDefault();
    openPicker(select);
  });
  document.addEventListener('keydown',event=>{
    const select=event.target.closest?.('select.account');
    if(!select||select.disabled||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.key==='Enter'||event.key===' '||event.key==='ArrowDown'){
      event.preventDefault();
      openPicker(select);
    }else if(event.key.length===1){
      event.preventDefault();
      openPicker(select,event.key);
    }
  });
  input.addEventListener('input',render);
  input.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'){event.preventDefault();markActive(active+1)}
    else if(event.key==='ArrowUp'){event.preventDefault();markActive(active-1)}
    else if(event.key==='Enter'){event.preventDefault();choose(shown[active])}
    else if(event.key==='Escape'){event.preventDefault();closePicker()}
  });
  overlay.querySelector('.account-search-close').addEventListener('click',closePicker);
  overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)closePicker()});
})();
