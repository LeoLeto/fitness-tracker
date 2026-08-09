import mongoose, { Schema } from 'mongoose';
import { Profile as ProfileType } from '../types';

/**
 * Profile settings. Stored in the database (never hard-coded into
 * calculations). The app currently uses a single profile document, but the
 * schema is a normal collection so per-user profiles (with a userId field
 * and authentication) can be added later without a migration.
 */
const profileSchema = new Schema<ProfileType>(
  {
    sex: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    age: { type: Number, default: 30 },
    heightCm: { type: Number, default: 169 },
    goal: { type: String, default: 'Lean bulk' },
    targetWeightChangeKgPerWeek: { type: Number, default: 0.2 },
    trainingDaysPerWeek: { type: Number, default: 4.5 },
    cardio: { type: Boolean, default: false },
    maintenanceCalories: { type: Number, default: null },
    calorieTarget: { type: Number, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true, collection: 'profiles' }
);

export const ProfileModel = mongoose.model<ProfileType>('Profile', profileSchema);

/** Returns the singleton profile, creating it with defaults on first use. */
export async function getOrCreateProfile() {
  const existing = await ProfileModel.findOne();
  if (existing) return existing;
  return ProfileModel.create({});
}

export function serializeProfile(doc: Partial<ProfileType>): ProfileType {
  return {
    sex: doc.sex ?? 'male',
    age: doc.age ?? 30,
    heightCm: doc.heightCm ?? 169,
    goal: doc.goal ?? '',
    targetWeightChangeKgPerWeek: doc.targetWeightChangeKgPerWeek ?? 0.2,
    trainingDaysPerWeek: doc.trainingDaysPerWeek ?? 4.5,
    cardio: doc.cardio ?? false,
    maintenanceCalories: doc.maintenanceCalories ?? null,
    calorieTarget: doc.calorieTarget ?? null,
    notes: doc.notes ?? '',
  };
}
