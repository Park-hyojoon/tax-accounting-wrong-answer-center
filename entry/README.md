# 공통 전표 입력기

일반전표 메뉴·매입매출전표 메뉴·출제위원 테스트는 이 폴더의 동일한 입력기를 사용한다. 별도의 간이 입력창이나 복사본을 만들지 않는다.

| 수정 대상 | 한 곳에서 수정할 파일 |
|---|---|
| 일반전표 입력 화면·금액 키·거래처·행 처리 | `practical.js` |
| 매입매출 윗단·카드/영세/불공 보조 항목·부가세 키·자동 분개 | `voucher.js` |
| 두 분야의 정답 판정·허용 답안·계정코드 178 | `grading.js` |
| 입력기 공통 배치 | `common.css` |
| 분야별 분개표/KcLep/증빙 배치 | `practical.css`, `voucher.css` |
| 출제위원용 공개 계정 선택 목록 | `accounts.js` |

색·글꼴·브랜드는 기존 `design/theme.css`가 계속 담당한다. 분야별 CSS는 `:where(.entry-practical)` / `:where(.entry-voucher)`로 범위를 제한한다.

일반 페이지는 `PracticalEntry.mount()` 또는 `VoucherEntry.mount()`를 호출한다. 기존 데이터·인덱스·`DIRECT_INTAKE_INDICES`·시즌·저장 키를 유지한다. 이후 등록되는 `daily-practice`도 직접 연습 목록에 포함한다.

출제위원은 `examiner-test/journal.js`가 문제와 기록만 연결한다. `mount({root,target,problems,state,save,embedded:true,onGrade})`로 동일한 입력기를 호출하고, 공통 입력 코드에 출제 지침/분석/AI 호출을 넣지 않는다. 선택한 분야의 코드와 CSS만 지연 로딩하며 일반 기출 데이터는 로딩하지 않는다.

`embedded:true`에서는 메뉴별 기록 저장/동기화/삭제·별표 기능을 설치하지 않는다. 초안·채점은 호출자가 제공한 `state`와 `save`에 전달한다. 출제위원 기록은 기존 별도 키·문제 ID·과거 사건을 보존하며, 렌더링/분야 전환만으로 새 학습 사건을 추가하지 않는다. 손상 기록을 읽으면 덮어쓰지 않고 입력·저장을 멈춘다.

검사: `node --test tests/shared-entry.cjs tests/accepted-exam-answers.test.cjs`, `node tests/shared-entry-browser.cjs`, 기존 전표 및 출제위원 브라우저 검사. 공통 JS 변경 후 `training-tool.cmd bump entry/<파일>.js`를 실행하고 출제위원 지연 로딩 주소도 같은 버전으로 맞춘다.
