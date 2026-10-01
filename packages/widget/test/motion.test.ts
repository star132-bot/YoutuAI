import { describe, expect, it } from 'vitest';
import { EMOTIONS, MOTIONS } from '@huinuo/shared';
import { applyEase, sampleKeys } from '../src/motion/ease';
import { EXPRESSIONS } from '../src/motion/expressions';
import { toMotion3Json } from '../src/motion/export';
import { MOTION_LIBRARY } from '../src/motion/library';
import { blend, MotionPlayer } from '../src/motion/player';
import { HARU_PROFILE, STANDARD_PROFILE } from '../src/motion/profiles';
import { LOGICAL_PARAMS, type Key } from '../src/motion/types';

const PARAMS = new Set<string>(LOGICAL_PARAMS);

describe('motion library', () => {
  it('has a definition for every motion in the vocabulary', () => {
    expect(Object.keys(MOTION_LIBRARY).sort()).toEqual([...MOTIONS].sort());
    expect(MOTIONS.length).toBeGreaterThanOrEqual(30);
  });

  it('has an expression for every emotion', () => {
    expect(Object.keys(EXPRESSIONS).sort()).toEqual([...EMOTIONS].sort());
  });

  for (const [name, def] of Object.entries(MOTION_LIBRARY)) {
    it(`${name}: keys are ordered, in range and target known params`, () => {
      const tracks = { ...def.params, ...def.transform } as Record<string, readonly Key[]>;
      expect(Object.keys(tracks).length).toBeGreaterThan(0);
      for (const p of Object.keys(def.params ?? {})) expect(PARAMS.has(p), p).toBe(true);
      for (const [track, keys] of Object.entries(tracks)) {
        for (let i = 1; i < keys.length; i++) expect(keys[i][0], `${track}[${i}]`).toBeGreaterThanOrEqual(keys[i - 1][0]);
        expect(keys[keys.length - 1][0], track).toBeLessThanOrEqual(def.duration + 1e-9);
        if (def.loop) expect(keys[0][1], `${track} loops seamlessly`).toBeCloseTo(keys[keys.length - 1][1], 5);
      }
    });
  }
});

describe('easing', () => {
  it('starts at 0 and ends at 1', () => {
    for (const e of ['linear', 'in', 'out', 'inOut', 'back', 'anticipate'] as const) {
      expect(applyEase(e, 0)).toBeCloseTo(0);
      expect(applyEase(e, 1)).toBeCloseTo(1);
    }
    expect(applyEase('back', 0.8)).toBeGreaterThan(1);
  });

  it('samples keyframes', () => {
    const keys: Key[] = [[0, 0], [1, 10, 'linear'], [2, 10]];
    expect(sampleKeys(keys, -1)).toBe(0);
    expect(sampleKeys(keys, 0.5)).toBeCloseTo(5);
    expect(sampleKeys(keys, 5)).toBe(10);
  });
});

/** 按 Cubism 规则求 bezier 段在时间 t 的值（控制点时间固定在 1/3、2/3，时间与参数 u 线性对应） */
function evalMotion3(segments: number[], t: number): number {
  let [pt, pv] = [segments[0], segments[1]];
  let i = 2;
  while (i < segments.length) {
    const type = segments[i];
    if (type === 1) {
      const [, , c1, , c2, t1, v1] = segments.slice(i, i + 7);
      if (t <= t1) {
        const u = (t - pt) / (t1 - pt);
        const m = 1 - u;
        return m * m * m * pv + 3 * m * m * u * c1 + 3 * m * u * u * c2 + u * u * u * v1;
      }
      [pt, pv] = [t1, v1];
      i += 7;
    } else {
      const [t1, v1] = [segments[i + 1], segments[i + 2]];
      if (t <= t1) return type === 0 ? pv + ((v1 - pv) * (t - pt)) / (t1 - pt) : pv;
      [pt, pv] = [t1, v1];
      i += 3;
    }
  }
  return pv;
}

describe('motion3.json export', () => {
  it('produces curves identical to in-browser playback', () => {
    const def = MOTION_LIBRARY.point_right;
    const json = toMotion3Json(def, HARU_PROFILE);
    // Haru：armR → ParamArmRB，实际值 = 逻辑值 × 3 + 2
    const curve = json.Curves.find((c) => c.Id === 'ParamArmRB')!;
    for (let t = 0; t <= def.duration; t += 0.05) {
      expect(evalMotion3(curve.Segments, t)).toBeCloseTo(sampleKeys(def.params!.armR!, t) * 3 + 2, 2);
    }
  });

  it('fills Meta counts consistently', () => {
    for (const def of Object.values(MOTION_LIBRARY)) {
      const json = toMotion3Json(def, STANDARD_PROFILE);
      expect(json.Meta.CurveCount).toBe(json.Curves.length);
      let segs = 0;
      let points = 0;
      for (const c of json.Curves) {
        points += 1;
        for (let i = 2; i < c.Segments.length; ) {
          segs += 1;
          if (c.Segments[i] === 1) (points += 3), (i += 7);
          else (points += 1), (i += 3);
        }
      }
      expect(json.Meta.TotalSegmentCount).toBe(segs);
      expect(json.Meta.TotalPointCount).toBe(points);
    }
  });
});

describe('MotionPlayer', () => {
  it('resolves when a one-shot motion ends and returns to idle', async () => {
    const player = new MotionPlayer();
    let done = false;
    void player.play('nod').then(() => (done = true));
    for (let i = 0; i < 100; i++) player.update(1 / 60);
    await Promise.resolve();
    expect(done).toBe(true);
    expect(player.currentAction).toBeNull();
  });

  it('fades out a looping motion on stopAction', () => {
    const player = new MotionPlayer();
    void player.play('think');
    for (let i = 0; i < 30; i++) player.update(1 / 60);
    expect(player.currentAction).toBe('think');
    player.stopAction();
    for (let i = 0; i < 30; i++) player.update(1 / 60);
    expect(player.currentAction).toBeNull();
  });

  it('applies the motion emotion while playing', () => {
    const player = new MotionPlayer();
    player.setEmotion('neutral');
    void player.play('angry_puff');
    expect(player.emotion).toBe('angry');
  });

  it('opens the mouth while speaking', () => {
    const player = new MotionPlayer();
    player.setSpeaking(true);
    let maxOpen = 0;
    for (let i = 0; i < 120; i++) {
      const f = player.update(1 / 60);
      maxOpen = Math.max(maxOpen, blend(0, f.layers, 'mouthOpen'));
    }
    expect(maxOpen).toBeGreaterThan(0.4);
  });

  it('blends layers by weight', () => {
    expect(blend(0, [{ values: { angleX: 10 }, weights: { angleX: 0.5 } }], 'angleX')).toBe(5);
    expect(blend(3, [{ values: {}, weights: {} }], 'angleX')).toBe(3);
  });
});
