import { isValidDateStr } from '../utils/dates';
import { ValidationResult } from '../utils/validation';
import { Exercise, Workout, WorkoutExercise, WorkoutSet } from './types';

function str(v: unknown, maxLen: number): string | null | 'invalid' {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return 'invalid';
  const t = v.trim();
  if (t === '') return null;
  return t.length <= maxLen ? t : 'invalid';
}

function num(
  v: unknown,
  min: number,
  max: number,
  integer = false
): number | null | 'invalid' {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return 'invalid';
  if (integer && !Number.isInteger(n)) return 'invalid';
  return n;
}

function bool(v: unknown): boolean {
  return v === true;
}

function validateSet(raw: unknown, errors: string[], label: string): WorkoutSet | null {
  const s = (raw ?? {}) as Record<string, unknown>;
  const reps = num(s.reps, 1, 500, true);
  if (reps === null || reps === 'invalid') {
    errors.push(`${label}: reps must be an integer ≥ 1`);
    return null;
  }
  const weightKg = num(s.weightKg, 0, 2000);
  const rir = num(s.rir, 0, 10, true);
  const note = str(s.note, 200);
  if (weightKg === 'invalid') errors.push(`${label}: weightKg is invalid`);
  if (rir === 'invalid') errors.push(`${label}: rir is invalid`);
  if (note === 'invalid') errors.push(`${label}: note is too long`);
  if (weightKg === 'invalid' || rir === 'invalid' || note === 'invalid') return null;
  return {
    weightKg,
    reps,
    rir,
    repsUncertain: bool(s.repsUncertain),
    badForm: bool(s.badForm),
    pain: bool(s.pain),
    isDropSet: bool(s.isDropSet),
    note,
  };
}

export function validateWorkout(body: unknown): ValidationResult<Omit<Workout, 'id'>> {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  if (!isValidDateStr(b.date)) errors.push('date must be a valid ISO date (YYYY-MM-DD)');
  const type = b.type === 'strength' || b.type === 'cardio' ? b.type : null;
  if (!type) errors.push('type must be "strength" or "cardio"');

  const routine = str(b.routine, 40);
  const cardioType = str(b.cardioType, 60);
  const durationMin = num(b.durationMin, 0, 1440, true);
  const notes = str(b.notes, 2000);
  if (routine === 'invalid') errors.push('routine is invalid');
  if (cardioType === 'invalid') errors.push('cardioType is invalid');
  if (durationMin === 'invalid') errors.push('durationMin is invalid');
  if (notes === 'invalid') errors.push('notes is too long');
  if (type === 'strength' && (routine === null || routine === 'invalid')) {
    errors.push('strength workouts need a routine');
  }

  const rawExercises = Array.isArray(b.exercises) ? b.exercises : [];
  if (rawExercises.length > 40) errors.push('too many exercises');
  const exercises: WorkoutExercise[] = [];
  rawExercises.forEach((rawEx, i) => {
    const ex = (rawEx ?? {}) as Record<string, unknown>;
    const name = str(ex.exerciseName, 100);
    if (name === null || name === 'invalid') {
      errors.push(`exercise ${i + 1}: exerciseName is required`);
      return;
    }
    const variation = str(ex.variation, 200);
    if (variation === 'invalid') errors.push(`exercise ${i + 1}: variation is too long`);
    const rawSets = Array.isArray(ex.sets) ? ex.sets : [];
    if (rawSets.length > 30) errors.push(`exercise ${i + 1}: too many sets`);
    const sets = rawSets
      .map((s, j) => validateSet(s, errors, `exercise ${i + 1} set ${j + 1}`))
      .filter((s): s is WorkoutSet => s !== null);
    exercises.push({
      exerciseId: typeof ex.exerciseId === 'string' ? ex.exerciseId : null,
      exerciseName: name,
      order: typeof ex.order === 'number' && Number.isInteger(ex.order) ? ex.order : i,
      orderMoved: ex.orderMoved === 'up' || ex.orderMoved === 'down' ? ex.orderMoved : null,
      variation: variation === 'invalid' ? null : variation,
      sets,
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      date: b.date as string,
      type: type as 'strength' | 'cardio',
      routine: (routine as string | null)?.toLowerCase() ?? null,
      cardioType: cardioType as string | null,
      durationMin: durationMin as number | null,
      notes: notes as string | null,
      dateInferred: bool(b.dateInferred),
      exercises,
    },
  };
}

export function validateExercise(body: unknown): ValidationResult<Omit<Exercise, 'id'>> {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const name = str(b.name, 100);
  if (name === null || name === 'invalid') errors.push('name is required (≤100 chars)');
  const routine = str(b.routine, 40);
  if (routine === null || routine === 'invalid') errors.push('routine is required (≤40 chars)');
  const setupNotes = str(b.setupNotes, 500);
  if (setupNotes === 'invalid') errors.push('setupNotes is too long');
  const orderIndex = num(b.orderIndex, 0, 1000, true);
  if (orderIndex === 'invalid') errors.push('orderIndex is invalid');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: name as string,
      routine: (routine as string).toLowerCase(),
      setupNotes: (setupNotes as string | null) ?? '',
      isBodyweight: bool(b.isBodyweight),
      orderIndex: (orderIndex as number | null) ?? 0,
      archived: bool(b.archived),
    },
  };
}
