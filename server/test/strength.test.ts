import { describe, expect, it } from 'vitest';
import {
  estimated1RM,
  exerciseSeries,
  personalBests,
  sessionPoint,
  strengthIndexWeekly,
  weeklyTraining,
} from '../src/workouts/strength';
import { Workout, WorkoutSet } from '../src/workouts/types';

function set(weightKg: number | null, reps: number, rir: number | null = null, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    weightKg,
    reps,
    rir,
    repsUncertain: false,
    badForm: false,
    pain: false,
    isDropSet: false,
    note: null,
    ...extra,
  };
}

function workout(
  date: string,
  routine: string,
  exercises: { name: string; sets: WorkoutSet[] }[],
  type: 'strength' | 'cardio' = 'strength',
  durationMin: number | null = null
): Workout {
  return {
    id: `${date}-${routine}`,
    date,
    type,
    routine: type === 'strength' ? routine : null,
    cardioType: type === 'cardio' ? routine : null,
    durationMin,
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

describe('estimated1RM (Epley, RIR-adjusted)', () => {
  it('adds RIR to reps: 90 kg ×7 @2 RIR → 117 kg', () => {
    expect(estimated1RM(90, 7, 2)).toBeCloseTo(117, 6);
  });

  it('treats unknown RIR as 0: 100 kg ×8 → 126.67 kg', () => {
    expect(estimated1RM(100, 8, null)).toBeCloseTo(100 * (1 + 8 / 30), 6);
  });
});

describe('sessionPoint', () => {
  it('takes the best set, sums volume, and surfaces flags', () => {
    const w = workout('2026-08-01', 'push', [
      {
        name: 'Chest press',
        sets: [set(90, 7, 2), set(90, 7, 1), set(80, 10, 0, { pain: true })],
      },
    ]);
    const p = sessionPoint(w, w.exercises[0]);
    // Best e1RM: 90×(1+9/30)=117 vs 90×(1+8/30)=114 vs 80×(1+10/30)≈106.7
    expect(p.e1rm).toBeCloseTo(117, 6);
    expect(p.topWeightKg).toBe(90);
    expect(p.volumeKg).toBe(90 * 7 + 90 * 7 + 80 * 10);
    expect(p.hadPain).toBe(true);
    expect(p.totalSets).toBe(3);
  });

  it('bodyweight exercises get a reps metric instead of e1RM', () => {
    const w = workout('2026-08-01', 'pull', [
      { name: 'Pull-ups', sets: [set(null, 7, 3), set(null, 7, 2), set(null, 9, 0)] },
    ]);
    const p = sessionPoint(w, w.exercises[0]);
    expect(p.e1rm).toBeNull();
    expect(p.bestReps).toBe(10); // 7 + 3 RIR
  });
});

describe('exerciseSeries', () => {
  it('collects sessions chronologically, matching name case-insensitively', () => {
    const workouts = [
      workout('2026-08-05', 'push', [{ name: 'Chest press', sets: [set(94, 7, 2)] }]),
      workout('2026-08-01', 'push', [{ name: 'chest press', sets: [set(90, 7, 2)] }]),
    ];
    const series = exerciseSeries(workouts, 'Chest Press');
    expect(series.map((p) => p.date)).toEqual(['2026-08-01', '2026-08-05']);
  });
});

describe('personalBests', () => {
  it('keeps the best set per exercise and the set that produced it', () => {
    const workouts = [
      workout('2026-06-01', 'push', [
        { name: 'Chest press', sets: [set(90, 7, 2), set(90, 6, 1)] },
      ]),
      // 94×7 @1 RIR → 94×(1+8/30) ≈ 119.1 beats 90×7 @2 RIR → 117
      workout('2026-07-01', 'push', [{ name: 'Chest press', sets: [set(94, 7, 1)] }]),
      workout('2026-08-01', 'push', [{ name: 'Chest press', sets: [set(80, 10, 0)] }]),
    ];
    const [pr] = personalBests(workouts);
    expect(pr.exerciseName).toBe('Chest press');
    expect(pr.date).toBe('2026-07-01');
    expect(pr.e1rm).toBeCloseTo(94 * (1 + 8 / 30), 6);
    expect(pr.weightKg).toBe(94);
    expect(pr.reps).toBe(7);
    expect(pr.rir).toBe(1);
  });

  it('matches names case-insensitively and reports order independent of input', () => {
    const workouts = [
      workout('2026-07-01', 'push', [{ name: 'chest press', sets: [set(94, 7, 1)] }]),
      workout('2026-06-01', 'push', [{ name: 'Chest press', sets: [set(90, 7, 2)] }]),
    ];
    expect(personalBests(workouts)).toHaveLength(1);
    expect(personalBests(workouts)[0].date).toBe('2026-07-01');
  });

  it('ranks bodyweight work by effective reps', () => {
    const workouts = [
      workout('2026-06-01', 'pull', [{ name: 'Pull-ups', sets: [set(null, 8, 2)] }]),
      workout('2026-06-08', 'pull', [{ name: 'Pull-ups', sets: [set(null, 11, 0)] }]),
    ];
    const [pr] = personalBests(workouts);
    expect(pr.e1rm).toBeNull();
    expect(pr.effectiveReps).toBe(11);
    expect(pr.date).toBe('2026-06-08');
  });

  it('a loaded set beats an unloaded one, whatever the reps', () => {
    const workouts = [
      workout('2026-06-01', 'pull', [{ name: 'Pull-ups', sets: [set(null, 15, 0)] }]),
      workout('2026-06-08', 'pull', [{ name: 'Pull-ups', sets: [set(10, 5, 0)] }]),
    ];
    const [pr] = personalBests(workouts);
    expect(pr.weightKg).toBe(10);
    expect(pr.date).toBe('2026-06-08');
  });

  it('keeps the earlier date when a record is equalled, and carries its flags', () => {
    const workouts = [
      workout('2026-06-08', 'push', [{ name: 'Dip', sets: [set(20, 8, 0)] }]),
      workout('2026-06-01', 'push', [
        { name: 'Dip', sets: [set(20, 8, 0, { badForm: true })] },
      ]),
    ];
    const [pr] = personalBests(workouts);
    expect(pr.date).toBe('2026-06-01');
    expect(pr.badForm).toBe(true);
  });

  it('ignores cardio sessions', () => {
    const workouts = [workout('2026-06-06', 'treadmill', [], 'cardio', 30)];
    expect(personalBests(workouts)).toEqual([]);
  });
});

describe('weeklyTraining', () => {
  it('counts strength sessions per routine and cardio minutes per week', () => {
    const workouts = [
      workout('2026-08-03', 'push', [{ name: 'Chest press', sets: [set(90, 7)] }]),
      workout('2026-08-05', 'pull', [{ name: 'Pull-ups', sets: [set(null, 8), set(null, 6)] }]),
      workout('2026-08-06', 'treadmill', [], 'cardio', 30),
      workout('2026-08-08', 'treadmill', [], 'cardio', 60),
    ];
    const weeks = weeklyTraining(workouts);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].weekStart).toBe('2026-08-03');
    expect(weeks[0].sessions).toEqual({ push: 1, pull: 1 });
    expect(weeks[0].totalSets).toBe(3);
    expect(weeks[0].cardioMin).toBe(90);
    expect(weeks[0].cardioSessions).toBe(2);
  });
});

describe('strengthIndexWeekly', () => {
  it('normalises each exercise to 100 at its first session and averages per routine', () => {
    const workouts = [
      // Week 1 (Mon 2026-06-01): baseline
      workout('2026-06-01', 'push', [{ name: 'Chest press', sets: [set(100, 8, 0)] }]),
      // Week 2: 10% stronger e1RM (110 ×8 vs 100 ×8)
      workout('2026-06-08', 'push', [{ name: 'Chest press', sets: [set(110, 8, 0)] }]),
    ];
    const index = strengthIndexWeekly(workouts);
    expect(index).toHaveLength(2);
    expect(index[0].byRoutine.push).toBeCloseTo(100, 6);
    expect(index[1].byRoutine.push).toBeCloseTo(110, 6);
  });

  it('uses the reps metric for bodyweight exercises', () => {
    const workouts = [
      workout('2026-06-01', 'pull', [{ name: 'Pull-ups', sets: [set(null, 8, 0)] }]),
      workout('2026-06-08', 'pull', [{ name: 'Pull-ups', sets: [set(null, 10, 0)] }]),
    ];
    const index = strengthIndexWeekly(workouts);
    expect(index[1].byRoutine.pull).toBeCloseTo(125, 6);
  });
});
