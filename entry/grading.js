(function(root,factory){
  'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EntryGrading=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const REQUIRED_ACCOUNT_CODES={매도가능증권:'178'};
  const TYPES={sales:['11.과세','12.영세','13.면세','14.건별','15.간이','16.수출','17.카과','18.카면','19.카영','20.면건','21.전자','22.현과','23.현면','24.현영'],purchase:['51.과세','52.영세','53.면세','54.불공','55.수입','56.금전','57.카과','58.카면','59.카영','60.면건','61.현과','62.현면']};
  const CARD_TYPES=new Set(['17.카과','18.카면','19.카영','57.카과','58.카면','59.카영']);
  const ZERO_RATE_TYPES=new Set(['12.영세','16.수출','19.카영','24.현영','52.영세','59.카영']);
  const DEDUCT_REASON_TYPES=new Set(['54.불공']);
  const CARD_COMPANIES=['국민카드','삼성카드','신한카드','우리카드','하나카드','비씨카드','롯데카드','현대카드'];
  const ZERO_RATE_REASONS=['①직접수출(대행수출 포함)','②중계무역 수출','③내국신용장·구매확인서에 의한 공급'];
  const DEDUCT_REASONS=['①필요적 기재사항 누락 등','②사업과 직접 관련 없는 지출','③비영업용 소형승용자동차 구입·유지 및 임차','④기업업무추진비 및 이와 유사한 비용 관련','⑤면세사업 등 관련','⑥토지의 자본적 지출 관련','⑦사업자등록 전 매입세액','⑧금·구리 스크랩 거래계좌 미사용 관련 매입세액'];
  const num=value=>Number(String(value||'').replace(/[^0-9-]/g,''))||0;
  const normText=value=>String(value||'').normalize('NFKC').replace(/[\s()·._-]/g,'').toLowerCase();
  const normMemo=value=>normText(value).replace('적요','').replace('적용','');
  const normSupplier=value=>String(value||'').normalize('NFKC').replace(/\(주\)|주식회사|[\s._-]/g,'').toLowerCase();
  function accountParts(value){
    if(value&&typeof value==='object')return{name:String(value.name||value.account||''),code:String(value.code||''),division:value.division||''};
    const raw=String(value||''),parts=raw.split('|');
    if(parts.length>=2&&/^\d+$/.test(parts[0]))return{code:parts[0],name:parts[1],division:parts[2]||''};
    if(parts.length>=2)return{code:'',name:parts[0],division:parts[1]||''};
    return{code:'',name:raw,division:''};
  }
  function practicalMatch(row,answer,problem={}){
    const account=accountParts(row.accountValue||row.account),code=row.accountCode||account.code;
    const required=problem.requiredAccountCodes?.[answer.account]||REQUIRED_ACCOUNT_CODES[answer.account];
    return row.side===answer.side&&answer.account.split('/').map(normText).includes(normText(account.name))&&(!required||code===String(required))&&num(row.amount)===answer.amount&&(answer.division?row.division===answer.division:!row.division)&&(answer.partner?normText(row.partner)===normText(answer.partner):!row.partner)&&(!answer.memo||normMemo(row.memo)===normMemo(answer.memo));
  }
  function practical(problem,input){
    const rows=input.filter(row=>row.filled!==false&&(row.account||num(row.amount)||row.division||row.partner||row.memo));let best=null;
    for(const set of [problem.answers,...(problem.alternateAnswers||[])]){
      const used=new Set(),hits=[];
      for(const answer of set){const found=rows.find((row,index)=>!used.has(index)&&practicalMatch(row,answer,problem));if(found){used.add(rows.indexOf(found));hits.push(found)}}
      const ok=hits.length===set.length&&rows.length===set.length;
      if(!best||(ok&&!best.ok)||(!best.ok&&hits.length>best.hits.length))best={set,used,hits,ok};
      if(best.ok)break;
    }
    return {...best,matched:best.hits.length};
  }
  const normSummary=value=>/^8(?:\D|$)/.test(String(value||'').trim())?'8':String(value||'').trim();
  function aggregate(list,defaultCodes={}){
    const map=new Map();list.filter(row=>row.account||num(row.amount)||row.division).forEach(row=>{
      const parsed=accountParts(row.accountValue||row.account),account=parsed.name,accountCode=String(row.accountCode||parsed.code||defaultCodes[account]||''),key=[row.side,account,accountCode,row.division||''].join('|'),summary=normSummary(row.summary);
      if(!map.has(key))map.set(key,{side:row.side,account,accountCode,division:row.division||'',amount:0,summary:'',summaries:[]});
      const item=map.get(key);item.amount+=num(row.amount);if(summary&&!item.summaries.includes(summary))item.summaries.push(summary);if(!item.summary&&summary)item.summary=summary;
    });return [...map.values()];
  }
  function rowsEqual(user,answer,requiredCodes={}){
    const u=aggregate(user),a=aggregate(answer,requiredCodes),used=new Set();let matched=0;
    a.forEach(row=>{const index=u.findIndex((input,index)=>!used.has(index)&&input.side===row.side&&input.account===row.account&&input.accountCode===row.accountCode&&input.amount===row.amount&&input.division===row.division&&(!row.summary||input.summaries.includes(row.summary)));if(index>=0){used.add(index);matched++}});
    return{ok:matched===a.length&&u.length===a.length,matched,total:a.length};
  }
  function rowsEqualForGrade(user,answer,requiredCodes=REQUIRED_ACCOUNT_CODES){
    const exact=rowsEqual(user,answer,requiredCodes);if(exact.ok)return exact;
    const partial=rowsEqual(user.filter(row=>row.autoRole!=='counter'),answer,requiredCodes);return partial.ok?partial:(partial.matched>exact.matched?partial:exact);
  }
  function voucher(problem,entry,input){
    const expected=problem.voucher,accepted=problem.acceptedAmounts||[[expected.supply,expected.vat]];
    const checks={procedure:!problem.requiresDeletion||entry.deleted,date:entry.date===expected.date,type:(problem.acceptedTypes?.length?problem.acceptedTypes:[expected.type]).includes(entry.type),supply:accepted.some(([s])=>num(entry.supply)===s),vat:accepted.some(([,t])=>num(entry.vat)===t),supplier:problem.supplierOptional||normSupplier(entry.supplier)===normSupplier(expected.supplier),electronic:expected.electronic===null||entry.electronic===expected.electronic,cardCompany:!CARD_TYPES.has(expected.type)||!expected.cardCompany||entry.cardCompany===expected.cardCompany,serviceFee:expected.serviceFee==null||num(entry.serviceFee)===num(expected.serviceFee),zeroRate:!expected.zeroRate||entry.zeroRate===expected.zeroRate,deductReason:!expected.deductReason||entry.deductReason===expected.deductReason};
    // 대체 허용 금액이 있으면 공급가액·세액은 같은 허용 조합이어야 한다.
    const amount=accepted.some(([s,t])=>num(entry.supply)===s&&num(entry.vat)===t);
    if(!amount&&checks.supply&&checks.vat){checks.supply=false;checks.vat=false}
    let chosen=null,rowCheck={ok:false,matched:0,total:0};
    for(const variant of problem.variants){if(entry.journal!==variant.journal)continue;if(variant.supply!==undefined&&(num(entry.supply)!==variant.supply||num(entry.vat)!==variant.vat))continue;const result=rowsEqualForGrade(input,variant.rows,problem.requiredAccountCodes||REQUIRED_ACCOUNT_CODES);if(result.ok){chosen=variant;rowCheck=result;break}if(result.matched>rowCheck.matched)rowCheck=result}
    checks.journal=Boolean(chosen);
    const labels={procedure:'기존 일반전표 삭제',date:'거래일자',type:'유형',supply:'공급가액',vat:'세액',supplier:'공급처',electronic:'전자 여부',cardCompany:'신용카드사',serviceFee:'봉사료',zeroRate:'영세율 구분',deductReason:'불공제사유',journal:'분개 선택·계정·판/제·적요'};
    return{checks,chosen,rowCheck,correct:Object.values(checks).every(Boolean),wrongLabels:Object.keys(checks).filter(key=>!checks[key]).map(key=>labels[key])};
  }
  return{REQUIRED_ACCOUNT_CODES,TYPES,CARD_TYPES,ZERO_RATE_TYPES,DEDUCT_REASON_TYPES,CARD_COMPANIES,ZERO_RATE_REASONS,DEDUCT_REASONS,accountParts,num,normText,normMemo,normSupplier,practicalMatch,practical,aggregate,rowsEqual,rowsEqualForGrade,voucher};
});
