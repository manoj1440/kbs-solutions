// UAT-01 S14 — the Android app shows the same figures (Maestro flows in apps/mobile/.maestro/uat, release APK on the emulator).
import { execSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beginStage, check, sql } from './lib.mjs';

const FLOWS = join(dirname(fileURLToPath(import.meta.url)), '../../../mobile/.maestro/uat');
const TITLES = {
  'advisor-a1': 'Advisor Arjun in the app: ₹3,000.00 total earnings, 0 cards to claim, request Paid, own leads only with the bank wording',
  'advisor-a3': 'Advisor Aman in the app: ₹0.00 earned, 1 card to claim, 1 in progress, "Request payout" offered',
  'manager-m1': 'Manager North in the app: team calling card; Advisors list shows Arjun paid 2 (₹3,000.00) and Anita paid 2 (₹2,500.50), no other team',
  'telecaller-t1': 'Telecaller Tara in the app: calling queue, own stats, official ID — and no rupee figure anywhere',
};
beginStage('S14 App screens');
try { execSync('maestro --version', { stdio: 'ignore' }); } catch { console.log('  (maestro not installed — skipped)'); process.exit(0); }
let n = 0;
for (const f of readdirSync(FLOWS).filter((x) => x.endsWith('.yaml')).sort()) {
  const key = f.replace('.yaml', '');
  sql('DELETE FROM "OtpChallenge"'); // test-only: resend cooldown / hourly limit
  const r = spawnSync('maestro', ['test', join(FLOWS, f)], { encoding: 'utf8' });
  const failed = (r.stdout + r.stderr).split('\n').filter((l) => /FAILED|Assertion is false/.test(l)).join(' ').slice(0, 300);
  check(`S14-${String(++n).padStart(2, '0')}`, TITLES[key] ?? key, r.status === 0, failed);
}
