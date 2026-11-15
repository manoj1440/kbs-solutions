// S02 — Admin creates Accounts and Managers; Managers create Telecallers; Agent Codes.
import { beginStage, check, eq, denied, get, login, post, put, call, state, save, sql } from './lib.mjs';

beginStage('S02 People');
await login('admin', '9999999999');
const A = 'admin';
/** Re-running the stage on a database that already has the person: reuse them. */
function existing(e, mobile) {
  if (e.status !== 409) throw e;
  const [id, publicRef, employeeCode] = sql(`select id, "publicRef", coalesce("employeeCode",'') from "User" where mobile='+91${mobile}'`).split('|');
  return { id, publicRef, employeeCode };
}
const mk = async (key, role, fullName, mobile) => {
  const u = await post('/users', A, { role, fullName, mobile }).catch((e) => existing(e, mobile)); // re-run safe
  state.users[key] = { key, mobile, id: u.id, role, fullName, publicRef: u.publicRef };
  save();
  return u;
};
await mk('acc', 'ACCOUNTS', 'Asha Accounts', '9800000001');
await mk('m1', 'MANAGER', 'Meera Manager North', '9800000011');
await mk('m2', 'MANAGER', 'Mohan Manager South', '9800000012');
await denied('S02-01', 'A second user with the same mobile is refused', () => post('/users', A, { role: 'MANAGER', fullName: 'Duplicate Person', mobile: '9800000011' }), 409);
await denied('S02-02', 'Admin cannot create an Advisor or Telecaller through "create user" (role not accepted)', () => post('/users', A, { role: 'ADVISOR', fullName: 'Not Allowed', mobile: '9800000099' }), 400);

for (const k of ['acc', 'm1', 'm2']) await login(k, state.users[k].mobile);
check('S02-03', 'Accounts and both Managers can sign in by OTP', ['acc', 'm1', 'm2'].every((k) => state.users[k].token), '');

// Managers create their Telecallers
const mkTc = async (key, mgr, fullName, mobile) => {
  const t = await post('/telecallers', mgr, { fullName, mobile }).catch((e) => existing(e, mobile));
  state.users[key] = { key, mobile, id: t.id, role: 'TELECALLER', fullName, manager: mgr, employeeCode: t.employeeCode ?? t.employee_code ?? null, publicRef: t.publicRef };
  save();
  return t;
};
const t1 = await mkTc('t1', 'm1', 'Tara Telecaller', '9800000021');
await mkTc('t2', 'm1', 'Tarun Telecaller', '9800000022');
await mkTc('t3', 'm2', 'Tina Telecaller', '9800000023');
const codes = rows3('TELECALLER');
function rows3(role) {
  return sql(`select u."fullName", coalesce(u."employeeCode",''), p."fullName" from "User" u
    left join "ReportingAssignment" r on r."childUserId" = u.id and r.status = 'ACTIVE' and r."effectiveTo" is null
    left join "User" p on p.id = r."parentUserId" where u.role='${role}' order by u."fullName"`).split('\n').map((l) => l.split('|'));
}
check('S02-04', 'Each Telecaller gets a generated employee code', codes.length === 3 && codes.every((c) => /^KBS-TC-/.test(c[1])) && new Set(codes.map((c) => c[1])).size === 3, codes.map((c) => c.join(' ')).join('; '));
eq('S02-05', 'Telecallers report to the Manager who created them', codes.map((c) => `${c[0]}→${c[2]}`), ['Tara Telecaller→Meera Manager North', 'Tarun Telecaller→Meera Manager North', 'Tina Telecaller→Mohan Manager South']);
await denied('S02-06', 'Admin cannot create a Telecaller (Manager only, REQ-03)', () => post('/telecallers', A, { fullName: 'Wrong Creator', mobile: '9800000098' }), 403);
await denied('S02-07', 'A Manager cannot create a Manager or Accounts user', () => post('/users', 'm1', { role: 'MANAGER', fullName: 'Not Allowed', mobile: '9800000097' }), 403);

// Agent Codes: Admin issues one per Manager (a chosen code for m1, a generated one for m2)
const code = async (ownerKey, wanted) => {
  const have = sql(`select code from "AgentCode" where "ownerUserId"='${state.users[ownerKey].id}' and "revokedAt" is null limit 1`);
  return have ? { code: have } : post('/agent-codes', A, { ownerUserId: state.users[ownerKey].id, ...(wanted ? { code: wanted } : {}) });
};
const c1 = await code('m1', 'NORTH01');
const c2 = await code('m2');
state.ids.codes = { m1: c1.code, m2: c2.code };
save();
check('S02-08', 'Agent Codes issued: NORTH01 for Manager North, a generated one for Manager South', c1.code === 'NORTH01' && /^[A-Z0-9]{4,12}$/.test(c2.code), `${c1.code}, ${c2.code}`);
await denied('S02-09', 'A Manager cannot issue Agent Codes (Admin does, from People → Agent codes)', () => post('/agent-codes', 'm2', {}), 403);
const mine = await get('/agent-codes', 'm2');
check('S02-10', 'A Manager can read their own Agent Code', JSON.stringify(mine).includes(c2.code) && !JSON.stringify(mine).includes('NORTH01'), JSON.stringify(mine).slice(0, 200));

// who can see whom
const m1Users = await call('GET', '/users?pageSize=100', { as: 'm1', raw: true });
const names = (m1Users.data.items ?? m1Users.data).map((u) => u.fullName).sort();
check('S02-11', "Manager North's user list holds only their own team (no Tina, no other Manager)", names.includes('Tara Telecaller') && names.includes('Tarun Telecaller') && !names.includes('Tina Telecaller') && !names.includes('Mohan Manager South'), names.join(', '));
await denied('S02-12', 'Accounts cannot list users', () => get('/users', 'acc'), 403);
void t1;
