/**
 * Unit Test Suite for MoonTech
 * Tests money utilities, investment calculations, working-day schedules,
 * validator schemas, and frontend-backend calculation parity in isolation.
 *
 * Run with: npx tsx scripts/unit-tests.ts
 */

declare const process: any;
import { toPaise, fromPaise, isValidMoney, formatInr, generateReference } from '../src/utils/money.js';
import {
  percentOfPaise,
  dailyProfitPaise,
  dailyRatePercent,
  weeklyProfitPaise,
  monthlyProfitPaise,
  calculateProfitPaise,
  payingDaysForTerm,
  profitDaysForTerm,
  termCreditCap,
} from '../src/services/investmentPlanService.js';
import {
  istDayKey,
  isWorkingDay,
  workingDaysBetween,
  countWorkingDaysBetween,
  addDaysToKey,
  cycleNoForDay,
  payableWorkingDays,
  maxCreditsForTerm,
  latestPayableDay,
  nextPayoutInstant,
  istTimeOnDay,
} from '../src/utils/workingDays.js';
import {
  investSchema,
  createInvestmentPlanSchema,
  changePasswordSchema,
  walletAdjustmentSchema,
  walletWithdrawalSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../src/validators/financeValidators.js';
import { maskEmail, maskPhone } from '../src/utils/mask.js';
import { identityHash } from '../src/utils/identityHash.js';
import { ProfitType, ProfitPayoutMode, RateBasis, WalletBucket } from '../src/types/index.js';
import { createCustomerSchema, ageOn } from '../src/validators/authValidators.js';
import { capitalFeePaise, capitalWithdrawalBreakdown } from '../src/services/investmentService.js';

// Frontend mirrored functions for parity checks
import {
  formatINR,
  formatINRShort,
  parseAmount,
  validateNewPassword,
  estimateProfit,
  dailyProfitFor,
} from '../../../frontend/src/lib/format.js';

let passed = 0;
let failed = 0;
const results: { category: string; name: string; pass: boolean; detail?: string }[] = [];

function assert(category: string, name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    results.push({ category, name, pass: true });
    console.log(`  \x1b[32m✔ PASS\x1b[0m [${category}] ${name}`);
  } else {
    failed++;
    results.push({ category, name, pass: false, detail });
    console.log(`  \x1b[31m✖ FAIL\x1b[0m [${category}] ${name} ${detail ? `(${detail})` : ''}`);
  }
}

console.log('\n======================================================');
console.log('         MOONTECH SOLUTIONS - UNIT TEST SUITE         ');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// 1. Money & Currency Utilities
// ---------------------------------------------------------------------------
console.log('\x1b[36m--- Group 1: Money & Currency Calculations ---\x1b[0m');
assert('Money', 'toPaise converts whole rupees correctly (₹100 -> 10000 paise)', toPaise(100) === 10000);
assert('Money', 'toPaise converts decimal rupees correctly (₹100.55 -> 10055 paise)', toPaise(100.55) === 10055);
assert('Money', 'toPaise handles string input ("250.75" -> 25075 paise)', toPaise('250.75') === 25075);
assert('Money', 'toPaise handles null/undefined/NaN safely as 0', toPaise(null) === 0 && toPaise(undefined) === 0 && toPaise('abc') === 0);

assert('Money', 'fromPaise converts integer paise to rupees (10055 -> ₹100.55)', fromPaise(10055) === 100.55);
assert('Money', 'fromPaise handles 0 paise -> 0', fromPaise(0) === 0);

assert('Money', 'isValidMoney allows valid positive amounts with <= 2 decimals', isValidMoney(1000) && isValidMoney(50.25) && isValidMoney(0.01));
assert('Money', 'isValidMoney rejects negative or zero amounts', !isValidMoney(0) && !isValidMoney(-10));
assert('Money', 'isValidMoney rejects amounts with > 2 decimal places (50.123)', !isValidMoney(50.123));

const ref = generateReference('INV');
assert('Money', 'generateReference generates valid human-readable reference starting with prefix', ref.startsWith('INV-') && ref.length > 15);

