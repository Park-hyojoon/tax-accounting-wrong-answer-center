(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mistake-intake-data.js'));
  else root.TrainingMistakeMemory=factory(root.TrainingMistakeIntakeData);
})(typeof globalThis!=='undefined'?globalThis:this,function(data){
  'use strict';
  const sources=new Set(['practical','theory','closing','voucher']);
  const refKey=ref=>`${ref.source}:${ref.id}`;
  const counted=entry=>entry.source==='user-submitted'&&entry.evidenceStatus==='confirmed'&&!entry.duplicateOf;

  function validate(value=data){
    const errors=[];
    if(!value||value.schemaVersion!==1||!Number.isInteger(value.revision)||value.revision<1)return ['오답 접수 원장 형식 또는 revision 오류'];
    if(!Array.isArray(value.topics)||!Array.isArray(value.entries)||!Array.isArray(value.signals)||[...value.topics,...value.entries,...value.signals].some(item=>!item||typeof item!=='object'))return ['원장 목록 형식 오류'];
    const topics=new Set(),ids=new Set();
    for(const topic of value.topics||[]){
      if(!topic.id||!topic.label||topics.has(topic.id))errors.push(`유형 ID/이름 중복 또는 누락: ${topic.id}`);
      topics.add(topic.id);
    }
    for(const entry of value.entries||[]){
      if(!entry.id||ids.has(entry.id))errors.push(`접수 ID 중복 또는 누락: ${entry.id}`);
      ids.add(entry.id);
      if(!topics.has(entry.topicId))errors.push(`없는 취약점 유형: ${entry.id}`);
      if(!['confirmed','unconfirmed','retracted'].includes(entry.evidenceStatus))errors.push(`근거 상태 오류: ${entry.id}`);
      if(!entry.title||!entry.originalCue||!entry.provenance)errors.push(`원문 식별 근거 누락: ${entry.id}`);
      if(entry.evidenceStatus==='confirmed'&&entry.source!=='user-submitted')errors.push(`직접 제출이 아닌 항목을 확인된 오답으로 기록했습니다: ${entry.id}`);
      if(entry.learnerReason!==null&&typeof entry.learnerReason!=='string')errors.push(`학습자 설명 형식 오류: ${entry.id}`);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.registeredDate||''))errors.push(`등록일 누락 또는 오류: ${entry.id}`);
      if(entry.reportedAt!==null&&!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(entry.reportedAt||''))errors.push(`실제 전달일 형식 오류: ${entry.id}`);
      if(entry.reportedAt===null&&entry.dateBasis!=='training-registration')errors.push(`과거 복원 날짜 근거 누락: ${entry.id}`);
      if(!Array.isArray(entry.practiceRefs)||!entry.practiceRefs.length)errors.push(`훈련 문제 연결 누락: ${entry.id}`);
      for(const ref of Array.isArray(entry.practiceRefs)?entry.practiceRefs:[]){
        if(!ref||!sources.has(ref.source)||!ref.type||(ref.source==='theory'?typeof ref.id!=='string':!Number.isInteger(ref.id)))errors.push(`훈련 문제 참조 오류: ${entry.id}`);
      }
    }
    for(const entry of value.entries||[])if(entry.duplicateOf&&(!ids.has(entry.duplicateOf)||entry.duplicateOf===entry.id))errors.push(`중복 원본 참조 오류: ${entry.id}`);
    const cues=new Map();
    for(const entry of value.entries.filter(counted)){
      const cue=String(entry.originalCue||'').replace(/\s+/g,'');
      const earlier=cues.get(cue);
      if(earlier&&!(entry.recurrenceOf===earlier.id&&entry.recurrenceEvidence))errors.push(`같은 원문을 다시 접수하려면 새 실패 근거가 필요합니다: ${entry.id}`);
      if(entry.recurrenceOf&&(!ids.has(entry.recurrenceOf)||entry.recurrenceOf===entry.id||!entry.recurrenceEvidence))errors.push(`재오답 근거/원본 참조 오류: ${entry.id}`);
      if(!earlier)cues.set(cue,entry);
    }
    const signalIds=new Set();
    for(const signal of value.signals||[]){
      if(!signal.id||signalIds.has(signal.id)||!topics.has(signal.topicId)||signal.source!=='user-statement'||!signal.statement)errors.push(`학습자 직접 설명 오류: ${signal.id}`);
      signalIds.add(signal.id);
    }
    return errors;
  }

  function analyze(value=data){
    const errors=validate(value);if(errors.length)throw new Error(errors.join('\n'));
    const groups=new Map((value.topics||[]).map(topic=>[topic.id,{id:topic.id,label:topic.label,count:0,signals:[],refs:[],registrations:[],latestRegistered:'',entries:[]}]));
    const seen=new Set();
    for(const entry of value.entries){
      if(!counted(entry)||seen.has(entry.id))continue;seen.add(entry.id);
      const group=groups.get(entry.topicId);group.count++;group.entries.push(entry);
      if(entry.registeredDate){group.registrations.push(entry.registeredDate);if(entry.registeredDate>group.latestRegistered)group.latestRegistered=entry.registeredDate}
      for(const ref of entry.practiceRefs)if(!group.refs.some(item=>refKey(item)===refKey(ref)))group.refs.push({...ref});
    }
    for(const signal of value.signals||[])groups.get(signal.topicId).signals.push({...signal});
    const topics=[...groups.values()].filter(group=>group.count||group.signals.length).sort((a,b)=>b.count-a.count||b.signals.length-a.signals.length||b.latestRegistered.localeCompare(a.latestRegistered)||a.label.localeCompare(b.label,'ko'));
    return {revision:value.revision,recordedOn:value.recordedOn,coverageNote:value.coverageNote,total:seen.size,topics};
  }

  function snapshot(fallback){
    // 원장은 프로그램과 함께 배포한다. 구버전 화면이 더 최신 원격 사본을 덮지 않게 한다.
    const incoming=fallback?.schemaVersion===1&&!validate(fallback).length?fallback:null;
    if(validate(data).length){if(incoming)return JSON.parse(JSON.stringify(incoming));throw new Error('원본 오답 기록을 확인하지 못해 내보내기를 중단했습니다.')}
    const selected=incoming&&incoming.revision>data.revision?incoming:data;
    const copy=JSON.parse(JSON.stringify(selected));
    copy.summary=analyze(selected).topics.map(({id,label,count,signals})=>({id,label,reportedCount:count,learnerStatements:signals.map(signal=>signal.statement)}));
    return copy;
  }

  function summaryMarkdown(){
    const result=analyze();
    const lines=['# 학습자가 직접 전달한 오답 기억','','근거 우선순위: 직접 제출 원문·학습자 설명 → ★ 특별훈련 → 훈련 채점 이력.','',result.coverageNote,'',`확인된 원본 접수: ${result.total}건. 이는 전체 오답 횟수나 정답률이 아니다.`,
      '빈 답안 채점·과거 의도적 날짜 생략·AI 응용문제·자료 보완 재전송은 실제 신규 오답으로 세지 않는다.','',
      '| 반복 판단 유형 | 확인된 원본 접수 | 마지막 훈련 등록일 |','|---|---:|---|'];
    for(const topic of result.topics)lines.push(`| ${topic.label} | ${topic.count}건 | ${topic.latestRegistered||'미확인'} |`);
    lines.push('','## 학습자가 직접 설명한 어려움','');
    for(const topic of result.topics)for(const signal of topic.signals)lines.push(`- ${topic.label}: ${signal.statement}`);
    lines.push('','## 다음 오답 접수 시','',
      '1. 이 원장과 같은 유형의 기존 원본을 먼저 확인한다. 원문 자체와 AI가 숫자를 바꾼 훈련문제를 구분한다.',
      '2. 새 실패인지 자료 재전송인지 확인하고, 새로운 실패만 고유 접수 ID로 추가한다. 같은 원본을 다시 틀렸다고 명시하면 새 사건으로 기록한다.',
      '3. 실제 오답 이유는 사용자가 말한 경우에만 기록한다. 정답만 보고 원인을 확정하지 않는다.',
      '4. 원문 구조의 훈련문제 1개를 추가하고 practiceRefs/type를 연결한다. 응용문제는 접수 건수에 넣지 않는다.',
      '5. 원장의 revision과 HTML의 데이터 버전을 올리고 node mistake-memory.js --check를 실행한다. 인수인계 문서에 확인된 반복과 다음 훈련 초점을 남긴다.',
      '','## 가장 많이 틀리는 문제 N개를 요청받으면','',
      '접수 유형별 건수와 직접 설명한 어려움을 먼저 읽고, 같은 유형의 기존 HTML 문제와 비교한다. ★와 유효한 채점 이력은 보조 근거로 확인한다.',
      '요청 수량에 맞춰 반복 근거가 있는 유형을 우선 배분하고 기존 문제를 재사용하거나 원본 구조를 유지한 채 숫자·날짜·거래처만 조금 바꾼다. 근거가 없는 오답 이유와 횟수는 만들지 않는다.',
      '생성한 훈련문제는 신규 실제 오답 접수로 세지 않는다. 반복훈련·응용 표시를 하고 오늘 전달 문제 목록에 섞지 않는다. 삭제된 카드의 답안·상태는 복원하지 않는다.',
      '원장은 파일에서 관리하고 별도 관리 메뉴나 패널을 만들지 않는다. 사용자는 평소처럼 문제를 전달하고 동기화하면 된다.');
    return lines.join('\n');
  }

  return {validate,analyze,snapshot,summaryMarkdown,refKey};
});

