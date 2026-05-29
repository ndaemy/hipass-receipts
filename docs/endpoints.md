# Hi-Pass Internal Endpoints Reference

> Source: NomaDamas/k-skill (MIT License, commit 0ea646a03d45874961ec9a23d690cb72ebee06d1)
> This document extracts endpoint reference only. No code was copied. All descriptions are original.
> License: https://github.com/NomaDamas/k-skill/blob/main/LICENSE

---

## Endpoints

### 1. GET /comm/lginpg.do
**Purpose**: Login page HTML
**Auth**: None required
**Response**: HTML page with login form

---

### 2. POST /comm/IdPwLogin.do
**Purpose**: ID/Password login (AJAX, not a form submit)
**Auth**: None (sets session cookie on success)
**Request body** (form-encoded):
| Field | Type | Description |
|---|---|---|
| user_id | string | User ID (NOT `id`) |
| passwd | string | Password (NOT `pw`) |
**Response**: JSON `{result: 1|0, ...}` — extension does NOT use this endpoint

---

### 3. POST /usepculr/InitUsePculrTabSearch.do
**Purpose**: Initialize usage history search page
**Auth**: Session cookie required
**Response**: HTML page with search form and initial transaction table

---

### 4. POST /usepculr/UsePculrTabSearchList.do
**Purpose**: Fetch paginated transaction list
**Auth**: Session cookie required
**Request body** (form-encoded). Default values are from the verified k-skill fixture (`packages/hipass-receipt/test/fixtures/usage-history-list.html`):
| Field | Type | Verified default | Description |
|---|---|---|---|
| card_kind | string | `2` | Card type code |
| card_com | string | `005` | Card company code |
| ecd_no | string | (Base64 of encrypted card no) | Encrypted card number |
| sDate | string | YYYYMMDD | Start date |
| eDate | string | YYYYMMDD | End date |
| date_type | string | `work` | Date filter — `work` for transaction date |
| biz_type | string | `on` | Business type — `on` for personal |
| pageSize | number | `30` | Items per page |
| pageNo | number | `1` | Page number (1-based) |
| order_type | string | `desc` | Sort direction |
| order_item | string | `date` | Sort field |
| receipt_time_type | string | `display` | Receipt time visibility flag |
| in_ic_nm | string | (empty) | Entry IC name filter |
| out_ic_nm | string | (empty) | Exit IC name filter |
| in_ic_code | string | (empty) | Entry IC code filter |
| out_ic_code | string | (empty) | Exit IC code filter |
| w | number | `742` | JSP popup width |
| h | number | `436` | JSP popup height |
| inc_vat | string | `nodisplay` | Include VAT — `display` to opt in |

**Response**: HTML containing `<table class="list_table">` with rows that carry an `onclick="printReceipt(...)"` link. Column order: `[No, 거래일시, 카드, 카드별칭, 차종, 입구영업소, 출구영업소, 이용차로, 거래금액, 청구일자, 구분, 기준통행료, 납부할통행료, 청구금액, 기능]`. (Selector + columns anchored to `tests/fixtures/k-skill/usage-history-list.html`.)

---

### 5. POST /usepculr/UsePculrReceiptPrint.do
**Purpose**: Fetch receipt HTML for a specific transaction
**Auth**: Session cookie required
**Request body** (form-encoded). The first 7 fields come from the row's onclick; the last 2 (`w`/`h`) are NOT in the onclick — the client supplies them at POST time:
| Field | Type | Source | Description |
|---|---|---|---|
| card_kind | string | onclick[0] | Card type code |
| work_dates | string | onclick[1] | Transaction datetime (`YYYYMMDDHHMMSS`) |
| tolof_cd | string | onclick[2] | Toll office code |
| work_no | string | onclick[3] | Work number |
| vhclProsNo | string | onclick[4] | Vehicle/transaction prosumer no |
| receipt_time_type | string | onclick[5] | Typically `display` |
| inc_vat | string | onclick[6] | `display` or `nodisplay` |
| w | string | client default `742` | JSP popup width |
| h | string | client default `436` | JSP popup height |

**Response**: HTML popup with receipt content (Korean text, transaction details)

---

## onclick Pattern

Transaction rows in UsePculrTabSearchList.do response contain a 7-arg call (NOT 9 as some older docs guessed). Verified shape:
```
onclick="printReceipt('card_kind','work_dates','tolof_cd','work_no','vhclProsNo','receipt_time_type','inc_vat'); return false;"
```

Example from the k-skill fixture:
```
onclick="printReceipt('2','20260407083012','A12','000123','VH001','display','nodisplay'); return false;"
```

Regex our parser uses:
```
/printReceipt\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/
```
Groups (in order): card_kind, work_dates, tolof_cd, work_no, vhclProsNo, receipt_time_type, inc_vat.

---

## Session Notes

- Session timeout: 20 minutes (1200 seconds)
- Recent transactions may be delayed up to 2 days
- Query window: personal 3 months / corporate 1 month per query, up to 3 years total
- No CAPTCHA detected
