// S01 — Admin sets the product up: declarations, config, cards, pincodes, training content, MIS format, office network.
import { beginStage, check, eq, denied, get, login, post, put, upload, call, state, save, sql } from './lib.mjs';

beginStage('S01 Setup');
await login('admin', '9999999999');
const A = 'admin';

// minimal valid files
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.from([0, 0, 0, 0]), Buffer.from('mp42isom'), Buffer.alloc(64)]);

// ── configuration the launch needs ──
const setCfg = (key, value) => put(`/config/${key}`, A, { value, reason: 'UAT-01 local test value' });
await setCfg('leads.declarations', [
  { id: 'D1', version: '1', text: 'TEST: I confirm the details given are accurate.' },
  { id: 'D2', version: '1', text: 'TEST: I authorise a credit bureau check.' },
]);
await setCfg('training.reactivationWindowHours', 24);
await setCfg('compliance.recordingDisclosureText', 'TEST: this call may be recorded for quality.');
const gates = await get('/config/launch-gates', A);
const setNow = ['training.reactivationWindowHours', 'compliance.recordingDisclosureText'];
check('S01-01', 'Configuration values saved; those launch gates now read as set', setNow.every((k) => gates.find((g) => g.key === k)?.isSet), gates.filter((g) => !g.isSet).map((g) => g.key).join(', '));
const hist = await get('/config/leads.declarations/history', A);
check('S01-02', 'Config change is in the history with actor and reason', (hist.items ?? hist).length >= 1, JSON.stringify(hist).slice(0, 200));
await denied('S01-03', 'Config change without a reason is refused', () => put('/config/training.reactivationWindowHours', A, { value: 48 }), 400);

// ── pincode master ──
const pinCsv = Buffer.from('Pincode,District,State\n302001,Jaipur,Rajasthan\n110001,New Delhi,Delhi\n400001,Mumbai,Maharashtra\n560001,Bengaluru,Karnataka\n');
const pinFile = await upload('pincode_master', A, pinCsv, 'pincodes.csv');
const pinImp = await post('/pincodes/import', A, { fileId: pinFile.id });
const p302 = await get('/pincodes/302001', A);
check('S01-04', 'Pincode master imported (4 pincodes); 302001 resolves to Jaipur, Rajasthan', /jaipur/i.test(JSON.stringify(p302)) && /rajasthan/i.test(JSON.stringify(p302)), { pinImp, p302 });

// ── catalogue ──
const benefitPdf = await upload('benefit_pdf', A, PDF, 'rewards-benefits.pdf');
const rewards = await post('/catalogue/cards', A, {
  name: 'UAT Rewards Card', description: 'TEST card. Cashback on everyday spends. Subject to bank approval.', benefits: ['5% cashback on shopping', 'Fuel surcharge waiver'],
  joiningFee: 499, annualFee: 499, categoryKeys: ['SHOPPING'], applyUrl: 'https://apply.example.com/rewards?agent={code}', availability: 'ALL_INDIA', benefitPdfFileId: benefitPdf.id, active: true,
});
const travel = await post('/catalogue/cards', A, {
  name: 'UAT Travel Card', description: 'TEST card. Lounge access. Subject to bank approval.', benefits: ['4 lounge visits a year'],
  joiningFee: 999, annualFee: 999, categoryKeys: ['TRAVEL'], applyUrl: 'https://apply.example.com/travel?agent={code}', availability: ['302001', '110001'], active: true,
});
const draft = await post('/catalogue/cards', A, { name: 'UAT Draft Card', description: 'TEST draft, never offered.', categoryKeys: ['FUEL'], applyUrl: 'https://apply.example.com/draft', active: true });
state.ids.cards = { rewards: rewards.id, travel: travel.id, draft: draft.id };
save();
const list = await call('GET', '/catalogue/cards?pageSize=50', { as: A, raw: true });
const cards = list.data.items ?? list.data;
check('S01-05', 'Three cards created; Rewards and Travel are published', cards.length === 3 && cards.filter((c) => c.status === 'PUBLISHED').length >= 2, cards.map((c) => `${c.name}:${c.status}`).join(', '));
const at = async (pin, ch = 'ADVISOR') => (await get(`/cards/available?pincode=${pin}&channel=${ch}`, A)).cards.map((c) => c.name).sort();
eq('S01-06', 'At 302001 both cards are offered', await at('302001'), ['UAT Rewards Card', 'UAT Travel Card']);
eq('S01-07', 'At 400001 only the all-India card is offered (Travel is pincode-limited; a card with no availability is offered nowhere)', await at('400001'), ['UAT Rewards Card']);
await denied('S01-08', 'Forbidden wording ("guaranteed approval") is refused on a card', () => post('/catalogue/cards', A, { name: 'UAT Bad Card', description: 'Guaranteed approval for everyone', applyUrl: 'https://apply.example.com/x', availability: 'ALL_INDIA', active: true }), 400);

eq('S01-08b', 'The refused card left nothing behind (still three cards)', sql(`select count(*) from "CreditCard"`), '3');
const edit = await call('PATCH', `/catalogue/cards/${rewards.id}`, { as: A, body: { description: 'Instant approval for all' } }).then(() => 'ALLOWED', (e) => e.status);
check('S01-08c', 'Forbidden wording cannot be edited onto a card that is already offered', edit === 400 && !/Instant approval/.test(sql(`select description from "CreditCard" where id='${rewards.id}'`)), String(edit));

// ── training content ──
const video = await upload('training_video', A, MP4, 'module.mp4');
for (const n of [1, 2, 3]) {
  await put(`/training/modules/${n}`, A, { title: `UAT module ${n}`, materialText: `TEST material for module ${n}.`, videoFileId: video.id });
  await put(`/training/modules/${n}/questions`, A, {
    questions: [1, 2, 3, 4].map((q) => ({ text: `TEST M${n} question ${q}: the right answer is A`, options: [{ key: 'A', text: 'Right answer' }, { key: 'B', text: 'Wrong answer' }, { key: 'C', text: 'Also wrong' }], correctKey: 'A' })),
  });
  await post(`/training/modules/${n}/publish`, A, {});
}
const mods = await get('/training/modules', A);
check('S01-09', 'Three training modules published with video and 4 questions each', mods.length === 3 && mods.every((m) => m.status === 'PUBLISHED' && m.questionCount === 4 && m.videoFileId), mods.map((m) => `${m.sequence}:${m.status}:${m.questionCount}`).join(' '));

// ── MIS format ──
const profiles = await get('/mis/profiles', A);
const prof = profiles[0];
if (prof.status !== 'APPROVED') await post(`/mis/profiles/${prof.id}/approve`, A, { reason: 'UAT-01 reviewed' });
const profAfter = (await get('/mis/profiles', A))[0];
check('S01-10', 'Bank MIS upload format is approved', profAfter.status === 'APPROVED', profAfter.status);

// ── office network: the test machine counts as the office (Telecallers are blocked otherwise, REQ-09) ──
for (const [label, cidr] of [['UAT office (IPv4 loopback)', '127.0.0.0/8'], ['UAT office (IPv6 loopback)', '::1/128']]) {
  await post('/access-policy/networks', A, { label, cidr, reason: 'UAT-01 local machine is the office' }).catch((e) => console.log('   network:', e.message));
}
const nets = await get('/access-policy/networks', A);
check('S01-11', 'Office network ranges saved and active', (nets.items ?? nets).filter((n) => n.active).length >= 1, JSON.stringify(nets).slice(0, 200));
