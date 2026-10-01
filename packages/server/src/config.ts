import { readFileSync, existsSync } from 'node:fs';
import type { Tutorial } from '@huinuo/shared';
import { MockProvider } from './providers/mock';
import { OpenAICompatibleProvider } from './providers/openai';
import type { LLMProvider } from './providers/types';

export type ProviderConfig =
  | {
      id: string;
      type: 'openai';
      baseUrl: string;
      model: string;
      /** 存放 Key 的环境变量名（Key 本身不写进配置文件） */
      apiKeyEnv: string;
      timeoutMs?: number;
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
      enabled?: boolean;
    }
  | { id: string; type: 'mock'; enabled?: boolean };

export interface KnowledgeEntry {
  title: string;
  keywords?: string[];
  content: string;
}

export interface HuinuoConfig {
  providers: ProviderConfig[];
  knowledge: KnowledgeEntry[];
  tutorials: Tutorial[];
  jev: {
    /** 用户在页面停留多少秒没操作，就主动问要不要帮忙 */
    idleSeconds: number;
    /** 直播弹幕：每隔多少毫秒最多回复一条 */
    youtubeReplyIntervalMs: number;
    /** 弹幕屏蔽词 */
    blockedWords: string[];
  };
  /** 允许嵌入灰糯的网站来源，["*"] 表示全部 */
  allowedOrigins: string[];
}

export const DEFAULT_CONFIG: HuinuoConfig = {
  providers: [{ id: 'mock', type: 'mock' }],
  knowledge: [],
  tutorials: [],
  jev: { idleSeconds: 30, youtubeReplyIntervalMs: 8000, blockedWords: [] },
  allowedOrigins: ['*'],
};

export function loadConfig(path = process.env.HUINUO_CONFIG ?? 'config/huinuo.config.json'): HuinuoConfig {
  const candidates = [path, `../../${path}`, 'config/huinuo.config.example.json', '../../config/huinuo.config.example.json'];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    console.warn('[huinuo] no config file found, using offline mock AI');
    return DEFAULT_CONFIG;
  }
  const raw = JSON.parse(readFileSync(found, 'utf8')) as Partial<HuinuoConfig>;
  console.log(`[huinuo] config: ${found}`);
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    jev: { ...DEFAULT_CONFIG.jev, ...raw.jev },
  };
}

export function buildProviders(cfg: HuinuoConfig, env: NodeJS.ProcessEnv = process.env): LLMProvider[] {
  const providers: LLMProvider[] = [];
  for (const p of cfg.providers) {
    if (p.enabled === false) continue;
    if (p.type === 'mock') {
      providers.push(new MockProvider(p.id));
      continue;
    }
    const apiKey = env[p.apiKeyEnv];
    if (!apiKey) {
      console.warn(`[huinuo] provider "${p.id}" skipped: env ${p.apiKeyEnv} is empty`);
      continue;
    }
    providers.push(new OpenAICompatibleProvider({ ...p, apiKey }));
  }
  if (providers.length === 0) {
    console.warn('[huinuo] no usable AI provider, falling back to offline mock AI');
    providers.push(new MockProvider());
  }
  return providers;
}
