import mongoose, { Schema } from 'mongoose';
import { Exercise } from '../workouts/types';

type ExerciseDoc = Omit<Exercise, 'id'>;

const exerciseSchema = new Schema<ExerciseDoc>(
  {
    name: { type: String, required: true },
    routine: { type: String, required: true, lowercase: true, trim: true },
    setupNotes: { type: String, default: '' },
    isBodyweight: { type: Boolean, default: false },
    orderIndex: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'exercises' }
);

exerciseSchema.index({ routine: 1, orderIndex: 1 });

export const ExerciseModel = mongoose.model<ExerciseDoc>('Exercise', exerciseSchema);

export function serializeExercise(doc: Record<string, unknown>): Exercise {
  return {
    id: String(doc._id),
    name: doc.name as string,
    routine: doc.routine as string,
    setupNotes: (doc.setupNotes ?? '') as string,
    isBodyweight: (doc.isBodyweight ?? false) as boolean,
    orderIndex: (doc.orderIndex ?? 0) as number,
    archived: (doc.archived ?? false) as boolean,
  };
}
