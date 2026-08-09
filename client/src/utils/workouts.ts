import { WorkoutSet } from '../types';

/** Canonical routine order for stacking/legends (custom routines follow). */
export const ROUTINE_ORDER = ['push', 'pull', 'legs', 'abs'];

export function routineLabel(routine: string): string {
  return routine.charAt(0).toUpperCase() + routine.slice(1);
}

function flags(s: WorkoutSet): string {
  let out = '';
  if (s.repsUncertain) out += '?';
  if (s.badForm) out += '*';
  if (s.pain) out += '🚨';
  return out;
}

/**
 * Compact rendering in the user's own notation:
 * "90 x7 (2 RIR) x7 (1 RIR) x8* (0 RIR); 80 x6" (kept in sync with the
 * server-side formatter used for exports).
 */
export function formatSets(sets: WorkoutSet[]): string {
  const parts: string[] = [];
  let currentWeight: number | null | undefined = undefined;
  let current = '';

  for (const s of sets) {
    if (s.weightKg !== currentWeight || current === '') {
      if (current !== '') parts.push(current);
      currentWeight = s.weightKg;
      current = s.weightKg != null ? String(s.weightKg) : 'BW';
    }
    current += ` x${s.reps}${flags(s)}`;
    if (s.rir != null) current += ` (${s.rir} RIR)`;
  }
  if (current !== '') parts.push(current);
  return parts.join('; ');
}

/** Short summary for history rows: "5 exercises · 15 sets" or "treadmill · 30 min". */
export function workoutSummary(w: {
  type: string;
  cardioType: string | null;
  durationMin: number | null;
  exercises: { sets: unknown[] }[];
}): string {
  if (w.type === 'cardio') {
    const parts = [w.cardioType ?? 'cardio'];
    if (w.durationMin != null) parts.push(`${w.durationMin} min`);
    return parts.join(' · ');
  }
  const sets = w.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  return `${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'} · ${sets} sets`;
}
