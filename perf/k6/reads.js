// F-905: steady-state reads — Telecaller queue fetch, card lookup by pincode, Manager/Admin dashboard refresh.
import { check, sleep } from 'k6';
import http from 'k6/http';

import { ADMIN, BASE, login, relaxOtp, restoreOtp, setConfig } from './lib.js';

export const options = {
  scenarios: {
    queue: { executor: 'constant-vus', exec: 'queue', vus: Number(__ENV.VUS || 5), duration: __ENV.DURATION || '30s' },
    cards: { executor: 'constant-vus', exec: 'cards', vus: Number(__ENV.VUS || 5), duration: __ENV.DURATION || '30s' },
    dashboards: { executor: 'constant-vus', exec: 'dashboards', vus: Math.max(1, Math.floor(Number(__ENV.VUS || 5) / 2)), duration: __ENV.DURATION || '30s' },
  },
  summaryTrendStats: ['avg', 'p(50)', 'p(95)', 'p(99)', 'max'],
  // 'max>=0' never fails: it only makes k6 report each step separately. KBS sets real thresholds (REQ-24 §24.2).
  thresholds: Object.fromEntries(['queue_fetch', 'card_lookup', 'dashboard_manager', 'dashboard_executive', 'dashboard_payouts'].map((s) => [`http_req_duration{step:${s}}`, ['max>=0']])),
};
const TELECALLER = __ENV.TELECALLER_MOBILE || '9776500001';
const MANAGER = __ENV.MANAGER_MOBILE || '9876500001';
const PINCODE = __ENV.PINCODE || '302001';

export function setup() {
  const admin = login(ADMIN);
  const prev = relaxOtp(admin);
  setConfig(admin, 'network.enforceForTelecallers', false); // perf host is not on the office network
  return { admin, prev, telecaller: login(TELECALLER), manager: login(MANAGER) };
}
const get = (path, token, step) => {
  const r = http.get(`${BASE}${path}`, { headers: { authorization: `Bearer ${token}` }, tags: { step } });
  check(r, { [`${step} 200`]: (x) => x.status === 200 });
};
export function queue(d) {
  get('/calling/queue?pageSize=50', d.telecaller, 'queue_fetch');
  sleep(0.5);
}
export function cards(d) {
  get(`/cards/available?pincode=${PINCODE}&channel=ADVISOR`, d.admin, 'card_lookup');
  sleep(0.5);
}
export function dashboards(d) {
  get('/dashboards/manager', d.manager, 'dashboard_manager');
  get('/dashboards/admin/executive', d.admin, 'dashboard_executive');
  get('/dashboards/payouts', d.admin, 'dashboard_payouts');
  sleep(1);
}
export function teardown(d) {
  setConfig(d.admin, 'network.enforceForTelecallers', true);
  restoreOtp(d.admin, d.prev);
}
