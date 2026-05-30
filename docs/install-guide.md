# 상세 설치 가이드

## 사전 요구사항

- Chrome 138 이상 (또는 Edge / Whale 등 Chromium 138+ 기반)
- Node.js 20 LTS 이상
- Bun

## 빌드 방법

### Bun 설치 (처음인 경우)

macOS:
```bash
curl -fsSL https://bun.sh/install | bash
```

### 프로젝트 빌드

```bash
cd hipass-receipts
bun install
bun run build
```

성공 시 `dist/`에 다음이 생성됩니다:
```
dist/
├── manifest.json
├── service-worker-loader.js
├── src/
│   ├── sidepanel/index.html
│   └── offscreen/render.html
└── assets/
    └── ... (chunks)
```

## Chrome에 익스텐션 로드

1. Chrome 주소창에 `chrome://extensions/`
2. 우상단 **개발자 모드** 토글 ON
3. **압축해제된 확장 프로그램을 로드합니다** → `dist/` 폴더 선택
4. "Hi-Pass 영수증 일괄 다운로드" 항목이 목록에 추가되면 설치 완료

## 사용 방법

### 기본 흐름

1. https://www.hipass.co.kr 접속
2. 평소대로 로그인 (네이버 / PAYCO 간편로그인 등)
3. Chrome 툴바의 익스텐션 아이콘 클릭
   → 우측에 **사이드 패널**이 자동으로 열립니다
4. 사이드 패널에서:
   - 달력에서 영수증을 받을 날짜를 하나씩 클릭하여 선택
   - 또는 **최근 5일** / **최근 10일** 프리셋 클릭
   - 출력 형식 선택 (개별 PDF / 합본 PDF / 개별 PNG)
   - 필요시 **ZIP으로 묶기** 토글
5. **다운로드** 클릭
6. Chrome의 기본 다운로드 폴더에 파일이 저장됩니다

### 파일명 형식

- 개별 (예): `20260527_12가3456_서울톨게이트_3500원.pdf`
  - `20260527` 거래 날짜 (YYYYMMDD)
  - `12가3456` (예: 차량번호)
  - `서울톨게이트` 진출 영업소
  - `3500원` 통행료
  - `.pdf` 또는 `.png` 선택한 형식
- 합본: `hipass_receipts_20260520-20260527_5건.pdf`
- ZIP: `hipass_receipts_20260520-20260527_5건.zip`

### 사이드 패널이 안 열리는 경우

- Chrome 버전 확인 (138 이상 필요 — `chrome://settings/help`)
- 익스텐션이 활성화되어 있는지 `chrome://extensions/`에서 확인
- 페이지 리로드 후 익스텐션 아이콘 재클릭

### "세션이 만료되었습니다" 알림

- hipass.co.kr에서 다시 로그인 후 재시도
- 세션은 20분 idle 시 자동 만료됩니다

### 다운로드가 시작되지 않는 경우

- Chrome 설정 `chrome://settings/downloads`에서 "각 파일 저장 위치 묻기"가 ON이면 N개 파일마다 위치 선택 창이 뜰 수 있습니다. 일괄 다운로드 시에는 OFF 권장.

## 개발자: SW 코드 수정 시 주의

`launch-demo.mjs`가 persistent user-data-dir (`/tmp/hipass-demo-userdata`)에 Chrome 프로파일을 캐시합니다. **서비스 워커 파일이 바뀌었는데 새 코드가 안 먹는 것 같으면** 캐시된 옛 SW가 takeover를 막고 있을 수 있습니다. 해결:

```bash
rm -rf /tmp/hipass-demo-userdata
```

그 후 `bun launch-demo.mjs`로 재시작하면 새 SW가 fresh install로 등록됩니다. 일반 사용자는 fresh install이므로 이 문제가 발생하지 않습니다.
