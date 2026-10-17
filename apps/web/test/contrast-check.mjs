// Dev-only WCAG AA text-contrast check on signed-in pages (F-814). Logs in as the demo Admin; disabled controls exempt.
// Usage: node test/contrast-check.mjs   (web on :3000, api on :4000)
import { execSync } from 'node:child_process';
import { chromium } from '@playwright/test';
try { execSync('docker exec kbs-test-pg psql -U kbs -d kbs_dev -qc "DELETE FROM \\"OtpChallenge\\""'); } catch {}
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:3000/login');
await p.locator('input').first().fill('9999999999');
await p.getByRole('button', { name: /otp/i }).click();
await p.getByLabel('Digit 1').waitFor();
for (let i = 1; i <= 6; i++) await p.getByLabel(`Digit ${i}`).fill('0');
await p.getByRole('button', { name: /verify|log in|continue/i }).click().catch(() => {});
await p.waitForURL((u) => !u.pathname.startsWith('/login'));
const pages = ['/admin?period=30d', '/admin/leads', '/admin/mis', '/admin/payouts/requests', '/admin/catalogue', '/admin/config', '/manager/dashboard', '/accounts/reconciliation'];
const all = {};
for (const path of pages) {
  await p.goto('http://localhost:3000' + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const bad = await p.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
    const rgba = (s) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0.5 && !getComputedStyle(e).backgroundImage.includes('gradient')) return c; if (getComputedStyle(e).backgroundImage.includes('gradient')) return null; } return [255, 255, 255]; };
    const out = new Map();
    for (const el of document.querySelectorAll('main *, aside *, header *')) {
      const t = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
      if (!t || el.closest('[aria-hidden=true]')) continue;
      const cs = getComputedStyle(el); if (el.closest(':disabled,[aria-disabled=true]')) continue; if (cs.visibility === 'hidden' || +cs.opacity < 0.5 || el.getBoundingClientRect().width === 0) continue;
      const fg = rgba(cs.color); const bg = bgOf(el); if (!bg) continue;
      const a = fg[3] ?? 1; const mix = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
      const L1 = lum(mix), L2 = lum(bg.slice(0, 3)); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
      if (ratio < (large ? 3 : 4.5)) { const k = `${cs.color} on rgb(${bg.slice(0,3).join(',')}) ${ratio.toFixed(2)}`; out.set(k, (out.get(k) ?? []).concat(t.slice(0, 30))); }
    }
    return [...out.entries()].map(([k, v]) => `${k} ×${v.length} e.g. "${v[0]}"`);
  });
  all[path] = bad;
  console.log(path, bad.length ? '\n  ' + bad.slice(0, 6).join('\n  ') : 'ok');
}
await b.close();