// ---------------------------------------------------------------------------
// 2. Investment Return Calculations
// ---------------------------------------------------------------------------
console.log('\n\x1b[36m--- Group 2: Investment Plan Return Math ---\x1b[0m');
// 5% of ₹10,000 (10,000 * 100 = 1,000,000 paise). 5% = 50,000 paise (₹500).
const paiseAmount = 1000000;
const percent5Paise = percentOfPaise(paiseAmount, 5);
assert('Returns', 'percentOfPaise calculates 5% of ₹10,000 as ₹500 (50,000 paise)', percent5Paise === 50000);

// Legacy per-day plans: the percentage itself every working day
const dailyTerms = {
  profit_type: ProfitType.PERCENTAGE,
  profit_value: 5,
  payout_mode: ProfitPayoutMode.DAILY,
  rate_basis: RateBasis.PER_DAY,
};
assert('Returns', 'dailyProfitPaise evaluates daily profit correctly for a legacy 5% per-day plan', dailyProfitPaise(dailyTerms, paiseAmount) === 50000);

// Daily calculation across dates: 10 calendar days with known working days
const start = new Date('2026-10-12T00:00:00.000Z'); // Monday
const maturity = new Date('2026-10-23T00:00:00.000Z'); // Friday (10 working days between)
const expectedWorkingDays = 9; // strict interval strictly after Oct 12 up to Oct 23 = 9 working days
const totalDailyProfit = calculateProfitPaise(dailyTerms, paiseAmount, { startDate: start, maturityDate: maturity });
assert('Returns', 'calculateProfitPaise for DAILY payout multiplies daily profit by working days', totalDailyProfit === 50000 * expectedWorkingDays);

// Monthly-rate plans: 1,00,000 at 5% / month -> 5,000 a month -> 1,250 a week -> 250 a working day
const lakhPaise = 10000000;
const monthlyTerms = {
  profit_type: ProfitType.PERCENTAGE,
  profit_value: 5,
  payout_mode: ProfitPayoutMode.DAILY,
  rate_basis: RateBasis.PER_MONTH,
};
assert('Returns', 'Regular Plan: 1,00,000 at 5%/month credits 250 per working day', dailyProfitPaise(monthlyTerms, lakhPaise) === 25000);
assert('Returns', 'Regular Plan: 1,250 per week (5 working days)', weeklyProfitPaise(monthlyTerms, lakhPaise) === 125000);
assert('Returns', 'Regular Plan: 5,000 per month (20 credits)', monthlyProfitPaise(monthlyTerms, lakhPaise) === 500000);
const depositTerms = { ...monthlyTerms, profit_value: 6 };
assert('Returns', 'Deposit Plan: 1,00,000 at 6%/month credits 300 per working day', dailyProfitPaise(depositTerms, lakhPaise) === 30000);
assert('Returns', 'Deposit Plan: 6,000 per month', monthlyProfitPaise(depositTerms, lakhPaise) === 600000);
assert('Returns', '5% / month = 0.25% per working day', dailyRatePercent(monthlyTerms) === 0.25);
assert('Returns', '6% / month = 0.30% per working day', dailyRatePercent(depositTerms) === 0.3);
assert('Returns', '0.25% of 1,00,000 = 250 = the daily credit', Math.round(lakhPaise * dailyRatePercent(monthlyTerms) / 100) === dailyProfitPaise(monthlyTerms, lakhPaise));
assert('Returns', '0.30% of 1,00,000 = 300 = the daily credit', Math.round(lakhPaise * dailyRatePercent(depositTerms) / 100) === dailyProfitPaise(depositTerms, lakhPaise));
const yearlyTerms = { ...monthlyTerms, rate_basis: RateBasis.PER_YEAR, profit_value: 6 };
assert('Returns', 'PER_YEAR basis: 1,00,000 at 6%/year credits 25 per working day', dailyProfitPaise(yearlyTerms, lakhPaise) === 2500);
assert('Returns', 'Open-ended monthly plan has no fixed total profit', calculateProfitPaise(monthlyTerms, lakhPaise, { startDate: start, maturityDate: null }) === 0);

