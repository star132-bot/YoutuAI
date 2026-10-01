import type { AssistantReply } from './reply';
import type { MotionName } from './vocab';

/**
 * jev 判断层的输入：来自网页或 YouTube 的一条事件。
 */
export type HuinuoEvent =
  | { source: 'web'; type: 'page_view'; page: string; title?: string }
  | { source: 'web'; type: 'idle'; page: string; seconds: number }
  | { source: 'web'; type: 'js_error'; page: string; message: string }
  | { source: 'web'; type: 'rage_click'; page: string; selector: string; count: number }
  | { source: 'web'; type: 'user_message'; page: string; text: string }
  | { source: 'youtube'; type: 'chat'; author: string; text: string }
  | { source: 'youtube'; type: 'superchat'; author: string; text: string; amount: string }
  | { source: 'youtube'; type: 'new_member'; author: string };

/**
 * jev 判断层的输出：这条事件该怎么处理。
 */
export type Decision =
  | { action: 'ignore'; reason: string }
  | { action: 'motion'; motion: MotionName; reason: string }
  | { action: 'say'; reply: AssistantReply; reason: string }
  | { action: 'chat'; prompt: string; reason: string }
  | { action: 'tutorial'; tutorial: string; reply: AssistantReply; reason: string };

/** 教程脚本里的一步 */
export interface TutorialStep {
  target: string;
  say: string;
  motion?: MotionName;
  waitFor?: 'click' | 'input' | 'next';
}

export interface Tutorial {
  id: string;
  title: string;
  /** 用户问到这些关键词时，可以触发该教程 */
  keywords?: string[];
  /** 只在这些页面路径下可用（前缀匹配），留空则全站可用 */
  pages?: string[];
  steps: TutorialStep[];
}
