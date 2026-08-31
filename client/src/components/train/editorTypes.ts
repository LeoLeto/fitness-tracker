import { LastPerformance, Workout, WorkoutExercise, WorkoutSet } from '../../types';
import { parseDecimal } from '../../utils/numeric';
import { defaultVariant, perfKey } from '../../utils/variants';

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
  /** The catalog's named forms of this movement; empty when it has only one. */
  variants: string[];
  /**
   * Which of them this session is on. It is the key the card's history is read
   * under, so switching it swaps out `last` (and the PR the page passes down)
   * for that machine's own numbers.
   */
  variant: string | null;
  /** Set when this exercise took over from another one mid-session (⇄). */
  swappedFrom: string | null;
  sets: EditorSet[];
  /** Last time this exercise was performed on this variant — ghosts + "last". */
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
      variant: ex.variant,
      swappedFrom: ex.swappedFrom,
      sets,
    });
  });

  return { exercises, errors };
}

/** Catalog shape the editor needs — the fields that seed a card. */
export interface CatalogExercise {
  id: string;
  name: string;
  setupNotes: string;
  isBodyweight: boolean;
  orderIndex: number;
  variants: string[];
}

/**
 * Last performances indexed by (exercise, variant). Keying on the pair is what
 * keeps the low row's chest-supported numbers away from the cable stack's,
 * whose loads are half again as heavy.
 */
export function lastByKeyFrom(records: LastPerformance[]): Map<string, LastPerformance> {
  return new Map(records.map((r) => [perfKey(r.exerciseName, r.variant), r]));
}

/**
 * The most recent performance of each exercise whatever variant it was on —
 * which machine an untouched card should open on.
 */
function latestByName(records: LastPerformance[]): Map<string, LastPerformance> {
  const latest = new Map<string, LastPerformance>();
  for (const r of records) {
    const key = r.exerciseName.trim().toLowerCase();
    const seen = latest.get(key);
    if (seen === undefined || r.date > seen.date) latest.set(key, r);
  }
  return latest;
}

/**
 * Points an exercise at another variant, together with the history that goes
 * with it: the "last" line, the ghost placeholders and (via the page's PR
 * lookup) the record to beat all follow the machine you're actually on.
 */
export function withVariant(
  ex: EditorExercise,
  variant: string | null,
  lastByKey: Map<string, LastPerformance>
): EditorExercise {
  return {
    ...ex,
    variant,
    last: lastByKey.get(perfKey(ex.exerciseName, variant)) ?? null,
  };
}

export function editorFromWorkout(
  workout: Workout | null,
  catalog: CatalogExercise[],
  /**
   * Last performance per exercise and variant. Looked up per exercise rather
   * than per session: a movement skipped last time still has a "previous" to
   * show.
   */
  lastRecords: LastPerformance[]
): EditorExercise[] {
  const catalogByName = new Map(catalog.map((c) => [c.name.toLowerCase(), c]));
  const lastByKey = lastByKeyFrom(lastRecords);
  const latest = latestByName(lastRecords);

  const list: EditorExercise[] = [];
  const seen = new Set<string>();

  // Exercises already logged that day, in their performed order.
  for (const ex of [...(workout?.exercises ?? [])].sort((a, b) => a.order - b.order)) {
    const cat = catalogByName.get(ex.exerciseName.toLowerCase());
    // What was recorded, not what would be chosen now: a session logged before
    // the exercise had variants keeps its blank one rather than being silently
    // reassigned to a machine it may not have been done on.
    const variant = ex.variant ?? null;
    list.push({
      exerciseId: ex.exerciseId ?? cat?.id ?? null,
      exerciseName: ex.exerciseName,
      setupNotes: cat?.setupNotes ?? '',
      isBodyweight: cat?.isBodyweight ?? ex.sets.every((s) => s.weightKg === null),
      defaultIndex: cat?.orderIndex ?? 1000 + list.length,
      variation: ex.variation ?? '',
      variants: cat?.variants ?? [],
      variant,
      swappedFrom: ex.swappedFrom ?? null,
      sets: ex.sets.map(setFromWorkout),
      last: lastByKey.get(perfKey(ex.exerciseName, variant)) ?? null,
    });
    seen.add(ex.exerciseName.toLowerCase());
  }

  // Remaining catalog exercises, ready to fill in.
  for (const c of catalog) {
    if (seen.has(c.name.toLowerCase())) continue;
    const variant = defaultVariant(c.variants, latest.get(c.name.toLowerCase())?.variant);
    list.push({
      exerciseId: c.id,
      exerciseName: c.name,
      setupNotes: c.setupNotes,
      isBodyweight: c.isBodyweight,
      defaultIndex: c.orderIndex,
      variation: '',
      variants: c.variants,
      variant,
      swappedFrom: null,
      sets: [],
      last: lastByKey.get(perfKey(c.name, variant)) ?? null,
    });
  }

  return list;
}
