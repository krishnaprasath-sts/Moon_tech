/**
 * Working-day calendar used for daily profit payouts.
 *
 * All business days are evaluated in Indian Standard Time (UTC+05:30), which
 * has no daylight saving. A "day key" is the IST calendar date as YYYY-MM-DD.
 * Working days are Monday to Friday; Saturdays and Sundays are skipped.
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Hour of the IST day at which daily payouts become due (06:00) */
export const PAYOUT_HOUR_IST = 6;

/** IST calendar date (YYYY-MM-DD) of an instant */
export function istDayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Instant at which the given IST day starts (00:00 IST) */
export function istDayStart(dayKey: string): Date {
  return new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() - IST_OFFSET_MS);
}

/** Instant of HH:00 IST on the given IST day */
export function istTimeOnDay(dayKey: string, hour: number): Date {
  return new Date(istDayStart(dayKey).getTime() + hour * 60 * 60 * 1000);
}

export function addDaysToKey(dayKey: string, days: number): string {
  return new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Monday-Friday in IST */
export function isWorkingDay(dayKey: string): boolean {
  const weekday = new Date(`${dayKey}T00:00:00.000Z`).getUTCDay(); // 0 = Sunday, 6 = Saturday
  return weekday !== 0 && weekday !== 6;
}

/**
 * Working days strictly after `fromKey` up to and including `toKey`.
 * Returns an empty list when toKey <= fromKey.
 */
export function workingDaysBetween(fromKey: string, toKey: string): string[] {
  const days: string[] = [];
  let cursor = addDaysToKey(fromKey, 1);
  while (cursor <= toKey) {
    if (isWorkingDay(cursor)) days.push(cursor);
    cursor = addDaysToKey(cursor, 1);
  }
  return days;
}

export function countWorkingDaysBetween(fromKey: string, toKey: string): number {
  return workingDaysBetween(fromKey, toKey).length;
}

/**
 * Monthly-rate plans pay one month of profit as 20 equal credits: 4 weeks x 5 working
 * days. A 30-day cycle has 20 to 22 weekdays, so the credits beyond the 20th in a cycle
 * are skipped and a month never pays more than the plan rate.
 */
export const WORKING_DAYS_PER_MONTH = 20;
export const WORKING_DAYS_PER_WEEK = 5;
export const CYCLE_DAYS = 30;

/**
 * Total credits a fixed-term monthly-rate plan pays over its whole term: whole 30-day months
 * only. A 365-day plan pays exactly 12 x 20 = 240 credits (twelve months of the rate); the few
 * days left after the last full month earn nothing extra, so 1,00,000 at 6% earns 72,000 in a
 * year, never 73,200. Terms shorter than a month pay a proportional share. Open-ended terms
 * (0 days) have no total cap.
 */
export function maxCreditsForTerm(durationDays: number): number | undefined {
  const days = Math.floor(Number(durationDays) || 0);
  if (days <= 0) return undefined;
  const fullCycles = Math.floor(days / CYCLE_DAYS);
  if (fullCycles === 0) return Math.max(1, Math.round((days / CYCLE_DAYS) * WORKING_DAYS_PER_MONTH));
  return fullCycles * WORKING_DAYS_PER_MONTH;
}

/** Calendar days from one day key to another (positive when toKey is later) */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round(
    (new Date(`${toKey}T00:00:00.000Z`).getTime() - new Date(`${fromKey}T00:00:00.000Z`).getTime()) / DAY_MS
  );
}

/**
 * 30-day cycle number of a credit day relative to the investment's start day.
 * Days 1-30 after the start are cycle 0, days 31-60 cycle 1, and so on.
 */
export function cycleNoForDay(startKey: string, dayKey: string): number {
  return Math.max(0, Math.floor((daysBetweenKeys(startKey, dayKey) - 1) / CYCLE_DAYS));
}

/**
 * Working days strictly after `startKey` up to and including `toKey` on which profit is
 * credited. With `perCycleCap`, at most that many days are taken from each 30-day cycle
 * (the first ones); without it every working day pays (legacy per-day plans). With
 * `maxCredits`, the list stops after that many credits in total (see maxCreditsForTerm).
 */
export function payableWorkingDays(
  startKey: string,
  toKey: string,
  perCycleCap?: number,
  maxCredits?: number
): string[] {
  const days = workingDaysBetween(startKey, toKey);
  let paying = days;
  if (perCycleCap !== undefined) {
    const perCycle = new Map<number, number>();
    paying = days.filter((day) => {
      const cycle = cycleNoForDay(startKey, day);
      const used = perCycle.get(cycle) ?? 0;
      if (used >= perCycleCap) return false;
      perCycle.set(cycle, used + 1);
      return true;
    });
  }
  return maxCredits === undefined ? paying : paying.slice(0, Math.max(0, maxCredits));
}

/**
 * The latest IST day whose payout is due at `now`: today once the payout hour
 * has passed, otherwise yesterday.
 */
export function latestPayableDay(now: Date): string {
  const today = istDayKey(now);
  return now.getTime() >= istTimeOnDay(today, PAYOUT_HOUR_IST).getTime() ? today : addDaysToKey(today, -1);
}

/**
 * Next instant at which a payout run is due for the given day key, i.e. the
 * first working day after `fromKey` at the payout hour.
 */
export function nextPayoutInstant(fromKey: string): Date {
  let cursor = addDaysToKey(fromKey, 1);
  while (!isWorkingDay(cursor)) cursor = addDaysToKey(cursor, 1);
  return istTimeOnDay(cursor, PAYOUT_HOUR_IST);
}
