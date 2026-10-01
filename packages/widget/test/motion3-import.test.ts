import { describe, expect, it } from 'vitest';
import { sampleKeys } from '../src/motion/ease';
import { toMotion3Json } from '../src/motion/export';
import { MOTION_LIBRARY } from '../src/motion/library';
import { fromMotion3Json } from '../src/motion/motion3-import';
import { STANDARD_PROFILE } from '../src/motion/profiles';

describe('fromMotion3Json', () => {
  it('round-trips exported motions', () => {
    for (const name of ['nod', 'think_tilt', 'mischief_wink', 'idle_sway'] as const) {
      const def = MOTION_LIBRARY[name];
      const { def: back, skipped } = fromMotion3Json(toMotion3Json(def, STANDARD_PROFILE), STANDARD_PROFILE);
      expect(skipped).toEqual([]);
      expect(back.loop).toBe(!!def.loop);
      for (const [p, keys] of Object.entries(def.params ?? {})) {
        for (let t = 0; t <= def.duration; t += 0.07) {
          expect(sampleKeys(back.params![p as keyof typeof back.params]!, t), `${name}.${p}@${t.toFixed(2)}`).toBeCloseTo(sampleKeys(keys!, t), 0);
        }
      }
    }
  });

  it('reports curves the model does not have', () => {
    const json = toMotion3Json(MOTION_LIBRARY.nod, STANDARD_PROFILE);
    json.Curves.push({ Target: 'Parameter', Id: 'ParamSomethingElse', Segments: [0, 0, 0, 1, 1] });
    expect(fromMotion3Json(json, STANDARD_PROFILE).skipped).toEqual(['ParamSomethingElse']);
  });
});