// 20-credit cap per 30-day cycle: a 30-day term never pays more than one month of profit
const cycleStart = new Date('2026-10-01T00:00:00.000Z'); // Thursday; 1 Oct - 31 Oct has 22 weekdays after the 1st
const cycleEnd = new Date('2026-10-31T00:00:00.000Z');
const uncapped = workingDaysBetween(istDayKey(cycleStart), istDayKey(cycleEnd)).length;
const capped = payingDaysForTerm(monthlyTerms, cycleStart, cycleEnd).length;
assert('Returns', 'a 30-day cycle has more than 20 weekdays without the cap', uncapped > 20);
assert('Returns', 'monthly plans pay exactly 20 credits in a 30-day cycle', capped === 20);
assert(
  'Returns',
  'Regular Plan pays exactly 5,000 over one 30-day cycle',
  calculateProfitPaise(monthlyTerms, lakhPaise, { startDate: cycleStart, maturityDate: cycleEnd }) === 500000
);
assert('Returns', 'legacy per-day plans are not capped', payingDaysForTerm(dailyTerms, cycleStart, cycleEnd).length === uncapped);
assert('Returns', 'cycleNoForDay: days 1-30 are cycle 0', cycleNoForDay('2026-10-01', '2026-10-02') === 0 && cycleNoForDay('2026-10-01', '2026-10-31') === 0);
assert('Returns', 'cycleNoForDay: day 31 starts cycle 1', cycleNoForDay('2026-10-01', '2026-11-01') === 1);
const twoCycles = payableWorkingDays('2026-10-01', '2026-11-30', 20);
assert('Returns', 'payableWorkingDays caps every cycle at 20 (two cycles = 40)', twoCycles.length === 40);

// Fixed terms pay whole months only: 365 days = 12 months = 240 credits, never a partial 13th cycle
assert('Returns', 'maxCreditsForTerm: 365 days -> 240 credits (12 months)', maxCreditsForTerm(365) === 240);
assert('Returns', 'maxCreditsForTerm: 30 days -> 20 credits', maxCreditsForTerm(30) === 20);
assert('Returns', 'maxCreditsForTerm: 59 days -> 20 credits (one whole month)', maxCreditsForTerm(59) === 20);
assert('Returns', 'maxCreditsForTerm: 15 days -> 10 credits (proportional under a month)', maxCreditsForTerm(15) === 10);
assert('Returns', 'maxCreditsForTerm: open-ended (0) has no cap', maxCreditsForTerm(0) === undefined);
const yearStart = new Date(2026, 9, 22); // 22 Oct 2026 local
const yearEnd = new Date(2027, 9, 22);
const yearDepositTerms = { ...monthlyTerms, profit_value: 6, duration_days: 365 };
assert(
  'Returns',
  'Deposit Plan: 365-day term pays exactly 240 credits',
  profitDaysForTerm(yearDepositTerms, yearStart, yearEnd) === 240,
  String(profitDaysForTerm(yearDepositTerms, yearStart, yearEnd))
);
assert(
  'Returns',
  'Deposit Plan: 1,00,000 at 6% / month earns 72,000 in a year (300 x 240), not 73,200',
  calculateProfitPaise(yearDepositTerms, lakhPaise, { startDate: yearStart, maturityDate: yearEnd }) === 7200000
);
assert(
  'Returns',
  'termCreditCap: legacy per-day plans and open-ended plans have no total cap',
  termCreditCap(dailyTerms) === undefined && termCreditCap({ ...monthlyTerms, duration_days: 0 }) === undefined
);
assert('Returns', 'payableWorkingDays honours maxCredits', payableWorkingDays('2026-10-01', '2026-11-30', 20, 25).length === 25);

