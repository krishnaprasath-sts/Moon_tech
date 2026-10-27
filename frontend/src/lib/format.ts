import type { InvestmentPlan, ProfitPayoutMode, ProfitType, RateBasis, TransactionType, WalletBucket } from '@/lib/api';

export function formatINR(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '₹0.00';
  if (Math.abs(amount) > 1e12) {
    return `${amount < 0 ? '-' : ''}₹${amount.toExponential(2)}`;
  }
  const formatted = Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount < 0 ? '-' : ''}₹${formatted}`;
}

/** Compact rupee amount without forced decimals, for ranges such as "₹5,000 – ₹2,00,000". */
export function formatINRShort(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '₹0';
  if (Math.abs(amount) > 1e12) {
    return `₹${amount.toExponential(2)}`;
  }
  return `₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Date-only strings are calendar dates: pin them to local midnight so they do not shift a day.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatRelativeTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

/** "ACTIVE" -> "Active", "WITHDRAWAL_REQUESTED" -> "Withdrawal Requested" */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** "5% / month", "6% / year", "5% daily" (legacy) or "7%" for maturity-paid plans */
export function formatProfit(
  profitType: ProfitType,
  profitValue: number,
  payoutMode?: ProfitPayoutMode,
  rateBasis?: RateBasis | null
): string {
  if (profitType === 'FIXED') return `${formatINRShort(profitValue)} fixed`;
  const pct = `${Number(profitValue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
  if (payoutMode === 'MONTHLY') return `${pct} / month`;
  if (payoutMode !== 'DAILY') return pct;
  if (rateBasis === 'PER_MONTH') return `${pct} / month`;
  if (rateBasis === 'PER_YEAR') return `${pct} / year`;
  return `${pct} daily`;
}

type RateTerms = Pick<InvestmentPlan, 'profitValue' | 'payoutMode'> & { rateBasis?: RateBasis | null };
type PlanTerms = Pick<InvestmentPlan, 'profitType' | 'profitValue' | 'payoutMode' | 'durationDays'> & {
  rateBasis?: RateBasis | null;
};

export const PAYOUT_TIME_LABEL = '6:00 AM';
/** Monthly profit is paid as 4 weeks x 5 working days of equal credits */
export const CREDITS_PER_MONTH = 20;
export const CREDITS_PER_WEEK = 5;
const CYCLE_DAYS = 30;

/**
 * Total credits a fixed-term monthly plan pays: whole months only, so 365 days = 12 x 20 = 240
 * credits (mirrors the server). Terms under a month pay a proportional share; 0 = no cap.
 */
export function maxCreditsForTerm(durationDays: number): number | undefined {
  const days = Math.floor(Number(durationDays) || 0);
  if (days <= 0) return undefined;
  const fullCycles = Math.floor(days / CYCLE_DAYS);
  if (fullCycles === 0) return Math.max(1, Math.round((days / CYCLE_DAYS) * CREDITS_PER_MONTH));
  return fullCycles * CREDITS_PER_MONTH;
}

export const BUCKET_LABELS: Record<WalletBucket, string> = {
  CAPITAL: 'Capital wallet',
  PROFIT: 'Profit wallet',
};

export function isDailyPlan(plan: Pick<InvestmentPlan, 'payoutMode'>): boolean {
  return plan.payoutMode === 'DAILY';
}

export function isMonthlyPlan(plan: Pick<InvestmentPlan, 'payoutMode'>): boolean {
  return plan.payoutMode === 'MONTHLY';
}

export function isOpenEndedPlan(plan: Pick<InvestmentPlan, 'durationDays'>): boolean {
  return Number(plan.durationDays) === 0;
}

/** Per-working-day % of the capital: 5% / month -> 0.25, 6% / month -> 0.3 (mirrors the server) */
export function dailyRatePercentFor(plan: RateTerms): number {
  const rate = Number(plan.profitValue) || 0;
  const basis = plan.rateBasis ?? 'PER_DAY';
  const divisor = basis === 'PER_MONTH' ? CREDITS_PER_MONTH : basis === 'PER_YEAR' ? 12 * CREDITS_PER_MONTH : 1;
  return Math.round((rate / divisor) * 10000) / 10000;
}

/** "0.25% per working day" */
export function formatDailyRate(plan: RateTerms): string {
  const pct = dailyRatePercentFor(plan);
  return `${pct.toLocaleString('en-IN', { maximumFractionDigits: 4 })}% per working day`;
}

/** Short caption under the headline rate on a plan card */
export function profitCaption(plan: Pick<InvestmentPlan, 'profitType' | 'payoutMode' | 'profitValue'> & { rateBasis?: RateBasis | null }): string {
  if (isMonthlyPlan(plan)) {
    return `credited monthly on your start date at ${PAYOUT_TIME_LABEL}`;
  }
  if (isDailyPlan(plan)) {
    return plan.rateBasis && plan.rateBasis !== 'PER_DAY'
      ? `= ${formatDailyRate(plan)}, credited at ${PAYOUT_TIME_LABEL}`
      : `on your capital, credited every working day at ${PAYOUT_TIME_LABEL}`;
  }
  return plan.profitType === 'FIXED' ? 'expected profit at maturity' : 'expected profit over the term';
}

/** How and when the customer receives money under this plan */
export function payoutDescription(plan: Pick<InvestmentPlan, 'payoutMode' | 'durationDays'>): string {
  if (isMonthlyPlan(plan)) {
    return `Profit credited monthly on your start date · capital back at maturity`;
  }
  if (isDailyPlan(plan)) {
    return isOpenEndedPlan(plan)
      ? `Profit daily (Mon–Fri, ${PAYOUT_TIME_LABEL}) · capital returned when you close the plan`
      : `Profit daily (Mon–Fri, ${PAYOUT_TIME_LABEL}) · capital back at maturity`;
  }
  return 'Capital + profit at maturity';
}

/** "Withdraw any time" (lock-ins are no longer used; legacy plans may still carry one) */
export function lockInDescription(plan: Pick<InvestmentPlan, 'lockInDays'>): string {
  const days = Number(plan.lockInDays) || 0;
  return days > 0 ? `Capital locked for ${formatDuration(days)}` : 'Withdraw any time';
}

/** One-line term summary for a plan card header: "No fixed term · withdraw any time", "1 year (365 days) · withdraw any time" */
export function termSummary(plan: Pick<InvestmentPlan, 'durationDays' | 'lockInDays'>): string {
  const term = isOpenEndedPlan(plan) ? 'No fixed term' : formatDuration(plan.durationDays);
  const lock = Number(plan.lockInDays) || 0;
  if (lock === 0) return `${term} · withdraw any time`;
  if (!isOpenEndedPlan(plan) && lock === Number(plan.durationDays)) return `${term} · capital locked for the full term`;
  return `${term} · capital locked for ${formatDuration(lock)}`;
}

/** Monday-Friday only, matching the server's IST working-day calendar */
export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/**
 * Working days strictly after `start` up to and including `start + durationDays`.
 * Display-only mirror of the server calculation.
 */
export function countWorkingDays(start: Date, durationDays: number): number {
  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 1; i <= durationDays; i += 1) {
    cursor.setDate(cursor.getDate() + 1);
    if (isWorkingDay(cursor)) count += 1;
  }
  return count;
}

/**
 * Working days that actually pay under a monthly plan: at most 20 per 30-day cycle, so a month
 * never pays more than the plan rate, and whole months only over a fixed term (365 days = 240).
 * Legacy per-day plans pay every working day.
 */
export function countPayingDays(plan: RateTerms, start: Date, durationDays: number): number {
  if ((plan.rateBasis ?? 'PER_DAY') === 'PER_DAY') return countWorkingDays(start, durationDays);
  const maxCredits = maxCreditsForTerm(durationDays);
  const perCycle = new Map<number, number>();
  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 1; i <= durationDays; i += 1) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWorkingDay(cursor)) continue;
    const cycle = Math.floor((i - 1) / CYCLE_DAYS);
    const used = perCycle.get(cycle) ?? 0;
    if (used >= CREDITS_PER_MONTH) continue;
    perCycle.set(cycle, used + 1);
    count += 1;
    if (maxCredits !== undefined && count >= maxCredits) break;
  }
  return count;
}

/** Profit credited on each working day for a DAILY plan (monthly rate / 20, yearly rate / 240) */
export function dailyProfitFor(plan: RateTerms, amount: number): number {
  if (!isDailyPlan(plan) || !Number.isFinite(amount) || amount <= 0) return 0;
  const percentPaise = Math.round(amount * (Number(plan.profitValue) || 0));
  const basis = plan.rateBasis ?? 'PER_DAY';
  const divisor = basis === 'PER_MONTH' ? CREDITS_PER_MONTH : basis === 'PER_YEAR' ? 12 * CREDITS_PER_MONTH : 1;
  return Math.round(percentPaise / divisor) / 100;
}

export function weeklyProfitFor(plan: RateTerms, amount: number): number {
  return Math.round(dailyProfitFor(plan, amount) * CREDITS_PER_WEEK * 100) / 100;
}

export function monthlyProfitFor(plan: RateTerms, amount: number): number {
  if (isMonthlyPlan(plan)) {
    return Math.round(amount * (Number(plan.profitValue) || 0)) / 100;
  }
  return Math.round(dailyProfitFor(plan, amount) * CREDITS_PER_MONTH * 100) / 100;
}

export function formatPlanRange(plan: Pick<InvestmentPlan, 'minAmount' | 'maxAmount'>): string {
  return `${formatINRShort(plan.minAmount)} – ${formatINRShort(plan.maxAmount)}`;
}

export function formatDuration(days: number): string {
  const n = Number(days) || 0;
  if (n === 0) return 'Open-ended';
  if (n === 365) return '1 year (365 days)';
  return `${n} day${n === 1 ? '' : 's'}`;
}

/**
 * Display-only estimate of the total profit over the term. Open-ended daily plans have no fixed
 * total; use monthlyProfitFor for them. The server recalculates profit for every real investment.
 */
export function estimateProfit(plan: PlanTerms, amount: number, start: Date = new Date()): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (isMonthlyPlan(plan)) {
    // Same as the server: one credit per whole 30-day month of the term (365 days = 12), at least one
    const days = Math.floor(Number(plan.durationDays) || 0);
    const months = days <= 0 ? 12 : Math.max(1, Math.floor(days / 30));
    const monthlyPaise = Math.round(amount * (Number(plan.profitValue) || 0));
    return Math.round(monthlyPaise * months) / 100;
  }
  if (isDailyPlan(plan)) {
    if (isOpenEndedPlan(plan)) return 0;
    return Math.round(dailyProfitFor(plan, amount) * countPayingDays(plan, start, plan.durationDays) * 100) / 100;
  }
  if (plan.profitType === 'FIXED') return Number(plan.profitValue) || 0;
  return Math.round(amount * (Number(plan.profitValue) || 0)) / 100;
}

/** Early withdrawal fee for an amount at the given percentage (closing an investment before it ends) */
export function capitalFeeFor(amount: number, feePercent: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * (Number(feePercent) || 0)) / 100;
}

export interface AmountCheck {
  value: number | null;
  error: string;
}

/** Parses a rupee amount typed by the user: positive, at most 2 decimals. */
export function parseAmount(input: string, label = 'Amount'): AmountCheck {
  const raw = input.trim().replace(/,/g, '');
  if (!raw) return { value: null, error: `${label} is required.` };
  if (!/^\d+(\.\d+)?$/.test(raw)) return { value: null, error: `${label} must be a valid number.` };
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { value: null, error: `${label} can have at most 2 decimal places.` };
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { value: null, error: `${label} must be greater than 0.` };
  return { value, error: '' };
}

export function validateNewPassword(password: string): string {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (password.length > 100) return 'Password must be at most 100 characters long.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one digit.';
  }
  return '';
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: 'Capital deposit',
  INVESTMENT: 'Investment',
  MATURITY_PRINCIPAL: 'Capital returned',
  PROFIT: 'Profit earned',
  REFERRAL_COMMISSION: 'Referral commission',
  WITHDRAWAL: 'Withdrawal',
  REFUND: 'Refund',
  ADJUSTMENT: 'Adjustment',
};

export const RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export function validateReceiptFile(file: File): string {
  if (!RECEIPT_MIME_TYPES.includes(file.type)) {
    return 'Unsupported file type. Please upload a JPEG, PNG, WEBP or PDF file.';
  }
  if (file.size > RECEIPT_MAX_BYTES) return 'The file is larger than 5 MB. Please upload a smaller file.';
  if (file.size === 0) return 'The selected file is empty.';
  return '';
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const EXAMPLE_TARGET_AMOUNT = 10_000;

/** A representative amount inside the plan range for the "₹10,000 becomes ₹11,000" example. */
export function exampleAmount(plan: Pick<InvestmentPlan, 'minAmount' | 'maxAmount'>): number {
  const min = Number(plan.minAmount) || 0;
  const max = Math.max(Number(plan.maxAmount) || min, min);
  return Math.min(Math.max(EXAMPLE_TARGET_AMOUNT, min), max);
}
