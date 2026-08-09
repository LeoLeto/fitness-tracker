import { DailyEntry } from '../types';
import { addDays, eachDay } from './dates';

/**
 * Chart series builder. The moving averages here are display smoothing only —
 * raw measurements are never replaced or mutated.
 */

export interface ChartPoint {
  date: string;
  /** Raw weigh-in exactly as entered (missing days stay undefined, never 0). */
  weight?: number;
  /** Trailing 7-day average of available weigh-ins ending on this date. */
  ma7?: number;
  /** Trailing 14-day average of available weigh-ins ending on this date. */
  ma14?: number;
  calories?: number;
}

/**
 * Trailing moving average over a calendar-day window: averages the weigh-ins
 * that exist within the `windowDays` days ending on `date`. Days without a
 * weigh-in contribute nothing (missing ≠ 0), so 4 weigh-ins in a 7-day window
 * produce a 4-value average.
 */
function trailingWeightAverage(
  entries: DailyEntry[],
  date: string,
  windowDays: number
): number | undefined {
  const from = addDays(date, -(windowDays - 1));
  const values = entries
    .filter((e) => e.date >= from && e.date <= date && e.weightKg != null)
    .map((e) => e.weightKg as number);
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * One row per calendar day in [from, to] so the x-axis is true to time
 * (gaps between weigh-ins stay visible). `allEntries` may extend before
 * `from` so the moving averages have warm-up data.
 */
export function buildChartData(allEntries: DailyEntry[], from: string, to: string): ChartPoint[] {
  const byDate = new Map(allEntries.map((e) => [e.date, e]));
  return eachDay(from, to).map((date) => {
    const entry = byDate.get(date);
    const point: ChartPoint = { date };
    if (entry?.weightKg != null) point.weight = entry.weightKg;
    if (entry?.calories != null) point.calories = entry.calories;
    const ma7 = trailingWeightAverage(allEntries, date, 7);
    const ma14 = trailingWeightAverage(allEntries, date, 14);
    if (ma7 !== undefined) point.ma7 = ma7;
    if (ma14 !== undefined) point.ma14 = ma14;
    return point;
  });
}
