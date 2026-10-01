import { describe, expect, it } from 'vitest';
import { buildWeeklySummaries } from '../src/analytics/weekly';
import { DailyEntry } from '../src/types';
import { Workout } from '../src/workouts/types';

function entry(date: string, fields: Partial<DailyEntry>): DailyEntry {
  return {
    date,
    weightKg: null,
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
    caloriesIncomplete: null,
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

  it('excludes days with an incomplete food log from the weekly food averages', () => {
    const weeks = buildWeeklySummaries([
      entry('2026-08-03', { weightKg: 63.7, calories: 2100, proteinG: 150 }),
      entry('2026-08-04', { weightKg: 63.8, calories: 300, proteinG: 20, caloriesIncomplete: true }),
      entry('2026-08-05', { weightKg: 63.9, calories: 2300, proteinG: 170 }),
    ]);

    const [week] = weeks;
    expect(week.calorieDays).toBe(2);
    expect(week.avgCalories).toBeCloseTo(2200, 10);
    expect(week.proteinDays).toBe(2);
    expect(week.avgProtein).toBeCloseTo(160, 10);
    // The weigh-ins are untouched.
    expect(week.weighIns).toBe(3);
  });

  it('omits within-week trend with fewer than 3 weigh-ins', () => {
    const weeks = buildWeeklySummaries([
      entry('2026-08-03', { weightKg: 63.7 }),
      entry('2026-08-05', { weightKg: 63.9 }),
    ]);
    expect(weeks[0].trendKgPerWeek).toBeNull();
  });

  it('totals cardio time and distance for the week', () => {
    const run = (date: string, durationMin: number, distanceKm: number | null): Workout => ({
      id: date,
      date,
      type: 'cardio',
      routine: null,
      cardioType: 'treadmill',
      durationMin,
      distanceKm,
      notes: null,
      dateInferred: false,
      exercises: [],
    });
    const [week] = buildWeeklySummaries(
      [entry('2026-08-03', { weightKg: 63.7 })],
      [run('2026-08-03', 32.25, 5), run('2026-08-05', 28.4, 4.6), run('2026-08-06', 20, null)]
    );
    expect(week.cardioMin).toBe(81);
    expect(week.cardioKm).toBe(9.6);
  });
});
