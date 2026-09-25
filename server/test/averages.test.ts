import { describe, expect, it } from 'vitest';
import { average, countsToward, rangeStat, windowStat } from '../src/analytics/averages';
import { DailyEntry } from '../src/types';

function entry(date: string, fields: Partial<DailyEntry> = {}): DailyEntry {
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

describe('average', () => {
  it('computes the correct moving average for the spec example', () => {
    // 63.4, 64.8, 63.7, 63.4, 64.2 → 319.5 / 5 = 63.9
    expect(average([63.4, 64.8, 63.7, 63.4, 64.2])).toBeCloseTo(63.9, 10);
  });

  it('returns null (not 0) for no data', () => {
    expect(average([])).toBeNull();
  });
});

describe('windowStat', () => {
  const entries = [
    entry('2026-08-01', { weightKg: 63.4 }),
    entry('2026-08-02', {}), // no weigh-in this day
    entry('2026-08-03', { weightKg: 64.8 }),
    entry('2026-08-05', { weightKg: 63.7 }),
    entry('2026-08-07', { weightKg: 63.4 }),
  ];

  it('averages only the measurements available in the window and reports the count', () => {
    // 7-day window ending 2026-08-07 covers 08-01..08-07: 4 weigh-ins.
    const stat = windowStat(entries, 'weightKg', '2026-08-07', 7);
    expect(stat.count).toBe(4);
    expect(stat.avg).toBeCloseTo((63.4 + 64.8 + 63.7 + 63.4) / 4, 10);
  });

  it('excludes measurements outside the window', () => {
    // 3-day window ending 2026-08-07 covers 08-05..08-07: 2 weigh-ins.
    const stat = windowStat(entries, 'weightKg', '2026-08-07', 3);
    expect(stat.count).toBe(2);
    expect(stat.avg).toBeCloseTo((63.7 + 63.4) / 2, 10);
  });
});

describe('days with an incomplete food log', () => {
  const entries = [
    entry('2026-08-01', { weightKg: 63.4, calories: 2000, proteinG: 150 }),
    // Ate normally, only logged breakfast before giving up on the day.
    entry('2026-08-02', {
      weightKg: 63.6,
      calories: 400,
      proteinG: 30,
      caloriesIncomplete: true,
    }),
    entry('2026-08-03', { weightKg: 63.8, calories: 2200, proteinG: 160 }),
  ];

  it('leaves the partial day out of the calorie average instead of averaging it low', () => {
    const stat = rangeStat(entries, 'calories', '2026-08-01', '2026-08-03');
    expect(stat.count).toBe(2);
    expect(stat.avg).toBeCloseTo(2100, 10); // NOT (2000 + 400 + 2200) / 3 = 1533
  });

  it('leaves it out of macro averages too — the macros are as partial as the calories', () => {
    const stat = rangeStat(entries, 'proteinG', '2026-08-01', '2026-08-03');
    expect(stat.count).toBe(2);
    expect(stat.avg).toBeCloseTo(155, 10);
  });

  it('still counts the weigh-in — the scale that morning was not partial', () => {
    const stat = rangeStat(entries, 'weightKg', '2026-08-01', '2026-08-03');
    expect(stat.count).toBe(3);
    expect(stat.avg).toBeCloseTo(63.6, 10);
  });

  it('reports per-field whether a day may be averaged', () => {
    const partial = entries[1];
    expect(countsToward(partial, 'calories')).toBe(false);
    expect(countsToward(partial, 'weightKg')).toBe(true);
    // A day nobody flagged is unaffected.
    expect(countsToward(entries[0], 'calories')).toBe(true);
  });
});

describe('days that total 0 kcal', () => {
  const entries = [
    entry('2026-08-01', { weightKg: 63.4, calories: 2000, proteinG: 150 }),
    // Weighed in, ticked the training box, never opened the food log.
    entry('2026-08-02', { weightKg: 63.6, calories: 0, proteinG: 0, trained: true }),
    entry('2026-08-03', { weightKg: 63.8, calories: 2200, proteinG: 160 }),
  ];

  it('leaves the 0 kcal day out of the calorie average', () => {
    const stat = rangeStat(entries, 'calories', '2026-08-01', '2026-08-03');
    expect(stat.count).toBe(2);
    expect(stat.avg).toBeCloseTo(2100, 10); // NOT (2000 + 0 + 2200) / 3 = 1400
  });

  it('leaves it out of macro averages too — a 0 kcal day has no macros either', () => {
    const stat = rangeStat(entries, 'proteinG', '2026-08-01', '2026-08-03');
    expect(stat.count).toBe(2);
    expect(stat.avg).toBeCloseTo(155, 10);
  });

  it('still counts the weigh-in', () => {
    const stat = rangeStat(entries, 'weightKg', '2026-08-01', '2026-08-03');
    expect(stat.count).toBe(3);
    expect(stat.avg).toBeCloseTo(63.6, 10);
  });

  it('keeps a 0 in one macro on a day that did eat — that one is a measurement', () => {
    const noFiber = entry('2026-08-04', { calories: 2100, fiberG: 0 });
    expect(countsToward(noFiber, 'fiberG')).toBe(true);
  });

  it('reports per-field whether the day may be averaged', () => {
    const zero = entries[1];
    expect(countsToward(zero, 'calories')).toBe(false);
    expect(countsToward(zero, 'proteinG')).toBe(false);
    expect(countsToward(zero, 'weightKg')).toBe(true);
  });
});

describe('missing values', () => {
  it('excludes days without calories instead of treating them as zero', () => {
    const entries = [
      entry('2026-08-01', { calories: 2000 }),
      entry('2026-08-02', {}), // no calories recorded
      entry('2026-08-03', { calories: 2200 }),
      entry('2026-08-04', {}), // no calories recorded
    ];
    const stat = rangeStat(entries, 'calories', '2026-08-01', '2026-08-04');
    expect(stat.count).toBe(2);
    expect(stat.avg).toBeCloseTo(2100, 10); // NOT (2000+0+2200+0)/4 = 1050
  });
});
