import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { DEFAULT_CONFIG, type HuinuoConfig } from '../src/config';
import { MockProvider } from '../src/providers/mock';
import type { LLMProvider } from '../src/providers/types';

const config: HuinuoConfig = {
  ...DEFAULT_CONFIG,
  tutorials: [
    {
      id: 'upload-video',
      title: '上传视频',
      keywords: ['怎么上传'],
      steps: [{ target: '#upload-btn', say: '点这里', motion: 'point_right', waitFor: 'click' }],
    },
  ],
};

const post = (app: ReturnType<typeof createApp>, path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('API', () => {
  it('chats through the AI and returns a structured reply', async () => {
    const app = createApp({ config, providers: [new MockProvider()] });
    const res = await post(app, '/api/chat', { sessionId: 's1', message: '你好' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe('mock');
    expect(json.reply).toMatchObject({ emotion: 'smile', motion: 'greet_wave' });
  });

  it('starts a tutorial when jev matches one, without calling the AI', async () => {
    let called = false;
    const spy: LLMProvider = { id: 'spy', complete: async () => ((called = true), '{}') };
    const app = createApp({ config, providers: [spy] });
    const json = await (await post(app, '/api/chat', { sessionId: 's1', message: '请问怎么上传？' })).json();
    expect(json.reply.tutorial).toBe('upload-video');
    expect(called).toBe(false);
  });

  it('returns an in-character fallback when every AI is down', async () => {
    const down: LLMProvider = { id: 'down', complete: async () => { throw new Error('503'); } };
    const app = createApp({ config, providers: [down] });
    const json = await (await post(app, '/api/chat', { sessionId: 's1', message: '在吗' })).json();
    expect(json.degraded).toBe(true);
    expect(json.reply.motion).toBe('sad_droop');
  });

  it('validates input', async () => {
    const app = createApp({ config, providers: [new MockProvider()] });
    expect((await post(app, '/api/chat', { sessionId: 's1' })).status).toBe(400);
    expect((await post(app, '/api/chat', { sessionId: 's1', message: 'x'.repeat(501) })).status).toBe(400);
    expect((await post(app, '/api/events', { event: { source: 'web', type: 'hack' } })).status).toBe(400);
  });

  it('turns a YouTube superchat into a thank-you', async () => {
    const app = createApp({ config, providers: [new MockProvider()] });
    const json = await (
      await post(app, '/api/events', { event: { source: 'youtube', type: 'superchat', author: '小明', text: '加油', amount: '¥30' } })
    ).json();
    expect(json).toMatchObject({ action: 'say', reply: { motion: 'happy_cheer' } });
  });

  it('protects provider switching with the admin token', async () => {
    const app = createApp({ config, providers: [new MockProvider('a'), new MockProvider('b')], adminToken: 't0k' });
    expect((await post(app, '/api/providers/active', { id: 'b' })).status).toBe(403);
    const res = await post(app, '/api/providers/active', { id: 'b' }, { Authorization: 'Bearer t0k' });
    expect(res.status).toBe(200);
    expect((await res.json()).find((p: { id: string }) => p.id === 'b').preferred).toBe(true);
  });
});
