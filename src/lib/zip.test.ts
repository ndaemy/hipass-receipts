import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { zipFiles } from './zip';

describe('zipFiles', () => {
  it('rejects empty entries', async () => {
    await expect(zipFiles([])).rejects.toThrow('Empty entries');
  });

  it('packages multiple files into one ZIP and round-trips contents', async () => {
    const entries = [
      { filename: 'receipt-1.pdf', blob: new Blob(['%PDF-1.4 first'], { type: 'application/pdf' }) },
      { filename: 'receipt-2.pdf', blob: new Blob(['%PDF-1.4 second'], { type: 'application/pdf' }) },
      { filename: 'image.png', blob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }) },
    ];

    const zipBlob = await zipFiles(entries);
    expect(zipBlob.type).toBe('application/zip');
    expect(zipBlob.size).toBeGreaterThan(0);

    const roundTrip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    const names = Object.keys(roundTrip.files).sort();
    expect(names).toEqual(['image.png', 'receipt-1.pdf', 'receipt-2.pdf']);

    const second = await roundTrip.file('receipt-2.pdf')?.async('string');
    expect(second).toBe('%PDF-1.4 second');
  });

  it('preserves Korean filenames', async () => {
    const blob = new Blob(['x'], { type: 'application/pdf' });
    const entries = [{ filename: '20260527_12가3456_서울톨게이트_3500원.pdf', blob }];

    const zipBlob = await zipFiles(entries);
    const roundTrip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(roundTrip.files)).toEqual(['20260527_12가3456_서울톨게이트_3500원.pdf']);
  });
});