// Capital withdrawal fee: 1,00,000 -> 5,000 fee -> 95,000 net
assert('Returns', 'capital withdrawal fee of 5% on 1,00,000 is 5,000', capitalFeePaise(lakhPaise, 5) === 500000);
assert('Returns', 'capital withdrawal fee of 0% is 0', capitalFeePaise(lakhPaise, 0) === 0);
const plainClose = capitalWithdrawalBreakdown(lakhPaise, 0, 5);
assert(
  'Returns',
  'capital withdrawal breakdown: 1,00,000 gross -> 5,000 fee -> 95,000 net',
  plainClose.grossPaise === lakhPaise && plainClose.feePaise === 500000 && plainClose.netPaise === 9500000
);
const closeWithProfit = capitalWithdrawalBreakdown(lakhPaise, 1000000, 5);
assert(
  'Returns',
  'the fee is charged on the capital only, never on profit paid with it (1,00,000 + 10,000 profit -> fee 5,000, net 1,05,000)',
  closeWithProfit.grossPaise === 11000000 && closeWithProfit.feePaise === 500000 && closeWithProfit.netPaise === 10500000
);

// Forgot / reset password: email only
assert('Security', 'forgot password is email-only: a mobile number is rejected', !forgotPasswordSchema.safeParse({ email: '9876543210' }).success);
assert('Security', 'forgot password accepts and lower-cases an email', (() => { const r = forgotPasswordSchema.safeParse({ email: ' Rahul@Example.com ' }); return r.success && r.data.email === 'rahul@example.com'; })());
assert('Security', 'reset password needs a 6-digit code', !resetPasswordSchema.safeParse({ email: 'a@b.co', otp: '12345', newPassword: 'Secret123' }).success);
assert('Security', 'maskEmail hides the local part', maskEmail('rahul.sharma@gmail.com') === 'r******a@gmail.com');
assert('Security', 'maskPhone keeps only the last four digits', maskPhone('+919876543210') === 'XXXXXX3210');
assert('Security', 'identityHash normalises case and spacing', identityHash(' abcde1234f ') === identityHash('ABCDE1234F'));
assert('Security', 'identityHash of an empty value is null', identityHash('') === null);

// Fixed Profit Plan
const fixedTerms = {
  profit_type: ProfitType.FIXED,
  profit_value: 2500,
  payout_mode: ProfitPayoutMode.AT_MATURITY,
};
assert('Returns', 'calculateProfitPaise for FIXED plan returns fixed amount in paise (₹2500 -> 250000 paise)', calculateProfitPaise(fixedTerms, paiseAmount) === 250000);

// At Maturity Percentage Plan
const maturityTerms = {
  profit_type: ProfitType.PERCENTAGE,
  profit_value: 12,
  payout_mode: ProfitPayoutMode.AT_MATURITY,
};
assert('Returns', 'calculateProfitPaise for AT_MATURITY percentage calculates total profit correctly (12% of ₹10,000 = ₹1,200)', calculateProfitPaise(maturityTerms, paiseAmount) === 120000);

// ---------------------------------------------------------------------------
// 3. Indian Standard Time (IST) Working Days Schedule
// ---------------------------------------------------------------------------
console.log('\n\x1b[36m--- Group 3: IST Calendar & Working Days Schedule ---\x1b[0m');
assert('Schedule', 'isWorkingDay identifies Monday as working day', isWorkingDay('2026-10-12') === true);
assert('Schedule', 'isWorkingDay identifies Friday as working day', isWorkingDay('2026-10-16') === true);
assert('Schedule', 'isWorkingDay identifies Saturday as weekend (skipped)', isWorkingDay('2026-10-17') === false);
assert('Schedule', 'isWorkingDay identifies Sunday as weekend (skipped)', isWorkingDay('2026-10-18') === false);

const monToFriDays = workingDaysBetween('2026-10-12', '2026-10-16');
assert('Schedule', 'workingDaysBetween strictly counts days after start up to end (Tue, Wed, Thu, Fri = 4 days)', monToFriDays.length === 4);
assert('Schedule', 'countWorkingDaysBetween skips Saturday and Sunday over a full weekend', countWorkingDaysBetween('2026-10-16', '2026-10-19') === 1); // Only Monday Oct 19

