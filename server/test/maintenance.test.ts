import { describe, expect, it } from 'vitest';
import {
  dailySurplusForTrend,
  estimateMaintenance,
  suggestedIntake,
} from '../src/analytics/maintenance';

describe('maintenance estimation (1 kg ≈ 7700 kcal)', () => {
  it('matches the spec example: 2300 kcal at +0.2 kg/week → ~2080 kcal maintenance', () => {
    const result = estimateMaintenance(2300, 0.2);
    expect(result.dailySurplusKcal).toBe(220); // 0.2 * 7700 / 7
    expect(result.estimatedMaintenanceKcal).toBe(2080);
  });

  it('rounds to the nearest 10 kcal to avoid false precision', () => {
    // 2303.47 - 220 = 2083.47 → 2080, never "2083.47".
    const result = estimateMaintenance(2303.47, 0.2);
    expect(result.estimatedMaintenanceKcal).toBe(2080);
    expect(result.estimatedMaintenanceKcal % 10).toBe(0);
  });

  it('handles weight loss (negative trend → maintenance above intake)', () => {
    const result = estimateMaintenance(2000, -0.2);
    expect(result.estimatedMaintenanceKcal).toBe(2220);
  });

  it('suggests intake = maintenance + target surplus', () => {
    const { suggestedIntakeKcal, targetSurplusKcal } = suggestedIntake(2080, 0.2);
    expect(targetSurplusKcal).toBe(220);
    expect(suggestedIntakeKcal).toBe(2300);
  });

  it('computes the weekly/daily surplus for a trend', () => {
    expect(dailySurplusForTrend(0.2) * 7).toBeCloseTo(1540, 10);
  });
});
