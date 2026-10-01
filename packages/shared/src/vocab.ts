/**
 * 灰糯能做的情绪和动作的白名单。
 * AI 只能从这里选；前端动作引擎和导出脚本也以此为准。
 */

export const EMOTIONS = [
  'neutral',
  'smile',
  'laugh',
  'shy',
  'surprised',
  'sad',
  'cry',
  'angry',
  'confused',
  'smug',
  'sleepy',
  'sparkle',
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const MOTIONS = [
  // 待机
  'idle_breathe',
  'idle_sway',
  'idle_look_around',
  'idle_yawn',
  // 问候 / 告别
  'greet_wave',
  'greet_hop',
  'greet_bow',
  'bye_wave',
  // 说话
  'talk',
  'talk_explain',
  // 思考
  'think',
  'think_tilt',
  // 开心
  'happy_bounce',
  'happy_spin',
  'happy_cheer',
  // 害羞
  'shy_hide',
  'shy_fidget',
  // 难过
  'sad_droop',
  // 小生气（可爱向）
  'angry_puff',
  'angry_stomp',
  // 惊讶
  'surprised_jump',
  // 指引（教程用，用魔法棒指方向）
  'point_left',
  'point_right',
  'point_up',
  'point_down',
  // 回答
  'nod',
  'shake_head',
  // 睡觉
  'sleep_doze',
  'wake_up',
  // 被戳 / 被拖
  'poke_head',
  'poke_body',
  'drag_dangle',
  // 淘气
  'mischief_peek',
  'mischief_wink',
] as const;
export type MotionName = (typeof MOTIONS)[number];

const EMOTION_SET: ReadonlySet<string> = new Set(EMOTIONS);
const MOTION_SET: ReadonlySet<string> = new Set(MOTIONS);

export function isEmotion(v: unknown): v is Emotion {
  return typeof v === 'string' && EMOTION_SET.has(v);
}

export function isMotion(v: unknown): v is MotionName {
  return typeof v === 'string' && MOTION_SET.has(v);
}

/** 每种情绪默认搭配的动作，AI 只给了情绪时使用。 */
export const DEFAULT_MOTION_FOR_EMOTION: Record<Emotion, MotionName> = {
  neutral: 'talk',
  smile: 'talk',
  laugh: 'happy_bounce',
  shy: 'shy_fidget',
  surprised: 'surprised_jump',
  sad: 'sad_droop',
  cry: 'sad_droop',
  angry: 'angry_puff',
  confused: 'think_tilt',
  smug: 'mischief_wink',
  sleepy: 'idle_yawn',
  sparkle: 'happy_cheer',
};
