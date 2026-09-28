const {chromium}=require('C:/Users/MyPC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path'),{pathToFileURL}=require('url'),assert=require('assert/strict');
const home=pathToFileURL(path.join(__dirname,'..','오답_훈련센터.html')).href+'?weakness=1&weaknessSource=all';

(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    for(const width of [390,1440]){
      const context=await browser.newContext({viewport:{width,height:1100}});
      await context.route('https://**/*',route=>route.abort());
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(home);
      assert.equal(await page.locator('.weak-profile svg[role=img]').count(),1);
      assert.equal(await page.locator('.weak-profile-list [data-status=unseen]').count(),6);
      assert.equal(await page.locator('.weak-profile svg circle').count(),0,'no invented zero scores for unseen areas');
      assert.match(await page.locator('.weak-profile-tip').innerText(),/채점 기록/);
      const originalCards=await page.locator('.weak-all-card').count();
      await page.evaluate(()=>{
        const catalog=TrainingSeasonCatalog;
        const byId=id=>{const ref=catalog.find(r=>r.id===id);if(!ref)throw Error('missing fixture '+id);return ref};
        const theory={history:{},deleted:{}},practical={schemaVersion:'exam-20260914-practical-schema',cards:{}},voucher={cards:{}};
        const states={theory,practical,voucher};
        const grade=(ref,correct)=>{
          const history=[{at:'2026-09-28T03:00:00Z',correct}];
          if(ref.subject==='theory')theory.history[ref.id]=history;
          else states[ref.subject].cards[ref.id]={history};
        };
        // Explicit source metadata fixtures cover all six learning areas.
        ['exam121-reliability-variant','review-20260928-accounting-assumptions','exam124-operating-profit-items-variant'].forEach(id=>grade(byId(id),true));
        const inventory=catalog.filter(r=>r.subject==='theory'&&/재고자산|상품매출원가/.test(r.type)).slice(0,3);
        if(inventory.length!==3)throw Error('inventory fixtures');inventory.forEach((r,i)=>grade(r,i===0));
        grade(catalog.find(r=>r.subject==='practical'&&r.type==='신제품 개발비의 자산 처리'),false);
        const finance=catalog.filter(r=>r.subject==='practical'&&/사채|차입/.test(r.type)).slice(0,3);
        if(finance.length!==3)throw Error('finance fixtures');finance.forEach((r,i)=>grade(r,i!==0));
        const cost=catalog.filter(r=>r.subject==='theory'&&/제조간접/.test(r.type)).slice(0,3);
        if(cost.length!==3)throw Error('cost fixtures');cost.forEach((r,i)=>grade(r,i!==0));
        catalog.filter(r=>r.subject==='voucher').slice(0,3).forEach(r=>grade(r,true));
        // History order, cancelled results and self-evaluations cannot distort scores.
        theory.history['exam121-reliability-variant'].push(
          {at:'2026-09-28T05:00:00Z',correct:false,cancelledAt:'2026-09-28T05:01:00Z'},
          {at:'2026-09-27T03:00:00Z',correct:false},
          {at:'2026-09-28T06:00:00Z',correct:false,source:'notebook'}
        );
        const ignored=catalog.filter(r=>r.subject==='practical'&&r.id!==2&&!practical.cards[r.id]).slice(0,2);
        practical.cards[ignored[0].id]={history:[{at:'2026-09-28T03:00:00Z',correct:true,source:'notebook'},{correct:false}]};
        practical.cards[ignored[1].id]={deleted:true,history:[{at:'2026-09-28T03:00:00Z',correct:false}]};
        theory.history.nonexistent=[{at:'2026-09-28T03:00:00Z',correct:false}];
        Object.entries(states).forEach(([subject,state])=>localStorage.setItem('exam-20260914-'+subject,JSON.stringify(state)));
        localStorage.setItem('exam-20250801-theory',JSON.stringify({history:{old:[{correct:false}]}}));
      });
      await page.reload();
      const scores=await page.locator('.weak-profile-rate').allTextContents();
      assert.deepEqual(scores,['100%','33%','0%','67%','67%','100%']);
      assert.equal(await page.locator('.weak-profile-list [data-status=strong]').count(),2);
      assert.equal(await page.locator('.weak-profile-list [data-status=weak]').count(),1);
      assert.equal(await page.locator('.weak-profile-list [data-status=few]').count(),1);
      const tip=await page.locator('.weak-profile-tip').innerText();
      assert.match(tip,/유형·무형자산 \(잠정\) → 재고자산·매출원가 → 금융·부채·자본 → 원가회계/);
      assert.equal(await page.locator('.weak-profile svg polygon').count(),5,'six observed axes have a filled profile');
      assert.equal(await page.evaluate(()=>TrainingWeaknessData.all.length),originalCards,'registered review set unchanged; completed cards may be hidden');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'mobile layout fits');
      const snapshot=await page.evaluate(()=>['theory','practical','voucher'].map(s=>localStorage.getItem('exam-20260914-'+s)));
      await page.locator('[data-source=submitted]').click();
      await page.locator('[data-source=recent]').click();
      assert.deepEqual(await page.locator('.weak-profile-rate').allTextContents(),scores,'filters do not change all-practice profile');
      assert.deepEqual(await page.evaluate(()=>['theory','practical','voucher'].map(s=>localStorage.getItem('exam-20260914-'+s))),snapshot,'profile never changes learning records');
      await page.evaluate(()=>{
        localStorage.removeItem('exam-20260914-voucher');
        dispatchEvent(new StorageEvent('storage',{key:'exam-20260914-voucher'}));
      });
      assert.equal(await page.locator('.weak-profile-list [data-axis="5"] .weak-profile-rate').innerText(),'기록 없음');
      assert.equal(await page.locator('.weak-profile svg polygon').count(),4,'no misleading filled polygon through missing scores');
      assert.deepEqual(errors,[]);
      if(width===1440)await page.screenshot({path:'C:/Users/MyPC/.codex/visualizations/2026/09/01/01a05c39-c06e-7750-82bd-c9d952df7f8e/learning-profile-desktop.png'});
      await context.close();
    }
    console.log('PASS: six-axis scores, latest graded results, ignored/cancelled/deleted records, priority order, mobile layout and unchanged review/history');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
