import { describe, expect, it } from 'vitest';
import { countsToward, rangeStat } from '../src/analytics/averages';
import {
  activePause,
  isPaused,
  markPaused,
  pauseEnd,
  pausedDaysInRange,
  pausesOverlapping,
} from '../src/analytics/pauses';
import { buildRecommendation, insufficiencyReasons } from '../src/analytics/recommendation';
import { buildAnalyticsSummary } from '../src/analytics/summary';
import { buildWeeklySummaries } from '../src/analytics/weekly';
import { DailyEntry, Profile, TrackingPause } from '../src/types';

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

function pause(startDate: string, endDate: string | null, note = ''): TrackingPause {
  return { id: `${startDate}..${endDate ?? 'open'}`, startDate, endDate, note };
}

const PROFILE: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 169,
  goal: 'Lean bulk',
  targetWeightChangeKgPerWeek: 0.2,
  trainingDaysPerWeek: 4,
  cardio: false,
  maintenanceCalories: null,
  calorieTarget: null,
  notes: '',
};

describe('activePause', () => {
  it('finds the pause that was never resumed', () => {
    const pauses = [pause('2026-06-01', '2026-06-10'), pause('2026-08-01', null)];
    expect(activePause(pauses)?.startDate).toBe('2026-08-01');
  });

  it('is null when every pause has been resumed', () => {
    expect(activePause([pause('2026-06-01', '2026-06-10')])).toBeNull();
  });

  it('is null with no pauses at all', () => {
    expect(activePause([])).toBeNull();
  });

  it('prefers the most recently started pause if several are somehow open', () => {
    const pauses = [pause('2026-06-01', null), pause('2026-08-01', null)];
    expect(activePause(pauses)?.startDate).toBe('2026-08-01');
  });
});

describe('isPaused', () => {
  const pauses = [pause('2026-08-10', '2026-08-20')];

  it('includes both endpoints', () => {
    expect(isPaused(pauses, '2026-08-10')).toBe(true);
    expect(isPaused(pauses, '2026-08-20')).toBe(true);
  });

  it('excludes the days either side', () => {
    expect(isPaused(pauses, '2026-08-09')).toBe(false);
    expect(isPaused(pauses, '2026-08-21')).toBe(false);
  });

  it('runs a still-open pause up to the as-of date and no further', () => {
    const open = [pause('2026-08-10', null)];
    expect(isPaused(open, '2026-08-15', '2026-08-18')).toBe(true);
    expect(isPaused(open, '2026-08-19', '2026-08-18')).toBe(false);
  });
});

describe('pauseEnd', () => {
  it('uses the recorded end date when the pause was resumed', () => {
    expect(pauseEnd(pause('2026-08-10', '2026-08-20'), '2026-09-01')).toBe('2026-08-20');
  });

  it('runs an open pause to the as-of date', () => {
    expect(pauseEnd(pause('2026-08-10', null), '2026-09-01')).toBe('2026-09-01');
  });
});

describe('pausedDaysInRange', () => {
  it('counts inclusive days', () => {
    expect(
      pausedDaysInRange([pause('2026-08-10', '2026-08-20')], '2026-08-01', '2026-08-31')
    ).toBe(11);
  });

  it('clips to the range at both ends', () => {
    expect(
      pausedDaysInRange([pause('2026-07-25', '2026-08-05')], '2026-08-01', '2026-08-31')
    ).toBe(5);
    expect(
      pausedDaysInRange([pause('2026-08-28', '2026-09-10')], '2026-08-01', '2026-08-31')
    ).toBe(4);
  });

  it('is zero for a pause entirely outside the range', () => {
    expect(
      pausedDaysInRange([pause('2026-06-01', '2026-06-10')], '2026-08-01', '2026-08-31')
    ).toBe(0);
  });

  it('counts overlapping pauses once, not twice', () => {
    const overlapping = [pause('2026-08-10', '2026-08-20'), pause('2026-08-15', '2026-08-25')];
    expect(pausedDaysInRange(overlapping, '2026-08-01', '2026-08-31')).toBe(16);
  });

  it('does not double-count a pause nested inside another', () => {
    const nested = [pause('2026-08-10', '2026-08-25'), pause('2026-08-14', '2026-08-16')];
    expect(pausedDaysInRange(nested, '2026-08-01', '2026-08-31')).toBe(16);
  });

  it('adds up separate pauses', () => {
    const separate = [pause('2026-08-02', '2026-08-04'), pause('2026-08-20', '2026-08-21')];
    expect(pausedDaysInRange(separate, '2026-08-01', '2026-08-31')).toBe(5);
  });

  it('runs an open pause only to the as-of date', () => {
    expect(
      pausedDaysInRange([pause('2026-08-10', null)], '2026-08-01', '2026-08-31', '2026-08-14')
    ).toBe(5);
  });
});

