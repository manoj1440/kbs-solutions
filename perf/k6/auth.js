// F-905: OTP request + verify (login) latency. No threshold is asserted — KBS approves thresholds (REQ-24 §24.2).
import { sleep } from 'k6';

import { ADMIN, login, relaxOtp, restoreOtp } from './lib.js';

export const options = { scenarios: { login: { executor: 'constant-vus', vus: Number(__ENV.VUS || 5), duration: __ENV.DURATION || '30s' } }, summaryTrendStats: ['avg', 'p(50)', 'p(95)', 'p(99)', 'max'], thresholds: { 'http_req_duration{step:otp_request}': ['max>=0'], 'http_req_duration{step:otp_verify}': ['max>=0'] } };
// Telecallers are single-session (a new login revokes the previous one), so they are not in the default pool.
const MOBILES = (__ENV.MOBILES || '9876500001,9555999001,9666600001').split(',');

export function setup() {
  const admin = login(ADMIN);
  const prev = relaxOtp(admin);
  return { admin, prev };
}
export default function () {
  login(MOBILES[(__VU + __ITER) % MOBILES.length]);
  sleep(0.2);
}
export function teardown(d) {
  restoreOtp(d.admin, d.prev);
}
