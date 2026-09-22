import 'reflect-metadata';

import { createApp } from './bootstrap';
import { loadEnv } from './config/env';

async function main() {
  const env = loadEnv();
  const app = await createApp();
  if (env.WORKER_MODE) {
    // Worker mode: processors only (registered by feature modules in F-2xx+). No HTTP listener.
    await app.init();
     
    console.warn('[api] worker mode started (no HTTP)');
    return;
  }
  await app.listen(env.API_PORT);
   
  console.warn(`[api] listening on :${env.API_PORT} (${env.NODE_ENV})`);
}

main().catch((e) => {
   
  console.error(e);
  process.exit(1);
});
