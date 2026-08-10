import { Router } from 'express';
import { DailyEntryModel, serializeEntry } from '../models/DailyEntry';
import { upsertEntry } from '../services/entriesService';
import { applyMealTotals } from '../services/mealTotals';
import { asyncHandler } from '../utils/asyncHandler';
import { isValidDateStr } from '../utils/dates';
import { parseRangeQuery, rangeFilter } from '../utils/rangeQuery';
import { validateEntry, validateEntryPatch } from '../utils/validation';

export const entriesRouter = Router();

entriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const range = parseRangeQuery(req);
    const docs = await DailyEntryModel.find(rangeFilter(range)).sort({ date: 1 }).lean();
    res.json(docs.map((d) => serializeEntry(d as Record<string, unknown>)));
  })
);

entriesRouter.get(
  '/:date',
  asyncHandler(async (req, res) => {
    const { date } = req.params;
    if (!isValidDateStr(date)) {
      res.status(400).json({ error: 'Invalid date' });
      return;
    }
    const doc = await DailyEntryModel.findOne({ date }).lean();
    if (!doc) {
      res.status(404).json({ error: 'No entry for this date' });
      return;
    }
    res.json(serializeEntry(doc as Record<string, unknown>));
  })
);

// POST /api/entries and PUT /api/entries/:date both upsert by date, so saving
// the same date twice updates the existing record instead of duplicating it.
entriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = validateEntry(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid entry data', details: result.errors });
      return;
    }
    const saved = await upsertEntry(DailyEntryModel, result.value);
    res.json(serializeEntry(saved as Record<string, unknown>));
  })
);

entriesRouter.put(
  '/:date',
  asyncHandler(async (req, res) => {
    const result = validateEntry(req.body, req.params.date);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid entry data', details: result.errors });
      return;
    }
    const saved = await upsertEntry(DailyEntryModel, result.value);
    res.json(serializeEntry(saved as Record<string, unknown>));
  })
);

// PATCH /api/entries/:date — updates only the provided fields, so a page can
// save its own slice of the day without clobbering the rest. Day calorie and
// macro totals are re-derived whenever the resulting day has meals.
entriesRouter.patch(
  '/:date',
  asyncHandler(async (req, res) => {
    const { date } = req.params;
    if (!isValidDateStr(date)) {
      res.status(400).json({ error: 'Invalid date' });
      return;
    }
    const result = validateEntryPatch(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid entry data', details: result.errors });
      return;
    }

    const stored = await DailyEntryModel.findOne({ date }).lean();
    const current = stored ? serializeEntry(stored as Record<string, unknown>) : null;
    const merged = applyMealTotals({
      calories: current?.calories ?? null,
      proteinG: current?.proteinG ?? null,
      carbsG: current?.carbsG ?? null,
      fatG: current?.fatG ?? null,
      fiberG: current?.fiberG ?? null,
      meals: current?.meals ?? [],
      ...result.value,
    });

    const saved = await DailyEntryModel.findOneAndUpdate(
      { date },
      { $set: { ...merged, date } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    res.json(serializeEntry(saved as Record<string, unknown>));
  })
);

entriesRouter.delete(
  '/:date',
  asyncHandler(async (req, res) => {
    const { date } = req.params;
    if (!isValidDateStr(date)) {
      res.status(400).json({ error: 'Invalid date' });
      return;
    }
    const deleted = await DailyEntryModel.findOneAndDelete({ date });
    if (!deleted) {
      res.status(404).json({ error: 'No entry for this date' });
      return;
    }
    res.status(204).end();
  })
);
