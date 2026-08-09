import { Router } from 'express';
import { ExerciseModel, serializeExercise } from '../models/Exercise';
import { asyncHandler } from '../utils/asyncHandler';
import { validateExercise } from '../workouts/validation';

export const exercisesRouter = Router();

// GET /api/exercises?routine=push&includeArchived=1
exercisesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.routine === 'string' && req.query.routine !== '') {
      filter.routine = req.query.routine.toLowerCase();
    }
    if (req.query.includeArchived !== '1') filter.archived = { $ne: true };
    const docs = await ExerciseModel.find(filter).sort({ routine: 1, orderIndex: 1 }).lean();
    res.json(docs.map((d) => serializeExercise(d as Record<string, unknown>)));
  })
);

exercisesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = validateExercise(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid exercise', details: result.errors });
      return;
    }
    // Default to the end of the routine's list.
    if (req.body?.orderIndex === undefined) {
      const last = await ExerciseModel.findOne({ routine: result.value.routine })
        .sort({ orderIndex: -1 })
        .lean();
      result.value.orderIndex = last ? ((last.orderIndex ?? 0) as number) + 1 : 0;
    }
    const created = await ExerciseModel.create(result.value);
    res.json(serializeExercise(created.toObject() as Record<string, unknown>));
  })
);

exercisesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = validateExercise(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid exercise', details: result.errors });
      return;
    }
    const updated = await ExerciseModel.findByIdAndUpdate(
      req.params.id,
      { $set: result.value },
      { new: true }
    ).lean();
    if (!updated) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }
    res.json(serializeExercise(updated as Record<string, unknown>));
  })
);

exercisesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const deleted = await ExerciseModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }
    // Workout history keeps the denormalised exerciseName, so nothing breaks.
    res.status(204).end();
  })
);
