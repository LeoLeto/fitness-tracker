import mongoose, { Schema } from 'mongoose';
import { DailyEntry as DailyEntryType, Meal } from '../types';

const mealSchema = new Schema<Meal>(
  {
    label: { type: String, default: '' },
    time: { type: String, default: null },
    calories: { type: Number, required: true },
    proteinG: { type: Number, default: null },
    carbsG: { type: Number, default: null },
    fatG: { type: Number, default: null },
    notes: { type: String, default: null },
  },
  { _id: false }
);

/**
 * One document per calendar date (unique index on `date`).
 * Raw measurements are stored exactly as entered and are never mutated by
 * analytics — averages and trends are always computed on the fly.
 */
const dailyEntrySchema = new Schema<DailyEntryType>(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    weightKg: { type: Number, default: null },
    calories: { type: Number, default: null },
    proteinG: { type: Number, default: null },
    carbsG: { type: Number, default: null },
    fatG: { type: Number, default: null },
    bowelMovement: { type: Boolean, default: null },
    weighedTime: { type: String, default: null },
    beforeFood: { type: Boolean, default: null },
    afterBowelMovement: { type: Boolean, default: null },
    trained: { type: Boolean, default: null },
    trainingType: { type: String, default: null },
    trainingDurationMin: { type: Number, default: null },
    notes: { type: String, default: null },
    meals: { type: [mealSchema], default: [] },
  },
  { timestamps: true, collection: 'daily_entries' }
);

export const DailyEntryModel = mongoose.model<DailyEntryType>('DailyEntry', dailyEntrySchema);

function serializeMeal(raw: Record<string, unknown>): Meal {
  return {
    label: (raw.label ?? '') as string,
    time: (raw.time ?? null) as string | null,
    calories: raw.calories as number,
    proteinG: (raw.proteinG ?? null) as number | null,
    carbsG: (raw.carbsG ?? null) as number | null,
    fatG: (raw.fatG ?? null) as number | null,
    notes: (raw.notes ?? null) as string | null,
  };
}

/** Plain API/export representation — no Mongo internals (_id, __v, timestamps). */
export function serializeEntry(doc: Record<string, unknown>): DailyEntryType {
  return {
    date: doc.date as string,
    weightKg: (doc.weightKg ?? null) as number | null,
    calories: (doc.calories ?? null) as number | null,
    proteinG: (doc.proteinG ?? null) as number | null,
    carbsG: (doc.carbsG ?? null) as number | null,
    fatG: (doc.fatG ?? null) as number | null,
    bowelMovement: (doc.bowelMovement ?? null) as boolean | null,
    weighedTime: (doc.weighedTime ?? null) as string | null,
    beforeFood: (doc.beforeFood ?? null) as boolean | null,
    afterBowelMovement: (doc.afterBowelMovement ?? null) as boolean | null,
    trained: (doc.trained ?? null) as boolean | null,
    trainingType: (doc.trainingType ?? null) as string | null,
    trainingDurationMin: (doc.trainingDurationMin ?? null) as number | null,
    notes: (doc.notes ?? null) as string | null,
    meals: ((doc.meals ?? []) as Record<string, unknown>[]).map(serializeMeal),
  };
}
