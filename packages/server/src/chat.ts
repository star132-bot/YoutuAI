import { parseAssistantReply, type AssistantReply, type Tutorial } from '@huinuo/shared';
import type { KnowledgeEntry } from './config';
import { AllProvidersFailedError, type AIGateway } from './gateway';
import { buildSystemPrompt, retrieveKnowledge } from './persona';
import type { ChatMessage } from './providers/types';

export interface ChatResult {
  reply: AssistantReply;
  provider: string | null;
  /** true 表示所有 AI 都不可用，返回的是兜底台词 */
  degraded: boolean;
}

const FALLBACK_REPLY: AssistantReply = {
  text: '吱…我的小脑袋线路打结了，等一下再问我好不好？',
  emotion: 'sad',
  motion: 'sad_droop',
};

interface Session {
  history: ChatMessage[];
  touchedAt: number;
}

export interface ChatServiceOptions {
  maxTurns?: number;
  sessionTtlMs?: number;
  maxSessions?: number;
  now?: () => number;
}

/** 对话服务：拼人设 + 资料 + 历史，调用 AI 网关，整理成结构化回复。 */
export class ChatService {
  private readonly sessions = new Map<string, Session>();
  private readonly maxTurns: number;
  private readonly sessionTtlMs: number;
  private readonly maxSessions: number;
  private readonly now: () => number;

  constructor(
    private readonly gateway: AIGateway,
    private readonly knowledge: KnowledgeEntry[],
    private readonly tutorials: Tutorial[],
    opts: ChatServiceOptions = {},
  ) {
    this.maxTurns = opts.maxTurns ?? 8;
    this.sessionTtlMs = opts.sessionTtlMs ?? 30 * 60_000;
    this.maxSessions = opts.maxSessions ?? 5000;
    this.now = opts.now ?? Date.now;
  }

  tutorialsFor(page?: string): Tutorial[] {
    return this.tutorials.filter(
      (t) => !t.pages?.length || (page !== undefined && t.pages.some((p) => page.startsWith(p))),
    );
  }

  private session(id: string): Session {
    const now = this.now();
    let s = this.sessions.get(id);
    if (!s || now - s.touchedAt > this.sessionTtlMs) {
      s = { history: [], touchedAt: now };
      this.sessions.delete(id);
      if (this.sessions.size >= this.maxSessions) {
        const oldest = this.sessions.keys().next().value;
        if (oldest !== undefined) this.sessions.delete(oldest);
      }
      this.sessions.set(id, s);
    }
    s.touchedAt = now;
    return s;
  }

  async chat(sessionId: string, message: string, page?: string): Promise<ChatResult> {
    const session = this.session(sessionId);
    const tutorials = this.tutorialsFor(page);
    const system = buildSystemPrompt({
      knowledge: retrieveKnowledge(this.knowledge, message),
      tutorials,
      page,
    });
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      ...session.history,
      { role: 'user', content: message },
    ];

    let result;
    try {
      result = await this.gateway.complete(messages);
    } catch (err) {
      if (err instanceof AllProvidersFailedError) {
        console.error(`[huinuo] ${err.message}`);
        return { reply: FALLBACK_REPLY, provider: null, degraded: true };
      }
      throw err;
    }

    const reply = parseAssistantReply(result.content);
    if (reply.tutorial && !tutorials.some((t) => t.id === reply.tutorial)) delete reply.tutorial;

    session.history.push({ role: 'user', content: message }, { role: 'assistant', content: JSON.stringify(reply) });
    if (session.history.length > this.maxTurns * 2) {
      session.history.splice(0, session.history.length - this.maxTurns * 2);
    }
    return { reply, provider: result.providerId, degraded: false };
  }
}
