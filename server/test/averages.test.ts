import { describe, expect, it } from 'vitest';
import { average, rangeStat, windowStat } from '../src/analytics/averages';
import { DailyEntry } from '../src/types';

function entry(date: string, fields: Partial<DailyEntry> = {}): DailyEntry {
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
