import type { Key, LogicalParam, MotionDef, ModelProfile } from './types';
import type { Motion3Json } from './export';

export interface ImportResult {
  def: MotionDef;
  /** 模型档案里没有对应逻辑参数的曲线 ID（被忽略） */
  skipped: string[];
}

/** 在 Cubism 曲线段上按时间采样（贝塞尔段先按控制点求 t 对应的参数 u，再求值） */
function sampleSegments(seg: number[], t: number): number {
  let [pt, pv] = [seg[0], seg[1]];
  let i = 2;
  while (i < seg.length) {
    const type = seg[i];
    if (type === 1) {
      const [t1, v1, t2, v2, t3, v3] = seg.slice(i + 1, i + 7);
      if (t <= t3) {
        // 二分法求 x(u) = t
        let lo = 0;
        let hi = 1;
        for (let k = 0; k < 24; k++) {
          const u = (lo + hi) / 2;
          const m = 1 - u;
          const x = m * m * m * pt + 3 * m * m * u * t1 + 3 * m * u * u * t2 + u * u * u * t3;
          if (x < t) lo = u;
          else hi = u;
        }
        const u = (lo + hi) / 2;
        const m = 1 - u;
        return m * m * m * pv + 3 * m * m * u * v1 + 3 * m * u * u * v2 + u * u * u * v3;
      }
      [pt, pv] = [t3, v3];
      i += 7;
    } else {
      const [t1, v1] = [seg[i + 1], seg[i + 2]];
      if (t <= t1) {
        if (type === 0) return t1 === pt ? v1 : pv + ((v1 - pv) * (t - pt)) / (t1 - pt);
        return type === 2 ? pv : v1; // 2 = stepped, 3 = inverse stepped
      }
      [pt, pv] = [t1, v1];
      i += 3;
    }
  }
  return pv;
}

/**
 * 把 Cubism 标准 .motion3.json 转成灰糯的动作定义，
 * 这样「新动作 = 丢一个 .motion3.json 文件进去」。
 */
export function fromMotion3Json(json: Motion3Json, profile: ModelProfile, fps = 30): ImportResult {
  const byId = new Map<string, { param: LogicalParam; scale: number; offset: number }>();
  for (const [param, m] of Object.entries(profile.params)) {
    if (!m) continue;
    for (const id of m.ids) byId.set(id, { param: param as LogicalParam, scale: m.scale ?? 1, offset: m.offset ?? 0 });
  }
  const duration = json.Meta.Duration;
  const params: Partial<Record<LogicalParam, Key[]>> = {};
  const skipped: string[] = [];
  const steps = Math.max(1, Math.round(duration * fps));
  for (const curve of json.Curves) {
    if (curve.Target !== 'Parameter') continue;
    const map = byId.get(curve.Id);
    if (!map) {
      skipped.push(curve.Id);
      continue;
    }
    const keys: Key[] = [];
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * duration;
      keys.push([t, (sampleSegments(curve.Segments, t) - map.offset) / map.scale, 'linear']);
    }
    params[map.param] = keys;
  }
  return {
    def: {
      duration,
      loop: json.Meta.Loop,
      fadeIn: json.Meta.FadeInTime ?? 0.2,
      fadeOut: json.Meta.FadeOutTime ?? 0.3,
      params,
    },
    skipped,
  };
}
