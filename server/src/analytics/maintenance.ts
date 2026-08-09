/**
 * Maintenance-calorie estimation from observed intake and weight trend.
 *
 * Uses the approximate energy density of body-mass change:
 *   1 kg body mass ≈ 7,700 kcal
 *
 * If the weight trend is +0.2 kg/week, the implied energy surplus is
 *   0.2 × 7700 / 7 ≈ 220 kcal/day
 * so estimated maintenance = average intake − daily surplus.
 *
 * This is a rough model, not a physiological measurement — results are
 * rounded to the nearest 10 kcal to avoid implying false precision, and the
 * estimate only becomes reliable with 2–3+ weeks of consistent data.
 */

export const KCAL_PER_KG = 7700;

export function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Daily kcal surplus/deficit implied by a weekly weight change. */
export function dailySurplusForTrend(trendKgPerWeek: number): number {
  return (trendKgPerWeek * KCAL_PER_KG) / 7;
}

export function estimateMaintenance(
  avgCalories: number,
  trendKgPerWeek: number
): { estimatedMaintenanceKcal: number; dailySurplusKcal: number } {
  const surplus = dailySurplusForTrend(trendKgPerWeek);
  return {
    estimatedMaintenanceKcal: roundToNearest(avgCalories - surplus, 10),
    dailySurplusKcal: Math.round(surplus),
  };
}

/** Suggested intake = estimated maintenance + surplus needed for the target rate. */
export function suggestedIntake(
  estimatedMaintenanceKcal: number,
  targetKgPerWeek: number
): { suggestedIntakeKcal: number; targetSurplusKcal: number } {
  const targetSurplus = dailySurplusForTrend(targetKgPerWeek);
  return {
    suggestedIntakeKcal: roundToNearest(estimatedMaintenanceKcal + targetSurplus, 10),
    targetSurplusKcal: Math.round(targetSurplus),
  };
}
