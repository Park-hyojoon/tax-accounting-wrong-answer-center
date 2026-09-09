// Isolated Chromium profile: never touches the learner's open browser or saved answers.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const base=path.resolve(__dirname,'..');

(async()=>{
  const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
  if(!executable)throw new Error('No installed Chromium browser found');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mistake-memory-browser-'));
  const child=spawn(executable,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let socket;
  try{
    const portFile=path.join(profile,'DevToolsActivePort');
    for(let i=0;i<80&&!fs.existsSync(portFile);i++)await pause(150);
    if(!fs.existsSync(portFile))throw new Error('Browser did not start in this environment');
    const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];
    const pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
    const pending=new Map();let next=0;const errors=[];
    socket.addEventListener('message',event=>{
      const message=JSON.parse(event.data);
      if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
      if(pending.has(message.id)){const {resolve,reject,timer}=pending.get(message.id);clearTimeout(timer);pending.delete(message.id);message.error?reject(message.error):resolve(message.result)}
    });
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timed out: ${method}`))},12000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}))});
    const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true});if(response.exceptionDetails)throw new Error(JSON.stringify(response.exceptionDetails));return response.result.value};
    const waitFor=async expression=>{for(let i=0;i<60;i++){if(await evaluate(expression))return;await pause(100)}throw new Error('Page not ready')};
    await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('tax-accounting-helper-url','http://127.0.0.1:1')}catch(_){}"});
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:pathToFileURL(path.join(base,'오답_훈련센터.html')).href});
    await waitFor("document.querySelectorAll('#frequentList .top-type').length===5");
    const initial=await evaluate(`({total:TrainingMistakeMemory.analyze().total,rows:document.querySelectorAll('#frequentList .top-type').length,closed:document.querySelectorAll('#frequentList .top-type-body[hidden]').length,title:document.querySelector('#frequentList').closest('section').querySelector('h2').textContent,extraPanel:Boolean(document.querySelector('#intakeSignals'))})`);
    assert.equal(initial.rows,5);assert.equal(initial.closed,5);assert.equal(initial.extraPanel,false);
    assert.equal(initial.title,'가장 많이 틀리는 문제 유형 TOP 5');
    await evaluate(`(()=>{const topic=TrainingMistakeMemory.analyze().topics[0];for(const ref of topic.refs){const source=TrainingGitHub.SOURCES[ref.source],state=JSON.parse(localStorage.getItem(source.key)||'{}');if(ref.source==='theory'){state.deleted=state.deleted||{};state.deleted[ref.id]=true}else{state.cards=state.cards||{};state.cards[ref.id]={deleted:true,deletedAt:new Date().toISOString()}}localStorage.setItem(source.key,JSON.stringify(state))}document.querySelector('#refreshData').click();return true})()`);
    const after=await evaluate(`(()=>{const topic=TrainingMistakeMemory.analyze().topics[0];return{total:TrainingMistakeMemory.analyze().total,rows:document.querySelectorAll('#frequentList .top-type').length,originalStillVisible:topic.refs.some(ref=>records.some(record=>record.source===ref.source&&record.id===ref.id)),backup:TrainingGitHub.backupPayload().sourceMistakes.entries.length}})()`);
    assert.equal(after.total,initial.total);assert.equal(after.rows,5);assert.equal(after.originalStillVisible,false);assert.equal(after.backup,initial.total);
    await evaluate("document.querySelector('.top-type-head').click()");
    assert.equal(await evaluate("document.querySelector('.top-type-body').hidden"),false);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await pause(250);
    const width=await evaluate('({actual:document.documentElement.scrollWidth,viewport:innerWidth})');
    assert.ok(width.actual<=width.viewport+1,JSON.stringify(width));
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({initial,after,mobileWidth:width,runtimeErrors:errors.length}));
    await send('Browser.close');
  }finally{
    if(socket)socket.close();
    if(child.exitCode===null)child.kill();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
