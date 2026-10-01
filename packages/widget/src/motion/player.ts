import type { Emotion, MotionName } from '@huinuo/shared';
import { envelope, sampleKeys } from './ease';
import { EXPRESSIONS } from './expressions';
import { MOTION_LIBRARY } from './library';
import type { LogicalParam, MotionDef, TransformChannel } from './types';

export interface Layer {
  values: Partial<Record<LogicalParam, number>>;
  /** 每个参数各自的权重（0~1） */
  weights: Partial<Record<LogicalParam, number>>;
}

export interface Frame {
  /** 由低到高依次叠加的层 */
  layers: Layer[];
  transform: Record<TransformChannel, number>;
}

interface Running {
  name: MotionName | 'custom';
  def: MotionDef;
  t: number;
  stopping: number | null;
  resolve?: () => void;
}

const ZERO_TRANSFORM = (): Record<TransformChannel, number> => ({ x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 0 });

/** 某个参数在所有层里的最大权重（判断它是否正被动作使用） */
export function activeWeight(layers: Layer[], param: LogicalParam): number {
  let w = 0;
  for (const l of layers) w = Math.max(w, l.weights[param] ?? 0);
  return w;
}

/** 按「上一层值 × (1-w) + 本层值 × w」把各层合成到基础值上。 */
export function blend(base: number, layers: Layer[], param: LogicalParam): number {
  let v = base;
  for (const l of layers) {
    const w = l.weights[param];
    const x = l.values[param];
    if (w === undefined || x === undefined || w <= 0) continue;
    v = v * (1 - w) + x * w;
  }
  return v;
}

/**
 * 灰糯的动作播放器（与渲染无关）：
 * 环境层（呼吸 / 摇摆）→ 情绪层 → 动作层 → 口型层。
 */
export class MotionPlayer {
  private ambient: Running | null = null;
  private action: Running | null = null;
  private baseEmotion: Emotion = 'neutral';
  private emotionValues: Partial<Record<LogicalParam, number>> = {};
  private emotionWeights: Partial<Record<LogicalParam, number>> = {};
  private speaking = false;
  private speakWeight = 0;
  private clock = 0;

  constructor(private readonly library: Record<MotionName, MotionDef> = MOTION_LIBRARY) {}

  get currentAction(): string | null {
    return this.action?.name ?? null;
  }

  get emotion(): Emotion {
    return this.action?.def.emotion ?? this.baseEmotion;
  }

  setAmbient(name: MotionName | null): void {
    this.ambient = name ? { name, def: this.library[name], t: 0, stopping: null } : null;
  }

  setEmotion(emotion: Emotion): void {
    this.baseEmotion = emotion;
  }

  setSpeaking(on: boolean): void {
    this.speaking = on;
  }

  /** 播放一个动作；返回的 Promise 在动作结束（或被打断）时完成。循环动作需调用 stopAction。 */
  play(name: MotionName): Promise<void> {
    return this.playDef(name, this.library[name]);
  }

  playDef(name: MotionName | 'custom', def: MotionDef): Promise<void> {
    this.action?.resolve?.();
    return new Promise((resolve) => {
      this.action = { name, def, t: 0, stopping: null, resolve };
    });
  }

  /** 让当前（循环）动作淡出 */
  stopAction(): void {
    if (this.action && this.action.stopping === null) this.action.stopping = this.action.t;
  }

  private sampleRunning(r: Running, out: Layer, transform: Record<TransformChannel, number>, scale = 1): void {
    const { def } = r;
    const t = def.loop ? r.t % def.duration : Math.min(r.t, def.duration);
    let w = envelope(r.t, def.duration, def.fadeIn ?? 0.2, def.fadeOut ?? 0.3, !!def.loop);
    if (r.stopping !== null) w *= Math.max(0, 1 - (r.t - r.stopping) / (def.fadeOut ?? 0.3));
    w *= scale;
    for (const [p, keys] of Object.entries(def.params ?? {})) {
      if (!keys) continue;
      out.values[p as LogicalParam] = sampleKeys(keys, t);
      out.weights[p as LogicalParam] = w;
    }
    for (const [c, keys] of Object.entries(def.transform ?? {})) {
      if (keys) transform[c as TransformChannel] += sampleKeys(keys, t) * w;
    }
  }

  private finished(r: Running): boolean {
    const fadeOut = r.def.fadeOut ?? 0.3;
    if (r.stopping !== null) return r.t - r.stopping >= fadeOut;
    return !r.def.loop && r.t >= r.def.duration;
  }

  update(dt: number): Frame {
    this.clock += dt;
    const transform = ZERO_TRANSFORM();
    const layers: Layer[] = [];

    if (this.ambient) {
      this.ambient.t += dt;
      const layer: Layer = { values: {}, weights: {} };
      // 做动作时把环境层压低，避免互相打架
      this.sampleRunning(this.ambient, layer, transform, this.action ? 0.3 : 1);
      layers.push(layer);
    }

    // 情绪层：平滑趋近目标表情
    const target = EXPRESSIONS[this.emotion];
    const k = 1 - Math.exp(-dt * 10);
    const params = new Set<LogicalParam>([
      ...(Object.keys(target) as LogicalParam[]),
      ...(Object.keys(this.emotionWeights) as LogicalParam[]),
    ]);
    const emotionLayer: Layer = { values: {}, weights: {} };
    for (const p of params) {
      const tv = target[p];
      const cw = this.emotionWeights[p] ?? 0;
      const nw = cw + ((tv === undefined ? 0 : 1) - cw) * k;
      if (tv !== undefined) {
        const cv = this.emotionValues[p] ?? tv;
        this.emotionValues[p] = cv + (tv - cv) * k;
      }
      if (nw < 0.001 && tv === undefined) {
        delete this.emotionWeights[p];
        delete this.emotionValues[p];
        continue;
      }
      this.emotionWeights[p] = nw;
      emotionLayer.values[p] = this.emotionValues[p];
      emotionLayer.weights[p] = nw;
    }
    layers.push(emotionLayer);

    if (this.action) {
      this.action.t += dt;
      const layer: Layer = { values: {}, weights: {} };
      this.sampleRunning(this.action, layer, transform);
      layers.push(layer);
      if (this.finished(this.action)) {
        const done = this.action;
        this.action = null;
        done.resolve?.();
      }
    }

    // 口型层：说话时嘴巴开合
    this.speakWeight += ((this.speaking ? 1 : 0) - this.speakWeight) * (1 - Math.exp(-dt * 15));
    if (this.speakWeight > 0.01) {
      const c = this.clock;
      const open = Math.max(0, 0.25 + 0.45 * Math.sin(c * 17) * Math.sin(c * 5.3 + 1) + 0.2 * Math.sin(c * 31));
      layers.push({ values: { mouthOpen: Math.min(1, open) }, weights: { mouthOpen: this.speakWeight } });
    }

    return { layers, transform };
  }
}
