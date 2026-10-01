import type { ChatMessage, LLMProvider } from './types';

/**
 * 不需要 Key 的离线「假 AI」，用于本地开发、演示和测试。
 * 按关键词返回符合灰糯人设的 JSON 回复。
 */
export class MockProvider implements LLMProvider {
  constructor(readonly id = 'mock') {}

  async complete(messages: ChatMessage[]): Promise<string> {
    const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const say = (text: string, emotion: string, motion: string, extra: Record<string, string> = {}) =>
      JSON.stringify({ text, emotion, motion, ...extra });

    if (/你好|hello|hi|嗨/i.test(last)) return say('吱～你好呀！我是灰糯，有什么要帮忙的尽管说！', 'smile', 'greet_wave');
    if (/可爱|厉害|谢谢|棒/.test(last)) return say('诶嘿…被、被夸了…才没有很开心呢！', 'shy', 'shy_fidget');
    if (/笨|讨厌|坏/.test(last)) return say('哼！再这样说我就把按钮都藏起来！', 'angry', 'angry_puff');
    if (/跳.{0,2}舞|转.{0,2}圈|dance/i.test(last)) return say('看好啦——转圈圈！', 'laugh', 'happy_spin');
    if (/怎么|如何|在哪/.test(last)) return say('交给我！先看这边～', 'smile', 'point_right');
    if (/再见|拜拜|bye/i.test(last)) return say('拜拜～有事随时戳我哦！', 'smile', 'bye_wave');
    return say('唔…让我想想。（我现在是离线模式，接上真正的 AI 会更聪明哦）', 'confused', 'think_tilt');
  }
}
