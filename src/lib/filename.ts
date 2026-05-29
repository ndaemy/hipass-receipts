function truncateToBudget(name: string, ext: string, budget = 250): string {
  if (name.length + ext.length + 1 <= budget) return `${name}.${ext}`;
  const headroom = Math.max(0, budget - ext.length - 1);
  return `${name.slice(0, headroom)}.${ext}`;
}

/**
 * One batch receipt page per date. Format: {YYYYMMDD}_{N}건_{금액}원.{pdf|png}
 * Example: 20260528_2건_2240원.pdf
 */
export function buildDateFilename(
  date: string,
  count: number,
  amount: number,
  ext: 'pdf' | 'png',
): string {
  return truncateToBudget(`${date}_${count}건_${amount}원`, ext);
}

export function buildCombinedFilename(dates: string[], ext: 'pdf'): string {
  if (dates.length === 0) throw new Error('Empty dates');
  const sorted = [...dates].sort();
  const first = sorted[0] ?? '';
  const last = sorted[sorted.length - 1] ?? '';
  const stem = first === last ? first : `${first}-${last}`;
  return truncateToBudget(`hipass_receipts_${stem}_${dates.length}건`, ext);
}

export function buildZipFilename(dates: string[]): string {
  if (dates.length === 0) throw new Error('Empty dates');
  const sorted = [...dates].sort();
  const first = sorted[0] ?? '';
  const last = sorted[sorted.length - 1] ?? '';
  const stem = first === last ? first : `${first}-${last}`;
  return truncateToBudget(`hipass_receipts_${stem}_${dates.length}건`, 'zip');
}
