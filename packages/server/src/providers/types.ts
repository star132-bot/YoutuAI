export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  signal?: AbortSignal;
}

/** 一个可以对话的 AI 后端。新增 AI 只需实现这个接口。 */
export interface LLMProvider {
  readonly id: string;
  complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    readonly providerId: string,
    message: string,
    readonly status?: number,
  ) {
    super(`[${providerId}] ${message}`);
    this.name = 'ProviderError';
  }
}
