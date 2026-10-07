// Exercise the same visible controls used by a learner (no legacy hidden form).
module.exports=async function fillEntry(page,id){
  await page.evaluate(id=>{
    const q=[...(window.ExaminerJournalLibrary||[]).flatMap(p=>p.items),...window.ExaminerJournalBank].find(q=>q.id===id),card=document.querySelector('[data-id="'+id+'"]');
    const set=(selector,value,event='change',root=card)=>{const input=root.querySelector(selector);if(!input)throw Error('Missing '+selector);input.value=String(value??'');input.dispatchEvent(new Event(event,{bubbles:true}))};
    if(q.voucher){const v=q.voucher;set('.trade-mode',/^[12]/.test(v.type)?'sales':'purchase');const [y,m,d]=v.date.split('-');set('.date-year',Number(y));set('.date-month',Number(m));set('.date-day',Number(d));set('.voucher-type',v.type);for(const [selector,value]of Object.entries({'.supplier':v.supplier,'.electronic':v.electronic,'.journal':v.journal,'.card-company':v.cardCompany,'.zero-rate':v.zeroRateType,'.deduct-reason':v.deductReason})){if(value!==undefined&&value!==null)set(selector,value)}set('.supply',v.supply,'input');set('.vat',v.vat,'input')}
    const rows=[...card.querySelectorAll('.entry-row')];
    for(const row of rows){delete row.dataset.autoRole;for(const el of row.querySelectorAll('input,select')){if(!el.classList.contains('side'))el.value=''}}
    q.rows.forEach((answer,index)=>{const row=rows[index];set('.side',answer.side,'change',row);const field=row.querySelector('.account'),option=[...field.options].find(o=>{const a=EntryGrading.accountParts(o.value);return a.name===answer.account&&(!answer.division||!q.voucher||a.division===answer.division)});if(!option)throw Error('No account '+answer.account);set('.account',option.value,'change',row);if(q.voucher){set(answer.side==='D'?'.debit-amount':'.credit-amount',answer.amount,'input',row)}else{set('.division',answer.division||'','change',row);set('.partner',answer.partner||'','change',row);set('.memo',answer.memo||'','input',row);set('.amount',answer.amount,'input',row)}});
  },id);
};
