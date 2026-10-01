import type { ChatMessage, LLMProvider } from './providers/types';

export interface ProviderStatus {
  id: string;
  healthy: boolean;
  failures: number;
  cooldownUntil: number;
  lastError?: string;
  preferred: boolean;
}

export interface GatewayResult {
  content: string;
  providerId: string;
  /** 本次失败、被跳过的提供商及原因 */
  failed: Array<{ id: string; error: string }>;
}

export interface GatewayOptions {
  /** 第一次失败后的冷却时间，之后每次翻倍 */
  baseCooldownMs?: number;
  maxCooldownMs?: number;
  now?: () => number;
}

interface Health {
  failures: number;
  cooldownUntil: number;
  lastError?: string;
}

export class AllProvidersFailedError extends Error {
  constructor(readonly failed: Array<{ id: string; error: string }>) {
    super(`all AI providers failed: ${failed.map((f) => `${f.id}: ${f.error}`).join('; ')}`);
    this.name = 'AllProvidersFailedError';
  }
}

/**
 * AI 网关：多个 AI 按顺序尝试，出错的进入冷却（熔断），恢复后自动回到队列。
 * 可以手动指定首选 AI；首选不可用时自动切到下一个。
 */
export class AIGateway {
  private readonly health = new Map<string, Health>();
  private preferredId: string | null = null;
  private readonly baseCooldownMs: number;
  private readonly maxCooldownMs: number;
  private readonly now: () => number;

  constructor(
    private readonly providers: LLMProvider[],
    opts: GatewayOptions = {},
  ) {
    if (providers.length === 0) throw new Error('AIGateway needs at least one provider');
    this.baseCooldownMs = opts.baseCooldownMs ?? 30_000;
    this.maxCooldownMs = opts.maxCooldownMs ?? 5 * 60_000;
    this.now = opts.now ?? Date.now;
    for (const p of providers) this.health.set(p.id, { failures: 0, cooldownUntil: 0 });
  }

  setPreferred(id: string | null): void {
    if (id !== null && !this.health.has(id)) throw new Error(`unknown provider: ${id}`);
    this.preferredId = id;
  }

  status(): ProviderStatus[] {
    const now = this.now();
    return this.providers.map((p) => {
      const h = this.health.get(p.id)!;
      return {
        id: p.id,
        healthy: h.cooldownUntil <= now,
        failures: h.failures,
        cooldownUntil: h.cooldownUntil,
        lastError: h.lastError,
        preferred: p.id === this.preferredId,
      };
    });
  }

  /** 尝试顺序：首选 → 其余健康的（按配置顺序）→ 冷却中的（按最快恢复排序，兜底）。 */
  private order(): LLMProvider[] {
    const now = this.now();
    const ordered = [...this.providers].sort((a, b) =>
      a.id === this.preferredId ? -1 : b.id === this.preferredId ? 1 : 0,
    );
    const healthy = ordered.filter((p) => this.health.get(p.id)!.cooldownUntil <= now);
    const cooling = ordered
      .filter((p) => this.health.get(p.id)!.cooldownUntil > now)
      .sort((a, b) => this.health.get(a.id)!.cooldownUntil - this.health.get(b.id)!.cooldownUntil);
    return [...healthy, ...cooling];
  }

  async complete(messages: ChatMessage[], signal?: AbortSignal): Promise<GatewayResult> {
    const failed: Array<{ id: string; error: string }> = [];
    for (const provider of this.order()) {
      if (signal?.aborted) break;
      try {
        const content = await provider.complete(messages, { signal });
        this.health.set(provider.id, { failures: 0, cooldownUntil: 0 });
        return { content, providerId: provider.id, failed };
      } catch (err) {
        const message = (err as Error).message;
        failed.push({ id: provider.id, error: message });
        const h = this.health.get(provider.id)!;
        const failures = h.failures + 1;
        const cooldown = Math.min(this.baseCooldownMs * 2 ** (failures - 1), this.maxCooldownMs);
        this.health.set(provider.id, { failures, cooldownUntil: this.now() + cooldown, lastError: message });
      }
    }
    throw new AllProvidersFailedError(failed);
  }
}
