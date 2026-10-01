import type { Decision, HuinuoEvent, Tutorial } from '@huinuo/shared';
import type { HuinuoConfig } from './config';

/**
 * jev 判断层：接收网页 / YouTube 事件，决定灰糯该怎么做。
 * 目前是规则版实现；之后可换成训练好的 jev 模型，只要实现同一个接口。
 */
export interface DecisionEngine {
  decide(event: HuinuoEvent): Decision | Promise<Decision>;
}

export class RuleBasedJev implements DecisionEngine {
  private lastYoutubeReplyAt = -Infinity;
  private readonly recentChats: string[] = [];

  constructor(
    private readonly cfg: HuinuoConfig['jev'],
    private readonly tutorialsFor: (page?: string) => Tutorial[],
    private readonly now: () => number = Date.now,
  ) {}

  private matchTutorial(text: string, page?: string): Tutorial | undefined {
    const t = text.toLowerCase();
    return this.tutorialsFor(page).find((tut) => tut.keywords?.some((k) => t.includes(k.toLowerCase())));
  }

  decide(e: HuinuoEvent): Decision {
    if (e.source === 'web') return this.decideWeb(e);
    return this.decideYoutube(e);
  }

  private decideWeb(e: Extract<HuinuoEvent, { source: 'web' }>): Decision {
    switch (e.type) {
      case 'page_view':
        return {
          action: 'say',
          reply: { text: '吱～我是灰糯！有不会的地方就戳戳我～', emotion: 'smile', motion: 'greet_wave' },
          reason: 'greet on page view',
        };
      case 'idle': {
        if (e.seconds < this.cfg.idleSeconds) return { action: 'ignore', reason: 'not idle long enough' };
        const tut = this.tutorialsFor(e.page)[0];
        return {
          action: 'say',
          reply: {
            text: tut ? `是不是卡住啦？要不要我带你「${tut.title}」？` : '发呆中？需要帮忙就叫我哦～',
            emotion: 'smug',
            motion: 'mischief_peek',
          },
          reason: `user idle ${e.seconds}s`,
        };
      }
      case 'js_error':
        return {
          action: 'say',
          reply: { text: '诶？页面好像出了点小问题…刷新一下试试？', emotion: 'surprised', motion: 'surprised_jump' },
          reason: 'page error',
        };
      case 'rage_click':
        if (e.count < 3) return { action: 'ignore', reason: 'few clicks' };
        return {
          action: 'say',
          reply: { text: '别急别急～告诉我你想做什么，我来帮你！', emotion: 'confused', motion: 'think_tilt' },
          reason: `rage click x${e.count}`,
        };
      case 'user_message': {
        const tut = this.matchTutorial(e.text, e.page);
        if (tut) {
          return {
            action: 'tutorial',
            tutorial: tut.id,
            reply: { text: `交给我！我们一步一步来～`, emotion: 'sparkle', motion: 'happy_cheer', tutorial: tut.id },
            reason: `matched tutorial ${tut.id}`,
          };
        }
        return { action: 'chat', prompt: e.text, reason: 'free chat' };
      }
    }
  }

  private isSpam(text: string): boolean {
    const t = text.trim();
    if (t.length < 2) return true;
    if (this.cfg.blockedWords.some((w) => w && t.includes(w))) return true;
    if (/(.)\1{7,}/.test(t)) return true;
    if (this.recentChats.includes(t)) return true;
    this.recentChats.push(t);
    if (this.recentChats.length > 50) this.recentChats.shift();
    return false;
  }

  private decideYoutube(e: Extract<HuinuoEvent, { source: 'youtube' }>): Decision {
    switch (e.type) {
      case 'superchat':
        return {
          action: 'say',
          reply: { text: `哇！谢谢 ${e.author} 的 ${e.amount}！尾巴都摇起来了～`, emotion: 'sparkle', motion: 'happy_cheer' },
          reason: 'superchat',
        };
      case 'new_member':
        return {
          action: 'say',
          reply: { text: `欢迎 ${e.author} 加入！吱吱～`, emotion: 'laugh', motion: 'greet_hop' },
          reason: 'new member',
        };
      case 'chat': {
        if (this.isSpam(e.text)) return { action: 'ignore', reason: 'spam or duplicate' };
        if (/跳.{0,2}舞|转.{0,2}圈|dance|spin/i.test(e.text)) {
          return { action: 'motion', motion: 'happy_spin', reason: 'dance request' };
        }
        const now = this.now();
        if (now - this.lastYoutubeReplyAt < this.cfg.youtubeReplyIntervalMs) {
          return { action: 'ignore', reason: 'reply rate limit' };
        }
        const addressed = /灰糯|mochi|huinuo/i.test(e.text) || /[?？]$/.test(e.text.trim());
        if (!addressed) return { action: 'ignore', reason: 'not addressed to huinuo' };
        this.lastYoutubeReplyAt = now;
        return { action: 'chat', prompt: `直播间观众 ${e.author} 说：${e.text}`, reason: 'viewer question' };
      }
    }
  }
}
