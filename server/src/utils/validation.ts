import { DailyEntry, EntryData, Profile } from '../types';
import { isValidDateStr } from './dates';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface NumberRule {
  min: number;
  max: number;
  integer?: boolean;
}

/**
 * Parses an optional numeric field. Absent / null / '' → null (not recorded).
 * Returns 'invalid' when present but not a usable number.
 */
function parseOptionalNumber(v: unknown, rule: NumberRule): number | null | 'invalid' {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return 'invalid';
  if (rule.integer && !Number.isInteger(n)) return 'invalid';
  if (n < rule.min || n > rule.max) return 'invalid';
  return n;
}

function parseOptionalBool(v: unknown): boolean | null | 'invalid' {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  return 'invalid';
}

function parseOptionalString(v: unknown, maxLen: number): string | null | 'invalid' {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return 'invalid';
  const trimmed = v.trim();
  if (trimmed === '') return null;
  if (trimmed.length > maxLen) return 'invalid';
  return trimmed;
}

/**
 * Validates a daily entry body. Every optional field that is missing or empty
 * is normalised to `null`; a save fully replaces the stored data for that date.
 * A date-only entry is allowed (e.g. a weight-only or notes-only day).
 */
export function validateEntry(body: unknown, dateOverride?: string): ValidationResult<DailyEntry> {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const date = dateOverride ?? b.date;
  if (!isValidDateStr(date)) {
    errors.push('date must be a valid ISO date (YYYY-MM-DD)');
  }

  const fields: { [K in keyof EntryData]: EntryData[K] | 'invalid' } = {
    weightKg: parseOptionalNumber(b.weightKg, { min: 20, max: 400 }),
    calories: parseOptionalNumber(b.calories, { min: 0, max: 20000, integer: true }),
    proteinG: parseOptionalNumber(b.proteinG, { min: 0, max: 2000 }),
    carbsG: parseOptionalNumber(b.carbsG, { min: 0, max: 3000 }),
    fatG: parseOptionalNumber(b.fatG, { min: 0, max: 1500 }),
    bowelMovement: parseOptionalBool(b.bowelMovement),
    weighedTime: parseOptionalString(b.weighedTime, 5),
    beforeFood: parseOptionalBool(b.beforeFood),
    afterBowelMovement: parseOptionalBool(b.afterBowelMovement),
    trained: parseOptionalBool(b.trained),
    trainingType: parseOptionalString(b.trainingType, 100),
    trainingDurationMin: parseOptionalNumber(b.trainingDurationMin, {
      min: 0,
      max: 1440,
      integer: true,
    }),
    notes: parseOptionalString(b.notes, 2000),
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value === 'invalid') errors.push(`${key} is invalid`);
  }
  if (fields.weighedTime !== null && fields.weighedTime !== 'invalid' && !TIME_RE.test(fields.weighedTime)) {
    errors.push('weighedTime must be HH:MM (24h)');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { date: date as string, ...(fields as EntryData) } };
}

/** Validates a partial profile update; only provided keys are validated and applied. */
export function validateProfilePatch(body: unknown): ValidationResult<Partial<Profile>> {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  const patch: Partial<Profile> = {};

  if ('sex' in b) {
    if (b.sex === 'male' || b.sex === 'female' || b.sex === 'other') patch.sex = b.sex;
    else errors.push('sex must be "male", "female" or "other"');
  }
  if ('age' in b) {
    const v = parseOptionalNumber(b.age, { min: 10, max: 120, integer: true });
    if (v === 'invalid' || v === null) errors.push('age is invalid');
    else patch.age = v;
  }
  if ('heightCm' in b) {
    const v = parseOptionalNumber(b.heightCm, { min: 100, max: 250 });
    if (v === 'invalid' || v === null) errors.push('heightCm is invalid');
    else patch.heightCm = v;
  }
  if ('goal' in b) {
    const v = parseOptionalString(b.goal, 200);
    if (v === 'invalid') errors.push('goal is invalid');
    else patch.goal = v ?? '';
  }
  if ('targetWeightChangeKgPerWeek' in b) {
    const v = parseOptionalNumber(b.targetWeightChangeKgPerWeek, { min: -2, max: 2 });
    if (v === 'invalid' || v === null) errors.push('targetWeightChangeKgPerWeek is invalid');
    else patch.targetWeightChangeKgPerWeek = v;
  }
  if ('trainingDaysPerWeek' in b) {
    const v = parseOptionalNumber(b.trainingDaysPerWeek, { min: 0, max: 7 });
    if (v === 'invalid' || v === null) errors.push('trainingDaysPerWeek is invalid');
    else patch.trainingDaysPerWeek = v;
  }
  if ('cardio' in b) {
    const v = parseOptionalBool(b.cardio);
    if (v === 'invalid' || v === null) errors.push('cardio must be true or false');
    else patch.cardio = v;
  }
  if ('maintenanceCalories' in b) {
    const v = parseOptionalNumber(b.maintenanceCalories, { min: 500, max: 10000, integer: true });
    if (v === 'invalid') errors.push('maintenanceCalories is invalid');
    else patch.maintenanceCalories = v;
  }
  if ('calorieTarget' in b) {
    const v = parseOptionalNumber(b.calorieTarget, { min: 500, max: 10000, integer: true });
    if (v === 'invalid') errors.push('calorieTarget is invalid');
    else patch.calorieTarget = v;
  }
  if ('notes' in b) {
    const v = parseOptionalString(b.notes, 2000);
    if (v === 'invalid') errors.push('notes is invalid');
    else patch.notes = v ?? '';
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: patch };
}
