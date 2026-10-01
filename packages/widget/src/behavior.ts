/**
 * 观察用户在页面上的行为，给 jev 判断层提供数据：
 * 长时间不操作、页面报错、对同一个元素疯狂点击。
 */
export interface BehaviorCallbacks {
  onIdle(seconds: number): void;
  onActive(): void;
  onError(message: string): void;
  onRageClick(selector: string, count: number): void;
}

function describe(el: Element): string {
  if (el.id) return `#${el.id}`;
  const cls = [...el.classList].slice(0, 2).join('.');
  return el.tagName.toLowerCase() + (cls ? `.${cls}` : '');
}

export class BehaviorTracker {
  private lastActive = Date.now();
  private idleReported = new Set<number>();
  private timer = 0;
  private clicks: { target: Element; times: number[] } | null = null;
  private lastErrorAt = 0;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly cb: BehaviorCallbacks,
    private readonly idleThresholds: number[],
    private readonly ignoreInside: (el: EventTarget | null) => boolean,
  ) {}

  start(): void {
    const active = (e: Event) => {
      if (this.ignoreInside(e.target)) return;
      const wasIdle = this.idleReported.size > 0;
      this.lastActive = Date.now();
      this.idleReported.clear();
      if (wasIdle) this.cb.onActive();
    };
    const click = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || this.ignoreInside(e.target)) return;
      const now = Date.now();
      if (this.clicks?.target !== e.target) this.clicks = { target: e.target, times: [] };
      this.clicks.times = [...this.clicks.times.filter((t) => now - t < 1200), now];
      if (this.clicks.times.length === 4) this.cb.onRageClick(describe(e.target), 4);
    };
    const error = (e: ErrorEvent) => {
      const now = Date.now();
      if (now - this.lastErrorAt < 10_000) return;
      this.lastErrorAt = now;
      this.cb.onError(String(e.message).slice(0, 200));
    };
    const opts = { passive: true, capture: true } as const;
    for (const type of ['pointermove', 'keydown', 'scroll', 'pointerdown'] as const) {
      window.addEventListener(type, active, opts);
      this.cleanups.push(() => window.removeEventListener(type, active, opts));
    }
    window.addEventListener('click', click, true);
    window.addEventListener('error', error);
    this.cleanups.push(
      () => window.removeEventListener('click', click, true),
      () => window.removeEventListener('error', error),
    );
    this.timer = window.setInterval(() => {
      const idle = (Date.now() - this.lastActive) / 1000;
      for (const t of this.idleThresholds) {
        if (idle >= t && !this.idleReported.has(t)) {
          this.idleReported.add(t);
          this.cb.onIdle(Math.floor(idle));
        }
      }
    }, 1000);
  }

  stop(): void {
    clearInterval(this.timer);
    for (const c of this.cleanups.splice(0)) c();
  }
}
