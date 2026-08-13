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

// ── Strength metric (mirrors server/src/workouts/strength.ts) ────────────────

/** One set's standing on the strength metric. */
export interface Performance {
  /** Epley e1RM adjusted for reps in reserve; null for an unloaded set. */
  e1rm: number | null;
  /** reps + RIR — the metric for bodyweight work. */
  effectiveReps: number;
}

export function performanceOf(s: WorkoutSet): Performance {
  const effectiveReps = s.reps + (s.rir ?? 0);
  return {
    e1rm: s.weightKg != null ? s.weightKg * (1 + effectiveReps / 30) : null,
    effectiveReps,
  };
}

/** A loaded set beats an unloaded one; otherwise higher e1RM / effective reps. */
export function beatsPerformance(a: Performance, b: Performance): boolean {
  if (a.e1rm != null && b.e1rm != null) return a.e1rm > b.e1rm;
  if (a.e1rm != null) return true;
  if (b.e1rm != null) return false;
  return a.effectiveReps > b.effectiveReps;
}

/** Best set of a session by that ranking; null when nothing is logged yet. */
export function bestPerformance(sets: WorkoutSet[]): Performance | null {
  let best: Performance | null = null;
  for (const s of sets) {
    const p = performanceOf(s);
    if (best === null || beatsPerformance(p, best)) best = p;
  }
  return best;
}

/** "117.0 kg e1RM" for loaded work, "10 eff. reps" for bodyweight. */
export function formatPerformance(p: Performance): string {
  return p.e1rm != null ? `${p.e1rm.toFixed(1)} kg e1RM` : `${p.effectiveReps} eff. reps`;
}

/** The single set behind a record: "94 ×7 (2 RIR)". */
export function formatSet(s: {
  weightKg: number | null;
  reps: number;
  rir: number | null;
}): string {
  const load = s.weightKg != null ? String(s.weightKg) : 'BW';
  return `${load} ×${s.reps}${s.rir != null ? ` (${s.rir} RIR)` : ''}`;
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
