import { DailyEntry, WindowStat } from '../types';
import { addDays } from '../utils/dates';

/**
 * Average of the provided values. Callers must pass only the values that
 * actually exist — missing data is excluded, never treated as zero.
 */
export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

type NumericField = 'weightKg' | 'calories' | 'proteinG' | 'carbsG' | 'fatG';

/** Non-null values of `field` for entries within [from, to] (inclusive). */
export function valuesInRange(
  entries: DailyEntry[],
  field: NumericField,
  from: string,
  to: string
): number[] {
  return entries
    .filter((e) => e.date >= from && e.date <= to && e[field] != null)
    .map((e) => e[field] as number);
}

/**
 * Average of `field` over the `days`-day window ending at `endDate`
 * (e.g. days=7 → the last 7 calendar days including endDate).
 * Uses however many measurements exist in the window and reports the count —
 * 4 measurements in a 7-day window produce a 4-value average.
 */
export function windowStat(
  entries: DailyEntry[],
  field: NumericField,
  endDate: string,
  days: number
): WindowStat {
  const from = addDays(endDate, -(days - 1));
  const values = valuesInRange(entries, field, from, endDate);
  return { avg: average(values), count: values.length };
}

/** Average of `field` over an explicit [from, to] range, with count. */
export function rangeStat(
  entries: DailyEntry[],
  field: NumericField,
  from: string,
  to: string
): WindowStat {
  const values = valuesInRange(entries, field, from, to);
  return { avg: average(values), count: values.length };
}
