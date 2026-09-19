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

  const title=overlay.querySelector('#accountSearchTitle');
  const help=overlay.querySelector('.account-search-help');
  const input=overlay.querySelector('.account-search-input');
  const list=overlay.querySelector('.account-search-list');
  let source=null,items=[],shown=[],active=0,kind='account',koRaw='',koBase='',koreanMode=true;
  const normalized=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\s()·._-]+/g,'');
  // 브라우저는 운영체제 입력기를 강제로 한글로 바꿀 수 없다. 대신 영문 자판으로
  // 입력된 두벌식 키를 검색창 안에서 즉시 한글로 조합한다.
  const C_MAP={r:'ㄱ',R:'ㄲ',s:'ㄴ',e:'ㄷ',E:'ㄸ',f:'ㄹ',a:'ㅁ',q:'ㅂ',Q:'ㅃ',t:'ㅅ',T:'ㅆ',d:'ㅇ',w:'ㅈ',W:'ㅉ',c:'ㅊ',z:'ㅋ',x:'ㅌ',v:'ㅍ',g:'ㅎ'};
  const V_MAP={k:'ㅏ',o:'ㅐ',i:'ㅑ',O:'ㅒ',j:'ㅓ',p:'ㅔ',u:'ㅕ',P:'ㅖ',h:'ㅗ',y:'ㅛ',n:'ㅜ',b:'ㅠ',m:'ㅡ',l:'ㅣ'};
  const CHO=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNG=['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONG=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const V_COMB={'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ','ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ','ㅡㅣ':'ㅢ'};
  const F_COMB={'ㄱㅅ':'ㄳ','ㄴㅈ':'ㄵ','ㄴㅎ':'ㄶ','ㄹㄱ':'ㄺ','ㄹㅁ':'ㄻ','ㄹㅂ':'ㄼ','ㄹㅅ':'ㄽ','ㄹㅌ':'ㄾ','ㄹㅍ':'ㄿ','ㄹㅎ':'ㅀ','ㅂㅅ':'ㅄ'};
  const isC=value=>CHO.includes(value),isV=value=>JUNG.includes(value);
  function romanToHangul(raw){const letters=[...raw].map(value=>C_MAP[value]||V_MAP[value]||value);let out='',i=0;while(i<letters.length){const value=letters[i];if(isC(value)&&isV(letters[i+1])){const cho=CHO.indexOf(value);let vowel=letters[i+1];i+=2;if(isV(letters[i])&&V_COMB[vowel+letters[i]]){vowel=V_COMB[vowel+letters[i]];i++}let final='';if(isC(letters[i])&&JONG.includes(letters[i])){const first=letters[i],second=letters[i+1],after=letters[i+2];if(isV(second)){}else if(isC(second)&&F_COMB[first+second]&&!isV(after)){final=F_COMB[first+second];i+=2}else{final=first;i++}}out+=String.fromCharCode(0xAC00+cho*588+JUNG.indexOf(vowel)*28+JONG.indexOf(final))}else if(isV(value)&&isV(letters[i+1])&&V_COMB[value+letters[i+1]]){out+=V_COMB[value+letters[i+1]];i+=2}else{out+=value;i++}}return out}
  function shuffle(values){
    const result=[...values];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}
    return result;
  }

  function closePicker(){
    if(overlay.hidden)return;
    overlay.hidden=true;
    const previous=source;
    source=null;
    if(previous)previous.focus({preventScroll:true});
  }

  function choose(item){
    if(!source||!item)return;
    const field=source;
    source.value=item.value;
    source.dispatchEvent(new Event('change',{bubbles:true}));
    closePicker();
    field.dispatchEvent(new Event(kind==='partner'?'partner-selected':'account-selected',{bubbles:true}));
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
    if(query)shown.sort((a,b)=>{
      const an=normalized(a.label),bn=normalized(b.label),ae=an===query,be=bn===query;
      return ae===be?a.label.localeCompare(b.label,'ko'):ae?-1:1;
    });
    active=0;
    list.replaceChildren();
    if(!shown.length){
      const empty=document.createElement('div');
      empty.className='account-search-empty';
      empty.textContent=kind==='partner'?'일치하는 거래처가 없습니다.':'일치하는 계정과목이 없습니다.';
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
    kind=select.classList.contains('partner')?'partner':'account';
    items=shuffle(Array.from(select.options).filter(option=>option.value&&!option.disabled).map(option=>({value:option.value,label:option.textContent.trim()})));
    koreanMode=items.some(item=>/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(item.label));
    title.textContent=kind==='partner'?'거래처 빠른 찾기':'계정과목 빠른 찾기';
    input.placeholder=kind==='partner'?'예: (주)초코, 보람은행':'예: 선납세금, 법인세비용';
    help.textContent=kind==='partner'?'글자를 입력하면 해당 거래처만 바로 표시됩니다.':'글자를 입력하면 해당 계정과목만 바로 표시됩니다.';
    koRaw=koreanMode&&/^[A-Za-z]+$/.test(prefill)?prefill:'';koBase=koRaw?'':prefill;
    input.value=koRaw?romanToHangul(koRaw):prefill;
    overlay.hidden=false;
    render();
    requestAnimationFrame(()=>input.focus());
  }

  document.addEventListener('pointerdown',event=>{
    const select=event.target.closest?.('select.account,select.partner');
    if(!select||select.disabled)return;
    event.preventDefault();
    openPicker(select);
  });
  document.addEventListener('keydown',event=>{
    const select=event.target.closest?.('select.account,select.partner');
    if(!select||select.disabled||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.key==='Enter'||event.key===' '||event.key==='ArrowDown'){
      event.preventDefault();
      openPicker(select);
    }else if(event.key.length===1){
      event.preventDefault();
      openPicker(select,event.key);
    }
  });
  input.addEventListener('input',()=>{const expected=koBase+romanToHangul(koRaw);if(input.value!==expected){koRaw='';koBase=input.value}render()});
  input.addEventListener('keydown',event=>{
    const atEnd=input.selectionStart===input.value.length&&input.selectionEnd===input.value.length;
    if(koreanMode&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&event.key==='Backspace'&&koRaw&&atEnd){event.preventDefault();koRaw=koRaw.slice(0,-1);input.value=koBase+romanToHangul(koRaw);input.dispatchEvent(new Event('input',{bubbles:true}))}
    else if(koreanMode&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&/^[A-Za-z]$/.test(event.key)&&atEnd){event.preventDefault();if(!koRaw)koBase=input.value;koRaw+=event.key;input.value=koBase+romanToHangul(koRaw);input.dispatchEvent(new Event('input',{bubbles:true}))}
    else if(event.key==='ArrowDown'){event.preventDefault();markActive(active+1)}
    else if(event.key==='ArrowUp'){event.preventDefault();markActive(active-1)}
    else if(event.key==='Enter'){event.preventDefault();choose(shown[active])}
    else if(event.key==='Escape'){event.preventDefault();closePicker()}
  });
  overlay.querySelector('.account-search-close').addEventListener('click',closePicker);
  overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)closePicker()});
  window.TrainingSearchPicker={open:openPicker,close:closePicker};
})();
