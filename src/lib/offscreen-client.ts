import type { OffscreenInbound, OffscreenOutbound } from '../types/jobs';

const OFFSCREEN_URL = 'src/offscreen/render.html';

let ensured = false;

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  return contexts.length > 0;
}

async function ensureOffscreen(): Promise<void> {
  if (ensured) return;
  if (await hasOffscreenDocument()) {
    ensured = true;
    return;
  }
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification: 'Decode CDP base64 PDF/PNG to Blobs, merge PDFs, and mint blob URLs for chrome.downloads.',
  });
  ensured = true;
}

export async function callOffscreen(msg: OffscreenInbound): Promise<OffscreenOutbound> {
  await ensureOffscreen();
  const response = await chrome.runtime.sendMessage<OffscreenInbound, OffscreenOutbound | undefined>(msg);
  if (!response) {
    return { type: 'render-error', phase: 'render', error: 'no_offscreen_response' };
  }
  return response;
}

export async function releaseBlob(blobUrl: string): Promise<void> {
  if (!(await hasOffscreenDocument())) return;
  await chrome.runtime.sendMessage({ type: 'release-blob', blobUrl } satisfies OffscreenInbound);
}
