import { DailyEntry, EntryData, Meal, Profile } from '../types';
import { applyMealTotals } from '../services/mealTotals';
import { isValidDateStr } from './dates';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_MEALS_PER_DAY = 30;

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
 * Validates a `meals` array. Calories are required per meal; macros are
 * optional and absent means not recorded.
 */
function validateMeals(raw: unknown, errors: string[]): Meal[] {
  if (!Array.isArray(raw)) {
    errors.push('meals must be an array');
    return [];
  }
  if (raw.length > MAX_MEALS_PER_DAY) {
    errors.push(`too many meals (max ${MAX_MEALS_PER_DAY})`);
    return [];
  }

  const meals: Meal[] = [];
  raw.forEach((rawMeal, i) => {
    const m = (rawMeal ?? {}) as Record<string, unknown>;
    const label = `meal ${i + 1}`;

    const calories = parseOptionalNumber(m.calories, { min: 0, max: 20000, integer: true });
    if (calories === 'invalid' || calories === null) {
      errors.push(`${label}: calories are required`);
      return;
    }
    const fields = {
      proteinG: parseOptionalNumber(m.proteinG, { min: 0, max: 2000 }),
      carbsG: parseOptionalNumber(m.carbsG, { min: 0, max: 3000 }),
      fatG: parseOptionalNumber(m.fatG, { min: 0, max: 1500 }),
      fiberG: parseOptionalNumber(m.fiberG, { min: 0, max: 500 }),
      labelText: parseOptionalString(m.label, 60),
      time: parseOptionalString(m.time, 5),
      notes: parseOptionalString(m.notes, 300),
    };
    for (const [key, value] of Object.entries(fields)) {
      if (value === 'invalid') errors.push(`${label}: ${key} is invalid`);
    }
    if (fields.time !== null && fields.time !== 'invalid' && !TIME_RE.test(fields.time)) {
      errors.push(`${label}: time must be HH:MM (24h)`);
      return;
    }
    if (Object.values(fields).includes('invalid')) return;

    meals.push({
      label: (fields.labelText as string | null) ?? '',
      time: fields.time as string | null,
      calories,
      proteinG: fields.proteinG as number | null,
      carbsG: fields.carbsG as number | null,
      fatG: fields.fatG as number | null,
      fiberG: fields.fiberG as number | null,
      notes: fields.notes as string | null,
    });
  });
  return meals;
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

  // Everything except `meals`, which is validated separately below.
  type ScalarEntryData = Omit<EntryData, 'meals'>;
  const fields: { [K in keyof ScalarEntryData]: ScalarEntryData[K] | 'invalid' } = {
    weightKg: parseOptionalNumber(b.weightKg, { min: 20, max: 400 }),
    calories: parseOptionalNumber(b.calories, { min: 0, max: 20000, integer: true }),
    proteinG: parseOptionalNumber(b.proteinG, { min: 0, max: 2000 }),
    carbsG: parseOptionalNumber(b.carbsG, { min: 0, max: 3000 }),
    fatG: parseOptionalNumber(b.fatG, { min: 0, max: 1500 }),
    fiberG: parseOptionalNumber(b.fiberG, { min: 0, max: 500 }),
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

  const meals = 'meals' in b ? validateMeals(b.meals, errors) : [];

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: applyMealTotals({
      date: date as string,
      ...(fields as ScalarEntryData),
      meals,
    }),
  };
}

/**
 * Validates a partial daily-entry update: only the keys present in the body
 * are validated and applied. This lets the Weigh and Food pages each save
 * their own slice of a day without overwriting the other's fields.
 */
export function validateEntryPatch(body: unknown): ValidationResult<Partial<EntryData>> {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;
  const patch: Partial<EntryData> = {};

  const numberRules: Record<string, NumberRule> = {
    weightKg: { min: 20, max: 400 },
    calories: { min: 0, max: 20000, integer: true },
    proteinG: { min: 0, max: 2000 },
    carbsG: { min: 0, max: 3000 },
    fatG: { min: 0, max: 1500 },
    fiberG: { min: 0, max: 500 },
    trainingDurationMin: { min: 0, max: 1440, integer: true },
  };
  for (const [key, rule] of Object.entries(numberRules)) {
    if (!(key in b)) continue;
    const v = parseOptionalNumber(b[key], rule);
    if (v === 'invalid') errors.push(`${key} is invalid`);
    else (patch as Record<string, unknown>)[key] = v;
  }

  for (const key of ['bowelMovement', 'beforeFood', 'afterBowelMovement', 'trained']) {
    if (!(key in b)) continue;
    const v = parseOptionalBool(b[key]);
    if (v === 'invalid') errors.push(`${key} is invalid`);
    else (patch as Record<string, unknown>)[key] = v;
  }

  const stringRules: Record<string, number> = {
    weighedTime: 5,
    trainingType: 100,
    notes: 2000,
  };
  for (const [key, maxLen] of Object.entries(stringRules)) {
    if (!(key in b)) continue;
    const v = parseOptionalString(b[key], maxLen);
    if (v === 'invalid') errors.push(`${key} is invalid`);
    else (patch as Record<string, unknown>)[key] = v;
  }
  if (patch.weighedTime != null && !TIME_RE.test(patch.weighedTime)) {
    errors.push('weighedTime must be HH:MM (24h)');
  }

  if ('meals' in b) patch.meals = validateMeals(b.meals, errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: patch };
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
