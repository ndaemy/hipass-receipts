import { describe, expect, it } from 'vitest';
import { buildCombinedFilename, buildDateFilename, buildZipFilename } from './filename';

describe('buildDateFilename', () => {
  it('builds a per-date PDF filename with count and amount', () => {
    expect(buildDateFilename('20260528', 2, 2240, 'pdf')).toBe('20260528_2건_2240원.pdf');
  });

  it('builds a per-date PNG filename', () => {
    expect(buildDateFilename('20260528', 1, 1120, 'png')).toBe('20260528_1건_1120원.png');
  });

  it('handles zero amount (free passage)', () => {
    expect(buildDateFilename('20260101', 1, 0, 'pdf')).toBe('20260101_1건_0원.pdf');
  });

  it('matches the expected filename pattern', () => {
    expect(buildDateFilename('20260528', 3, 5000, 'pdf')).toMatch(/^\d{8}_\d+건_\d+원\.(pdf|png)$/);
  });
});

describe('buildCombinedFilename', () => {
  it('uses single date when only one date', () => {
    expect(buildCombinedFilename(['20260527'], 'pdf')).toBe('hipass_receipts_20260527_1건.pdf');
  });

  it('uses date range stem when multiple dates', () => {
    const out = buildCombinedFilename(['20260525', '20260527', '20260530'], 'pdf');
    expect(out).toBe('hipass_receipts_20260525-20260530_3건.pdf');
  });

  it('sorts unsorted input', () => {
    const out = buildCombinedFilename(['20260530', '20260525', '20260527'], 'pdf');
    expect(out).toBe('hipass_receipts_20260525-20260530_3건.pdf');
  });

  it('rejects empty', () => {
    expect(() => buildCombinedFilename([], 'pdf')).toThrow('Empty dates');
  });
});

describe('buildZipFilename', () => {
  it('uses .zip extension', () => {
    expect(buildZipFilename(['20260527'])).toBe('hipass_receipts_20260527_1건.zip');
  });

  it('uses range stem', () => {
    expect(buildZipFilename(['20260525', '20260530'])).toBe('hipass_receipts_20260525-20260530_2건.zip');
  });
});
