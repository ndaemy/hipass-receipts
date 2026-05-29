# hipass.co.kr Live Exploration

**Status**: PARTIAL — captured from unauthenticated public access. Popup behavior (window.open vs current-tab) is **TBD** because the `printReceipt` definition is only served after authentication. T18 must plan for both scenarios.

**Date**: 2026-05-28
**Method**: Playwright headless Chromium, public access only. No credentials used.
**Evidence directory**: `docs/exploration-screenshots/`

---

## Summary of Findings

| Question | Answer | Confidence |
|---|---|---|
| Login form action | jQuery AJAX POST to `/comm/IdPwLogin.do` (form `login_form` action is `#login` anchor) | High — verified |
| Login fields | `user_id`, `passwd` (NOT `id`, `pw` as referenced in OSS k-skill) | High — verified |
| Session-expiry response | `CommonAuthCheck.jsp` HTML body (200 OK), JS auto-redirect to `/comm/lginpg.do` after alert | High — verified end-to-end |
| Session cookie | `JSESSIONID`, SameSite=Lax, HttpOnly, Secure=false, Path=/ | High — verified |
| Visitor tracking cookie | `__smVisitorID`, HttpOnly | High — verified |
| `printReceipt` popup behavior | **UNKNOWN** — JS only loaded after authentication. Defaults assumption based on legacy JSP patterns: likely `window.open()` opens a new tab/window | Low — needs authenticated session to confirm |
| Site stack | SSR JSP + jQuery 3.5.1 + jQuery UI 1.8.13 (legacy 2011 architecture) | High — verified |
| Keyboard security | MagicLine4Web 20240527 + nppfs 1.13.0 loaded on login page (does not affect our extension; user logs in normally) | High — verified |

---

## 1. Login Page (`/comm/lginpg.do`)

**URL**: `https://www.hipass.co.kr/comm/lginpg.do`
**Status**: 200 OK
**Title**: `개인/외국인 로그인 | 고속도로 통행료 홈페이지`

### Form Submit Pattern (verified from page source)

The visible `<form id="login_form" action="#login">` is a decoy anchor — actual login is performed by jQuery AJAX:

```
function fn_login_idpw(){
  $.ajax({
    url : "/comm/IdPwLogin.do",
    type : "post",
    async : false,
    data: { user_id: ..., passwd: ... },
    dataType: 'json',
    success: function(data){ if(data.result > 0) { ... /comm/IdPwLogin_90Check.do ... } }
  });
}
```

**Implication for T10/T13/T18**: A pure `<form action>` parse of the login page will NOT find `/comm/IdPwLogin.do`. The session-expiry detector should grep the response body string, not parse form actions.

### Login Methods Available

| Tab | Mechanism | Field names |
|---|---|---|
| 아이디 로그인 | AJAX POST `/comm/IdPwLogin.do` | `user_id`, `passwd` |
| SNS 인증 | OAuth via 네이버 / PAYCO | external redirect |
| 공동인증서 로그인 | Joint certificate, uses MagicLine4Web + nppfs | client-cert based |
| 디지털원패스 로그인 | Government OnePass SSO | external redirect |
| 아이핀 로그인 | i-PIN identity verification | external redirect |

The extension does NOT touch any of these flows. The user logs in through their normal flow; the extension only consumes the resulting session cookie.

### Cookies Set on First Visit (no login)

| Name | SameSite | HttpOnly | Secure | Path | Notes |
|---|---|---|---|---|---|
| `JSESSIONID` | Lax | true | false | `/` | Standard JSP session, value `<random>.bexcardwas2_servlet_excard` |
| `__smVisitorID` | Lax | true | false | `/` | Visitor tracking (set multiple times per response) |

**Implication for T13**: `JSESSIONID` carries the session. Because the cookie has `HttpOnly: true`, the content script cannot read its value via `document.cookie` — but it is still attached automatically to `fetch()` calls to `hipass.co.kr` (same-origin policy), so the extension does not need to read it.

