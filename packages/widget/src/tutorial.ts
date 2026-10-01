import type { MotionName, Tutorial, TutorialStep } from '@huinuo/shared';

export interface TutorialHost {
  say(text: string, motion: MotionName, opts?: { emotion?: 'smile' | 'sparkle' | 'confused'; hold?: boolean }): Promise<void>;
  /** 灰糯在页面上的位置，用来决定魔法棒往哪个方向指 */
  characterBounds(): DOMRect;
  /** 「下一步」按钮被点击时 resolve */
  waitForNext(): Promise<void>;
  onFinish(): void;
}

/** 从灰糯指向目标元素，该用哪个指引动作 */
export function pointDirection(from: DOMRect, to: DOMRect): MotionName {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height * 0.35);
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'point_left' : 'point_right';
  return dy < 0 ? 'point_up' : 'point_down';
}

/** 页面上的高亮遮罩（放在宿主页面里，不挡住目标元素的点击） */
class Spotlight {
  private readonly el: HTMLDivElement;
  private target: Element | null = null;
  private raf = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.setAttribute('aria-hidden', 'true');
    Object.assign(this.el.style, {
      position: 'fixed',
      zIndex: '2147482000', // 低于灰糯组件，遮罩不会盖住她
      pointerEvents: 'none',
      borderRadius: '10px',
      boxShadow: '0 0 0 9999px rgba(20, 30, 40, 0.45), 0 0 0 3px #3E9EA3, 0 0 18px 6px rgba(62,158,163,0.7)',
      transition: 'all 0.3s ease',
      display: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.el);
  }

  show(target: Element): void {
    this.target = target;
    this.el.style.display = 'block';
    const track = () => {
      if (!this.target) return;
      const r = this.target.getBoundingClientRect();
      const pad = 6;
      Object.assign(this.el.style, {
        left: `${r.left - pad}px`,
        top: `${r.top - pad}px`,
        width: `${r.width + pad * 2}px`,
        height: `${r.height + pad * 2}px`,
      });
      this.raf = requestAnimationFrame(track);
    };
    cancelAnimationFrame(this.raf);
    track();
  }

  hide(): void {
    this.target = null;
    cancelAnimationFrame(this.raf);
    this.el.style.display = 'none';
  }

  destroy(): void {
    this.hide();
    this.el.remove();
  }
}

function waitForUser(el: Element, step: TutorialStep, host: TutorialHost, signal: AbortSignal): Promise<void> {
  if (step.waitFor === 'next' || !step.waitFor) {
    return Promise.race([
      host.waitForNext(),
      new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true })),
    ]);
  }
  const type = step.waitFor === 'input' ? 'input' : 'click';
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener(type, done);
      resolve();
    };
    el.addEventListener(type, done);
    signal.addEventListener('abort', done, { once: true });
  });
}

/** 一步一步执行教程脚本 */
export class TutorialRunner {
  private abort: AbortController | null = null;

  get running(): boolean {
    return this.abort !== null;
  }

  cancel(): void {
    this.abort?.abort();
  }

  async run(tutorial: Tutorial, host: TutorialHost, opts: { celebrate?: boolean } = {}): Promise<'done' | 'cancelled' | 'missing'> {
    this.cancel();
    const abort = new AbortController();
    this.abort = abort;
    const spot = new Spotlight();
    try {
      for (const step of tutorial.steps) {
        if (abort.signal.aborted) return 'cancelled';
        const el = document.querySelector(step.target);
        if (!el) {
          await host.say('诶？我找不到要指的那个按钮了…是不是页面变了？', 'think_tilt', { emotion: 'confused' });
          return 'missing';
        }
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        await new Promise((r) => setTimeout(r, 350));
        spot.show(el);
        const motion =
          !step.motion || step.motion.startsWith('point_')
            ? pointDirection(host.characterBounds(), el.getBoundingClientRect())
            : step.motion;
        void host.say(step.say, motion, { hold: true });
        await waitForUser(el, step, host, abort.signal);
        spot.hide();
      }
      if (abort.signal.aborted) return 'cancelled';
      if (opts.celebrate !== false) await host.say('全部完成！你超棒的～叮叮！', 'happy_cheer', { emotion: 'sparkle' });
      return 'done';
    } finally {
      spot.destroy();
      if (this.abort === abort) this.abort = null;
      host.onFinish();
    }
  }
}
