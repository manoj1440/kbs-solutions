// UAT-01 S14 — the Android app shows the same figures (Maestro flows in apps/mobile/.maestro/uat, release APK on the emulator).
import { execSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beginStage, check, sql } from './lib.mjs';

const SELLS = process.argv.includes('--sells'); // the flows that need stage S15 (a Manager who sells)
const REFS = process.argv.includes('--referrals'); // the flows that need stage S18 (Advisor referral codes)
const FLOWS = join(dirname(fileURLToPath(import.meta.url)), REFS ? '../../../mobile/.maestro/uat-referrals' : SELLS ? '../../../mobile/.maestro/uat-sells' : '../../../mobile/.maestro/uat');
const TITLES = {
  'advisor-a1': 'Advisor Arjun in the app: ₹3,000.00 total earnings, 0 cards to claim, request Paid, own leads only with the bank wording',
  'advisor-a3': 'Advisor Aman in the app: ₹0.00 earned, 1 card to claim, 1 in progress, "Request payout" offered',
  'manager-m1': 'Manager North in the app: team calling card; Advisors list shows Arjun paid 2 (₹3,000.00) and Anita paid 2 (₹2,500.50), no other team',
  'telecaller-t1': 'Telecaller Tara in the app: calling queue, own stats, official ID — and no rupee figure anywhere',
  'manager-m2-sells': 'Manager South in the app: "My sales" opens the selling screens — ₹2,000.00 earned, own leads only — and "Back to team" returns to the team',
  'advisor-a1-team': 'Advisor Arjun in the app: ₹3,300.00 earned; "My team" lists Bina and Chetan; Bina\'s lead opens read-only showing only his own referral share (₹300.00, not her ₹1,200.00); Earnings lists it as a team share on Bina\'s lead',
  'advisor-a2-code': 'Advisor Anita in the app: "My team" shows her Agent Code ANITA01 with a share button and an empty team',
  'manager-m1-not-yet': 'Manager North (has not given their details): "My sales" opens the identity and bank steps, with a way back to the team',
};
const STAGE = REFS ? 'S20 App screens — Advisor referral codes' : SELLS ? 'S17 App screens — Manager sells' : 'S14 App screens';
beginStage(STAGE);
try { execSync('maestro --version', { stdio: 'ignore' }); } catch { console.log('  (maestro not installed — skipped)'); process.exit(0); }
let n = 0;
for (const f of readdirSync(FLOWS).filter((x) => x.endsWith('.yaml')).sort()) {
  const key = f.replace('.yaml', '');
  sql('DELETE FROM "OtpChallenge"'); // test-only: resend cooldown / hourly limit
  const r = spawnSync('maestro', ['test', join(FLOWS, f)], { encoding: 'utf8' });
  const failed = (r.stdout + r.stderr).split('\n').filter((l) => /FAILED|Assertion is false/.test(l)).join(' ').slice(0, 300);
  check(`${REFS ? 'S20' : SELLS ? 'S17' : 'S14'}-${String(++n).padStart(2, '0')}`, TITLES[key] ?? key, r.status === 0, failed);
}
