(function(global){
  'use strict';

  // ── 저장소 설정 ──────────────────────────────────────────────────────────────
  const OWNER='Park-hyojoon';
  const REPOSITORY='tax-accounting-learning-sync';
  const BRANCH='main';
  const PROGRAM_OWNER='Park-hyojoon';
  const PROGRAM_REPOSITORY='tax-accounting-wrong-answer-center';
  const PROGRAM_BRANCH='main';
  const API_ROOT=`https://api.github.com/repos/${OWNER}/${REPOSITORY}`;
  const STATE_FILE='sync/learning-state.json';
  const HELPER_URL=(()=>{try{return localStorage.getItem('tax-accounting-helper-url')||'http://127.0.0.1:8790'}catch(error){return 'http://127.0.0.1:8790'}})();

  const SESSION_TOKEN_KEY='tax-accounting-github-token-session';
  const LOCAL_TOKEN_KEY='tax-accounting-github-token';
  const DEVICE_ID_KEY='tax-accounting-sync-device-id';
  const DEVICE_NAME_KEY='tax-accounting-sync-device-name';
  const SYNC_MESSAGE_KEY='tax-accounting-sync-message';
  const CACHE_BUST_KEY='tax-accounting-cache-bust';
  const LAST_SYNC_KEY='tax-accounting-last-sync';

  // 학습 화면별 localStorage 키. 훈련센터 홈과 학습상태 동기화가 함께 사용한다.
  const SOURCES=Object.freeze({
    practical:{label:'일반전표',file:'일반전표_기본연습_24문제.html',key:'tax-accounting-practical-journal-24-v2'},
    theory:{label:'이론',file:'이론_오답응용_5문제.html',key:'tax-accounting-theory-wrong-2026-09-01-v1'},
    closing:{label:'결산',file:'결산정리사항_연습_7문제.html',key:'closing-adjustment-practice-7-v1'},
    voucher:{label:'매입매출전표',file:'매입매출전표_오답연습_3문제.html',key:'purchase-sales-voucher-wrong-2026-09-02-v1'}
  });

  // ── 토큰 (모바일용) ──────────────────────────────────────────────────────────
  function readStorage(storage,key){try{return storage.getItem(key)||''}catch(error){return ''}}
  function writeStorage(storage,key,value){try{if(value)storage.setItem(key,value);else storage.removeItem(key)}catch(error){}}
  function getSessionToken(){return readStorage(global.sessionStorage,SESSION_TOKEN_KEY)||readStorage(global.localStorage,LOCAL_TOKEN_KEY)}
  function setSessionToken(token,{remember=true}={}){
    const clean=String(token||'').trim();
    writeStorage(global.sessionStorage,SESSION_TOKEN_KEY,remember?'':clean);
    writeStorage(global.localStorage,LOCAL_TOKEN_KEY,remember?clean:'');
    return clean;
  }
  function clearToken(){writeStorage(global.sessionStorage,SESSION_TOKEN_KEY,'');writeStorage(global.localStorage,LOCAL_TOKEN_KEY,'')}
  function hasToken(){return Boolean(getSessionToken())}
  function isTokenRemembered(){return Boolean(readStorage(global.localStorage,LOCAL_TOKEN_KEY))}

  // ── 기기 정보 ────────────────────────────────────────────────────────────────
  function getDeviceId(){
    try{
      let id=localStorage.getItem(DEVICE_ID_KEY);
      if(!id){id=(global.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`);localStorage.setItem(DEVICE_ID_KEY,id)}
      return id;
    }catch(error){return `device-${Date.now()}`}
  }
  function isMobileDevice(){return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)}
  function defaultDeviceName(){return isMobileDevice()?'모바일':'PC'}
  function getDeviceName(){return readStorage(global.localStorage,DEVICE_NAME_KEY)||defaultDeviceName()}
  function setDeviceName(name){const clean=String(name||'').trim()||defaultDeviceName();writeStorage(global.localStorage,DEVICE_NAME_KEY,clean);return clean}

  // ── 공통 유틸 ────────────────────────────────────────────────────────────────
  function encodePath(path){return String(path).split('/').map(encodeURIComponent).join('/')}
  function utf8ToBase64(text){
    const bytes=new TextEncoder().encode(String(text)),parts=[];
    for(let i=0;i<bytes.length;i+=0x8000)parts.push(String.fromCharCode(...bytes.subarray(i,i+0x8000)));
    return btoa(parts.join(''));
  }
  function base64ToUtf8(value){
    const binary=atob(String(value||'').replace(/\s/g,'')),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function fetchWithTimeout(url,options={},ms=8000){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
    return fetch(url,{...options,signal:controller.signal}).finally(()=>clearTimeout(timer));
  }
  function localDateKey(date=new Date()){
    const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  // ── GitHub API (모바일 또는 도우미가 꺼진 PC) ────────────────────────────────
  async function api(path,{method='GET',body,token=getSessionToken()}={}){
    const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    if(token)headers.Authorization=`Bearer ${token}`;
    if(body!==undefined)headers['Content-Type']='application/json';
    let response;
    try{response=await fetchWithTimeout(`${API_ROOT}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)},20000)}
    catch(error){throw new Error('GitHub에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.')}
    if(response.status===404)return null;
    let data=null;try{data=await response.json()}catch(error){}
    if(!response.ok){
      const detail=data?.message||`GitHub 요청 실패 (${response.status})`;
      if(response.status===401)throw new Error(`${detail}. 토큰이 만료되었거나 잘못되었습니다. 홈에서 토큰을 다시 연결해 주세요.`);
      if(response.status===409){const error=new Error('다른 기기가 먼저 저장했습니다. 다시 합칩니다.');error.conflict=true;throw error}
      throw new Error(detail);
    }
    return data;
  }
  async function connect(token,{remember=true}={}){
    const clean=setSessionToken(token,{remember});
    if(!clean)throw new Error('GitHub 연결용 토큰을 입력하세요.');
    try{const repository=await api('');if(!repository)throw new Error('학습기록 저장소를 찾지 못했습니다.');return repository}
    catch(error){clearToken();throw error}
  }
  async function getFile(path){
    const data=await api(`/contents/${encodePath(path)}?ref=${encodeURIComponent(BRANCH)}`);
    if(!data)return null;
    if(Array.isArray(data)||data.type!=='file')throw new Error('GitHub 학습기록 경로가 파일이 아닙니다.');
    return {text:base64ToUtf8(data.content),sha:data.sha,path:data.path,updatedUrl:data.html_url};
  }
  async function putFile(path,text,message,options={}){
    if(!hasToken())throw new Error('먼저 오답 훈련센터 홈에서 GitHub 토큰을 연결하세요.');
    const hasExpectedSha=Object.prototype.hasOwnProperty.call(options,'expectedSha');
    const existing=hasExpectedSha?null:await getFile(path),body={message,content:utf8ToBase64(text),branch:BRANCH};
    const sha=hasExpectedSha?options.expectedSha:existing?.sha;if(sha)body.sha=sha;
    return api(`/contents/${encodePath(path)}`,{method:'PUT',body});
  }
  async function getSyncState(){
    const file=await getFile(STATE_FILE);if(!file)return null;
    let json=null;try{json=JSON.parse(file.text)}catch(error){json=null}
    return {...file,json};
  }
  async function putSyncState(payload,expectedSha){return putFile(STATE_FILE,JSON.stringify(payload,null,2)+'\n',`학습상태 동기화: ${new Date().toISOString()} ${getDeviceName()}`,{expectedSha:expectedSha||null})}

  // ── PC 동기화 도우미 ─────────────────────────────────────────────────────────
  function helperPossible(){return location.protocol!=='https:'}
  async function detectHelper(){
    if(!helperPossible())return null;
    try{
      const response=await fetchWithTimeout(`${HELPER_URL}/api/status`,{cache:'no-store'},2500);
      const data=await response.json();
      return data?.helper==='tax-accounting-sync-helper'?data:null;
    }catch(error){return null}
  }
  async function helperPost(path,body={}){
    let response;
    try{response=await fetchWithTimeout(`${HELPER_URL}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},180000)}
    catch(error){throw new Error('PC 동기화 도우미와 연결이 끊어졌습니다. 바탕화면의 「오답훈련센터 시작」을 다시 실행해 주세요.')}
    let data=null;try{data=await response.json()}catch(error){}
    if(!response.ok||!data?.ok){
      const error=new Error(data?.message||`도우미 요청 실패 (${response.status})`);
      if(response.status===409||data?.conflict)error.conflict=true;
      throw error;
    }
    return data;
  }

  // ── 학습상태 합치기 (기기별 고유 이력을 모두 보존) ───────────────────────────
  const PRACTICAL_STATE_VERSION='general-journal-27-v1';
  const PRACTICAL_OLD_TO_NEW={4:0,6:1,8:2,9:3,10:4,11:5,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,24:18,25:19,26:20,27:21,28:22,29:23,30:24,31:25,32:26};

  function normalizeState(sourceName,value){
    const source=value&&typeof value==='object'?value:{};
    let normalized={...source};
    if(sourceName==='practical'){
      const cards={};
      if(source.schemaVersion===PRACTICAL_STATE_VERSION){
        Object.entries(source.cards||{}).forEach(([index,card])=>{
          const numberIndex=Number(index);
          if(!Number.isInteger(numberIndex)||numberIndex<0)return;
          cards[numberIndex]={...card};delete cards[numberIndex].note;
        });
      }else{
        Object.entries(PRACTICAL_OLD_TO_NEW).forEach(([oldIndex,newIndex])=>{
          const card=source.cards?.[oldIndex];if(!card)return;
          cards[newIndex]={...card};delete cards[newIndex].note;
        });
      }
      normalized={...source,schemaVersion:PRACTICAL_STATE_VERSION,cards};
      if(typeof normalized.fileName==='string')normalized.fileName=normalized.fileName.replace('일반전표_33문제','일반전표_27문제');
    }else if(sourceName==='theory'){
      normalized={...source};delete normalized.notes;
    }else{
      const cards={};Object.entries(source.cards||{}).forEach(([index,card])=>{cards[index]={...card};delete cards[index].note});
      normalized={...source,cards};
    }
    return normalized;
  }
  function readState(key){
    try{
      const raw=JSON.parse(localStorage.getItem(key)||'{}')||{};
      const sourceName=Object.keys(SOURCES).find(name=>SOURCES[name].key===key);
      const normalized=sourceName?normalizeState(sourceName,raw):raw;
      if(sourceName&&JSON.stringify(normalized)!==JSON.stringify(raw))localStorage.setItem(key,JSON.stringify(normalized));
      return normalized;
    }catch(error){return {}}
  }
  function writeState(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(error){return false}}
  function correctInHistory(history){return Array.isArray(history)&&history.some(item=>item&&item.correct===true)}
  function number(value){const n=Number(value);return Number.isFinite(n)?n:0}
  function uniqueHistory(first,second){
    const seen=new Set();
    return [...(Array.isArray(first)?first:[]),...(Array.isArray(second)?second:[])].filter(item=>{
      const key=JSON.stringify(item);if(seen.has(key))return false;seen.add(key);return true;
    }).sort((a,b)=>Date.parse(a?.at||0)-Date.parse(b?.at||0));
  }
  function eventTime(value){const time=Date.parse(value||'');return Number.isFinite(time)?time:0}
  function latestEventIso(...values){
    let best='',bestTime=0;values.flat().forEach(value=>{const time=eventTime(value);if(time>bestTime){best=value;bestTime=time}});return best;
  }
  function resolveTrainingFlags(a,b,history,aUpdated,bUpdated){
    const correctTimes=history.filter(item=>item?.correct===true).map(item=>item.at);
    const passedAt=latestEventIso(a.passedAt,b.passedAt,correctTimes);
    const archivedAt=latestEventIso(a.archivedAt,b.archivedAt);
    const restoredAt=latestEventIso(a.trainingCenterRestored?a.restoredAt:'',b.trainingCenterRestored?b.restoredAt:'');
    let passedTime=eventTime(passedAt),archivedTime=eventTime(archivedAt),restoredTime=eventTime(restoredAt);
    if(!passedTime){if(a.passed||a.correct===true)passedTime=eventTime(aUpdated)||1;if(b.passed||b.correct===true)passedTime=Math.max(passedTime,eventTime(bUpdated)||1)}
    if(!archivedTime){if(a.archived)archivedTime=eventTime(aUpdated)||1;if(b.archived)archivedTime=Math.max(archivedTime,eventTime(bUpdated)||1)}
    if(!restoredTime){if(a.trainingCenterRestored)restoredTime=eventTime(aUpdated)||1;if(b.trainingCenterRestored)restoredTime=Math.max(restoredTime,eventTime(bUpdated)||1)}
    const restoreWins=restoredTime>0&&restoredTime>=passedTime&&restoredTime>=archivedTime;
    return{passed:restoreWins?false:Boolean(passedTime||a.passed||b.passed||a.correct===true||b.correct===true||correctInHistory(history)),archived:restoreWins?false:Boolean(archivedTime||a.archived||b.archived),trainingCenterRestored:restoreWins,passedAt,archivedAt,restoredAt};
  }
  function mergeCard(current,incoming,incomingNewer,currentUpdated,incomingUpdated){
    const a=(current&&typeof current==='object')?current:{},b=(incoming&&typeof incoming==='object')?incoming:{};
    const merged={...(incomingNewer?a:b),...(incomingNewer?b:a)};
    merged.history=uniqueHistory(a.history,b.history);
    merged.attempts=Math.max(number(a.attempts),number(b.attempts),merged.history.length);
    merged.wrongCount=Math.max(number(a.wrongCount),number(b.wrongCount),merged.history.filter(item=>item?.correct===false).length);
    const flags=resolveTrainingFlags(a,b,merged.history,currentUpdated,incomingUpdated);
    merged.passed=flags.passed;merged.archived=flags.archived;
    if(flags.passedAt)merged.passedAt=flags.passedAt;if(flags.archivedAt)merged.archivedAt=flags.archivedAt;if(flags.restoredAt)merged.restoredAt=flags.restoredAt;
    if(flags.trainingCenterRestored)merged.trainingCenterRestored=true;else delete merged.trainingCenterRestored;
    delete merged.note;
    return merged;
  }
  function mergeMap(current,incoming,incomingNewer){return {...(incomingNewer?current:incoming),...(incomingNewer?incoming:current)}}
  function mergeTheory(current,incoming,incomingNewer){
    const merged={...(incomingNewer?current:incoming),...(incomingNewer?incoming:current)};
    const ids=new Set([...Object.keys(current.history||{}),...Object.keys(incoming.history||{}),...Object.keys(current.answers||{}),...Object.keys(incoming.answers||{})]);
    merged.answers=mergeMap(current.answers||{},incoming.answers||{},incomingNewer);
    merged.checked=mergeMap(current.checked||{},incoming.checked||{},incomingNewer);
    delete merged.notes;
    merged.history={};merged.attempts={};merged.passed={};merged.archived={};
    merged.passedAt=mergeMap(current.passedAt||{},incoming.passedAt||{},incomingNewer);
    merged.archivedAt=mergeMap(current.archivedAt||{},incoming.archivedAt||{},incomingNewer);
    merged.restoredAt=mergeMap(current.restoredAt||{},incoming.restoredAt||{},incomingNewer);
    merged.trainingCenterRestored=mergeMap(current.trainingCenterRestored||{},incoming.trainingCenterRestored||{},incomingNewer);
    ids.forEach(id=>{
      const history=uniqueHistory(current.history?.[id],incoming.history?.[id]);
      merged.history[id]=history;
      merged.attempts[id]=Math.max(number(current.attempts?.[id]),number(incoming.attempts?.[id]),history.length);
      const flags=resolveTrainingFlags(
        {passed:current.passed?.[id],correct:current.checked?.[id],archived:current.archived?.[id],trainingCenterRestored:current.trainingCenterRestored?.[id],passedAt:current.passedAt?.[id],archivedAt:current.archivedAt?.[id],restoredAt:current.restoredAt?.[id]},
        {passed:incoming.passed?.[id],correct:incoming.checked?.[id],archived:incoming.archived?.[id],trainingCenterRestored:incoming.trainingCenterRestored?.[id],passedAt:incoming.passedAt?.[id],archivedAt:incoming.archivedAt?.[id],restoredAt:incoming.restoredAt?.[id]},
        history,current.updatedAt,incoming.updatedAt
      );
      merged.passed[id]=flags.passed;merged.archived[id]=flags.archived;
      if(flags.passedAt)merged.passedAt[id]=flags.passedAt;if(flags.archivedAt)merged.archivedAt[id]=flags.archivedAt;if(flags.restoredAt)merged.restoredAt[id]=flags.restoredAt;
      if(flags.trainingCenterRestored)merged.trainingCenterRestored[id]=true;else delete merged.trainingCenterRestored[id];
    });
    return merged;
  }
  function mergeState(sourceName,current,incoming){
    const a=normalizeState(sourceName,(current&&typeof current==='object')?current:{}),b=normalizeState(sourceName,(incoming&&typeof incoming==='object')?incoming:{});
    const incomingNewer=Date.parse(b.updatedAt||0)>=Date.parse(a.updatedAt||0);
    if(sourceName==='theory')return mergeTheory(a,b,incomingNewer);
    const merged={...(incomingNewer?a:b),...(incomingNewer?b:a)},cards={};
    const indexes=new Set([...Object.keys(a.cards||{}),...Object.keys(b.cards||{})]);
    indexes.forEach(index=>{cards[index]=mergeCard(a.cards?.[index],b.cards?.[index],incomingNewer,a.updatedAt,b.updatedAt)});
    merged.cards=cards;merged.startedAt=a.startedAt&&b.startedAt?(Date.parse(a.startedAt)<=Date.parse(b.startedAt)?a.startedAt:b.startedAt):(a.startedAt||b.startedAt);
    merged.updatedAt=new Date().toISOString();return normalizeState(sourceName,merged);
  }
  function backupPayload(){
    const states={};Object.entries(SOURCES).forEach(([name,source])=>{states[name]=readState(source.key)});
    return {format:'tax-accounting-training-center-backup',version:1,exportedAt:new Date().toISOString(),states};
  }
  // 전달받은 states를 현재 브라우저 기록과 합쳐 저장한다. 실제로 바뀐 분야 수를 돌려준다.
  function mergeStatesIntoLocal(states){
    if(!states||typeof states!=='object')return 0;
    let changed=0;
    Object.entries(SOURCES).forEach(([name,source])=>{
      if(!states[name])return;
      const local=readState(source.key),merged=mergeState(name,local,states[name]);
      const baseline=stripUpdatedAt(JSON.stringify(mergeState(name,local,{}))),after=stripUpdatedAt(JSON.stringify(merged));
      if(!writeState(source.key,merged))throw new Error(`${source.label} 기록을 이 브라우저에 저장하지 못해 안전하게 중단했습니다.`);
      if(baseline!==after)changed++;
    });
    return changed;
  }
  function stripUpdatedAt(text){return String(text).replace(/"updatedAt":"[^"]*"/g,'')}
  function buildSyncPayload(){
    const payload=backupPayload();payload.syncedAt=new Date().toISOString();payload.device={id:getDeviceId(),name:getDeviceName()};
    return payload;
  }

  // ── 오늘 학습기록 Markdown 저장 ──────────────────────────────────────────────
  async function canSaveRemote(){return Boolean(await detectHelper())||hasToken()}
  async function saveDailyRecord(source,date,markdown){
    const deviceId=getDeviceId().replace(/[^a-zA-Z0-9-]/g,'').slice(0,12),path=`records/${date}/${source}-${deviceId}.md`;
    if(await detectHelper())return helperPost('/api/record',{path,content:String(markdown)});
    return putFile(path,markdown,`학습기록 저장: ${date} ${getDeviceName()} ${source}`);
  }

  // ── 한 번 누르면 끝나는 동기화 ──────────────────────────────────────────────
  function setSyncMessage(text){writeStorage(global.sessionStorage,SYNC_MESSAGE_KEY,text)}
  function consumeSyncMessage(){const text=readStorage(global.sessionStorage,SYNC_MESSAGE_KEY);writeStorage(global.sessionStorage,SYNC_MESSAGE_KEY,'');return text}
  function lastSyncLabel(){
    const at=readStorage(global.localStorage,LAST_SYNC_KEY);if(!at)return '';
    const date=new Date(at);if(Number.isNaN(date.getTime()))return '';
    return `${localDateKey(date)} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }
  async function syncEverything({setStatus=()=>{},setBusy=()=>{},onNeedToken=null}={}){
    setBusy(true);
    const summary=[];
    try{
      setStatus('동기화를 시작합니다…');
      const helper=await detectHelper();
      let program=null;
      if(helper){
        setStatus('PC의 새 문제·프로그램과 GitHub를 맞추는 중…');
        program=await helperPost('/api/sync/program');
        summary.push(program.message);
        if(program.conflict)summary.push('학습기록은 계속 동기화합니다.');
      }else if(!hasToken()){
        const hint=isMobileDevice()
          ?'처음 한 번만 오답 훈련센터 홈에서 GitHub 토큰을 연결해 주세요. 그 뒤로는 「동기화」 한 번이면 됩니다.'
          :'PC 동기화 도우미가 꺼져 있습니다. 바탕화면의 「오답훈련센터 시작」을 실행하면 도우미가 켜지고, 이 화면에서 「동기화」만 누르면 됩니다.';
        setStatus(hint);
        if(onNeedToken)onNeedToken({mobile:isMobileDevice(),hint});
        return {status:'no-transport'};
      }else if(!isMobileDevice()){
        summary.push('PC 동기화 도우미가 꺼져 있어 새 문제·프로그램 파일은 건너뛰고 학습기록만 합쳤습니다. 바탕화면의 「오답훈련센터 시작」을 실행하면 다음부터 함께 동기화됩니다.');
      }

      setStatus('PC·모바일 학습기록을 합치는 중…');
      let changedLocal=0,attempt=0;
      while(true){
        attempt++;
        let remoteStates=null,base=null;
        if(helper){const read=await helperPost('/api/learning/read');remoteStates=read.state?.states||null;base=read.base||''}
        else{const remote=await getSyncState();remoteStates=remote?.json?.states||null;base=remote?.sha||null}
        changedLocal=mergeStatesIntoLocal(remoteStates);
        const payload=buildSyncPayload();
        try{
          if(helper)await helperPost('/api/learning/write',{state:payload,base});
          else await putSyncState(payload,base);
          break;
        }catch(error){
          if(error.conflict&&attempt<3){setStatus('다른 기기가 방금 저장했습니다. 다시 합치는 중…');continue}
          throw error;
        }
      }
      summary.push(changedLocal?`다른 기기의 학습기록을 이 기기에 합쳤습니다(${changedLocal}개 분야).`:'학습기록을 GitHub에 최신으로 저장했습니다.');
      writeStorage(global.localStorage,LAST_SYNC_KEY,new Date().toISOString());
      writeStorage(global.localStorage,CACHE_BUST_KEY,String(Date.now()));
      const message=`✅ 동기화 완료 (${lastSyncLabel()}) · ${summary.join(' ')}`;
      setStatus(message);
      return {status:'done',message,program,changedLocal,reload:true};
    }catch(error){
      const message=`동기화를 마치지 못했습니다. 이 기기의 기록은 그대로 보존됩니다. ${error?.message||error}`;
      setStatus(`${summary.length?summary.join(' ')+' ':''}${message}`);
      return {status:'error',message};
    }finally{setBusy(false)}
  }

  // ── 화면 공통: 메뉴 줄의 「동기화」 버튼 연결 ───────────────────────────────
  function applyCacheBust(){
    if(location.protocol!=='https:')return;
    const stamp=readStorage(global.localStorage,CACHE_BUST_KEY);if(!stamp)return;
    document.querySelectorAll('a.nav-link[href],a.open-link[href],a.mini-link[href]').forEach(link=>{
      const href=link.getAttribute('href')||'';
      if(!/\.html(\?|$)/.test(href)||/^https?:/.test(href))return;
      const url=new URL(href,location.href);url.searchParams.set('r',stamp);link.setAttribute('href',url.pathname.split('/').pop()+url.search);
    });
  }
  function installSyncBar({onNeedToken=null,onDone=null}={}){
    const button=document.querySelector('#syncAll'),status=document.querySelector('#navSyncStatus');
    if(!button||!status)return;
    applyCacheBust();
    const setStatus=text=>{status.textContent=text};
    const previous=consumeSyncMessage();
    if(previous)setStatus(previous);
    else{
      const last=lastSyncLabel();
      detectHelper().then(helper=>{
        if(helper)setStatus(`PC 동기화 도우미 켜짐${last?` · 마지막 동기화 ${last}`:''}`);
        else if(!helperPossible()&&hasToken())setStatus(`GitHub 연결됨${last?` · 마지막 동기화 ${last}`:''}`);
        else if(!helperPossible())setStatus('');
        else if(hasToken())setStatus(`도우미 꺼짐 · 학습기록만 동기화 가능${last?` · 마지막 동기화 ${last}`:''}`);
        else setStatus('PC 동기화 도우미가 꺼져 있습니다. 바탕화면의 「오답훈련센터 시작」으로 열어주세요.');
      });
    }
    button.addEventListener('click',async()=>{
      const result=await syncEverything({
        setStatus,
        setBusy:busy=>{button.disabled=busy;button.textContent=busy?'동기화 중…':'🔄 동기화'},
        onNeedToken
      });
      if(result.status==='done'){
        if(onDone){onDone(result);return}
        setSyncMessage(result.message);
        setStatus(`${result.message} 최신 화면으로 새로고침합니다…`);
        setTimeout(()=>location.reload(),900);
      }
    });
  }

  global.TrainingGitHub={
    OWNER,REPOSITORY,BRANCH,PROGRAM_OWNER,PROGRAM_REPOSITORY,PROGRAM_BRANCH,SOURCES,HELPER_URL,
    getSessionToken,setSessionToken,clearToken,hasToken,isTokenRemembered,connect,
    getFile,putFile,saveDailyRecord,canSaveRemote,getSyncState,putSyncState,
    getDeviceId,getDeviceName,setDeviceName,isMobileDevice,
    detectHelper,helperPost,
    normalizeState,readState,writeState,mergeState,backupPayload,mergeStatesIntoLocal,buildSyncPayload,
    syncEverything,installSyncBar,consumeSyncMessage,lastSyncLabel
  };
})(window);
