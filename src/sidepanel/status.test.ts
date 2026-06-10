import { describe, expect, it } from 'vitest';
import { formatDoneStatus } from './status';

describe('formatDoneStatus', () => {
  it('reports only the file count when nothing was skipped', () => {
    expect(formatDoneStatus(['a.pdf', 'b.pdf'], undefined)).toBe('완료 — 2개 파일 다운로드됨');
  });

  it('treats an empty skipped list the same as no skips', () => {
    expect(formatDoneStatus(['a.pdf'], [])).toBe('완료 — 1개 파일 다운로드됨');
  });

  it('appends a skipped-dates note when one date was skipped', () => {
    expect(formatDoneStatus(['20260607_2건_3200원.pdf'], ['20260602'])).toBe(
      '완료 — 1개 파일 다운로드됨 (이력 없어 제외: 2026-06-02)',
    );
  });

  it('lists multiple skipped dates sorted and hyphen-formatted', () => {
    expect(formatDoneStatus(['x.pdf'], ['20260609', '20260602'])).toBe(
      '완료 — 1개 파일 다운로드됨 (이력 없어 제외: 2026-06-02, 2026-06-09)',
    );
  });

  it('handles zero downloaded files with skips (defensive)', () => {
    expect(formatDoneStatus([], ['20260602'])).toBe(
      '완료 — 0개 파일 다운로드됨 (이력 없어 제외: 2026-06-02)',
    );
  });
});
