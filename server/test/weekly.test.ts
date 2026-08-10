import { describe, expect, it } from 'vitest';
import { buildWeeklySummaries } from '../src/analytics/weekly';
import { DailyEntry } from '../src/types';

function entry(date: string, fields: Partial<DailyEntry>): DailyEntry {
  return {
    date,
    weightKg: null,
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
    bowelMovement: null,
    weighedTime: null,
    beforeFood: null,
    afterBowelMovement: null,
    trained: null,
    trainingType: null,
    trainingDurationMin: null,
    notes: null,
    meals: [],
    ...fields,
  };
}

describe('buildWeeklySummaries', () => {
  it('groups Monday–Sunday, averages available data, and compares to previous week', () => {
    const entries = [
      // Week of Mon 2026-07-27
      entry('2026-07-27', { weightKg: 63.4, calories: 2100, trained: true }),
      entry('2026-07-29', { weightKg: 63.6, calories: 2200 }),
      entry('2026-08-01', { calories: 2300, trained: true }), // Sat, no weigh-in
      // Week of Mon 2026-08-03
      entry('2026-08-03', { weightKg: 63.7, calories: 2140, trained: true, notes: 'Normal day' }),
      entry('2026-08-05', { weightKg: 63.9 }),
    ];

    const weeks = buildWeeklySummaries(entries);
    expect(weeks).toHaveLength(2);

    // Most recent week first.
    const [recent, previous] = weeks;
    expect(recent.weekStart).toBe('2026-08-03');
    expect(recent.weekEnd).toBe('2026-08-09');
    expect(previous.weekStart).toBe('2026-07-27');

    expect(previous.avgWeight).toBeCloseTo(63.5, 10);
    expect(previous.weighIns).toBe(2);
    expect(previous.calorieDays).toBe(3);
    expect(previous.trainingDays).toBe(2);

    expect(recent.avgWeight).toBeCloseTo(63.8, 10);
    expect(recent.changeVsPrevWeekKg).toBeCloseTo(63.8 - 63.5, 10);
    expect(recent.notes).toEqual([{ date: '2026-08-03', text: 'Normal day' }]);
  });

  it('omits within-week trend with fewer than 3 weigh-ins', () => {
    const weeks = buildWeeklySummaries([
      entry('2026-08-03', { weightKg: 63.7 }),
      entry('2026-08-05', { weightKg: 63.9 }),
    ]);
    expect(weeks[0].trendKgPerWeek).toBeNull();
  });
});