**Implication for T15/T17 (session detection on extension popup)**: The extension popup runs in `chrome-extension://` origin, NOT `hipass.co.kr`. It cannot read JSESSIONID directly. To check session state, the popup must either (a) message the content script on an active hipass tab, or (b) call `chrome.cookies.get({ url: 'https://www.hipass.co.kr/', name: 'JSESSIONID' })` (requires `cookies` permission).

**Screenshot**: `docs/exploration-screenshots/login-page.png`

---

## 2. Session-Expiry Response (THE key marker for T10)

When ANY of `/usepculr/InitUsePculrTabSearch.do`, `/usepculr/UsePculrTabSearchList.do`, or `/usepculr/UsePculrReceiptPrint.do` is requested without a valid session, hipass returns a **3.6 KB HTML body with HTTP 200 OK** that is the `CommonAuthCheck.jsp` template.

### Verified end-to-end behavior

1. Browser GET `/usepculr/InitUsePculrTabSearch.do` (no `JSESSIONID` cookie, or expired one)
2. Response: 200 OK, body = `CommonAuthCheck.jsp` (see fingerprint below)
3. Body contains inline `<script>` with `var mgs_type = 12;`
4. JS executes `alert("로그인 하지 않았거나 장시간 사용을 하지 않았거나, 기타 이유로 인하여 세션이 종료되어 로그인 화면으로 되돌아 갑니다.")` (the **canonical session-expiry alert message**)
5. JS executes `page_self.top.document.location.href = "/comm/lginpg.do"`
6. Browser lands on `/comm/lginpg.do`

Result: The final document URL the user sees is `/comm/lginpg.do`. The intermediate `CommonAuthCheck.jsp` is invisible to anyone not inspecting the network tab. But for the content script's `fetch()` call, the **response body** is `CommonAuthCheck.jsp` — the redirect never happens because content scripts don't execute JS on fetched bodies.

### `mgs_type` Code Table (extracted from CommonAuthCheck.jsp)

| `mgs_type` | Meaning | Action |
|---|---|---|
| 1 | 법인사용자 이용 불가 | alert + history.back() |
| 2 | 사용자 정보 등록 필요 | alert + history.back() |
| 3 | 공동인증서 총괄담당자만 가능 | alert + history.back() |
| 4 | 관리자만 가능 | alert + history.back() |
| 5 | 법인 고객만 가능 | alert + history.back() |
| 6 | 렌탈/리스 가입 업체만 가능 | alert + history.back() |
| 7 | 법인 고객 카드등록 불필요 | redirect `/ecur/mhps.do` |
| 8 | 약관동의 필요 | redirect `/cmmn/merBerReg.do` |
| 9 | 약관동의 알림 | alert + history.back() |
| **11** | **미로그인** | alert + redirect `/comm/lginpg.do` |
| **12** | **세션아웃** | alert + redirect `/comm/lginpg.do` |
| 13 | 영상약정 모바일 연계 | redirect `/va/serviceapp/SelectRegist.do` |
| 14 | 신용카드 사전등록 연계 | redirect `/va/serviceapp/VideoAgreePaySearchAll2.do` |
| 15 | 사전등록 약관정보 | redirect `/va/serviceapp/ServiceAppAgrInfo.do` |

For the session-expiry detector (T10), only **11** (not logged in) and **12** (session timeout) are relevant — both redirect to `/comm/lginpg.do`.

### Canonical Markers for `detectSessionState()` (T10)

Pick markers that are **specific** to `CommonAuthCheck.jsp` to avoid false positives:

| Priority | Marker | Why |
|---|---|---|
| 1 | `Class Name : CommonAuthCheck.jsp` (HTML comment at line 2 of response) | Unique to this template; survives JSP minification |
| 2 | `var mgs_type = 12` or `var mgs_type = 11` | Decodes the exact reason |
| 3 | `<title>권한 확인 \| 하이패스 홈페이지</title>` | Distinctive title |
| 4 | `page_self.top.document.location.href = "/comm/lginpg.do"` | Redirect target |
| 5 | `로그인 화면으로 되돌아 갑니다` | Alert message fragment |