assert('Schedule', 'addDaysToKey shifts calendar days accurately across month boundaries', addDaysToKey('2026-10-30', 2) === '2026-11-01');

// Payout timing: a working day's credit falls due at 06:00 IST (00:30 UTC) on that day
assert('Schedule', 'istTimeOnDay: 6 AM IST on 13 Oct 2026 is 00:30 UTC', istTimeOnDay('2026-10-13', 6).toISOString() === '2026-10-13T00:30:00.000Z');
assert('Schedule', 'latestPayableDay just before 6 AM IST is still the previous day', latestPayableDay(new Date('2026-10-13T00:29:59.000Z')) === '2026-10-12');
assert('Schedule', 'latestPayableDay at 6 AM IST is the current IST day', latestPayableDay(new Date('2026-10-13T00:30:00.000Z')) === '2026-10-13');
assert('Schedule', 'latestPayableDay uses the IST calendar date (00:00 IST = previous UTC day)', latestPayableDay(new Date('2026-10-13T18:30:00.000Z')) === '2026-10-13');
assert('Schedule', 'nextPayoutInstant after Friday is Monday 6 AM IST (weekend skipped)', nextPayoutInstant('2026-10-16').toISOString() === '2026-10-19T00:30:00.000Z');

// "Profit stops at the withdrawal request": only days already due at the request instant are paid
const requestedBeforePayout = latestPayableDay(new Date('2026-10-13T00:29:59.000Z')); // Tue 05:59 IST
const requestedAfterPayout = latestPayableDay(new Date('2026-10-13T00:30:00.000Z')); // Tue 06:00 IST
assert('Schedule', 'a request before 6 AM does not earn that day', payableWorkingDays('2026-10-01', requestedBeforePayout, 20).pop() === '2026-10-12');
assert('Schedule', 'a request after 6 AM keeps that day (already credited)', payableWorkingDays('2026-10-01', requestedAfterPayout, 20).pop() === '2026-10-13');
assert('Schedule', 'a request on Saturday keeps Friday as the last paid day', payableWorkingDays('2026-10-01', latestPayableDay(new Date('2026-10-17T06:00:00.000Z')), 20).pop() === '2026-10-16');

// ---------------------------------------------------------------------------
// 4. Frontend Formatting & Validation Parity
// ---------------------------------------------------------------------------
console.log('\n\x1b[36m--- Group 4: Frontend-Backend Calculation & Formatting Parity ---\x1b[0m');
assert('Frontend', 'formatINR correctly formats standard amount with commas and symbol', formatINR(10000).replace(/\s/g, '').includes('10,000.00'));
assert('Frontend', 'formatINRShort produces compact rupee format without forced decimals', formatINRShort(10000).replace(/\s/g, '').includes('10,000'));
assert('Frontend', 'formatINR safely handles enormous numbers > 1e12 without runaway string length', formatINR(1e15).length < 20);

// parseAmount
const validParse = parseAmount('15000.50');
assert('Frontend', 'parseAmount parses valid rupee decimal input', validParse.value === 15000.5 && validParse.error === '');

const commaParse = parseAmount('1,50,000');
assert('Frontend', 'parseAmount handles commas in input gracefully', commaParse.value === 150000 && commaParse.error === '');

const invalidParse = parseAmount('10.999');
assert('Frontend', 'parseAmount rejects input with > 2 decimal places', invalidParse.value === null && invalidParse.error.length > 0);

const negativeParse = parseAmount('-500');
assert('Frontend', 'parseAmount rejects negative amounts', negativeParse.value === null && negativeParse.error.length > 0);

// validateNewPassword
assert('Frontend', 'validateNewPassword accepts strong password meeting length, letter, digit requirements', validateNewPassword('Invest2026') === '');
assert('Frontend', 'validateNewPassword rejects password shorter than 8 characters', validateNewPassword('short1').length > 0);
assert('Frontend', 'validateNewPassword rejects password without digits', validateNewPassword('onlyletters').length > 0);
assert('Frontend', 'validateNewPassword rejects password without letters', validateNewPassword('12345678').length > 0);

