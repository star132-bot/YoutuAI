import { EASE_CONTROLS } from './ease';
import type { ModelProfile, MotionDef } from './types';

export interface Motion3Json {
  Version: 3;
  Meta: {
    Duration: number;
    Fps: number;
    Loop: boolean;
    AreBeziersRestricted: boolean;
    FadeInTime: number;
    FadeOutTime: number;
    CurveCount: number;
    TotalSegmentCount: number;
    TotalPointCount: number;
    UserDataCount: number;
    TotalUserDataSize: number;
  };
  Curves: Array<{ Target: 'Parameter'; Id: string; Segments: number[] }>;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * 把程序化动作导出成 Cubism 标准 .motion3.json，可导入 Cubism Editor 或任何 Live2D 播放器。
 * 注意：transform（整体位移 / 旋转 / 缩放）不属于模型参数，导出时会被略过。
 */
export function toMotion3Json(def: MotionDef, profile: ModelProfile): Motion3Json {
  const curves: Motion3Json['Curves'] = [];
  let segmentCount = 0;
  let pointCount = 0;

  for (const [param, keys] of Object.entries(def.params ?? {})) {
    const mapping = profile.params[param as keyof typeof profile.params];
    if (!mapping || !keys?.length) continue;
    const scale = mapping.scale ?? 1;
    const offset = mapping.offset ?? 0;
    const segs: number[] = [round(keys[0][0]), round(keys[0][1] * scale + offset)];
    pointCount += 1;
    for (let i = 1; i < keys.length; i++) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1, ease = 'inOut'] = keys[i];
      const a = v0 * scale + offset;
      const b = v1 * scale + offset;
      if (ease === 'linear') {
        segs.push(0, round(t1), round(b));
        pointCount += 1;
      } else if (ease === 'step') {
        segs.push(2, round(t1), round(b));
        pointCount += 1;
      } else {
        const [c1, c2] = EASE_CONTROLS[ease];
        const dt = t1 - t0;
        segs.push(1, round(t0 + dt / 3), round(a + (b - a) * c1), round(t0 + (2 * dt) / 3), round(a + (b - a) * c2), round(t1), round(b));
        pointCount += 3;
      }
      segmentCount += 1;
    }
    curves.push({ Target: 'Parameter', Id: mapping.ids[0], Segments: segs });
  }

  return {
    Version: 3,
    Meta: {
      Duration: def.duration,
      Fps: 30,
      Loop: !!def.loop,
      AreBeziersRestricted: true,
      FadeInTime: def.fadeIn ?? 0.2,
      FadeOutTime: def.fadeOut ?? 0.3,
      CurveCount: curves.length,
      TotalSegmentCount: segmentCount,
      TotalPointCount: pointCount,
      UserDataCount: 0,
      TotalUserDataSize: 0,
    },
    Curves: curves,
  };
}
