/*
 * 학습자가 직접 전달한 원본 오답의 누적 근거.
 * 문제 배열/브라우저 학습상태와 별개이며, 연습문제 삭제로 지우지 않는다.
 * 새 제출을 확인할 때 고유 id로 추가한다. AI 응용문제나 단순 재전송은 추가하지 않는다.
 */
(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.TrainingMistakeIntakeData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    schemaVersion: 1,
    revision: 3,
    recordedOn: '2026-09-09',
    coverageNote: '과거 대화에서 원문을 직접 확인해 부분 복원한 29건과 2026-09-09에 새로 전달받은 8건을 합쳐 사용자 제출 오답 37건을 확인했다. 과거 전체 기간의 총 오답 수는 아니다. 과거 복원분은 실제 채팅 전달시각이 없어 reportedAt을 null로 두었고, registeredDate는 연결된 연습문제 등록일일 뿐 실제 오답 제출일이 아니다. 새 접수분은 확인 가능한 실제 전달일을 reportedAt에 기록한다. 문제 본문의 거래일자도 오답 제출일로 사용하지 않는다. 첨부파일 이름만 있거나 원문 근거가 부족한 과거 문제, 초기 기본문제, AI가 추가한 대비·응용문제는 실제 제출 횟수에 넣지 않았다.',
    topics: [
      { id: 'repair-expense-card', label: '수선비의 수익적 지출과 카드결제' },
      { id: 'zero-rate-confirmation', label: '구매확인서 영세율 매출' },
      { id: 'withholding-accounts', label: '원천징수와 선납세금·예수금 구분' },
      { id: 'prepaid-expenses', label: '선급비용과 기간별 비용 배분' },
      { id: 'bad-debt', label: '매출채권 대손처리' },
      { id: 'cash-sales-evidence', label: '현금판매의 증빙과 전표 유형' },
      { id: 'asset-disposal-receivable', label: '유형자산 매각과 미수금' },
      { id: 'retirement-pension', label: 'DB·DC 퇴직연금 계정 구분' },
      { id: 'vat-closing', label: '부가가치세 결산' },
      { id: 'asset-purchase-settlement', label: '자산 과세매입과 대금 정산' },
      { id: 'product-free-transfer', label: '제품 무상제공·기부의 과세 구분' },
      { id: 'foreign-exchange', label: '외화환산손익과 외환차손익 구분' },
      { id: 'exempt-lease-card', label: '면세 운용리스료와 카드채무' },
      { id: 'purchase-voucher-correction', label: '일반전표를 과세매입 전표로 수정' },
      { id: 'receivable-payable-settlement', label: '채권·채무 상계와 결제수단 구분' },
      { id: 'current-liability', label: '장기차입금의 유동성 대체' },
      { id: 'inventory-shrinkage', label: '비정상 재고자산감모' },
      { id: 'supplies-purchase', label: '소모품의 비용 처리와 현금영수증' },
      { id: 'supplies-allocation', label: '소모품 사용액과 부서별 배부' },
      { id: 'cash-shortage-closing', label: '현금과부족의 원인 규명과 결산' },
      { id: 'profit-versus-oci', label: '당기손익과 기타포괄손익 구분' },
      { id: 'ending-equity', label: '기말자본 계산' },
      { id: 'qualitative-characteristics', label: '재무정보의 목적적합성과 신뢰성' },
      { id: 'cash-equivalents', label: '현금및현금성자산의 범위' },
      { id: 'depreciation-calculation', label: '감가상각비 계산과 월할상각' },
      { id: 'costing-method-industry', label: '개별·종합원가계산 적용업종' },
      { id: 'overhead-allocation-variance', label: '제조간접원가 과대·과소배부' },
      { id: 'vat-tax-base', label: '부가가치세 과세표준 포함 여부' },
      { id: 'travel-advance-settlement', label: '출장 전도금 정산' },
      { id: 'vat-vehicle-deduction', label: '차량 유류대의 매입세액 공제 여부' }
    ],
    entries: [
      {
        id: 'original-machine-repair-660000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'repair-expense-card',
        title: '제조부 기계장치 수선비를 우리카드로 결제',
        originalCue: '2025.10.01. 제조부문 기계장치 수선비 660,000원을 ㈜최신테크에 우리카드로 결제하고 수익적 지출로 처리한다. 공급가액 600,000원, 부가세 60,000원, 수선비(제)·부가세대급금 / 미지급금(우리카드).',
        learnerReason: '사용자가 답안에 차·대변을 잘못 입력했다고 명시했다.',
        reportedAt: null, registeredDate: '2026-09-03', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 3, type: '신용카드 과세매입과 수익적 지출' }],
        provenance: '이 대화에서 사용자가 전달한 10월 01일 수선비 원문·답안과 “차,대변 잘못 입력” 설명.'
      },
      {
        id: 'original-zero-rate-sale-15000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'zero-rate-confirmation',
        title: '구매확인서 제품매출을 어음과 외상으로 회수',
        originalCue: '2025.11.18. ㈜월성상사에 구매확인서로 제품 15,000,000원을 판매하고 영세율전자세금계산서를 발급한다. 대금 40%는 어음, 나머지는 다음 달 회수: 받을어음 6,000,000원·외상매출금 9,000,000원 / 제품매출 15,000,000원.',
        learnerReason: '사용자가 대변 제품매출 옆에 “분개 실수”라고 명시했다. 더 세부적인 원인은 미확인이다.',
        reportedAt: null, registeredDate: '2026-09-03', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 4, type: '구매확인서에 의한 영세율 매출' }],
        provenance: '이 대화에서 사용자가 “오늘 틀린 문제들”로 전달한 11월 18일 구매확인서 원문·답안.'
      },
      {
        id: 'original-interest-withholding-300000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'withholding-accounts',
        title: '세후 이자수익의 원천징수 누락 수정',
        originalCue: '2025.09.30. 보통예금에 수령한 이자 1,500,000원을 전액 이자수익 처리했으나 이자소득세 300,000원 차감 후의 금액이었다. 보통예금 1,500,000원·선납세금 300,000원 / 이자수익 1,800,000원으로 수정한다.',
        learnerReason: '사용자가 선납세금 계정과목을 몰라서 틀렸다고 명시했다.',
        reportedAt: null, registeredDate: '2026-09-03', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'practical', id: 20, type: '이자수익 원천징수 수정' }],
        provenance: '이 대화의 보통예금 이자 원문과 사용자 설명. 전달 답안의 선납세금 1,300,000원은 원천징수액 300,000원과 대차 합계에 맞지 않는 오기로 구분했다.'
      },
      {
        id: 'original-prepaid-rent-4800000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'prepaid-expenses',
        title: '전액 비용 처리한 영업부 임차료의 결산',
        originalCue: '영업부 사무실 임차기간 2025.10.01.~2026.09.30., 임차료 4,800,000원을 개시일에 현금 지급하고 전액 비용 처리했다. 2025.12.31. 미경과 9개월분 선급비용 3,600,000원 / 임차료(판) 3,600,000원으로 대체한다.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-03', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'closing', id: 7, type: '선급비용 결산' }],
        provenance: '이 대화의 당일 오답 전달 흐름에서 사용자가 제시한 임차료 결산 원문·답안.'
      },
      {
        id: 'original-note-bad-debt-namu',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'bad-debt',
        title: '파산한 ㈜나무의 받을어음 대손처리',
        originalCue: '2025.08.01. ㈜나무에 제품을 매출하고 받은 받을어음 10,000,000원을 파산으로 대손처리한다. 대손충당금 10,000,000원 / 받을어음(㈜나무) 10,000,000원.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-04', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'practical', id: 21, type: '받을어음 대손처리' }],
        provenance: '이 대화에서 사용자가 “오늘 문제를 풀면서 틀린 것들”로 전달한 첫 번째 원문·답안.'
      },
      {
        id: 'original-cash-sale-no-receipt-22000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'cash-sales-evidence',
        title: '현금영수증 미발급 지역축제 제품판매',
        originalCue: '2025.07.31. 지역축제 관람객에게 제품을 공급대가 22,000원에 현금판매하고 요청이 없어 현금영수증을 발급하지 않았다. 14.건별, 공급가액 20,000원·부가세 2,000원, 현금 / 제품매출·부가세예수금.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-04', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 5, type: '현금영수증 미발급 현금매출' }],
        provenance: '이 대화에서 사용자가 당일 틀린 문제 묶음으로 전달한 07월 31일 지역축제 원문·답안.'
      },
      {
        id: 'original-machine-disposal-note-11000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'asset-disposal-receivable',
        title: '기계장치 매각대금을 약속어음으로 수령',
        originalCue: '2025.10.07. 기계장치 취득원가 70,000,000원·감가상각누계액 60,000,000원, ㈜천안중고에 부가세 포함 11,000,000원으로 매각하고 전자세금계산서를 발급했다. 대금은 상대 발행 약속어음으로 받아 미수금 11,000,000원으로 처리한다.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-04', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 6, type: '유형자산 과세매각과 약속어음 회수' }],
        provenance: '이 대화에서 사용자가 틀린 문제로 제시하며 “엄청 중요한 문제”라고 강조한 기계장치 매각 원문·답안. 중요도 강조를 추가 오답 횟수로 계산하지 않는다.'
      },
      {
        id: 'original-db-pension-correction-20000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'retirement-pension',
        title: 'DB형 퇴직연금 납입액의 DC형 처리 수정',
        originalCue: '2025.08.08. 제조부 직원 DB형 퇴직연금 당기분 20,000,000원을 보통예금에서 이체했으나 DC형으로 회계처리했다. 차변 퇴직급여(제)를 퇴직연금운용자산 20,000,000원으로 수정하고 대변 보통예금을 유지한다.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-04', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'practical', id: 22, type: '확정급여형 퇴직연금 수정' }],
        provenance: '이 대화에서 사용자가 당일 틀린 문제 묶음으로 전달한 DB형 퇴직연금 원문·수정 답안.'
      },
      {
        id: 'original-vat-closing-deduction-20000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'vat-closing',
        title: '공제세액이 있는 제2기 확정 부가세 결산',
        originalCue: '2025.12.31. 매출세액 1,700,000원, 매입세액 1,200,000원, 공제세액 20,000원, 차가감납부세액 480,000원. 부가세예수금 / 부가세대급금 1,200,000원·잡이익 20,000원·미지급세금 480,000원으로 결산한다.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-04', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'closing', id: 8, type: '부가가치세 정리' }],
        provenance: '이 대화에서 사용자가 당일 틀린 문제 묶음으로 전달한 제2기 확정 부가세 신고표와 답안.'
      },
      {
        id: 'original-signboard-bitnaneun-5500000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'asset-purchase-settlement',
        title: '빛나는간판 제작대금의 자산 처리와 혼합결제',
        originalCue: '2024.08.25. 건물 부착 간판 제작대금 5,500,000원(부가세 포함) 중 500,000원을 빛나는간판에 현금 지급하고 잔액은 다음 달 지급한다. 전자세금계산서를 수취하며 비품 5,000,000원·부가세대급금 500,000원 / 현금 500,000원·미지급금 5,000,000원.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-05', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 7, type: '과세매입·자산취득 혼합결제' }],
        provenance: '이 대화에서 사용자가 전달한 빛나는간판 원문·답안. 동일 금액·거래처·일자의 재첨부는 새로 틀렸다는 확정 근거가 없어 이 한 건으로 통합했다.'
      },
      {
        id: 'original-consumer-cash-receipt-nanuri',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'cash-sales-evidence',
        title: '비사업자 나누리에게 제품판매 후 현금영수증 발급',
        originalCue: '2024.10.02. 비사업자 나누리에게 제품을 부가세 포함 1,100,000원에 판매하고 현금 수령·현금영수증 발급했다. 22.현과, 공급가액 1,000,000원·부가세 100,000원, 공급처명 나누리, 분개 현금.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-05', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 8, type: '현금영수증 과세매출' }],
        provenance: '이 대화에서 사용자가 간판 문제와 함께 전달한 나누리 현금판매 원문·답안.'
      },
      {
        id: 'original-business-product-gift-600000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'product-free-transfer',
        title: '원재료 매입처에 접대용 제품 무상제공',
        originalCue: '2024.08.16. 원재료 매입 거래처에 접대목적으로 당사 제품 원가 600,000원·시가 1,100,000원을 무상제공한다. 14.건별, 기업업무추진비(제) / 제품 원가·부가세예수금, 제품 적요 8. 제공 답안은 시가를 공급가액 또는 공급대가로 해석하는 두 조합을 인정한다.',
        learnerReason: '이후 사용자가 거래처 접대용 무상제공과 국가·지방자치단체 기부의 전표 구분을 계속 헷갈린다고 설명했다.',
        reportedAt: null, registeredDate: '2026-09-05', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 9, type: '사업상 증여·제품 타계정 대체' }],
        provenance: '이 대화에서 “오늘 이런 문제들을 틀렸습니다”로 전달한 원재료 매입처 제품 증여 원문·답안. 뒤의 대비훈련 제작 요청은 새 오답 사건이 아니다.'
      },
      {
        id: 'original-fx-payable-moonchina-2000usd',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'foreign-exchange',
        title: '문차이나 외상매입금의 결산 환산손실',
        originalCue: '2024.12.31. 중국 거래처 문차이나 외상매입금 2,200,000원($2,000), 결산환율 1,120원/$. 외화환산손실 40,000원 / 외상매입금(문차이나) 40,000원.',
        learnerReason: '사용자가 결산정리사항의 외환차손익·외화환산손익 문제를 계속 틀린다고 명시했다.',
        reportedAt: null, registeredDate: '2026-09-05', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'closing', id: 9, type: '외화평가' }],
        provenance: '이 대화에서 사용자가 직접 제시한 문차이나 환산손실 원문·답안. 연결된 연습문제는 요청에 따라 환산이익 조건으로 바뀐 대비문제이므로 원문 조건과 구분한다.'
      },
      {
        id: 'original-prepaid-factory-insurance-720000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'prepaid-expenses',
        title: '선급비용으로 처리한 공장 화재보험료의 경과분',
        originalCue: '2024.10.01. 공장 화재보험료 720,000원을 보통예금에서 이체하고 전액 선급비용 처리했다. 보험기간 2024.10.01.~2025.09.30.; 2024.12.31. 3개월 경과분 보험료(제) 180,000원 / 선급비용 180,000원.',
        learnerReason: '사용자가 결산정리사항의 보험료·선급비용 문제를 계속 틀린다고 명시했다.',
        reportedAt: null, registeredDate: '2026-09-05', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'closing', id: 10, type: '보험료·선급비용 결산' }],
        provenance: '이 대화의 공장 화재보험료 원문·답안. 연결된 연습문제는 요청에 따라 최초 전액 비용 처리 조건으로 바뀐 대비문제이므로 원문 조건과 구분한다.'
      },
      {
        id: 'original-exempt-lease-daewoo-850000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'exempt-lease-card',
        title: '대우캐피탈 운용리스료를 국민카드로 결제',
        originalCue: '2025.09.20. 영업부 차량 운용리스료 850,000원의 전자계산서를 대우캐피탈에서 받고 국민카드로 결제했다. 53.면세, 임차료(판) 850,000원 / 미지급금(국민카드) 850,000원 또는 미지급비용.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-05', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 10, type: '면세 운용리스료·법인카드 결제' }],
        provenance: '이 대화의 오답 전달 흐름에서 사용자가 제시한 09월 20일 운용리스 원문·답안. 계산서의 사업자번호·연락처는 보관하지 않는다.'
      },
      {
        id: 'original-paju-product-donation-20000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'product-free-transfer',
        title: '파주시청에 판매용 제품 기부',
        originalCue: '2024.07.20. 파주시청에 판매용 제품 원가 20,000,000원·시가 35,000,000원을 기부했다. 일반전표로 기부금 20,000,000원 / 제품 20,000,000원, 제품 적요 8.',
        learnerReason: '사용자가 거래처에 접대목적으로 무상제공하는 매입매출전표 문제와 계속 헷갈린다고 직접 설명했다.',
        reportedAt: null, registeredDate: '2026-09-05', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'practical', id: 23, type: '지방자치단체 제품 기부' }],
        provenance: '이 대화에서 사용자가 제시한 파주시청 제품 기부 원문·답안 및 뒤이은 두 유형 혼동 설명. 요청으로 만든 추가 기부문제는 포함하지 않는다.'
      },
      {
        id: 'original-instructor-withholding-2500000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'withholding-accounts',
        title: '생산부 외부강사료 지급과 원천징수',
        originalCue: '2024.12.04. 생산부 직원 교육의 외부강사료 2,500,000원 중 원천징수 후 2,280,000원을 보통예금으로 지급했다. 교육훈련비(제) 2,500,000원 / 예수금 220,000원·보통예금 2,280,000원.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-05', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'practical', id: 26, type: '외부강사료 원천징수' }],
        provenance: '이 대화의 오답 전달 흐름에서 사용자가 제시한 외부전문가 강사료 원문·답안.'
      },
      {
        id: 'original-freight-chacha-330000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'purchase-voucher-correction',
        title: '차차운송 원재료 운송비의 일반전표 수정',
        originalCue: '2022.11.19. 원재료 매입 운송비 330,000원(부가세 포함)을 차차운송에 현금 지급하고 일반전표 처리했으나 별도 전자세금계산서를 받았다. 일반전표 삭제 후 51.과세, 원재료 300,000원·부가세대급금 30,000원 / 현금 330,000원.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-07', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 22, type: '원재료 매입부대비용·과세매입 수정' }],
        provenance: '이 대화에서 “오늘 틀린 문제들입니다”로 전달한 운송비 수정 원문·답안.'
      },
      {
        id: 'original-endorsement-sangmun-3000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'receivable-payable-settlement',
        title: '㈜상문 외상매입금 결제수단을 받을어음 배서로 수정',
        originalCue: '2023.07.06. ㈜상문 외상매입금 3,000,000원은 보통예금 이체가 아니라 제품판매로 받은 상명상사 발행 약속어음을 배서하여 지급했다. 외상매입금(㈜상문) / 받을어음(상명상사) 3,000,000원으로 수정한다.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-07', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'practical', id: 31, type: '받을어음 배서양도 수정' }],
        provenance: '이 대화에서 사용자가 당일 오답 묶음으로 전달한 ㈜상문 결제수단 수정 원문·답안.'
      },
      {
        id: 'original-factory-electricity-121000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'purchase-voucher-correction',
        title: '영업부 전기요금으로 처리한 제조공장 전력비 수정',
        originalCue: '2023.12.13. 전기요금 공급대가 121,000원을 현금 지급하고 영업부 일반전표로 처리했으나 제조공장 발생분이며 한국전력공사 전자세금계산서를 수취했다. 일반전표 삭제 후 51.과세, 전력비(제) 110,000원·부가세대급금 11,000원 / 현금 121,000원.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-07', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 23, type: '제조부 전력비·과세매입 수정' }],
        provenance: '이 대화에서 사용자가 당일 오답 묶음으로 전달한 전기요금 수정 원문·답안.'
      },
      {
        id: 'original-current-loan-daehan-50000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'current-liability',
        title: '대한은행 장기차입금의 1년 이내 만기 대체',
        originalCue: '2023.12.31. 대한은행 장기차입금 50,000,000원의 상환기일이 결산일 기준 1년 이내 도래한다. 장기차입금(대한은행) 50,000,000원 / 유동성장기부채(대한은행) 50,000,000원.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-07', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'closing', id: 12, type: '장기차입금 유동성 대체' }],
        provenance: '이 대화에서 사용자가 당일 오답 묶음으로 전달한 대한은행 장기차입금 원문·답안.'
      },
      {
        id: 'original-abnormal-inventory-loss-2000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'inventory-shrinkage',
        title: '도난·파손에 따른 비정상 제품 수량 부족',
        originalCue: '2022.12.31. 재고 실사에서 비정상적으로 발생한 도난·파손 제품 수량 부족의 원가 2,000,000원을 확인했다. 재고자산감모손실 2,000,000원 / 제품 2,000,000원, 제품 적요 8.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-07', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'closing', id: 13, type: '비정상 재고자산감모' }],
        provenance: '이 대화에서 사용자가 당일 오답 묶음으로 전달한 비정상 제품 감모 원문·답안.'
      },
      {
        id: 'original-nano-offset-5000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'receivable-payable-settlement',
        title: '나노컴퓨터 채권·채무 상계 후 당좌수표 지급',
        originalCue: '2023.07.04. 나노컴퓨터 외상매입금 5,000,000원과 외상매출금 3,000,000원을 상계하고 잔액을 당좌수표로 지급했다. 외상매입금(나노컴퓨터) / 외상매출금(나노컴퓨터) 3,000,000원·당좌예금 2,000,000원.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-09', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'practical', id: 43, type: '매입채무·매출채권 상계' }],
        provenance: '이 대화에서 사용자가 “방금 문제를 풀었는데요. 틀린 문제들입니다”로 전달한 나노컴퓨터 원문·답안.'
      },
      {
        id: 'original-land-building-daegwanryeong-370000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'asset-purchase-settlement',
        title: '㈜대관령 토지·건물 일괄취득과 계약금 정산',
        originalCue: '2023.08.25. 본사 사무실 상가를 ㈜대관령에서 370,000,000원에 취득했다. 토지 150,000,000원, 건물 220,000,000원(부가세 포함), 7월 25일 계약금 37,000,000원, 잔금 보통예금 333,000,000원. 건물분 전자세금계산서를 받고 하나의 혼합전표로 토지·건물·부가세대급금 / 선급금·보통예금 처리한다.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-09', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 28, type: '토지·건물 일괄취득과 계약금 정산' }],
        provenance: '이 대화에서 사용자가 당일 틀린 문제로 전달한 ㈜대관령 상가취득 원문·표·답안.'
      },
      {
        id: 'original-supplies-goldfarm-385000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'supplies-purchase',
        title: '골드팜㈜ 총무부 소모품 구입과 지출증빙',
        originalCue: '2023.09.15. 총무부 소모품을 골드팜㈜에서 총 385,000원에 구입하고 보통예금 이체·지출증빙용 현금영수증을 받았으며 즉시 비용 처리한다. 제공 답안에는 61.현과(소모품비(판) 350,000원·부가세대급금 35,000원) 또는 62.현면(소모품비(판) 385,000원) 두 방식이 실려 있다.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-09', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'voucher', id: 29, type: '현금영수증 과세매입·소모품비' }],
        provenance: '이 대화에서 사용자가 당일 틀린 문제로 전달한 골드팜㈜ 원문·답안. 연결된 훈련문제는 일반 과세 소모품 조건으로 61.현과만 채점하므로 전달 원문의 복수답안과 구분한다.'
      },
      {
        id: 'original-supplies-allocation-3000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'supplies-allocation',
        title: '자산 처리한 소모품 사용액을 영업부·생산부에 배부',
        originalCue: '2023.02.11. 소모품 3,000,000원을 자산 처리했고 12월 31일 잔량은 500,000원이다. 사용액 2,500,000원을 영업부 25%·생산부 75% 배부: 소모품비(판) 625,000원·소모품비(제) 1,875,000원 / 소모품 2,500,000원.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-09', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'closing', id: 15, type: '소모품 결산·부서별 배부' }],
        provenance: '이 대화의 당일 오답 전달 흐름에서 사용자가 제시한 소모품 결산 원문·두 분개 방식·계산식.'
      },
      {
        id: 'original-cash-shortage-235000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'cash-shortage-closing',
        title: '현금 부족액 중 유류대 확인과 원인불명 잔액 처리',
        originalCue: '2023.12.31. 기중 현금과부족으로 계상한 부족액 235,000원 중 150,000원은 영업부 업무용 자동차 유류대 지급으로 확인되었고 잔액은 원인불명이다. 차량유지비(판) 150,000원·잡손실 85,000원 / 현금과부족 235,000원.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-09', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'closing', id: 16, type: '현금과부족 원인 규명·잔액 결산' }],
        provenance: '이 대화의 당일 오답 전달 흐름에서 사용자가 제시한 현금과부족 원문·답안.'
      },
      {
        id: 'original-profit-securities-property-100000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'profit-versus-oci',
        title: '증권 평가와 투자부동산 처분이 당기순이익에 미치는 영향',
        originalCue: '매도가능증권 장부 5,000,000원→공정가치 4,500,000원, 단기매매증권 장부 3,000,000원→공정가치 3,300,000원, 투자부동산 장부 9,000,000원→처분 8,800,000원. 당기순이익은 300,000원−200,000원=100,000원 증가(②), 매도가능증권 평가손실은 기타포괄손익누계액.',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-09', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'theory', id: 'net-income-securities-property-20260909', type: '당기순이익 증감 계산' }],
        provenance: '이 대화에서 사용자가 “이번에는 이론 문제”로 전달한 증권·투자부동산 원문·보기·답안.'
      },
      {
        id: 'original-ending-equity-suamgol-650000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'ending-equity',
        title: '㈜수암골 기초자본과 당기 변동으로 기말자본 계산',
        originalCue: '㈜수암골 기초자산 900,000원·기초부채 500,000원, 기말부채 750,000원, 추가출자 100,000원·배당 50,000원·총수익 1,100,000원·총비용 900,000원. 기말자본은 400,000원+100,000원−50,000원+200,000원=650,000원(④).',
        learnerReason: null,
        reportedAt: null, registeredDate: '2026-09-09', dateBasis: 'training-registration',
        practiceRefs: [{ source: 'theory', id: 'ending-equity-equation-20260909', type: '기말자본 계산' }],
        provenance: '이 대화에서 사용자가 “이번에는 이론 문제”로 전달한 ㈜수암골 기말자본 원문·표·보기·답안.'
      },
      {
        id: 'original-relevance-characteristics-neutrality',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'qualitative-characteristics',
        title: '목적적합성에 해당하지 않는 질적특성',
        originalCue: '재무정보가 정보이용자의 의사결정 목적과 관련되어야 한다는 설명을 제시하고 예측가치·피드백가치·적시성·중립성 중 목적적합성에 해당하지 않는 항목을 묻는다. 정답은 ④ 중립성이다.',
        learnerReason: null,
        reportedAt: '2026-09-09', registeredDate: '2026-09-09',
        practiceRefs: [{ source: 'theory', id: 'qualitative-relevance-20260909', type: '재무정보의 질적특성' }],
        provenance: '이 대화에서 사용자가 “틀린 문제들입니다. 이론과 일반전표입력입니다”로 전달한 첫 번째 이론 원문·보기·답안.'
      },
      {
        id: 'original-cash-equivalents-1000000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'cash-equivalents',
        title: '현금및현금성자산 해당 항목 합계',
        originalCue: '선일자수표 500,000원, 타인발행수표 500,000원, 배당금지급통지서 500,000원, 만기 6개월 양도성예금증서 300,000원 중 현금및현금성자산 합계를 묻는다. 타인발행수표와 배당금지급통지서 합계 1,000,000원이 정답이다.',
        learnerReason: null,
        reportedAt: '2026-09-09', registeredDate: '2026-09-09',
        practiceRefs: [{ source: 'theory', id: 'cash-equivalents-total-20260909', type: '현금및현금성자산' }],
        provenance: '이 대화에서 사용자가 전달한 현금및현금성자산 원문·표 이미지·보기·답안.'
      },
      {
        id: 'original-declining-balance-depreciation-3487500',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'depreciation-calculation',
        title: '정률법 기계장치의 취득연도 월할상각과 차년도 감가상각',
        originalCue: '기계장치 취득일 2022.07.01., 취득원가 10,000,000원, 정률 45%, 내용연수 5년, 잔존가치 500,000원. 2022년 6개월분 감가상각누계액 2,250,000원을 차감한 장부금액에 45%를 적용한 2023년 감가상각비 3,487,500원이 정답이다.',
        learnerReason: null,
        reportedAt: '2026-09-09', registeredDate: '2026-09-09',
        practiceRefs: [{ source: 'theory', id: 'declining-balance-depreciation-20260909', type: '감가상각비 계산' }],
        provenance: '이 대화에서 사용자가 전달한 기계장치 감가상각 원문·자료 이미지·보기·답안.'
      },
      {
        id: 'original-job-order-costing-construction',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'costing-method-industry',
        title: '개별원가계산 적용 업종 판단',
        originalCue: '제분업·정유업·건설업·식품가공업 중 개별원가계산을 적용할 수 있는 업종을 묻는다. 정답은 ③ 건설업이며 나머지는 종합원가계산에 적합하다.',
        learnerReason: null,
        reportedAt: '2026-09-09', registeredDate: '2026-09-09',
        practiceRefs: [{ source: 'theory', id: 'job-order-industry-20260909', type: '개별원가계산 적용업종' }],
        provenance: '이 대화에서 사용자가 전달한 개별원가계산 적용업종 원문·보기·답안.'
      },
      {
        id: 'original-overhead-underallocated-50000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'overhead-allocation-variance',
        title: '제조간접원가 예정배부와 과소배부 판단',
        originalCue: '예상 직접노무시간 50,000시간, 제조간접원가 예상액 2,500,000원으로 예정배부율 50원/시간을 계산한다. 6월 실제 직접노무시간 5,000시간의 예정배부액은 250,000원이고 실제발생액 300,000원과의 차이 50,000원은 과소배부이다.',
        learnerReason: null,
        reportedAt: '2026-09-09', registeredDate: '2026-09-09',
        practiceRefs: [{ source: 'theory', id: 'overhead-variance-20260909', type: '제조간접원가 배부차이' }],
        provenance: '이 대화에서 사용자가 전달한 제조간접원가 배부차이 원문·보기·계산식·답안.'
      },
      {
        id: 'original-vat-tax-base-sales-discount',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'vat-tax-base',
        title: '부가가치세 과세표준에서 제외되는 매출할인액',
        originalCue: '할부판매 시 이자상당액·개별소비세·매출할인액·대가 일부로 받는 운송비 중 부가가치세 과세표준에 포함하지 않는 항목을 묻는다. 정답은 ③ 매출할인액이다.',
        learnerReason: null,
        reportedAt: '2026-09-09', registeredDate: '2026-09-09',
        practiceRefs: [{ source: 'theory', id: 'vat-tax-base-exclusion-20260909', type: '부가가치세 과세표준' }],
        provenance: '이 대화에서 사용자가 전달한 부가가치세 과세표준 원문·보기·답안.'
      },
      {
        id: 'original-withheld-payroll-tax-payment-22000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'withholding-accounts',
        title: '급여에서 원천징수한 세액의 납부',
        originalCue: '2023.07.10. 6월 관리부 직원 급여에서 원천징수한 근로소득세 20,000원과 지방소득세 2,000원을 보통예금으로 납부한다. 예수금 22,000원 / 보통예금 22,000원으로 처리한다.',
        learnerReason: null,
        reportedAt: '2026-09-09', registeredDate: '2026-09-09',
        practiceRefs: [{ source: 'practical', id: 44, type: '원천징수세액 납부' }],
        provenance: '이 대화에서 사용자가 일반전표 오답으로 전달한 원천징수세액 납부 원문·답안.'
      },
      {
        id: 'original-travel-advance-return-600000',
        source: 'user-submitted', evidenceStatus: 'confirmed', topicId: 'travel-advance-settlement',
        title: '출장 전도금의 실제 지출과 현금 잔액 반납',
        originalCue: '2023.08.20. 영업부 김시성 과장이 대구세계가구박람회 출장 후 전도금 600,000원을 정산한다. 왕복항공권 350,000원과 식대 30,000원의 여비교통비(판) 380,000원, 현금 반납 220,000원 / 전도금 600,000원으로 처리한다.',
        learnerReason: null,
        reportedAt: '2026-09-09', registeredDate: '2026-09-09',
        practiceRefs: [{ source: 'practical', id: 45, type: '출장비 정산' }],
        provenance: '이 대화에서 사용자가 일반전표 오답으로 전달한 출장 정산 원문·지출결의서 이미지·답안.'
      },
      {id:'original-business-gift-product-300000-500000',source:'user-submitted',evidenceStatus:'confirmed',topicId:'product-free-transfer',title:'원재료 매입 거래처에 접대 목적으로 제품 무상제공',originalCue:'2023.08.10. 원재료 매입 거래처에 접대 목적으로 원가 300,000원·시가 500,000원의 제품을 무상 제공한다. 14.건별, 공급가액 500,000원·부가세 50,000원, 혼합분개로 기업업무추진비(제) 350,000원 / 부가세예수금 50,000원·제품 300,000원(적요 8)으로 처리한다.',learnerReason:'사용자가 너무 중요한 문제라고 강조하고 같은 구조의 훈련문제 2개를 요청했다.',reportedAt:'2026-09-09',registeredDate:'2026-09-09',practiceRefs:[{source:'voucher',id:30,type:'사업상증여·거래처 무상제공'},{source:'voucher',id:31,type:'사업상증여·거래처 무상제공'}],provenance:'이 대화에서 사용자가 전달한 매입매출전표 원문·답안.'},
      {id:'original-deductible-small-car-fuel-card-44000',source:'user-submitted',evidenceStatus:'confirmed',topicId:'vat-vehicle-deduction',title:'매입세액 공제 가능한 소형승용차 유류대의 카드면세 수정',originalCue:'2023.08.17. 영업부 비영업용 소형승용차 800㏄의 경유대 44,000원을 비씨카드로 결제한 거래를 58.카면으로 입력했으나, 매입세액공제 가능 차량이므로 57.카과의 공급가액 40,000원·부가세 4,000원으로 수정한다.',learnerReason:null,reportedAt:'2026-09-09',registeredDate:'2026-09-09',practiceRefs:[{source:'voucher',id:32,type:'소형승용차 유류대·카드면세 수정'}],provenance:'이 대화에서 사용자가 전달한 매입매출전표 수정 원문·답안.'},
      {id:'original-manufacturing-truck-depreciation-30000000',source:'user-submitted',evidenceStatus:'confirmed',topicId:'depreciation-calculation',title:'제조부 화물차의 정액법 감가상각',originalCue:'2023.04.15. 취득원가 30,000,000원·잔존가치 0원·내용연수 5년·정액법인 제조부 화물차 포터의 2023년 감가상각비를 계산한다. 답안은 4,500,000원, 4,250,000원 또는 4,290,410원을 인정하고 감가상각비(제) / 감가상각누계액으로 처리한다.',learnerReason:null,reportedAt:'2026-09-09',registeredDate:'2026-09-09',practiceRefs:[{source:'closing',id:17,type:'차량운반구 감가상각·월할계산'}],provenance:'이 대화에서 사용자가 전달한 결산자료·일반전표 답안과 차량 자료 이미지.'}
    ],
    signals: [
      {
        id: 'learner-recurrence-foreign-exchange', topicId: 'foreign-exchange', source: 'user-statement',
        statement: '학습자는 결산정리사항의 “외환차손익, 외화환산손익” 관련 문제를 계속 틀린다고 직접 설명하고 다른 조건의 추가 문제를 요청했다. 반복 횟수와 실제 발생일은 특정하지 않았다.'
      },
      {
        id: 'learner-recurrence-prepaid-insurance', topicId: 'prepaid-expenses', source: 'user-statement',
        statement: '학습자는 결산정리사항의 “보험료, 선급비용” 관련 문제를 계속 틀린다고 직접 설명하고 다른 조건의 추가 문제를 요청했다. 반복 횟수와 실제 발생일은 특정하지 않았다.'
      },
      {
        id: 'learner-confusion-free-gift-recipient', topicId: 'product-free-transfer', source: 'user-statement',
        statement: '학습자는 거래처 접대용 제품 무상제공과 국가·지방자치단체 제품 기부가 비슷하게 보여 일반전표·매입매출전표 판단을 계속 헷갈린다고 설명했다. 이에 각 2개의 대비훈련을 요청했으며 그 추가 문제 수는 새 실제 오답 횟수가 아니다.'
      }
    ],
    notes: [
      '초기 부분 복원 29건과 2026-09-09 신규 접수 8건, 합계 37건은 직접 확인한 원본 오답 사건의 보수적인 최소 기록이다. 초기 등록문제 전체나 학습기록의 오답 횟수를 역산하여 과거 사건을 채우지 않는다.',
      '빛나는간판 5,500,000원 문제는 대화에 여러 번 등장하지만 새 회차에서 다시 틀렸다는 확정 근거가 없어 한 번만 집계했다. 이후 실제 재오답이 확인되면 별도 사건 ID와 그 근거로 추가한다.',
      'AI가 만든 일반전표 34·35 특별훈련 응용문제, 요청된 일반전표 24·25 기부 대비문제, 매입매출전표 11·12 접대 대비문제는 원본 제출 사건에서 제외했다. 변형문제에 등록일이 있어도 실제 오답이 확인되지 않으면 제출 횟수는 증가하지 않는다.',
      'practiceRefs는 현재 연습문제와의 학습 연결이다. 원문의 숫자·거래처·조건이 그대로라는 뜻이 아니다. 특히 결산 9는 원문 환산손실에서 연습 환산이익으로, 결산 10은 최초 선급비용 처리에서 최초 비용 처리로 조건을 바꾸어 제작되었다.',
      '연습문제가 정답 통과·삭제되어도 직접 제출한 원본 사건은 유지한다. 삭제한 문제의 답안·채점 이력을 복원하거나 훈련 목록에 되살리는 용도로 사용하지 않는다.',
      '빈 답안 채점과 날짜 누락은 사용자가 수기 풀이·입력시간 절약으로 설명했으므로 이 기록의 신규 오답 사건이나 원인으로 넣지 않는다.',
      'signals는 사용자가 직접 설명한 반복 혼동의 정성 근거다. 횟수나 날짜를 추정하지 않으며 entries의 제출 건수와 합산하지 않는다.',
      '첨부 증빙의 사업자등록번호·주민번호·연락처·카드번호·전자문서 승인번호는 원본 오답의 판단에 필요하지 않아 이 기록에 복사하지 않았다.'
    ]
  };
});
