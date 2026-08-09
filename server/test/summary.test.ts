import { describe, expect, it } from 'vitest';
import { buildAnalyticsSummary } from '../src/analytics/summary';
import { DailyEntry, Profile } from '../src/types';
import { addDays } from '../src/utils/dates';

const profile: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 169,
  goal: 'Lean bulk',
  targetWeightChangeKgPerWeek: 0.2,
  trainingDaysPerWeek: 4.5,
  cardio: false,
  maintenanceCalories: null,
  calorieTarget: null,
  notes: '',
};

function entry(date: string, fields: Partial<DailyEntry>): DailyEntry {
  return {
    date,
    weightKg: null,
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    bowelMovement: null,
    weighedTime: null,
    beforeFood: null,
    afterBowelMovement: null,
    trained: null,
    trainingType: null,
    trainingDurationMin: null,
    notes: null,
    ...fields,
  };
}

describe('buildAnalyticsSummary', () => {
  it('reports insufficient data clearly instead of producing an estimate', () => {
    const entries = [
      entry('2026-08-05', { weightKg: 63.4, calories: 2100 }),
      entry('2026-08-07', { weightKg: 63.6, calories: 2200 }),
      entry('2026-08-09', { weightKg: 63.5 }),
    ];
    const summary = buildAnalyticsSummary(entries, profile, '2026-07-13', '2026-08-09');

    expect(summary.maintenance.sufficient).toBe(false);
    expect(summary.maintenance.estimatedMaintenanceKcal).toBeNull();
    expect(summary.maintenance.reasons.length).toBeGreaterThan(0);
    expect(summary.recommendation.sufficient).toBe(false);
    expect(summary.recommendation.message).toContain('Not enough data');
  });

  it('produces a maintenance estimate with enough consistent data', () => {
    // 22 days: weight climbing exactly +0.2 kg/week, calories 2300 every day.
    const entries: DailyEntry[] = [];
    for (let i = 0; i < 22; i++) {
      const date = addDays('2026-07-13', i);
      entries.push(
        entry(date, { weightKg: 63 + (0.2 / 7) * i, calories: 2300, proteinG: 145 })
      );
    }
    const to = addDays('2026-07-13', 21);
    const summary = buildAnalyticsSummary(entries, profile, '2026-07-13', to);

    expect(summary.trend).not.toBeNull();
    expect(summary.trend!.kgPerWeek).toBeCloseTo(0.2, 6);
    expect(summary.target.status).toBe('on-target');
    expect(summary.maintenance.sufficient).toBe(true);
    expect(summary.maintenance.estimatedMaintenanceKcal).toBe(2080);
    expect(summary.maintenance.suggestedIntakeKcal).toBe(2300);
    expect(summary.macros.protein.avg).toBeCloseTo(145, 10);
  });

  it('window stats report partial counts and skip missing days', () => {
    const entries = [
      entry('2026-08-03', { weightKg: 63.4 }),
      entry('2026-08-05', { weightKg: 64.8 }),
      entry('2026-08-07', { weightKg: 63.7, calories: 2000 }),
      entry('2026-08-09', { weightKg: 63.4, calories: 2100 }),
    ];
    const summary = buildAnalyticsSummary(entries, profile, '2026-07-13', '2026-08-09');

    expect(summary.weight.avg7.count).toBe(4);
    expect(summary.weight.avg7.avg).toBeCloseTo((63.4 + 64.8 + 63.7 + 63.4) / 4, 10);
    expect(summary.calories.avg7.count).toBe(2);
    expect(summary.calories.avg7.avg).toBeCloseTo(2050, 10);
    expect(summary.latestWeight).toEqual({ date: '2026-08-09', weightKg: 63.4 });
  });
});
