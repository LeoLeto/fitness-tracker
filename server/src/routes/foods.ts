import { Router } from 'express';
import {
  FoodModel,
  MealTemplateModel,
  serializeFood,
  serializeMealTemplate,
} from '../models/Food';
import { resolveTemplate, withPortions } from '../services/foodLibrary';
import { Food } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { validateFood, validateMealTemplate } from '../utils/foodValidation';

export const foodsRouter = Router();

async function loadFoods(includeArchived = false): Promise<Food[]> {
  const filter = includeArchived ? {} : { archived: { $ne: true } };
  const docs = await FoodModel.find(filter).sort({ name: 1 }).lean();
  return docs.map((d) => serializeFood(d as Record<string, unknown>));
}

// ── Meal templates ─────────────────────────────────────────────────────────────
// Declared before /:id so "templates" isn't parsed as a food id.

// GET /api/foods/templates — templates with nutrition resolved from the library
foodsRouter.get(
  '/templates',
  asyncHandler(async (req, res) => {
    const includeArchived = req.query.includeArchived === '1';
    const filter = includeArchived ? {} : { archived: { $ne: true } };
    const [docs, foods] = await Promise.all([
      MealTemplateModel.find(filter).sort({ orderIndex: 1 }).lean(),
      loadFoods(true), // resolve against every food, archived or not
    ]);
    const templates = docs.map((d) =>
      resolveTemplate(serializeMealTemplate(d as Record<string, unknown>), foods)
    );
    res.json(templates);
  })
);

foodsRouter.post(
  '/templates',
  asyncHandler(async (req, res) => {
    const result = validateMealTemplate(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid meal template', details: result.errors });
      return;
    }
    if (req.body?.orderIndex === undefined) {
      const last = await MealTemplateModel.findOne().sort({ orderIndex: -1 }).lean();
      result.value.orderIndex = last ? ((last.orderIndex ?? 0) as number) + 1 : 0;
    }
    const created = await MealTemplateModel.create(result.value);
    const foods = await loadFoods(true);
    res.json(
      resolveTemplate(
        serializeMealTemplate(created.toObject() as Record<string, unknown>),
        foods
      )
    );
  })
);

foodsRouter.put(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const result = validateMealTemplate(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid meal template', details: result.errors });
      return;
    }
    const updated = await MealTemplateModel.findByIdAndUpdate(
      req.params.id,
      { $set: result.value },
      { new: true }
    )
      .lean()
      .catch(() => null);
    if (!updated) {
      res.status(404).json({ error: 'Meal template not found' });
      return;
    }
    const foods = await loadFoods(true);
    res.json(
      resolveTemplate(serializeMealTemplate(updated as Record<string, unknown>), foods)
    );
  })
);

foodsRouter.delete(
  '/templates/:id',
  asyncHandler(async (req, res) => {
    const deleted = await MealTemplateModel.findByIdAndDelete(req.params.id).catch(() => null);
    if (!deleted) {
      res.status(404).json({ error: 'Meal template not found' });
      return;
    }
    res.status(204).end();
  })
);

// ── Foods ──────────────────────────────────────────────────────────────────────

// GET /api/foods — each food with its one-tap portions already scaled
foodsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const foods = await loadFoods(req.query.includeArchived === '1');
    res.json(foods.map(withPortions));
  })
);

foodsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const result = validateFood(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid food', details: result.errors });
      return;
    }
    const existing = await FoodModel.findOne({ name: result.value.name }).lean();
    if (existing) {
      res.status(409).json({ error: 'A food with that name already exists' });
      return;
    }
    const created = await FoodModel.create(result.value);
    res.json(withPortions(serializeFood(created.toObject() as Record<string, unknown>)));
  })
);

foodsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = validateFood(req.body);
    if (!result.ok) {
      res.status(400).json({ error: 'Invalid food', details: result.errors });
      return;
    }
    const updated = await FoodModel.findByIdAndUpdate(
      req.params.id,
      { $set: result.value },
      { new: true }
    )
      .lean()
      .catch(() => null);
    if (!updated) {
      res.status(404).json({ error: 'Food not found' });
      return;
    }
    res.json(withPortions(serializeFood(updated as Record<string, unknown>)));
  })
);

foodsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    // Templates reference foods by id; refuse to leave one dangling.
    const usedBy = await MealTemplateModel.find({ 'items.foodId': id }).lean();
    if (usedBy.length > 0) {
      res.status(409).json({
        error: 'That food is used by a meal template',
        details: usedBy.map((t) => (t as { name?: string }).name ?? 'template'),
      });
      return;
    }
    const deleted = await FoodModel.findByIdAndDelete(id).catch(() => null);
    if (!deleted) {
      res.status(404).json({ error: 'Food not found' });
      return;
    }
    res.status(204).end();
  })
);
