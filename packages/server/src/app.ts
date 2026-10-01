import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Decision, HuinuoEvent } from '@huinuo/shared';
import { ChatService } from './chat';
import type { HuinuoConfig } from './config';
import { AIGateway } from './gateway';
import { RuleBasedJev, type DecisionEngine } from './jev';
import type { LLMProvider } from './providers/types';
import { RateLimiter } from './ratelimit';

const MAX_MESSAGE_LENGTH = 500;

export interface AppDeps {
  config: HuinuoConfig;
  providers: LLMProvider[];
  adminToken?: string;
  jev?: DecisionEngine;
}

function clientKey(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const EVENT_TYPES: Record<string, string[]> = {
  web: ['page_view', 'idle', 'js_error', 'rage_click', 'user_message'],
  youtube: ['chat', 'superchat', 'new_member'],
};

function isEvent(v: unknown): v is HuinuoEvent {
  if (!v || typeof v !== 'object') return false;
  const e = v as { source?: unknown; type?: unknown };
  return typeof e.source === 'string' && typeof e.type === 'string' && !!EVENT_TYPES[e.source]?.includes(e.type);
}

export function createApp(deps: AppDeps) {
  const gateway = new AIGateway(deps.providers);
  const chat = new ChatService(gateway, deps.config.knowledge, deps.config.tutorials);
  const jev = deps.jev ?? new RuleBasedJev(deps.config.jev, (page) => chat.tutorialsFor(page));
  const limiter = new RateLimiter(20, 20 / 60);

  const app = new Hono();
  const origins = deps.config.allowedOrigins;
  app.use('/api/*', cors({ origin: origins.includes('*') ? '*' : origins }));

  const limited = (c: Context) => !limiter.take(clientKey(c));

  const requireAdmin = (c: Context) =>
    !!deps.adminToken && c.req.header('authorization') === `Bearer ${deps.adminToken}`;

  app.get('/api/health', (c) => c.json({ ok: true, name: '灰糯', providers: gateway.status() }));

  app.get('/api/providers', (c) => c.json(gateway.status()));

  app.post('/api/providers/active', async (c) => {
    if (!requireAdmin(c)) return c.json({ error: 'forbidden' }, 403);
    const body = (await c.req.json().catch(() => ({}))) as { id?: string | null };
    try {
      gateway.setPreferred(body.id ?? null);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
    return c.json(gateway.status());
  });

  app.get('/api/tutorials', (c) => c.json(chat.tutorialsFor(c.req.query('page'))));

  app.post('/api/chat', async (c) => {
    if (limited(c)) return c.json({ error: 'too many requests' }, 429);
    const body = (await c.req.json().catch(() => null)) as { sessionId?: unknown; message?: unknown; page?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.slice(0, 64) : '';
    if (!message || !sessionId) return c.json({ error: 'sessionId and message are required' }, 400);
    if (message.length > MAX_MESSAGE_LENGTH) return c.json({ error: 'message too long' }, 400);
    const page = typeof body?.page === 'string' ? body.page.slice(0, 200) : undefined;

    // 先让 jev 判断：命中教程就直接启动教程，否则交给 AI 聊天
    const decision = await jev.decide({ source: 'web', type: 'user_message', page: page ?? '/', text: message });
    if (decision.action === 'tutorial') {
      return c.json({ reply: decision.reply, provider: 'jev', degraded: false });
    }
    return c.json(await chat.chat(sessionId, message, page));
  });

  app.post('/api/events', async (c) => {
    if (limited(c)) return c.json({ error: 'too many requests' }, 429);
    const body = (await c.req.json().catch(() => null)) as { sessionId?: unknown; event?: unknown } | null;
    if (!isEvent(body?.event)) return c.json({ error: 'invalid event' }, 400);
    const event = body.event;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : `${event.source}-anon`;

    let decision: Decision = await jev.decide(event);
    if (decision.action === 'chat') {
      const page = 'page' in event ? event.page : undefined;
      const result = await chat.chat(sessionId, decision.prompt.slice(0, MAX_MESSAGE_LENGTH), page);
      decision = { action: 'say', reply: result.reply, reason: `${decision.reason} → ${result.provider ?? 'fallback'}` };
    }
    return c.json(decision);
  });

  return app;
}
