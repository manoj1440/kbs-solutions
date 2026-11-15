// S03 — Telecallers do the 72-hour training: video, then questions, three modules in order.
import { beginStage, check, eq, denied, get, login, post, call, state, save, sql } from './lib.mjs';

beginStage('S03 Training');
await login('admin', '9999999999');
for (const k of ['m1', 'm2', 't1', 't2', 't3']) await login(k, state.users[k].mobile);

const me = (k) => get('/training/me', k);
const video = (k, n) => post(`/training/modules/${n}/video-progress`, k, { positionSec: 60, durationSec: 60, completed: true });
/** Opens an attempt and answers it: `right` answers correctly with key A, otherwise B. Returns the result. */
async function attempt(k, n, right = true) {
  const a = await post(`/training/modules/${n}/attempts`, k, {});
  const answers = Object.fromEntries(a.questions.map((q) => [q.id, right ? 'A' : 'B']));
  return post(`/training/attempts/${a.attemptId ?? a.id}/submit`, k, { answers });
}

// before training: gate + no customers
const t1Before = await me('t1');
check('S03-01', 'A new Telecaller starts with training required and a 72-hour deadline', state.users.t1.gates?.training?.required === true && !!t1Before.deadlineAt, { gate: state.users.t1.gates?.training, deadlineAt: t1Before.deadlineAt, status: t1Before.status });
await denied('S03-02', 'No calling queue before training is passed', () => get('/calling/queue', 't1'), 403);
await denied('S03-03', 'Module 2 cannot be started before Module 1 is passed', () => post('/training/modules/2/attempts', 't1', {}), 403, 'TRAINING_MODULE_LOCKED');
await denied('S03-04', 'The questions cannot be opened before the video is watched', () => post('/training/modules/1/attempts', 't1', {}), 400);

// t1: straight pass
for (const n of [1, 2, 3]) { await video('t1', n); const r = await attempt('t1', n); if (n === 1) check('S03-05', 'A fully correct attempt scores 100% and passes the module', r.scorePct === 100 && r.passed === true, r); }
const t1After = await me('t1');
check('S03-06', 'After three passed modules the Telecaller is Passed', t1After.status === 'PASSED', t1After.status);
await login('t1', state.users.t1.mobile);
check('S03-07', 'On the next sign-in the training gate is cleared', state.users.t1.gates?.training?.passed === true && state.users.t1.gates?.training?.reason === null, state.users.t1.gates?.training);
await denied('S03-08', 'A passed module cannot be attempted again', () => post('/training/modules/1/attempts', 't1', {}), 409);

// t2: straight pass
for (const n of [1, 2, 3]) { await video('t2', n); await attempt('t2', n); }
eq('S03-09', 'Second Telecaller of Manager North also passes', (await me('t2')).status, 'PASSED');

// t3: fails module 1 (all wrong), retries and passes module 1 only — finishes after the calling list is allocated (S05)
await video('t3', 1);
const fail = await attempt('t3', 1, false);
check('S03-10', 'An all-wrong attempt scores 0% and does not pass (pass mark 70%)', fail.scorePct === 0 && fail.passed === false, fail);
const pass = await attempt('t3', 1, true);
check('S03-11', 'The module can be retried and then passes', pass.passed === true, pass);
const t3 = await me('t3');
check('S03-12', 'Telecaller 3 is in progress: module 1 passed, 2 open, 3 locked', t3.status !== 'PASSED' && t3.modules?.[0]?.status === 'PASSED' && t3.modules?.[2]?.status === 'LOCKED', (t3.modules ?? []).map((m) => m.status).join(','));

// oversight
const team1 = await get('/training/team', 'm1');
const names1 = (team1.items ?? team1).map((r) => `${r.fullName ?? r.name}:${r.status ?? r.trainingStatus}`).sort();
check('S03-13', 'Manager North sees the training status of their two Telecallers only', names1.length === 2 && names1.every((n) => /PASSED/.test(n)), names1.join(', '));
const teamAll = await get('/training/team', 'admin');
check('S03-14', 'Admin sees all three Telecallers with attempts and best scores', (teamAll.items ?? teamAll).length === 3, JSON.stringify(teamAll).slice(0, 300));
await denied('S03-15', "Manager South cannot read Manager North's Telecaller training", () => get(`/telecallers/${state.users.t1.id}/training`, 'm2'), [403, 404]);
const attempts = sql(`select count(*) from "TrainingAttempt"`);
eq('S03-16', 'Every attempt is stored (3 + 3 + 2)', attempts, '8');
