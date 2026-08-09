import { DailyEntry } from '../types';
import {
  fluidRetentionEvents,
  recurringPainEvents,
  trainingGapEvents,
  weightBands,
} from './insights';
import { strengthIndexWeekly, weeklyTraining } from './strength';
import { InsightEvent, TimelinePayload, Workout } from './types';

/**
 * Assembles the "Body & Training" timeline: date-aligned body-weight,
 * calorie, strength-index and training-volume series plus insight
 * bands/events, so cross-domain patterns (deficit ↔ strength loss,
 * resumed legs ↔ water-weight spike) are visible on one axis.
 *
 * Bands and events are computed over the full history (they need context
 * beyond the visible window) and then clipped to the requested range.
 */
export function buildTimeline(
  entries: DailyEntry[],
  workouts: Workout[],
  from: string,
  to: string
): TimelinePayload {
  const inRange = (date: string) => date >= from && date <= to;

  const gapEvents = trainingGapEvents(workouts);
  const events: InsightEvent[] = [
    ...gapEvents,
    ...fluidRetentionEvents(entries, gapEvents),
    ...recurringPainEvents(workouts),
  ]
    .filter((e) => inRange(e.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const bands = weightBands(entries, workouts)
    .filter((b) => b.to >= from && b.from <= to)
    .map((b) => ({
      ...b,
      from: b.from < from ? from : b.from,
      to: b.to > to ? to : b.to,
    }));

  const rangeWorkouts = workouts.filter((w) => inRange(w.date));

  return {
    period: { from, to },
    weight: entries
      .filter((e) => inRange(e.date) && e.weightKg != null)
      .map((e) => ({ date: e.date, weightKg: e.weightKg as number })),
    calories: entries
      .filter((e) => inRange(e.date) && e.calories != null)
      .map((e) => ({ date: e.date, calories: e.calories as number })),
    strengthIndex: strengthIndexWeekly(rangeWorkouts),
    training: weeklyTraining(rangeWorkouts),
    bands,
    events,
  };
}
