/**
 * End-to-end check of the monthly-rate plans, two-bucket wallet, daily payout job and
 * capital withdrawal fee against the configured database.
 * Run with: npx tsx scripts/verify-daily-payouts.mts
 *
 * It applies the schema patches and seeds the plans first (same as server start), then creates
 * (or reuses) two throwaway customers, lets one refer the other, invests 1,00,000 in the
 * Regular Plan (5% / month), back-dates the investment by 10 calendar days and asserts:
 *   - 250 is credited to the PROFIT wallet for every working day due (1,250 a week, 5,000 a month)
 *   - at most 20 credits are paid per 30-day cycle
 *   - the referral commission lands in the referrer's PROFIT wallet instantly on investing
 *   - a Deposit Plan investment can be closed at any time (no lock-in) and pays 240 credits over the year
 *   - closing the Regular Plan investment charges the 5% fee: 1,00,000 gross -> 95,000 net
 *   - the job is idempotent
 *   - daily profit stops at the capital withdrawal request and resumes if the request is rejected
 *   - completing a capital withdrawal settles the last profit days before closing the investment
 *   - the 5% fee is charged on the capital only, never on profit paid with it
 *   - a fixed-term daily plan settles every paying day up to maturity and returns the capital
 *   - a maturity-paid plan credits capital + profit at maturity and it counts as profit earned
 * All money moves happen on the throwaway accounts only. Point DB_NAME at a throwaway database
 * (it is created if missing), e.g.  DB_NAME=moon_tech_verify_test npx tsx scripts/verify-daily-payouts.mts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {
  sequelize,
  User,
  CustomerProfile,
  KycProfile,
  Wallet,
  Referral,
  Investment,
  InvestmentPlan,
  ProfitCredit,
  ReferralCommission,
  UserPayoutDetail,
  WalletTransaction,
} from '../src/models/index.js';
import {
  UserRole,
  UserStatus,
  KycStatus,
  ReferralStatus,
  ProfitType,
  WithdrawalStatus,
  ProfitPayoutMode,
  RateBasis,
  WalletBucket,
  WalletTxnType,
  WalletTxnDirection,
  PayoutMethod,
  InvestmentStatus,
} from '../src/types/index.js';
import { ensureDatabaseExists } from '../src/config/database.js';
import { encryptData } from '../src/utils/encryption.js';
import { applySchemaPatches } from '../src/database/migrations/schemaPatches.js';
import { seedDailyProfitPlans } from '../src/database/seeders/seed.js';
import { WalletService } from '../src/services/walletService.js';
import { InvestmentService } from '../src/services/investmentService.js';
import { InvestmentPlanService } from '../src/services/investmentPlanService.js';
import { WithdrawalService } from '../src/services/withdrawalService.js';
import { DailyPayoutService } from '../src/services/dailyPayoutService.js';
import { SettingsService } from '../src/services/settingsService.js';
import { istDayKey, latestPayableDay, payableWorkingDays, cycleNoForDay, maxCreditsForTerm, WORKING_DAYS_PER_MONTH } from '../src/utils/workingDays.js';
import { toPaise, fromPaise } from '../src/utils/money.js';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `  -> ${JSON.stringify(detail)}` : ''}`);
  if (!ok) failures += 1;
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
const DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

async function ensureCustomer(email: string, name: string, phone: string, referredBy?: { id: number; code: string }) {
  let user = await User.findOne({ where: { email } });
  if (!user) {
    user = await User.create({
      email,
      phone,
      password_hash: await bcrypt.hash('Test@123456', 10),
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });
    await CustomerProfile.create({
      user_id: user.id,
      full_name: name,
      referral_code: `${name.slice(0, 4).toUpperCase()}${String(user.id).padStart(4, '0')}`,
      referred_by: referredBy?.code ?? null,
    });
    await KycProfile.create({ user_id: user.id, kyc_status: KycStatus.VERIFIED });
    await Wallet.create({ user_id: user.id, balance: 0, capital_balance: 0, profit_balance: 0 });
    if (referredBy) {
      await Referral.create({
        referrer_user_id: referredBy.id,
        referred_user_id: user.id,
        referral_code: referredBy.code,
        status: ReferralStatus.ACTIVE,
      });
    }
  }
  // Withdrawals are bank-only: make sure the throwaway account has a complete bank record
  const bank = {
    preferred_method: PayoutMethod.BANK,
    account_holder_name: name,
    account_number_encrypted: encryptData('123456789012'),
    ifsc_code: 'HDFC0000001',
    bank_name: 'HDFC Bank',
  };
  const payout = await UserPayoutDetail.findOne({ where: { user_id: user.id } });
  if (!payout) {
    await UserPayoutDetail.create({ user_id: user.id, ...bank } as any);
  } else if (!payout.account_number_encrypted || !payout.ifsc_code || !payout.account_holder_name) {
    await payout.update(bank as any);
  }
  return user;
}

async function main() {
  await ensureDatabaseExists();
  await sequelize.authenticate();
  await applySchemaPatches();
  await sequelize.sync();
  await seedDailyProfitPlans();

  const referrer = await ensureCustomer('payout.referrer@example.test', 'Payout Referrer', '+919000000101');
  const referrerProfile = (await CustomerProfile.findOne({ where: { user_id: referrer.id } }))!;
  const investor = await ensureCustomer('payout.investor@example.test', 'Payout Investor', '+919000000102', {
    id: referrer.id,
    code: referrerProfile.referral_code,
  });

  const regular = await InvestmentPlan.findOne({
    where: { payout_mode: ProfitPayoutMode.DAILY, rate_basis: RateBasis.PER_MONTH, lock_in_days: 0, is_active: true },
    order: [['id', 'ASC']],
  });
  const lockedPlan = await InvestmentPlan.findOne({
    where: { payout_mode: ProfitPayoutMode.DAILY, rate_basis: RateBasis.PER_MONTH, is_active: true, duration_days: 365 },
    order: [['id', 'ASC']],
  });
  if (!regular) throw new Error('No active monthly-rate plan found (Regular Plan)');
  console.log(`Regular plan "${regular.name}" at ${regular.profit_value}% per month; one-year plan ${lockedPlan ? `"${lockedPlan.name}"` : 'not found'}`);

  const settings = await SettingsService.getSettings();
  const amount = Math.min(100000, Number(regular.max_amount));

  // Fund the investor's CAPITAL wallet so the investment can be debited
  await sequelize.transaction((t) =>
    WalletService.applyEntry(
      {
        userId: investor.id,
        type: WalletTxnType.ADJUSTMENT,
        direction: WalletTxnDirection.CREDIT,
        bucket: WalletBucket.CAPITAL,
        amountPaise: toPaise(amount * (lockedPlan ? 2 : 1)),
        description: 'verify-daily-payouts funding',
      },
      t
    )
  );

  const referrerBefore = await WalletService.getBalances(referrer.id);
  const investorBefore = await WalletService.getBalances(investor.id);
  check('funding landed in the CAPITAL wallet, not PROFIT', investorBefore.capitalBalance >= amount && investorBefore.profitBalance === (await WalletService.getBalances(investor.id)).profitBalance);

  const created = await InvestmentService.invest(investor.id, { planId: regular.id, amount, source: WalletBucket.CAPITAL });
  check('investment created in DAILY mode on a PER_MONTH basis', created.payoutMode === ProfitPayoutMode.DAILY && created.rateBasis === RateBasis.PER_MONTH, created.reference);
  const expectedDaily = Math.round((amount * Number(regular.profit_value)) / WORKING_DAYS_PER_MONTH) / 100;
  check(`daily profit = monthly / 20 (${expectedDaily} on ${amount})`, near(created.dailyProfit, expectedDaily), created.dailyProfit);
  check('weekly profit = daily x 5', near(created.weeklyProfit, expectedDaily * 5), created.weeklyProfit);
  check('monthly profit = daily x 20 = rate % of capital', near(created.monthlyProfit, (amount * Number(regular.profit_value)) / 100), created.monthlyProfit);
  check('open-ended Regular Plan has no maturity date', regular.duration_days === 0 ? created.maturityDate === null && created.isOpenEnded : created.maturityDate !== null, created.maturityDate);
  check('fee percent snapshotted from settings', created.feePercent === settings.capitalWithdrawalFeePercent, created.feePercent);
  check('capital withdrawal fee shown (5% of 1,00,000 = 5,000; net 95,000)', near(created.capitalWithdrawalFee, (amount * settings.capitalWithdrawalFeePercent) / 100) && near(created.netCapitalOnWithdrawal, amount - created.capitalWithdrawalFee), {
    fee: created.capitalWithdrawalFee,
    net: created.netCapitalOnWithdrawal,
  });

  const afterInvest = await WalletService.getBalances(investor.id);
  check('investment debited the CAPITAL wallet only', near(investorBefore.capitalBalance - afterInvest.capitalBalance, amount) && near(afterInvest.profitBalance, investorBefore.profitBalance));

  const commission = await ReferralCommission.findOne({ where: { investment_id: created.id } });
  check('referral commission recorded as CREDITED instantly', commission?.status === 'CREDITED' && commission.wallet_transaction_id !== null, commission?.status);
  check('commission = referral % of amount', commission !== null && near(Number(commission.amount), Math.round(amount * settings.referralCommissionPercent) / 100));
  const referrerAfterInvest = await WalletService.getBalances(referrer.id);
  check('referrer PROFIT wallet received the commission at invest time', near(referrerAfterInvest.profitBalance - referrerBefore.profitBalance, Number(commission!.amount)), {
    before: referrerBefore.profitBalance,
    after: referrerAfterInvest.profitBalance,
  });

  // Back-date the investment by 10 days so several working days are due, and make the
  // commission's 24h wait elapse.
  const inv = (await Investment.findByPk(created.id))!;
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  inv.start_date = tenDaysAgo;
  await inv.save();
  if (commission) {
    commission.eligible_at = new Date(Date.now() - 60 * 1000);
    await commission.save();
  }

  const payable = latestPayableDay(new Date());
  const expectedDays = payableWorkingDays(istDayKey(tenDaysAgo), payable, WORKING_DAYS_PER_MONTH);
  console.log(`Payable day ${payable}; expecting credits for ${expectedDays.length} working days: ${expectedDays.join(', ')}`);

  const run = await DailyPayoutService.run();
  check('payout run returned a result', run !== null, run);

  const credits = await ProfitCredit.findAll({ where: { investment_id: created.id }, order: [['credit_day', 'ASC']] });
  check('one profit credit per due working day', credits.length === expectedDays.length, credits.map((c) => String(c.credit_day)));
  check('every credit is the daily amount', credits.every((c) => near(Number(c.amount), expectedDaily)));
  check('no weekend credits', credits.every((c) => { const d = new Date(`${c.credit_day}T00:00:00Z`).getUTCDay(); return d !== 0 && d !== 6; }));
  check('credits carry the 30-day cycle number', credits.every((c) => c.cycle_no === cycleNoForDay(istDayKey(tenDaysAgo), String(c.credit_day))));

  const afterPayout = await WalletService.getBalances(investor.id);
  const expectedGain = Math.round(expectedDaily * credits.length * 100) / 100;
  check('daily profit landed in the PROFIT wallet', near(afterPayout.profitBalance - afterInvest.profitBalance, expectedGain), { before: afterInvest.profitBalance, after: afterPayout.profitBalance, expectedGain });
  check('CAPITAL wallet untouched by the payout (no compounding)', near(afterPayout.capitalBalance, afterInvest.capitalBalance));
  const profitTxns = await WalletTransaction.findAll({ where: { user_id: investor.id, type: WalletTxnType.PROFIT } });
  check('PROFIT ledger rows are tagged with the PROFIT bucket', profitTxns.length > 0 && profitTxns.every((t) => t.bucket === WalletBucket.PROFIT));

  const refreshed = (await Investment.findByPk(created.id))!;
  check('investment.profit_credited tracks the credits', near(Number(refreshed.profit_credited), expectedGain), refreshed.profit_credited);
  check('investment.amount unchanged (profit never added to capital)', near(Number(refreshed.amount), amount));

  // 20-credit cap: back-date far enough that a full cycle plus a bit is due
  const serialized = await InvestmentService.getUserInvestment(investor.id, created.id);
  check('serializer reports credits per cycle = 20', serialized.creditsPerCycle === WORKING_DAYS_PER_MONTH, serialized.creditsPerCycle);

  const commissionAfter = await ReferralCommission.findByPk(commission!.id);
  check('referral commission still CREDITED after the payout run (not paid twice)', commissionAfter?.status === 'CREDITED', commissionAfter?.status);
  const referrerAfter = await WalletService.getBalances(referrer.id);
  check('referrer PROFIT wallet received the commission', near(referrerAfter.profitBalance - referrerBefore.profitBalance, Number(commission!.amount)), {
    before: referrerBefore.profitBalance,
    after: referrerAfter.profitBalance,
  });

  // Idempotency: a second run must not pay anything again
  const run2 = await DailyPayoutService.run();
  check('second run credits nothing new', run2 !== null && run2.profitCredits === 0 && run2.commissions === 0, run2);
  const afterRun2 = await WalletService.getBalances(investor.id);
  check('balances unchanged by second run', afterRun2.profitBalance === afterPayout.profitBalance && afterRun2.capitalBalance === afterPayout.capitalBalance);

  // No lock-in: a Deposit Plan investment can be closed at any time, and pays whole months only
  if (lockedPlan && lockedPlan.is_active) {
    const lockedAmount = Math.max(Number(lockedPlan.min_amount), Math.min(amount, Number(lockedPlan.max_amount)));
    const locked = await InvestmentService.invest(investor.id, { planId: lockedPlan.id, amount: lockedAmount, source: WalletBucket.CAPITAL });
    check('Deposit Plan investment is not locked and can be closed any time', !locked.isLocked && locked.canRequestWithdrawal, { lockInEndsAt: locked.lockInEndsAt });
    check('Deposit Plan pays 240 credits (12 months) over 365 days', locked.profitDays === 240 && near(locked.expectedProfit, ((lockedAmount * Number(lockedPlan.profit_value)) / 100) * 12), { profitDays: locked.profitDays, expectedProfit: locked.expectedProfit });
    check('closing it now would cost the early withdrawal fee', locked.earlyExitFeeApplies && near(locked.capitalWithdrawalFee, (lockedAmount * settings.capitalWithdrawalFeePercent) / 100), { fee: locked.capitalWithdrawalFee });
    // Clean up: cancel it so the throwaway account is left tidy (refund goes to CAPITAL)
    await InvestmentService.cancelInvestment(locked.id, referrer.id, 'verify-daily-payouts cleanup');
  } else {
    console.log('SKIP  no active one-year plan found; Deposit Plan check skipped');
  }

  // Capital withdrawal with fee: close the Regular Plan investment
  const closing = await WithdrawalService.requestWithdrawal(investor.id, created.id, {});
  const expectedFee = Math.round(amount * settings.capitalWithdrawalFeePercent) / 100;
  check('capital withdrawal is tagged CAPITAL', closing.bucket === WalletBucket.CAPITAL, closing.bucket);
  check(`gross ${amount}, fee ${expectedFee}, net ${amount - expectedFee}`, near(closing.totalAmount, amount) && near(closing.feeAmount, expectedFee) && near(closing.netAmount, amount - expectedFee), {
    total: closing.totalAmount,
    fee: closing.feeAmount,
    net: closing.netAmount,
  });
  const closingInv = (await Investment.findByPk(created.id))!;
  check('investment moved to WITHDRAWAL_REQUESTED', closingInv.status === InvestmentStatus.WITHDRAWAL_REQUESTED);

  // Profit withdrawal: free, any amount above the minimum
  const profitAvailable = (await WalletService.getBalances(investor.id)).profitBalance;
  if (profitAvailable >= settings.walletMinWithdrawal) {
    const profitWithdrawal = await WithdrawalService.requestWalletWithdrawal(investor.id, { bucket: WalletBucket.PROFIT, amount: settings.walletMinWithdrawal });
    check('profit withdrawal carries no fee', profitWithdrawal.bucket === WalletBucket.PROFIT && profitWithdrawal.feeAmount === 0 && near(profitWithdrawal.netAmount, settings.walletMinWithdrawal), {
      fee: profitWithdrawal.feeAmount,
      net: profitWithdrawal.netAmount,
    });
    const held = await WalletService.getBalances(investor.id);
    check('profit withdrawal is held from the PROFIT wallet', near(profitAvailable - held.profitBalance, settings.walletMinWithdrawal));
    await WithdrawalService.rejectWithdrawal(profitWithdrawal.id, referrer.id, 'verify-daily-payouts cleanup');
    const refunded = await WalletService.getBalances(investor.id);
    check('rejecting refunds the PROFIT wallet', near(refunded.profitBalance, profitAvailable));
  } else {
    console.log(`SKIP  profit balance ${profitAvailable} below the minimum withdrawal ${settings.walletMinWithdrawal}; profit withdrawal check skipped`);
  }

  // Reject the capital withdrawal so the investment goes back to ACTIVE and keeps earning
  await WithdrawalService.rejectWithdrawal(closing.id, referrer.id, 'verify-daily-payouts cleanup');
  const reopened = (await Investment.findByPk(created.id))!;
  check('rejected capital withdrawal returns the investment to ACTIVE', reopened.status === InvestmentStatus.ACTIVE);

  // ------------------------------------------------------------------------------------------
  // Extra scenarios: withdrawal cut-off, settlement on completion, fee on capital only, maturity
  // ------------------------------------------------------------------------------------------
  const admin = referrer.id; // any user id serves as the acting admin for service calls
  const feeOf = (principal: number) => round2((principal * settings.capitalWithdrawalFeePercent) / 100);
  const fund = (userId: number, paise: number) =>
    sequelize.transaction((t) =>
      WalletService.applyEntry(
        { userId, type: WalletTxnType.ADJUSTMENT, direction: WalletTxnDirection.CREDIT, bucket: WalletBucket.CAPITAL, amountPaise: paise, description: 'verify-daily-payouts funding' },
        t
      )
    );
  const backdateStart = async (investmentId: number, days: number) => {
    const row = (await Investment.findByPk(investmentId))!;
    row.start_date = new Date(Date.now() - days * DAY);
    await row.save();
    return row.start_date;
  };

  // A. Daily profit stops when the customer asks to withdraw the capital, and resumes on rejection
  console.log('\n-- profit stops at the withdrawal request --');
  await fund(investor.id, toPaise(amount));
  const stopInv = await InvestmentService.invest(investor.id, { planId: regular.id, amount, source: WalletBucket.CAPITAL });
  const stopStart = await backdateStart(stopInv.id, 12);
  const stopReq = await WithdrawalService.requestWithdrawal(investor.id, stopInv.id, {});
  // Pretend the request was made 5 days ago, before several working days fell due
  const requestedAt = new Date(Date.now() - 5 * DAY);
  // bind (not replacements): Sequelize formats replacement Dates in server-local time, bind params go out as UTC
  await sequelize.query('UPDATE withdrawals SET created_at = $1 WHERE id = $2', { bind: [requestedAt, stopReq.id] });
  const cutoff = latestPayableDay(requestedAt);
  const expectedStopDays = payableWorkingDays(istDayKey(stopStart), cutoff, WORKING_DAYS_PER_MONTH);
  const allDueDays = payableWorkingDays(istDayKey(stopStart), payable, WORKING_DAYS_PER_MONTH);
  check('test setup: more working days are due than were due at the request', allDueDays.length > expectedStopDays.length && expectedStopDays.length > 0, { due: allDueDays.length, atRequest: expectedStopDays.length });
  const beforeStop = await WalletService.getBalances(investor.id);
  await DailyPayoutService.run();
  const stopCredits = await ProfitCredit.findAll({ where: { investment_id: stopInv.id }, order: [['credit_day', 'ASC']] });
  check('withdrawal-requested investment is paid only up to the request day', stopCredits.length === expectedStopDays.length && stopCredits.every((c) => String(c.credit_day) <= cutoff), { cutoff, days: stopCredits.map((c) => String(c.credit_day)) });
  const afterStop = await WalletService.getBalances(investor.id);
  check('profit wallet grew by exactly those credits', near(afterStop.profitBalance - beforeStop.profitBalance, round2(expectedDaily * expectedStopDays.length)));
  const stopSerialized = await InvestmentService.getUserInvestment(investor.id, stopInv.id);
  check('serializer: status WITHDRAWAL_REQUESTED, creditedDays matches', stopSerialized.status === InvestmentStatus.WITHDRAWAL_REQUESTED && stopSerialized.creditedDays === expectedStopDays.length, stopSerialized.creditedDays);
  await WithdrawalService.rejectWithdrawal(stopReq.id, admin, 'verify-daily-payouts cleanup');
  await DailyPayoutService.run();
  const resumed = await ProfitCredit.count({ where: { investment_id: stopInv.id } });
  check('after a rejection the investment is active again and the skipped days are paid', resumed === allDueDays.length, { resumed, expected: allDueDays.length });
  await InvestmentService.cancelInvestment(stopInv.id, admin, 'verify-daily-payouts cleanup');

  // B. Completing a capital withdrawal settles the daily profit first, then closes the investment
  console.log('\n-- completing a withdrawal settles the last profit days --');
  const settleInv = await InvestmentService.invest(investor.id, { planId: regular.id, amount, source: WalletBucket.CAPITAL });
  const settleStart = await backdateStart(settleInv.id, 9);
  const settleReq = await WithdrawalService.requestWithdrawal(investor.id, settleInv.id, {});
  await WithdrawalService.approveWithdrawal(settleReq.id, admin, {});
  const settleDays = payableWorkingDays(istDayKey(settleStart), payable, WORKING_DAYS_PER_MONTH);
  check('test setup: no profit credited yet for this investment', (await ProfitCredit.count({ where: { investment_id: settleInv.id } })) === 0 && settleDays.length > 0);
  const beforeSettle = await WalletService.getBalances(investor.id);
  const settled = await WithdrawalService.completeWithdrawal(settleReq.id, admin, { paymentReference: `VERIFY${Date.now()}` }, undefined);
  const settleCredits = await ProfitCredit.count({ where: { investment_id: settleInv.id } });
  check('every working day earned before the request was credited on completion', settleCredits === settleDays.length, { settleCredits, expected: settleDays.length });
  const afterSettle = await WalletService.getBalances(investor.id);
  check('profit wallet received those credits', near(afterSettle.profitBalance - beforeSettle.profitBalance, round2(expectedDaily * settleDays.length)));
  check('capital passed through the capital wallet and out again (balance unchanged)', near(afterSettle.capitalBalance, beforeSettle.capitalBalance));
  check(`withdrawal COMPLETED: gross ${amount}, fee ${feeOf(amount)}, net ${amount - feeOf(amount)}`, settled.status === WithdrawalStatus.COMPLETED && near(settled.feeAmount, feeOf(amount)) && near(settled.netAmount, amount - feeOf(amount)), { fee: settled.feeAmount, net: settled.netAmount });
  const settledInv = (await Investment.findByPk(settleInv.id))!;
  check('investment is COMPLETED with profit_credited = credits paid', settledInv.status === InvestmentStatus.COMPLETED && near(Number(settledInv.profit_credited), round2(expectedDaily * settleDays.length)), settledInv.profit_credited);
  await DailyPayoutService.run();
  check('a completed investment earns nothing more', (await ProfitCredit.count({ where: { investment_id: settleInv.id } })) === settleDays.length);

  if (lockedPlan) {
    const lockedAmount = Math.max(Number(lockedPlan.min_amount), Math.min(amount, Number(lockedPlan.max_amount)));
    const lockedDaily = Math.round((lockedAmount * Number(lockedPlan.profit_value)) / WORKING_DAYS_PER_MONTH) / 100;

    // C. The fee is charged on the capital only, not on profit granted by the admin on an early exit
    console.log('\n-- fee applies to capital only --');
    await fund(investor.id, toPaise(lockedAmount));
    const early = await InvestmentService.invest(investor.id, { planId: lockedPlan.id, amount: lockedAmount, source: WalletBucket.CAPITAL });
    await InvestmentService.setEarlyWithdrawal(early.id, true, admin);
    const earlyReq = await WithdrawalService.requestWithdrawal(investor.id, early.id, {});
    check('admin-opened early exit is accepted during the lock-in (capital only, fee on capital)', earlyReq.isEarly && near(earlyReq.totalAmount, lockedAmount) && near(earlyReq.feeAmount, feeOf(lockedAmount)), { total: earlyReq.totalAmount, fee: earlyReq.feeAmount });
    const granted = await WithdrawalService.approveWithdrawal(earlyReq.id, admin, { profitAmount: 100 });
    check('profit granted by the admin is paid without the fee: fee unchanged, net = capital + profit - fee', near(granted.profitAmount, 100) && near(granted.totalAmount, lockedAmount + 100) && near(granted.feeAmount, feeOf(lockedAmount)) && near(granted.netAmount, lockedAmount + 100 - feeOf(lockedAmount)), { total: granted.totalAmount, fee: granted.feeAmount, net: granted.netAmount });
    await WithdrawalService.rejectWithdrawal(earlyReq.id, admin, 'verify-daily-payouts cleanup');
    await InvestmentService.cancelInvestment(early.id, admin, 'verify-daily-payouts cleanup');

    // D. Fixed-term daily plan: maturity settles the remaining credits and returns the capital
    console.log('\n-- fixed-term maturity --');
    const term = await InvestmentService.invest(investor.id, { planId: lockedPlan.id, amount: lockedAmount, source: WalletBucket.CAPITAL });
    const termRow = (await Investment.findByPk(term.id))!;
    const termStart = new Date(Date.now() - (lockedPlan.duration_days + 3) * DAY);
    const termMaturity = new Date(termStart.getTime() + lockedPlan.duration_days * DAY);
    termRow.start_date = termStart;
    termRow.maturity_date = termMaturity;
    await termRow.save();
    // Whole months only: 365 days = 12 x 20 = 240 credits, never a partial 13th cycle
    const termDays = payableWorkingDays(istDayKey(termStart), istDayKey(termMaturity), WORKING_DAYS_PER_MONTH, maxCreditsForTerm(lockedPlan.duration_days)).length;
    const beforeMature = await WalletService.getBalances(investor.id);
    const maturedCount = await InvestmentService.matureDueInvestments(investor.id);
    check('the matured investment was settled', maturedCount === 1, maturedCount);
    const termCredits = await ProfitCredit.findAll({ where: { investment_id: term.id }, attributes: ['credit_day', 'cycle_no'] });
    check(`all ${termDays} paying days of the ${lockedPlan.duration_days}-day term were credited (20 per 30-day cycle, whole months only)`, termCredits.length === termDays, termCredits.length);
    check('no credit later than the maturity day', termCredits.every((c) => String(c.credit_day) <= istDayKey(termMaturity)));
    const perCycle = new Map<number, number>();
    termCredits.forEach((c) => perCycle.set(c.cycle_no, (perCycle.get(c.cycle_no) ?? 0) + 1));
    check('no cycle has more than 20 credits', [...perCycle.values()].every((n) => n <= WORKING_DAYS_PER_MONTH), Object.fromEntries(perCycle));
    const afterMature = await WalletService.getBalances(investor.id);
    check('capital returned to the CAPITAL wallet at maturity', near(afterMature.capitalBalance - beforeMature.capitalBalance, lockedAmount));
    check(`term profit (${termDays} x ${lockedDaily}) landed in the PROFIT wallet`, near(afterMature.profitBalance - beforeMature.profitBalance, round2(lockedDaily * termDays)), { gain: round2(afterMature.profitBalance - beforeMature.profitBalance) });
    const termFinal = (await Investment.findByPk(term.id))!;
    check('investment COMPLETED with profit_credited = total credits', termFinal.status === InvestmentStatus.COMPLETED && near(Number(termFinal.profit_credited), round2(lockedDaily * termDays)), termFinal.profit_credited);
    check('maturity is not settled twice', (await InvestmentService.matureDueInvestments(investor.id)) === 0);
  }

  // E. Maturity-paid plan: profit arrives with the capital and counts as profit earned
  console.log('\n-- maturity-paid plan --');
  const fixedPlan = await InvestmentPlanService.createPlan(
    { name: 'Verify Maturity Plan', minAmount: 1000, maxAmount: 100000, durationDays: 30, lockInDays: 30, profitType: ProfitType.PERCENTAGE, profitValue: 3, payoutMode: ProfitPayoutMode.AT_MATURITY, isActive: true },
    admin
  );
  await fund(investor.id, toPaise(10000));
  const fixedInv = await InvestmentService.invest(investor.id, { planId: fixedPlan.id, amount: 10000, source: WalletBucket.CAPITAL });
  check('maturity-paid plan: 3% of 10,000 = 300 expected, 10,300 at maturity', near(fixedInv.expectedProfit, 300) && near(fixedInv.maturityAmount, 10300), { expected: fixedInv.expectedProfit, maturity: fixedInv.maturityAmount });
  check('maturity-paid investment has no daily credit and (no lock-ins) can be closed any time', fixedInv.dailyProfit === 0 && fixedInv.nextCreditAt === null && !fixedInv.isLocked && fixedInv.canRequestWithdrawal);
  const fixedRow = (await Investment.findByPk(fixedInv.id))!;
  fixedRow.start_date = new Date(Date.now() - 31 * DAY);
  fixedRow.maturity_date = new Date(Date.now() - DAY);
  await fixedRow.save();
  const summaryBefore = await WalletService.getSummary(investor.id);
  const beforeFixed = await WalletService.getBalances(investor.id);
  await InvestmentService.matureDueInvestments(investor.id);
  const afterFixed = await WalletService.getBalances(investor.id);
  check('capital 10,000 back in the CAPITAL wallet', near(afterFixed.capitalBalance - beforeFixed.capitalBalance, 10000));
  check('profit 300 in the PROFIT wallet', near(afterFixed.profitBalance - beforeFixed.profitBalance, 300));
  const summaryAfter = await WalletService.getSummary(investor.id);
  check('wallet summary totalProfitEarned includes profit paid at maturity', near(summaryAfter.totalProfitEarned - summaryBefore.totalProfitEarned, 300), { before: summaryBefore.totalProfitEarned, after: summaryAfter.totalProfitEarned });
  const fixedFinal = (await Investment.findByPk(fixedInv.id))!;
  check('maturity-paid investment COMPLETED with profit_credited 300', fixedFinal.status === InvestmentStatus.COMPLETED && near(Number(fixedFinal.profit_credited), 300), fixedFinal.profit_credited);
  await InvestmentPlanService.setPlanStatus(fixedPlan.id, false, admin);

  const finalBalances = await WalletService.getBalances(investor.id);
  const wallet = (await Wallet.findOne({ where: { user_id: investor.id } }))!;
  check('wallet.balance = capital + profit', near(Number(wallet.balance), fromPaise(toPaise(finalBalances.capitalBalance) + toPaise(finalBalances.profitBalance))), finalBalances);

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  await sequelize.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