**Negative marker (success response)**: presence of `printReceipt(` in the body indicates a transaction-list response and therefore an active session.

**Recommendation**: Use a layered check — try CommonAuthCheck marker first (covers all session-related failures), fall back to `printReceipt(` absence + lack of `<table` (covers other failures).

```
function detectSessionState(html: string): SessionState {
  if (/CommonAuthCheck\.jsp|var mgs_type\s*=\s*(11|12)/.test(html)) return 'expired';
  if (/printReceipt\(/.test(html)) return 'active';
  return 'unknown';
}
```

**Screenshots**:
- `docs/exploration-screenshots/session-expiry-redirect.png` — final state after CommonAuthCheck redirect (lands on `/comm/lginpg.do`)
- `docs/exploration-screenshots/print-no-session-redirect.png` — same flow triggered by `UsePculrReceiptPrint.do`

Note: The screenshots show the **post-redirect** state (login page), not the intermediate CommonAuthCheck.jsp page. That is because CommonAuthCheck.jsp executes its redirect on `DOMContentLoaded` and never paints its own UI. The captured alert dialog message (Korean "장시간 사용을 하지 않았거나... 세션이 종료되어...") is recorded in `.sisyphus/evidence/task-3-session-alert.txt`.

---

## 3. Receipt Popup Behavior — TBD

**This is the unresolved key question** (per Wave-1 risk list).

### What was attempted
- Captured all 41 JavaScript URLs loaded by `/comm/lginpg.do` (jQuery, jQuery-UI, swiper, MagicLine4Web, nppfs, etc.).
- Probed common guessed paths (`/js/usepculr/usepculr.js`, `/js/printReceipt.js`, etc.) — all 404 except `/js/common.js` (200, does NOT contain `printReceipt`).
- Searched all 41 captured JS files for `function printReceipt` / `printReceipt = function` / `printReceipt :` patterns.

### Result
**`printReceipt` is NOT served on the public side.** It is only loaded as part of the `/usepculr/InitUsePculrTabSearch.do` response (or a JS bundle gated behind the session), which requires authentication.

### What we know indirectly
- NomaDamas/k-skill (MIT) reverse-engineered the endpoint as a Node CLI that POSTs to `/usepculr/UsePculrReceiptPrint.do` and consumes the resulting HTML body directly — this **does not tell us** whether the browser-side `printReceipt()` opens a popup or rewrites the current tab.
- From the broader pattern of Korean SSR-JSP sites built around 2011 (which this codebase clearly is — `CommonAuthCheck.jsp` is dated `2011.07.13`), the `printReceipt(card_kind, work_dates, ..., w, h)` signature with `w` and `h` arguments is **strongly indicative of `window.open(url, name, 'width=w,height=h,...')`**. Width/height parameters are useless for inline-modal rendering.

### Provisional assumption
**`window.open()` to a new tab/window is the most likely scenario.** T18 should be designed for this case, with a fallback path for current-tab rendering.

### Implications for T18 (button injection)
Two scenarios must be supported:

#### Scenario A (provisional default): `window.open(url, ...)` opens new tab
- The new tab URL pattern is `https://www.hipass.co.kr/usepculr/UsePculrReceiptPrint.do` (with POST body — popup may instead use a form-submit-to-popup trick that wraps the POST in a hidden form).
- `manifest.ts` `content_scripts.matches` MUST include `https://www.hipass.co.kr/usepculr/UsePculrReceiptPrint.do*` so the content script can run on the popup tab too.
- OR — and this is the recommended path — **bypass the popup entirely**: the extension's button handler `fetch()` the receipt HTML directly with the same parameters extracted from the `onclick` attribute, and feed the response to the PDF/image converter. No popup needed.

