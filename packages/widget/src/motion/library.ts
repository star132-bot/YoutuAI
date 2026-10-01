import type { MotionName } from '@huinuo/shared';
import type { Ease, Key, MotionDef } from './types';

/** 来回摆动：从 start 秒开始，振幅 amp，每半周期 half 秒，共 times 次，最后回到 rest。 */
function wiggle(start: number, half: number, amp: number, times: number, rest = 0, ease: Ease = 'inOut'): Key[] {
  const keys: Key[] = [[start, rest]];
  for (let i = 0; i < times; i++) keys.push([start + half * (i + 1), i % 2 === 0 ? amp : -amp, ease]);
  keys.push([start + half * (times + 1), rest, ease]);
  return keys;
}

/** 闭眼 a~b 秒（含快速开合） */
function closedEyes(a: number, b: number, rest = 1): Key[] {
  return [[0, rest], [a, rest], [a + 0.12, 0, 'out'], [b, 0], [b + 0.15, rest, 'out']];
}

export const MOTION_LIBRARY: Record<MotionName, MotionDef> = {
  // ───────── 待机 ─────────
  idle_breathe: {
    duration: 4,
    loop: true,
    params: {
      bodyY: [[0, 0], [2, 2], [4, 0]],
      angleY: [[0, 0], [2, 2], [4, 0]],
    },
  },
  idle_sway: {
    duration: 4,
    loop: true,
    params: {
      angleZ: [[0, 0], [1, 6], [3, -6], [4, 0]],
      bodyZ: [[0, 0], [1, 3], [3, -3], [4, 0]],
    },
  },
  idle_look_around: {
    duration: 3.2,
    params: {
      eyeBallX: [[0, 0], [0.4, -0.8, 'out'], [1.2, -0.8], [1.6, 0.8, 'inOut'], [2.4, 0.8], [2.9, 0]],
      angleX: [[0, 0], [0.5, -15], [1.2, -15], [1.8, 15], [2.4, 15], [3.1, 0]],
    },
  },
  idle_yawn: {
    duration: 3,
    emotion: 'sleepy',
    params: {
      mouthOpen: [[0, 0], [0.6, 1, 'out'], [1.8, 1], [2.4, 0]],
      mouthForm: [[0, 0], [0.6, -0.4], [1.8, -0.4], [2.4, 0]],
      eyeLOpen: closedEyes(0.4, 2.1),
      eyeROpen: closedEyes(0.4, 2.1),
      angleY: [[0, 0], [0.6, 15], [1.8, 15], [2.5, 0]],
      tear: [[0, 0], [1.6, 0.6], [2.8, 0]],
      armR: [[0, 0], [0.6, 0.6], [1.8, 0.6], [2.4, 0]],
    },
  },

  // ───────── 问候 / 告别 ─────────
  greet_wave: {
    duration: 2.4,
    emotion: 'smile',
    params: {
      armR: [[0, 0], [0.35, 1, 'out'], [2.0, 1], [2.4, 0]],
      forearmR: wiggle(0.35, 0.22, 1, 6, 0.5),
      handR: wiggle(0.35, 0.22, 0.6, 6),
      angleZ: [[0, 0], [0.4, 8], [2.0, 8], [2.4, 0]],
      angleX: [[0, 0], [0.4, 5], [2.0, 5], [2.4, 0]],
    },
  },
  greet_hop: {
    duration: 1.4,
    emotion: 'laugh',
    transform: {
      y: [[0, 0], [0.15, 0.02, 'out'], [0.4, -0.08, 'out'], [0.6, 0, 'in'], [0.7, 0.015, 'out'], [0.85, 0]],
      scaleY: [[0, 0], [0.15, -0.05], [0.35, 0.04], [0.6, -0.03], [0.85, 0]],
    },
    params: {
      armL: [[0, 0], [0.3, 0.8, 'out'], [1.0, 0.8], [1.4, 0]],
      armR: [[0, 0], [0.3, 0.8, 'out'], [1.0, 0.8], [1.4, 0]],
    },
  },
  greet_bow: {
    duration: 2.2,
    emotion: 'smile',
    params: {
      angleY: [[0, 0], [0.6, -25, 'inOut'], [1.3, -25], [2.0, 0, 'out']],
      bodyY: [[0, 0], [0.6, -8], [1.3, -8], [2.0, 0]],
      eyeLOpen: closedEyes(0.5, 1.4),
      eyeROpen: closedEyes(0.5, 1.4),
    },
  },
  bye_wave: {
    duration: 2.6,
    emotion: 'smile',
    params: {
      armR: [[0, 0], [0.35, 1, 'out'], [2.1, 1], [2.6, 0]],
      forearmR: wiggle(0.35, 0.3, 1, 5, 0.5),
      angleZ: [[0, 0], [0.5, -8], [2.2, -8], [2.6, 0]],
    },
    transform: { scaleX: [[0, 0], [2.0, 0], [2.6, -0.04]], scaleY: [[0, 0], [2.0, 0], [2.6, -0.04]] },
  },

  // ───────── 说话 ─────────
  talk: {
    duration: 2.4,
    loop: true,
    params: {
      angleX: [[0, 0], [0.6, 4], [1.2, -3], [1.8, 2], [2.4, 0]],
      angleY: [[0, 0], [0.3, 3], [0.6, 0], [1.4, 3], [1.7, 0], [2.4, 0]],
      bodyX: [[0, 0], [1.2, 2], [2.4, 0]],
      browLY: [[0, 0], [0.3, 0.3], [0.8, 0], [1.4, 0.3], [1.9, 0], [2.4, 0]],
      browRY: [[0, 0], [0.3, 0.3], [0.8, 0], [1.4, 0.3], [1.9, 0], [2.4, 0]],
    },
  },
  talk_explain: {
    duration: 3,
    params: {
      armL: [[0, 0], [0.4, 0.6, 'out'], [2.5, 0.6], [3, 0]],
      forearmL: [[0, 0], [0.4, 0.7], [1.0, 0.3], [1.6, 0.7], [2.2, 0.3], [2.6, 0]],
      angleZ: [[0, 0], [0.5, -6], [1.5, 4], [2.5, -3], [3, 0]],
      angleX: [[0, 0], [0.5, -6], [2.5, -6], [3, 0]],
      browLY: [[0, 0], [0.4, 0.5], [2.6, 0.5], [3, 0]],
      browRY: [[0, 0], [0.4, 0.5], [2.6, 0.5], [3, 0]],
    },
  },

  // ───────── 思考 ─────────
  think: {
    duration: 3,
    loop: true,
    emotion: 'confused',
    params: {
      eyeBallY: [[0, 0.7], [3, 0.7]],
      eyeBallX: [[0, 0.5], [1.5, 0.3], [3, 0.5]],
      angleY: [[0, 10], [3, 10]],
      angleZ: [[0, 6], [1.5, 9], [3, 6]],
      armR: [[0, 0.5], [3, 0.5]],
      forearmR: [[0, 0.8], [3, 0.8]],
      mouthForm: [[0, -0.3], [3, -0.3]],
    },
  },
  think_tilt: {
    duration: 2,
    emotion: 'confused',
    params: {
      angleZ: [[0, 0], [0.4, -18, 'back'], [1.6, -18], [2, 0]],
      angleX: [[0, 0], [0.4, -8], [1.6, -8], [2, 0]],
      eyeBallY: [[0, 0], [0.4, 0.4], [1.6, 0.4], [2, 0]],
      browLY: [[0, 0], [0.3, 0.6], [1.6, 0.6], [2, 0]],
      browRY: [[0, 0], [0.3, -0.3], [1.6, -0.3], [2, 0]],
    },
  },

  // ───────── 开心 ─────────
  happy_bounce: {
    duration: 1.6,
    emotion: 'laugh',
    transform: {
      y: [[0, 0], [0.2, -0.04, 'out'], [0.4, 0, 'in'], [0.6, -0.04, 'out'], [0.8, 0, 'in'], [1.0, -0.025, 'out'], [1.2, 0, 'in']],
    },
    params: {
      angleZ: wiggle(0, 0.2, 6, 5),
      armL: [[0, 0], [0.2, 0.6], [1.2, 0.6], [1.6, 0]],
      armR: [[0, 0], [0.2, 0.6], [1.2, 0.6], [1.6, 0]],
    },
  },
  happy_spin: {
    duration: 1.4,
    emotion: 'laugh',
    fadeIn: 0.05,
    fadeOut: 0.1,
    transform: {
      // 用水平翻转模拟「转一圈」：正面 → 侧身 → 背面 → 侧身 → 正面
      scaleX: [[0, 0], [0.3, -1, 'in'], [0.6, -2, 'out'], [0.9, -1, 'in'], [1.2, 0, 'out']],
      y: [[0, 0], [0.6, -0.05, 'out'], [1.2, 0, 'in']],
    },
    params: {
      armL: [[0, 0], [0.3, 0.7], [1.0, 0.7], [1.4, 0]],
      armR: [[0, 0], [0.3, 0.7], [1.0, 0.7], [1.4, 0]],
    },
  },
  happy_cheer: {
    duration: 1.8,
    emotion: 'sparkle',
    params: {
      armL: [[0, 0], [0.25, 1, 'back'], [1.4, 1], [1.8, 0]],
      armR: [[0, 0], [0.25, 1, 'back'], [1.4, 1], [1.8, 0]],
      forearmL: wiggle(0.25, 0.18, 0.4, 5, 0.6),
      forearmR: wiggle(0.25, 0.18, 0.4, 5, 0.6),
      angleY: [[0, 0], [0.25, 10], [1.4, 10], [1.8, 0]],
    },
    transform: { y: [[0, 0], [0.25, -0.05, 'out'], [0.5, 0, 'in']] },
  },

  // ───────── 害羞 ─────────
  shy_hide: {
    duration: 2.4,
    emotion: 'shy',
    params: {
      armL: [[0, 0], [0.3, 1, 'out'], [1.9, 1], [2.4, 0]],
      armR: [[0, 0], [0.3, 1, 'out'], [1.9, 1], [2.4, 0]],
      forearmL: [[0, 0], [0.3, 1], [1.9, 1], [2.4, 0]],
      forearmR: [[0, 0], [0.3, 1], [1.9, 1], [2.4, 0]],
      angleY: [[0, 0], [0.3, -18], [1.9, -18], [2.4, 0]],
      angleX: [[0, 0], [0.3, 12], [1.9, 12], [2.4, 0]],
      eyeLOpen: closedEyes(0.25, 1.9),
      eyeROpen: closedEyes(0.25, 1.9),
    },
  },
  shy_fidget: {
    duration: 2.4,
    emotion: 'shy',
    params: {
      eyeBallX: [[0, 0], [0.3, -0.7], [2.0, -0.7], [2.4, 0]],
      eyeBallY: [[0, 0], [0.3, -0.5], [2.0, -0.5], [2.4, 0]],
      angleX: [[0, 0], [0.4, -10], [2.0, -10], [2.4, 0]],
      angleY: [[0, 0], [0.4, -8], [2.0, -8], [2.4, 0]],
      bodyZ: wiggle(0.2, 0.35, 3, 5),
      handL: wiggle(0.3, 0.25, 0.5, 7),
      handR: wiggle(0.3, 0.25, -0.5, 7),
    },
  },

  // ───────── 难过 ─────────
  sad_droop: {
    duration: 2.8,
    emotion: 'sad',
    params: {
      angleY: [[0, 0], [0.8, -18], [2.3, -18], [2.8, 0]],
      bodyY: [[0, 0], [0.8, -5], [2.3, -5], [2.8, 0]],
      eyeBallY: [[0, 0], [0.8, -0.6], [2.3, -0.6], [2.8, 0]],
      eyeLOpen: [[0, 1], [0.8, 0.55], [2.3, 0.55], [2.8, 1]],
      eyeROpen: [[0, 1], [0.8, 0.55], [2.3, 0.55], [2.8, 1]],
    },
    transform: { y: [[0, 0], [0.8, 0.015], [2.3, 0.015], [2.8, 0]] },
  },

  // ───────── 小生气 ─────────
  angry_puff: {
    duration: 2.2,
    emotion: 'angry',
    params: {
      angleX: [[0, 0], [0.25, 22, 'back'], [1.8, 22], [2.2, 0]],
      angleZ: [[0, 0], [0.25, -5], [1.8, -5], [2.2, 0]],
      eyeBallX: [[0, 0], [0.25, -0.8], [1.2, -0.8], [1.35, -0.2], [1.6, -0.8], [2.2, 0]],
      armL: [[0, 0], [0.3, 0.5], [1.8, 0.5], [2.2, 0]],
      armR: [[0, 0], [0.3, 0.5], [1.8, 0.5], [2.2, 0]],
    },
    transform: { scaleX: [[0, 0], [0.25, 0.03, 'back'], [1.8, 0.03], [2.2, 0]] },
  },
  angry_stomp: {
    duration: 1.6,
    emotion: 'angry',
    transform: {
      y: [[0, 0], [0.15, -0.02, 'out'], [0.25, 0.01, 'in'], [0.35, 0], [0.55, -0.02, 'out'], [0.65, 0.01, 'in'], [0.75, 0], [0.95, -0.02, 'out'], [1.05, 0.01, 'in'], [1.2, 0]],
      rotation: wiggle(0, 0.4, 0.03, 3),
    },
    params: {
      armL: [[0, 0], [0.2, 0.7], [1.3, 0.7], [1.6, 0]],
      armR: [[0, 0], [0.2, 0.7], [1.3, 0.7], [1.6, 0]],
      angleY: [[0, 0], [0.2, -6], [1.3, -6], [1.6, 0]],
    },
  },

  // ───────── 惊讶 ─────────
  surprised_jump: {
    duration: 1.6,
    emotion: 'surprised',
    fadeIn: 0.05,
    transform: {
      y: [[0, 0], [0.12, -0.06, 'out'], [0.35, 0, 'in'], [0.42, 0.01], [0.5, 0]],
      scaleY: [[0, 0], [0.12, 0.05, 'out'], [0.35, -0.04], [0.5, 0]],
    },
    params: {
      angleY: [[0, 0], [0.12, 14, 'out'], [1.2, 14], [1.6, 0]],
      bodyY: [[0, 0], [0.12, 6], [1.2, 6], [1.6, 0]],
      armL: [[0, 0], [0.12, 0.6, 'out'], [1.2, 0.6], [1.6, 0]],
      armR: [[0, 0], [0.12, 0.6, 'out'], [1.2, 0.6], [1.6, 0]],
    },
  },

  // ───────── 指引（魔法棒指方向） ─────────
  point_left: {
    duration: 2.6,
    emotion: 'smile',
    params: {
      armL: [[0, 0], [0.35, 1, 'back'], [2.2, 1], [2.6, 0]],
      forearmL: [[0, 0], [0.35, 0.2], [0.8, 0.35], [1.2, 0.2], [1.6, 0.35], [2.2, 0.2], [2.6, 0]],
      angleX: [[0, 0], [0.35, -20], [2.2, -20], [2.6, 0]],
      eyeBallX: [[0, 0], [0.3, -0.9], [2.2, -0.9], [2.6, 0]],
      bodyX: [[0, 0], [0.35, -6], [2.2, -6], [2.6, 0]],
    },
  },
  point_right: {
    duration: 2.6,
    emotion: 'smile',
    params: {
      armR: [[0, 0], [0.35, 1, 'back'], [2.2, 1], [2.6, 0]],
      forearmR: [[0, 0], [0.35, 0.2], [0.8, 0.35], [1.2, 0.2], [1.6, 0.35], [2.2, 0.2], [2.6, 0]],
      angleX: [[0, 0], [0.35, 20], [2.2, 20], [2.6, 0]],
      eyeBallX: [[0, 0], [0.3, 0.9], [2.2, 0.9], [2.6, 0]],
      bodyX: [[0, 0], [0.35, 6], [2.2, 6], [2.6, 0]],
    },
  },
  point_up: {
    duration: 2.6,
    emotion: 'smile',
    params: {
      armR: [[0, 0], [0.35, 1, 'back'], [2.2, 1], [2.6, 0]],
      forearmR: [[0, 0], [0.35, 1], [2.2, 1], [2.6, 0]],
      angleY: [[0, 0], [0.35, 20], [2.2, 20], [2.6, 0]],
      eyeBallY: [[0, 0], [0.3, 0.9], [2.2, 0.9], [2.6, 0]],
    },
    transform: { y: [[0, 0], [0.35, -0.015], [2.2, -0.015], [2.6, 0]] },
  },
  point_down: {
    duration: 2.6,
    emotion: 'smile',
    params: {
      armR: [[0, 0], [0.35, 0.4, 'back'], [2.2, 0.4], [2.6, 0]],
      handR: [[0, 0], [0.35, -0.8], [2.2, -0.8], [2.6, 0]],
      angleY: [[0, 0], [0.35, -20], [2.2, -20], [2.6, 0]],
      eyeBallY: [[0, 0], [0.3, -0.9], [2.2, -0.9], [2.6, 0]],
      bodyY: [[0, 0], [0.35, -5], [2.2, -5], [2.6, 0]],
    },
  },

  // ───────── 回答 ─────────
  nod: {
    duration: 1.2,
    emotion: 'smile',
    params: { angleY: [[0, 0], [0.2, -15, 'out'], [0.45, 5], [0.7, -12, 'out'], [0.95, 3], [1.2, 0]] },
  },
  shake_head: {
    duration: 1.3,
    params: { angleX: wiggle(0, 0.18, 18, 5), mouthForm: [[0, 0], [0.2, -0.6], [1.1, -0.6], [1.3, 0]] },
  },

  // ───────── 睡觉 ─────────
  sleep_doze: {
    duration: 4,
    loop: true,
    emotion: 'sleepy',
    params: {
      eyeLOpen: [[0, 0], [4, 0]],
      eyeROpen: [[0, 0], [4, 0]],
      angleY: [[0, -12], [1.6, -22, 'in'], [1.9, -10, 'out'], [4, -12]],
      angleZ: [[0, 8], [2, 12], [4, 8]],
      mouthOpen: [[0, 0.1], [2, 0.25], [4, 0.1]],
      bodyY: [[0, -3], [2, -5], [4, -3]],
    },
  },
  wake_up: {
    duration: 1.6,
    emotion: 'surprised',
    params: {
      eyeLOpen: [[0, 0], [0.2, 0.3], [0.35, 0], [0.6, 1.3, 'out'], [1.2, 1.3], [1.6, 1]],
      eyeROpen: [[0, 0], [0.2, 0.3], [0.35, 0], [0.6, 1.3, 'out'], [1.2, 1.3], [1.6, 1]],
      angleY: [[0, -12], [0.6, 8, 'back'], [1.6, 0]],
      angleX: wiggle(0.6, 0.15, 10, 3),
    },
  },

  // ───────── 被戳 / 被拖 ─────────
  poke_head: {
    duration: 1.8,
    emotion: 'laugh',
    params: {
      eyeLOpen: closedEyes(0.05, 1.4),
      eyeROpen: closedEyes(0.05, 1.4),
      angleZ: wiggle(0.05, 0.25, 8, 5),
      angleY: [[0, 0], [0.1, -8], [1.4, -8], [1.8, 0]],
    },
  },
  poke_body: {
    duration: 1.4,
    emotion: 'shy',
    fadeIn: 0.05,
    params: {
      bodyX: [[0, 0], [0.1, -8, 'out'], [1.0, -8], [1.4, 0]],
      angleX: [[0, 0], [0.1, -15, 'out'], [1.0, -15], [1.4, 0]],
      armL: [[0, 0], [0.15, 0.6], [1.0, 0.6], [1.4, 0]],
      armR: [[0, 0], [0.15, 0.6], [1.0, 0.6], [1.4, 0]],
    },
    transform: { x: [[0, 0], [0.1, -0.02, 'out'], [1.0, -0.02], [1.4, 0]] },
  },
  drag_dangle: {
    duration: 1.2,
    loop: true,
    emotion: 'surprised',
    params: {
      armL: wiggle(0, 0.15, 0.6, 7, 0.4),
      armR: wiggle(0, 0.15, -0.6, 7, 0.4),
      angleZ: wiggle(0, 0.3, 10, 3),
    },
    transform: { rotation: wiggle(0, 0.3, 0.08, 3) },
  },

  // ───────── 淘气 ─────────
  mischief_peek: {
    duration: 2.6,
    emotion: 'smug',
    transform: {
      // 先缩到一边藏起来，再探头出来
      x: [[0, 0], [0.3, 0.12, 'in'], [1.0, 0.12], [1.4, 0.04, 'back'], [2.2, 0.04], [2.6, 0]],
      rotation: [[0, 0], [1.0, 0], [1.4, -0.12, 'back'], [2.2, -0.12], [2.6, 0]],
    },
    params: {
      angleZ: [[0, 0], [1.0, 0], [1.4, -15], [2.2, -15], [2.6, 0]],
      eyeBallX: [[0, 0], [1.4, -0.7], [2.2, -0.7], [2.6, 0]],
    },
  },
  mischief_wink: {
    duration: 1.6,
    emotion: 'smug',
    params: {
      eyeROpen: [[0, 1], [0.15, 0, 'out'], [1.0, 0], [1.2, 1, 'out']],
      eyeRSmile: [[0, 0], [0.15, 1], [1.0, 1], [1.2, 0]],
      angleZ: [[0, 0], [0.2, 10, 'back'], [1.2, 10], [1.6, 0]],
      armR: [[0, 0], [0.25, 0.7, 'back'], [1.2, 0.7], [1.6, 0]],
      forearmR: [[0, 0], [0.25, 0.9], [1.2, 0.9], [1.6, 0]],
      mouthForm: [[0, 0], [0.2, 1], [1.2, 1], [1.6, 0]],
    },
  },
};