// estimateProfit in frontend
const planMock = {
  profitType: 'PERCENTAGE' as const,
  profitValue: 5,
  payoutMode: 'DAILY' as const,
  rateBasis: 'PER_DAY' as const,
  durationDays: 30,
};
assert('Frontend', 'dailyProfitFor correctly calculates legacy per-day earnings', dailyProfitFor(planMock, 10000) === 500);
const monthlyPlanMock = { ...planMock, rateBasis: 'PER_MONTH' as const, durationDays: 0 };
assert('Frontend', 'dailyProfitFor mirrors the server: 1,00,000 at 5%/month = 250 a day', dailyProfitFor(monthlyPlanMock, 100000) === 250);
assert('Frontend', 'estimateProfit returns 0 for open-ended plans (no fixed total)', estimateProfit(monthlyPlanMock, 100000) === 0);
assert(
  'Frontend',
  'estimateProfit mirrors the 20-credit cap for a 30-day monthly plan (5,000 on 1,00,000)',
  estimateProfit({ ...monthlyPlanMock, durationDays: 30 }, 100000, new Date(2026, 9, 1)) === 5000
);

// ---------------------------------------------------------------------------
// 5. Zod Validator Schemas (Backend API Boundary)
// ---------------------------------------------------------------------------
console.log('\n\x1b[36m--- Group 5: Zod API Input Validator Schemas ---\x1b[0m');

// investSchema
const validInvest = investSchema.safeParse({ planId: 5, amount: 10000 });
assert('Validators', 'investSchema validates valid investment payload', validInvest.success === true);
assert('Validators', 'investSchema defaults the paying wallet to CAPITAL', validInvest.success && validInvest.data.source === WalletBucket.CAPITAL);
assert('Validators', 'investSchema accepts re-investing from the PROFIT wallet', investSchema.safeParse({ planId: 5, amount: 10000, source: 'PROFIT' }).success === true);
assert('Validators', 'investSchema rejects an unknown source wallet', investSchema.safeParse({ planId: 5, amount: 10000, source: 'BONUS' }).success === false);

// walletWithdrawalSchema: profit needs an amount, capital is withdrawn in full
assert('Validators', 'walletWithdrawalSchema defaults to a PROFIT withdrawal', (() => { const r = walletWithdrawalSchema.safeParse({ amount: 1000 }); return r.success && r.data.bucket === WalletBucket.PROFIT; })());
assert('Validators', 'walletWithdrawalSchema requires an amount for PROFIT withdrawals', walletWithdrawalSchema.safeParse({ bucket: 'PROFIT' }).success === false);
assert('Validators', 'walletWithdrawalSchema accepts a CAPITAL withdrawal without an amount (full balance)', walletWithdrawalSchema.safeParse({ bucket: 'CAPITAL' }).success === true);

const invalidInvestAmount = investSchema.safeParse({ planId: 5, amount: -500 });
assert('Validators', 'investSchema rejects negative investment amount', invalidInvestAmount.success === false);

const invalidInvestPlan = investSchema.safeParse({ planId: 'not-an-id', amount: 10000 });
assert('Validators', 'investSchema rejects non-integer planId', invalidInvestPlan.success === false);

// createInvestmentPlanSchema
const validPlanPayload = {
  name: 'Ultra Yield Plan',
  description: 'High return plan',
  minAmount: 10000,
  maxAmount: 1000000,
  durationDays: 60,
  profitType: ProfitType.PERCENTAGE,
  profitValue: 5.5,
  payoutMode: ProfitPayoutMode.DAILY,
  isActive: true,
  isFeatured: true,
};
assert('Validators', 'createInvestmentPlanSchema accepts valid plan creation payload', createInvestmentPlanSchema.safeParse(validPlanPayload).success === true);

