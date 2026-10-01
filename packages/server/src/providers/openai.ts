import { ProviderError, type ChatMessage, type CompleteOptions, type LLMProvider } from './types';

export interface OpenAICompatibleConfig {
  id: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
  /** 服务支持 response_format: json_object 时打开，回复更稳定 */
  jsonMode?: boolean;
}

/**
 * OpenAI 兼容接口（/chat/completions）。
 * DeepSeek、通义千问、Moonshot、各类中转站等大多数服务都能直接用。
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: string;

  constructor(
    private readonly cfg: OpenAICompatibleConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.id = cfg.id;
  }

  async complete(messages: ChatMessage[], opts: CompleteOptions = {}): Promise<string> {
    const timeout = AbortSignal.timeout(this.cfg.timeoutMs ?? 20_000);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          messages,
          temperature: this.cfg.temperature ?? 0.8,
          max_tokens: this.cfg.maxTokens ?? 400,
          ...(this.cfg.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal,
      });
    } catch (err) {
      const reason = timeout.aborted ? 'timeout' : (err as Error).message;
      throw new ProviderError(this.id, `request failed: ${reason}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ProviderError(this.id, `HTTP ${res.status} ${body.slice(0, 200)}`, res.status);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ProviderError(this.id, 'empty response');
    }
    return content;
  }
}
