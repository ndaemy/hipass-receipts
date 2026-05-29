import { describe, it, expect, vi } from 'vitest';
import type { SwInbound, SwOutbound } from '../types/jobs';

const mocks = vi.hoisted(() => ({
  runJob: vi.fn().mockResolvedValue(undefined),
  cancelJob: vi.fn(),
}));

vi.mock('./orchestrator', () => ({
  runJob: mocks.runJob,
  cancelJob: mocks.cancelJob,
}));

type ConnectListener = (port: chrome.runtime.Port) => void;
const connectListeners: ConnectListener[] = [];

const mockSidePanel = {
  setPanelBehavior: vi.fn().mockResolvedValue(undefined),
};

vi.stubGlobal('chrome', {
  runtime: {
    onConnect: {
      addListener: vi.fn((listener: ConnectListener) => {
        connectListeners.push(listener);
      }),
    },
    onInstalled: {
      addListener: vi.fn((listener: () => void) => {
        listener();
      }),
    },
  },
  sidePanel: mockSidePanel,
});

await import('./sw');

interface FakePort {
  name: string;
  posted: SwOutbound[];
  postMessage: (m: SwOutbound) => void;
  emit: (m: unknown) => void;
}

function makeFakePort(name: string): FakePort {
  const posted: SwOutbound[] = [];
  const messageListeners: ((m: unknown) => void)[] = [];
  const port = {
    name,
    postMessage: (m: SwOutbound) => posted.push(m),
    disconnect: vi.fn(),
    onMessage: {
      addListener: (l: (m: unknown) => void) => messageListeners.push(l),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },
    onDisconnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    },
  } as unknown as chrome.runtime.Port;
  for (const listener of connectListeners) listener(port);
  return {
    name,
    posted,
    postMessage: port.postMessage,
    emit: (m: unknown) => messageListeners.forEach((l) => l(m)),
  };
}

describe('service worker sidepanel port handler', () => {
  it('replies pong to ping', () => {
    const port = makeFakePort('sidepanel');
    const ping: SwInbound = { type: 'ping' };
    port.emit(ping);
    expect(port.posted).toEqual([{ type: 'pong' }]);
  });

  it('delegates start-job to the orchestrator and pipes its postback through the port', () => {
    mocks.runJob.mockClear();
    const port = makeFakePort('sidepanel');
    const spec: SwInbound = {
      type: 'start-job',
      spec: {
        jobId: 'j-1',
        dates: ['20260527'],
        mode: { format: 'pdf', combine: false },
        zip: false,
      },
    };
    port.emit(spec);

    expect(mocks.runJob).toHaveBeenCalledTimes(1);
    const call = mocks.runJob.mock.calls[0];
    expect(call).toBeDefined();
    const passedSpec = call?.[0] as Extract<SwInbound, { type: 'start-job' }>['spec'];
    const passedPost = call?.[1] as (m: SwOutbound) => void;
    expect(passedSpec).toEqual(spec.spec);

    const downstream: SwOutbound = { type: 'job-accepted', jobId: 'j-1' };
    passedPost(downstream);
    expect(port.posted).toEqual([downstream]);
  });

  it('delegates cancel-job to the orchestrator', () => {
    mocks.cancelJob.mockClear();
    const port = makeFakePort('sidepanel');
    const cancel: SwInbound = { type: 'cancel-job', jobId: 'j-1' };
    port.emit(cancel);
    expect(mocks.cancelJob).toHaveBeenCalledWith('j-1');
  });

  it('ignores ports with unknown names', () => {
    const port = makeFakePort('not-sidepanel');
    const ping: SwInbound = { type: 'ping' };
    port.emit(ping);
    expect(port.posted).toEqual([]);
  });

  it('ignores malformed inbound payloads', () => {
    const port = makeFakePort('sidepanel');
    port.emit({ type: 'bogus' });
    port.emit(null);
    port.emit('hello');
    expect(port.posted).toEqual([]);
  });
});
