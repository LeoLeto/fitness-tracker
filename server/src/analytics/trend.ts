import { TrendResult } from '../types';
import { dayDiff } from '../utils/dates';

export interface WeightPoint {
  date: string; // "YYYY-MM-DD"
  weightKg: number;
}

/**
 * Weight trend via ordinary least-squares linear regression.
 *
 * Rather than comparing the first and last measurement (which is dominated by
 * daily fluctuation), we fit a straight line through all measurements:
 *
 *   x_i = days since the first measurement (real calendar dates, so uneven
 *         gaps between weigh-ins are weighted correctly)
 *   y_i = weight in kg
 *
 *   slope = Σ((x_i - x̄)(y_i - ȳ)) / Σ((x_i - x̄)²)     [kg per day]
 *
 * kgPerWeek is simply slope × 7.
 *
 * Returns null when there are fewer than 2 measurements or all measurements
 * fall on the same day (the slope would be undefined).
 */
export function weightTrend(points: WeightPoint[]): TrendResult | null {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length < 2) return null;

  const first = sorted[0].date;
  const xs = sorted.map((p) => dayDiff(first, p.date));
  const ys = sorted.map((p) => p.weightKg);

  const spanDays = xs[xs.length - 1];
  if (spanDays === 0) return null;

  const n = xs.length;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - xMean) * (ys[i] - yMean);
    denominator += (xs[i] - xMean) ** 2;
  }

  const kgPerDay = numerator / denominator;
  return {
    kgPerDay,
    kgPerWeek: kgPerDay * 7,
    count: n,
    spanDays,
    firstDate: first,
    lastDate: sorted[sorted.length - 1].date,
  };
}
