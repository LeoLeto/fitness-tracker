import { weightTrend } from '../analytics/trend';
import { DailyEntry } from '../types';
import { addDays, dayDiff, weekStartOf } from '../utils/dates';
import { exerciseSeries } from './strength';
import { BandKind, InsightEvent, WeightBand, Workout } from './types';

/**
 * Rules-based insights connecting body-weight data with training data.
 * Everything here is deliberately transparent: each insight states what was
 * detected and from how much data, so the observer can judge it.
 */

// Energy-balance regime thresholds (kg/week of weight change).
const STEEP_DEFICIT_MAX = -0.35;
const DEFICIT_MAX = -0.15;
const SURPLUS_MIN = 0.15;
const STEEP_SURPLUS_MIN = 0.35;

// Rolling window used to classify each week's regime. 28 days with ≥3
// weigh-ins works for both daily and weekly weighing habits.
const BAND_WINDOW_DAYS = 28;
const BAND_MIN_WEIGHINS = 3;
const BAND_MIN_SPAN_DAYS = 14;

// A routine untrained for this long counts as a "gap".
export const TRAINING_GAP_DAYS = 21;
// Weight rise (vs pre-resumption 7-day average) that flags fluid retention.
const RETENTION_SPIKE_KG = 1.0;
const RETENTION_LOOKAHEAD_DAYS = 10;
// Pain flags on the same exercise within this window count as recurring.
const PAIN_CLUSTER_DAYS = 45;

function classify(trendKgPerWeek: number): BandKind {
  if (trendKgPerWeek <= STEEP_DEFICIT_MAX) return 'steep-deficit';
  if (trendKgPerWeek < DEFICIT_MAX) return 'deficit';
  if (trendKgPerWeek >= STEEP_SURPLUS_MIN) return 'steep-surplus';
  if (trendKgPerWeek > SURPLUS_MIN) return 'surplus';
  return 'maintenance';
}

interface WeighIn {
  date: string;
  weightKg: number;
}

