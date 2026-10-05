/**
 * End-to-end test of the investment platform API.
 *
 * Runs against a THROWAWAY database - never point it at real data.
 *
 *   1. Start the API on a test database, capturing its log:
 *        PORT=5055 DB_NAME=moon_tech_invest_test RATE_LIMIT_MAX=100000 npx tsx src/server.ts > e2e-server.log 2>&1
 *   2. In another terminal (from backend/node):
 *        node scripts/e2e-investment.mjs
 *
 * The database must be freshly seeded: drop it between runs.
 */
import fs from 'fs';
import mysql from 'mysql2/promise';

const BASE = process.env.E2E_BASE || 'http://localhost:5055/api';
const DB_NAME = process.env.E2E_DB || 'moon_tech_invest_test';
const SERVER_LOG = process.env.E2E_SERVER_LOG || './e2e-server.log';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL ${name} ${detail !== undefined ? '-> ' + JSON.stringify(detail) : ''}`);
  }
}

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  return { status: res.status, body: data, type };
}

async function login(email, password = 'Admin@123456') {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  if (!r.body.success) throw new Error(`login failed for ${email}: ${JSON.stringify(r.body)}`);
  return { token: r.body.data.accessToken, id: r.body.data.user.id };
}

function depositForm(amount, utr, withFile = true) {
  const form = new FormData();
  form.append('amount', String(amount));
  form.append('upiTransactionId', utr);
  if (withFile) form.append('receipt', new Blob([PNG], { type: 'image/png' }), 'receipt.png');
  return form;
}

const near = (a, b) => Math.abs(a - b) < 0.001;
const uniq = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const db = await mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: DB_NAME,
});

const cust = await login('vikram.singh@example.com');
const cust2 = await login('priya.patel@example.com');
const admin = await login('admin@moontech.com');
const editor = await login('editor@moontech.com');

console.log('\n== Wallet & deposits ==');
let r = await call('GET', '/wallet', { token: cust.token });
check('wallet starts at 0', r.status === 200 && r.body.data.balance === 0, r.body);
check('wallet config present', r.body.data.config?.minTopup === 500 && r.body.data.config?.maxTopup === 200000, r.body.data?.config);

r = await call('GET', '/wallet', { token: admin.token });
check('staff cannot use customer wallet', r.status === 403, r.status);
r = await call('GET', '/wallet');
check('wallet requires auth', r.status === 401, r.status);

r = await call('POST', '/wallet/deposits', { token: cust.token, form: depositForm(100, `UTR${uniq()}1`) });
check('deposit below minimum rejected', r.status === 400, r.body);
r = await call('POST', '/wallet/deposits', { token: cust.token, form: depositForm(200001, `UTR${uniq()}2`) });
check('deposit above maximum rejected', r.status === 400, r.body);
r = await call('POST', '/wallet/deposits', { token: cust.token, form: depositForm(1000, `UTR${uniq()}3`, false) });
check('deposit without receipt rejected', r.status === 400, r.body);
r = await call('POST', '/wallet/deposits', { token: cust.token, form: depositForm(1000, 'bad utr!') });
check('invalid UTR rejected (422)', r.status === 422, r.body);
r = await call('POST', '/wallet/deposits', { token: cust.token, form: depositForm(1000.555, `UTR${uniq()}4`) });
check('3-decimal amount rejected (422)', r.status === 422, r.body);
r = await call('POST', '/wallet/deposits', { token: cust.token, form: depositForm(-50, `UTR${uniq()}5`) });
check('negative amount rejected (422)', r.status === 422, r.body);

const utr1 = `UTR${uniq()}A`;
r = await call('POST', '/wallet/deposits', { token: cust.token, form: depositForm(10000, utr1) });
check('valid deposit accepted as PENDING', r.status === 201 && r.body.data.status === 'PENDING', r.body);
const dep1 = r.body.data;
check('deposit reference format', /^DEP-\d{8}-[0-9A-F]{10}$/.test(dep1.reference), dep1.reference);
const createdMs = new Date(dep1.createdAt).getTime();
check('createdAt is a correct UTC timestamp', Math.abs(Date.now() - createdMs) < 120000, dep1.createdAt);

r = await call('GET', '/wallet', { token: cust.token });
check('wallet NOT credited before verification', r.body.data.balance === 0 && r.body.data.pendingDepositAmount === 10000, r.body.data);

r = await call('POST', '/wallet/deposits', { token: cust2.token, form: depositForm(5000, utr1) });
check('duplicate UTR rejected (409)', r.status === 409, r.body);

r = await call('GET', `/wallet/deposits/${dep1.id}/receipt`, { token: cust.token });
check('owner can view receipt', r.status === 200 && r.type.includes('image/jpeg'), r.type);
r = await call('GET', `/wallet/deposits/${dep1.id}/receipt`, { token: cust2.token });
check('other customer cannot view receipt', r.status === 403, r.status);

r = await call('POST', `/admin/deposits/${dep1.id}/approve`, { token: editor.token, body: {} });
check('editor cannot approve payment', r.status === 403, r.status);
r = await call('POST', `/admin/deposits/${dep1.id}/approve`, { token: cust.token, body: {} });
check('customer cannot approve payment', r.status === 403, r.status);
r = await call('GET', '/admin/deposits?status=PENDING', { token: editor.token });
check('editor can list payments', r.status === 200 && r.body.data.length >= 1 && r.body.meta.counts.pending >= 1, r.body.meta);
check('admin list shows customer details', r.body.data[0].customerEmail === 'vikram.singh@example.com', r.body.data[0]);

// Concurrent double approval must credit once
const [a1, a2] = await Promise.all([
  call('POST', `/admin/deposits/${dep1.id}/approve`, { token: admin.token, body: { remarks: 'ok' } }),
  call('POST', `/admin/deposits/${dep1.id}/approve`, { token: admin.token, body: { remarks: 'ok' } }),
]);
check('concurrent approvals: exactly one succeeds', [a1.status, a2.status].sort().join() === '200,400', [a1.status, a2.status]);
r = await call('GET', '/wallet', { token: cust.token });
check('wallet credited exactly once', r.body.data.balance === 10000, r.body.data.balance);

r = await call('POST', `/admin/deposits/${dep1.id}/reject`, { token: admin.token, body: { reason: 'too late now' } });
check('approved payment cannot be rejected', r.status === 400, r.body);

r = await call('POST', '/wallet/deposits', { token: cust.token, form: depositForm(2000, `UTR${uniq()}B`) });
const dep2 = r.body.data;
r = await call('POST', `/admin/deposits/${dep2.id}/reject`, { token: admin.token, body: { reason: 'no' } });
check('reject requires a real reason (422)', r.status === 422, r.body);
r = await call('POST', `/admin/deposits/${dep2.id}/reject`, { token: admin.token, body: { reason: 'UTR not found in bank statement' } });
check('payment rejected', r.status === 200 && r.body.data.status === 'REJECTED', r.body);
r = await call('GET', '/wallet', { token: cust.token });
check('rejected payment does not credit wallet', r.body.data.balance === 10000, r.body.data.balance);

console.log('\n== Plans ==');
r = await call('GET', '/investment-plans');
check('public plans list', r.status === 200 && r.body.data.length === 4, r.body.data?.length);
const growth = r.body.data.find((p) => p.name === 'Growth 90');
const fixed = r.body.data.find((p) => p.name === 'Fixed Bonus 60');

r = await call('POST', '/admin/investment-plans', {
  token: admin.token,
  body: { name: 'Bad', minAmount: 5000, maxAmount: 1000, durationDays: 10, profitType: 'PERCENTAGE', profitValue: 5 },
});
check('plan with max < min rejected', r.status === 400, r.body);
r = await call('POST', '/admin/investment-plans', {
  token: editor.token,
  body: { name: 'Ed', minAmount: 100, maxAmount: 1000, durationDays: 10, profitType: 'PERCENTAGE', profitValue: 5 },
});
check('editor cannot create plan', r.status === 403, r.status);
r = await call('POST', '/admin/investment-plans', {
  token: admin.token,
  body: { name: 'Test 7', minAmount: 100, maxAmount: 1000, durationDays: 7, profitType: 'PERCENTAGE', profitValue: 2.5 },
});
check('plan created', r.status === 201 && r.body.data.profitValue === 2.5, r.body);
const testPlan = r.body.data;
r = await call('PUT', `/admin/investment-plans/${testPlan.id}`, { token: admin.token, body: { maxAmount: 50 } });
check('plan update with max < min rejected', r.status === 400, r.body);
r = await call('PATCH', `/admin/investment-plans/${testPlan.id}/status`, { token: admin.token, body: { isActive: false } });
check('plan deactivated', r.status === 200 && r.body.data.isActive === false, r.body);
r = await call('POST', '/investments', { token: cust.token, body: { planId: testPlan.id, amount: 500 } });
check('cannot invest in inactive plan', r.status === 400, r.body);
r = await call('DELETE', `/admin/investment-plans/${testPlan.id}`, { token: admin.token });
check('unused plan deleted', r.status === 200, r.body);

console.log('\n== Featured plans ==');
r = await call('GET', '/investment-plans/featured');
check('seeded featured plans (2, in sort order)', r.status === 200 && r.body.data.length === 2 && r.body.data[0].name === 'Starter 30' && r.body.data[1].isFeatured === true, r.body.data?.map((p) => p.name));
check('featured tagline returned', typeof r.body.data[0].featuredTagline === 'string' && r.body.data[0].featuredTagline.length > 0, r.body.data[0]);
r = await call('PATCH', `/admin/investment-plans/${fixed.id}/featured`, { token: editor.token, body: { isFeatured: true } });
check('editor cannot feature a plan', r.status === 403, r.status);
r = await call('PATCH', `/admin/investment-plans/${fixed.id}/featured`, { token: admin.token, body: { isFeatured: true, featuredTagline: 'Fixed profit, no surprises.' } });
check('admin features a plan with tagline', r.status === 200 && r.body.data.isFeatured === true && r.body.data.featuredTagline === 'Fixed profit, no surprises.', r.body);
r = await call('GET', '/investment-plans/featured');
check('featured list now has 3', r.body.data.length === 3, r.body.data?.length);
r = await call('PATCH', `/admin/investment-plans/${fixed.id}/status`, { token: admin.token, body: { isActive: false } });
r = await call('GET', '/investment-plans/featured');
check('inactive plans are not featured publicly', r.body.data.length === 2 && !r.body.data.some((p) => p.id === fixed.id), r.body.data?.length);
await call('PATCH', `/admin/investment-plans/${fixed.id}/status`, { token: admin.token, body: { isActive: true } });
r = await call('PATCH', `/admin/investment-plans/${fixed.id}/featured`, { token: admin.token, body: { isFeatured: false } });
check('admin unfeatures a plan', r.status === 200 && r.body.data.isFeatured === false, r.body);
r = await call('PUT', `/admin/investment-plans/${growth.id}`, { token: admin.token, body: { featuredTagline: 'x'.repeat(200) } });
check('tagline longer than 160 chars rejected (422)', r.status === 422, r.status);
r = await call('GET', '/admin/investment-plans', { token: admin.token });
check('admin plan list exposes featured flags', r.body.data.filter((p) => p.isFeatured).length === 2, r.body.data?.map((p) => [p.name, p.isFeatured]));

console.log('\n== Investing ==');
r = await call('POST', '/investments/preview', { token: cust.token, body: { planId: growth.id, amount: 5000 } });
check('preview: 10% of 5000 = 500', r.status === 200 && r.body.data.expectedProfit === 500 && r.body.data.maturityAmount === 5500, r.body.data);
const prevDays = (new Date(r.body.data.maturityDate) - new Date(r.body.data.startDate)) / 86400000;
check('preview: maturity date = start + 90 days', near(prevDays, 90), prevDays);
r = await call('POST', '/investments/preview', { token: cust.token, body: { planId: fixed.id, amount: 12345.67 } });
check('preview: fixed profit 1200', r.body.data?.expectedProfit === 1200 && near(r.body.data.maturityAmount, 13545.67), r.body.data);

r = await call('POST', '/investments', { token: cust.token, body: { planId: growth.id, amount: 1000 } });
check('investment below plan minimum rejected', r.status === 400, r.body);
r = await call('POST', '/investments', { token: cust.token, body: { planId: growth.id, amount: 300000 } });
check('investment above plan maximum rejected', r.status === 400, r.body);
r = await call('POST', '/investments', { token: cust.token, body: { planId: growth.id, amount: 50000 } });
check('investment above wallet balance rejected', r.status === 400 && /Insufficient/.test(r.body.message), r.body);
r = await call('GET', '/investments', { token: cust.token });
check('failed investment left no record', r.body.data.length === 0, r.body.data.length);
r = await call('POST', '/investments', { token: admin.token, body: { planId: growth.id, amount: 5000 } });
check('staff cannot invest', r.status === 403, r.status);

// Two simultaneous 6000 investments against a 10000 balance: only one may succeed
const [i1, i2] = await Promise.all([
  call('POST', '/investments', { token: cust.token, body: { planId: growth.id, amount: 6000 } }),
  call('POST', '/investments', { token: cust.token, body: { planId: growth.id, amount: 6000 } }),
]);
check('concurrent investments: exactly one succeeds', [i1.status, i2.status].sort().join() === '201,400', [i1.status, i2.status, i1.body.message, i2.body.message]);
r = await call('GET', '/wallet', { token: cust.token });
check('balance 4000 after one 6000 investment', r.body.data.balance === 4000 && r.body.data.investedAmount === 6000, r.body.data);
const inv1 = (i1.status === 201 ? i1 : i2).body.data;
check('investment terms calculated', inv1.expectedProfit === 600 && inv1.maturityAmount === 6600 && inv1.status === 'ACTIVE', inv1);
check('investment reference format', /^INV-\d{8}-[0-9A-F]{10}$/.test(inv1.reference), inv1.reference);
check('active investment not withdrawable', inv1.canRequestWithdrawal === false && inv1.daysRemaining === 90, inv1);

console.log('\n== Withdrawal rules ==');
r = await call('POST', `/investments/${inv1.id}/withdraw`, { token: cust.token, body: {} });
check('withdrawal needs payout details', r.status === 400 && /bank or UPI/i.test(r.body.message), r.body);

r = await call('PUT', '/profile/payout-details', { token: cust.token, body: { preferredMethod: 'BANK' } });
check('BANK payout requires bank fields', r.status === 400, r.body);
r = await call('PUT', '/profile/payout-details', { token: cust.token, body: { preferredMethod: 'UPI' } });
check('UPI payout requires upiId (422)', r.status === 422, r.body);
r = await call('PUT', '/profile/payout-details', {
  token: cust.token,
  body: { preferredMethod: 'BANK', accountHolderName: 'Vikram Singh', accountNumber: '334455667788', ifscCode: 'kkbk0001122', bankName: 'Kotak' },
});
check('payout details saved & masked', r.status === 200 && r.body.data.accountNumberMasked === 'XXXXXXXX7788' && r.body.data.ifscCode === 'KKBK0001122', r.body);
check('full account number never returned to customer', !JSON.stringify(r.body).includes('334455667788'), r.body);

r = await call('POST', `/investments/${inv1.id}/withdraw`, { token: cust.token, body: {} });
check('active investment cannot be withdrawn', r.status === 403, r.body);
r = await call('POST', `/investments/${inv1.id}/withdraw`, { token: cust2.token, body: {} });
check('other customer cannot withdraw my investment', [400, 404].includes(r.status), r.status);

// Simulate the passage of time
await db.query('UPDATE investments SET start_date = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 91 DAY), maturity_date = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) WHERE id = ?', [inv1.id]);
r = await call('GET', '/investments', { token: cust.token });
const matured = r.body.data.find((i) => i.id === inv1.id);
check('investment auto-matures after maturity date', matured.status === 'MATURED' && matured.canRequestWithdrawal === true && matured.maturedAt, matured);
r = await call('GET', '/notifications', { token: cust.token });
check('maturity notification sent', r.body.data.some((n) => n.type === 'INVESTMENT_MATURED'), r.body.data.map((n) => n.type));
check('unread count in meta', r.body.meta.unreadCount >= 1, r.body.meta);

r = await call('POST', `/investments/${inv1.id}/withdraw`, { token: cust.token, body: { payoutMethod: 'UPI' } });
check('cannot choose UPI without UPI ID', r.status === 400, r.body);

const [w1, w2] = await Promise.all([
  call('POST', `/investments/${inv1.id}/withdraw`, { token: cust.token, body: {} }),
  call('POST', `/investments/${inv1.id}/withdraw`, { token: cust.token, body: {} }),
]);
check('concurrent withdrawal requests: exactly one succeeds', [w1.status, w2.status].sort().join() === '201,409', [w1.status, w2.status]);
const wd1 = (w1.status === 201 ? w1 : w2).body.data;
check('withdrawal amounts', wd1.principalAmount === 6000 && wd1.profitAmount === 600 && wd1.totalAmount === 6600 && wd1.isEarly === false, wd1);
check('withdrawal payout snapshot masked', wd1.payoutMethod === 'BANK' && wd1.payoutAccountMasked === 'XXXXXXXX7788', wd1);

r = await call('GET', `/investments/${inv1.id}`, { token: cust.token });
check('investment is WITHDRAWAL_REQUESTED', r.body.data.status === 'WITHDRAWAL_REQUESTED' && r.body.data.withdrawals.length === 1, r.body.data);
r = await call('POST', `/admin/investments/${inv1.id}/cancel`, { token: admin.token, body: { reason: 'testing cancel on non-active' } });
check('non-active investment cannot be cancelled', r.status === 400, r.body);

const completeForm = (ref, withProof = true) => {
  const f = new FormData();
  f.append('paymentReference', ref);
  f.append('remarks', 'Paid via NEFT');
  if (withProof) f.append('paymentProof', new Blob([PNG], { type: 'image/png' }), 'proof.png');
  return f;
};
const payRef = `NEFT${uniq()}`;

r = await call('POST', `/admin/withdrawals/${wd1.id}/complete`, { token: admin.token, form: completeForm(payRef) });
check('cannot complete before approval', r.status === 400, r.body);
r = await call('GET', `/admin/withdrawals/${wd1.id}`, { token: admin.token });
check('admin sees full account number', r.body.data.payoutAccountNumber === '334455667788' && r.body.data.investment.reference === inv1.reference, r.body.data);
r = await call('GET', `/admin/withdrawals/${wd1.id}`, { token: editor.token });
check('editor does not see full account number', r.status === 200 && r.body.data.payoutAccountNumber === null, r.body.data?.payoutAccountNumber);
r = await call('POST', `/admin/withdrawals/${wd1.id}/approve`, { token: admin.token, body: { profitAmount: 100 } });
check('profit override refused for matured withdrawal', r.status === 400, r.body);
r = await call('POST', `/admin/withdrawals/${wd1.id}/approve`, { token: editor.token, body: {} });
check('editor cannot approve withdrawal', r.status === 403, r.status);
r = await call('POST', `/admin/withdrawals/${wd1.id}/approve`, { token: admin.token, body: { remarks: 'verified' } });
check('withdrawal approved', r.status === 200 && r.body.data.status === 'APPROVED', r.body);
r = await call('POST', `/admin/withdrawals/${wd1.id}/complete`, { token: admin.token, form: completeForm('x') });
check('payment reference validated (422)', r.status === 422, r.body);

const [c1, c2] = await Promise.all([
  call('POST', `/admin/withdrawals/${wd1.id}/complete`, { token: admin.token, form: completeForm(payRef) }),
  call('POST', `/admin/withdrawals/${wd1.id}/complete`, { token: admin.token, form: completeForm(payRef) }),
]);
check('concurrent completion: exactly one succeeds', [c1.status, c2.status].sort().join() === '200,400', [c1.status, c2.status, c1.body.message, c2.body.message]);
const done = (c1.status === 200 ? c1 : c2).body.data;
check('withdrawal completed with proof', done.status === 'COMPLETED' && done.paymentReference === payRef && done.hasPaymentProof, done);

r = await call('GET', '/wallet', { token: cust.token });
check('wallet unchanged by payout (paid to bank)', r.body.data.balance === 4000, r.body.data.balance);
check('profit & withdrawn totals', r.body.data.totalProfitEarned === 600 && r.body.data.totalWithdrawn === 6600 && r.body.data.investedAmount === 0, r.body.data);
r = await call('GET', '/wallet/transactions?limit=50', { token: cust.token });
const types = r.body.data.map((t) => t.type);
check('ledger has all entry types', ['DEPOSIT', 'INVESTMENT', 'MATURITY_PRINCIPAL', 'PROFIT', 'WITHDRAWAL'].every((t) => types.includes(t)), types);
check('payout posted exactly once', types.filter((t) => t === 'WITHDRAWAL').length === 1 && types.filter((t) => t === 'PROFIT').length === 1, types);
// Ledger integrity: replay every row oldest-first
const ordered = [...r.body.data].reverse();
let running = 0;
let consistent = true;
for (const t of ordered) {
  if (!near(t.balanceBefore, running)) consistent = false;
  running = t.direction === 'CREDIT' ? running + t.amount : running - t.amount;
  running = Math.round(running * 100) / 100;
  if (!near(t.balanceAfter, running)) consistent = false;
}
check('ledger replays to the wallet balance', consistent && near(running, 4000), { running, consistent });
check('ledger references unique', new Set(r.body.data.map((t) => t.reference)).size === r.body.data.length);

r = await call('GET', `/investments/${inv1.id}`, { token: cust.token });
check('investment COMPLETED', r.body.data.status === 'COMPLETED' && r.body.data.completedAt, r.body.data);
r = await call('POST', `/investments/${inv1.id}/withdraw`, { token: cust.token, body: {} });
check('completed investment cannot be withdrawn again', r.status === 400, r.body);
r = await call('GET', `/withdrawals/${wd1.id}/proof`, { token: cust.token });
check('owner can view payout proof', r.status === 200 && r.type.includes('image'), r.type);
r = await call('GET', `/withdrawals/${wd1.id}/proof`, { token: cust2.token });
check('other customer cannot view payout proof', r.status === 403, r.status);

console.log('\n== Cancel, early withdrawal, rejection ==');
r = await call('POST', '/investments', { token: cust.token, body: { planId: fixed.id, amount: 10000 } });
check('cannot invest more than balance (4000 < 10000)', r.status === 400, r.body);
const starter = (await call('GET', '/investment-plans')).body.data.find((p) => p.name === 'Starter 30');
r = await call('POST', '/investments', { token: cust.token, body: { planId: starter.id, amount: 1500.5 } });
check('invest 1500.50 @3% => profit 45.02', r.status === 201 && near(r.body.data.expectedProfit, 45.02) && near(r.body.data.maturityAmount, 1545.52), r.body.data);
const inv2 = r.body.data;
r = await call('POST', `/admin/investments/${inv2.id}/cancel`, { token: admin.token, body: { reason: 'Customer requested cancellation' } });
check('active investment cancelled', r.status === 200 && r.body.data.status === 'CANCELLED', r.body);
r = await call('GET', '/wallet', { token: cust.token });
check('principal refunded to wallet', r.body.data.balance === 4000, r.body.data.balance);
r = await call('POST', `/admin/investments/${inv2.id}/cancel`, { token: admin.token, body: { reason: 'Customer requested cancellation' } });
check('cannot cancel twice (no double refund)', r.status === 400, r.body);

r = await call('POST', '/investments', { token: cust.token, body: { planId: starter.id, amount: 2000 } });
const inv3 = r.body.data;
r = await call('PATCH', `/admin/investments/${inv3.id}/early-withdrawal`, { token: admin.token, body: { allowed: true } });
check('early withdrawal allowed by admin', r.status === 200 && r.body.data.canRequestWithdrawal === true, r.body.data);
r = await call('POST', `/investments/${inv3.id}/withdraw`, { token: cust.token, body: {} });
check('early withdrawal pays principal only', r.status === 201 && r.body.data.isEarly && r.body.data.profitAmount === 0 && r.body.data.totalAmount === 2000, r.body.data);
const wd3 = r.body.data;
r = await call('POST', `/admin/withdrawals/${wd3.id}/approve`, { token: admin.token, body: { profitAmount: 9999 } });
check('profit override cannot exceed expected profit', r.status === 400, r.body);
r = await call('POST', `/admin/withdrawals/${wd3.id}/reject`, { token: admin.token, body: { reason: 'Please wait for maturity' } });
check('withdrawal rejected', r.status === 200 && r.body.data.status === 'REJECTED', r.body);
r = await call('GET', `/investments/${inv3.id}`, { token: cust.token });
check('investment returns to ACTIVE after rejection', r.body.data.status === 'ACTIVE', r.body.data.status);
r = await call('POST', `/investments/${inv3.id}/withdraw`, { token: cust.token, body: {} });
const wd4 = r.body.data;
check('can request again after rejection', r.status === 201, r.body);
r = await call('POST', `/admin/withdrawals/${wd4.id}/approve`, { token: admin.token, body: { profitAmount: 20 } });
check('early withdrawal approved with discretionary profit', r.status === 200 && r.body.data.profitAmount === 20 && r.body.data.totalAmount === 2020, r.body.data);
r = await call('POST', `/admin/withdrawals/${wd4.id}/complete`, { token: admin.token, form: completeForm(payRef, false) });
check('duplicate payment reference rejected (409)', r.status === 409, r.body);
r = await call('POST', `/admin/withdrawals/${wd4.id}/complete`, { token: admin.token, form: completeForm(`IMPS${uniq()}`, false) });
check('completed without proof file', r.status === 200 && r.body.data.hasPaymentProof === false, r.body.data);
r = await call('GET', '/wallet', { token: cust.token });
check('balance 2000 after early payout', r.body.data.balance === 2000 && r.body.data.totalProfitEarned === 620, r.body.data);

console.log('\n== Wallet adjustment ==');
r = await call('POST', `/admin/wallets/${cust.id}/adjust`, { token: admin.token, body: { direction: 'DEBIT', amount: 999999, reason: 'Too large debit' } });
check('debit beyond balance rejected', r.status === 400, r.body);
r = await call('POST', `/admin/wallets/${cust.id}/adjust`, { token: admin.token, body: { direction: 'CREDIT', amount: 250.25, reason: 'Goodwill credit' } });
check('wallet credited by admin', r.status === 201 && near(r.body.data.balanceAfter, 2250.25), r.body.data);
r = await call('POST', `/admin/wallets/${admin.id}/adjust`, { token: admin.token, body: { direction: 'CREDIT', amount: 10, reason: 'Not a customer' } });
check('cannot adjust a staff wallet', r.status === 404, r.body);
r = await call('POST', `/admin/wallets/${cust.id}/adjust`, { token: editor.token, body: { direction: 'CREDIT', amount: 10, reason: 'Editor attempt' } });
check('editor cannot adjust wallet', r.status === 403, r.status);

console.log('\n== Settings ==');
r = await call('PUT', '/admin/settings', { token: admin.token, body: { walletMinTopup: 5000, walletMaxTopup: 1000 } });
check('settings min > max rejected', r.status === 400, r.body);
r = await call('PUT', '/admin/settings', { token: editor.token, body: { walletMinTopup: 100 } });
check('editor cannot change settings', r.status === 403, r.status);
r = await call('PUT', '/admin/settings', { token: admin.token, body: { walletMinTopup: 100, upiId: 'newbiz@okaxis' } });
check('settings updated', r.status === 200 && r.body.data.walletMinTopup === 100 && r.body.data.upiId === 'newbiz@okaxis', r.body);
r = await call('POST', '/wallet/deposits', { token: cust.token, form: depositForm(100, `UTR${uniq()}C`) });
check('new minimum applies to deposits', r.status === 201, r.body);
r = await call('PUT', '/admin/settings', { token: admin.token, body: { requireKycForInvestment: true } });
r = await call('POST', '/investments', { token: cust.token, body: { planId: starter.id, amount: 1000 } });
check('KYC gate blocks unverified customer when enabled', r.status === 403, r.body);
await call('PUT', '/admin/settings', { token: admin.token, body: { requireKycForInvestment: false, walletMinTopup: 500, upiId: 'moontech@upi' } });

console.log('\n== Profile & password ==');
r = await call('GET', '/profile', { token: cust.token });
check('profile date of birth is a plain date string', r.status === 200 && r.body.data.dateOfBirth === '1995-06-15', r.body.data?.dateOfBirth);
r = await call('PUT', '/profile', { token: cust.token, body: { dateOfBirth: '1990-02-28' } });
check('date of birth can be updated', r.status === 200 && r.body.data.dateOfBirth === '1990-02-28', r.body.data?.dateOfBirth);
r = await call('PUT', '/profile', { token: cust.token, body: { fullName: 'Vikram S', city: 'Udaipur', pincode: '313001' } });
check('profile updated', r.status === 200 && r.body.data.fullName === 'Vikram S' && r.body.data.city === 'Udaipur', r.body);
r = await call('PUT', '/profile', { token: cust.token, body: { pincode: '12' } });
check('invalid pincode rejected (422)', r.status === 422, r.body);
r = await call('PUT', '/profile', { token: cust.token, body: {} });
check('empty profile update rejected (422)', r.status === 422, r.body);
r = await call('POST', '/auth/change-password', { token: cust.token, body: { currentPassword: 'wrong', newPassword: 'NewPass123' } });
check('wrong current password rejected', r.status === 400, r.body);
r = await call('POST', '/auth/change-password', { token: cust.token, body: { currentPassword: 'Admin@123456', newPassword: 'short1' } });
check('weak new password rejected (422)', r.status === 422, r.body);
r = await call('POST', '/auth/change-password', { token: cust.token, body: { currentPassword: 'Admin@123456', newPassword: 'NewPass123' } });
check('password changed', r.status === 200, r.body);
r = await call('POST', '/auth/login', { body: { email: 'vikram.singh@example.com', password: 'Admin@123456' } });
check('old password no longer works', r.status === 401, r.status);

r = await call('POST', '/auth/forgot-password', { body: { identifier: 'nobody@example.com' } });
check('forgot-password does not reveal unknown accounts', r.status === 200, r.body);
r = await call('POST', '/auth/forgot-password', { body: { identifier: 'vikram.singh@example.com' } });
check('forgot-password accepted', r.status === 200 && !JSON.stringify(r.body).match(/\b\d{6}\b/), r.body);
r = await call('POST', '/auth/reset-password', { body: { identifier: 'vikram.singh@example.com', otp: '000000', newPassword: 'Another123' } });
check('wrong OTP rejected', r.status === 401, r.body);
const log = fs.readFileSync(SERVER_LOG, 'utf8');
const otp = [...log.matchAll(/Password reset code for vikram\.singh@example\.com: (\d{6})/g)].pop()?.[1];
check('OTP issued (mock email log)', Boolean(otp));
r = await call('POST', '/auth/reset-password', { body: { identifier: 'vikram.singh@example.com', otp, newPassword: 'Admin@123456' } });
check('password reset with correct OTP', r.status === 200, r.body);
r = await call('POST', '/auth/reset-password', { body: { identifier: 'vikram.singh@example.com', otp, newPassword: 'Admin@1234567' } });
check('OTP cannot be reused', r.status === 401, r.body);
r = await call('POST', '/auth/login', { body: { email: 'vikram.singh@example.com', password: 'Admin@123456' } });
check('login works with reset password', r.status === 200, r.status);

console.log('\n== Notifications ==');
r = await call('POST', '/admin/announcements', { token: admin.token, body: { title: 'Diwali Offer', message: 'New plans launching soon.' } });
check('announcement broadcast', r.status === 201 && r.body.data.recipientsCount === 5, r.body);
r = await call('GET', '/notifications?limit=50', { token: cust.token });
const ntypes = new Set(r.body.data.map((n) => n.type));
check('all lifecycle notifications present', ['PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'INVESTMENT_CONFIRMED', 'INVESTMENT_MATURED', 'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_COMPLETED', 'ANNOUNCEMENT'].every((t) => ntypes.has(t)), [...ntypes]);
const firstUnread = r.body.data.find((n) => !n.isRead);
r = await call('POST', `/notifications/${firstUnread.id}/read`, { token: cust.token });
check('notification marked read', r.status === 200 && r.body.data.isRead === true, r.body);
r = await call('POST', `/notifications/${firstUnread.id}/read`, { token: cust2.token });
check("cannot read someone else's notification", r.status === 404, r.status);
r = await call('POST', '/notifications/read-all', { token: cust.token });
r = await call('GET', '/notifications/unread-count', { token: cust.token });
check('read-all clears unread count', r.body.data.unreadCount === 0, r.body);

console.log('\n== Admin views & reports ==');
r = await call('GET', '/admin/finance/dashboard', { token: editor.token });
check('dashboard stats', r.status === 200 && r.body.data.totalUsers === 5 && r.body.data.totalProfitPaid === 620 && r.body.data.pendingPaymentVerifications === 1, r.body.data);
check('dashboard matured count', r.body.data.totalMaturedInvestments === 2 && r.body.data.walletTransactions > 5, r.body.data);
r = await call('GET', `/admin/customers/${cust.id}/finance`, { token: admin.token });
check('customer finance view', r.status === 200 && near(r.body.data.walletBalance, 2250.25) && r.body.data.investments.length === 3, r.body.data?.summary);
r = await call('GET', '/admin/customers/99999/finance', { token: admin.token });
check('unknown customer finance 404', r.status === 404, r.status);
r = await call('GET', `/admin/customers/${cust.id}`, { token: admin.token });
check('existing customer detail route still works', r.status === 200 && r.body.data.email === 'vikram.singh@example.com', r.status);
r = await call('GET', '/admin/investments?search=vikram', { token: admin.token });
check('admin investment search by customer', r.status === 200 && r.body.data.length === 3 && r.body.meta.counts.COMPLETED === 2, r.body.meta);
r = await call('GET', '/admin/investments?maturingInDays=7', { token: admin.token });
check('maturity monitor filter', r.status === 200 && r.body.data.length === 0, r.body.data.length);
r = await call('GET', '/admin/withdrawals?status=COMPLETED&search=' + payRef, { token: admin.token });
check('admin withdrawal search by payment ref', r.status === 200 && r.body.data.length === 1, r.body.data.length);
r = await call('GET', '/admin/wallets/transactions?type=PROFIT', { token: admin.token });
check('admin ledger filter', r.status === 200 && r.body.data.length === 2 && r.body.data.every((t) => t.type === 'PROFIT'), r.body.data.length);
r = await call('GET', '/admin/deposits?search=' + utr1, { token: admin.token });
check('admin payment search by UTR', r.body.data.length === 1 && r.body.data[0].reviewedBy === 'admin@moontech.com', r.body.data[0]);

const today = new Date().toISOString().slice(0, 10);
for (const type of ['users', 'wallet', 'investments', 'profit', 'maturity', 'withdrawals', 'payments', 'transactions']) {
  r = await call('GET', `/admin/reports/${type}`, { token: editor.token });
  check(`report ${type}`, r.status === 200 && Array.isArray(r.body.data.rows) && r.body.data.columns.length > 0 && r.body.data.rows.length > 0, r.body);
}
r = await call('GET', `/admin/reports/transactions?startDate=${today}&endDate=${today}`, { token: admin.token });
check('date-wise report (today) has rows', r.body.data.rows.length > 5, r.body.data.rows.length);
r = await call('GET', `/admin/reports/transactions?startDate=2020-01-01&endDate=2020-01-31`, { token: admin.token });
check('date-wise report (2020) is empty', r.body.data.rows.length === 0, r.body.data.rows.length);
r = await call('GET', `/admin/reports/profit`, { token: admin.token });
check('profit report total', r.body.data.summary.find((s) => s.label === 'Total Profit Paid').value === 620, r.body.data.summary);
r = await call('GET', `/admin/reports/payments?format=csv`, { token: admin.token });
check('CSV export', r.status === 200 && r.type.includes('text/csv') && r.body.includes('Payment ID') && r.body.split('\r\n').length > 3, r.type);
r = await call('GET', `/admin/reports/bogus`, { token: admin.token });
check('unknown report type rejected', r.status === 400, r.status);
r = await call('GET', `/admin/reports/users?startDate=2026-12-01&endDate=2026-01-01`, { token: admin.token });
check('inverted date range rejected', r.status === 400, r.status);
r = await call('GET', `/admin/reports/users`, { token: cust.token });
check('customer cannot access reports', r.status === 403, r.status);

console.log('\n== Security & legacy fixes ==');
r = await call('POST', '/auth/register', { body: { name: 'Weak Pass', email: 'weak@example.com', phone: '+919000000001', password: 'abcdefgh' } });
check('registration rejects password without a digit (422)', r.status === 422, r.body);
r = await call('POST', '/auth/register', { body: { name: 'New Investor', email: 'new.investor@example.com', phone: '+919000000002', password: 'Invest2026' } });
check('registration with strong password works', r.status === 201 && r.body.data.user.email === 'new.investor@example.com', r.body);
r = await call('GET', `/admin/customers/${cust.id}`, { token: admin.token });
check('legacy customer detail has a valid createdAt', r.status === 200 && !Number.isNaN(new Date(r.body.data.createdAt).getTime()) && Math.abs(Date.now() - new Date(r.body.data.createdAt).getTime()) < 6 * 3600 * 1000, r.body.data.createdAt);
r = await call('GET', '/auth/me', { token: cust.token });
check('legacy /auth/me lastLoginAt is ISO', typeof r.body.data.lastLoginAt === 'string' && r.body.data.lastLoginAt.endsWith('Z'), r.body.data.lastLoginAt);
{
  const res = await fetch(`${BASE}/health`, { headers: { Origin: 'http://evil.example' } });
  check('CORS rejects unknown browser origins', res.status === 403, res.status);
  const ok = await fetch(`${BASE}/health`, { headers: { Origin: 'http://localhost:3000' } });
  check('CORS allows the customer website origin', ok.status === 200 && ok.headers.get('access-control-allow-origin') === 'http://localhost:3000', ok.status);
}
{
  const form = new FormData();
  form.append('amount', '1000'); form.append('upiTransactionId', 'FAKEPDF' + uniq());
  form.append('receipt', new Blob([Buffer.from('not really a pdf')], { type: 'application/pdf' }), 'r.pdf');
  r = await call('POST', '/wallet/deposits', { token: cust.token, form });
  check('fake PDF receipt rejected', r.status === 400, r.body);
}
await db.query("UPDATE users SET status = 'INACTIVE' WHERE email = 'priya.patel@example.com'");
r = await call('GET', '/wallet', { token: cust2.token });
check('inactive account token is refused', r.status === 403, r.status);
await db.query("UPDATE users SET status = 'ACTIVE' WHERE email = 'priya.patel@example.com'");

console.log('\n== Legacy endpoints still work ==');
r = await call('GET', '/subscriptions/plans');
check('crypto staking endpoints removed', r.status === 404, r.status);
r = await call('GET', '/admin/customers', { token: admin.token });
check('customer list shows investments', r.status === 200 && r.body.data.find((c) => c.email === 'vikram.singh@example.com').investmentsCount === 3, r.body.data);
r = await call('GET', '/admin/dashboard/stats', { token: admin.token });
check('legacy dashboard stats', r.status === 200, r.status);
r = await call('GET', '/auth/me', { token: cust.token });
check('auth/me', r.status === 200, r.status);

await db.end();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  console.log('FAILED:', failures);
  process.exit(1);
}
