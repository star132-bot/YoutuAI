import * as PIXI from 'pixi.js';
import type { Emotion, MotionName } from '@huinuo/shared';
import { activeWeight, blend, MotionPlayer, type Frame } from '../motion/player';
import type { LogicalParam, ModelProfile } from '../motion/types';

// Live2D 官方 Cubism Core（按授权条款只能从官方地址加载，不能打包进来）
export const CUBISM_CORE_URL = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
  }
}

let coreLoading: Promise<void> | null = null;

export function loadCubismCore(url = CUBISM_CORE_URL): Promise<void> {
  if (window.Live2DCubismCore) return Promise.resolve();
  coreLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      coreLoading = null;
      reject(new Error(`无法加载 Live2D Cubism Core: ${url}`));
    };
    document.head.appendChild(s);
  });
  return coreLoading;
}

/** 这些参数会被眨眼 / 口型同步覆盖，必须在最后一步再写一次 */
const FACE_PARAMS: ReadonlySet<LogicalParam> = new Set(['eyeLOpen', 'eyeROpen', 'eyeLSmile', 'eyeRSmile', 'mouthOpen', 'mouthForm']);

interface Resolved {
  param: LogicalParam;
  index: number;
  scale: number;
  offset: number;
  parts?: { show: number[]; hide: number[] };
  /** 当前换部件的进度 0（默认部件）~ 1（替换部件），平滑过渡 */
  partMix: number;
}

interface CoreModel {
  getParameterIndex(id: string): number;
  getPartIndex(id: string): number;
  setPartOpacityByIndex(i: number, v: number): void;
  getParameterValueByIndex(i: number): number;
  setParameterValueByIndex(i: number, v: number): void;
}

type Live2DModelT = PIXI.Container & {
  internalModel: PIXI.utils.EventEmitter & { coreModel: CoreModel; width: number; height: number };
  anchor: PIXI.ObservablePoint;
  focus(x: number, y: number, instant?: boolean): void;
  hitTest(x: number, y: number): string[];
};

export interface CharacterOptions {
  modelUrl: string;
  profile: ModelProfile;
  coreUrl?: string;
  /** 减少整体位移类动作（尊重系统「减少动态效果」设置） */
  reducedMotion?: boolean;
}

