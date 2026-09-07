(function(){
  'use strict';
  // 모바일(760px 이하)에서 상단 메뉴를 얇은 한 줄 바로 접고, 아래로 스크롤하면 숨긴다. PC에서는 아무것도 바꾸지 않는다.
  const MOBILE='(max-width:760px)';
  const nav=document.querySelector('.top-nav');if(!nav)return;
  const inner=nav.querySelector('.nav-inner')||nav;
  const links=[...inner.querySelectorAll('a.nav-link')];if(!links.length)return;

  const style=document.createElement('style');
  style.textContent=`
    .nav-links{display:contents}
    .nav-menu-toggle,.nav-current{display:none}
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
