import { LastPerformance, Workout, WorkoutExercise, WorkoutSet } from '../../types';
import { parseDecimal } from '../../utils/numeric';

/** Form state for one set (numbers kept as strings while typing). */
export interface EditorSet {
  weight: string;
  reps: string;
  rir: number | null;
  repsUncertain: boolean;
  badForm: boolean;
  pain: boolean;
  isDropSet: boolean;
  note: string | null;
}

export interface EditorExercise {
  exerciseId: string | null;
  exerciseName: string;
  setupNotes: string;
  isBodyweight: boolean;
  /** Position in the routine's default order — the reference for ⬆️/⬇️ badges. */
  defaultIndex: number;
  variation: string;
  /** Set when this exercise took over from another one mid-session (⇄). */
  swappedFrom: string | null;
  sets: EditorSet[];
  /** Last time this exercise was performed — ghost text and the "last" line. */
  last: LastPerformance | null;
}

export function setFromWorkout(s: WorkoutSet): EditorSet {
  return {
    weight: s.weightKg != null ? String(s.weightKg) : '',
    reps: String(s.reps),
    rir: s.rir,
    repsUncertain: s.repsUncertain,
    badForm: s.badForm,
    pain: s.pain,
    isDropSet: s.isDropSet,
    note: s.note,
  };
}

export function emptyEditorSet(weight = ''): EditorSet {
  return {
    weight,
    reps: '',
    rir: null,
    repsUncertain: false,
    badForm: false,
    pain: false,
    isDropSet: false,
    note: null,
  };
}

/** '' → null; invalid numbers → undefined (caller shows an error). */
const parseNum = parseDecimal;

export function setToWorkout(s: EditorSet): WorkoutSet | 'invalid' | 'empty' {
  const reps = parseNum(s.reps);
  if (reps === null) return 'empty';
  if (reps === undefined || reps <= 0 || !Number.isInteger(reps)) return 'invalid';
  const weight = parseNum(s.weight);
  if (weight === undefined) return 'invalid';
  return {
    weightKg: weight,
    reps,
    rir: s.rir,
    repsUncertain: s.repsUncertain,
    badForm: s.badForm,
    pain: s.pain,
    isDropSet: s.isDropSet,
    note: s.note,
  };
}

/**
 * True once a set carries enough to be worth keeping. Weight alone isn't
 * enough: a set row is created pre-filled with the previous set's weight, so
 * that would count every untouched row as logged.
 */
export function isSetComplete(s: EditorSet, isBodyweight: boolean): boolean {
  const reps = parseNum(s.reps);
  if (reps === null || reps === undefined || reps <= 0) return false;
  if (isBodyweight) return true;
  const weight = parseNum(s.weight);
  return weight !== null && weight !== undefined;
}

/** Sets logged so far, in the notation used everywhere else. */
export function loggedSets(ex: EditorExercise): WorkoutSet[] {
  return ex.sets
    .map(setToWorkout)
    .filter((s): s is WorkoutSet => s !== 'invalid' && s !== 'empty');
}

/**
 * ⬆️/⬇️ badges computed from the day's order vs the routine's default order —
 * reordering the list is all it takes to record a machine-availability swap.
 */
export function orderMovedFor(list: EditorExercise[]): ('up' | 'down' | null)[] {
  const byDefault = [...list].sort((a, b) => a.defaultIndex - b.defaultIndex);
  return list.map((ex, i) => {
    const d = byDefault.indexOf(ex);
    if (i < d) return 'up';
    if (i > d) return 'down';
    return null;
  });
}

export function buildWorkoutExercises(
  list: EditorExercise[]
): { exercises: WorkoutExercise[]; errors: string[] } {
  const errors: string[] = [];
  const moved = orderMovedFor(list);
  const exercises: WorkoutExercise[] = [];

  list.forEach((ex, i) => {
    const sets: WorkoutSet[] = [];
    for (const s of ex.sets) {
      const converted = setToWorkout(s);
      if (converted === 'invalid') {
        errors.push(`${ex.exerciseName}: check weight/reps values`);
      } else if (converted !== 'empty') {
        sets.push(converted);
      }
    }
    if (sets.length === 0) return; // untouched exercises are simply not logged
    exercises.push({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      order: exercises.length,
      orderMoved: moved[i],
      variation: ex.variation.trim() === '' ? null : ex.variation.trim(),
      swappedFrom: ex.swappedFrom,
      sets,
    });
  });

  return { exercises, errors };
}

export function editorFromWorkout(
  workout: Workout | null,
  catalog: { id: string; name: string; setupNotes: string; isBodyweight: boolean; orderIndex: number }[],
  /**
   * Last performance per exercise, keyed by lower-cased name. Looked up per
   * exercise rather than per session: a movement skipped last time still has a
   * "previous" to show.
   */
  lastByName: Map<string, LastPerformance>
): EditorExercise[] {
  const catalogByName = new Map(catalog.map((c) => [c.name.toLowerCase(), c]));

  const list: EditorExercise[] = [];
  const seen = new Set<string>();

  // Exercises already logged that day, in their performed order.
  for (const ex of [...(workout?.exercises ?? [])].sort((a, b) => a.order - b.order)) {
    const cat = catalogByName.get(ex.exerciseName.toLowerCase());
    list.push({
      exerciseId: ex.exerciseId ?? cat?.id ?? null,
      exerciseName: ex.exerciseName,
      setupNotes: cat?.setupNotes ?? '',
      isBodyweight: cat?.isBodyweight ?? ex.sets.every((s) => s.weightKg === null),
      defaultIndex: cat?.orderIndex ?? 1000 + list.length,
      variation: ex.variation ?? '',
      swappedFrom: ex.swappedFrom ?? null,
      sets: ex.sets.map(setFromWorkout),
      last: lastByName.get(ex.exerciseName.toLowerCase()) ?? null,
    });
    seen.add(ex.exerciseName.toLowerCase());
  }

  // Remaining catalog exercises, ready to fill in.
  for (const c of catalog) {
    if (seen.has(c.name.toLowerCase())) continue;
    list.push({
      exerciseId: c.id,
      exerciseName: c.name,
      setupNotes: c.setupNotes,
      isBodyweight: c.isBodyweight,
      defaultIndex: c.orderIndex,
      variation: '',
      swappedFrom: null,
      sets: [],
      last: lastByName.get(c.name.toLowerCase()) ?? null,
    });
  }

  return list;
}
