(function(){
  'use strict';
  if(new URLSearchParams(location.search).get('view')==='star'){
    location.replace('오답_훈련센터.html?weakness=1');return;
  }
  // 수동 별표 기능을 종료한다. 기존 학습·통과·채점 기록은 보존한다.
  ['theory','practical','voucher'].forEach(subject=>{
    const key='exam-20260914-'+subject;
    try{const raw=localStorage.getItem(key);if(!raw)return;const state=JSON.parse(raw);
      if(subject==='theory'){state.starred={};state.starredAt={}}
      else Object.values(state.cards||{}).forEach(card=>{card.starred=false;delete card.starredAt});
      localStorage.setItem(key,JSON.stringify(state));
    }catch(_){}
  });
  // 모바일(760px 이하)에서 상단 메뉴를 얇은 한 줄 바로 접고, 아래로 스크롤하면 숨긴다. PC에서는 아무것도 바꾸지 않는다.
  const MOBILE='(max-width:760px)';
  const nav=document.querySelector('.top-nav');if(!nav)return;
  const inner=nav.querySelector('.nav-inner')||nav;
  let specialLink=inner.querySelector('a.nav-star')||inner.querySelector('a.nav-link[href*="view=star"]');
  if(!specialLink){specialLink=document.createElement('a');specialLink.className='nav-link nav-star';(inner.querySelector('a[href="약점_분석_임시.html"]')||inner.querySelector('a:last-of-type'))?.before(specialLink)}
  specialLink.classList.add('nav-star');
  specialLink.href='오답_훈련센터.html?weakness=1';specialLink.textContent='특별훈련 · 반복 약점';specialLink.title='9월 26일 이후 훈련 중 오답 · 직접 제출 3회 이상 반복 약점';
  if(!inner.querySelector('.nav-concepts')){const link=document.createElement('a');link.className='nav-link nav-concepts';link.href='개념_정리.html';link.textContent='개념 정리';specialLink.after(link)}
  if(new URLSearchParams(location.search).has('weakness')){inner.querySelectorAll('.nav-link.active').forEach(x=>{x.classList.remove('active');x.removeAttribute('aria-current')});specialLink.classList.add('active');specialLink.setAttribute('aria-current','page')}
  const timedLink=document.createElement('a');timedLink.className='nav-link';timedLink.href='시간_훈련.html';timedLink.textContent='시간 훈련';
  const timedMode=new URLSearchParams(location.search).get('timed')==='1';
  if(timedMode){inner.querySelectorAll('.active').forEach(x=>{x.classList.remove('active');x.removeAttribute('aria-current')});timedLink.classList.add('active');timedLink.setAttribute('aria-current','page')}
  (inner.querySelector('a[href="약점_분석_임시.html"]')||inner.querySelector('a:last-of-type'))?.after(timedLink);
  const MENU_KEY=window.TrainingGitHub?.UI_SETTINGS_KEY||'exam-20260914-ui-settings';
  const MENU_DEFAULT=['home','theory','practical','voucher','special','concepts','analysis','timed'];
  function menuId(link){const href=link.getAttribute('href')||'';if(link.classList.contains('nav-star')||href.includes('weakness=1'))return'special';if(link.classList.contains('nav-concepts')||href.includes('개념_정리'))return'concepts';if(href.includes('이론_'))return'theory';if(href.includes('매입매출전표_'))return'voucher';if(href.includes('일반전표_'))return'practical';if(href.includes('약점_분석_'))return'analysis';if(href.includes('시간_훈련'))return'timed';if(href.includes('오답_훈련센터'))return'home';return''}
  function readMenuOrder(){try{return JSON.parse(localStorage.getItem(MENU_KEY)||'{}').menuOrder||[]}catch(_){return []}}
  function completeOrder(order,available){const allowed=new Set(available),seen=new Set(),result=[];[...(Array.isArray(order)?order:[]),...MENU_DEFAULT,...available].forEach(id=>{if(allowed.has(id)&&!seen.has(id)){seen.add(id);result.push(id)}});return result}
  let links=[...inner.querySelectorAll('a.nav-link')];if(!links.length)return;
  links.forEach(link=>{link.dataset.menuId=menuId(link)});
  let menuOrder=completeOrder(readMenuOrder(),links.map(link=>link.dataset.menuId));
  links.sort((a,b)=>menuOrder.indexOf(a.dataset.menuId)-menuOrder.indexOf(b.dataset.menuId));

  const style=document.createElement('style');
  style.textContent=`
    .question .qhead .tag{display:none!important}
    .star-one,.star-note{display:none!important}
    .nav-links{display:contents}
    .nav-menu-toggle,.nav-current{display:none}
    .nav-settings-button{flex:0 0 auto;width:40px;height:40px;padding:0;border:1px solid #cfd6df;border-radius:50%;background:#fff;color:#445263;font-size:20px;line-height:1;cursor:pointer}
    .nav-settings-button:hover,.nav-settings-button:focus-visible{border-color:#1877d2;background:#eaf5ff;color:#125fa8;outline:3px solid rgba(24,119,210,.18)}
    .menu-settings{width:min(520px,calc(100vw - 24px));max-height:min(720px,calc(100vh - 24px));padding:0;border:0;border-radius:18px;box-shadow:0 24px 70px rgba(18,42,66,.28);color:#243447}
    .menu-settings::backdrop{background:rgba(20,33,48,.42)}
    .menu-settings-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #dce3ea}.menu-settings-head h2{margin:0;font-size:1.2rem}.menu-settings-close{border:0;background:transparent;font-size:24px;cursor:pointer}
    .menu-settings-body{padding:17px 20px}.menu-settings-help{margin:0 0 13px;color:#647287;line-height:1.55}.menu-order-list{display:grid;gap:7px;margin:0;padding:0;list-style:none}.menu-order-item{display:grid;grid-template-columns:36px 1fr 42px 42px;gap:6px;align-items:center;padding:8px;border:1px solid #dce3ea;border-radius:11px;background:#f8fafc}.menu-order-number{text-align:center;color:#728095;font-weight:800}.menu-order-label{font-weight:900}.menu-order-button{height:36px;border:1px solid #cbd5df;border-radius:8px;background:#fff;color:#27445d;font-size:17px;cursor:pointer}.menu-order-button:disabled{opacity:.3;cursor:default}
    .menu-settings-actions{display:flex;justify-content:flex-end;gap:8px;padding:15px 20px;border-top:1px solid #dce3ea}.menu-settings-actions button{min-height:40px;padding:8px 15px;border:1px solid #cbd5df;border-radius:9px;background:#fff;font:inherit;font-weight:900;cursor:pointer}.menu-settings-actions .menu-save{border-color:#1877d2;background:#1877d2;color:#fff}
    .nav-link[href*="일반전표_"]:not(.nav-star){--menu-accent:#69b6df;--menu-soft:#e9f4fc;--menu-ink:#225f8e}
    .nav-link[href*="이론_"]{--menu-accent:#8b6edb;--menu-soft:#f1ecff;--menu-ink:#5e3fa4}
    .nav-link[href*="결산정리사항_"]{--menu-accent:#16a477;--menu-soft:#e9fbf3;--menu-ink:#116846}
    .nav-link[href*="매입매출전표_"]{--menu-accent:#e4892d;--menu-soft:#fff0d9;--menu-ink:#8b4d08}
    .nav-link[href*="일반전표_"]:not(.nav-star),.nav-link[href*="이론_"],.nav-link[href*="결산정리사항_"],.nav-link[href*="매입매출전표_"]{border-color:var(--menu-accent);background:var(--menu-soft);color:var(--menu-ink);transition:background .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease}
    .nav-link[href*="일반전표_"]:not(.nav-star):hover,.nav-link[href*="일반전표_"]:not(.nav-star):focus-visible,
    .nav-link[href*="이론_"]:hover,.nav-link[href*="이론_"]:focus-visible,
    .nav-link[href*="결산정리사항_"]:hover,.nav-link[href*="결산정리사항_"]:focus-visible,
    .nav-link[href*="매입매출전표_"]:hover,.nav-link[href*="매입매출전표_"]:focus-visible{border-color:var(--menu-accent);background:color-mix(in srgb,var(--menu-accent) 22%,white);color:var(--menu-ink);outline:3px solid color-mix(in srgb,var(--menu-accent) 28%,transparent);outline-offset:2px}
    .nav-link.active[href*="일반전표_"]:not(.nav-star),.nav-link.active[href*="이론_"],.nav-link.active[href*="결산정리사항_"],.nav-link.active[href*="매입매출전표_"]{border-color:var(--menu-accent);background:var(--menu-accent);color:#fff;box-shadow:0 4px 10px color-mix(in srgb,var(--menu-accent) 30%,transparent)}
    @media ${MOBILE}{
      .top-nav.nav-compact{transition:transform .22s ease}
      .top-nav.nav-compact.nav-hidden{transform:translateY(-100%)}
      .top-nav.nav-compact .nav-inner{position:relative;flex-wrap:nowrap;gap:8px;padding:6px 10px}
      .top-nav.nav-compact .nav-menu-toggle{display:block;flex:0 0 auto;min-height:42px;padding:6px 12px;border:2px solid #cfe1ef;border-radius:12px;background:#fff;color:#17324d;font:inherit;font-weight:900;cursor:pointer}
      .top-nav.nav-compact.open .nav-menu-toggle{border-color:#1877d2;background:#e9f5ff}
      .top-nav.nav-compact .nav-current{display:block;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:900;color:#17324d}
      .top-nav.nav-compact .nav-links{display:none;position:absolute;left:0;right:0;top:100%;flex-direction:column;gap:6px;padding:10px 12px 12px;background:#fff;border-bottom:2px solid #cfe1ef;box-shadow:0 14px 30px rgba(31,79,119,.18);z-index:30}
      .top-nav.nav-compact.open .nav-links{display:flex}
      .top-nav.nav-compact .nav-links .nav-link{width:100%;text-align:center;padding:11px 14px}
      .top-nav.nav-compact .nav-sync{width:auto;margin-left:0;flex:0 0 auto}
      .top-nav.nav-compact .nav-sync-button{flex:0 0 auto;min-width:44px;padding:6px 10px;font-size:.85em}
      .top-nav.nav-compact .nav-settings-button{width:38px;height:38px;font-size:19px}
      .menu-order-item{grid-template-columns:30px 1fr 40px 40px}.menu-settings-body{padding:14px}.menu-settings-actions{padding:12px 14px;flex-wrap:wrap}.menu-settings-actions button{flex:1}
      .toolbar,.dashboard{position:static!important}
    }`;
  document.head.appendChild(style);

  const wrap=document.createElement('div');wrap.className='nav-links';
  inner.insertBefore(wrap,links[0]);links.forEach(link=>wrap.appendChild(link));
  const toggle=document.createElement('button');toggle.type='button';toggle.className='nav-menu-toggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','메뉴 열기');toggle.textContent='☰ 메뉴';
  const current=document.createElement('span');current.className='nav-current';
  const active=links.find(link=>link.classList.contains('active')||link.getAttribute('aria-current')==='page');
  current.textContent=active?active.textContent.trim():'';
  inner.insertBefore(toggle,wrap);inner.insertBefore(current,wrap);

  const settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.className='nav-settings-button';settingsButton.setAttribute('aria-label','메뉴 순서 설정');settingsButton.title='메뉴 순서 설정';settingsButton.textContent='⚙';inner.insertBefore(settingsButton,wrap.nextSibling);
  const settings=document.createElement('dialog');settings.className='menu-settings';settings.setAttribute('aria-labelledby','menuSettingsTitle');settings.innerHTML='<div class="menu-settings-head"><h2 id="menuSettingsTitle">메뉴 순서 설정</h2><button class="menu-settings-close" type="button" aria-label="닫기">×</button></div><div class="menu-settings-body"><p class="menu-settings-help">자주 쓰는 메뉴를 위로 올리세요. 저장한 순서는 모든 훈련 화면에 적용되며 동기화할 때 다른 기기에도 전달됩니다.</p><ol class="menu-order-list"></ol></div><div class="menu-settings-actions"><button class="menu-default" type="button">기본 순서</button><button class="menu-cancel" type="button">취소</button><button class="menu-save" type="button">저장</button></div>';document.body.append(settings);
  const orderList=settings.querySelector('.menu-order-list');let draft=[];
  function reorderMenu(order){menuOrder=completeOrder(order,links.map(link=>link.dataset.menuId));menuOrder.forEach(id=>{const link=links.find(item=>item.dataset.menuId===id);if(link)wrap.append(link)})}
  function renderOrder(){orderList.replaceChildren();draft.forEach((id,index)=>{const link=links.find(item=>item.dataset.menuId===id),item=document.createElement('li');item.className='menu-order-item';item.dataset.menuId=id;item.innerHTML=`<span class="menu-order-number">${index+1}</span><span class="menu-order-label"></span><button class="menu-order-button" type="button" data-move="up" aria-label="위로 이동">↑</button><button class="menu-order-button" type="button" data-move="down" aria-label="아래로 이동">↓</button>`;item.querySelector('.menu-order-label').textContent=link?.textContent.trim()||id;item.querySelector('[data-move="up"]').disabled=index===0;item.querySelector('[data-move="down"]').disabled=index===draft.length-1;orderList.append(item)})}
  function openSettings(){draft=[...menuOrder];renderOrder();if(typeof settings.showModal==='function')settings.showModal();else settings.setAttribute('open','')}
  function closeSettings(){if(typeof settings.close==='function')settings.close();else settings.removeAttribute('open')}
  settingsButton.addEventListener('click',openSettings);
  orderList.addEventListener('click',event=>{const button=event.target.closest('[data-move]');if(!button)return;const item=button.closest('.menu-order-item'),index=draft.indexOf(item.dataset.menuId),next=button.dataset.move==='up'?index-1:index+1;if(index<0||next<0||next>=draft.length)return;[draft[index],draft[next]]=[draft[next],draft[index]];renderOrder();orderList.children[next]?.querySelector(`[data-move="${button.dataset.move}"]`)?.focus()});
  settings.querySelector('.menu-default').addEventListener('click',()=>{draft=completeOrder(MENU_DEFAULT,links.map(link=>link.dataset.menuId));renderOrder()});
  settings.querySelector('.menu-cancel').addEventListener('click',closeSettings);settings.querySelector('.menu-settings-close').addEventListener('click',closeSettings);
  settings.querySelector('.menu-save').addEventListener('click',()=>{reorderMenu(draft);localStorage.setItem(MENU_KEY,JSON.stringify({menuOrder,updatedAt:new Date().toISOString()}));closeSettings()});
  settings.addEventListener('click',event=>{if(event.target===settings){const rect=settings.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeSettings()}});
  window.addEventListener('training-ui-settings',event=>reorderMenu(event.detail?.menuOrder||readMenuOrder()));
  window.addEventListener('storage',event=>{if(event.key===MENU_KEY)reorderMenu(readMenuOrder())});

  function setOpen(open){nav.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');if(open)nav.classList.remove('nav-hidden')}
  toggle.addEventListener('click',()=>setOpen(!nav.classList.contains('open')));
  wrap.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false)});
  document.addEventListener('click',event=>{if(nav.classList.contains('open')&&!nav.contains(event.target))setOpen(false)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false)});

  const media=window.matchMedia(MOBILE);
  let lastY=window.scrollY;
  function onScroll(){
    if(!media.matches||nav.classList.contains('open'))return;
    const y=window.scrollY,delta=y-lastY;
    if(y<40)nav.classList.remove('nav-hidden');
    else if(delta>8)nav.classList.add('nav-hidden');
    else if(delta<-8)nav.classList.remove('nav-hidden');
    lastY=y;
  }
  function apply(){
    nav.classList.toggle('nav-compact',media.matches);
    if(!media.matches){nav.classList.remove('nav-hidden');setOpen(false)}
    window.dispatchEvent(new Event('resize'));
  }
  media.addEventListener?media.addEventListener('change',apply):media.addListener(apply);
  window.addEventListener('scroll',onScroll,{passive:true});
  apply();
})();
(function(){
  // 홈의 TOP 5에서 ?type=유형 으로 들어오면 안내 띠를 보여준다(통과한 문제도 함께 표시됨).
  const type=(new URLSearchParams(location.search).get('type')||'').trim();if(!type)return;
  const host=document.querySelector('.toolbar,.dashboard')||document.querySelector('main')||document.body;
  const band=document.createElement('div');band.className='type-filter-band';
  band.innerHTML='<strong>유형 「'+type.replace(/</g,'&lt;')+'」 문제만 표시 중</strong> · 통과한 문제도 다시 풀 수 있게 함께 보입니다. <a href="'+location.pathname.split('/').pop()+'?view=all">전체 문제 보기</a> · <a href="오답_훈련센터.html">홈</a>';
  const style=document.createElement('style');style.textContent='.type-filter-band{margin:14px 0;padding:12px 16px;border:2px solid #f0c36d;border-radius:14px;background:#fff8e1;color:#6b4a00;font-weight:800;line-height:1.5}.type-filter-band a{color:#0d5eaa;font-weight:900}';
  document.head.appendChild(style);host.insertAdjacentElement(host.matches('.toolbar,.dashboard')?'beforebegin':'afterbegin',band);
})();
