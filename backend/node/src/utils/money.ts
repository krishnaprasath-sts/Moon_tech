import crypto from 'crypto';

/**
 * Money helpers. All rupee amounts are stored as DECIMAL(18,2) and every
 * calculation is done in integer paise to avoid floating-point drift.
 */

export const MAX_MONEY = 9_999_999_999.99;

export function toPaise(value: number | string | null | undefined): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * True when value is a positive amount with at most 2 decimal places
 */
export function isValidMoney(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value <= 0 || value > MAX_MONEY) return false;
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export function formatInr(value: number | string): string {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generates a unique human-readable reference, e.g. DEP-20260928-9F3A1C7B2D
 */
export function generateReference(prefix: string): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomPart = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${prefix}-${datePart}-${randomPart}`;
}

/**
 * DECIMAL column getter: MySQL returns DECIMAL values as strings
 */
export function decimalGetter(field: string) {
  return function (this: any): number | null {
    const value = this.getDataValue(field);
    return value === null || value === undefined ? null : parseFloat(value);
  };
}
