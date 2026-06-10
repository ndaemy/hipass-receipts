# Chrome Web Store 제출 가이드

이 문서는 하이패스 영수증 다운로더(hipass-receipts 레포)를 Chrome Web Store(CWS)에 제출할 때 대시보드에 입력할 자료를 모아둔 것입니다. 각 항목을 그대로 복사-붙여넣기 하세요.

## 제출 패키지

- 업로드 ZIP: `hipass-receipts-0.2.0.zip` (레포 루트, `dist/` 내용이 ZIP 루트에 위치, manifest.json이 최상위)
- 빌드 재생성: `bun run build` 후 `cd dist && zip -r ../hipass-receipts-0.2.0.zip . -x '.*'`

## 사전 준비 (계정)

1. https://chromewebstore.google.com/devconsole 접속 (Google 계정 로그인)
2. 개발자 등록 1회 수수료 **$5** 결제
3. **2단계 인증** 활성화 (게시/업데이트에 필수)

## 제출 단계

1. 대시보드 → **새 항목 추가** → 위 ZIP 업로드
2. **Store Listing** 탭 작성 (아래 텍스트)
3. **Privacy** 탭 작성 (단일목적 + 권한 정당화 + 데이터 사용)
4. **Distribution** 탭 (공개 범위/지역)
5. **검토를 위해 제출**

> debugger 권한 때문에 **수동 심사** 대상입니다. 통상 며칠~수 주, 민감 권한/신규 계정은 1~3주가 일반적입니다. 심사 중에는 재제출하지 마세요(큐 리셋됨). 약 3주 경과 시 지원 문의.

---

## Store Listing

### 이름

이름은 `manifest.json`의 `name`(`__MSG_extName__`) + `_locales`로 결정됩니다 (KO/EN 자동 분기).
- 한국어 로케일: `하이패스 영수증 다운로더`
- 그 외 로케일(default_locale=en): `Korean Hi-pass Receipts Downloader`

```
하이패스 영수증 다운로더
```

### 간단한 설명 (manifest description, 132자 이내)
```
hipass.co.kr 통행료 영수증을 여러 날짜 한 번에 PDF/PNG로 일괄 다운로드합니다.
```

### 자세한 설명
```
하이패스(hipass.co.kr) 통행료 영수증을 여러 날짜 한 번에 다운로드하는 확장 프로그램입니다.

출장·경비 처리를 위해 매번 영수증을 한 건씩 인쇄하던 번거로움을 없앱니다. 사이드 패널의 달력에서 원하는 날짜만 고르고 한 번 클릭하면, 선택한 모든 날짜의 영수증이 한꺼번에 저장됩니다.

■ 핵심 기능
- 달력에서 원하는 날짜만 선택 → 한 번 클릭으로 일괄 다운로드
- 출력 형식 3가지: 날짜별 개별 PDF / 1개로 합쳐진 PDF / 날짜별 개별 PNG
- ZIP으로 묶기 토글 (개별 모드)
- "최근 5일" / "최근 10일" 프리셋
- 진행률 표시 및 취소

■ 동작 방식
하이패스 사이트의 자체 "영수증 인쇄" 기능을 그대로 활용해, 수동으로 인쇄/PDF 저장한 것과 동일한 결과물을 만듭니다. 별도로 영수증을 다시 그리지 않습니다.

■ 개인정보
어떤 자격증명도 저장하지 않습니다. 사용자가 직접 로그인한 하이패스 세션만 활용하며, 모든 처리는 브라우저 안에서만 이루어집니다. 외부 서버로 전송되는 데이터는 없습니다.

사용 전 hipass.co.kr에 평소처럼 로그인해 두세요.
```

### 카테고리
```
Workflow & Planning (워크플로우 및 계획) 또는 Productivity
```

### 언어
```
한국어
```

---

## Privacy 탭

### 단일 목적 (Single purpose)
```
하이패스(hipass.co.kr)에 로그인한 사용자가 선택한 날짜의 통행료 영수증을 PDF 또는 PNG 파일로 일괄 다운로드합니다.
```

### 권한별 정당화 (Permission justification)

**debugger**
```
chrome.debugger를 통해 사용자가 선택한 작업 탭에서만 CDP 명령(Page.printToPDF, Page.captureScreenshot)을 호출해, 하이패스 영수증 페이지를 사이트 자체 인쇄 출력과 동일한 PDF/PNG로 변환합니다. 디버거는 다운로드 작업 중에만 연결되고 완료 즉시 해제됩니다. 원격 코드를 로드하지 않으며, 페이지 내용을 저장하거나 외부로 전송하지 않습니다.
```

**downloads**
```
생성한 PDF/PNG/ZIP 파일을 사용자의 다운로드 폴더에 저장하기 위해 사용합니다.
```

**offscreen**
```
서비스 워커가 직접 만들 수 없는 Blob URL 생성과 PDF 병합(pdf-lib)·ZIP 묶기(jszip)를 처리하기 위한 백그라운드 문서를 사용합니다.
```

**sidePanel**
```
달력·형식 선택·진행률 UI를 사이드 패널로 제공하기 위해 사용합니다.
```

**host_permissions (https://www.hipass.co.kr/*)**
```
영수증 데이터가 있는 하이패스 도메인에만 접근합니다. 다른 사이트에는 접근하지 않습니다.
```

### 데이터 사용 (Data usage) — 모두 "아니오 / 수집 안 함"
```
- 개인 식별 정보: 수집 안 함
- 금융/결제 정보: 수집 안 함
- 인증 정보: 수집 안 함 (세션 쿠키는 브라우저가 관리, 확장은 저장/전송하지 않음)
- 웹 기록/활동: 수집 안 함
이 확장은 어떤 사용자 데이터도 수집·저장·전송·판매하지 않습니다. 모든 처리는 사용자의 브라우저 안에서만 이루어집니다.
```

체크박스 동의:
- "이 데이터를 승인된 사용 사례 외의 목적으로 판매/이전하지 않습니다" → 동의
- "신용도 산정/대출 목적으로 사용하지 않습니다" → 동의

### 개인정보 처리방침 URL
```
https://ndaemy.github.io/hipass-receipts/privacy.html
```

---

## 스크린샷

- `store-assets/screenshot-1-sidepanel-1280x800.png` (사이드 패널 초기 화면)
- `store-assets/screenshot-2-preset-1280x800.png` ("최근 5일" 프리셋 적용, 5일 선택 + 형식 선택)
- 규격: 1280×800 (CWS 허용). 최소 1장, 최대 5장.

## 아이콘

- 스토어 아이콘 128×128: `dist/icons/icon-128.png` (이미 manifest에 포함)

---

## 거부 예방 체크리스트

- [x] host 범위를 단일 사이트로 제한 (`https://www.hipass.co.kr/*`)
- [x] 사용하지 않는 권한 없음 (downloads/sidePanel/offscreen/debugger 전부 사용)
- [x] 제출 ZIP = 심사 빌드와 동일 (번들 무결성 검증 완료)
- [x] 원격 코드/CDN/동적 스크립트 없음
- [x] 코드 난독화 없음 (minify만)
- [x] privacy URL 작동(200) + 내용이 코드와 일치
- [x] 리스팅 설명/스크린샷이 실제 동작과 일치
