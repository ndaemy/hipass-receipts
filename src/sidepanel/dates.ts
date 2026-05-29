export function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function parseYYYYMMDD(s: string): Date {
  if (!/^\d{8}$/.test(s)) {
    throw new Error('Invalid YYYYMMDD: ' + s);
  }
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(4, 6)) - 1;
  const day = Number(s.slice(6, 8));
  return new Date(year, month, day);
}

export function lastNDays(n: number, today: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push(toYYYYMMDD(d));
  }
  return out.sort();
}

export interface CalendarCell {
  date: Date;
  yyyymmdd: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Builds a 6-row × 7-column grid for the given month, padded with adjacent
 * months' days so the first column is Sunday and the grid is fully rectangular.
 */
export function monthGrid(year: number, monthIndex0: number, today: Date = new Date()): CalendarCell[] {
  const firstOfMonth = new Date(year, monthIndex0, 1);
  const firstDayOfWeek = firstOfMonth.getDay();
  const todayKey = toYYYYMMDD(today);

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, monthIndex0, 1 - firstDayOfWeek + i);
    cells.push({
      date: d,
      yyyymmdd: toYYYYMMDD(d),
      inCurrentMonth: d.getMonth() === monthIndex0 && d.getFullYear() === year,
      isToday: toYYYYMMDD(d) === todayKey,
    });
  }
  return cells;
}

export function shiftMonth(year: number, monthIndex0: number, deltaMonths: number): { year: number; monthIndex0: number } {
  const ref = new Date(year, monthIndex0 + deltaMonths, 1);
  return { year: ref.getFullYear(), monthIndex0: ref.getMonth() };
}
