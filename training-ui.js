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
(function(){
  // 홈의 TOP 5에서 ?type=유형 으로 들어오면 안내 띠를 보여준다(통과한 문제도 함께 표시됨).
  const type=(new URLSearchParams(location.search).get('type')||'').trim();if(!type)return;
  const host=document.querySelector('.toolbar,.dashboard')||document.querySelector('main')||document.body;
  const band=document.createElement('div');band.className='type-filter-band';
  band.innerHTML='<strong>유형 「'+type.replace(/</g,'&lt;')+'」 문제만 표시 중</strong> · 통과한 문제도 다시 풀 수 있게 함께 보입니다. <a href="'+location.pathname.split('/').pop()+'?view=all">전체 문제 보기</a> · <a href="오답_훈련센터.html">홈</a>';
  const style=document.createElement('style');style.textContent='.type-filter-band{margin:14px 0;padding:12px 16px;border:2px solid #f0c36d;border-radius:14px;background:#fff8e1;color:#6b4a00;font-weight:800;line-height:1.5}.type-filter-band a{color:#0d5eaa;font-weight:900}';
  document.head.appendChild(style);host.insertAdjacentElement(host.matches('.toolbar,.dashboard')?'beforebegin':'afterbegin',band);
})();