if(typeof module==='object'&&module.exports&&require.main===module){
  const memory=module.exports;
  if(process.argv.includes('--check')){
    const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
    const home=fs.readFileSync(path.join(__dirname,'오답_훈련센터.html'),'utf8');
    const start=home.indexOf('    const practicalMeta=');
    const end=home.indexOf('    const $=',start);
    if(start<0||end<start)throw new Error('홈 META를 찾을 수 없습니다. 검사기를 현재 구조에 맞춰 주세요.');
    const meta=vm.runInNewContext(home.slice(start,end)+';META',{}, {timeout:1000});
    const data=require('./mistake-intake-data.js'),errors=memory.validate(data);
    const byKey=new Map(meta.map(item=>[memory.refKey({source:item.source,id:item.source==='closing'?item.index:item.id}),item]));
    for(const entry of data.entries||[])for(const ref of entry.practiceRefs||[]){
      const item=byKey.get(memory.refKey(ref));
      if(!item||item.type!==ref.type)errors.push(`${entry.id}: 홈 문제 참조 또는 type 불일치 ${memory.refKey(ref)}`);
      if(item?.variant||/\(응용\)\s*$/.test(item?.title||''))errors.push(`${entry.id}: AI 응용문제를 직접 접수 원본에 연결했습니다.`);
    }
    // 설치 전 106개는 출처 미확인/기본문제가 섞인 역사적 기준선이다. 오답 횟수로 사용하지 않는다.
    const oldTheory=new Set(['operating-profit','service-dept','predetermined-overhead','vat-taxpayer','tax-invoice','accounting-assumptions','financial-statements','comprehensive-income-equity','service-dept-repeat-20260908','total-manufacturing-cost','process-costing','vat-bad-debt-reason','vat-supply-timing','net-income-securities-property-20260909','ending-equity-equation-20260909']);
    const baseline=item=>item.source==='theory'?oldTheory.has(item.id):Number(item.source==='closing'?item.index:item.id)<({practical:44,closing:17,voucher:30}[item.source]||0);
    const linked=new Set((data.entries||[]).flatMap(entry=>(entry.practiceRefs||[]).map(memory.refKey)));
    for(const item of meta){
      if(baseline(item)||item.variant||/\(응용\)\s*$/.test(item.title))continue;
      const key=memory.refKey({source:item.source,id:item.source==='closing'?item.index:item.id});
      if(!linked.has(key))errors.push(`새 문제의 원본 접수가 없습니다: ${key} ${item.title}. 원장을 추가하거나 AI 응용 표시를 확인하세요.`);
    }
    if(errors.length){console.error(errors.join('\n'));process.exitCode=1}
    else console.log(`오답 원장 검증 완료: 확인 원본 ${memory.analyze().total}건, 홈 ${meta.length}문제 참조 확인. 신규 접수 누락 없음.`);
  }else console.log(memory.summaryMarkdown());
}
