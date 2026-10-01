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
  /** Days in the period that fell inside a tracking pause. */
  pausedDays?: number;
}

/** Returns human-readable unmet requirements; empty array means sufficient. */
export function insufficiencyReasons(data: DataAmount): string[] {
  const reasons: string[] = [];
  // A pause is disqualifying however short it was, because the estimate is an
  // energy balance over the whole period: the weight moved across those days
  // too, and with no intake recorded for them the change gets charged to the
  // days that were logged. The result is not a noisy estimate, it is a wrong
  // one — so the app says what it can't do instead of quoting a number.
  if (data.pausedDays !== undefined && data.pausedDays > 0) {
    reasons.push(
      `Tracking was paused for ${data.pausedDays} day${data.pausedDays === 1 ? '' : 's'} in ` +
        'this period, so the weight change spans days with no intake recorded. ' +
        'Narrow the range to days after the pause for an estimate.'
    );
  }
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

// The arithmetic is the same either way (below target → eat more), but "below
// target" on a cut means losing too fast, and that's how it should read.
const GAIN_MESSAGES: Record<TrendStatus, string> = {
  below: 'Weight is trending below target. Consider increasing intake by ~100–150 kcal/day.',
  'on-target': 'Current rate of gain looks appropriate. Keep intake unchanged.',
  above: 'Weight is trending above target. Consider reducing intake by ~100–150 kcal/day.',
};

const LOSS_MESSAGES: Record<TrendStatus, string> = {
  below:
    'Losing faster than target, which puts muscle and training quality at risk. ' +
    'Consider increasing intake by ~100–150 kcal/day.',
  'on-target': 'Current rate of loss looks appropriate. Keep intake unchanged.',
  above: 'Losing slower than target. Consider reducing intake by ~100–150 kcal/day.',
};

export function buildRecommendation(
  data: DataAmount,
  trendKgPerWeek: number | null,
  targetKgPerWeek: number
): Recommendation {
  const reasons = insufficiencyReasons(data);
  if (reasons.length > 0 || trendKgPerWeek === null) {
    // A paused period isn't thin data, it's data that would mislead — telling
    // someone to eat 150 kcal less because of a holiday they never logged is
    // worse than telling them nothing, so it gets its own opening line.
    const paused = data.pausedDays !== undefined && data.pausedDays > 0;
    return {
      sufficient: false,
      status: null,
      message: paused
        ? `No recommendation while a pause sits in this period. ${reasons.join(' ')}`
        : 'Not enough data yet for a reliable recommendation. Aim for at least 2–3 weeks of reasonably consistent data. ' +
          reasons.join(' '),
    };
  }
  const status = classifyTrend(trendKgPerWeek, targetKgPerWeek);
  const messages = targetKgPerWeek < 0 ? LOSS_MESSAGES : GAIN_MESSAGES;
  return { sufficient: true, status, message: messages[status] };
}
