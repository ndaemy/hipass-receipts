/**
 * Chrome DevTools Protocol driver over `chrome.debugger`.
 *
 * The receipt download flow mirrors hipass's OWN print pipeline instead of
 * self-rendering: we drive a worker tab to POST the usage-list form, POST the
 * batch receipt-print form (`is_all=1`), replace `<body>` with `#print1` (what
 * the site's `printDiv()` does), then emit the page via `Page.printToPDF` /
 * `Page.captureScreenshot`. CDP is the single control channel — `Runtime.evaluate`
 * runs the DOM steps, so no `scripting` permission is needed.
 *
 * Navigation waiting is loader-scoped: a waiter registered BEFORE the submit
 * records the new main-frame `loaderId` from `Page.frameNavigated`, then resolves
 * on the matching `Page.lifecycleEvent` (`name === 'load'`). This proves the new
 * document loaded rather than reacting to a stale signal.
 */

type CdpEventHandler = (method: string, params: Record<string, unknown>) => void;

interface FrameTreeResult {
  frameTree: { frame: { id: string; loaderId: string } };
}

interface EvaluateResult {
  result: { value?: unknown; type: string };
  exceptionDetails?: { text: string; exception?: { description?: string } };
}

interface PrintOrShotResult {
  data: string;
}

interface LayoutMetricsResult {
  cssContentSize: { x: number; y: number; width: number; height: number };
}

const NAV_TIMEOUT_MS = 30_000;

export class CdpDriver {
  private readonly target: chrome.debugger.Debuggee;
  private readonly handlers = new Set<CdpEventHandler>();
  private attached = false;
  private onDetached: (() => void) | null = null;

  constructor(private readonly tabId: number) {
    this.target = { tabId };
  }

  private readonly eventListener = (
    source: chrome.debugger.Debuggee,
    method: string,
    params?: object,
  ): void => {
    if (source.tabId !== this.tabId) return;
    for (const handler of this.handlers) {
      handler(method, (params ?? {}) as Record<string, unknown>);
    }
  };

  private readonly detachListener = (source: chrome.debugger.Debuggee): void => {
    if (source.tabId !== this.tabId) return;
    this.attached = false;
    this.onDetached?.();
  };

  /** Register a one-shot hard-abort callback fired if Chrome detaches the debugger. */
  setOnDetached(callback: () => void): void {
    this.onDetached = callback;
  }

  isAttached(): boolean {
    return this.attached;
  }

  async attach(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.attach(this.target, '1.3', () => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(`debugger_attach_failed: ${err.message}`));
          return;
        }
        resolve();
      });
    });
    this.attached = true;
    chrome.debugger.onEvent.addListener(this.eventListener);
    chrome.debugger.onDetach.addListener(this.detachListener);
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Page.setLifecycleEventsEnabled', { enabled: true });
  }

  async detach(): Promise<void> {
    chrome.debugger.onEvent.removeListener(this.eventListener);
    chrome.debugger.onDetach.removeListener(this.detachListener);
    this.handlers.clear();
    if (!this.attached) return;
    this.attached = false;
    await new Promise<void>((resolve) => {
      chrome.debugger.detach(this.target, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    });
  }

  private send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      chrome.debugger.sendCommand(this.target, method, params ?? {}, (result) => {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(`${method}_failed: ${err.message}`));
          return;
        }
        resolve(result as T);
      });
    });
  }

  /** Evaluate an expression in the current page context and return its value. */
  async evaluate<T>(expression: string, awaitPromise = false): Promise<T> {
    const res = await this.send<EvaluateResult>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
    });
    if (res.exceptionDetails) {
      const detail = res.exceptionDetails.exception?.description ?? res.exceptionDetails.text;
      throw new Error(`evaluate_failed: ${detail}`);
    }
    return res.result.value as T;
  }

  /** Navigate to a URL and resolve once the new document fires `load`. */
  async navigate(url: string): Promise<void> {
    const navPromise = this.waitForMainFrameLoad();
    await this.send('Page.navigate', { url });
    await navPromise;
  }

  /**
   * Run a setup snippet that defines a `form` variable, then submit it on the
   * next tick (deferred so the `Runtime.evaluate` response is not lost when the
   * navigation destroys the execution context), and resolve once the resulting
   * document loads. `HTMLFormElement.prototype.submit.call` avoids a form input
   * named `submit` shadowing the method.
   */
  async submitNavigate(setupExpression: string): Promise<void> {
    const navPromise = this.waitForMainFrameLoad();
    await this.evaluate(
      `(() => {\n${setupExpression}\nsetTimeout(() => HTMLFormElement.prototype.submit.call(form), 0);\nreturn true;\n})()`,
    );
    await navPromise;
  }

  private async waitForMainFrameLoad(timeoutMs = NAV_TIMEOUT_MS): Promise<void> {
    const tree = await this.send<FrameTreeResult>('Page.getFrameTree');
    const mainFrameId = tree.frameTree.frame.id;
    const oldLoaderId = tree.frameTree.frame.loaderId;

    return new Promise<void>((resolve, reject) => {
      let newLoaderId: string | null = null;
      const handler: CdpEventHandler = (method, params) => {
        if (method === 'Page.frameNavigated') {
          const frame = (params as { frame?: { id?: string; loaderId?: string } }).frame;
          if (frame?.id === mainFrameId && frame.loaderId && frame.loaderId !== oldLoaderId) {
            newLoaderId = frame.loaderId;
          }
        } else if (method === 'Page.lifecycleEvent') {
          const ev = params as { frameId?: string; loaderId?: string; name?: string };
          if (
            ev.frameId === mainFrameId &&
            ev.name === 'load' &&
            newLoaderId !== null &&
            ev.loaderId === newLoaderId
          ) {
            cleanup();
            resolve();
          }
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('navigation_timeout'));
      }, timeoutMs);
      const cleanup = (): void => {
        clearTimeout(timer);
        this.handlers.delete(handler);
      };
      this.handlers.add(handler);
    });
  }

  /** Pin a deterministic CSS viewport width so screenshot layout is stable. */
  async setViewportWidth(width: number): Promise<void> {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  async getContentSize(): Promise<{ width: number; height: number }> {
    const metrics = await this.send<LayoutMetricsResult>('Page.getLayoutMetrics');
    return { width: metrics.cssContentSize.width, height: metrics.cssContentSize.height };
  }

  /** Emit the current page as an A4 PDF (base64). `printBackground:true` keeps the hipass watermark. */
  async printToPdf(): Promise<string> {
    const res = await this.send<PrintOrShotResult>('Page.printToPDF', {
      printBackground: true,
      paperWidth: 8.27,
      paperHeight: 11.69,
      marginTop: 0.4,
      marginBottom: 0.4,
      marginLeft: 0.4,
      marginRight: 0.4,
    });
    return res.data;
  }

  /** Capture the full content area as a PNG (base64). */
  async captureScreenshot(width: number, height: number): Promise<string> {
    const res = await this.send<PrintOrShotResult>('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.ceil(width), height: Math.ceil(height), scale: 1 },
    });
    return res.data;
  }
}
