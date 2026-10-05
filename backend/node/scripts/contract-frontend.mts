/**
 * Runs the customer website's real API layer (frontend/src/lib/api.ts) against a
 * live API to prove the two agree on every request and response shape.
 *
 *   1. Start the API on a THROWAWAY database (see e2e-investment.mjs).
 *   2. From backend/node:
 *        NEXT_PUBLIC_API_URL=http://localhost:5055/api npx tsx scripts/contract-frontend.mts
 */
import { api, ApiError } from '../../../frontend/src/lib/api';

let passed = 0;
let failed = 0;

function check(name: string, cond: unknown, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name} ${detail !== undefined ? '-> ' + JSON.stringify(detail) : ''}`);
  }
}

async function expectError(name: string, fn: () => Promise<unknown>, status?: number) {
  try {
    await fn();
    check(name, false, 'no error thrown');
  } catch (err) {
    const e = err as ApiError & { status?: number };
    check(name, err instanceof ApiError && (status === undefined || e.status === status), {
      message: (err as Error).message,
      status: e.status,
    });
  }
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const receipt = () => new File([PNG], 'receipt.png', { type: 'image/png' });
const uniq = () => Math.random().toString(36).slice(2, 10).toUpperCase();

console.log('== Auth ==');
const bad = await api.login('vikram.singh@example.com', 'nope');
check('wrong password -> success false with message', bad.success === false && typeof bad.message === 'string', bad);
const login = await api.login('vikram.singh@example.com', 'Admin@123456');
const token = login.data!.accessToken;
check('login returns token and user', typeof token === 'string' && login.data!.user.role === 'CUSTOMER', login);

const email = `contract.${uniq().toLowerCase()}@example.com`;
const reg = await api.register({ name: 'Contract Test', email, phone: `+9198${Math.floor(10000000 + Math.random() * 89999999)}`, password: 'Invest2026' });
check('register succeeds', reg.success === true, reg);
await expectError('duplicate email -> 409', () => api.register({ name: 'Contract Test', email, phone: '+919800000000', password: 'Invest2026' }), 409);
const newToken = (await api.login(email, 'Invest2026')).data!.accessToken;
check('new account can log in', typeof newToken === 'string');

console.log('\n== Profile ==');
const profile = await api.getProfile(token);
check('profile shape', profile.email === 'vikram.singh@example.com' && 'payoutDetails' in profile, profile);
const updated = await api.updateProfile(token, { city: 'Jaipur' });
check('profile update', updated.city === 'Jaipur', updated);
await expectError('invalid pincode -> 422', () => api.updateProfile(token, { pincode: '12' }), 422);
const payout = await api.updatePayoutDetails(token, {
  preferredMethod: 'BANK',
  accountHolderName: 'Vikram Singh',
  accountNumber: '334455667788',
  ifscCode: 'KKBK0001122',
  bankName: 'Kotak',
});
check('payout details masked', payout.accountNumberMasked === 'XXXXXXXX7788' && payout.hasBankDetails === true, payout);
const kyc = await api.getKycInfo(token);
check('kyc info status', typeof kyc.status === 'string', kyc);

console.log('\n== Wallet ==');
const wallet0 = await api.getWallet(token);
check('wallet summary + config', wallet0.balance === 0 && wallet0.config.minTopup === 500, wallet0);
await expectError('deposit below minimum -> 400', () => api.createDeposit(token, { amount: 10, upiTransactionId: `UTR${uniq()}`, receipt: receipt() }), 400);
const dep = await api.createDeposit(token, { amount: 15000, upiTransactionId: `UTR${uniq()}`, receipt: receipt() });
check('deposit created PENDING', dep.status === 'PENDING' && dep.reference.startsWith('DEP-'), dep);
const deps = await api.getDeposits(token, { page: 1, limit: 5 });
check('deposit list paginated', deps.items.length === 1 && deps.meta.total === 1, deps.meta);
const blob = await api.getDepositReceipt(token, dep.id);
check('receipt blob', blob.size > 0 && blob.type.includes('image'), blob.type);

// Approve as admin using plain fetch (admin panel path)
const adminLogin = await api.login('admin@moontech.com', 'Admin@123456');
const adminToken = adminLogin.data!.accessToken;
const base = process.env.NEXT_PUBLIC_API_URL!;
const approve = await fetch(`${base}/admin/deposits/${dep.id}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
  body: '{}',
});
check('admin approve', approve.status === 200, approve.status);
const wallet1 = await api.getWallet(token);
check('wallet credited', wallet1.balance === 15000, wallet1.balance);
const txns = await api.getTransactions(token, { type: 'DEPOSIT' });
check('transactions filter', txns.items.length === 1 && txns.items[0].direction === 'CREDIT', txns.items);

console.log('\n== Plans & investments ==');
const plans = await api.getInvestmentPlans();
const growth = plans.find((p) => p.name === 'Growth 90')!;
check('plans list', plans.length === 4 && growth.profitType === 'PERCENTAGE', plans.length);
const featured = await api.getFeaturedPlans();
check('featured plans list', featured.length === 2 && featured.every((p) => p.isFeatured && p.isActive), featured.map((p) => p.name));
const preview = await api.previewInvestment(token, growth.id, 10000);
check('preview', preview.expectedProfit === 1000 && preview.maturityAmount === 11000 && typeof preview.maturityDate === 'string', preview);
await expectError('invest above balance -> 400', () => api.createInvestment(token, growth.id, 50000), 400);
const inv = await api.createInvestment(token, growth.id, 10000);
check('investment created', inv.status === 'ACTIVE' && inv.canRequestWithdrawal === false && inv.daysRemaining === 90, inv);
const invs = await api.getInvestments(token, { status: 'ACTIVE' });
check('investments list', invs.items.length === 1 && invs.items[0].id === inv.id, invs.meta);
const detail = await api.getInvestment(token, inv.id);
check('investment detail', detail.reference === inv.reference && Array.isArray(detail.withdrawals), detail);
await expectError('withdraw active -> 403', () => api.requestWithdrawal(token, inv.id), 403);
await expectError('other user cannot see investment -> 404', () => api.getInvestment(newToken, inv.id), 404);

console.log('\n== Notifications ==');
const notes = await api.getNotifications(token, { page: 1, limit: 20 });
check('notifications list', notes.items.length >= 3 && notes.items.every((n) => typeof n.title === 'string'), notes.items.length);
const unread = await api.getUnreadCount(token);
check('unread count', unread >= 3, unread);
await api.markNotificationRead(token, notes.items[0].id);
const cleared = await api.markAllNotificationsRead(token);
check('read-all returns count', cleared >= 1 && (await api.getUnreadCount(token)) === 0, cleared);

console.log('\n== Password ==');
const forgot = await api.forgotPassword('vikram.singh@example.com');
check('forgot password', forgot.expiresInMinutes === 10, forgot);
await expectError('reset with wrong otp -> 401', () => api.resetPassword('vikram.singh@example.com', '000000', 'Another123'), 401);
await expectError('change password wrong current -> 400', () => api.changePassword(token, 'wrong', 'Another123'), 400);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
