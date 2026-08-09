import { Router } from 'express';
import { serializeWorkout, WorkoutModel } from '../models/Workout';
import { asyncHandler } from '../utils/asyncHandler';
import { parseRangeQuery, rangeFilter } from '../utils/rangeQuery';
import { parseSessionLine } from '../workouts/notation';
import { validateWorkout } from '../workouts/validation';

export const workoutsRouter = Router();

// GET /api/workouts?from&to&routine&type
workoutsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { ...rangeFilter(parseRangeQuery(req)) };
    if (typeof req.query.routine === 'string' && req.query.routine !== '') {
      filter.routine = req.query.routine.toLowerCase();
    }
    if (req.query.type === 'strength' || req.query.type === 'cardio') {
      filter.type = req.query.type;
    }
    const docs = await WorkoutModel.find(filter).sort({ date: 1 }).lean();
    res.json(docs.map((d) => serializeWorkout(d as Record<string, unknown>)));
  })
);

// GET /api/workouts/last?routine=push — latest strength session for prefill
workoutsRouter.get(
  '/last',
  asyncHandler(async (req, res) => {
    const routine = typeof req.query.routine === 'string' ? req.query.routine.toLowerCase() : '';
    if (!routine) {
      res.status(400).json({ error: 'routine query param is required' });
      return;
    }
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const filter: Record<string, unknown> = { type: 'strength', routine };
    if (before) filter.date = { $lt: before };
    const doc = await WorkoutModel.findOne(filter).sort({ date: -1 }).lean();
    if (!doc) {
      res.status(404).json({ error: 'No previous workout for this routine' });
      return;
    }
    res.json(serializeWorkout(doc as Record<string, unknown>));
  })
);

// POST /api/workouts/parse { text, isBodyweight? } — preview quick-text entry
workoutsRouter.post('/parse', (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (text.length > 500) {
    res.status(400).json({ error: 'text too long' });
    return;
  }
  res.json(parseSessionLine(text, { isBodyweight: req.body?.isBodyweight === true }));
});

// POST /api/workouts — strength sessions upsert by (date, routine); cardio inserts.
workoutsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = validateWorkout(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid workout', details: result.errors });
      return;
    }
    const w = result.value;
    if (w.type === 'strength') {
      const saved = await WorkoutModel.findOneAndUpdate(
        { date: w.date, routine: w.routine, type: 'strength' },
        { $set: w },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
      res.json(serializeWorkout(saved as Record<string, unknown>));
    } else {
      const created = await WorkoutModel.create(w);
      res.json(serializeWorkout(created.toObject() as Record<string, unknown>));
    }
  })
);

workoutsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await WorkoutModel.findById(req.params.id).lean().catch(() => null);
    if (!doc) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.json(serializeWorkout(doc as Record<string, unknown>));
  })
);

workoutsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = validateWorkout(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid workout', details: result.errors });
      return;
    }
    const updated = await WorkoutModel.findByIdAndUpdate(
      req.params.id,
      { $set: result.value },
      { new: true }
    )
      .lean()
      .catch(() => null);
    if (!updated) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.json(serializeWorkout(updated as Record<string, unknown>));
  })
);

workoutsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const deleted = await WorkoutModel.findByIdAndDelete(req.params.id).catch(() => null);
    if (!deleted) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    res.status(204).end();
  })
);
