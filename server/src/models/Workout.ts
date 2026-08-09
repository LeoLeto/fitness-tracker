import mongoose, { Schema } from 'mongoose';
import { Workout, WorkoutExercise, WorkoutSet } from '../workouts/types';

type WorkoutDoc = Omit<Workout, 'id'>;

const setSchema = new Schema<WorkoutSet>(
  {
    weightKg: { type: Number, default: null },
    reps: { type: Number, required: true },
    rir: { type: Number, default: null },
    repsUncertain: { type: Boolean, default: false },
    badForm: { type: Boolean, default: false },
    pain: { type: Boolean, default: false },
    isDropSet: { type: Boolean, default: false },
    note: { type: String, default: null },
  },
  { _id: false }
);

const workoutExerciseSchema = new Schema<WorkoutExercise>(
  {
    exerciseId: { type: String, default: null },
    exerciseName: { type: String, required: true },
    order: { type: Number, required: true },
    orderMoved: { type: String, enum: ['up', 'down', null], default: null },
    variation: { type: String, default: null },
    sets: { type: [setSchema], default: [] },
  },
  { _id: false }
);

const workoutSchema = new Schema<WorkoutDoc>(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    type: { type: String, enum: ['strength', 'cardio'], required: true },
    routine: { type: String, default: null, lowercase: true, trim: true },
    cardioType: { type: String, default: null },
    durationMin: { type: Number, default: null },
    notes: { type: String, default: null },
    dateInferred: { type: Boolean, default: false },
    exercises: { type: [workoutExerciseSchema], default: [] },
  },
  { timestamps: true, collection: 'workouts' }
);

// One strength session per routine per day (saving again replaces it);
// cardio sessions are not unique-constrained.
workoutSchema.index(
  { date: 1, routine: 1 },
  { unique: true, partialFilterExpression: { type: 'strength' } }
);
workoutSchema.index({ date: 1 });

export const WorkoutModel = mongoose.model<WorkoutDoc>('Workout', workoutSchema);

export function serializeWorkout(doc: Record<string, unknown>): Workout {
  const exercises = (doc.exercises ?? []) as WorkoutExercise[];
  return {
    id: String(doc._id),
    date: doc.date as string,
    type: doc.type as Workout['type'],
    routine: (doc.routine ?? null) as string | null,
    cardioType: (doc.cardioType ?? null) as string | null,
    durationMin: (doc.durationMin ?? null) as number | null,
    notes: (doc.notes ?? null) as string | null,
    dateInferred: (doc.dateInferred ?? false) as boolean,
    exercises: exercises.map((ex) => ({
      exerciseId: ex.exerciseId ?? null,
      exerciseName: ex.exerciseName,
      order: ex.order,
      orderMoved: ex.orderMoved ?? null,
      variation: ex.variation ?? null,
      sets: (ex.sets ?? []).map((s) => ({
        weightKg: s.weightKg ?? null,
        reps: s.reps,
        rir: s.rir ?? null,
        repsUncertain: s.repsUncertain ?? false,
        badForm: s.badForm ?? false,
        pain: s.pain ?? false,
        isDropSet: s.isDropSet ?? false,
        note: s.note ?? null,
      })),
    })),
  };
}
