import { PDFDocument } from 'pdf-lib';
import { zipFiles, type ZipEntry } from '../lib/zip';
import type { OffscreenInbound, OffscreenOutbound, OutputMime, ZipInput } from '../types/jobs';

function isOffscreenInbound(m: unknown): m is OffscreenInbound {
  if (typeof m !== 'object' || m === null) return false;
  const t = (m as Record<string, unknown>)['type'];
  return (
    t === 'blob-from-base64' || t === 'merge-pdfs' || t === 'pack-zip' || t === 'release-blob'
  );
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function bytesToBlob(bytes: Uint8Array, mime: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: mime });
}

function blobFromBase64(base64: string, mime: OutputMime, filename: string): OffscreenOutbound {
  return { type: 'render-done', blobUrl: URL.createObjectURL(base64ToBlob(base64, mime)), filename };
}

async function mergePdfs(base64Pdfs: string[], filename: string): Promise<OffscreenOutbound> {
  if (base64Pdfs.length === 0) {
    return { type: 'render-error', phase: 'render', error: 'no_pdfs_to_merge' };
  }
  const merged = await PDFDocument.create();
  for (const base64 of base64Pdfs) {
    const source = await PDFDocument.load(base64);
    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  const blob = bytesToBlob(await merged.save(), 'application/pdf');
  return { type: 'render-done', blobUrl: URL.createObjectURL(blob), filename };
}

async function packZip(input: ZipInput): Promise<OffscreenOutbound> {
  const entries: ZipEntry[] = await Promise.all(
    input.files.map(async (f) => {
      const blob = await (await fetch(f.blobUrl)).blob();
      return { filename: f.filename, blob };
    }),
  );
  const zipBlob = await zipFiles(entries);
  return { type: 'render-done', blobUrl: URL.createObjectURL(zipBlob), filename: input.zipFilename };
}

chrome.runtime.onMessage.addListener(
  (
    rawMsg: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: OffscreenOutbound) => void,
  ) => {
    if (!isOffscreenInbound(rawMsg)) return false;

    if (rawMsg.type === 'release-blob') {
      URL.revokeObjectURL(rawMsg.blobUrl);
      return false;
    }

    if (rawMsg.type === 'blob-from-base64') {
      sendResponse(blobFromBase64(rawMsg.base64, rawMsg.mime, rawMsg.filename));
      return false;
    }

    const work =
      rawMsg.type === 'merge-pdfs'
        ? mergePdfs(rawMsg.base64Pdfs, rawMsg.filename)
        : packZip(rawMsg.input);

    work.then(sendResponse).catch((err: unknown) => {
      sendResponse({
        type: 'render-error',
        phase: rawMsg.type === 'pack-zip' ? 'zip' : 'render',
        error: err instanceof Error ? err.message : String(err),
      });
    });
    return true;
  },
);
