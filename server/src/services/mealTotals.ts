import { Meal } from '../types';

export interface MealTotals {
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  /** How many meals contributed to each macro — a macro recorded on only
   *  some meals is an undercount, and the UI says so rather than hiding it. */
  recorded: { protein: number; carbs: number; fat: number; fiber: number };
  mealCount: number;
}

type MacroKey = 'proteinG' | 'carbsG' | 'fatG' | 'fiberG';

function sumMacro(meals: Meal[], key: MacroKey): { total: number | null; count: number } {
  const values = meals.map((m) => m[key]).filter((v): v is number => v != null);
  if (values.length === 0) return { total: null, count: 0 };
  // Guard against float drift from scaled portions (e.g. 3.2 × 3).
  const total = values.reduce((a, b) => a + b, 0);
  return { total: Math.round(total * 100) / 100, count: values.length };
}

/**
 * Rolls a day's meals up into day totals.
 *
 * Calories always sum (every meal has them). Macros sum only over the meals
 * that recorded them; if no meal recorded a macro the day total stays null —
 * missing data is never counted as zero.
 */
export function mealTotals(meals: Meal[]): MealTotals {
  const protein = sumMacro(meals, 'proteinG');
  const carbs = sumMacro(meals, 'carbsG');
  const fat = sumMacro(meals, 'fatG');
  const fiber = sumMacro(meals, 'fiberG');
  return {
    calories: meals.reduce((acc, m) => acc + m.calories, 0),
    proteinG: protein.total,
    carbsG: carbs.total,
    fatG: fat.total,
    fiberG: fiber.total,
    recorded: {
      protein: protein.count,
      carbs: carbs.count,
      fat: fat.count,
      fiber: fiber.count,
    },
    mealCount: meals.length,
  };
}

/**
 * Keeps a day's calorie/macro totals consistent with its meals: with meals
 * present the totals are always derived (so meals are the single source of
 * truth); with no meals the manually entered totals are left untouched.
 */
export function applyMealTotals<T extends {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  meals: Meal[];
}>(entry: T): T {
  if (entry.meals.length === 0) return entry;
  const totals = mealTotals(entry.meals);
  return {
    ...entry,
    calories: totals.calories,
    proteinG: totals.proteinG,
    carbsG: totals.carbsG,
    fatG: totals.fatG,
    fiberG: totals.fiberG,
  };
}
