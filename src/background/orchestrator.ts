import type { JobSpec, OffscreenInbound, SwOutbound } from '../types/jobs';
import { CdpDriver } from '../lib/cdp';
import {
  LIST_PROBE_EXPRESSION,
  SWAP_TO_PRINT_AREA_EXPRESSION,
  WAIT_FOR_RENDER_EXPRESSION,
  listFormExpression,
  receiptFormExpression,
  type ListProbe,
  type ReceiptMeta,
} from '../lib/hipass-page';
import { callOffscreen, releaseBlob } from '../lib/offscreen-client';
import { buildCombinedFilename, buildDateFilename, buildZipFilename } from '../lib/filename';

const WORKER_URL = 'https://www.hipass.co.kr/';
const PNG_VIEWPORT_WIDTH = 800;
const MAX_PNG_HEIGHT = 30_000;

const activeJobs = new Map<string, AbortController>();

export type Postback = (msg: SwOutbound) => void;

interface DatePage {
  date: string;
  base64: string;
  count: number;
  amount: number;
}

interface RenderedFile {
  filename: string;
  blobUrl: string;
}

export async function runJob(spec: JobSpec, post: Postback): Promise<void> {
  if (activeJobs.size > 0) {
    post({ type: 'job-error', jobId: spec.jobId, phase: 'list', error: 'another_job_running' });
    return;
  }

  const ctrl = new AbortController();
  activeJobs.set(spec.jobId, ctrl);
  try {
    post({ type: 'job-accepted', jobId: spec.jobId });
    await runJobInner(spec, post, ctrl);
  } catch (err) {
    if (ctrl.signal.aborted) return;
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'job-error', jobId: spec.jobId, phase: 'receipt', error: message });
  } finally {
    activeJobs.delete(spec.jobId);
  }
}

export function cancelJob(jobId: string): void {
  activeJobs.get(jobId)?.abort();
}

async function runJobInner(spec: JobSpec, post: Postback, ctrl: AbortController): Promise<void> {
  const signal = ctrl.signal;
  const total = spec.dates.length;
  post({ type: 'progress', progress: { jobId: spec.jobId, done: 0, total, phase: 'list' } });

  const { windowId, tabId } = await createWorkerWindow();
  const cdp = new CdpDriver(tabId);

  try {
    await cdp.attach();
    cdp.setOnDetached(() => ctrl.abort());
    await cdp.navigate(WORKER_URL);

    const format = spec.mode.format;
    if (format === 'png') await cdp.setViewportWidth(PNG_VIEWPORT_WIDTH);

    const pages: DatePage[] = [];
    let index = 0;
    for (const date of spec.dates) {
      throwIfAborted(signal);
      post({
        type: 'progress',
        progress: { jobId: spec.jobId, done: index, total, currentDate: date, phase: 'receipt' },
      });

      await cdp.submitNavigate(listFormExpression(date));
      const probe = await cdp.evaluate<ListProbe>(LIST_PROBE_EXPRESSION);
      if (probe.expired) {
        post({ type: 'session-expired', jobId: spec.jobId });
        return;
      }
      if (!probe.hasForm) {
        index += 1;
        continue;
      }

      await cdp.submitNavigate(receiptFormExpression());
      const meta = await cdp.evaluate<ReceiptMeta>(SWAP_TO_PRINT_AREA_EXPRESSION);
      if (!meta.found || meta.count === 0) {
        index += 1;
        continue;
      }

      post({
        type: 'progress',
        progress: {
          jobId: spec.jobId,
          done: index,
          total,
          currentDate: date,
          currentLabel: `${meta.count}건`,
          phase: 'render',
        },
      });
      pages.push({ date, count: meta.count, amount: meta.amount, base64: await capture(cdp, format) });
      index += 1;
    }

    if (pages.length === 0) {
      post({ type: 'job-error', jobId: spec.jobId, phase: 'receipt', error: 'no_transactions' });
      return;
    }

    if (spec.mode.format === 'pdf' && spec.mode.combine) {
      await emitCombinedPdf(spec, pages, post, signal);
    } else {
      await emitSeparateFiles(spec, pages, post, signal);
    }
  } finally {
    await cdp.detach();
    await removeWindow(windowId);
  }
}

async function capture(cdp: CdpDriver, format: 'pdf' | 'png'): Promise<string> {
  if (format === 'pdf') return cdp.printToPdf();

  await cdp.evaluate(WAIT_FOR_RENDER_EXPRESSION, true);
  const size = await cdp.getContentSize();
  if (size.height > MAX_PNG_HEIGHT) throw new Error('receipt_too_tall_for_png');
  return cdp.captureScreenshot(size.width, size.height);
}

