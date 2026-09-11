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

type NumericField = 'weightKg' | 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG';

/** The fields that come from the day's food log. */
const FOOD_FIELDS: NumericField[] = ['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'];

/**
 * Whether an entry may contribute its `field` to an average.
 *
 * Two ways a day can be silent. It never recorded the value — missing stays
 * missing, never 0. Or its food log was marked incomplete: the numbers it does
 * have are real but only part of the day, so they are kept and shown while
 * every calorie and macro average skips them, since a half-logged day averaged
 * in reads as a light day and drags the maintenance estimate with it. That
 * exclusion is food-only — the weigh-in taken that morning was not partial.
 */
export function countsToward(entry: DailyEntry, field: NumericField): boolean {
  if (entry[field] == null) return false;
  if (entry.caloriesIncomplete === true && FOOD_FIELDS.includes(field)) return false;
  return true;
}

/** Averageable values of `field` for entries within [from, to] (inclusive). */
export function valuesInRange(
  entries: DailyEntry[],
  field: NumericField,
  from: string,
  to: string
): number[] {
  return entries
    .filter((e) => e.date >= from && e.date <= to && countsToward(e, field))
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
