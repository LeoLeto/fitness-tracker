import { DailyEntry, TrackingPause } from '../types';
import { addDays, dayDiff, todayStr } from '../utils/dates';

/**
 * Tracking pauses — periods where calorie logging was deliberately off.
 *
 * A pause is calorie-only by design. The days it covers contribute nothing to
 * any calorie or macro average and draw no bar on the calorie chart, for the
 * same reason a half-logged day doesn't: an unlogged holiday averaged in reads
 * as a fortnight of fasting. Anything else recorded on those days is untouched
 * — a weigh-in taken on holiday is a real weigh-in, and a workout is a real
 * workout.
 *
 * Every function here is pure and takes the pause list explicitly, so the
 * exclusion rules can be tested without a database.
 */

/**
 * The pause currently running, if any — the one that was started and never
 * resumed. At most one exists; if bad data ever produced several, the one that
 * started most recently wins, since that is the one the UI last acted on.
 */
export function activePause(pauses: TrackingPause[]): TrackingPause | null {
  const open = pauses.filter((p) => p.endDate === null);
  if (open.length === 0) return null;
  return open.reduce((latest, p) => (p.startDate > latest.startDate ? p : latest));
}

/**
 * The last paused day of a pause. A running pause has no end date yet, so it
 * covers everything up to `asOf` — today, unless a caller is reconstructing an
 * older view of the data.
 */
export function pauseEnd(pause: TrackingPause, asOf: string = todayStr()): string {
  return pause.endDate ?? asOf;
}

/** Whether `date` falls inside any pause (inclusive of both endpoints). */
export function isPaused(
  pauses: TrackingPause[],
  date: string,
  asOf: string = todayStr()
): boolean {
  return pauses.some((p) => date >= p.startDate && date <= pauseEnd(p, asOf));
}

/**
 * Number of distinct calendar days in [from, to] covered by a pause. Counted
 * over the union of the pauses rather than summed per pause, so two pauses
 * that overlap never inflate the figure.
 */
export function pausedDaysInRange(
  pauses: TrackingPause[],
  from: string,
  to: string,
  asOf: string = todayStr()
): number {
  const clipped = pauses
    .map((p) => ({
      from: p.startDate > from ? p.startDate : from,
      to: pauseEnd(p, asOf) < to ? pauseEnd(p, asOf) : to,
    }))
    .filter((p) => p.from <= p.to)
    .sort((a, b) => (a.from < b.from ? -1 : 1));

  let days = 0;
  let coveredTo: string | null = null; // last day already counted
  for (const p of clipped) {
    const start = coveredTo !== null && p.from <= coveredTo ? addDays(coveredTo, 1) : p.from;
    if (start > p.to) continue; // fully inside a pause already counted
    days += dayDiff(start, p.to) + 1;
    if (coveredTo === null || p.to > coveredTo) coveredTo = p.to;
  }
  return days;
}

/**
 * Stamps the derived `paused` flag onto entries, which is how the exclusion
 * reaches every existing average: `countsToward` reads it the same way it
 * reads `caloriesIncomplete`. Done once at the read boundary so the pause list
 * never has to be threaded through the analytics themselves.
 */
export function markPaused(
  entries: DailyEntry[],
  pauses: TrackingPause[],
  asOf: string = todayStr()
): DailyEntry[] {
  if (pauses.length === 0) return entries;
  return entries.map((e) =>
    isPaused(pauses, e.date, asOf) ? { ...e, paused: true } : e
  );
}

/** Pauses overlapping [from, to] at all, newest first. */
export function pausesOverlapping(
  pauses: TrackingPause[],
  from: string,
  to: string,
  asOf: string = todayStr()
): TrackingPause[] {
  return pauses
    .filter((p) => p.startDate <= to && pauseEnd(p, asOf) >= from)
    .sort((a, b) => (a.startDate > b.startDate ? -1 : 1));
}
