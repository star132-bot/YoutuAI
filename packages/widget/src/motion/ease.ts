import type { Ease, Key } from './types';

/** 每种缓动对应的贝塞尔中间控制值（归一化：起点 0、终点 1） */
export const EASE_CONTROLS: Record<Exclude<Ease, 'step'>, readonly [number, number]> = {
  linear: [1 / 3, 2 / 3],
  in: [0, 0], //           u³
  out: [1, 1], //          1-(1-u)³
  inOut: [0, 1], //        3u²-2u³
  back: [0, 1.5], //       冲过头再回来
  anticipate: [-0.5, 1], // 先往反方向蓄力
};

export function applyEase(ease: Ease, u: number): number {
  if (ease === 'step') return u < 1 ? 0 : 1;
  const [c1, c2] = EASE_CONTROLS[ease];
  const m = 1 - u;
  return 3 * m * m * u * c1 + 3 * m * u * u * c2 + u * u * u;
}

/** 在关键帧序列上取 t 秒时的值。 */
export function sampleKeys(keys: readonly Key[], t: number): number {
  if (keys.length === 0) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, ease = 'inOut'] = keys[i];
    if (t < t1) {
      const [t0, v0] = keys[i - 1];
      const u = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * applyEase(ease, u);
    }
  }
  return keys[keys.length - 1][1];
}

/** 动作的淡入淡出权重 0~1 */
export function envelope(t: number, duration: number, fadeIn: number, fadeOut: number, loop: boolean): number {
  const a = fadeIn > 0 ? Math.min(1, t / fadeIn) : 1;
  const b = loop || fadeOut <= 0 ? 1 : Math.min(1, Math.max(0, (duration - t) / fadeOut));
  return Math.max(0, Math.min(a, b));
}
