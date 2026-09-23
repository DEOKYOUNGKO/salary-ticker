# 규칙
- 응답은 항상 한국어로.

# 제품
월급을 입력하면 현재 시각 기준으로 번 돈이 초 단위로 올라가는 작은 위젯 창. 바탕화면 위에 떠 있음.

# 기술 스택
Tauri 2 + React + TypeScript + Vite, npm, 테스트는 Vitest.
Tauri 플러그인: store, autostart, notification, window-state.
서버/DB 없음. 모든 데이터는 로컬 저장.

# 계산 엔진 (최우선 원칙)
- 타이머로 += 누적하는 방식 금지. (now: Date, settings)를 받아 매번 새로 계산하는 순수 함수로 구현.
- src/engine/에 두고 UI와 완전히 분리.
- 근무시간 모드: 초당 금액 = 월급 ÷ (급여 기간 근무일 수 × 하루 실근무 초). 근무 요일의 출근~퇴근 사이에만 증가. 점심시간, 휴일, 출근 전, 퇴근 후에는 증가 없음.
- 24시간 모드: 초당 금액 = 월급 ÷ (급여 기간 총 초).
- 출력: 오늘 번 돈, 기간 누적, 초당 금액, 시급 환산, 오늘 진행률, 상태(출근 전/근무 중/점심/퇴근/휴일), 다음 상태까지 남은 시간.

# 설정 스키마
monthlySalary, mode('work'|'24h'), workStart, workEnd, lunch({start,end}|null),
workDays(number[], 기본 월~금), periodStartDay(기본 1), excludeHolidays, autoStart, theme,
widget{opacity, compact, placement('top'|'bottom'), clickThrough}

# 창
widget: 340x230, decorations false, transparent true, shadow false, alwaysOnTop true, skipTaskbar true, resizable false.
- html/body 배경 투명, 내용은 둥근 카드 하나.
- 카드 상단에 data-tauri-drag-region. capabilities에 core:window:allow-start-dragging 추가.
- 첫 위치는 주 모니터 오른쪽 아래(작업표시줄 위). 이후 위치 기억. 저장 위치가 화면 밖이면 기본 위치로 복귀.
- 100ms마다 갱신, 소수점 두 자리 표시. 창이 숨겨져 있으면 갱신 중지.
- 닫기 버튼은 종료가 아니라 숨김.
settings: 제목 표시줄 있는 일반 창. 위젯 톱니바퀴 또는 트레이 메뉴로 열림.
트레이: 툴팁에 오늘 번 돈. 메뉴는 위젯 보이기/숨기기, 설정, 종료.

# 첫 실행
저장된 월급이 없으면 위젯 대신 settings 창을 화면 가운데에 띄움.
입력 항목: 월급(필수, 콤마 자동 표시), 계산 방식, 출퇴근 시간(기본 09:00~18:00), 점심 제외(기본 12:00~13:00), Windows 시작 시 자동 실행(기본 켬).
입력 중 초당 금액과 시급 미리보기 표시. 잘못된 입력은 필드 아래 에러 표시.
"시작하기" → 저장 → settings 닫기 → widget 표시 → 트레이 위치 안내 알림 1회.

# 개발 단계 (한 단계씩 진행, 끝나면 git commit 후 멈추고 보고)
0. 환경 확인, 프로젝트 생성, git init
1. 계산 엔진 + Vitest 테스트
2. 위젯 UI (설정은 하드코딩)
3. 첫 실행 settings 창 + 로컬 저장
4. 트레이, 항상 위, 드래그, 자동 실행, 위치 기억
5. 공휴일(2026~2027 JSON 내장), 급여 기간, 알림, 미니 모드, 투명도, 클릭 통과, 바탕화면 고정(alwaysOnBottom)
6. NSIS setup.exe 빌드

# 1단계 필수 테스트
- 근무시간 모드: 급여 기간 마지막 근무일 퇴근 시각의 누적액 = 월급 (오차 1원 미만)
- 24시간 모드: 급여 기간 종료 시각의 누적액 = 월급
- 점심시간, 주말, 출근 전, 퇴근 후에는 증가 0
- 월이 바뀌면 초당 금액이 새 달 기준으로 재계산됨
- periodStartDay=25일 때 기간이 25일~다음 달 24일로 계산됨
