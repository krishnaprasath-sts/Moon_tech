import type { InvestmentPlan, ProfitType, TransactionType } from '@/lib/api';

export function formatINR(value: number | string | null | undefined): string {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = Math.abs(safe).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${safe < 0 ? '-' : ''}₹${formatted}`;
}

/** Compact rupee amount without forced decimals, for ranges such as "₹5,000 – ₹2,00,000". */
export function formatINRShort(value: number | string | null | undefined): string {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₹${safe.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

export function formatProfit(profitType: ProfitType, profitValue: number): string {
  if (profitType === 'FIXED') return `${formatINRShort(profitValue)} fixed`;
  return `${Number(profitValue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
}

export function formatPlanRange(plan: Pick<InvestmentPlan, 'minAmount' | 'maxAmount'>): string {
  return `${formatINRShort(plan.minAmount)} – ${formatINRShort(plan.maxAmount)}`;
}

export function formatDuration(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Display-only estimate. The server recalculates profit for every real investment.
 */
export function estimateProfit(plan: Pick<InvestmentPlan, 'profitType' | 'profitValue'>, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (plan.profitType === 'FIXED') return Number(plan.profitValue) || 0;
  return Math.round(amount * (Number(plan.profitValue) || 0)) / 100;
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
  DEPOSIT: 'Wallet deposit',
  INVESTMENT: 'Investment',
  MATURITY_PRINCIPAL: 'Maturity principal',
  PROFIT: 'Profit earned',
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
