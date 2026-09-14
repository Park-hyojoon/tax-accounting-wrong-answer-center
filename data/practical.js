function loadTrainingProblems(){
  const problems=[
  {type:'보험료 기간배분과 선급비용',title:'영업부 차량 보험료의 결산 정리',addedDate:'2026-09-14',prompt:'영업부 차량의 보험기간은 2026년 7월 1일부터 2027년 6월 30일까지이다. 2026년 7월 1일 연간 보험료 1,800,000원을 법인카드로 결제하고 전액 보험료(판관비)로 처리하였다. 보험료를 월할 계산하여 2026년 12월 31일 결산정리분개를 하시오.',explanation:'결산일까지 6개월분 900,000원은 비용이고, 다음 연도 6개월분 900,000원은 선급비용입니다. 이미 전액을 비용으로 처리했으므로 미경과분을 선급비용으로 대체합니다.',accountSelect:true,accountOptions:['선급비용','보험료','미지급금','복리후생비','임차료','보통예금'],answers:[A('D','선급비용',900000),A('C','보험료',900000,'판')],id:'exam-121-practical-0',examRound:121,sourceQuestionNo:'실무-영업부 차량 보험료',intakeId:'exam121-practical-prepaid-insurance-20260914',tags:['결산분개','보험료','선급비용','월할계산']},
  {type:'기간경과 이자비용과 미지급비용',title:'장기차입금 이자의 결산 정리',addedDate:'2026-09-14',prompt:'동해은행에서 2026년 9월 1일 2년 만기 조건으로 150,000,000원을 차입하였다. 원리금은 만기에 일시 상환하고 연 이자율은 7.2%이다. 월할 계산하여 2026년 12월 31일 현재 기간경과분 이자에 대한 결산정리분개를 하시오.',explanation:'기간경과분은 9월부터 12월까지 4개월입니다. 150,000,000원×7.2%×4/12=3,600,000원이므로 이자비용과 미지급비용을 인식합니다.',accountSelect:true,accountOptions:['이자비용','미지급비용','미수수익','선급비용','장기차입금','보통예금'],answers:[A('D','이자비용',3600000),A('C','미지급비용',3600000)],id:'exam-121-practical-1',examRound:121,sourceQuestionNo:'실무-차입금 기간경과 이자',intakeId:'exam121-practical-accrued-interest-20260914',tags:['결산분개','이자비용','미지급비용','월할계산']}
];
  return problems;
}
