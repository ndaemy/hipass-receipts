import type { SwInbound, SwOutbound } from '../types/jobs';
import { cancelJob, runJob } from './orchestrator';

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return;

  port.onMessage.addListener((rawMsg: unknown) => {
    if (!isSwInbound(rawMsg)) return;
    handleSidepanelMessage(rawMsg, port);
  });
});

function handleSidepanelMessage(msg: SwInbound, port: chrome.runtime.Port): void {
  switch (msg.type) {
    case 'ping': {
      const pong: SwOutbound = { type: 'pong' };
      port.postMessage(pong);
      return;
    }
    case 'start-job': {
      void runJob(msg.spec, (out) => port.postMessage(out));
      return;
    }
    case 'cancel-job': {
      cancelJob(msg.jobId);
      return;
    }
    default: {
      const exhaustive: never = msg;
      void exhaustive;
      return;
    }
  }
}

function isSwInbound(m: unknown): m is SwInbound {
  if (typeof m !== 'object' || m === null) return false;
  const t = (m as Record<string, unknown>)['type'];
  return t === 'ping' || t === 'start-job' || t === 'cancel-job';
}