function weighIns(entries: DailyEntry[]): WeighIn[] {
  return entries
    .filter((e) => e.weightKg != null)
    .map((e) => ({ date: e.date, weightKg: e.weightKg as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Splits the timeline into energy-balance bands. Each week is classified by
 * the regression trend of the trailing 21 days of weigh-ins (needs ≥4
 * weigh-ins spanning ≥10 days), and consecutive weeks with the same regime
 * are merged. Single-week bands are dropped as noise.
 */
export function weightBands(entries: DailyEntry[], workouts: Workout[]): WeightBand[] {
  const points = weighIns(entries);
  if (points.length < BAND_MIN_WEIGHINS) return [];

  const firstWeek = weekStartOf(points[0].date);
  const lastWeek = weekStartOf(points[points.length - 1].date);

  const weekly: { weekStart: string; kind: BandKind; trend: number }[] = [];
  for (let week = firstWeek; week <= lastWeek; week = addDays(week, 7)) {
    const weekEnd = addDays(week, 6);
    const windowStart = addDays(weekEnd, -(BAND_WINDOW_DAYS - 1));
    const window = points.filter(
      (p) => p.date >= windowStart && p.date <= weekEnd
    );
    if (window.length < BAND_MIN_WEIGHINS) continue;
    const trend = weightTrend(window);
    if (!trend || trend.spanDays < BAND_MIN_SPAN_DAYS) continue;
    weekly.push({ weekStart: week, kind: classify(trend.kgPerWeek), trend: trend.kgPerWeek });
  }

  // Merge consecutive same-kind weeks (weeks with no data break a band).
  const bands: WeightBand[] = [];
  for (const w of weekly) {
    const prev = bands[bands.length - 1];
    if (
      prev &&
      prev.kind === w.kind &&
      addDays(prev.to, 1) === w.weekStart
    ) {
      prev.to = addDays(w.weekStart, 6);
      prev.trendKgPerWeek = (prev.trendKgPerWeek + w.trend) / 2;
    } else {
      bands.push({
        from: w.weekStart,
        to: addDays(w.weekStart, 6),
        kind: w.kind,
        trendKgPerWeek: w.trend,
        strengthChangePct: {},
      });
    }
  }

  const kept = bands.filter((b) => dayDiff(b.from, b.to) + 1 >= 14);
  for (const band of kept) {
    band.strengthChangePct = strengthChangeInBand(workouts, band.from, band.to);
  }
  return kept;
}

/**
 * Average e1RM change (%) per routine across a period: for every exercise
 * with ≥3 sessions inside the band, compare its first and last session
 * metric; average those changes per routine.
 */
function strengthChangeInBand(
  workouts: Workout[],
  from: string,
  to: string
): Record<string, number> {
  const names = new Map<string, string>(); // "routine::name" → routine
  for (const w of workouts) {
    if (w.type !== 'strength') continue;
    for (const ex of w.exercises) {
      if (ex.sets.length > 0) {
        names.set(`${w.routine}::${ex.exerciseName}`, w.routine ?? 'other');
      }
    }
  }

  const byRoutine = new Map<string, number[]>();
  for (const [key, routine] of names) {
    const exerciseName = key.split('::')[1];
    const series = exerciseSeries(workouts, exerciseName).filter(
      (p) => p.date >= from && p.date <= to
    );
    if (series.length < 3) continue;
    const metric = (p: (typeof series)[number]) => p.e1rm ?? p.bestReps;
    const first = metric(series[0]);
    const last = metric(series[series.length - 1]);
    if (first > 0) {
      const pct = ((last - first) / first) * 100;
      const list = byRoutine.get(routine);
      if (list) list.push(pct);
      else byRoutine.set(routine, [pct]);
    }
  }

  const result: Record<string, number> = {};
  for (const [routine, values] of byRoutine) {
    result[routine] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  return result;
}

/** Gaps ≥ 21 days in a routine's training, reported at the resumption date. */
export function trainingGapEvents(workouts: Workout[]): InsightEvent[] {
  const datesByRoutine = new Map<string, string[]>();
  for (const w of workouts) {
    if (w.type !== 'strength' || !w.routine) continue;
    const list = datesByRoutine.get(w.routine);
    if (list) list.push(w.date);
    else datesByRoutine.set(w.routine, [w.date]);
  }

  const events: InsightEvent[] = [];
  for (const [routine, dates] of datesByRoutine) {
    const sorted = [...new Set(dates)].sort();
    for (let i = 1; i < sorted.length; i++) {
      const gap = dayDiff(sorted[i - 1], sorted[i]);
      if (gap >= TRAINING_GAP_DAYS) {
        events.push({
          date: sorted[i],
          kind: 'training-gap-ended',
          routine,
          title: `${capitalize(routine)} training resumed after ${gap} days`,
          detail: `No ${routine} sessions between ${sorted[i - 1]} and ${sorted[i]}.`,
        });
      }
    }
  }
  return events;
}

/**
 * After a training gap ends, a fast body-weight rise usually reflects
 * intramuscular fluid/glycogen (especially for large muscle groups like
 * legs), not fat. Detected as: peak weight within 10 days after resumption
 * ≥ 1.0 kg above the 7-day average before it.
 */
export function fluidRetentionEvents(
  entries: DailyEntry[],
  gapEvents: InsightEvent[]
): InsightEvent[] {
  const points = weighIns(entries);
  const events: InsightEvent[] = [];

  for (const gap of gapEvents) {
    const beforeFrom = addDays(gap.date, -7);
    const before = points.filter((p) => p.date >= beforeFrom && p.date < gap.date);
    // Fall back to the last weigh-in before resumption when the week was sparse.
    const baselinePoints =
      before.length > 0 ? before : points.filter((p) => p.date < gap.date).slice(-1);
    if (baselinePoints.length === 0) continue;
    const baseline =
      baselinePoints.reduce((a, p) => a + p.weightKg, 0) / baselinePoints.length;

    const lookaheadEnd = addDays(gap.date, RETENTION_LOOKAHEAD_DAYS);
    const after = points.filter((p) => p.date >= gap.date && p.date <= lookaheadEnd);
    if (after.length === 0) continue;
    const peak = after.reduce((max, p) => (p.weightKg > max.weightKg ? p : max), after[0]);

    const rise = peak.weightKg - baseline;
    if (rise >= RETENTION_SPIKE_KG) {
      events.push({
        date: peak.date,
        kind: 'fluid-retention-spike',
        routine: gap.routine,
        title: `+${rise.toFixed(1)} kg within ${dayDiff(gap.date, peak.date)} days of resuming ${gap.routine}`,
        detail:
          `Body weight rose from ~${baseline.toFixed(1)} kg to ${peak.weightKg.toFixed(1)} kg right after ` +
          `${gap.routine} training resumed. A jump this fast is mostly intramuscular fluid and glycogen ` +
          `(most visible in large muscle groups), not fat — don't read it as a real mass change.`,
      });
    }
  }
  return events;
}

/** ≥2 pain flags (🚨) on the same exercise within 45 days. */
export function recurringPainEvents(workouts: Workout[]): InsightEvent[] {
  const painDates = new Map<string, { routine: string | null; dates: string[] }>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.sets.some((s) => s.pain)) {
        const entry = painDates.get(ex.exerciseName) ?? { routine: w.routine, dates: [] };
        entry.dates.push(w.date);
        painDates.set(ex.exerciseName, entry);
      }
    }
  }

  const events: InsightEvent[] = [];
  for (const [exercise, { routine, dates }] of painDates) {
    const sorted = [...new Set(dates)].sort();
    for (let i = 1; i < sorted.length; i++) {
      if (dayDiff(sorted[i - 1], sorted[i]) <= PAIN_CLUSTER_DAYS) {
        events.push({
          date: sorted[i],
          kind: 'recurring-pain',
          routine: routine ?? undefined,
          exercise,
          title: `Pain flagged again on ${exercise}`,
          detail:
            `Sets cut short by pain (🚨) on ${sorted.slice(Math.max(0, i - 1)).join(' and ')}. ` +
            `Recurring pain on the same movement is worth addressing (form, setup, load or a substitute exercise).`,
        });
        break; // one event per exercise cluster is enough
      }
    }
  }
  return events;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
