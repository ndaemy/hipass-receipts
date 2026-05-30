# Hi-Pass 영수증 일괄 다운로드 (Chrome Extension)

hipass.co.kr 통행료 영수증을 **여러 날짜 한 번에** PDF 혹은 PNG로 다운로드하는 Manifest V3 익스텐션입니다.

## 핵심 기능

- 📅 **달력에서 원하는 날짜만 선택** → 한 번 클릭으로 N건 일괄 다운로드
- 📄 출력 모드 3가지
  - N개 개별 PDF
  - 1개 합쳐진 PDF (N페이지)
  - N개 개별 PNG
- 🗜 **ZIP 묶기 토글** (개별 모드 한정) — 다운로드 폴더 정리용
- 🔒 자격증명 0% 저장 — 사용자가 직접 로그인한 hipass 세션만 활용
- ⏯ 진행률 표시 + 취소
- 🖨 **hipass 자체 인쇄 기능 그대로 활용** — 사이트의 "영수증 인쇄" 출력과 동일한 결과 (별도 렌더링 없음)

## 동작 방식

1. 익스텐션 아이콘 클릭 → 우측 **사이드 패널** 열림
2. 사이드 패널에서 `최근 5일` / `최근 10일` 프리셋 또는 달력에서 직접 날짜 선택
3. 출력 형식 + (선택) ZIP 토글 지정
4. **다운로드** 한 번 클릭 → 자동으로:
   - 백그라운드 작업 창에서 각 날짜의 사용내역 조회 페이지를 연 뒤
   - hipass의 일괄 영수증 인쇄(`is_all=1`) 페이지로 전환
   - 사이트의 인쇄 영역(`#print1`)을 `chrome.debugger`의 `Page.printToPDF` / `Page.captureScreenshot`로 그대로 캡처
   - (옵션) 합본 PDF는 `pdf-lib`로 병합 / ZIP은 `jszip`으로 묶기
   - `chrome.downloads`로 저장

사용자는 직접 hipass.co.kr 사이트에서 평소처럼 로그인만 해두면 됩니다. 익스텐션은 그 세션을 그대로 활용합니다 (cookie 자동 attach).

## 설치 방법

### 사전 요구사항
- Chrome 138 이상 (또는 Edge / Whale 등 Chromium 138+ 기반)
- Node.js 20 LTS 이상
- Bun

### 빌드 + 로드

```bash
bun install
bun run build
```

1. Chrome 주소창에 `chrome://extensions/` 입력
2. 우상단 **개발자 모드** ON
3. **압축해제된 확장 프로그램을 로드합니다** 클릭 → `dist/` 폴더 선택

### 사용

1. https://www.hipass.co.kr 접속 + 평소처럼 로그인
2. Chrome 툴바에서 익스텐션 아이콘 클릭 → 사이드 패널 자동 오픈
3. 달력에서 날짜 선택 → 다운로드 클릭

## 출력 모드 선택 가이드

| 상황 | 권장 모드 |
|---|---|
| 회사 비용처리 한 첨부파일로 제출 | **1개 합쳐진 PDF** |
| 영수증 개별 보관 / 정렬 | **N개 개별 PDF** + ZIP 토글 ON |
| 모바일 첨부 / 이미지로만 제출 | **N개 개별 PNG** |

기본 파일명 형식:
- 개별: `{YYYYMMDD}_{차량번호}_{영업소}_{금액}원.{pdf|png}` (예: `20260527_12가3456_서울톨게이트_3500원.pdf`)
- 합본: `hipass_receipts_{시작일}-{종료일}_{N}건.pdf`
- ZIP: `hipass_receipts_{시작일}-{종료일}_{N}건.zip`

## 자주 묻는 질문

**Q: 비밀번호나 인증서를 저장하나요?**
A: 아니요. 어떤 자격증명도 저장하지 않습니다. hipass 세션 쿠키(JSESSIONID)는 브라우저가 관리하며 익스텐션은 fetch 요청에 자동 첨부되는 형태로만 활용합니다.

**Q: 세션이 만료되면?**
A: hipass 세션은 20분 idle 시 자동 만료됩니다. 다운로드 도중 만료되면 "세션이 만료되었습니다" 알림이 뜨고 작업이 중단됩니다. hipass.co.kr에서 다시 로그인 후 재시도하세요.

**Q: 한 번에 몇 건까지 가능한가요?**
A: 한 번에 5-30건이 권장. 그 이상도 가능하나 Chrome의 같은 도메인 TCP 연결 제한(~6개)으로 인해 속도가 떨어질 수 있습니다.

**Q: Edge / Whale에서도 동작하나요?**
A: Manifest V3 + Chrome 138+ 호환 사이드패널 API를 사용합니다. Chromium 138 기반 브라우저는 모두 동작해야 합니다.

## 개발

```bash
bun install
bun run build          # dist/ 생성
bun run typecheck      # tsc --noEmit
bun run lint           # ESLint
bun run test           # Vitest 단위 테스트
bun run test:e2e       # Playwright E2E (mock 서버 필요: bun run mock:start &)
```

### 라이브 디버깅

`launch-demo.mjs` (gitignored)는 익스텐션이 로드된 실제 Chrome을 띄우는 헬퍼입니다. remote debugging port 9222 활성화 상태로 띄워서 `cdp-eval.mjs`로 DOM 검사·테스트가 가능합니다.

```bash
bun launch-demo.mjs            # 헤디드 Chrome 실행 (persistent profile)
node cdp-eval.mjs info         # 현재 hipass 탭 상태 dump
node cdp-eval.mjs goto <url>   # 탭 navigate
node cdp-eval.mjs eval '<JS>'  # 페이지 context에서 JS 실행
```

## 아키텍처 (3-layer MV3)

```
┌─────────────────────────────────────────────────────┐
│  Side Panel (chrome.sidePanel)                      │
│  - 달력, 프리셋, 모드 선택, 진행률, 취소               │
│  - runtime.connect() 포트 + 20s 주기 ping (SW alive) │
└────────────────────┬────────────────────────────────┘
                     │ messages
                     ▼
┌─────────────────────────────────────────────────────┐
│  Service Worker (background) — orchestrator         │
│  - 백그라운드 작업 창 생성 + chrome.debugger attach   │
│  - 날짜별: 사용내역 POST → 일괄 인쇄 POST(is_all=1)   │
│    → #print1 swap → Page.printToPDF / captureScreenshot│
│  - chrome.downloads + onChanged 완료 대기            │
└────────────────────┬────────────────────────────────┘
                     │ chrome.runtime.sendMessage (base64)
                     ▼
┌─────────────────────────────────────────────────────┐
│  Offscreen Document (hidden DOM)                    │
│  - base64 → Blob (SW는 createObjectURL 불가)         │
│  - pdf-lib 합본 병합 / jszip ZIP 묶기                │
│  - URL.createObjectURL → blob URL 발행              │
└─────────────────────────────────────────────────────┘
```

상세 결정 사항: `.sisyphus/notepads/main/oracle-architecture.md`, `.sisyphus/notepads/main/gap-analysis.md`

## 라이선스

MIT
