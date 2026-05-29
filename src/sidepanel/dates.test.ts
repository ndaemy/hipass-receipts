import { describe, expect, it } from 'vitest';
import { lastNDays, monthGrid, parseYYYYMMDD, shiftMonth, toYYYYMMDD } from './dates';

describe('toYYYYMMDD', () => {
  it('formats with leading zeros', () => {
    expect(toYYYYMMDD(new Date(2026, 0, 5))).toBe('20260105');
  });

  it('handles end of year', () => {
    expect(toYYYYMMDD(new Date(2026, 11, 31))).toBe('20261231');
  });
});

describe('parseYYYYMMDD', () => {
  it('round-trips with toYYYYMMDD', () => {
    expect(toYYYYMMDD(parseYYYYMMDD('20260527'))).toBe('20260527');
  });

  it('throws on invalid input', () => {
    expect(() => parseYYYYMMDD('2026-05-27')).toThrow();
    expect(() => parseYYYYMMDD('abcdefgh')).toThrow();
    expect(() => parseYYYYMMDD('')).toThrow();
  });
});

describe('lastNDays', () => {
  it('returns N dates ending today, sorted ascending', () => {
    const today = new Date(2026, 4, 27);
    const out = lastNDays(5, today);
    expect(out).toEqual(['20260523', '20260524', '20260525', '20260526', '20260527']);
  });

  it('crosses month boundary', () => {
    const today = new Date(2026, 4, 2);
    const out = lastNDays(5, today);
    expect(out).toEqual(['20260428', '20260429', '20260430', '20260501', '20260502']);
  });

  it('returns N entries', () => {
    expect(lastNDays(10, new Date(2026, 4, 27))).toHaveLength(10);
  });
});

describe('monthGrid', () => {
  it('returns exactly 42 cells', () => {
    expect(monthGrid(2026, 4, new Date(2026, 4, 27))).toHaveLength(42);
  });

  it('first cell is a Sunday', () => {
    const cells = monthGrid(2026, 4, new Date(2026, 4, 27));
    expect(cells[0]?.date.getDay()).toBe(0);
  });

  it('marks today correctly', () => {
    const today = new Date(2026, 4, 27);
    const cells = monthGrid(2026, 4, today);
    const todayCell = cells.find((c) => c.isToday);
    expect(todayCell?.yyyymmdd).toBe('20260527');
  });

  it('marks in-current-month vs adjacent', () => {
    const cells = monthGrid(2026, 4, new Date(2026, 4, 27));
    const inMonth = cells.filter((c) => c.inCurrentMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0]?.yyyymmdd).toBe('20260501');
    expect(inMonth[inMonth.length - 1]?.yyyymmdd).toBe('20260531');
  });
});

describe('shiftMonth', () => {
  it('moves forward', () => {
    expect(shiftMonth(2026, 4, 1)).toEqual({ year: 2026, monthIndex0: 5 });
  });

  it('rolls year on December → January', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex0: 0 });
  });

  it('rolls year on January → December', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex0: 11 });
  });
});
