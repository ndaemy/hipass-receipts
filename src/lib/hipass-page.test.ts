import { describe, expect, it } from 'vitest';
import {
  LIST_PROBE_EXPRESSION,
  SWAP_TO_PRINT_AREA_EXPRESSION,
  listFormExpression,
  receiptFormExpression,
} from './hipass-page';

describe('listFormExpression', () => {
  it('embeds the date into both sDate and eDate', () => {
    const expr = listFormExpression('20260528');
    expect(expr).toContain('"sDate":"20260528"');
    expect(expr).toContain('"eDate":"20260528"');
  });

  it('targets the usage-list search endpoint and defines `form`', () => {
    const expr = listFormExpression('20260528');
    expect(expr).toContain('/usepculr/UsePculrTabSearchList.do');
    expect(expr).toContain('const form =');
  });

  it('carries the verified static query params', () => {
    const expr = listFormExpression('20260528');
    expect(expr).toContain('"date_type":"work"');
    expect(expr).toContain('"biz_type":"on"');
    expect(expr).toContain('"inc_vat":"nodisplay"');
  });

  it('rejects non-YYYYMMDD dates', () => {
    expect(() => listFormExpression('2026-05-28')).toThrow('invalid_date');
    expect(() => listFormExpression('abc')).toThrow('invalid_date');
    expect(() => listFormExpression('')).toThrow('invalid_date');
  });
});

describe('receiptFormExpression', () => {
  it('switches hpForm into a batch receipt print (is_all=1)', () => {
    const expr = receiptFormExpression();
    expect(expr).toContain('document.hpForm');
    expect(expr).toContain("isAll.value = '1'");
    expect(expr).toContain('/usepculr/UsePculrReceiptPrint.do');
    expect(expr).toContain('const form =');
  });
});

describe('page-context expressions', () => {
  it('probe detects login-page redirect and auth-check expiry, plus form presence', () => {
    expect(LIST_PROBE_EXPRESSION).toContain('lginpg.do');
    expect(LIST_PROBE_EXPRESSION).toContain('CommonAuthCheck');
    expect(LIST_PROBE_EXPRESSION).toContain('document.hpForm');
  });

  it('swap copies #print1 into body and parses the summary total', () => {
    expect(SWAP_TO_PRINT_AREA_EXPRESSION).toContain("getElementById('print1')");
    expect(SWAP_TO_PRINT_AREA_EXPRESSION).toContain('document.body.innerHTML = print1.innerHTML');
  });
});

describe('SWAP_TO_PRINT_AREA_EXPRESSION runtime parsing', () => {
  function runSwap(innerHtml: string | null): { found: boolean; count: number; amount: number } {
    document.body.innerHTML = innerHtml === null ? '' : `<div id="print1">${innerHtml}</div>`;
    const raw: unknown = (0, eval)(SWAP_TO_PRINT_AREA_EXPRESSION);
    const r = raw as Record<string, unknown>;
    return { found: Boolean(r.found), count: Number(r.count), amount: Number(r.amount) };
  }

  it('returns not-found when #print1 is absent', () => {
    expect(runSwap(null)).toEqual({ found: false, count: 0, amount: 0 });
  });

  it('parses count and amount from the compact "총N건/X원" summary', () => {
    expect(runSwap('<p>총2건/2240원</p>')).toEqual({ found: true, count: 2, amount: 2240 });
  });

  it('takes the summary total, not a preceding per-row amount', () => {
    const body =
      '<div>1종 1,120원(카드)</div><div>1종 1,120원(카드)</div><div>총2건/2240원</div>';
    const r = runSwap(body);
    expect(r.count).toBe(2);
    expect(r.amount).toBe(2240);
  });

  it('still reports found when the summary is unparseable, not a phantom empty', () => {
    const r = runSwap('<table><tr><td>영수증</td></tr></table>');
    expect(r.found).toBe(true);
    expect(r.count).toBe(0);
  });
});
