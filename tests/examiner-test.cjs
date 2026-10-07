const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),E=require('../examiner-test/engine.js');
const context={window:{}};vm.createContext(context);for(const f of ['analysis.js','questions.js','library.js'])vm.runInContext(fs.readFileSync(path.join(root,'examiner-test',f),'utf8'),context);
const analysis=JSON.parse(JSON.stringify(context.window.ExaminerAnalysis)),pilot=E.validatePack(JSON.parse(JSON.stringify(context.window.ExaminerPilot)),analysis);
const copy=o=>JSON.parse(JSON.stringify(o));
test('five consecutive full theory rounds and frequency are counted from records',()=>{
  assert.deepEqual(analysis.rounds,[123,124,125,126,127]);assert.equal(analysis.records.length,75);
  for(const r of analysis.rounds)assert.equal(analysis.records.filter(q=>q.round===r).length,15);
  for(const c of analysis.concepts){const rows=analysis.records.filter(r=>r.conceptIds.includes(c.id));assert.equal(c.frequency.questions,rows.length);assert.deepEqual(c.frequency.rounds,[...new Set(rows.map(r=>r.round))]);assert.match(c.frequency.longAbsence,/판정 불가/)}
  assert.equal(analysis.concepts.find(c=>c.id==='cash-maturity').frequency.questions,0);assert.equal(analysis.concepts.find(c=>c.id==='vat-exceptions').frequency.questions,0);
});
test('pilot has six single-answer questions with evidence and no complex arithmetic',()=>{
  assert.equal(pilot.questions.length,6);assert.deepEqual(pilot.questions.map(q=>q.answer),[1,3,0,2,3,1]);
  assert.ok(pilot.questions.every(q=>q.distractorReasons.length===4&&q.basis&&q.boundary));assert.equal(pilot.questions.filter(q=>q.references.length).length,2);
  assert.equal(6000000-1000000+2000000,7000000);assert.ok(pilot.questions.find(q=>q.id==='pilot-ownership').choices[3].includes('7,000,000'));
  assert.ok(pilot.questions.filter(q=>q.calculationLoad==='없음').length>=4);
});
test('styles filter without duplicating or inventing new questions; maximum eight',()=>{
  const exception=E.selectQuestions(pilot,['예외규정'],6,()=>0.5);assert.equal(exception.length,1);assert.ok(exception[0].styles.includes('예외규정'));
  const all=E.selectQuestions(pilot,['출제위원 랜덤'],8,()=>0.1);assert.equal(all.length,6);assert.equal(new Set(all.map(q=>q.id)).size,6);
  assert.throws(()=>E.selectQuestions(pilot,[],6));assert.throws(()=>E.selectQuestions(pilot,['출제위원 랜덤'],9));
});
test('import rejects overlarge, duplicate, invalid-answer, wrong-season and unsupported-scope packs',()=>{
  for(const mutate of [p=>p.season='other',p=>p.questions[0].answer=4,p=>p.questions[0].choices[1]=p.questions[0].choices[0],p=>p.questions[0].conceptIds=['out-of-range'],p=>p.questions[0].references=[{title:'bad',url:'javascript:alert(1)'}],p=>p.questions[0].references=[{title:'placeholder',url:'https://example.invalid'}],p=>p.questions[0].sourceRefs=['fabricated-original'],p=>p.questions[1].id=p.questions[0].id,p=>p.questions=[...p.questions,...p.questions]]){const p=copy(pilot);mutate(p);assert.throws(()=>E.validatePack(p,analysis))}
  const p=copy(pilot);p.questions[0].sourceRefs=[];p.questions[0].references=[];assert.throws(()=>E.validatePack(p,analysis));
});
test('records merge as a union, preserve earlier ratings and reject ID collisions',()=>{
  const a=E.empty(),b=E.empty(),t={id:'trial-one',at:'2026-10-05T12:00:00Z',packId:pilot.id,questionIds:[pilot.questions[0].id]};a.trials.push(t);b.trials.push(t);
  a.attempts.push({id:'a-one',at:t.at,trialId:t.id,questionId:t.questionIds[0],choice:0,correct:false});b.attempts.push({id:'a-two',at:t.at,trialId:t.id,questionId:t.questionIds[0],choice:1,correct:true});
  a.evaluations.push({id:'e-one',at:t.at,packId:pilot.id,questionId:t.questionIds[0],ratings:{forced:1},note:'이전 의견'});b.evaluations.push({id:'e-two',at:t.at,packId:pilot.id,questionId:t.questionIds[0],ratings:{forced:0},note:'새 의견'});
  const merged=E.mergeState(a,b,analysis,pilot);assert.equal(merged.trials.length,1);assert.equal(merged.attempts.length,2);assert.equal(merged.evaluations.length,2);assert.equal(a.attempts.length,1);
  const conflict=copy(a);conflict.attempts[0].choice=2;assert.throws(()=>E.mergeState(a,conflict,analysis,pilot),/중단/);assert.throws(()=>E.mergeState(a,{...b,season:'old'},analysis,pilot));
});
test('foreign or incoherent events cannot enter a restored state',()=>{
  const state=E.empty();state.attempts.push({id:'orphan',at:'2026-10-05T12:00:00Z',trialId:'none',questionId:'none',choice:1,correct:true});assert.throws(()=>E.validateState(state,analysis,pilot));
});
test('AI request is summary-only and marks uncertainty, computation and isolated mode',()=>{
  const request=E.buildRequest(analysis,['예외규정','장기 미출제 후보'],6);assert.match(request,/단정하지 않는다/);assert.match(request,/계산을 복잡하게/);assert.match(request,/일반 문제 등록/);assert.match(request,/정답.*근거/);assert.match(request,/0회|관찰되지|미관찰/);
  assert.ok(!request.includes('originalText')&&!request.includes('originalAnswer')&&!request.includes('localStorage')&&!request.includes('githubToken'));
  assert.throws(()=>E.buildRequest(analysis,['함정형'],10));assert.throws(()=>E.buildRequest(analysis,[],6));
  const defaults=E.buildRequest(analysis,E.DEFAULT_STYLES,6);assert.match(defaults,/질문 방향 바꾸기 2문항, 비슷한 개념 구분하기 2문항, 세부개념이나 예외 활용하기 2문항/);assert.match(defaults,/스타일은 보조 분류/);assert.match(defaults,/풀이 전에 힌트로 노출하지/);
});
test('published packs are valid and distinct from the preserved pilot',()=>{
  const published=JSON.parse(JSON.stringify(context.window.ExaminerLibrary));assert.ok(Array.isArray(published));assert.ok(published.length<=20);const ids=new Set([pilot.id]);
  for(const p of published){E.validatePack(p,analysis);assert.ok(!ids.has(p.id));ids.add(p.id)}
});
test('all main pages link from top navigation without loading examiner data',()=>{
  for(const f of ['오답_훈련센터.html','이론_오답응용_5문제.html','일반전표_기본연습_24문제.html','매입매출전표_오답연습_3문제.html','개념_정리.html','약점_분석_임시.html']){const html=fs.readFileSync(path.join(root,f),'utf8');assert.match(html,/href="examiner-test\/index.html"/);assert.doesNotMatch(html,/<script[^>]+examiner-test/)}
  const html=fs.readFileSync(path.join(root,'examiner-test/index.html'),'utf8');assert.ok(!html.includes('src="analysis.js')&&!html.includes('src="questions.js')&&!html.includes('src="journal.js'));assert.equal(E.KEY,'exam-20260914-examiner-test-v1');
});
test('analysis keeps recent and older theory samples apart and adds official-scope concepts without inventing frequency',()=>{
  assert.deepEqual(analysis.olderRounds,[103,104]);assert.equal(analysis.olderRecords.length,30);
  const ids=new Set(analysis.concepts.map(c=>c.id));for(const r of analysis.olderRecords){assert.ok(r.conceptIds.every(c=>ids.has(c)));assert.ok(/^r10[34]-theory-\d+$/.test(r.id))}
  assert.equal(new Set([...analysis.records,...analysis.olderRecords].map(r=>r.id)).size,105);
  for(const id of ['liability-basic','tangible-subsequent','process-cost','vat-bad-debt']){const c=analysis.concepts.find(x=>x.id===id);assert.ok(c,id);assert.equal(c.frequency.questions,0)}
  assert.equal(analysis.concepts.find(c=>c.id==='tangible-subsequent').frequency.older.questions,1);
  assert.match(analysis.concepts.find(c=>c.id==='normal-loss').frequency.longAbsence,/장기 미출제 후보/);
  assert.ok(analysis.scope.official.url.startsWith('https://www.kacpta.or.kr/'));
});
test('review notes survive validation, and unknown or non-string notes are rejected',()=>{
  assert.deepEqual(Object.keys(pilot.questions[0].review).sort(),['absence','choices','copy','exception','forced','peripheral','sentence','surprise','textbook','verdict']);
  const p=copy(pilot);p.questions[0].review.copy=3;assert.throws(()=>E.validatePack(p,analysis));
  const q=copy(pilot);q.questions[0].review={copy:'통과',hack:'<script>'};assert.deepEqual(Object.keys(E.validatePack(q,analysis).questions[0].review),['copy']);
});
test('auto lint flags surface problems but stays silent on the reviewed pilot',()=>{
  assert.deepEqual(E.lintPack(pilot,pilot.questions),[]);
  const q=copy(pilot.questions[0]);q.choices=['짧다','이 선택지만 지나치게 길게 쓰여 있어서 눈에 띄고 단정 표현인 항상 맞다고 말한다','다','라'];q.answer=1;q.title='함정형 판단';
  const notes=E.lintQuestion(q,[]).map(n=>n.text).join('|');assert.match(notes,/눈에 띄게 깁니다/);assert.match(notes,/단정 표현/);assert.match(notes,/출제 의도/);
  const twin=copy(pilot.questions[1]);twin.id='twin';assert.match(E.lintQuestion(twin,pilot.questions).map(n=>n.text).join('|'),/지문이 많이 겹칩니다/);
  const skewed=copy(pilot);skewed.questions.forEach(x=>x.answer=2);assert.ok(E.lintPack(skewed,[]).some(n=>/몰려/.test(n.text)));
});
test('coverage counts tested concepts and styles for the next request',()=>{
  const cov=E.coverage([pilot]);assert.equal(cov.concepts.securities,1);assert.equal(cov.concepts['vat-zero'],1);assert.equal(cov.styles['함정형'],5);
});
test('AI request forbids lowering the level and demands the nine-point review',()=>{
  const request=E.buildRequest(analysis,E.DEFAULT_STYLES,6);assert.match(request,/수준을 낮추지 않는다/);assert.match(request,/9개 기준/);assert.match(request,/officialScope/);
});
test('brief keeps the level, scope and review rules in one place',()=>{
  const brief=fs.readFileSync(path.join(root,'examiner-test/brief.md'),'utf8');
  for(const phrase of ['수준 기준 — 낮추지 않는다','공식 평가범위','| copy |','| forced |','"장기 미출제"는 언제나 **후보**','계산을 복잡하게 만드는 것과 출제위원답게 만드는 것은 다르다','주의"가 2개 이상'])assert.ok(brief.includes(phrase),phrase);
});
