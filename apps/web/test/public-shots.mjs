// Dev-only visual sweep of signed-out screens (login, status screens, public ID verify). F-814.
// Usage: node test/public-shots.mjs <outDir>   (BASE defaults to http://localhost:3000)
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const out = process.argv[2];
for (const w of [1440, 390]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage();
  for (const path of ['/login', '/login?reason=expired', '/access-denied', '/session', '/no-such-page', '/verify/KBS-TC-1VW3ZEDS', '/verify/NOPE']) {
    await p.goto((process.env.BASE ?? 'http://localhost:3000') + path, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(500);
    const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const name = path.replace(/[/?=]/g, '_');
    await p.screenshot({ path: `${out}/${w}${name}.png`, fullPage: true });
    console.log(w, path, '->', new URL(p.url()).pathname, 'overflow', o);
  }
}
await b.close();
