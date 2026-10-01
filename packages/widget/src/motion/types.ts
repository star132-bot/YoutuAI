import type { Emotion } from '@huinuo/shared';

/**
 * 逻辑参数：与具体模型无关的「部位」名。
 * 每个模型通过 ModelProfile 把它们映射到自己的 Live2D 参数 ID。
 *
 * 取值约定（逻辑值）：
 * - angle*: -30 ~ 30（度）      body*: -10 ~ 10
 * - eye*Open: 0 闭 ~ 1 正常 ~ 1.4 瞪大   eye*Smile / cheek / tear / mouthOpen: 0 ~ 1
 * - eyeBall*, brow*, mouthForm: -1 ~ 1
 * - arm* / forearm* / hand*: 0 ~ 1（由模型档案换算成实际范围）
 */
export const LOGICAL_PARAMS = [
  'angleX', 'angleY', 'angleZ',
  'bodyX', 'bodyY', 'bodyZ',
  'eyeLOpen', 'eyeROpen', 'eyeLSmile', 'eyeRSmile',
  'eyeBallX', 'eyeBallY',
  'browLY', 'browRY', 'browLAngle', 'browRAngle', 'browLForm', 'browRForm',
  'mouthForm', 'mouthOpen',
  'cheek', 'tear',
  'armL', 'armR', 'forearmL', 'forearmR', 'handL', 'handR',
] as const;
export type LogicalParam = (typeof LOGICAL_PARAMS)[number];

/** 整个角色的位移 / 旋转 / 缩放（与绑定无关，任何模型都能用） */
export type TransformChannel = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY';

/**
 * 缓动 = 三次贝塞尔的两个中间控制值（时间轴固定在 1/3、2/3）。
 * 这样网页播放和导出的 .motion3.json 曲线完全一致。
 */
export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'back' | 'anticipate' | 'step';

/** 关键帧：[秒, 值, 进入这一帧所用的缓动] */
export type Key = readonly [time: number, value: number, ease?: Ease];

export interface MotionDef {
  duration: number;
  loop?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  /** 播放期间叠加的表情 */
  emotion?: Emotion;
  params?: Partial<Record<LogicalParam, readonly Key[]>>;
  /** x / y：以模型高度为单位的偏移；rotation：弧度；scaleX / scaleY：缩放增量（0 = 不变） */
  transform?: Partial<Record<TransformChannel, readonly Key[]>>;
}

export interface ParamMapping {
  /** 候选参数 ID，使用模型里第一个存在的 */
  ids: readonly string[];
  /** 实际值 = 逻辑值 × scale + offset */
  scale?: number;
  offset?: number;
  /**
   * 有的模型用「换一套手臂部件」来做抬手（如 Haru）：
   * 这个参数被动作使用时显示 show 部件、隐藏 hide 部件，否则反过来。
   */
  parts?: { show: readonly string[]; hide: readonly string[] };
}

export interface ModelProfile {
  name: string;
  params: Partial<Record<LogicalParam, ParamMapping>>;
  /** 画面取景：zoom 放大倍数，offsetY 以模型高度为单位向下平移（放大后看上半身用） */
  framing?: { zoom?: number; offsetY?: number };
}
