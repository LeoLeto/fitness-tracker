import { describe, expect, it } from 'vitest';
import {
  buildWorkoutExercises,
  editorFromWorkout,
  EditorExercise,
  emptyEditorSet,
  isSetComplete,
  loggedSets,
} from '../src/components/train/editorTypes';
import { LastPerformance, Workout, WorkoutSet } from '../src/types';

function set(
  weightKg: number | null,
  reps: number,
  rir: number | null = null
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
  };
}

function exercise(over: Partial<EditorExercise> = {}): EditorExercise {
  return {
    exerciseId: 'e1',
    exerciseName: 'Low row machine',
    setupNotes: '',
    isBodyweight: false,
    defaultIndex: 0,
    variation: '',
    swappedFrom: null,
    sets: [],
    last: null,
    ...over,
  };
}

describe('isSetComplete', () => {
  // A new row is pre-filled with the previous set's weight, so weight alone
  // must never make a row count as logged.
  it('needs reps, not just the carried-over weight', () => {
    expect(isSetComplete({ ...emptyEditorSet('90'), reps: '' }, false)).toBe(false);
    expect(isSetComplete({ ...emptyEditorSet('90'), reps: '7' }, false)).toBe(true);
  });

  it('does not require a weight for bodyweight work', () => {
    expect(isSetComplete({ ...emptyEditorSet(), reps: '12' }, true)).toBe(true);
    expect(isSetComplete({ ...emptyEditorSet(), reps: '12' }, false)).toBe(false);
  });

  it('rejects a half-typed or nonsensical rep count', () => {
    expect(isSetComplete({ ...emptyEditorSet('90'), reps: '0' }, false)).toBe(false);
    expect(isSetComplete({ ...emptyEditorSet('90'), reps: 'x' }, false)).toBe(false);
  });
});

describe('buildWorkoutExercises', () => {
  it('drops untouched exercises and renumbers the rest', () => {
    const { exercises, errors } = buildWorkoutExercises([
      exercise({ exerciseName: 'Pull-ups', defaultIndex: 0 }),
      exercise({
        exerciseName: 'Low row machine',
        defaultIndex: 1,
        sets: [{ ...emptyEditorSet('60'), reps: '8', rir: 2 }],
      }),
    ]);
    expect(errors).toEqual([]);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].exerciseName).toBe('Low row machine');
    expect(exercises[0].order).toBe(0);
  });

  it('keeps a trailing empty row out of the payload', () => {
    const { exercises } = buildWorkoutExercises([
      exercise({
        sets: [{ ...emptyEditorSet('60'), reps: '8', rir: 2 }, emptyEditorSet('60')],
      }),
    ]);
    expect(exercises[0].sets).toHaveLength(1);
  });

  it('carries the mid-session swap through to the payload', () => {
    const { exercises } = buildWorkoutExercises([
      exercise({
        exerciseName: 'Chest supported row',
        swappedFrom: 'Cable low row',
        sets: [{ ...emptyEditorSet('50'), reps: '10', rir: 2 }],
      }),
    ]);
    expect(exercises[0].swappedFrom).toBe('Cable low row');
  });

  it('reports a bad value instead of saving a guess', () => {
    const { errors } = buildWorkoutExercises([
      exercise({ sets: [{ ...emptyEditorSet('not a number'), reps: '8' }] }),
    ]);
    expect(errors).toHaveLength(1);
  });
});

describe('editorFromWorkout', () => {
  const catalog = [
    { id: 'a', name: 'Pull-ups', setupNotes: '', isBodyweight: true, orderIndex: 0 },
    { id: 'b', name: 'Low row machine', setupNotes: '3 holes', isBodyweight: false, orderIndex: 1 },
  ];

  // The bug this replaced: "last time" came from the single previous session of
  // the routine, so an exercise skipped that day showed no previous at all.
  it('attaches each exercise its own last performance, from whichever day', () => {
    const last = new Map<string, LastPerformance>([
      [
        'low row machine',
        {
          exerciseName: 'Low row machine',
          date: '2026-07-29',
          routine: 'pull',
          variation: null,
          sets: [set(60, 8, 2)],
        },
      ],
    ]);
    const editor = editorFromWorkout(null, catalog, last);
    expect(editor.map((e) => e.exerciseName)).toEqual(['Pull-ups', 'Low row machine']);
    expect(editor[0].last).toBeNull();
    expect(editor[1].last?.date).toBe('2026-07-29');
  });

  it('puts the exercises logged that day first, in performed order', () => {
    const workout = {
      id: 'w1',
      date: '2026-08-13',
      type: 'strength',
      routine: 'pull',
      cardioType: null,
      durationMin: null,
      notes: null,
      dateInferred: false,
      exercises: [
        {
          exerciseId: 'b',
          exerciseName: 'Low row machine',
          order: 0,
          orderMoved: 'up' as const,
          variation: 'wide grip',
          swappedFrom: null,
          sets: [set(60, 8, 2)],
        },
      ],
    } satisfies Workout;

    const editor = editorFromWorkout(workout, catalog, new Map());
    expect(editor.map((e) => e.exerciseName)).toEqual(['Low row machine', 'Pull-ups']);
    expect(editor[0].variation).toBe('wide grip');
    expect(loggedSets(editor[0])).toHaveLength(1);
  });
});
