import { type AssistantReply, type Decision, type Emotion, type HuinuoEvent, type MotionName, type Tutorial } from '@huinuo/shared';
import { getSessionId, HuinuoApi } from './api';
import { BehaviorTracker } from './behavior';
import { Live2DCharacter } from './live2d/character';
import { MOTION_LIBRARY } from './motion/library';
import { PROFILES } from './motion/profiles';
import { TutorialRunner } from './tutorial';
import { STYLES } from './ui/styles';

const DEFAULT_MODEL = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json';
const SLEEP_AFTER_SECONDS = 180;

const HEAD_LINES = ['嘿嘿，摸头好舒服～', '吱？找我有事吗？', '再摸一下下也可以哦…'];
const BODY_LINES = ['呀！别、别戳啦！', '好痒好痒！', '干嘛啦～'];

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TEMPLATE = `
<div class="root">
  <div class="stage">
    <div class="bubble" role="status" aria-live="polite">
      <p class="text"></p>
      <div class="bubble-actions" hidden>
        <button type="button" class="ghost skip">跳过教程</button>
        <button type="button" class="next">下一步</button>
      </div>
    </div>
    <canvas aria-label="灰糯（可拖动，点击戳戳她）"></canvas>
    <div class="loading">灰糯加载中…</div>
    <div class="toolbar">
      <button type="button" class="btn-chat" aria-label="和灰糯聊天" title="聊天">💬</button>
      <button type="button" class="btn-min" aria-label="让灰糯躲起来" title="最小化">－</button>
    </div>
  </div>
  <section class="panel" hidden aria-label="和灰糯聊天">
    <header>灰糯 <span class="provider"></span><button type="button" class="close" aria-label="关闭聊天">×</button></header>
    <div class="log" role="log" aria-live="polite"></div>
    <div class="quick">
      <button type="button">我是新手</button>
      <button type="button">这个页面怎么用？</button>
      <button type="button">随便聊聊</button>
    </div>
    <form>
      <input name="q" maxlength="500" autocomplete="off" placeholder="和灰糯说点什么…" aria-label="消息" />
      <button type="submit">发送</button>
    </form>
  </section>
  <button type="button" class="mini" hidden aria-label="叫出灰糯">🐭</button>
</div>`;

/**
 * <huinuo-assistant> —— 灰糯网页组件。
 *
 * 属性：
 * - api      后端地址，默认 /api
 * - model    Live2D 模型 .model3.json 地址
 * - profile  参数映射档案：standard（灰糯原创模型）/ haru（示例模型）
 * - mode     widget（网页右下角助手）/ live（直播 OBS 画面）
 */
export class HuinuoAssistant extends HTMLElement {
  private readonly shadow: ShadowRoot;
  private character: Live2DCharacter | null = null;
  private api!: HuinuoApi;
  private tracker: BehaviorTracker | null = null;
  private readonly tutorials = new TutorialRunner();
  private sayToken = 0;
  private nextResolver: (() => void) | null = null;
  private sleeping = false;
  private busy = false;
  private pokes: number[] = [];
  private lookRaf = 0;
  private readonly cleanups: Array<() => void> = [];

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  private $<T extends Element>(sel: string): T {
    return this.shadow.querySelector(sel) as T;
  }

  get mode(): 'widget' | 'live' {
    return this.getAttribute('mode') === 'live' ? 'live' : 'widget';
  }

  private get page(): string {
    return location.pathname;
  }

  async connectedCallback(): Promise<void> {
    if (!this.hasAttribute('mode')) this.setAttribute('mode', 'widget');
    this.shadow.innerHTML = `<style>${STYLES}</style>${TEMPLATE}`;
    this.api = new HuinuoApi(this.getAttribute('api') ?? '/api', getSessionId());
    this.restorePosition();
    this.bindUi();

    const profile = PROFILES[this.getAttribute('profile') ?? 'haru'] ?? PROFILES.haru;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      this.character = await Live2DCharacter.create(this.$('canvas'), {
        modelUrl: this.getAttribute('model') ?? DEFAULT_MODEL,
        profile,
        coreUrl: this.getAttribute('core-url') ?? undefined,
        reducedMotion,
      });
    } catch (err) {
      this.$('.loading').textContent = '灰糯没能加载出来…';
      console.error('[huinuo]', err);
      return;
    }
    this.$('.loading').remove();
    this.bindCharacter();
    this.dispatchEvent(new CustomEvent('huinuo-ready', { bubbles: true, composed: true }));

