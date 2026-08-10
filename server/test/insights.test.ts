import { describe, expect, it } from 'vitest';
import {
  fluidRetentionEvents,
  recurringPainEvents,
  trainingGapEvents,
  weightBands,
} from '../src/workouts/insights';
import { DailyEntry } from '../src/types';
import { addDays } from '../src/utils/dates';
import { Workout, WorkoutSet } from '../src/workouts/types';

function entry(date: string, weightKg: number | null): DailyEntry {
  return {
    date,
    weightKg,
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
  };
}

function set(weightKg: number | null, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    weightKg,
    reps,
    rir: 0,
    repsUncertain: false,
    badForm: false,
    pain: false,
    isDropSet: false,
    note: null,
    ...extra,
  };
}

function workout(date: string, routine: string, exercises: { name: string; sets: WorkoutSet[] }[] = []): Workout {
  return {
    id: `${date}-${routine}`,
    date,
    type: 'strength',
    routine,
    cardioType: null,
    durationMin: null,
    notes: null,
    dateInferred: false,
    exercises: exercises.map((ex, i) => ({
      exerciseId: null,
      exerciseName: ex.name,
      order: i,
      orderMoved: null,
      variation: null,
      sets: ex.sets,
    })),
  };
}

describe('trainingGapEvents', () => {
  it('flags a routine resumed after ≥21 days and reports the gap length', () => {
    const events = trainingGapEvents([
      workout('2026-05-28', 'legs'),
      workout('2026-07-10', 'legs'), // 43-day gap
      workout('2026-07-01', 'push'),
      workout('2026-07-04', 'push'), // no gap
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('training-gap-ended');
    expect(events[0].date).toBe('2026-07-10');
    expect(events[0].routine).toBe('legs');
    expect(events[0].title).toContain('43 days');
  });
});

describe('fluidRetentionEvents', () => {
  it('detects a fast weight spike right after a training gap ends', () => {
    // Stable ~61 kg before legs resume on Jul 10, then a quick jump to 64.2.
    const entries = [
      entry('2026-07-04', 61.0),
      entry('2026-07-06', 60.9),
      entry('2026-07-08', 61.1),
      entry('2026-07-12', 62.8),
      entry('2026-07-15', 64.2),
    ];
    const gaps = trainingGapEvents([workout('2026-05-28', 'legs'), workout('2026-07-10', 'legs')]);
    const events = fluidRetentionEvents(entries, gaps);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('fluid-retention-spike');
    expect(events[0].title).toContain('legs');
    expect(events[0].detail).toContain('fluid');
    expect(events[0].title).toMatch(/\+3\.\d kg/);
  });

  it('stays silent when weight does not spike', () => {
    const entries = [entry('2026-07-08', 61.0), entry('2026-07-12', 61.3)];
    const gaps = trainingGapEvents([workout('2026-05-28', 'legs'), workout('2026-07-10', 'legs')]);
    expect(fluidRetentionEvents(entries, gaps)).toHaveLength(0);
  });
});

describe('recurringPainEvents', () => {
  it('flags ≥2 pain flags on the same exercise within 45 days', () => {
    const events = recurringPainEvents([
      workout('2026-07-01', 'abs', [
        { name: 'Decline crunch', sets: [set(10, 8, { pain: true })] },
      ]),
      workout('2026-07-12', 'abs', [
        { name: 'Decline crunch', sets: [set(10, 9, { pain: true })] },
      ]),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].exercise).toBe('Decline crunch');
  });

  it('ignores isolated or far-apart pain flags', () => {
    const events = recurringPainEvents([
      workout('2026-01-10', 'push', [
        { name: 'Overhead extension', sets: [set(25, 8, { pain: true })] },
      ]),
      workout('2026-05-01', 'push', [
        { name: 'Overhead extension', sets: [set(25, 8, { pain: true })] },
      ]),
    ]);
    expect(events).toHaveLength(0);
  });
});

describe('weightBands', () => {
  it('classifies a steep deficit followed by maintenance, with per-routine strength change', () => {
    // 6 weeks losing ~0.8 kg/week, then 6 weeks flat. Weigh-ins every 2 days.
    const entries: DailyEntry[] = [];
    const start = '2026-01-05'; // Monday
    for (let d = 0; d < 42; d += 2) {
      entries.push(entry(addDays(start, d), 70 - (0.8 * d) / 7));
    }
    const floor = 70 - (0.8 * 42) / 7;
    for (let d = 42; d <= 84; d += 2) {
      entries.push(entry(addDays(start, d), floor));
    }

    // Chest press losing strength during the deficit: 100→85 over 5 sessions.
    const workouts = [
      workout('2026-01-07', 'push', [{ name: 'Chest press', sets: [set(100, 8)] }]),
      workout('2026-01-16', 'push', [{ name: 'Chest press', sets: [set(100, 6)] }]),
      workout('2026-01-28', 'push', [{ name: 'Chest press', sets: [set(90, 8)] }]),
      workout('2026-02-08', 'push', [{ name: 'Chest press', sets: [set(90, 7)] }]),
      workout('2026-02-14', 'push', [{ name: 'Chest press', sets: [set(85, 6)] }]),
    ];

    const bands = weightBands(entries, workouts);
    expect(bands.length).toBeGreaterThanOrEqual(2);

    const steep = bands.find((b) => b.kind === 'steep-deficit');
    expect(steep).toBeDefined();
    expect(steep!.trendKgPerWeek).toBeLessThan(-0.35);

    const flat = bands.find((b) => b.kind === 'maintenance');
    expect(flat).toBeDefined();

    // Strength dropped during the deficit band (100×8 → 90×7 ≈ -13%).
    expect(steep!.strengthChangePct.push).toBeLessThan(-5);
  });

  it('returns nothing without enough weigh-ins', () => {
    expect(weightBands([entry('2026-01-05', 70)], [])).toEqual([]);
  });
});