#### Scenario B (less likely): popup is an in-page modal or iframe
- The receipt is rendered inside the current tab.
- The content script can `fetch()` the receipt URL directly without any extra manifest matches.

### Recommended T18 design (popup-agnostic)
Regardless of which scenario is real, **the content script should not depend on the popup happening at all**. The injected "PDF" / "IMG" buttons should:

1. Parse `onclick="printReceipt('a', 'b', ...)"` from the row using the regex documented in `docs/endpoints.md` § onclick Pattern.
2. Construct a `URLSearchParams` body from the extracted args (`card_kind`, `work_dates`, `tolof_cd`, `work_no`, `vhclProsNo`, `receipt_time_type`, `inc_vat`, `w`, `h`).
3. POST to `/usepculr/UsePculrReceiptPrint.do` directly using `fetch()` (same-origin, JSESSIONID auto-attached).
4. Run `detectSessionState()` (T10) on the response.
5. If active, feed the HTML to T7 (PDF) or T8 (image).
6. Send the resulting `Blob` to the service worker via `chrome.runtime.sendMessage` for `chrome.downloads.download`.

This approach **completely sidesteps the popup question** and works in both scenarios.

### What to confirm later (with authenticated session)
- Whether clicking the native "영수증선택출력" button opens a popup → if so, capture popup URL and confirm `manifest.ts` matches.
- The exact `onclick` parameter string for one or two real transaction rows (with masked PII).
- Whether the row has an `<input type="checkbox">` near the print button (relevant for batch UX in T18, not blocking).

---

## 4. Transaction Row & Receipt Structure — Inferred Only

The fully authenticated transaction-row HTML and receipt-popup HTML were not captured (no session). Inferred shape from `docs/endpoints.md` (k-skill OSS reference) and the `printReceipt(...)` arity:

### Expected onclick pattern (per `docs/endpoints.md`)

```
onclick="printReceipt('card_kind_val', 'work_dates_val', 'tolof_cd_val', 'work_no_val', 'vhclProsNo_val', 'receipt_time_type_val', 'inc_vat_val', w_val, h_val)"
```

### Extraction regex (per `docs/endpoints.md`)

```
/printReceipt\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+)\)/
```
Groups: `card_kind`, `work_dates`, `tolof_cd`, `work_no`, `vhclProsNo`, `receipt_time_type`, `inc_vat`, `w`, `h`.

### Transaction table location
Likely inside `<table>` within the body of `/usepculr/InitUsePculrTabSearch.do` (success response). The exact selector (e.g., `table#usepculrList` vs `.usepculr-row`) was NOT confirmed.

**To confirm later**: open a logged-in session, inspect the rendered DOM, record the table id/class and row selector.

---

## 5. Resource Inventory (loaded by `/comm/lginpg.do`)

Useful for T11 (mock server) and T20 (E2E fixture asset routing).

### jQuery / UI / Plugin stack
- `/js/jquery-3.5.1.min.js`
- `/js/lib/jquery.min.js` (older jQuery, conflicts?)
- `/js/jquery-migrate-3.3.2.js`
- `/js/lib/jquery-ui.min.js`
- `/js/hp/comm/jquery-ui-1.8.13.custom.min.js`
- `/js/lib/jquery.scrollbar.min.js`
- `/js/lib/swiper-bundle.min.js`
- `/js/hp/comm/jquery.easing.1.3.js`

### Hi-Pass framework
- `/js/script.js`
- `/js/hp/comm/comm.js`
- `/js/hp/comm/json2.js`
- `/js/hp/comm/Utillity.js` (sic — typo preserved)
- `/js/hp/comm/msie_error_fixed/fixed.js`

