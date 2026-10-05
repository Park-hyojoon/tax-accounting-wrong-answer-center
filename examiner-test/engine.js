(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ExaminerEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SEASON='exam-20260914',KEY=SEASON+'-examiner-test-v1';
  const STYLES=['정석 출제','기출 변형','장기 미출제 후보','교재 주변부','예외규정','함정형'];
  const DEFAULT_STYLES=STYLES.filter(s=>s!=='정석 출제');
  const RUBRIC=[
    ['copy','기출을 거의 복사했나요?','높을수록 문제'],
    ['textbook','평범한 교재 연습에 머무르나요?','높을수록 아쉬움'],
    ['sentence','실제 시험처럼 문장이 자연스러운가요?','높을수록 좋음'],
    ['choices','선택지가 시험답게 구성되었나요?','높을수록 좋음'],
    ['peripheral','주변부 개념을 적절히 활용했나요?','해당 없으면 미평가'],
    ['absence','표본에서 보이지 않은 개념을 문제화했나요?','장기 미출제와 구분'],
    ['exception','예외규정을 적절히 활용했나요?','해당 없으면 미평가'],
    ['surprise','뜻밖이지만 납득되는 판단 지점이 있나요?','계산량 증가와 구분'],
    ['forced','억지스럽거나 범위를 벗어나나요?','높을수록 문제']
  ];
  const fail=message=>{throw new Error(message)};
  const text=(value,max,label)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail(label+'의 글자 수/형식을 확인해 주세요.');return value};
  const id=value=>text(value,80,'ID')&&/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value);
  const https=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hostname.endsWith('.invalid')}catch{return false}};
  const clone=value=>JSON.parse(JSON.stringify(value));
  function validatePack(pack,analysis){
    if(!pack||pack.schemaVersion!==1||pack.season!==SEASON)fail('이 시즌의 출제위원 문제 JSON이 아닙니다.');
    if(!id(pack.id))fail('문제 묶음 ID 형식이 잘못되었습니다.');text(pack.label,160,'묶음 이름');
    if(!Array.isArray(pack.questions)||pack.questions.length<1||pack.questions.length>8)fail('한 묶음은 1~8문항만 허용합니다.');
    const concepts=new Map(analysis.concepts.map(c=>[c.id,c])),refs=new Set(analysis.records.map(r=>r.id)),seen=new Set();
    const questions=pack.questions.map(q=>{
      if(!q||!id(q.id)||seen.has(q.id))fail('문제 ID가 잘못되었거나 중복되었습니다.');seen.add(q.id);
      for(const [key,max]of Object.entries({title:140,prompt:2400,explanation:2400,intent:800,trap:800,novelty:800,basis:1200,boundary:800,calculationLoad:80}))text(q[key],max,key);
      if(!analysis.scope.domains.includes(q.area))fail('허용된 이론 분야를 확인해 주세요.');
      if(!Array.isArray(q.conceptIds)||!q.conceptIds.length||q.conceptIds.length>5||q.conceptIds.some(c=>!concepts.has(c)||concepts.get(c).area!==q.area))fail('범위 목록의 같은 분야 개념을 연결해 주세요. 새 개념은 먼저 근거를 검토해야 합니다.');
      if(!Array.isArray(q.choices)||q.choices.length!==4||q.choices.some(c=>typeof c!=='string'||!c.trim()||c.length>900)||new Set(q.choices.map(c=>c.trim())).size!==4)fail('서로 다른 선택지 4개가 필요합니다.');
      if(!Number.isInteger(q.answer)||q.answer<0||q.answer>3)fail('정답 번호는 0~3이어야 합니다.');
      if(!Array.isArray(q.styles)||!q.styles.length||q.styles.some(s=>!STYLES.includes(s)))fail('지원하는 출제 스타일을 선택해 주세요.');
      if(!Array.isArray(q.sourceRefs)||q.sourceRefs.length>12||q.sourceRefs.some(r=>!refs.has(r)))fail('존재하지 않는 분석 문항을 근거로 연결했습니다.');
      if(!Array.isArray(q.references)||q.references.length>5||q.references.some(r=>!r||typeof r.title!=='string'||!r.title.trim()||r.title.length>200||!https(r.url)||r.url.length>1400))fail('근거 링크는 제목이 있는 HTTPS 주소여야 합니다.');
      if(!q.sourceRefs.length&&!q.references.length)fail('표본 밖의 문제에는 교재·기준·법령 근거 링크가 필요합니다.');
      if(!Array.isArray(q.distractorReasons)||q.distractorReasons.length!==4||q.distractorReasons.some(r=>typeof r!=='string'||!r.trim()||r.length>900))fail('각 선택지의 해설 4개가 필요합니다.');
      let table;
      if(q.table){const t=q.table;text(t.caption,180,'표 제목');if(!Array.isArray(t.headers)||!t.headers.length||t.headers.length>8||t.headers.some(h=>typeof h!=='string'||h.length>120)||!Array.isArray(t.rows)||!t.rows.length||t.rows.length>16||t.rows.some(r=>!Array.isArray(r)||r.length!==t.headers.length||r.some(c=>typeof c!=='string'||c.length>500)))fail('자료표의 행과 열을 확인해 주세요.');table=clone(t)}
      // Allow-listed fields only. Imported HTML/JS/extra metadata is never executed.
      return Object.fromEntries(Object.entries({...q,...(table?{table}:{})}).filter(([k])=>['id','title','area','conceptIds','styles','prompt','choices','answer','explanation','distractorReasons','intent','trap','novelty','calculationLoad','sourceRefs','basis','references','boundary','table'].includes(k)));
    });
    return {schemaVersion:1,season:SEASON,id:pack.id,label:pack.label,questions};
  }
  function selectQuestions(pack,styles,count,random=Math.random){
    if(!Number.isInteger(count)||count<1||count>8)fail('테스트 문항 수는 1~8개입니다.');
    if(!styles.length||styles.some(s=>s!=='출제위원 랜덤'&&!STYLES.includes(s)))fail('출제 스타일을 하나 이상 선택해 주세요.');
    const pool=pack.questions.filter(q=>styles.includes('출제위원 랜덤')||q.styles.some(s=>styles.includes(s)));
    // Shuffle an existing pool; this is explicitly not AI generation.
    for(let i=pool.length-1;i>0;i--){const j=Math.max(0,Math.min(i,Math.floor(random()*(i+1))));[pool[i],pool[j]]=[pool[j],pool[i]]}
    const selected=[],used=new Set();
    for(const s of styles){const q=pool.find(q=>!used.has(q.id)&&(s==='출제위원 랜덤'||q.styles.includes(s)));if(q&&selected.length<count){selected.push(q);used.add(q.id)}}
    for(const q of pool)if(!used.has(q.id)&&selected.length<count){selected.push(q);used.add(q.id)}
    return selected;
  }
  function empty(){return {schemaVersion:1,season:SEASON,packs:[],trials:[],attempts:[],evaluations:[]}}
  function validateState(state,analysis,pilot){
    if(!state||state.schemaVersion!==1||state.season!==SEASON)fail('다른 시즌 또는 잘못된 테스트 기록입니다.');
    for(const key of ['packs','trials','attempts','evaluations'])if(!Array.isArray(state[key])||state[key].length>(key==='packs'?20:2000))fail('기록의 형식 또는 최대 개수를 확인해 주세요.');
    const clean=empty(),packs=[pilot],packIds=new Set([pilot.id]);
    for(const p of state.packs){const checked=validatePack(p,analysis);if(packIds.has(p.id))fail('중복된 문제 묶음 ID입니다.');packs.push(checked);clean.packs.push(checked);packIds.add(p.id)}
    const unique=list=>{const seen=new Set();for(const row of list){if(!row||!id(row.id)||seen.has(row.id))fail('기록 ID가 중복되거나 잘못되었습니다.');seen.add(row.id)}};
    const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
    unique(state.trials);unique(state.attempts);unique(state.evaluations);
    for(const t of state.trials){const p=packs.find(p=>p.id===t.packId);if(!p||!date(t.at)||!Array.isArray(t.questionIds)||!t.questionIds.length||t.questionIds.length>8||new Set(t.questionIds).size!==t.questionIds.length||t.questionIds.some(q=>!p.questions.some(x=>x.id===q)))fail('테스트 회차에 연결된 문제를 확인해 주세요.');clean.trials.push({id:t.id,at:t.at,packId:t.packId,questionIds:[...t.questionIds]})}
    for(const a of state.attempts){const t=clean.trials.find(t=>t.id===a.trialId),q=t&&packs.find(p=>p.id===t.packId).questions.find(q=>q.id===a.questionId);if(!q||!t.questionIds.includes(q.id)||!date(a.at)||!Number.isInteger(a.choice)||a.choice<0||a.choice>3||a.correct!==(a.choice===q.answer))fail('채점 기록이 연결된 문제와 맞지 않습니다.');clean.attempts.push({id:a.id,at:a.at,trialId:a.trialId,questionId:a.questionId,choice:a.choice,correct:a.correct})}
    for(const e of state.evaluations){const p=packs.find(p=>p.id===e.packId);if(!p?.questions.some(q=>q.id===e.questionId)||!date(e.at)||!e.ratings||typeof e.ratings!=='object'||Array.isArray(e.ratings)||Object.entries(e.ratings).some(([k,v])=>!RUBRIC.some(r=>r[0]===k)||![0,1,2].includes(v))||typeof e.note!=='string'||e.note.length>2000)fail('품질 평가 기록을 확인해 주세요.');clean.evaluations.push({id:e.id,at:e.at,packId:e.packId,questionId:e.questionId,ratings:clone(e.ratings),note:e.note})}
    return clean;
  }
  function mergeState(a,b,analysis,pilot){
    const left=validateState(a,analysis,pilot),right=validateState(b,analysis,pilot),out=empty();
    for(const key of ['packs','trials','attempts','evaluations']){const map=new Map();for(const row of [...left[key],...right[key]]){if(map.has(row.id)&&JSON.stringify(map.get(row.id))!==JSON.stringify(row))fail('같은 ID의 서로 다른 기록이 있습니다. 양쪽 원본을 보존하고 합치기를 중단합니다.');map.set(row.id,row)}out[key]=[...map.values()]}
    return validateState(out,analysis,pilot);
  }
  function buildRequest(analysis,styles,count){
    if(!styles.length||styles.some(s=>s!=='출제위원 랜덤'&&!STYLES.includes(s))||!Number.isInteger(count)||count<5||count>8)fail('AI 요청은 스타일 1개 이상, 5~8문항으로 지정해 주세요.');
    const examples=[];
    for(const c of analysis.concepts){const row=analysis.records.filter(r=>r.conceptIds.includes(c.id)&&!r.qualityNote).at(-1);if(row&&examples.length<12)examples.push({id:row.id,round:row.round,area:row.area,conceptIds:row.conceptIds,answerSummary:row.answerSummary,explanation:row.explanation,textPattern:row.textPattern,choicePattern:row.choicePattern})}
    const context={snapshot:analysis.snapshotId,coverage:analysis.coverage,scope:analysis.scope,styles,count,concepts:analysis.concepts.map(c=>({id:c.id,area:c.area,label:c.label,point:c.point,trap:c.trap,observed:c.frequency.questions,observedRounds:c.frequency.rounds,lastObservedRound:c.lastObservedRound,absence:c.frequency.longAbsence})),representativeSummaries:examples,patterns:analysis.patterns};
    const schema={schemaVersion:1,season:SEASON,id:'ai-batch-UNIQUE-ID',label:'출제위원 검토 대기 문제',questions:[{id:'ai-question-UNIQUE-ID',title:'정답을 누설하지 않는 제목',area:'회계원리',conceptIds:['cash-maturity'],styles:['함정형'],prompt:'시험 문장',choices:['선택지1','선택지2','선택지3','선택지4'],answer:0,explanation:'정답의 완전한 풀이',distractorReasons:['정답 이유','오답 이유','오답 이유','오답 이유'],intent:'판단하려는 지점',trap:'함정 요소',novelty:'기출과 다른 판단 구조',calculationLoad:'없음/날짜 비교/단순 가감',sourceRefs:[],basis:'확인한 정답·범위 근거',references:[{title:'공식 교재·기준·법령',url:'https://example.invalid/replace-with-verified-source'}],boundary:'범위를 벗어나지 않는 이유',table:{caption:'자료표가 필요할 때만',headers:['구분','내용'],rows:[['자료','값']]}}]};
    return [
      '출제위원 테스트 모드. 일반 문제 등록·수정·태그 분류에 이 지침을 사용하지 않는다.',
      '원문 재분석 없이 아래 구조화 요약을 사용하여 '+count+'개의 이론 4지선다 신규 문제를 출제한다. 범위는 전산회계 1급 회계원리·원가회계·부가가치세다.',
      '목적은 낯설지만 배운 내용으로 풀 수 있는 문제다. 기출을 난이도·문장 길이·계산량의 기준으로 사용한다. '+(count===6?'질문 방향 바꾸기 2문항, 비슷한 개념 구분하기 2문항, 세부개념이나 예외 활용하기 2문항으로 배분한다.':'질문 방향 바꾸기, 비슷한 개념 구분하기, 세부개념이나 예외 활용하기를 가능한 고르게 배분한다.')+' 스타일은 보조 분류다. 모든 스타일을 채우려고 억지 문제를 만들지 않는다. 출제 의도·함정·기출과의 차이·근거는 풀이 전에 힌트로 노출하지 않는다.',
      '기출 빈도는 출제범위를 제한하지 않는다. 세부개념 후보 목록을 탐색하되 선택 개념의 공식 교재/기준/법령 근거를 확인한다. 새로운 개념이 목록에 없으면 근거와 함께 목록 확장부터 제안하고 임의로 기존 ID에 끼워넣지 않는다.',
      '주어진 회차 밖의 빈도, 최근 수년의 장기 미출제, 실제 출제확률을 추정하여 단정하지 않는다. 장기 미출제 후보는 표본 내 미관찰 또는 최근 관찰되지 않은 후보일 뿐이다. 사용자의 교재 중요도도 확인되지 않았다.',
      '숫자·날짜만 바꾸지 말고 조건의 방향, 판단 기준, 예외의 경계, 개념 결합을 바꾼다. 계산을 복잡하게 하는 것은 출제위원다움이 아니다. 억지 사례·고급회계·법인세·소득세 계산을 배제한다.',
      '각 문항은 단일 정답, 반증 가능한 오답 3개, 자연스러운 시험 문장을 갖춘다. 단서 누락·과한 단정 표현·복수 정답 가능성을 검토한다. 예외규정은 현행 시행일과 정확한 조문을 확인한다.',
      '근거 없이 정답을 확정하지 않는다. AI 자체 검토를 인간의 품질 승인으로 표현하지 않는다. 부족한 근거는 출제 보류 사유로 보고하고 허위 URL을 만들지 않는다.',
      '원문/개인 기록/토큰을 요청하지 않는다. 출력은 아래 형식의 JSON만 반환한다. 표가 필요하면 table을 사용한다. sourceRefs는 아래 분석 문항 ID 중 실제 근거만 연결하고, 표본 밖의 문항에는 references의 확인한 HTTPS 링크가 필요하다.',
      '사용 가능한 분석 문항 연결: '+analysis.records.map(r=>r.id+'='+r.conceptIds.join('+')).join(', '),
      '요청 조건과 압축된 분석 요약:\n'+JSON.stringify(context),
      'JSON 형식 (예시 내용과 example.invalid 주소는 실제 검증 결과로 교체):\n'+JSON.stringify(schema)
    ].join('\n\n');
  }
  return {SEASON,KEY,STYLES,DEFAULT_STYLES,RUBRIC,validatePack,selectQuestions,empty,validateState,mergeState,buildRequest,clone};
});
