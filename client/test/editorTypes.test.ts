import { describe, expect, it } from 'vitest';
import {
  buildWorkoutExercises,
  editorFromWorkout,
  EditorExercise,
  emptyEditorSet,
  isSetComplete,
  lastByKeyFrom,
  loggedSets,
  withVariant,
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
    variants: [],
    variant: null,
    swappedFrom: null,
    sets: [],
    last: null,
    ...over,
  };
}

function last(over: Partial<LastPerformance> = {}): LastPerformance {
  return {
    exerciseName: 'Low row machine',
    variant: null,
    date: '2026-07-29',
    routine: 'pull',
    variation: null,
    sets: [set(45, 7, 2)],
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

  it('carries the chosen variant through to the payload', () => {
    const { exercises } = buildWorkoutExercises([
      exercise({
        variants: ['Cable', 'Chest supported'],
        variant: 'Chest supported',
        sets: [{ ...emptyEditorSet('30'), reps: '12', rir: 2 }],
      }),
    ]);
    expect(exercises[0].variant).toBe('Chest supported');
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
    { id: 'a', name: 'Pull-ups', setupNotes: '', isBodyweight: true, orderIndex: 0, variants: [] },
    {
      id: 'b',
      name: 'Low row machine',
      setupNotes: '3 holes',
      isBodyweight: false,
      orderIndex: 1,
      variants: [],
    },
  ];

  /** The same catalog with the low row's two machines registered. */
  const withVariants = [
    catalog[0],
    { ...catalog[1], variants: ['Cable', 'Chest supported'] },
  ];

  // The bug this replaced: "last time" came from the single previous session of
  // the routine, so an exercise skipped that day showed no previous at all.
  it('attaches each exercise its own last performance, from whichever day', () => {
    const editor = editorFromWorkout(null, catalog, [last({ sets: [set(60, 8, 2)] })]);
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

    const editor = editorFromWorkout(workout, catalog, []);
    expect(editor.map((e) => e.exerciseName)).toEqual(['Low row machine', 'Pull-ups']);
    expect(editor[0].variation).toBe('wide grip');
    expect(loggedSets(editor[0])).toHaveLength(1);
  });

  // The bug this fixes: "last time" was keyed on the exercise name alone, so
  // the low row done chest-supported showed the cable stack's 45 kg — a load
  // half again as heavy — as the numbers to match.
  it('reads "last time" from the variant, not just the exercise', () => {
    const records = [
      last({ variant: 'Cable', date: '2026-08-07', sets: [set(45, 7, 2)] }),
      last({ variant: 'Chest supported', date: '2026-08-23', sets: [set(30, 12, 2)] }),
    ];
    const editor = editorFromWorkout(null, withVariants, records);
    const lowRow = editor.find((e) => e.exerciseName === 'Low row machine')!;

    // Opens on the machine used last time, with that machine's numbers.
    expect(lowRow.variant).toBe('Chest supported');
    expect(lowRow.last?.sets[0].weightKg).toBe(30);

    const onCable = withVariant(lowRow, 'Cable', lastByKeyFrom(records));
    expect(onCable.last?.sets[0].weightKg).toBe(45);
    expect(onCable.last?.date).toBe('2026-08-07');
  });

  it('falls back to the default variant when the movement is new to it', () => {
    const editor = editorFromWorkout(null, withVariants, []);
    const lowRow = editor.find((e) => e.exerciseName === 'Low row machine')!;
    expect(lowRow.variant).toBe('Cable');
    expect(lowRow.last).toBeNull();
  });

  it('leaves a variant with no history of its own showing nothing', () => {
    const records = [last({ variant: 'Cable', date: '2026-08-07' })];
    const lastByKey = lastByKeyFrom(records);
    const editor = editorFromWorkout(null, withVariants, records);
    const lowRow = editor.find((e) => e.exerciseName === 'Low row machine')!;
    expect(withVariant(lowRow, 'Chest supported', lastByKey).last).toBeNull();
  });

  // A session recorded before the exercise had variants is shown as recorded
  // rather than reassigned to a machine it may not have been performed on.
  it('keeps a logged exercise on the variant it was saved with', () => {
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
          orderMoved: null,
          variation: null,
          variant: null,
          swappedFrom: null,
          sets: [set(45, 7, 2)],
        },
      ],
    } satisfies Workout;

    const editor = editorFromWorkout(workout, withVariants, [last({ variant: 'Cable' })]);
    expect(editor[0].variant).toBeNull();
    expect(editor[0].variants).toEqual(['Cable', 'Chest supported']);
    expect(editor[0].last).toBeNull();
  });
});
