import { describe, expect, it } from 'vitest';
import { AIGateway, AllProvidersFailedError } from '../src/gateway';
import type { LLMProvider } from '../src/providers/types';

function provider(id: string, behavior: () => string | Error): LLMProvider & { calls: number } {
  const p = {
    id,
    calls: 0,
    async complete() {
      p.calls++;
      const r = behavior();
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return p;
}

describe('AIGateway', () => {
  it('uses the first provider when healthy', async () => {
    const a = provider('a', () => 'A');
    const b = provider('b', () => 'B');
    const gw = new AIGateway([a, b]);
    const r = await gw.complete([]);
    expect(r).toMatchObject({ content: 'A', providerId: 'a', failed: [] });
    expect(b.calls).toBe(0);
  });

  it('fails over to the next provider and puts the broken one in cooldown', async () => {
    let t = 0;
    const a = provider('a', () => new Error('boom'));
    const b = provider('b', () => 'B');
    const gw = new AIGateway([a, b], { baseCooldownMs: 1000, now: () => t });

    const r1 = await gw.complete([]);
    expect(r1.providerId).toBe('b');
    expect(r1.failed).toEqual([{ id: 'a', error: 'boom' }]);

    // 冷却中：直接走 b，不再浪费时间请求 a
    await gw.complete([]);
    expect(a.calls).toBe(1);

    // 冷却结束：重新尝试 a
    t = 1001;
    await gw.complete([]);
    expect(a.calls).toBe(2);
  });

  it('doubles the cooldown on repeated failures, capped at max', async () => {
    let t = 0;
    const a = provider('a', () => new Error('x'));
    const b = provider('b', () => 'B');
    const gw = new AIGateway([a, b], { baseCooldownMs: 100, maxCooldownMs: 250, now: () => t });
    await gw.complete([]);
    expect(gw.status()[0].cooldownUntil).toBe(100);
    t = 100;
    await gw.complete([]);
    expect(gw.status()[0].cooldownUntil).toBe(300);
    t = 300;
    await gw.complete([]);
    expect(gw.status()[0].cooldownUntil).toBe(550); // 400 被封顶为 250
  });

  it('honours the manually preferred provider', async () => {
    const a = provider('a', () => 'A');
    const b = provider('b', () => 'B');
    const gw = new AIGateway([a, b]);
    gw.setPreferred('b');
    expect((await gw.complete([])).providerId).toBe('b');
    expect(() => gw.setPreferred('zzz')).toThrow();
  });

  it('still tries cooling providers when nothing else is left', async () => {
    let t = 0;
    let aBroken = true;
    const a = provider('a', () => (aBroken ? new Error('down') : 'A'));
    const gw = new AIGateway([a], { baseCooldownMs: 10_000, now: () => t });
    await expect(gw.complete([])).rejects.toBeInstanceOf(AllProvidersFailedError);
    aBroken = false;
    t = 1;
    expect((await gw.complete([])).content).toBe('A');
    expect(gw.status()[0]).toMatchObject({ healthy: true, failures: 0 });
  });
});
