import { describe, expect, it } from 'vitest';
import {
  beatsPerformance,
  bestPerformance,
  formatPerformance,
  formatSet,
} from '../src/utils/workouts';
import { WorkoutSet } from '../src/types';

function set(
  weightKg: number | null,
  reps: number,
  rir: number | null = null,
  extra: Partial<WorkoutSet> = {}
): WorkoutSet {
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

describe('bestPerformance', () => {
  it('picks the highest RIR-adjusted e1RM, not the heaviest set', () => {
    // 90×7 @2 → 117 beats 95×5 @0 → ~110.8
    const best = bestPerformance([set(95, 5, 0), set(90, 7, 2)]);
    expect(best?.e1rm).toBeCloseTo(117, 6);
  });

  it('falls back to effective reps for unloaded work', () => {
    const best = bestPerformance([set(null, 8, 1), set(null, 7, 3)]);
    expect(best?.e1rm).toBeNull();
    expect(best?.effectiveReps).toBe(10); // 7 + 3 RIR
  });

  it('returns null with nothing logged', () => {
    expect(bestPerformance([])).toBeNull();
  });
});

describe('beatsPerformance', () => {
  it('compares e1RM when both sets are loaded', () => {
    expect(beatsPerformance({ e1rm: 118, effectiveReps: 8 }, { e1rm: 117, effectiveReps: 9 })).toBe(
      true
    );
    expect(beatsPerformance({ e1rm: 117, effectiveReps: 9 }, { e1rm: 117, effectiveReps: 9 })).toBe(
      false
    );
  });

  it('a loaded set beats an unloaded one either way round', () => {
    const loaded = { e1rm: 40, effectiveReps: 5 };
    const unloaded = { e1rm: null, effectiveReps: 20 };
    expect(beatsPerformance(loaded, unloaded)).toBe(true);
    expect(beatsPerformance(unloaded, loaded)).toBe(false);
  });

  it('compares effective reps when neither is loaded', () => {
    expect(
      beatsPerformance({ e1rm: null, effectiveReps: 11 }, { e1rm: null, effectiveReps: 10 })
    ).toBe(true);
  });
});

describe('formatting', () => {
  it('labels the metric by kind', () => {
    expect(formatPerformance({ e1rm: 117.04, effectiveReps: 9 })).toBe('117.0 kg e1RM');
    expect(formatPerformance({ e1rm: null, effectiveReps: 10 })).toBe('10 eff. reps');
  });

  it('writes a record set in the log notation', () => {
    expect(formatSet(set(94, 7, 1))).toBe('94 ×7 (1 RIR)');
    expect(formatSet(set(null, 12))).toBe('BW ×12');
  });
});