async function emitCombinedPdf(
  spec: JobSpec,
  pages: DatePage[],
  post: Postback,
  signal: AbortSignal,
): Promise<void> {
  const filename = buildCombinedFilename(
    pages.map((p) => p.date),
    'pdf',
  );
  const resp = await callOffscreen({
    type: 'merge-pdfs',
    base64Pdfs: pages.map((p) => p.base64),
    filename,
  });
  if (resp.type === 'render-error') {
    post({ type: 'job-error', jobId: spec.jobId, phase: 'render', error: resp.error });
    return;
  }

  post({
    type: 'progress',
    progress: { jobId: spec.jobId, done: pages.length, total: spec.dates.length, phase: 'download' },
  });
  await downloadAndWait(resp.blobUrl, resp.filename, signal);
  await releaseBlob(resp.blobUrl);
  post({ type: 'job-done', jobId: spec.jobId, filenames: [resp.filename] });
}

async function emitSeparateFiles(
  spec: JobSpec,
  pages: DatePage[],
  post: Postback,
  signal: AbortSignal,
): Promise<void> {
  const format = spec.mode.format;
  const mime = format === 'pdf' ? 'application/pdf' : 'image/png';
  const rendered: RenderedFile[] = [];

  for (const page of pages) {
    throwIfAborted(signal);
    const filename = buildDateFilename(page.date, page.count, page.amount, format);
    const resp = await callOffscreen({
      type: 'blob-from-base64',
      base64: page.base64,
      mime,
      filename,
    } satisfies OffscreenInbound);
    if (resp.type === 'render-error') {
      await releaseRendered(rendered);
      post({ type: 'job-error', jobId: spec.jobId, phase: 'render', error: resp.error });
      return;
    }
    rendered.push({ filename: resp.filename, blobUrl: resp.blobUrl });
  }

  if (spec.zip) {
    await emitZip(spec, pages, rendered, post, signal);
    return;
  }

  post({
    type: 'progress',
    progress: { jobId: spec.jobId, done: pages.length, total: spec.dates.length, phase: 'download' },
  });
  const filenames: string[] = [];
  for (const file of rendered) {
    throwIfAborted(signal);
    await downloadAndWait(file.blobUrl, file.filename, signal);
    await releaseBlob(file.blobUrl);
    filenames.push(file.filename);
  }
  post({ type: 'job-done', jobId: spec.jobId, filenames });
}

async function emitZip(
  spec: JobSpec,
  pages: DatePage[],
  rendered: RenderedFile[],
  post: Postback,
  signal: AbortSignal,
): Promise<void> {
  post({
    type: 'progress',
    progress: { jobId: spec.jobId, done: pages.length, total: spec.dates.length, phase: 'zip' },
  });
  const zipFilename = buildZipFilename(pages.map((p) => p.date));
  const resp = await callOffscreen({ type: 'pack-zip', input: { files: rendered, zipFilename } });
  await releaseRendered(rendered);
  if (resp.type === 'render-error') {
    post({ type: 'job-error', jobId: spec.jobId, phase: 'zip', error: resp.error });
    return;
  }
  post({
    type: 'progress',
    progress: { jobId: spec.jobId, done: pages.length, total: spec.dates.length, phase: 'download' },
  });
  await downloadAndWait(resp.blobUrl, resp.filename, signal);
  await releaseBlob(resp.blobUrl);
  post({ type: 'job-done', jobId: spec.jobId, filenames: [resp.filename] });
}

async function createWorkerWindow(): Promise<{ windowId: number; tabId: number }> {
  const win = await chrome.windows.create({
    type: 'popup',
    focused: false,
    width: 840,
    height: 1000,
    url: WORKER_URL,
  });
  const tabId = win?.tabs?.[0]?.id;
  if (!win?.id || tabId === undefined) {
    throw new Error('worker_window_failed');
  }
  return { windowId: win.id, tabId };
}

async function removeWindow(windowId: number): Promise<void> {
  try {
    await chrome.windows.remove(windowId);
  } catch {
    // Window may already be closed (user-closed, or detach teardown); ignore.
  }
}

function releaseRendered(items: RenderedFile[]): Promise<void[]> {
  return Promise.all(items.map((it) => releaseBlob(it.blobUrl)));
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('cancelled');
}

function downloadAndWait(url: string, filename: string, signal: AbortSignal): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let downloadId: number | null = null;
    const listener = (delta: chrome.downloads.DownloadDelta): void => {
      if (downloadId === null || delta.id !== downloadId) return;
      const state = delta.state?.current;
      if (state === 'complete') {
        chrome.downloads.onChanged.removeListener(listener);
        signal.removeEventListener('abort', abortHandler);
        resolve(downloadId);
      } else if (state === 'interrupted') {
        chrome.downloads.onChanged.removeListener(listener);
        signal.removeEventListener('abort', abortHandler);
        reject(new Error('download_interrupted'));
      }
    };
    const abortHandler = (): void => {
      chrome.downloads.onChanged.removeListener(listener);
      if (downloadId !== null) {
        void chrome.downloads.cancel(downloadId).catch(() => undefined);
      }
      reject(new Error('cancelled'));
    };
    signal.addEventListener('abort', abortHandler, { once: true });
    chrome.downloads.onChanged.addListener(listener);

    chrome.downloads
      .download({ url, filename, conflictAction: 'uniquify', saveAs: false })
      .then((id) => {
        downloadId = id;
      })
      .catch((err: unknown) => {
        chrome.downloads.onChanged.removeListener(listener);
        signal.removeEventListener('abort', abortHandler);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}