const openEndedPlanPayload = { ...validPlanPayload, durationDays: 0, lockInDays: 0, rateBasis: RateBasis.PER_MONTH };
assert('Validators', 'createInvestmentPlanSchema accepts an open-ended (0 day) daily plan', createInvestmentPlanSchema.safeParse(openEndedPlanPayload).success === true);
const invalidPlanPayload = { ...validPlanPayload, durationDays: -1 };
assert('Validators', 'createInvestmentPlanSchema rejects a negative duration', createInvestmentPlanSchema.safeParse(invalidPlanPayload).success === false);
assert('Validators', 'createInvestmentPlanSchema rejects an unknown rate basis', createInvestmentPlanSchema.safeParse({ ...validPlanPayload, rateBasis: 'PER_HOUR' }).success === false);

// changePasswordSchema
assert('Validators', 'changePasswordSchema accepts valid change password payload', changePasswordSchema.safeParse({ currentPassword: 'OldPassword1', newPassword: 'NewPassword123' }).success === true);
assert('Validators', 'changePasswordSchema rejects empty new password', changePasswordSchema.safeParse({ currentPassword: 'OldPassword1', newPassword: '' }).success === false);

// walletAdjustmentSchema
assert('Validators', 'walletAdjustmentSchema accepts valid CREDIT adjustment payload', walletAdjustmentSchema.safeParse({ direction: 'CREDIT', amount: 5000, reason: 'Promotional bonus' }).success === true);
assert('Validators', 'walletAdjustmentSchema defaults the bucket to PROFIT', (() => { const r = walletAdjustmentSchema.safeParse({ direction: 'CREDIT', amount: 5000, reason: 'Promotional bonus' }); return r.success && r.data.bucket === WalletBucket.PROFIT; })());
assert('Validators', 'walletAdjustmentSchema accepts a CAPITAL bucket', walletAdjustmentSchema.safeParse({ direction: 'CREDIT', bucket: 'CAPITAL', amount: 5000, reason: 'Manual deposit' }).success === true);
assert('Validators', 'walletAdjustmentSchema rejects negative adjustment amount', walletAdjustmentSchema.safeParse({ direction: 'DEBIT', amount: -500, reason: 'Correction' }).success === false);


// ---------------------------------------------------------------- Admin "Add Customer" validation
const validCustomer = { name: 'Ramesh Chandra', email: 'Ramesh@Example.com', phone: '+91 98765-43210' };
const customerOk = (extra: Record<string, unknown>) => createCustomerSchema.safeParse({ ...validCustomer, ...extra }).success;
const customerFieldError = (extra: Record<string, unknown>, field: string) => {
  const r = createCustomerSchema.safeParse({ ...validCustomer, ...extra });
  return !r.success && r.error.errors.some((e) => e.path.join('.') === field);
};
const yearsAgo = (years: number, extraDays = 0) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() + extraDays);
  return d.toISOString().slice(0, 10);
};

