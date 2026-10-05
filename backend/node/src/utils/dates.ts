const DB_DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/;

/**
 * The MySQL connection returns DATETIME columns as timezone-less strings that
 * hold UTC values. Parsing them with `new Date(str)` would wrongly treat them
 * as local time, so they are normalised here.
 */
export function parseDbDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'string') {
    const match = DB_DATETIME_PATTERN.exec(value.trim());
    const parsed = match ? new Date(`${match[1]}T${match[2]}Z`) : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toIso(value: unknown): string | null {
  const date = parseDbDate(value);
  return date ? date.toISOString() : null;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Builds an inclusive [start, end] range from YYYY-MM-DD query values
 */
export function parseDateRange(startDate?: string, endDate?: string): { start?: Date; end?: Date } {
  const range: { start?: Date; end?: Date } = {};

  if (startDate) {
    const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(start.getTime())) range.start = start;
  }

  if (endDate) {
    const end = new Date(`${endDate.slice(0, 10)}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) range.end = end;
  }

  return range;
}
