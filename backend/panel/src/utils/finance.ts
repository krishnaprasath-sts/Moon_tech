import { ApiFieldError } from '../types';

interface ApiErrorBody {
  message?: string;
  errors?: ApiFieldError[];
}

interface ApiErrorLike {
  message?: string;
  response?: { status?: number; data?: ApiErrorBody | Blob };
}

const pickMessage = (body: ApiErrorBody | undefined, fallback: string) => {
  // 422 validation errors carry field-level messages - surface the first one
  if (Array.isArray(body?.errors) && body.errors[0]?.message) {
    return body.errors[0].message;
  }
  return body?.message || fallback;
};

export const getErrorStatus = (err: unknown): number | undefined => (err as ApiErrorLike)?.response?.status;

export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const data = (err as ApiErrorLike)?.response?.data;
  if (!data || data instanceof Blob) return fallback;
  return pickMessage(data, fallback);
};

// Blob requests (receipts, CSV) return the JSON error envelope as a Blob
export const getBlobErrorMessage = async (err: unknown, fallback: string): Promise<string> => {
  const data = (err as ApiErrorLike)?.response?.data;
  if (data instanceof Blob) {
    try {
      return pickMessage(JSON.parse(await data.text()) as ApiErrorBody, fallback);
    } catch (e) {
      return fallback;
    }
  }
  return getApiErrorMessage(err, fallback);
};

// Money is always shown as INR with exactly 2 decimals; anything unparseable shows a dash
export const formatINR = (value: number | string | null | undefined): string => {
  const amount = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(amount)) return '—';
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatNumber = (value: number | string | null | undefined): string => {
  const num = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN');
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

// Local date (e.g. 28 Sep 2026) from an ISO timestamp
export const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', DATE_OPTIONS);
};

// Local date-time (e.g. 28 Sep 2026, 03:45 pm) from an ISO timestamp
export const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', DATE_TIME_OPTIONS);
};

// A calendar date without time (YYYY-MM-DD, e.g. date of birth) - parsed as a local date so it never shifts a day
export const formatDateOnly = (value?: string | null): string => {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return formatDate(value);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', DATE_OPTIONS);
};

// "MATURITY_PRINCIPAL" -> "Maturity Principal"
export const humanize = (value?: string | null): string =>
  (value || '')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const hasMaxTwoDecimals = (value: string): boolean => /^\d+(\.\d{1,2})?$/.test(value.trim());

// Downloads a blob through a temporary object URL that is revoked immediately afterwards
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const joinParts = (parts: Array<string | null | undefined>, separator = ', '): string =>
  parts.map((p) => (p || '').trim()).filter(Boolean).join(separator);

/**
 * Field-level messages from a 422 validation response, keyed by field name, so forms can show
 * each server error next to the input it belongs to. Empty when the error has no field details.
 */
export const getApiFieldErrors = (err: unknown): Record<string, string> => {
  const data = (err as ApiErrorLike)?.response?.data;
  if (!data || data instanceof Blob || !Array.isArray(data.errors)) return {};
  const out: Record<string, string> = {};
  for (const e of data.errors) {
    if (e?.field && e?.message && !out[e.field]) out[e.field] = e.message;
  }
  return out;
};