    if (this.mode === 'widget') {
      this.startTracking();
      if (this.firstVisitThisSession()) void this.emit({ source: 'web', type: 'page_view', page: this.page, title: document.title });
      else void this.play('greet_hop');
    }
  }

  disconnectedCallback(): void {
    this.tracker?.stop();
    this.tutorials.cancel();
    for (const c of this.cleanups.splice(0)) c();
    this.character?.destroy();
    this.character = null;
  }

  // ─────────────── 公开 API ───────────────

  /** 播放一个动作 */
  play(motion: MotionName): Promise<void> {
    return this.character?.play(motion) ?? Promise.resolve();
  }

  /** 让灰糯说一句话（带动作和表情） */
  async say(text: string, motion: MotionName = 'talk', opts: { emotion?: Emotion; hold?: boolean } = {}): Promise<void> {
    const c = this.character;
    if (!c) return;
    const token = ++this.sayToken;
    const bubble = this.$<HTMLDivElement>('.bubble');
    const p = this.$<HTMLParagraphElement>('.bubble .text');
    this.$<HTMLDivElement>('.bubble-actions').hidden = !this.tutorials.running;
    this.$<HTMLButtonElement>('.bubble .next').hidden = true;
    bubble.classList.add('show');
    p.textContent = '';
    c.setEmotion(opts.emotion ?? 'smile');
    const isLoop = !!MOTION_LIBRARY[motion].loop;
    void c.play(motion);
    c.setSpeaking(true);
    for (const ch of text) {
      if (token !== this.sayToken) return;
      p.textContent += ch;
      this.keepBubbleOnScreen();
      await sleep(/[，。！？,.!?…～]/.test(ch) ? 140 : 45);
    }
    c.setSpeaking(false);
    if (isLoop) c.stopAction();
    if (opts.hold) return;
    await sleep(2200 + text.length * 70);
    if (token !== this.sayToken) return;
    bubble.classList.remove('show');
    c.setEmotion('neutral');
  }

  /** 执行一条结构化回复（来自 AI 或 jev） */
  async perform(reply: AssistantReply): Promise<void> {
    if (reply.tutorial) {
      const tut = (await this.api.tutorials(this.page)).find((t) => t.id === reply.tutorial);
      if (tut) {
        await this.say(reply.text, reply.motion, { emotion: reply.emotion, hold: true });
        await sleep(600);
        await this.runTutorial(tut);
        return;
      }
    }
    if (reply.highlight && document.querySelector(reply.highlight)) {
      await this.runTutorial(
        { id: 'adhoc', title: '', steps: [{ target: reply.highlight, say: reply.text, motion: reply.motion, waitFor: 'next' }] },
        false,
      );
      return;
    }
    await this.say(reply.text, reply.motion, { emotion: reply.emotion });
  }

  /** 把一个事件交给后端 jev 判断，并执行判断结果 */
  async emit(event: HuinuoEvent): Promise<Decision> {
    const decision = await this.api.event(event);
    if (this.busy && decision.action !== 'ignore' && event.type !== 'superchat') return decision;
    if (decision.action === 'motion') void this.play(decision.motion);
    else if (decision.action === 'say' || decision.action === 'tutorial') void this.perform(decision.reply);
    return decision;
  }

  /** 发送一条聊天消息 */
  async chat(text: string): Promise<void> {
    const message = text.trim();
    if (!message || this.busy) return;
    this.busy = true;
    this.appendLog('user', message);
    const send = this.$<HTMLButtonElement>('form button');
    send.disabled = true;
    this.character?.setEmotion('confused');
    void this.play('think');
    let res;
    try {
      res = await this.api.chat(message, this.page);
    } finally {
      this.busy = false;
      send.disabled = false;
    }
    this.character?.stopAction();
    this.appendLog('bot', res.reply.text);
    this.$('.provider').textContent = res.degraded ? '离线' : res.provider ? `via ${res.provider}` : '';
    // 回复到了就可以继续输入；表演（说话 / 教程）在后台进行
    void this.perform(res.reply);
  }

  async startTutorial(id: string): Promise<void> {
    const tut = (await this.api.tutorials(this.page)).find((t) => t.id === id);
    if (tut) await this.runTutorial(tut);
  }

  // ─────────────── 内部 ───────────────

  private async runTutorial(tut: Tutorial, celebrate = true): Promise<void> {
    this.$('.toolbar').classList.add('pinned');
    await this.tutorials.run(tut, {
      say: (text, motion, opts) => this.say(text, motion, opts),
      characterBounds: () => this.character?.getClientBounds() ?? this.getBoundingClientRect(),
      waitForNext: () =>
        new Promise<void>((resolve) => {
          const next = this.$<HTMLButtonElement>('.bubble .next');
          this.$<HTMLDivElement>('.bubble-actions').hidden = false;
          this.$<HTMLButtonElement>('.bubble .skip').hidden = !celebrate;
          next.textContent = celebrate ? '下一步' : '知道啦';
          next.hidden = false;
          this.keepBubbleOnScreen();
          next.focus();
          this.nextResolver = resolve;
        }),
      onFinish: () => {
        this.$('.toolbar').classList.remove('pinned');
        this.$<HTMLDivElement>('.bubble-actions').hidden = true;
        this.nextResolver?.();
        this.nextResolver = null;
        if (!celebrate) this.$('.bubble').classList.remove('show');
      },
    }, { celebrate });
  }

  /** 气泡超出屏幕时横向平移回来（小尾巴仍然指向灰糯） */
  private keepBubbleOnScreen(): void {
    const bubble = this.$<HTMLDivElement>('.bubble');
    bubble.style.setProperty('--hn-shift', '0px');
    const r = bubble.getBoundingClientRect();
    const margin = 8;
    let shift = 0;
    if (r.right > window.innerWidth - margin) shift = window.innerWidth - margin - r.right;
    if (r.left + shift < margin) shift = margin - r.left;
    bubble.style.setProperty('--hn-shift', `${Math.round(shift)}px`);
  }

  private appendLog(who: 'user' | 'bot', text: string): void {
    const log = this.$<HTMLDivElement>('.log');
    const el = document.createElement('div');
    el.className = `msg ${who}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  private firstVisitThisSession(): boolean {
    try {
      if (sessionStorage.getItem('huinuo:greeted')) return false;
      sessionStorage.setItem('huinuo:greeted', '1');
    } catch {
      /* 隐私模式等情况下 storage 不可用，照常打招呼 */
    }
    return true;
  }

  private restorePosition(): void {
    if (this.mode !== 'widget') return;
    try {
      const pos = JSON.parse(localStorage.getItem('huinuo:pos') ?? 'null') as { right: number; bottom: number } | null;
      if (pos) this.place(pos.right, pos.bottom);
    } catch {
      /* ignore */
    }
  }

  private place(right: number, bottom: number): void {
    const w = this.offsetWidth || 240;
    const h = this.offsetHeight || 320;
    const r = Math.min(Math.max(0, right), window.innerWidth - w);
    const b = Math.min(Math.max(0, bottom), window.innerHeight - h);
    this.style.right = `${r}px`;
    this.style.bottom = `${b}px`;
  }

  private bindUi(): void {
    const panel = this.$<HTMLElement>('.panel');
    const input = this.$<HTMLInputElement>('.panel input');
    this.$('.btn-chat').addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) input.focus();
    });
    this.$('.panel .close').addEventListener('click', () => (panel.hidden = true));
    this.$('.panel form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value;
      input.value = '';
      void this.chat(v);
    });
    for (const b of this.shadow.querySelectorAll<HTMLButtonElement>('.quick button')) {
      b.addEventListener('click', () => void this.chat(b.textContent ?? ''));
    }
    this.$('.bubble .next').addEventListener('click', () => {
      this.$<HTMLButtonElement>('.bubble .next').hidden = true;
      const r = this.nextResolver;
      this.nextResolver = null;
      r?.();
    });
    this.$('.bubble .skip').addEventListener('click', () => {
      this.tutorials.cancel();
      void this.say('好～需要的时候再叫我！', 'nod');
    });
    this.$('.btn-min').addEventListener('click', async () => {
      panel.hidden = true;
      await this.say('我先躲起来啦～', 'bye_wave');
      this.$<HTMLElement>('.stage').hidden = true;
      this.$<HTMLButtonElement>('.mini').hidden = false;
    });
    this.$('.mini').addEventListener('click', () => {
      this.$<HTMLButtonElement>('.mini').hidden = true;
      this.$<HTMLElement>('.stage').hidden = false;
      this.character?.layout();
      void this.say('我回来啦！', 'greet_hop');
    });
  }

  private bindCharacter(): void {
    const c = this.character!;
    const canvas = this.$<HTMLCanvasElement>('canvas');

    // 视线跟随鼠标
    const onMove = (e: PointerEvent) => {
      if (this.sleeping) return;
      cancelAnimationFrame(this.lookRaf);
      this.lookRaf = requestAnimationFrame(() => c.lookAt(e.clientX, e.clientY));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    this.cleanups.push(() => window.removeEventListener('pointermove', onMove));

    // 拖动 / 戳戳
    let start: { x: number; y: number; right: number; bottom: number } | null = null;
    let dragging = false;
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      const cs = getComputedStyle(this);
      start = { x: e.clientX, y: e.clientY, right: parseFloat(cs.right) || 16, bottom: parseFloat(cs.bottom) || 16 };
      dragging = false;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!start || this.mode !== 'widget') return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) > 6) {
        dragging = true;
        canvas.classList.add('dragging');
        void c.play('drag_dangle');
      }
      if (dragging) this.place(start.right - dx, start.bottom - dy);
    });
    const end = (e: PointerEvent) => {
      if (!start) return;
      start = null;
      if (dragging) {
        dragging = false;
        canvas.classList.remove('dragging');
        c.stopAction();
        try {
          localStorage.setItem('huinuo:pos', JSON.stringify({ right: parseFloat(this.style.right), bottom: parseFloat(this.style.bottom) }));
        } catch {
          /* ignore */
        }
        return;
      }
      if (e.type === 'pointerup') this.poke(e.clientX, e.clientY);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    const onResize = () => c.layout();
    window.addEventListener('resize', onResize);
    this.cleanups.push(() => window.removeEventListener('resize', onResize));
  }

  private poke(x: number, y: number): void {
    if (this.tutorials.running) return;
    const where = this.character?.hitTest(x, y);
    if (!where) return;
    if (this.sleeping) {
      this.wake();
      return;
    }
    const now = Date.now();
    this.pokes = [...this.pokes.filter((t) => now - t < 3000), now];
    if (this.pokes.length >= 5) {
      this.pokes = [];
      void this.say('再戳我就要生气了！哼！', 'angry_stomp', { emotion: 'angry' });
    } else if (where === 'head') {
      void this.say(pick(HEAD_LINES), 'poke_head', { emotion: 'laugh' });
    } else {
      void this.say(pick(BODY_LINES), 'poke_body', { emotion: 'shy' });
    }
  }

  private wake(): void {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.character?.setAmbient('idle_breathe');
    void this.say('唔…我、我才没有睡着！', 'wake_up', { emotion: 'shy' });
  }

  private startTracking(): void {
    const panel = this;
    this.tracker = new BehaviorTracker(
      {
        onIdle: (seconds) => {
          if (seconds >= SLEEP_AFTER_SECONDS) {
            this.sleeping = true;
            this.character?.lookForward();
            this.character?.setEmotion('sleepy');
            this.character?.setAmbient('sleep_doze');
            this.$('.bubble').classList.remove('show');
            return;
          }
          if (!this.tutorials.running) void this.emit({ source: 'web', type: 'idle', page: this.page, seconds });
        },
        onActive: () => this.wake(),
        onError: (message) => void this.emit({ source: 'web', type: 'js_error', page: this.page, message }),
        onRageClick: (selector, count) => void this.emit({ source: 'web', type: 'rage_click', page: this.page, selector, count }),
      },
      [Number(this.getAttribute('idle-seconds') ?? 30), SLEEP_AFTER_SECONDS],
      (target) => target instanceof Node && (target === panel || panel.contains(target)),
    );
    this.tracker.start();
  }
}
