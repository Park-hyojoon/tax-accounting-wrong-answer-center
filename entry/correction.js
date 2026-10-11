(function(){
  // 수정 문제는 구조화된 기존 입력으로 시작한다. 정답에서 초기값을 만들지 않는다.
  window.TrainingCorrection={
    same(problem,subject){return problem.initialEntry?.subject===subject},
    seed(state,problem,subject,force=false){
      if(!this.same(problem,subject))return false;
      const hasDraft=(state.rows||[]).some(row=>row.account||Number(String(row.amount||'').replace(/,/g,'')))||Object.entries(state.voucher||{}).some(([key,value])=>['type','date','supply','vat','supplier','electronic','journal'].includes(key)&&value!==''&&value!=null);
      if(!force&&(state.correctionInitialized||hasDraft||state.graded))return false;
      const initial=JSON.parse(JSON.stringify(problem.initialEntry));
      const format=value=>typeof value==='number'?value.toLocaleString('ko-KR'):value;
      if(subject==='voucher')state.voucher=Object.fromEntries(Object.entries(initial.voucher||{}).map(([key,value])=>[key,format(value)]));
      state.rows=initial.rows.map(row=>({...row,amount:format(row.amount),summary:row.summary||''}));
      state.correctionInitialized=true;
      return true;
    }
  };
  window.TrainingCorrectionExhibits=function(host,problems){
    host.querySelectorAll('.question').forEach(card=>{
      const problem=problems[Number(card.dataset.index)];
      if(!problem?.initialEntry)return;
      const subject=card.closest('[data-entry-host]')?.dataset.entryHost;
      const layout=card.querySelector('.exhibit-layout');
      const figures=layout?[...layout.querySelectorAll('.exhibit,.table-scroll')]:[];
      const isCorrection=figure=>/수정\s+전|삭제\s*(대상|할)|기존\s*(입력|전표)/.test(figure.querySelector('figcaption,h4')?.textContent||figure.getAttribute('aria-label')||'');
      figures.filter(isCorrection).forEach(figure=>figure.remove());
      const before=card.querySelector('.before-box');
      if(window.TrainingCorrection.same(problem,subject)){
        before?.remove();card.dataset.correction='true';
        const note=document.createElement('p');note.className='correction-hint';note.textContent='기존 전표가 입력되어 있습니다. 잘못된 부분을 수정한 뒤 채점하세요.';
        const prompt=card.querySelector('.prompt');
        const replaceInstruction=text=>text.replace(/(?:아래(?:의)? 수정 전 (?:전표|분개)를 (?:참고하여|확인하고),?\s*수정 후[^\n]*입력하시오\.|아래 수정 전 전표를 확인하고, 수정 후 매입매출전표 전체를 입력하시오\.)/g,'입력된 전표에서 잘못된 부분을 수정한 뒤 채점하시오.');
        const walker=document.createTreeWalker(prompt,NodeFilter.SHOW_TEXT);let textNode;while((textNode=walker.nextNode()))textNode.textContent=replaceInstruction(textNode.textContent);
        (layout||prompt).insertAdjacentElement('afterend',note);
        const toggle=card.querySelector('.entry-toggle');if(toggle)toggle.open=true;
        if(subject==='practical'){const reset=document.createElement('button');reset.type='button';reset.className='btn secondary correction-reset';reset.textContent='수정 전으로 되돌리기';card.querySelector('.qactions')?.append(reset)}
      }else{
        // 전표 종류를 옮기는 문제는 기존 입력과 삭제 절차를 별도로 보존한다.
        const initial=problem.initialEntry,details=document.createElement('details');details.className='correction-original';details.open=true;
        const summary=document.createElement('summary');summary.textContent=initial.subject==='voucher'?'기존 매입매출전표 입력':'기존 일반전표 입력';details.append(summary);
        const fields=document.createElement('div');fields.className='correction-original-fields';details.append(fields);
        const field=(label,value)=>{const box=document.createElement('label');box.textContent=label;const input=document.createElement('input');input.type='text';input.value=value??'';input.setAttribute('aria-label','기존 전표 '+label);box.append(input);return box};
        const labels={date:'거래일',type:'유형',supply:'공급가액',vat:'부가세',supplier:'공급처',electronic:'전자',journal:'분개',zeroRate:'영세율구분',cardCompany:'카드사'};
        if(initial.date)fields.append(field('거래일',initial.date));
        for(const [key,value] of Object.entries(initial.voucher||{}))fields.append(field(labels[key]||key,typeof value==='number'?value.toLocaleString('ko-KR'):value));
        for(const row of initial.rows){const line=document.createElement('div');line.className='correction-original-row';for(const [label,value] of [['차대',row.side==='D'?'차변':'대변'],['계정과목',row.account+(row.division?'('+row.division+')':'')],['금액',Number(row.amount).toLocaleString('ko-KR')],['거래처',row.partner||'']])line.append(field(label,value));fields.append(line)}
        const check=before?.querySelector('.procedure-check');if(check)details.append(check);
        const button=document.createElement('button');button.type='button';button.className='btn secondary correction-delete';button.textContent='기존 전표 삭제';
        const status=document.createElement('p');status.className='correction-hint';status.setAttribute('role','status');
        button.addEventListener('click',()=>{const checkbox=check?.querySelector('input');if(checkbox){checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}))}fields.hidden=true;status.textContent='기존 전표 삭제 확인 · 아래 입력칸에 새 전표를 입력하세요.'});
        check?.querySelector('input')?.addEventListener('change',event=>{fields.hidden=event.target.checked;status.textContent=event.target.checked?'기존 전표 삭제 확인 · 아래 입력칸에 새 전표를 입력하세요.':''});
        details.append(button,status);(layout||card.querySelector('.prompt')).insertAdjacentElement('afterend',details);before?.remove();
      }
      if(layout&&!layout.querySelector('.exhibit,.table-scroll'))layout.classList.add('correction-prompt-only');
    });
  };
})();