describe('pausesOverlapping', () => {
  it('returns only the pauses touching the range, newest first', () => {
    const pauses = [
      pause('2026-06-01', '2026-06-10'),
      pause('2026-08-05', '2026-08-12'),
      pause('2026-08-28', '2026-09-04'),
    ];
    expect(pausesOverlapping(pauses, '2026-08-01', '2026-08-31').map((p) => p.startDate)).toEqual([
      '2026-08-28',
      '2026-08-05',
    ]);
  });
});

describe('markPaused', () => {
  const entries = [
    entry('2026-08-09', { calories: 2400, weightKg: 64 }),
    entry('2026-08-12', { calories: 900, weightKg: 65 }),
  ];
  const marked = markPaused(entries, [pause('2026-08-10', '2026-08-20')]);

  it('flags days inside the pause and leaves the others alone', () => {
    expect(marked[0].paused).toBeUndefined();
    expect(marked[1].paused).toBe(true);
  });

  it('never mutates the entries it was given', () => {
    expect(entries[1].paused).toBeUndefined();
  });

  it('keeps whatever the paused day did record', () => {
    expect(marked[1].calories).toBe(900);
    expect(marked[1].weightKg).toBe(65);
  });
});

describe('countsToward with a paused day', () => {
  const paused = entry('2026-08-12', {
    calories: 900,
    proteinG: 40,
    weightKg: 65,
    paused: true,
  });

  it('excludes calories and macros', () => {
    expect(countsToward(paused, 'calories')).toBe(false);
    expect(countsToward(paused, 'proteinG')).toBe(false);
  });

  it('still counts the weigh-in — a holiday does not stop the scale working', () => {
    expect(countsToward(paused, 'weightKg')).toBe(true);
  });
});

describe('averages over a paused period', () => {
  it('leaves paused days out of the calorie average instead of averaging them low', () => {
    const entries = markPaused(
      [
        entry('2026-08-01', { calories: 2400 }),
        entry('2026-08-02', { calories: 2600 }),
        entry('2026-08-11', { calories: 800 }), // a single logged holiday snack
        entry('2026-08-25', { calories: 2500 }),
      ],
      [pause('2026-08-10', '2026-08-20')]
    );
    const stat = rangeStat(entries, 'calories', '2026-08-01', '2026-08-31');
    expect(stat.count).toBe(3);
    expect(stat.avg).toBe(2500);
  });

  it('keeps weigh-ins from the paused days in the weight average', () => {
    const entries = markPaused(
      [entry('2026-08-09', { weightKg: 64 }), entry('2026-08-12', { weightKg: 66 })],
      [pause('2026-08-10', '2026-08-20')]
    );
    const stat = rangeStat(entries, 'weightKg', '2026-08-01', '2026-08-31');
    expect(stat.count).toBe(2);
    expect(stat.avg).toBe(65);
  });
});

describe('weekly summaries across a pause', () => {
  it('reports no calorie average for a fully paused week', () => {
    const entries = markPaused(
      [
        entry('2026-08-10', { calories: 700, weightKg: 64.5 }),
        entry('2026-08-11', { calories: 900 }),
      ],
      [pause('2026-08-10', '2026-08-20')]
    );
    const week = buildWeeklySummaries(entries)[0];
    expect(week.calorieDays).toBe(0);
    expect(week.avgCalories).toBeNull();
    expect(week.weighIns).toBe(1);
  });
});

