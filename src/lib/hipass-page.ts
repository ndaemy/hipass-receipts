/**
 * In-page JavaScript snippets executed via CDP `Runtime.evaluate` to drive
 * hipass's own print pipeline. The form-submit snippets define a `form`
 * variable consumed by `CdpDriver.submitNavigate`; the probe/swap snippets are
 * complete IIFEs returning JSON-serialisable values.
 *
 * Verified params (live CDP run, 2026): `UsePculrTabSearchList.do` filters the
 * usage list to a single work date; `UsePculrReceiptPrint.do` with `is_all=1`
 * batch-prints every row in that view onto one page; `#print1` is the print
 * area the site's `printDiv()` copies into `<body>`.
 */

export interface ListProbe {
  expired: boolean;
  hasForm: boolean;
}

export interface ReceiptMeta {
  found: boolean;
  count: number;
  amount: number;
}

const DATE_RE = /^\d{8}$/;

/** Static form fields shared by every single-date list query. */
const LIST_QUERY_BASE: Record<string, string> = {
  date_type: 'work',
  biz_type: 'on',
  pageSize: '30',
  pageNo: '1',
  order_type: 'desc',
  order_item: 'date',
  receipt_time_type: 'display',
  card_kind: '',
  card_com: '',
  ecd_no: '',
  in_ic_nm: '',
  out_ic_nm: '',
  in_ic_code: '',
  out_ic_code: '',
  w: '742',
  h: '436',
  inc_vat: 'nodisplay',
};

/**
 * Build the snippet that POSTs the usage-list search form for one `YYYYMMDD`
 * date. Defines `form` for `submitNavigate`.
 */
export function listFormExpression(date: string): string {
  if (!DATE_RE.test(date)) {
    throw new Error(`invalid_date: ${date}`);
  }
  const params = JSON.stringify({ ...LIST_QUERY_BASE, sDate: date, eDate: date });
  return `
const params = ${params};
const form = document.createElement('form');
form.method = 'POST';
form.action = '/usepculr/UsePculrTabSearchList.do';
for (const key of Object.keys(params)) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = key;
  input.value = params[key];
  form.appendChild(input);
}
document.body.appendChild(form);`;
}

/**
 * Build the snippet that flips the list page's global `hpForm` into a
 * batch receipt print (`is_all=1`). Defines `form` for `submitNavigate`.
 */
export function receiptFormExpression(): string {
  return `
const form = document.hpForm;
let isAll = document.getElementById('is_all');
if (!isAll) {
  isAll = document.createElement('input');
  isAll.type = 'hidden';
  isAll.id = 'is_all';
  isAll.name = 'is_all';
  form.appendChild(isAll);
}
isAll.value = '1';
form.action = '/usepculr/UsePculrReceiptPrint.do';
form.target = '_self';`;
}

/**
 * Probe the freshly loaded list page. Expiry is URL-first: a dropped session
 * redirects the POST to the login page (`/comm/lginpg.do`) — which confusingly
 * also carries a form named `hpForm` — so a body-marker-only check would mistake
 * a logged-out redirect for an empty result. The actual per-date row count is
 * read later from the receipt page's authoritative "총 N건" summary.
 */
export const LIST_PROBE_EXPRESSION = `
(() => {
  const url = location.href;
  const html = document.documentElement.innerHTML;
  const expired =
    url.indexOf('lginpg.do') !== -1 ||
    url.indexOf('CommonAuthCheck') !== -1 ||
    html.indexOf('CommonAuthCheck.jsp') !== -1 ||
    html.indexOf('var mgs_type = 11') !== -1 ||
    html.indexOf('var mgs_type = 12') !== -1;
  return { expired: expired, hasForm: !!document.hpForm };
})()`;

/**
 * Replace `<body>` with `#print1` (mirrors the site's `printDiv()`, stripping
 * the popup header/buttons) and report the receipt count and total amount
 * parsed from the "총 N건 / X원" summary for filename building. The hipass
 * watermark is a page background-image kept on `<html>`/`<body>` by this swap,
 * so both PDF (`printBackground:true`) and PNG capture it.
 */
export const SWAP_TO_PRINT_AREA_EXPRESSION = `
(() => {
  const print1 = document.getElementById('print1');
  if (!print1) return { found: false, count: 0, amount: 0 };
  const text = print1.textContent || '';
  const sm = text.match(/총\\s*([0-9,]+)\\s*건\\s*[/\\s]*([0-9,]+)\\s*원/);
  const count = sm ? parseInt(sm[1].replace(/,/g, ''), 10) : 0;
  const amount = sm ? parseInt(sm[2].replace(/,/g, ''), 10) : 0;
  document.body.innerHTML = print1.innerHTML;
  return { found: true, count: count, amount: amount };
})()`;

/** Wait for fonts, images, and two animation frames so a screenshot is stable. */
export const WAIT_FOR_RENDER_EXPRESSION = `
(async () => {
  if (document.fonts && document.fonts.ready) { await document.fonts.ready; }
  await Promise.all(Array.prototype.slice.call(document.images).map((img) =>
    img.complete ? true : new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    })
  ));
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  return true;
})()`;
