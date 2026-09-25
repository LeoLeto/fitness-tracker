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
 * Four ways a day can be silent. It never recorded the value — missing stays
 * missing, never 0. Or its food log was marked incomplete: the numbers it does
 * have are real but only part of the day, so they are kept and shown while
 * every calorie and macro average skips them, since a half-logged day averaged
 * in reads as a light day and drags the maintenance estimate with it. Or the
 * day fell inside a tracking pause, where the same is true of the whole period
 * and nobody had to tick anything each morning to say so. Or the day totals 0
 * kcal: nobody eats nothing, so a zero is a day that was opened (for the
 * weigh-in, a note, a training tick) and never logged, or one whose meals were
 * all deleted — an unlogged day wearing a number, and averaging it in would be
 * the one thing this file exists to prevent.
 *
 * All of that is food-only — the weigh-in taken that morning was not partial,
 * and a holiday does not stop the scale from working.
 *
 * Zero gates the whole day's food, not just its calories: a 0 kcal day has no
 * macros to speak of either, and its zeros would drag every macro average the
 * same way. A 0 in a single macro on a day that did eat (no fiber all day) is
 * a real measurement and still counts.
 */
export function countsToward(entry: DailyEntry, field: NumericField): boolean {
  if (entry[field] == null) return false;
  if (!FOOD_FIELDS.includes(field)) return true;
  if (entry.calories === 0) return false;
  return entry.caloriesIncomplete !== true && entry.paused !== true;
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
