import type { AssistantReply, Decision, HuinuoEvent, Tutorial } from '@huinuo/shared';

export interface ChatResponse {
  reply: AssistantReply;
  provider: string | null;
  degraded: boolean;
}

const OFFLINE_REPLY: AssistantReply = {
  text: '吱…连不上大脑服务器了，检查一下网络或者后端有没有启动？',
  emotion: 'sad',
  motion: 'sad_droop',
};

export class HuinuoApi {
  constructor(
    private readonly base: string,
    readonly sessionId: string,
  ) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  async chat(message: string, page: string): Promise<ChatResponse> {
    try {
      return await this.post<ChatResponse>('/chat', { sessionId: this.sessionId, message, page });
    } catch {
      return { reply: OFFLINE_REPLY, provider: null, degraded: true };
    }
  }

  async event(event: HuinuoEvent): Promise<Decision> {
    try {
      return await this.post<Decision>('/events', { sessionId: this.sessionId, event });
    } catch (err) {
      return { action: 'ignore', reason: `offline: ${(err as Error).message}` };
    }
  }

  async tutorials(page: string): Promise<Tutorial[]> {
    try {
      const res = await fetch(`${this.base.replace(/\/$/, '')}/tutorials?page=${encodeURIComponent(page)}`);
      return res.ok ? ((await res.json()) as Tutorial[]) : [];
    } catch {
      return [];
    }
  }
}

export function getSessionId(): string {
  const KEY = 'huinuo:session';
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
