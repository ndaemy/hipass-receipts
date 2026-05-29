import JSZip from 'jszip';

export interface ZipEntry {
  filename: string;
  blob: Blob;
}

export async function zipFiles(entries: ZipEntry[]): Promise<Blob> {
  if (entries.length === 0) {
    throw new Error('Empty entries');
  }

  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.filename, entry.blob);
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
