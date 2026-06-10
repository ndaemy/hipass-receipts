/** Format a YYYYMMDD string as YYYY-MM-DD for display. */
function hyphenateDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * Build the side-panel "job done" status line. When some selected dates were
 * skipped (no toll history that day), append a note listing them so the user
 * understands why fewer files than selected dates were downloaded.
 */
export function formatDoneStatus(filenames: string[], skippedDates: string[] | undefined): string {
  const base = `완료 — ${filenames.length}개 파일 다운로드됨`;
  if (!skippedDates || skippedDates.length === 0) return base;
  const note = [...skippedDates].sort().map(hyphenateDate).join(', ');
  return `${base} (이력 없어 제외: ${note})`;
}
