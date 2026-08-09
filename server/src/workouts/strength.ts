import { weekStartOf } from '../utils/dates';
import {
  ExerciseSessionPoint,
  WeeklyTrainingBar,
  Workout,
  WorkoutExercise,
} from './types';

/**
 * Strength metrics.
 *
 * Estimated 1RM uses the Epley formula, adjusted for reps in reserve so that
 * submaximal sets are comparable to sets taken to failure:
 *
 *   effectiveReps = reps + RIR        (RIR unknown → treated as 0)
 *   e1RM = weight × (1 + effectiveReps / 30)
 *
 * e.g. 90 kg × 7 reps @ 2 RIR → 90 × (1 + 9/30) = 117 kg.
 * For bodyweight exercises (no external load) the strength metric is the
 * best set's effective reps instead.
 */
export function estimated1RM(weightKg: number, reps: number, rir: number | null): number {
  const effectiveReps = reps + (rir ?? 0);
  return weightKg * (1 + effectiveReps / 30);
}

export function sessionPoint(workout: Workout, ex: WorkoutExercise): ExerciseSessionPoint {
  let bestE1rm: number | null = null;
  let bestReps = 0;
  let topWeight: number | null = null;
  let volume = 0;

  for (const s of ex.sets) {
    const effReps = s.reps + (s.rir ?? 0);
    bestReps = Math.max(bestReps, effReps);
    if (s.weightKg != null) {
      const e = estimated1RM(s.weightKg, s.reps, s.rir);
      if (bestE1rm === null || e > bestE1rm) bestE1rm = e;
      if (topWeight === null || s.weightKg > topWeight) topWeight = s.weightKg;
      volume += s.weightKg * s.reps;
    }
  }

  return {
    date: workout.date,
    workoutId: workout.id,
    e1rm: bestE1rm,
    bestReps,
    topWeightKg: topWeight,
    volumeKg: volume,
    totalSets: ex.sets.length,
    hadPain: ex.sets.some((s) => s.pain),
    hadBadForm: ex.sets.some((s) => s.badForm),
    variation: ex.variation,
  };
}

/** Chronological session points for one exercise (matched by name, case-insensitive). */
export function exerciseSeries(workouts: Workout[], exerciseName: string): ExerciseSessionPoint[] {
  const wanted = exerciseName.trim().toLowerCase();
  const points: ExerciseSessionPoint[] = [];
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.exerciseName.trim().toLowerCase() === wanted && ex.sets.length > 0) {
        points.push(sessionPoint(w, ex));
      }
    }
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Weekly training bars: strength sessions per routine, sets, cardio minutes. */
export function weeklyTraining(workouts: Workout[]): WeeklyTrainingBar[] {
  const byWeek = new Map<string, WeeklyTrainingBar>();
  for (const w of workouts) {
    const weekStart = weekStartOf(w.date);
    let bar = byWeek.get(weekStart);
    if (!bar) {
      bar = { weekStart, sessions: {}, totalSets: 0, cardioMin: 0, cardioSessions: 0 };
      byWeek.set(weekStart, bar);
    }
    if (w.type === 'cardio') {
      bar.cardioSessions += 1;
      bar.cardioMin += w.durationMin ?? 0;
    } else {
      const routine = w.routine ?? 'other';
      bar.sessions[routine] = (bar.sessions[routine] ?? 0) + 1;
      bar.totalSets += w.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    }
  }
  return [...byWeek.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

/**
 * Weekly strength index per routine, 100 = each exercise's first observed
 * session in the period. Each exercise is normalised against itself (e1RM for
 * weighted work, best effective reps for bodyweight), then exercises in the
 * same routine are averaged — so "legs 95" means leg lifts are ~5% below
 * where they started in the selected period, regardless of units.
 */
export function strengthIndexWeekly(
  workouts: Workout[]
): { weekStart: string; byRoutine: Record<string, number> }[] {
  interface SeriesEntry {
    routine: string;
    baseline: number;
    weekly: Map<string, number[]>; // weekStart → session indexes
  }

  const byExercise = new Map<string, SeriesEntry>();
  const sorted = [...workouts]
    .filter((w) => w.type === 'strength')
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  for (const w of sorted) {
    for (const ex of w.exercises) {
      if (ex.sets.length === 0) continue;
      const point = sessionPoint(w, ex);
      const metric = point.e1rm ?? (point.bestReps > 0 ? point.bestReps : null);
      if (metric === null || metric <= 0) continue;

      const key = `${w.routine}::${ex.exerciseName.trim().toLowerCase()}`;
      let entry = byExercise.get(key);
      if (!entry) {
        entry = { routine: w.routine ?? 'other', baseline: metric, weekly: new Map() };
        byExercise.set(key, entry);
      }
      const weekStart = weekStartOf(w.date);
      const index = (metric / entry.baseline) * 100;
      const list = entry.weekly.get(weekStart);
      if (list) list.push(index);
      else entry.weekly.set(weekStart, [index]);
    }
  }

  // routine → weekStart → per-exercise mean indexes
  const weeks = new Map<string, Map<string, number[]>>();
  for (const entry of byExercise.values()) {
    for (const [weekStart, indexes] of entry.weekly) {
      const mean = indexes.reduce((a, b) => a + b, 0) / indexes.length;
      let week = weeks.get(weekStart);
      if (!week) {
        week = new Map();
        weeks.set(weekStart, week);
      }
      const list = week.get(entry.routine);
      if (list) list.push(mean);
      else week.set(entry.routine, [mean]);
    }
  }

  return [...weeks.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([weekStart, byRoutineLists]) => {
      const byRoutine: Record<string, number> = {};
      for (const [routine, values] of byRoutineLists) {
        byRoutine[routine] = values.reduce((a, b) => a + b, 0) / values.length;
      }
      return { weekStart, byRoutine };
    });
}
