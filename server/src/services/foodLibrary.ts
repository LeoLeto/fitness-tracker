import {
  Food,
  FoodPortion,
  FoodUnit,
  FoodWithPortions,
  MealTemplate,
  ResolvedMealTemplate,
  TemplatePart,
} from '../types';

/**
 * Portion maths for the food library.
 *
 * A food stores its nutrition per `basisQty` units (per 100 ml of milk, per
 * 1 egg, per 50 g of TSP…). Scaling to an arbitrary quantity is a plain ratio;
 * calories round to whole numbers and macros to one decimal, because a portion
 * is an estimate and false precision would be noise.
 */

const roundKcal = (v: number) => Math.round(v);
const roundMacro = (v: number) => Math.round(v * 10) / 10;

function scale(value: number | null, factor: number): number | null {
  return value == null ? null : roundMacro(value * factor);
}

export function formatQty(qty: number, unit: FoodUnit): string {
  if (unit === 'unit') return String(qty);
  return `${qty} ${unit}`;
}

/** Scales one food to `qty` of its unit. */
export function foodPortion(food: Food, qty: number): FoodPortion {
  const factor = food.basisQty === 0 ? 0 : qty / food.basisQty;
  return {
    qty,
    label: formatQty(qty, food.unit),
    calories: roundKcal(food.calories * factor),
    proteinG: scale(food.proteinG, factor),
    carbsG: scale(food.carbsG, factor),
    fatG: scale(food.fatG, factor),
    fiberG: scale(food.fiberG, factor),
  };
}

/** Attaches a ready-to-log portion for each of the food's one-tap buttons. */
export function withPortions(food: Food): FoodWithPortions {
  return { ...food, portionOptions: food.portions.map((qty) => foodPortion(food, qty)) };
}

/**
 * Sums a template's items using the current library, so editing a food's
 * nutrition updates every template that uses it. Items whose food is missing
 * are reported instead of silently dropping calories.
 *
 * Also returns the recipe as `parts`: the quantity of each food with its unit,
 * which is what you need in front of you while preparing the meal. A missing
 * food still gets a part (with unknown calories) so the recipe stays complete.
 */
export function resolveTemplate(
  template: MealTemplate,
  foods: Food[]
): ResolvedMealTemplate {
  const byId = new Map(foods.map((f) => [f.id, f]));

  let calories = 0;
  const macroTotals: Record<'proteinG' | 'carbsG' | 'fatG' | 'fiberG', number | null> = {
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
  };
  const parts: TemplatePart[] = [];
  const missingItems: string[] = [];

  for (const item of template.items) {
    const food = byId.get(item.foodId);
    if (!food) {
      missingItems.push(item.foodName);
      // No unit to format with — the bare quantity is all that's left.
      parts.push({
        foodName: item.foodName,
        qty: String(item.qty),
        calories: null,
        notes: '',
      });
      continue;
    }
    const portion = foodPortion(food, item.qty);
    parts.push({
      foodName: food.name,
      qty: portion.label,
      calories: portion.calories,
      notes: food.notes,
    });
    calories += portion.calories;
    for (const key of ['proteinG', 'carbsG', 'fatG', 'fiberG'] as const) {
      const value = portion[key];
      if (value == null) continue;
      macroTotals[key] = (macroTotals[key] ?? 0) + value;
    }
  }

  return {
    ...template,
    calories,
    proteinG: macroTotals.proteinG != null ? roundMacro(macroTotals.proteinG) : null,
    carbsG: macroTotals.carbsG != null ? roundMacro(macroTotals.carbsG) : null,
    fatG: macroTotals.fatG != null ? roundMacro(macroTotals.fatG) : null,
    fiberG: macroTotals.fiberG != null ? roundMacro(macroTotals.fiberG) : null,
    parts,
    missingItems,
  };
}
