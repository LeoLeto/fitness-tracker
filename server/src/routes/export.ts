import { Router } from 'express';
import { DailyEntryModel, serializeEntry } from '../models/DailyEntry';
import { getOrCreateProfile, serializeProfile } from '../models/Profile';
import { serializeWorkout, WorkoutModel } from '../models/Workout';
import {
  buildChatGptPrompt,
  buildCsv,
  buildMarkdown,
  buildMealsCsv,
  buildWorkoutsCsv,
  buildWorkoutsMarkdown,
} from '../services/exportService';
import { asyncHandler } from '../utils/asyncHandler';
import { parseRangeQuery, rangeFilter } from '../utils/rangeQuery';

export const exportRouter = Router();

async function loadEntries(req: Parameters<typeof parseRangeQuery>[0]) {
  const range = parseRangeQuery(req);
  const docs = await DailyEntryModel.find(rangeFilter(range)).sort({ date: 1 }).lean();
  return docs.map((d) => serializeEntry(d as Record<string, unknown>));
}

async function loadWorkouts(req: Parameters<typeof parseRangeQuery>[0]) {
  const range = parseRangeQuery(req);
  const docs = await WorkoutModel.find(rangeFilter(range)).sort({ date: 1 }).lean();
  return docs.map((d) => serializeWorkout(d as Record<string, unknown>));
}

// GET /api/export/csv?from&to — raw daily data as CSV
exportRouter.get(
  '/csv',
  asyncHandler(async (req, res) => {
    const entries = await loadEntries(req);
    res
      .type('text/csv; charset=utf-8')
      .setHeader('Content-Disposition', 'attachment; filename="fitness-data.csv"')
      .send(buildCsv(entries));
  })
);

// GET /api/export/json?from&to — raw daily data as JSON (no Mongo internals)
exportRouter.get(
  '/json',
  asyncHandler(async (req, res) => {
    const entries = await loadEntries(req);
    res
      .setHeader('Content-Disposition', 'attachment; filename="fitness-data.json"')
      .json(entries);
  })
);

// GET /api/export/meals.csv?from&to — one row per logged meal
exportRouter.get(
  '/meals.csv',
  asyncHandler(async (req, res) => {
    const entries = await loadEntries(req);
    res
      .type('text/csv; charset=utf-8')
      .setHeader('Content-Disposition', 'attachment; filename="meals.csv"')
      .send(buildMealsCsv(entries));
  })
);

// GET /api/export/workouts.csv?from&to — one row per set
exportRouter.get(
  '/workouts.csv',
  asyncHandler(async (req, res) => {
    const workouts = await loadWorkouts(req);
    res
      .type('text/csv; charset=utf-8')
      .setHeader('Content-Disposition', 'attachment; filename="workouts.csv"')
      .send(buildWorkoutsCsv(workouts));
  })
);

// GET /api/export/workouts.json?from&to
exportRouter.get(
  '/workouts.json',
  asyncHandler(async (req, res) => {
    const workouts = await loadWorkouts(req);
    res
      .setHeader('Content-Disposition', 'attachment; filename="workouts.json"')
      .json(workouts);
  })
);

// GET /api/export/chatgpt?from&to&prompt=1&workouts=0
// Markdown summary + daily-data table (+ workout log unless workouts=0);
// with prompt=1, prefixed by the analysis prompt.
exportRouter.get(
  '/chatgpt',
  asyncHandler(async (req, res) => {
    const entries = await loadEntries(req);
    const includePrompt = req.query.prompt === '1' || req.query.prompt === 'true';
    const includeWorkouts = req.query.workouts !== '0';
    const workouts = includeWorkouts ? await loadWorkouts(req) : [];

    let text: string;
    if (includePrompt) {
      const profile = serializeProfile((await getOrCreateProfile()).toObject());
      text = buildChatGptPrompt(entries, profile, workouts.length > 0);
    } else {
      text = buildMarkdown(entries);
    }
    if (workouts.length > 0) {
      text += `\n## Workout log\n\n${buildWorkoutsMarkdown(workouts)}`;
    }
    res.type('text/markdown; charset=utf-8').send(text);
  })
);
