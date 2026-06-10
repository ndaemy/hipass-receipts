# 개인정보 처리방침 / Privacy Policy

**하이패스 영수증 다운로더** (Chrome 확장 프로그램)
최종 수정일 / Last updated: 2026-05-30

---

## 한국어

본 확장 프로그램은 사용자의 개인정보를 **수집·저장·전송·판매하지 않습니다.**

### 처리하는 데이터
- 확장 프로그램은 사용자가 **직접 로그인한 hipass.co.kr 세션**을 그대로 활용하여 통행료 영수증을 조회합니다.
- 조회된 영수증은 PDF/PNG 파일로 변환되어 **사용자 본인의 다운로드 폴더에만 저장**됩니다.
- 모든 처리는 **사용자의 브라우저 안에서만** 이루어지며, 외부 서버로 전송되는 데이터가 없습니다.

### 저장하지 않는 것
- 아이디·비밀번호·인증서 등 **어떠한 자격증명도 저장하지 않습니다.** 세션 쿠키는 브라우저가 관리하며, 확장 프로그램은 이를 저장하거나 외부로 보내지 않습니다.
- 통행 기록, 카드 정보, 차량 정보 등 개인 데이터를 자체적으로 보관하지 않습니다.

### 권한 사용 목적
- **debugger**: 영수증 페이지를 사이트 자체 출력과 동일하게 PDF/PNG로 변환하기 위해 Chrome DevTools Protocol(`Page.printToPDF`/`Page.captureScreenshot`)을 사용합니다. 작업 중에만 연결되고 완료 즉시 해제됩니다.
- **downloads**: 생성한 파일을 다운로드 폴더에 저장합니다.
- **offscreen**: 변환 결과를 파일로 만들기 위한 백그라운드 문서를 사용합니다.
- **host (https://www.hipass.co.kr/\*)**: 영수증 데이터가 있는 hipass 도메인에만 접근합니다. 다른 사이트에는 접근하지 않습니다.

### 제3자 제공
- 어떤 데이터도 제3자에게 제공하거나 판매하지 않습니다.

### 문의
- GitHub: https://github.com/ndaemy/hipass-receipts/issues

---

## English

This extension does **not collect, store, transmit, or sell** any personal data.

### Data handled
- The extension uses your **existing, self-authenticated hipass.co.kr session** to fetch toll receipts.
- Fetched receipts are converted to PDF/PNG and saved **only to your own Downloads folder**.
- All processing happens **entirely within your browser**; no data is sent to any external server.

### What is never stored
- **No credentials** (IDs, passwords, certificates) are ever stored. Session cookies are managed by the browser; the extension neither stores nor transmits them.
- No personal data (toll history, card info, vehicle info) is retained by the extension.

### Why each permission is used
- **debugger**: to convert the receipt page to PDF/PNG identically to the site's own print output, via the Chrome DevTools Protocol (`Page.printToPDF` / `Page.captureScreenshot`). Attached only during a job and detached immediately after.
- **downloads**: to save generated files to your Downloads folder.
- **offscreen**: a background document used to turn conversion results into files.
- **host (https://www.hipass.co.kr/\*)**: access is limited to the hipass domain that holds the receipt data. No other site is accessed.

### Third parties
- No data is shared with or sold to any third party.

### Contact
- GitHub: https://github.com/ndaemy/hipass-receipts/issues
