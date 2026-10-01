import {
  DEFAULT_MOTION_FOR_EMOTION,
  isEmotion,
  isMotion,
  type Emotion,
  type MotionName,
} from './vocab';

/** 灰糯的一次回复：说什么 + 什么表情 + 做什么动作 + （可选）高亮哪个元素。 */
export interface AssistantReply {
  text: string;
  emotion: Emotion;
  motion: MotionName;
  /** 页面元素的 CSS 选择器，用于教程高亮 */
  highlight?: string;
  /** 触发某个已配置的教程 */
  tutorial?: string;
}

const KEYWORD_EMOTIONS: Array<[RegExp, Emotion]> = [
  [/哈哈|嘿嘿|好耶|太棒|开心|😄|😆|🎉/, 'laugh'],
  [/害羞|脸红|才不是|不好意思|>\/</, 'shy'],
  [/诶[?？!！]|哇|竟然|居然|什么[?？!！]/, 'surprised'],
  [/呜|难过|伤心|抱歉|对不起/, 'sad'],
  [/哼|生气|讨厌|不理你/, 'angry'],
  [/嗯\.{2,}|唔|让我想想|好像|不太确定/, 'confused'],
  [/困|晚安|zzz/i, 'sleepy'],
];

/** 模型没按 JSON 输出时，用关键词粗略推断情绪。 */
export function inferEmotion(text: string): Emotion {
  for (const [re, emotion] of KEYWORD_EMOTIONS) {
    if (re.test(text)) return emotion;
  }
  return 'smile';
}

/** 从模型输出中找出第一个完整的 JSON 对象（容忍 ```json 代码块和前后废话）。 */
function extractJsonObject(raw: string): unknown {
  const start = raw.indexOf('{');
  if (start === -1) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try {
        return JSON.parse(raw.slice(start, i + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * 把 AI 的原始输出整理成合法的 AssistantReply。
 * 非法的 emotion / motion 一律回退，保证前端永远拿到能播放的动作。
 */
export function parseAssistantReply(raw: string): AssistantReply {
  const obj = extractJsonObject(raw);
  if (obj && typeof obj === 'object' && typeof (obj as { text?: unknown }).text === 'string') {
    const o = obj as Record<string, unknown>;
    const text = (o.text as string).trim();
    const emotion = isEmotion(o.emotion) ? o.emotion : inferEmotion(text);
    const motion = isMotion(o.motion) ? o.motion : DEFAULT_MOTION_FOR_EMOTION[emotion];
    const reply: AssistantReply = { text, emotion, motion };
    if (typeof o.highlight === 'string' && o.highlight.trim()) reply.highlight = o.highlight.trim();
    if (typeof o.tutorial === 'string' && o.tutorial.trim()) reply.tutorial = o.tutorial.trim();
    return reply;
  }
  const text = raw.replace(/```[a-z]*|```/gi, '').trim();
  const emotion = inferEmotion(text);
  return { text, emotion, motion: DEFAULT_MOTION_FOR_EMOTION[emotion] };
}
