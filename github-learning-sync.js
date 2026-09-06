(function(global){
  'use strict';

  const OWNER='Park-hyojoon';
  const REPOSITORY='tax-accounting-learning-sync';
  const BRANCH='main';
  const TOKEN_KEY='tax-accounting-github-token-session';
  const DEVICE_ID_KEY='tax-accounting-sync-device-id';
  const DEVICE_NAME_KEY='tax-accounting-sync-device-name';
  const API_ROOT=`https://api.github.com/repos/${OWNER}/${REPOSITORY}`;
  const PROGRAM_OWNER='Park-hyojoon';
  const PROGRAM_REPOSITORY='tax-accounting-wrong-answer-center';
  const PROGRAM_BRANCH='main';
  const PROGRAM_API_ROOT=`https://api.github.com/repos/${PROGRAM_OWNER}/${PROGRAM_REPOSITORY}`;
  const PROGRAM_VERSION_FILE='program-version.json';
  const PROGRAM_FILES=Object.freeze([
    '오답_훈련센터.html',
    '일반전표_기본연습_24문제.html',
    '이론_오답응용_5문제.html',
    '결산정리사항_연습_7문제.html',
    '매입매출전표_오답연습_3문제.html',
    'github-learning-sync.js',
    PROGRAM_VERSION_FILE
  ]);

  function getSessionToken(){try{return sessionStorage.getItem(TOKEN_KEY)||''}catch(error){return''}}
  function setSessionToken(token){
    const clean=String(token||'').trim();
    try{if(clean)sessionStorage.setItem(TOKEN_KEY,clean);else sessionStorage.removeItem(TOKEN_KEY)}catch(error){}
    return clean;
  }
  function clearToken(){setSessionToken('')}
  function hasToken(){return Boolean(getSessionToken())}
  function getDeviceId(){
    try{
      let id=localStorage.getItem(DEVICE_ID_KEY);
      if(!id){id=(global.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`);localStorage.setItem(DEVICE_ID_KEY,id)}
      return id;
    }catch(error){return `device-${Date.now()}`}
  }
  function defaultDeviceName(){return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)?'모바일':'PC'}
  function getDeviceName(){try{return localStorage.getItem(DEVICE_NAME_KEY)||defaultDeviceName()}catch(error){return defaultDeviceName()}}
  function setDeviceName(name){const clean=String(name||'').trim()||defaultDeviceName();try{localStorage.setItem(DEVICE_NAME_KEY,clean)}catch(error){}return clean}
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
  async function api(path,{method='GET',body,token=getSessionToken()}={}){
    const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    if(token)headers.Authorization=`Bearer ${token}`;
    if(body!==undefined)headers['Content-Type']='application/json';
    const response=await fetch(`${API_ROOT}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    if(response.status===404)return null;
    let data=null;try{data=await response.json()}catch(error){}
    if(!response.ok){const message=data?.message||`GitHub 요청 실패 (${response.status})`;throw new Error(message)}
    return data;
  }
  async function connect(token){
    const clean=setSessionToken(token);
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
    if(!hasToken())throw new Error('먼저 오답 훈련센터 홈에서 GitHub를 연결하세요.');
    const hasExpectedSha=Object.prototype.hasOwnProperty.call(options,'expectedSha');
    const existing=hasExpectedSha?null:await getFile(path),body={message,content:utf8ToBase64(text),branch:BRANCH};
    const sha=hasExpectedSha?options.expectedSha:existing?.sha;if(sha)body.sha=sha;
    const saved=await api(`/contents/${encodePath(path)}`,{method:'PUT',body});
    return saved;
  }
  async function saveDailyRecord(source,date,markdown){
    const deviceId=getDeviceId().replace(/[^a-zA-Z0-9-]/g,'').slice(0,12),path=`records/${date}/${source}-${deviceId}.md`;
    return putFile(path,markdown,`학습기록 저장: ${date} ${getDeviceName()} ${source}`);
  }
  async function getSyncState(){const file=await getFile('sync/learning-state.json');if(!file)return null;return {...file,json:JSON.parse(file.text)}}
  async function putSyncState(payload,expectedSha){return putFile('sync/learning-state.json',JSON.stringify(payload,null,2),`학습상태 동기화: ${new Date().toISOString()}`,{expectedSha:expectedSha||null})}

  function programFileName(name){
    const clean=String(name||'');
    if(!PROGRAM_FILES.includes(clean))throw new Error('허용되지 않은 프로그램 파일입니다.');
    return clean;
  }
  async function programApi(path,{method='GET',body,token=getSessionToken()}={}){
    const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    if(token)headers.Authorization=`Bearer ${token}`;
    if(body!==undefined)headers['Content-Type']='application/json';
    let response;
    try{response=await fetch(`${PROGRAM_API_ROOT}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)})}
    catch(error){throw new Error('GitHub 프로그램 저장소에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.')}
    if(response.status===404&&method==='GET')return null;
    let data=null;try{data=await response.json()}catch(error){}
    if(!response.ok){
      const detail=data?.message||`GitHub 요청 실패 (${response.status})`;
      if(response.status===401||response.status===403||response.status===404)throw new Error(`${detail}. 연결 토큰이 프로그램 저장소의 Contents 읽기·쓰기 권한을 갖는지 확인해 주세요.`);
      throw new Error(detail);
    }
    return data;
  }
  function parseProgramVersion(text,side){
    if(!text)return null;
    let value;try{value=JSON.parse(text)}catch(error){throw new Error(`${side}의 ${PROGRAM_VERSION_FILE} 형식이 올바르지 않습니다.`)}
    if(!Number.isInteger(value.revision)||value.revision<1)throw new Error(`${side} 프로그램 버전의 revision이 올바르지 않습니다.`);
    if(typeof value.updatedAt!=='string'||Number.isNaN(Date.parse(value.updatedAt)))throw new Error(`${side} 프로그램 버전의 updatedAt이 올바르지 않습니다.`);
    if(value.files!==undefined){
      if(!Array.isArray(value.files)||value.files.length!==PROGRAM_FILES.length||value.files.some(name=>!PROGRAM_FILES.includes(name))||PROGRAM_FILES.some(name=>!value.files.includes(name)))throw new Error(`${side} 프로그램 버전의 파일 목록이 현재 오답 훈련센터와 맞지 않습니다.`);
    }
    return{revision:value.revision,updatedAt:value.updatedAt,schemaVersion:value.schemaVersion||1};
  }
  async function requestDirectoryPermission(directoryHandle,mode='read'){
    if(!directoryHandle||directoryHandle.kind!=='directory')throw new Error('오답 훈련센터 폴더를 다시 선택해 주세요.');
    const options={mode};
    if(typeof directoryHandle.queryPermission==='function'){
      let permission=await directoryHandle.queryPermission(options);
      if(permission==='granted')return;
      if(typeof directoryHandle.requestPermission==='function')permission=await directoryHandle.requestPermission(options);
      if(permission!=='granted')throw new Error(mode==='readwrite'?'선택한 폴더를 업데이트할 권한이 필요합니다.':'선택한 폴더를 읽을 권한이 필요합니다.');
    }
  }
  async function readDirectoryText(directoryHandle,name,required=true){
    programFileName(name);
    try{const handle=await directoryHandle.getFileHandle(name);return await(await handle.getFile()).text()}
    catch(error){if(!required&&error?.name==='NotFoundError')return null;throw new Error(`선택한 폴더에서 ${name} 파일을 읽을 수 없습니다.`)}
  }
  async function validateProgramDirectory(directoryHandle){
    await requestDirectoryPermission(directoryHandle,'read');
    const hub=await readDirectoryText(directoryHandle,'오답_훈련센터.html');
    if(!hub.includes('전산회계 1급 오답 훈련센터'))throw new Error('선택한 폴더가 전산회계 1급 오답 훈련센터 폴더가 아닙니다.');
    for(const name of PROGRAM_FILES){if(name!==PROGRAM_VERSION_FILE&&name!=='오답_훈련센터.html')await readDirectoryText(directoryHandle,name)}
    return true;
  }
  async function pickProgramDirectory(){
    if(typeof global.showDirectoryPicker!=='function')throw new Error('이 기기에서는 프로그램 폴더 동기화를 지원하지 않습니다. PC의 최신 Chrome 또는 Edge에서 이용해 주세요. 모바일에서는 학습기록 동기화만 사용할 수 있습니다.');
    let handle;try{handle=await global.showDirectoryPicker({id:'tax-accounting-training-center',mode:'readwrite'})}
    catch(error){if(error?.name==='AbortError')throw new Error('폴더 선택을 취소했습니다.');throw error}
    await validateProgramDirectory(handle);
    return handle;
  }
  async function readLocalProgramSnapshot(directoryHandle){
    await validateProgramDirectory(directoryHandle);
    const files={};
    for(const name of PROGRAM_FILES){const text=await readDirectoryText(directoryHandle,name,name!==PROGRAM_VERSION_FILE);if(text!==null)files[name]=text}
    return{side:'local',directoryHandle,files,version:parseProgramVersion(files[PROGRAM_VERSION_FILE]||'', 'PC'),missing:PROGRAM_FILES.filter(name=>files[name]===undefined)};
  }
  async function getRemoteProgramHead(){
    const ref=await programApi(`/git/ref/heads/${encodeURIComponent(PROGRAM_BRANCH)}`);
    if(!ref?.object?.sha)throw new Error('GitHub 프로그램 저장소의 main 브랜치를 찾지 못했습니다.');
    return ref.object.sha;
  }
  async function readRemoteProgramSnapshot(){
    const headSha=await getRemoteProgramHead(),files={};
    for(const name of PROGRAM_FILES){
      const data=await programApi(`/contents/${encodePath(programFileName(name))}?ref=${encodeURIComponent(headSha)}`);
      if(data){if(Array.isArray(data)||data.type!=='file')throw new Error(`GitHub의 ${name} 경로가 파일이 아닙니다.`);files[name]=base64ToUtf8(data.content)}
    }
    const version=parseProgramVersion(files[PROGRAM_VERSION_FILE]||'', 'GitHub');
    if(version){const missing=PROGRAM_FILES.filter(name=>files[name]===undefined);if(missing.length)throw new Error(`GitHub 프로그램에 필요한 파일이 없습니다: ${missing.join(', ')}`)}
    return{side:'remote',headSha,files,version,missing:PROGRAM_FILES.filter(name=>files[name]===undefined)};
  }
  function comparableProgramText(value){return value===undefined||value===null?null:String(value).replace(/\r\n?/g,'\n')}
  function differingProgramFiles(left,right){return PROGRAM_FILES.filter(name=>comparableProgramText(left[name])!==comparableProgramText(right[name]))}
  function compareProgramVersions(local,remote){
    if(!local&&!remote)throw new Error(`PC와 GitHub 모두 ${PROGRAM_VERSION_FILE}이 없어 동기화 방향을 안전하게 결정할 수 없습니다.`);
    if(local&&!remote)return 1;
    if(!local&&remote)return -1;
    if(local.revision!==remote.revision)return local.revision>remote.revision?1:-1;
    return 0;
  }
  async function planProgramSync(directoryHandle){
    const [local,remote]=await Promise.all([readLocalProgramSnapshot(directoryHandle),readRemoteProgramSnapshot()]),differences=differingProgramFiles(local.files,remote.files),order=compareProgramVersions(local.version,remote.version);
    let direction='none',reason='PC와 GitHub의 프로그램이 같습니다.';
    if(order===0&&differences.length){direction='conflict';reason='PC와 GitHub의 프로그램 버전은 같지만 파일 내용이 다릅니다. 자동으로 덮어쓰지 않습니다.'}
    else if(order>0){direction='pc-to-github';reason='PC 프로그램 버전이 GitHub보다 최신입니다.'}
    else if(order<0){direction='github-to-pc';reason='GitHub 프로그램 버전이 PC보다 최신입니다.'}
    const confirmationMessage=direction==='pc-to-github'?`PC의 프로그램 ${differences.length}개 파일을 GitHub 최신본으로 올릴까요? 한 번의 커밋으로 저장합니다.`:direction==='github-to-pc'?`GitHub의 최신 프로그램 ${differences.length}개 파일을 선택한 PC 폴더에 적용할까요?`:'실행할 동기화가 없습니다.';
    return{kind:'tax-accounting-program-sync-plan-v1',direction,reason,confirmationMessage,differences,local,remote,createdAt:new Date().toISOString()};
  }
  function assertExecutablePlan(plan,confirmed){
    if(!plan||plan.kind!=='tax-accounting-program-sync-plan-v1')throw new Error('프로그램 동기화 비교를 다시 실행해 주세요.');
    if(plan.direction==='conflict')throw new Error(plan.reason);
    if(plan.direction==='none')return false;
    if(confirmed!==true)throw new Error('프로그램 파일을 변경하기 전에 화면의 확인 절차를 완료해 주세요.');
    return true;
  }
  async function writeDirectoryText(directoryHandle,name,text){
    programFileName(name);
    const fileHandle=await directoryHandle.getFileHandle(name,{create:true}),writable=await fileHandle.createWritable();
    await writable.write(text);await writable.close();
  }
  async function applyRemoteProgramToPc(plan){
    const directoryHandle=plan.local.directoryHandle;
    await requestDirectoryPermission(directoryHandle,'readwrite');
    const [currentLocal,currentRemote]=await Promise.all([readLocalProgramSnapshot(directoryHandle),readRemoteProgramSnapshot()]);
    if(differingProgramFiles(currentLocal.files,plan.local.files).length)throw new Error('비교 후 PC 프로그램 파일이 변경되었습니다. 다시 동기화해 주세요.');
    if(currentRemote.headSha!==plan.remote.headSha||differingProgramFiles(currentRemote.files,plan.remote.files).length)throw new Error('비교 후 GitHub 프로그램이 변경되었습니다. 다시 동기화해 주세요.');
    const written=[];
    try{for(const name of PROGRAM_FILES){await writeDirectoryText(directoryHandle,name,currentRemote.files[name]);written.push(name)}}
    catch(error){
      let restored=true;
      for(const name of written.reverse()){try{if(plan.local.files[name]!==undefined)await writeDirectoryText(directoryHandle,name,plan.local.files[name]);else if(typeof directoryHandle.removeEntry==='function')await directoryHandle.removeEntry(name)}catch(rollbackError){restored=false}}
      throw new Error(`PC 프로그램 적용 중 오류가 발생했습니다.${restored?' 기존 파일로 복원했습니다.':' 일부 파일을 복원하지 못했으므로 폴더를 확인해 주세요.'} ${error.message||''}`.trim());
    }
    return{direction:'github-to-pc',version:currentRemote.version,writtenFiles:[...PROGRAM_FILES],message:'GitHub의 최신 프로그램을 PC 폴더에 적용했습니다.'};
  }
  async function applyLocalProgramToGitHub(plan){
    if(!hasToken())throw new Error('먼저 오답 훈련센터 홈에서 GitHub를 연결하세요.');
    const [currentLocal,currentRemote]=await Promise.all([readLocalProgramSnapshot(plan.local.directoryHandle),readRemoteProgramSnapshot()]);
    if(differingProgramFiles(currentLocal.files,plan.local.files).length)throw new Error('비교 후 PC 프로그램 파일이 변경되었습니다. 다시 동기화해 주세요.');
    if(currentRemote.headSha!==plan.remote.headSha)throw new Error('비교 후 GitHub 프로그램이 변경되었습니다. 다시 동기화해 주세요.');
    const changes=differingProgramFiles(currentLocal.files,currentRemote.files);
    if(!changes.length)return{direction:'none',version:currentLocal.version,writtenFiles:[],message:'이미 같은 프로그램입니다.'};
    const parent=await programApi(`/git/commits/${encodeURIComponent(currentRemote.headSha)}`);
    if(!parent?.tree?.sha)throw new Error('GitHub 프로그램의 기준 커밋을 읽지 못했습니다.');
    const tree=[];
    for(const name of changes){const blob=await programApi('/git/blobs',{method:'POST',body:{content:comparableProgramText(currentLocal.files[name]),encoding:'utf-8'}});tree.push({path:programFileName(name),mode:'100644',type:'blob',sha:blob.sha})}
    const nextTree=await programApi('/git/trees',{method:'POST',body:{base_tree:parent.tree.sha,tree}}),message=`오답 훈련센터 프로그램 동기화: r${currentLocal.version.revision}`;
    const commit=await programApi('/git/commits',{method:'POST',body:{message,tree:nextTree.sha,parents:[currentRemote.headSha]}});
    try{await programApi(`/git/refs/heads/${encodeURIComponent(PROGRAM_BRANCH)}`,{method:'PATCH',body:{sha:commit.sha,force:false}})}
    catch(error){throw new Error(`GitHub가 비교 후 변경되어 안전하게 업로드하지 않았습니다. 다시 동기화해 주세요. ${error.message||''}`.trim())}
    return{direction:'pc-to-github',version:currentLocal.version,writtenFiles:changes,commitSha:commit.sha,commitUrl:commit.html_url||'',message:'PC의 최신 프로그램을 GitHub에 한 번의 커밋으로 저장했습니다.'};
  }
  async function executeProgramSync(plan,{confirmed=false}={}){
    if(!assertExecutablePlan(plan,confirmed))return{direction:'none',writtenFiles:[],message:plan.reason};
    if(plan.direction==='github-to-pc')return applyRemoteProgramToPc(plan);
    if(plan.direction==='pc-to-github')return applyLocalProgramToGitHub(plan);
    throw new Error('알 수 없는 프로그램 동기화 방향입니다.');
  }

  global.TrainingGitHub={OWNER,REPOSITORY,BRANCH,PROGRAM_OWNER,PROGRAM_REPOSITORY,PROGRAM_BRANCH,PROGRAM_FILES,getSessionToken,setSessionToken,clearToken,hasToken,connect,getFile,putFile,saveDailyRecord,getSyncState,putSyncState,getDeviceId,getDeviceName,setDeviceName,pickProgramDirectory,validateProgramDirectory,readLocalProgramSnapshot,readRemoteProgramSnapshot,planProgramSync,executeProgramSync};
})(window);
