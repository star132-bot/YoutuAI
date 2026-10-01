import { serve } from '@hono/node-server';
import { createApp } from './app';
import { buildProviders, loadConfig } from './config';

const config = loadConfig();
const providers = buildProviders(config);
const app = createApp({ config, providers, adminToken: process.env.ADMIN_TOKEN });
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, () => {
  console.log(`[huinuo] 灰糯后端已启动 http://localhost:${port}  AI: ${providers.map((p) => p.id).join(' → ')}`);
});
