import { DailyEntry, WeeklySummary } from '../types';
import { average } from './averages';
import { weightTrend } from './trend';
import { addDays, weekStartOf } from '../utils/dates';
import { Workout } from '../workouts/types';

/**
 * Groups entries (and logged workouts) into Monday–Sunday weeks and
 * summarises each one. Averages only use days where the relevant value was
 * recorded, and every average is accompanied by its data-point count.
 * Returned most-recent first; `changeVsPrevWeekKg` compares average weight
 * against the chronologically previous week that had at least one weigh-in.
 *
 * A "training day" is any day with a logged workout OR a daily entry marked
 * trained (the quick toggle still counts when no sets were logged).
 */
export function buildWeeklySummaries(
  entries: DailyEntry[],
  workouts: Workout[] = []
): WeeklySummary[] {
  const byWeek = new Map<string, DailyEntry[]>();
  for (const entry of entries) {
    const week = weekStartOf(entry.date);
    const bucket = byWeek.get(week);
    if (bucket) bucket.push(entry);
    else byWeek.set(week, [entry]);
  }

  const workoutsByWeek = new Map<string, Workout[]>();
  for (const w of workouts) {
    const week = weekStartOf(w.date);
    const bucket = workoutsByWeek.get(week);
    if (bucket) bucket.push(w);
    else workoutsByWeek.set(week, [w]);
  }

  const weekStarts = [...new Set([...byWeek.keys(), ...workoutsByWeek.keys()])].sort();
  const summaries: WeeklySummary[] = [];
  let prevAvgWeight: number | null = null;

  for (const weekStart of weekStarts) {
    const weekEntries = (byWeek.get(weekStart) ?? []).sort((a, b) =>
      a.date < b.date ? -1 : 1
    );
    const weekWorkouts = workoutsByWeek.get(weekStart) ?? [];

    const weights = weekEntries.filter((e) => e.weightKg != null).map((e) => e.weightKg as number);
    const calories = weekEntries.filter((e) => e.calories != null).map((e) => e.calories as number);
    const protein = weekEntries.filter((e) => e.proteinG != null).map((e) => e.proteinG as number);

    const avgWeight = average(weights);
    const points = weekEntries
      .filter((e) => e.weightKg != null)
      .map((e) => ({ date: e.date, weightKg: e.weightKg as number }));
    // A within-week trend from fewer than 3 points is pure noise — omit it.
    const trend = points.length >= 3 ? weightTrend(points) : null;

    const trainingDates = new Set<string>();
    for (const e of weekEntries) if (e.trained === true) trainingDates.add(e.date);
    for (const w of weekWorkouts) trainingDates.add(w.date);

    const sessionsByRoutine: Record<string, number> = {};
    let cardioMin = 0;
    for (const w of weekWorkouts) {
      if (w.type === 'cardio') {
        cardioMin += w.durationMin ?? 0;
      } else {
        const routine = w.routine ?? 'other';
        sessionsByRoutine[routine] = (sessionsByRoutine[routine] ?? 0) + 1;
      }
    }

    summaries.push({
      weekStart,
      weekEnd: addDays(weekStart, 6),
      avgWeight,
      weighIns: weights.length,
      avgCalories: average(calories),
      calorieDays: calories.length,
      avgProtein: average(protein),
      proteinDays: protein.length,
      trendKgPerWeek: trend ? trend.kgPerWeek : null,
      changeVsPrevWeekKg:
        avgWeight != null && prevAvgWeight != null ? avgWeight - prevAvgWeight : null,
      trainingDays: trainingDates.size,
      sessionsByRoutine,
      cardioMin,
      notes: weekEntries
        .filter((e) => e.notes != null && e.notes !== '')
        .map((e) => ({ date: e.date, text: e.notes as string })),
    });

    if (avgWeight != null) prevAvgWeight = avgWeight;
  }

  return summaries.reverse(); // most recent first
}
