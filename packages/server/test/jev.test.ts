import { describe, expect, it } from 'vitest';
import { RuleBasedJev } from '../src/jev';

const cfg = { idleSeconds: 30, youtubeReplyIntervalMs: 5000, blockedWords: ['广告'] };

describe('RuleBasedJev', () => {
  it('ignores short idles and offers help on long ones', () => {
    const jev = new RuleBasedJev(cfg, () => []);
    expect(jev.decide({ source: 'web', type: 'idle', page: '/', seconds: 5 }).action).toBe('ignore');
    expect(jev.decide({ source: 'web', type: 'idle', page: '/', seconds: 45 }).action).toBe('say');
  });

  it('filters spam, rate-limits and only answers chat addressed to huinuo', () => {
    let t = 0;
    const jev = new RuleBasedJev(cfg, () => [], () => t);
    const chat = (text: string) => jev.decide({ source: 'youtube', type: 'chat', author: 'a', text });
    expect(chat('看广告啦').action).toBe('ignore');
    expect(chat('哈哈哈哈哈哈哈哈哈').action).toBe('ignore');
    expect(chat('今天天气不错').action).toBe('ignore');
    expect(chat('灰糯你好呀').action).toBe('chat');
    expect(chat('灰糯吃饭了吗').action).toBe('ignore'); // 限流
    t = 6000;
    expect(chat('灰糯今天开心吗？').action).toBe('chat');
    t = 12000;
    expect(chat('灰糯今天开心吗？').action).toBe('ignore'); // 重复刷屏
    expect(chat('灰糯跳个舞').action).toBe('motion');
  });
});
