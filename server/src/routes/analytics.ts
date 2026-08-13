import { Router } from 'express';
import { buildAnalyticsSummary } from '../analytics/summary';
import { buildWeeklySummaries } from '../analytics/weekly';
import { DailyEntryModel, serializeEntry } from '../models/DailyEntry';
import { getOrCreateProfile, serializeProfile } from '../models/Profile';
import { serializeWorkout, WorkoutModel } from '../models/Workout';
import { asyncHandler } from '../utils/asyncHandler';
import { addDays, todayStr } from '../utils/dates';
import { parseRangeQuery } from '../utils/rangeQuery';
import { exerciseSeries, personalBests } from '../workouts/strength';
import { buildTimeline } from '../workouts/timeline';

export const analyticsRouter = Router();

const DEFAULT_PERIOD_DAYS = 28;

async function loadEntries(maxDate?: string) {
  const filter = maxDate ? { date: { $lte: maxDate } } : {};
  const docs = await DailyEntryModel.find(filter).sort({ date: 1 }).lean();
  return docs.map((d) => serializeEntry(d as Record<string, unknown>));
}

async function loadWorkouts() {
  const docs = await WorkoutModel.find().sort({ date: 1 }).lean();
  return docs.map((d) => serializeWorkout(d as Record<string, unknown>));
}

// GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD (default: last 28 days)
analyticsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const range = parseRangeQuery(req);
    const to = range.to ?? todayStr();
    const from = range.from ?? addDays(to, -(DEFAULT_PERIOD_DAYS - 1));

    // Fetch everything up to `to`: rolling windows and "latest weight" may
    // legitimately look slightly before `from`.
    const entries = await loadEntries(to);
    const profile = serializeProfile((await getOrCreateProfile()).toObject());

    res.json(buildAnalyticsSummary(entries, profile, from, to));
  })
);

// GET /api/analytics/weekly — Monday-based weekly review of all data
analyticsRouter.get(
  '/weekly',
  asyncHandler(async (_req, res) => {
    const [entries, workouts] = await Promise.all([loadEntries(), loadWorkouts()]);
    res.json(buildWeeklySummaries(entries, workouts));
  })
);

// GET /api/analytics/strength?exercise=Chest%20press — e1RM/reps series
analyticsRouter.get(
  '/strength',
  asyncHandler(async (req, res) => {
    const exercise = typeof req.query.exercise === 'string' ? req.query.exercise : '';
    if (!exercise) {
      res.status(400).json({ error: 'exercise query param is required' });
      return;
    }
    const workouts = await loadWorkouts();
    res.json({ exercise, points: exerciseSeries(workouts, exercise) });
  })
);

// GET /api/analytics/records — all-time best set per exercise (for the logger)
analyticsRouter.get(
  '/records',
  asyncHandler(async (_req, res) => {
    const workouts = await loadWorkouts();
    res.json({ records: personalBests(workouts) });
  })
);

// GET /api/analytics/timeline?from&to — Body & Training correlation payload
// (defaults to the full recorded history).
analyticsRouter.get(
  '/timeline',
  asyncHandler(async (req, res) => {
    const range = parseRangeQuery(req);
    const [entries, workouts] = await Promise.all([loadEntries(), loadWorkouts()]);

    const firstData =
      [entries[0]?.date, workouts[0]?.date].filter(Boolean).sort()[0] ?? todayStr();
    const to = range.to ?? todayStr();
    const from = range.from ?? firstData;

    res.json(buildTimeline(entries, workouts, from, to));
  })
);
