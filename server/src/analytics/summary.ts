import {
  AnalyticsSummary,
  DailyEntry,
  MaintenanceEstimate,
  Profile,
} from '../types';
import { rangeStat, windowStat } from './averages';
import { estimateMaintenance, suggestedIntake } from './maintenance';
import {
  buildRecommendation,
  classifyTrend,
  insufficiencyReasons,
  TREND_TOLERANCE_KG_PER_WEEK,
  DataAmount,
} from './recommendation';
import { weightTrend, WeightPoint } from './trend';
import { dayDiff } from '../utils/dates';

function weightPointsIn(entries: DailyEntry[], from: string, to: string): WeightPoint[] {
  return entries
    .filter((e) => e.date >= from && e.date <= to && e.weightKg != null)
    .map((e) => ({ date: e.date, weightKg: e.weightKg as number }));
}

/**
 * Builds the full analytics payload for a period.
 *
 * - Rolling 7/14/28-day windows end at `to` and use whatever measurements
 *   exist in each window (the count is always reported alongside).
 * - Trend, macro averages, and the maintenance estimate are computed over the
 *   selected [from, to] period using actual measurement dates.
 * - `entries` should contain all entries up to `to` (they may start before
 *   `from`; anything after `to` is ignored by the range filters).
 */
export function buildAnalyticsSummary(
  entries: DailyEntry[],
  profile: Profile,
  from: string,
  to: string
): AnalyticsSummary {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));

  const weighed = sorted.filter((e) => e.weightKg != null && e.date <= to);
  const latest = weighed.length > 0 ? weighed[weighed.length - 1] : null;

  const points = weightPointsIn(sorted, from, to);
  const trend = weightTrend(points);

  const caloriesRange = rangeStat(sorted, 'calories', from, to);

  // Sufficiency is judged on the span actually covered by measurements in the
  // period, not just the requested period length.
  const spanDays = trend ? trend.spanDays : points.length > 0 ? 0 : 0;
  const data: DataAmount = {
    spanDays,
    weightMeasurements: points.length,
    calorieDays: caloriesRange.count,
  };

  const target = profile.targetWeightChangeKgPerWeek;
  const maintenance = buildMaintenanceEstimate(data, trend?.kgPerWeek ?? null, caloriesRange.avg, target, from, to);

  return {
    period: { from, to, days: dayDiff(from, to) + 1 },
    latestWeight: latest ? { date: latest.date, weightKg: latest.weightKg as number } : null,
    weight: {
      avg7: windowStat(sorted, 'weightKg', to, 7),
      avg14: windowStat(sorted, 'weightKg', to, 14),
      avg28: windowStat(sorted, 'weightKg', to, 28),
    },
    calories: {
      avg7: windowStat(sorted, 'calories', to, 7),
      avg14: windowStat(sorted, 'calories', to, 14),
      avg28: windowStat(sorted, 'calories', to, 28),
    },
    macros: {
      protein: rangeStat(sorted, 'proteinG', from, to),
      carbs: rangeStat(sorted, 'carbsG', from, to),
      fat: rangeStat(sorted, 'fatG', from, to),
      fiber: rangeStat(sorted, 'fiberG', from, to),
    },
    trend,
    target: {
      kgPerWeek: target,
      toleranceKgPerWeek: TREND_TOLERANCE_KG_PER_WEEK,
      status: trend ? classifyTrend(trend.kgPerWeek, target) : null,
    },
    maintenance,
    recommendation: buildRecommendation(data, trend?.kgPerWeek ?? null, target),
  };
}

function buildMaintenanceEstimate(
  data: DataAmount,
  trendKgPerWeek: number | null,
  avgCalories: number | null,
  targetKgPerWeek: number,
  from: string,
  to: string
): MaintenanceEstimate {
  const reasons = insufficiencyReasons(data);
  const base = {
    periodFrom: from,
    periodTo: to,
    periodDays: dayDiff(from, to) + 1,
    calorieDays: data.calorieDays,
    weightMeasurements: data.weightMeasurements,
    avgCalories,
    trendKgPerWeek,
  };

  if (reasons.length > 0 || trendKgPerWeek === null || avgCalories === null) {
    return {
      ...base,
      sufficient: false,
      reasons:
        reasons.length > 0
          ? reasons
          : ['Not enough weight or calorie data in the selected period.'],
      estimatedMaintenanceKcal: null,
      dailySurplusKcal: null,
      targetSurplusKcal: null,
      suggestedIntakeKcal: null,
    };
  }

  const { estimatedMaintenanceKcal, dailySurplusKcal } = estimateMaintenance(
    avgCalories,
    trendKgPerWeek
  );
  const { suggestedIntakeKcal, targetSurplusKcal } = suggestedIntake(
    estimatedMaintenanceKcal,
    targetKgPerWeek
  );

  return {
    ...base,
    sufficient: true,
    reasons: [],
    estimatedMaintenanceKcal,
    dailySurplusKcal,
    targetSurplusKcal,
    suggestedIntakeKcal,
  };
}
