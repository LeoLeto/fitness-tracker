import mongoose, { Schema } from 'mongoose';
import { Food, MealTemplate, MealTemplateItem } from '../types';

type FoodDoc = Omit<Food, 'id'>;

const foodSchema = new Schema<FoodDoc>(
  {
    name: { type: String, required: true },
    unit: { type: String, enum: ['unit', 'g', 'ml'], default: 'g' },
    basisQty: { type: Number, required: true },
    calories: { type: Number, required: true },
    proteinG: { type: Number, default: null },
    carbsG: { type: Number, default: null },
    fatG: { type: Number, default: null },
    fiberG: { type: Number, default: null },
    portions: { type: [Number], default: [] },
    notes: { type: String, default: '' },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'foods' }
);

foodSchema.index({ name: 1 }, { unique: true });

export const FoodModel = mongoose.model<FoodDoc>('Food', foodSchema);

export function serializeFood(doc: Record<string, unknown>): Food {
  return {
    id: String(doc._id),
    name: doc.name as string,
    unit: (doc.unit ?? 'g') as Food['unit'],
    basisQty: doc.basisQty as number,
    calories: doc.calories as number,
    proteinG: (doc.proteinG ?? null) as number | null,
    carbsG: (doc.carbsG ?? null) as number | null,
    fatG: (doc.fatG ?? null) as number | null,
    fiberG: (doc.fiberG ?? null) as number | null,
    portions: ((doc.portions ?? []) as number[]).slice(),
    notes: (doc.notes ?? '') as string,
    archived: (doc.archived ?? false) as boolean,
  };
}

// ── Meal templates ─────────────────────────────────────────────────────────────

type MealTemplateDoc = Omit<MealTemplate, 'id'>;

const templateItemSchema = new Schema<MealTemplateItem>(
  {
    foodId: { type: String, required: true },
    foodName: { type: String, default: '' },
    qty: { type: Number, required: true },
  },
  { _id: false }
);

const mealTemplateSchema = new Schema<MealTemplateDoc>(
  {
    name: { type: String, required: true },
    time: { type: String, default: null },
    items: { type: [templateItemSchema], default: [] },
    orderIndex: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'meal_templates' }
);

mealTemplateSchema.index({ orderIndex: 1 });

export const MealTemplateModel = mongoose.model<MealTemplateDoc>(
  'MealTemplate',
  mealTemplateSchema
);

export function serializeMealTemplate(doc: Record<string, unknown>): MealTemplate {
  const items = (doc.items ?? []) as MealTemplateItem[];
  return {
    id: String(doc._id),
    name: doc.name as string,
    time: (doc.time ?? null) as string | null,
    items: items.map((i) => ({
      foodId: i.foodId,
      foodName: i.foodName ?? '',
      qty: i.qty,
    })),
    orderIndex: (doc.orderIndex ?? 0) as number,
    archived: (doc.archived ?? false) as boolean,
  };
}
