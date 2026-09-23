// F-905: MIS import end-to-end for a large HDFC sheet (default the 100k-row file from gen-mis.mjs):
// upload → create batch → preview (parse + match) → apply. Records each phase as its own trend.
import { check, fail } from 'k6';
import http from 'k6/http';
import { Trend } from 'k6/metrics';

import { ADMIN, BASE, authz, login } from './lib.js';

export const options = { iterations: 1, vus: 1, setupTimeout: '60s', summaryTrendStats: ['avg', 'max'] };
const FILE = open(__ENV.MIS_FILE || './mis-100k.xlsx', 'b');
const t = { upload: new Trend('mis_upload_ms', true), preview: new Trend('mis_preview_ms', true), apply: new Trend('mis_apply_ms', true) };

export default function () {
  const admin = login(ADMIN);
  const banks = http.get(`${BASE}/catalogue/banks`, { headers: { authorization: `Bearer ${admin}` } }).json('data');
  const hdfc = banks.find((b) => b.code === 'HDFC');
  const profile = http.get(`${BASE}/mis/profiles`, { headers: { authorization: `Bearer ${admin}` } }).json('data').find((p) => p.bankId === hdfc.id || (p.bank && p.bank.id === hdfc.id));
  if (!profile) fail('no HDFC MIS profile');
  let r = http.post(`${BASE}/files/mis`, { file: http.file(FILE, `perf-${Date.now()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') }, { headers: { authorization: `Bearer ${admin}` }, timeout: '600s' });
  t.upload.add(r.timings.duration);
  if (!check(r, { uploaded: (x) => x.status === 201 })) fail(`upload ${r.status} ${r.body}`);
  r = http.post(`${BASE}/mis/batches`, JSON.stringify({ bankId: hdfc.id, profileId: profile.id, fileId: r.json('data.id') }), { ...authz(admin), timeout: '600s' });
  if (!check(r, { batch: (x) => x.status === 201 })) fail(`batch ${r.status} ${r.body}`);
  const id = r.json('data.id');
  r = http.post(`${BASE}/mis/batches/${id}/preview`, null, { ...authz(admin), timeout: '1800s' });
  t.preview.add(r.timings.duration);
  if (!check(r, { preview: (x) => x.status === 201 })) fail(`preview ${r.status} ${r.body}`);
  r = http.post(`${BASE}/mis/batches/${id}/apply`, null, { ...authz(admin), timeout: '1800s' });
  t.apply.add(r.timings.duration);
  check(r, { apply: (x) => x.status === 201 });
}
