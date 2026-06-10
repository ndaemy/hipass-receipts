import type { JobSpec, OutputMode, SwInbound, SwOutbound } from '../types/jobs';
import { lastNDays, monthGrid, shiftMonth, toYYYYMMDD } from './dates';
import { formatDoneStatus } from './status';

type ModeRadioValue = 'pdf-separate' | 'pdf-combined' | 'png-separate';

const KEEPALIVE_INTERVAL_MS = 20_000;

const selectedDates = new Set<string>();
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let busy = false;
let activeJobId: string | null = null;

const port = chrome.runtime.connect({ name: 'sidepanel' });

const keepAliveId = setInterval(() => {
  const ping: SwInbound = { type: 'ping' };
  port.postMessage(ping);
}, KEEPALIVE_INTERVAL_MS);

port.onMessage.addListener((msg: SwOutbound) => {
  handleSwMessage(msg);
});

port.onDisconnect.addListener(() => {
  clearInterval(keepAliveId);
});

const $ = <T extends Element = HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error('Missing element: ' + sel);
  return el;
};

function renderCalendar(): void {
  const grid = $('#calendar-grid');
  grid.innerHTML = '';
  const cells = monthGrid(viewYear, viewMonth);
  for (const cell of cells) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'day';
    if (!cell.inCurrentMonth) btn.classList.add('outside');
    if (cell.isToday) btn.classList.add('today');
    if (selectedDates.has(cell.yyyymmdd)) btn.classList.add('selected');
    btn.textContent = String(cell.date.getDate());
    btn.dataset['ymd'] = cell.yyyymmdd;
    btn.addEventListener('click', () => toggleDate(cell.yyyymmdd));
    grid.appendChild(btn);
  }
  $('#month-label').textContent = `${viewYear}년 ${viewMonth + 1}월`;
}

function renderSummary(): void {
  $('#selected-count').textContent = `${selectedDates.size}건 선택`;
  const sorted = [...selectedDates].sort();
  $('#selected-chips').textContent = sorted.join(', ');
  $<HTMLButtonElement>('#download-btn').disabled = busy || selectedDates.size === 0;
}

function toggleDate(ymd: string): void {
  if (busy) return;
  if (selectedDates.has(ymd)) selectedDates.delete(ymd);
  else selectedDates.add(ymd);
  renderCalendar();
  renderSummary();
}

function applyPreset(preset: string): void {
  if (busy) return;
  if (preset === 'clear') {
    selectedDates.clear();
  } else if (preset === 'last-5') {
    selectedDates.clear();
    for (const d of lastNDays(5)) selectedDates.add(d);
  } else if (preset === 'last-10') {
    selectedDates.clear();
    for (const d of lastNDays(10)) selectedDates.add(d);
  }
  renderCalendar();
  renderSummary();
}

function readMode(): { mode: OutputMode; zip: boolean } {
  const radio = document.querySelector<HTMLInputElement>('input[name="mode"]:checked');
  const value = (radio?.value ?? 'pdf-separate') as ModeRadioValue;
  const zipToggle = $<HTMLInputElement>('#zip-toggle').checked;
  switch (value) {
    case 'pdf-combined':
      return { mode: { format: 'pdf', combine: true }, zip: false };
    case 'png-separate':
      return { mode: { format: 'png', combine: false }, zip: zipToggle };
    case 'pdf-separate':
    default:
      return { mode: { format: 'pdf', combine: false }, zip: zipToggle };
  }
}

function setBusy(value: boolean): void {
  busy = value;
  $<HTMLButtonElement>('#download-btn').disabled = busy || selectedDates.size === 0;
  $('#progress').classList.toggle('hidden', !busy);
}

function setStatus(text: string, level: 'info' | 'error' | 'success' = 'info'): void {
  const el = $('#status');
  el.textContent = text;
  el.className = `status ${level}`;
}

function startJob(): void {
  if (busy || selectedDates.size === 0) return;

  const { mode, zip } = readMode();
  const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const spec: JobSpec = {
    jobId,
    dates: [...selectedDates].sort(),
    mode,
    zip,
  };

  activeJobId = jobId;
  setBusy(true);
  setStatus('');
  $('#progress-label').textContent = '준비 중...';
  $<HTMLDivElement>('#progress-fill').style.width = '0%';

  const msg: SwInbound = { type: 'start-job', spec };
  port.postMessage(msg);
}

function cancelJob(): void {
  if (!busy || !activeJobId) return;
  const msg: SwInbound = { type: 'cancel-job', jobId: activeJobId };
  port.postMessage(msg);
  setStatus('취소 요청을 보냈습니다.', 'info');
}

function handleSwMessage(msg: SwOutbound): void {
  switch (msg.type) {
    case 'job-accepted': {
      setStatus('다운로드 시작...', 'info');
      return;
    }
    case 'progress': {
      const { done, total, currentDate, currentLabel, phase } = msg.progress;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      $<HTMLDivElement>('#progress-fill').style.width = `${pct}%`;
      const dateStr = currentDate ?? '';
      const labelStr = currentLabel ?? phase;
      $('#progress-label').textContent = `${done}/${total === -1 ? '?' : total} · ${dateStr} ${labelStr}`;
      return;
    }
    case 'session-expired': {
      setBusy(false);
      activeJobId = null;
      setStatus('세션이 만료되었습니다. hipass.co.kr에서 다시 로그인해주세요.', 'error');
      return;
    }
    case 'job-error': {
      setBusy(false);
      activeJobId = null;
      if (msg.error === 'no_transactions') {
        // Not a failure: the selected days simply had no toll receipts.
        setStatus('선택한 날짜에 출력할 영수증이 없습니다.', 'info');
        return;
      }
      setStatus(`오류 (${msg.phase}): ${msg.error}`, 'error');
      return;
    }
    case 'job-done': {
      setBusy(false);
      activeJobId = null;
      setStatus(formatDoneStatus(msg.filenames, msg.skippedDates), 'success');
      return;
    }
    case 'pong': {
      return;
    }
    default: {
      const exhaustive: never = msg;
      void exhaustive;
      return;
    }
  }
}

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const preset = target.dataset['preset'];
  if (preset) applyPreset(preset);
});

$('#prev-month').addEventListener('click', () => {
  const next = shiftMonth(viewYear, viewMonth, -1);
  viewYear = next.year;
  viewMonth = next.monthIndex0;
  renderCalendar();
});

$('#next-month').addEventListener('click', () => {
  const next = shiftMonth(viewYear, viewMonth, 1);
  viewYear = next.year;
  viewMonth = next.monthIndex0;
  renderCalendar();
});

$('#download-btn').addEventListener('click', startJob);
$('#cancel-btn').addEventListener('click', cancelJob);

function syncZipToggleEnabled(): void {
  const checked = document.querySelector<HTMLInputElement>('input[name="mode"]:checked');
  $<HTMLInputElement>('#zip-toggle').disabled = checked?.value === 'pdf-combined';
}
document.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach((el) => {
  el.addEventListener('change', syncZipToggleEnabled);
});
syncZipToggleEnabled();

const today = new Date();
const recent = toYYYYMMDD(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 4));
viewYear = Number(recent.slice(0, 4));
viewMonth = Number(recent.slice(4, 6)) - 1;

renderCalendar();
renderSummary();
