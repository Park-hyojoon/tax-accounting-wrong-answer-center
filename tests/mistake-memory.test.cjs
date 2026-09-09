const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
const memory=require('../mistake-memory.js');
const data=require('../mistake-intake-data.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const total=memory.analyze().total;

function syncHarness(withSourceMemory=true){
  const store=new Map();
  const localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
  const sandbox={localStorage,console};if(withSourceMemory)sandbox.TrainingMistakeMemory=memory;sandbox.window=sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(base,'github-learning-sync.js'),'utf8'),sandbox);
  return {api:sandbox.TrainingGitHub,store,localStorage};
}

test('the ledger validates and source evidence remains separate from generated practice',()=>{
  assert.deepEqual(memory.validate(),[]);
  assert.equal(total,data.entries.filter(entry=>entry.evidenceStatus==='confirmed'&&!entry.duplicateOf).length);
  assert.equal(data.entries.filter(entry=>entry.id.includes('signboard')).length,1);
  const original=data.entries.find(entry=>entry.id.includes('prepaid-factory-insurance'));
  assert.match(original.originalCue,/전액 선급비용/);
  assert.equal(original.reportedAt,null);
});

test('duplicate IDs, repeated source with no new failure, and AI source are rejected',()=>{
  let value=copy(data);value.entries.push(copy(value.entries[0]));
  assert.ok(memory.validate(value).some(error=>error.includes('ID 중복')));
  value=copy(data);value.entries.push({...value.entries[0],id:'reuploaded-original'});
  assert.ok(memory.validate(value).some(error=>error.includes('새 실패 근거')));
  value=copy(data);value.entries[0].source='ai-generated';
  assert.ok(memory.validate(value).some(error=>error.includes('직접 제출이 아닌')));
});

test('a marked reupload counts once; a documented new failure counts separately',()=>{
  let value=copy(data),first=value.entries[0];
  value.entries.push({...first,id:'document-only-reupload',duplicateOf:first.id});
  assert.equal(memory.analyze(value).total,total);
  value=copy(data);first=value.entries[0];
  value.entries.push({...first,id:'new-failure',recurrenceOf:first.id,recurrenceEvidence:'검사용: 사용자가 새 풀이에서 다시 틀렸다고 명시',reportedAt:'2026-09-09'});
  assert.equal(memory.analyze(value).total,total+1);
  value.entries.at(-1).evidenceStatus='retracted';
  assert.equal(memory.analyze(value).total,total);
});

test('deleted/correct cards and merged training attempts never remove or add source events',()=>{
  const {api,localStorage}=syncHarness();
  const key=api.SOURCES.voucher.key;
  localStorage.setItem(key,JSON.stringify({cards:{3:{passed:true,correct:true,wrongCount:50,history:[{correct:true,at:'2026-09-09T00:00:00Z'}]}}}));
  const state=api.normalizeState('voucher',JSON.parse(localStorage.getItem(key)));
  assert.equal(state.cards[3].deleted,true);
  api.mergeStatesIntoLocal({voucher:state});
  let payload=api.backupPayload();
  assert.equal(payload.states.voucher.cards[3].deleted,true);
  assert.equal(payload.sourceMistakes.entries.length,data.entries.length);
  assert.equal(memory.analyze(payload.sourceMistakes).total,total);
  api.mergeStatesIntoLocal({voucher:{cards:{7:{wrongCount:1000,history:[{at:'2026-09-09T01:00:00Z',correct:false,rows:[]}]}}}});
  payload=api.backupPayload();
  assert.equal(memory.analyze(payload.sourceMistakes).total,total);
  assert.equal(api.normalizeState('voucher',payload.states.voucher).cards[3].deleted,true);
  localStorage.removeItem(key);
  assert.equal(memory.analyze(api.backupPayload().sourceMistakes).total,total);
});

test('home backups retain a newer source snapshot and reject malformed remote data',()=>{
  const {api}=syncHarness(),remote=copy(data);remote.revision=data.revision+1;
  assert.equal(api.backupPayload({sourceMistakes:remote}).sourceMistakes.revision,remote.revision);
  for(const invalid of [{schemaVersion:1,revision:100,topics:{}},{...copy(data),entries:[null]},{...copy(data),entries:[{...data.entries[0],practiceRefs:{}}]}]){
    assert.ok(memory.validate(invalid).length);
    assert.equal(api.backupPayload({sourceMistakes:invalid}).sourceMistakes.revision,data.revision);
  }
  const exported=api.backupPayload();exported.sourceMistakes.entries[0].title='changed snapshot';
  assert.notEqual(data.entries[0].title,'changed snapshot');
});

test('lightweight subject pages preserve the remote source snapshot without loading the ledger',()=>{
  const {api}=syncHarness(false),remote=copy(data);remote.revision=data.revision+1;
  assert.deepEqual(api.backupPayload({sourceMistakes:remote}).sourceMistakes,remote);
});

function checkCatalog(home){
  const mod={exports:{}},errors=[];
  function mockedRequire(name){
    if(name==='./mistake-intake-data.js')return data;
    if(name==='node:fs')return {...fs,readFileSync:()=>home};
    return require(name);
  }
  mockedRequire.main=mod;
  const sandbox={module:mod,require:mockedRequire,__dirname:base,process:{argv:['node','mistake-memory.js','--check'],exitCode:0},console:{log(){},error:message=>errors.push(message)}};
  vm.runInNewContext(fs.readFileSync(path.join(base,'mistake-memory.js'),'utf8'),sandbox);
  return {exitCode:sandbox.process.exitCode,errors};
}

test('catalog check catches a newly added source problem without intake, but permits an AI variant',()=>{
  const home=fs.readFileSync(path.join(base,'오답_훈련센터.html'),'utf8');
  assert.equal(checkCatalog(home).exitCode,0);
  const add=title=>home.replace('    const $=',`    META.push({source:'voucher',id:9999,type:'검사용 유형',title:'${title}',registered:'2026-09-09'});\n    const $=`);
  const missing=checkCatalog(add('새로 전달한 오답'));
  assert.equal(missing.exitCode,1);
  assert.ok(missing.errors.join('').includes('원본 접수가 없습니다'));
  assert.equal(checkCatalog(add('추가 집중훈련 (응용)')).exitCode,0);
});

test('only the home loads source memory and all inline scripts parse',()=>{
  for(const file of ['오답_훈련센터.html','일반전표_기본연습_24문제.html','결산정리사항_연습_7문제.html','매입매출전표_오답연습_3문제.html','이론_오답응용_5문제.html']){
    const html=fs.readFileSync(path.join(base,file),'utf8');
    const source=html.search(/src=['"]mistake-intake-data\.js\?/),logic=html.search(/src=['"]mistake-memory\.js\?/),sync=html.search(/src=['"]github-learning-sync\.js\?v=\d+['"]/);
    if(file==='오답_훈련센터.html')assert.ok(source>=0&&source<logic&&logic<sync,file);
    else assert.ok(source<0&&logic<0&&sync>=0,file);
    for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(match[1],{filename:file});
  }
});
