/**
 * Date helpers. All dates in the app are plain ISO calendar dates
 * ("YYYY-MM-DD") interpreted at UTC midnight, so arithmetic is
 * timezone-independent and DST-safe.
 */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  // Round-trip to reject impossible dates like 2026-02-31.
  const d = parseDateUTC(s);
  return isoDate(d) === s;
}

export function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function dayDiff(a: string, b: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((parseDateUTC(b).getTime() - parseDateUTC(a).getTime()) / MS_PER_DAY);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/** Today's date in the server's local timezone. */
export function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday of the week containing `dateStr` (weeks run Monday–Sunday). */
export function weekStartOf(dateStr: string): string {
  const d = parseDateUTC(dateStr);
  const offset = (d.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setUTCDate(d.getUTCDate() - offset);
  return isoDate(d);
}