assert('CreateCustomer', 'accepts the minimal valid payload', customerOk({}));
assert('CreateCustomer', 'lower-cases and trims the email', (() => { const r = createCustomerSchema.safeParse(validCustomer); return r.success && r.data.email === 'ramesh@example.com'; })());
assert('CreateCustomer', 'strips spaces and dashes from the phone', (() => { const r = createCustomerSchema.safeParse(validCustomer); return r.success && r.data.phone === '+919876543210'; })());
assert('CreateCustomer', 'rejects a name with digits', customerFieldError({ name: 'Ramesh 123' }, 'name'));
assert('CreateCustomer', 'rejects a one-letter name', customerFieldError({ name: 'R' }, 'name'));
assert('CreateCustomer', 'accepts a name with a dot and apostrophe', customerOk({ name: "S. D'Souza" }));
assert('CreateCustomer', 'rejects an invalid email', customerFieldError({ email: 'not-an-email' }, 'email'));
assert('CreateCustomer', 'rejects a 10-digit number starting with 5', customerFieldError({ phone: '5876543210' }, 'phone'));
assert('CreateCustomer', 'rejects a 9-digit phone', customerFieldError({ phone: '987654321' }, 'phone'));
assert('CreateCustomer', 'accepts a plain 10-digit mobile', customerOk({ phone: '9876543210' }));
assert('CreateCustomer', 'accepts a 0-prefixed mobile', customerOk({ phone: '09876543210' }));
assert('CreateCustomer', 'treats a blank password as not provided', (() => { const r = createCustomerSchema.safeParse({ ...validCustomer, password: '' }); return r.success && r.data.password === undefined; })());
assert('CreateCustomer', 'rejects a 7-character password', customerFieldError({ password: 'abc1234' }, 'password'));
assert('CreateCustomer', 'rejects a password without a digit', customerFieldError({ password: 'abcdefgh' }, 'password'));
assert('CreateCustomer', 'rejects a password with spaces', customerFieldError({ password: 'abcd 1234' }, 'password'));
assert('CreateCustomer', 'accepts a strong password', customerOk({ password: 'Moon@2026' }));
assert('CreateCustomer', 'upper-cases the referral code', (() => { const r = createCustomerSchema.safeParse({ ...validCustomer, referralNumber: 'rahu1001' }); return r.success && r.data.referralNumber === 'RAHU1001'; })());
assert('CreateCustomer', 'rejects a malformed referral code', customerFieldError({ referralNumber: 'RAH-1001' }, 'referralNumber'));
assert('CreateCustomer', 'treats a blank referral code as not provided', (() => { const r = createCustomerSchema.safeParse({ ...validCustomer, referralNumber: '  ' }); return r.success && r.data.referralNumber === undefined; })());
assert('CreateCustomer', 'accepts an adult date of birth', customerOk({ dateOfBirth: yearsAgo(30) }));
assert('CreateCustomer', 'rejects a customer younger than 18', customerFieldError({ dateOfBirth: yearsAgo(18, 1) }, 'dateOfBirth'));
assert('CreateCustomer', 'accepts a customer exactly 18 today', customerOk({ dateOfBirth: yearsAgo(18) }));
assert('CreateCustomer', 'rejects a future date of birth', customerFieldError({ dateOfBirth: yearsAgo(-1) }, 'dateOfBirth'));
assert('CreateCustomer', 'rejects an impossible calendar date', customerFieldError({ dateOfBirth: '1990-02-30' }, 'dateOfBirth'));
assert('CreateCustomer', 'rejects a non-ISO date', customerFieldError({ dateOfBirth: '30/01/1990' }, 'dateOfBirth'));
assert('CreateCustomer', 'rejects an unrealistic age', customerFieldError({ dateOfBirth: '1850-01-01' }, 'dateOfBirth'));
assert('CreateCustomer', 'ageOn counts a birthday that has not happened yet this year', ageOn(new Date('2000-12-31T00:00:00Z'), new Date('2026-10-21T00:00:00Z')) === 25);
assert('CreateCustomer', 'rejects a pincode starting with 0', customerFieldError({ pincode: '012345' }, 'pincode'));
assert('CreateCustomer', 'rejects a 5-digit pincode', customerFieldError({ pincode: '64100' }, 'pincode'));
assert('CreateCustomer', 'accepts a valid pincode', customerOk({ pincode: '641001' }));
assert('CreateCustomer', 'rejects a city with digits', customerFieldError({ city: 'Coimbatore 641' }, 'city'));
assert('CreateCustomer', 'rejects a one-letter state', customerFieldError({ state: 'T' }, 'state'));
assert('CreateCustomer', 'rejects a too-short address', customerFieldError({ address: '12' }, 'address'));
assert('CreateCustomer', 'accepts blank optional fields', customerOk({ address: '', city: '', state: '', pincode: '', dateOfBirth: '' }));
assert('CreateCustomer', 'reports every invalid field at once', (() => { const r = createCustomerSchema.safeParse({ name: '1', email: 'x', phone: '1' }); return !r.success && new Set(r.error.errors.map((e) => e.path[0])).size === 3; })());

console.log('\n======================================================');
console.log(`UNIT TEST RESULTS: \x1b[32m${passed} PASSED\x1b[0m, \x1b[31m${failed} FAILED\x1b[0m (Total: ${passed + failed})`);
console.log('======================================================\n');

process.exit(failed > 0 ? 1 : 0);