describe('insufficiencyReasons for a paused period', () => {
  const plenty = { spanDays: 28, weightMeasurements: 20, calorieDays: 20 };

  it('says nothing when no day was paused', () => {
    expect(insufficiencyReasons({ ...plenty, pausedDays: 0 })).toEqual([]);
  });

  it('blocks the estimate on any overlap and names the count', () => {
    const reasons = insufficiencyReasons({ ...plenty, pausedDays: 12 });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('12 days');
  });

  it('gets the singular right for a one-day pause', () => {
    expect(insufficiencyReasons({ ...plenty, pausedDays: 1 })[0]).toContain('1 day in');
  });

  it('withholds the intake recommendation rather than blaming logged days', () => {
    const rec = buildRecommendation({ ...plenty, pausedDays: 12 }, 0.6, 0.2);
    expect(rec.sufficient).toBe(false);
    expect(rec.status).toBeNull();
    expect(rec.message).toContain('pause');
  });
});

describe('buildAnalyticsSummary with pauses', () => {
  // Three weeks of consistent logging, then a holiday fortnight with no food
  // log at all but weigh-ins throughout — the shape that would otherwise make
  // the maintenance estimate charge holiday weight gain to the logged days.
  const entries: DailyEntry[] = [];
  for (let i = 0; i < 21; i++) {
    const day = String(i + 1).padStart(2, '0');
    entries.push(entry(`2026-08-${day}`, { calories: 2500, weightKg: 64 + i * 0.02 }));
  }
  for (let i = 0; i < 14; i++) {
    const date =
      i < 10
        ? `2026-08-${String(i + 22).padStart(2, '0')}`
        : `2026-09-${String(i - 9).padStart(2, '0')}`;
    entries.push(entry(date, { weightKg: 64.4 + i * 0.15 }));
  }
  const holiday = [pause('2026-08-22', '2026-09-04')];

  it('estimates maintenance normally when no pause overlaps', () => {
    const summary = buildAnalyticsSummary(entries, PROFILE, '2026-08-01', '2026-08-21', holiday);
    expect(summary.maintenance.sufficient).toBe(true);
    expect(summary.maintenance.pausedDays).toBe(0);
    expect(summary.maintenance.estimatedMaintenanceKcal).not.toBeNull();
  });

  it('declines to estimate when the period spans the pause', () => {
    const summary = buildAnalyticsSummary(entries, PROFILE, '2026-08-01', '2026-09-04', holiday);
    expect(summary.maintenance.sufficient).toBe(false);
    expect(summary.maintenance.pausedDays).toBe(14);
    expect(summary.maintenance.estimatedMaintenanceKcal).toBeNull();
    expect(summary.maintenance.reasons.join(' ')).toContain('paused for 14 days');
  });

  it('still reports the weight trend across the pause — the scale kept working', () => {
    const summary = buildAnalyticsSummary(entries, PROFILE, '2026-08-01', '2026-09-04', holiday);
    expect(summary.trend).not.toBeNull();
    expect(summary.latestWeight?.date).toBe('2026-09-04');
  });

  it('leaves the calorie average untouched by the paused days', () => {
    const summary = buildAnalyticsSummary(entries, PROFILE, '2026-08-01', '2026-09-04', holiday);
    // The 28 days ending Sep 4 are entirely holiday or pre-pause-but-outside.
    expect(summary.calories.avg7.count).toBe(0);
    expect(summary.macros.protein.count).toBe(0);
  });

  it('behaves exactly as before when the pause list is empty', () => {
    const withEmpty = buildAnalyticsSummary(entries, PROFILE, '2026-08-01', '2026-08-21', []);
    const withoutArg = buildAnalyticsSummary(entries, PROFILE, '2026-08-01', '2026-08-21');
    expect(withoutArg).toEqual(withEmpty);
  });
});