### MagicLine4Web keyboard security (version 20240527)
- `/MagicLine4Web/ML4Web/js/magic_e2e.js`
- `/MagicLine4Web/ML4Web/js/ML4Web_API.min.js?v=20240527`
- `/MagicLine4Web/ML4Web/js/ML4Web_UI.js?v=20240527`
- `/MagicLine4Web/ML4Web/js/ML4Web_Child.js?v=20240527`
- `/MagicLine4Web/ML4Web/js/crypto/magicjs_1.2.7.3.min.js`
- (plus jQuery UI dialog, blockUI, OWL carousel within ML4Web bundle)

### nppfs
- `/pluginfree/js/nppfs-1.13.0.js`
- `/pluginfree/js/jquery-1.11.0.min.js`

**Implication for the extension**: We do NOT load or interact with ML4Web / nppfs. The user logs in through them; we read the resulting session via `fetch()`. No CSP / MutationObserver conflict expected because the extension's content script lives in its own isolated world.

---

## 6. Required Content-Script Match Patterns (T18 input)

Based on the verified URLs above, `manifest.ts` `content_scripts.matches` should include:

```
"https://www.hipass.co.kr/comm/lginpg.do*"          (for session-expiry detection on login page)
"https://www.hipass.co.kr/usepculr/*"               (for transaction list page + injected buttons + popup if Scenario A)
```

If Scenario A turns out to be wrong and popup is in-tab, the second match still covers it (the receipt URL is under `/usepculr/`).

`host_permissions` should be:

```
"https://www.hipass.co.kr/*"
```

(Already set per T1 manifest. The tight scoping satisfies the guardrail "host_permissions에 `<all_urls>` 같은 와일드카드 사용 금지".)

---

## 7. Personal Information Masking Status

All evidence captured during this session is from **public, unauthenticated access only**:
- `login-page.png` — public login UI (no user data)
- `session-expiry-redirect.png` — public login UI after CommonAuthCheck redirect (no user data)
- `print-no-session-redirect.png` — same (no user data)
- HTML dumps in `.sisyphus/evidence/` — only public pages and CommonAuthCheck.jsp

No vehicle numbers, card numbers, names, or addresses appear anywhere in this exploration. Masking pattern `[0-9]{2,4}[가-힣][0-9]{4}` matches zero lines across all evidence.

---

## 8. Open Questions for the next exploration pass (authenticated)

1. **Popup behavior** — does `printReceipt()` call `window.open()` or render in-tab? Confirm by clicking a real receipt button.
2. **Transaction table selector** — what is the `id` / `class` of the table that holds transaction rows? T18 button injection needs this.
3. **Receipt HTML shape** — confirm exact HTML structure of `/usepculr/UsePculrReceiptPrint.do` success response so T7 (PDF) / T8 (image) can target the right element.
4. **Refresh / polling behavior** — does the search button do AJAX-replace, full form POST, or page reload? Affects T18 MutationObserver vs DOMContentLoaded strategy.
5. **`inc_vat` toggle** — does the user see a separate "부가세 포함" button on each row, or is it set globally? T19 needs to know whether to expose this option in the popup UI.
6. **Search pagination** — confirm `pageNo` increments and what triggers the next page (button click vs scroll vs explicit page link). T18 needs to re-inject buttons after each search.

These should be answered in a future T3-followup task once the user has an active session available.

---

## 9. References

- Verified directly:
  - `https://www.hipass.co.kr/comm/lginpg.do` (login page)
  - `https://www.hipass.co.kr/usepculr/InitUsePculrTabSearch.do` (CommonAuthCheck response)
  - `https://www.hipass.co.kr/usepculr/UsePculrTabSearchList.do` (CommonAuthCheck response)
  - `https://www.hipass.co.kr/usepculr/UsePculrReceiptPrint.do` (CommonAuthCheck response)
- Cross-referenced (not copied):
  - `docs/endpoints.md` (T5 deliverable, derived from NomaDamas/k-skill MIT)
- External:
  - Playwright `page.pause()` and request API: `https://playwright.dev/docs/api/class-page`
