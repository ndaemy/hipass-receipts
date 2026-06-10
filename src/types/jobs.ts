/**
 * Cross-context message contracts: Side Panel ↔ Service Worker ↔ Offscreen.
 * chrome.runtime messaging is JSON (not structured clone) — keep payloads
 * JSON-serialisable and hand Blobs across as blob URLs minted in the offscreen
 * document, never as raw Blob instances.
 */

export type OutputFormat = 'pdf' | 'png';

export type OutputMode =
  | { format: 'pdf'; combine: true }
  | { format: 'pdf'; combine: false }
  | { format: 'png'; combine: false };

export interface JobSpec {
  jobId: string;
  dates: string[];
  mode: OutputMode;
  zip: boolean;
}

export type JobPhase = 'list' | 'receipt' | 'render' | 'zip' | 'download';

export interface JobProgress {
  jobId: string;
  done: number;
  /** -1 until the list fetch resolves and the receipt count is known. */
  total: number;
  currentDate?: string;
  currentLabel?: string;
  phase: JobPhase;
}

export type SwInbound =
  | { type: 'start-job'; spec: JobSpec }
  | { type: 'cancel-job'; jobId: string }
  /** Heartbeat that keeps the MV3 service worker awake while a job runs. */
  | { type: 'ping' };

export type SwOutbound =
  | { type: 'job-accepted'; jobId: string }
  | { type: 'progress'; progress: JobProgress }
  | { type: 'session-expired'; jobId: string }
  | { type: 'job-error'; jobId: string; phase: JobPhase; error: string }
  | { type: 'job-done'; jobId: string; filenames: string[]; skippedDates?: string[] }
  | { type: 'pong' };

export type OutputMime = 'application/pdf' | 'image/png';

export interface ZipInput {
  files: { filename: string; blobUrl: string }[];
  zipFilename: string;
}

/**
 * Messages the service worker sends to the offscreen document. CDP returns
 * PDF/PNG payloads as base64; the offscreen document decodes them to Blobs and
 * mints blob URLs (the MV3 service worker cannot call `URL.createObjectURL`).
 */
export type OffscreenInbound =
  | { type: 'blob-from-base64'; base64: string; mime: OutputMime; filename: string }
  | { type: 'merge-pdfs'; base64Pdfs: string[]; filename: string }
  | { type: 'pack-zip'; input: ZipInput }
  /** Free a blob URL that the SW no longer needs (post-download). */
  | { type: 'release-blob'; blobUrl: string };

export type OffscreenOutbound =
  | { type: 'render-done'; blobUrl: string; filename: string }
  | { type: 'render-error'; phase: 'render' | 'zip'; error: string };