/** 把 MotionPlayer 的输出画到一个真正的 Live2D 模型上。 */
export class Live2DCharacter {
  readonly player = new MotionPlayer();
  private app!: PIXI.Application;
  private model!: Live2DModelT;
  private resolved: Resolved[] = [];
  private saved = new Map<number, number>();
  private frame: Frame | null = null;
  private lastTime = performance.now();
  private base = { x: 0, y: 0, scale: 1, height: 1 };

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opts: CharacterOptions,
  ) {}

  static async create(canvas: HTMLCanvasElement, opts: CharacterOptions): Promise<Live2DCharacter> {
    const c = new Live2DCharacter(canvas, opts);
    await c.init();
    return c;
  }

  private async init(): Promise<void> {
    await loadCubismCore(this.opts.coreUrl);
    const { Live2DModel } = await import('pixi-live2d-display/cubism4');
    Live2DModel.registerTicker(PIXI.Ticker);

    const rect = this.canvas.getBoundingClientRect();
    this.app = new PIXI.Application({
      view: this.canvas,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    this.model = (await Live2DModel.from(this.opts.modelUrl, { autoInteract: false })) as unknown as Live2DModelT;
    this.app.stage.addChild(this.model);

    const core = this.model.internalModel.coreModel;
    for (const [param, mapping] of Object.entries(this.opts.profile.params)) {
      if (!mapping) continue;
      const index = mapping.ids.map((id) => core.getParameterIndex(id)).find((i) => i >= 0);
      if (index === undefined) continue;
      const partIdx = (ids: readonly string[]) => ids.map((id) => core.getPartIndex(id)).filter((i) => i >= 0);
      this.resolved.push({
        param: param as LogicalParam,
        index,
        scale: mapping.scale ?? 1,
        offset: mapping.offset ?? 0,
        parts: mapping.parts && { show: partIdx(mapping.parts.show), hide: partIdx(mapping.parts.hide) },
        partMix: 0,
      });
    }

    const im = this.model.internalModel;
    im.on('beforeMotionUpdate', () => this.restore());
    im.on('afterMotionUpdate', () => this.applyBody());
    im.on('beforeModelUpdate', () => this.applyFace());
    this.app.ticker.add(() => this.applyTransform());

    this.layout();
    this.player.setAmbient('idle_breathe');
  }

  /** 支持的逻辑参数（调试用） */
  get supportedParams(): LogicalParam[] {
    return this.resolved.map((r) => r.param);
  }

  private restore(): void {
    const core = this.model.internalModel.coreModel;
    for (const [i, v] of this.saved) core.setParameterValueByIndex(i, v);
    this.saved.clear();
  }

  private applyBody(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.frame = this.player.update(dt);
    const core = this.model.internalModel.coreModel;
    for (const r of this.resolved) {
      if (FACE_PARAMS.has(r.param)) continue;
      if (r.parts) {
        // 换部件的参数：没被动作使用时保持默认部件，也不改参数（部件透明度在 applyFace 里最后写）
        const on = activeWeight(this.frame.layers, r.param) > 0.3;
        r.partMix += ((on ? 1 : 0) - r.partMix) * Math.min(1, dt * 14);
        if (!on && r.partMix < 0.5) continue;
      }
      const cur = core.getParameterValueByIndex(r.index);
      const next = this.blendScaled(cur, r);
      if (next === cur) continue;
      this.saved.set(r.index, cur);
      core.setParameterValueByIndex(r.index, next);
    }
  }

  private applyFace(): void {
    const core = this.model.internalModel.coreModel;
    for (const r of this.resolved) {
      if (r.parts) {
        // 在模型自带的 pose 处理之后写，避免两套手臂叠在一起出现残影
        const mix = r.partMix < 0.02 ? 0 : r.partMix > 0.98 ? 1 : r.partMix;
        for (const i of r.parts.show) core.setPartOpacityByIndex(i, mix);
        for (const i of r.parts.hide) core.setPartOpacityByIndex(i, 1 - mix);
      }
    }
    for (const r of this.resolved) {
      if (!FACE_PARAMS.has(r.param)) continue;
      const cur = core.getParameterValueByIndex(r.index);
      core.setParameterValueByIndex(r.index, this.blendScaled(cur, r));
    }
  }

  private blendScaled(cur: number, r: Resolved): number {
    if (!this.frame) return cur;
    return blend((cur - r.offset) / r.scale, this.frame.layers, r.param) * r.scale + r.offset;
  }

  private applyTransform(): void {
    const t = this.frame?.transform;
    const m = this.opts.reducedMotion ? 0.2 : 1;
    const x = (t?.x ?? 0) * m;
    const y = (t?.y ?? 0) * m;
    this.model.position.set(this.base.x + x * this.base.height, this.base.y + y * this.base.height);
    this.model.rotation = (t?.rotation ?? 0) * m;
    this.model.scale.set(this.base.scale * (1 + (t?.scaleX ?? 0)), this.base.scale * (1 + (t?.scaleY ?? 0) * m));
  }

  /** 画布尺寸变化后调用：把模型缩放并放到底部居中 */
  layout(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.app.renderer.resize(w, h);
    const { width: mw, height: mh } = this.model.internalModel;
    const zoom = this.opts.profile.framing?.zoom ?? 1;
    const offsetY = this.opts.profile.framing?.offsetY ?? 0;
    const scale = Math.min((h * 0.98) / mh, (w * 0.98) / mw) * zoom;
    this.model.anchor.set(0.5, 0.5);
    this.base = { x: w / 2, y: h - (mh * scale) / 2 + offsetY * mh * scale, scale, height: mh * scale };
    this.applyTransform();
  }

  play(motion: MotionName): Promise<void> {
    return this.player.play(motion);
  }

  stopAction(): void {
    this.player.stopAction();
  }

  setEmotion(emotion: Emotion): void {
    this.player.setEmotion(emotion);
  }

  setSpeaking(on: boolean): void {
    this.player.setSpeaking(on);
  }

  setAmbient(motion: MotionName | null): void {
    this.player.setAmbient(motion);
  }

  /** 视线看向页面上的某一点（clientX / clientY） */
  lookAt(clientX: number, clientY: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.model.focus(clientX - r.left, clientY - r.top);
  }

  lookForward(): void {
    const r = this.canvas.getBoundingClientRect();
    this.model.focus(r.width / 2, r.height * 0.3);
  }

  /** 点到了哪里：头 / 身体 / 没点到 */
  hitTest(clientX: number, clientY: number): 'head' | 'body' | null {
    const r = this.canvas.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    const hits = this.model.hitTest(x, y).map((s) => s.toLowerCase());
    if (hits.some((h) => h.includes('head') || h.includes('face'))) return 'head';
    if (hits.length) return 'body';
    const b = this.model.getBounds();
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) return null;
    return y < b.top + b.height * 0.3 ? 'head' : 'body';
  }

  /** 模型在页面上的包围盒（用于教程计算指向方向） */
  getClientBounds(): DOMRect {
    const r = this.canvas.getBoundingClientRect();
    const b = this.model.getBounds();
    return new DOMRect(r.left + b.x, r.top + b.y, b.width, b.height);
  }

  destroy(): void {
    this.app.destroy(false, { children: true });
  }
}
