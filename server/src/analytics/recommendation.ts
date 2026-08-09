import { Recommendation, TrendStatus } from '../types';

/**
 * Tolerance band around the target rate. With a target of +0.20 kg/week this
 * gives: below < +0.10, on-target +0.10…+0.30, above > +0.30 — matching the
 * spec's example thresholds. Kept as a named constant so it can be made a
 * per-profile setting later.
 */
export const TREND_TOLERANCE_KG_PER_WEEK = 0.1;

/**
 * Minimum data before the app draws conclusions. Recommendations must never
 * be based on a single week of data or a handful of weigh-ins.
 */
export const SUFFICIENCY = {
  minSpanDays: 14,
  minWeightMeasurements: 8,
  minCalorieDays: 10,
};

export interface DataAmount {
  spanDays: number; // days covered by the analysed period's measurements
  weightMeasurements: number;
  calorieDays: number;
}

/** Returns human-readable unmet requirements; empty array means sufficient. */
export function insufficiencyReasons(data: DataAmount): string[] {
  const reasons: string[] = [];
  if (data.spanDays < SUFFICIENCY.minSpanDays) {
    reasons.push(
      `Need at least ${SUFFICIENCY.minSpanDays} days of data (currently ${data.spanDays}).`
    );
  }
  if (data.weightMeasurements < SUFFICIENCY.minWeightMeasurements) {
    reasons.push(
      `Need at least ${SUFFICIENCY.minWeightMeasurements} weight measurements (currently ${data.weightMeasurements}).`
    );
  }
  if (data.calorieDays < SUFFICIENCY.minCalorieDays) {
    reasons.push(
      `Need at least ${SUFFICIENCY.minCalorieDays} days with calories recorded (currently ${data.calorieDays}).`
    );
  }
  return reasons;
}

export function classifyTrend(
  trendKgPerWeek: number,
  targetKgPerWeek: number,
  tolerance: number = TREND_TOLERANCE_KG_PER_WEEK
): TrendStatus {
  if (trendKgPerWeek < targetKgPerWeek - tolerance) return 'below';
  if (trendKgPerWeek > targetKgPerWeek + tolerance) return 'above';
  return 'on-target';
}

const MESSAGES: Record<TrendStatus, string> = {
  below: 'Weight is trending below target. Consider increasing intake by ~100–150 kcal/day.',
  'on-target': 'Current rate of gain looks appropriate. Keep intake unchanged.',
  above: 'Weight is trending above target. Consider reducing intake by ~100–150 kcal/day.',
};

export function buildRecommendation(
  data: DataAmount,
  trendKgPerWeek: number | null,
  targetKgPerWeek: number
): Recommendation {
  const reasons = insufficiencyReasons(data);
  if (reasons.length > 0 || trendKgPerWeek === null) {
    return {
      sufficient: false,
      status: null,
      message:
        'Not enough data yet for a reliable recommendation. Aim for at least 2–3 weeks of reasonably consistent data. ' +
        reasons.join(' '),
    };
  }
  const status = classifyTrend(trendKgPerWeek, targetKgPerWeek);
  return { sufficient: true, status, message: MESSAGES[status] };
}
