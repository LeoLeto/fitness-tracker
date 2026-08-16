import { Food, FOOD_CATEGORIES, FoodCategory, MealTemplate, MealTemplateItem } from '../types';
import { ValidationResult } from './validation';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_PORTIONS = 8;
const MAX_TEMPLATE_ITEMS = 20;

function num(
  v: unknown,
  min: number,
  max: number
): number | null | 'invalid' {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return 'invalid';
  return n;
}

function str(v: unknown, maxLen: number): string | null | 'invalid' {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return 'invalid';
  const t = v.trim();
  if (t === '') return null;
  return t.length <= maxLen ? t : 'invalid';
}

export function validateFood(body: unknown): ValidationResult<Omit<Food, 'id'>> {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const name = str(b.name, 80);
  if (name === null || name === 'invalid') errors.push('name is required (≤80 chars)');

  const unit = b.unit === 'unit' || b.unit === 'g' || b.unit === 'ml' ? b.unit : null;
  if (!unit) errors.push('unit must be "unit", "g" or "ml"');

  // Absent means "not categorised", not an error — most foods are staples.
  const category = FOOD_CATEGORIES.includes(b.category as FoodCategory)
    ? (b.category as FoodCategory)
    : 'other';

  const basisQty = num(b.basisQty, 0.01, 10000);
  if (basisQty === null || basisQty === 'invalid') {
    errors.push('basisQty must be greater than 0');
  }

  const calories = num(b.calories, 0, 20000);
  if (calories === null || calories === 'invalid') errors.push('calories are required');

  const macros = {
    proteinG: num(b.proteinG, 0, 2000),
    carbsG: num(b.carbsG, 0, 3000),
    fatG: num(b.fatG, 0, 1500),
    fiberG: num(b.fiberG, 0, 500),
  };
  for (const [key, value] of Object.entries(macros)) {
    if (value === 'invalid') errors.push(`${key} is invalid`);
  }

  const rawPortions = Array.isArray(b.portions) ? b.portions : [];
  if (rawPortions.length > MAX_PORTIONS) errors.push(`at most ${MAX_PORTIONS} portions`);
  const portions: number[] = [];
  for (const raw of rawPortions) {
    const qty = num(raw, 0.01, 10000);
    if (qty === null || qty === 'invalid') {
      errors.push('portions must all be numbers greater than 0');
      break;
    }
    portions.push(qty);
  }

  const notes = str(b.notes, 300);
  if (notes === 'invalid') errors.push('notes is too long');

  const unitLabel = str(b.unitLabel, 20);
  if (unitLabel === 'invalid') errors.push('unitLabel is too long');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: name as string,
      unit: unit as Food['unit'],
      category,
      unitLabel: (unitLabel === 'invalid' ? null : unitLabel) ?? '',
      basisQty: basisQty as number,
      calories: calories as number,
      proteinG: macros.proteinG as number | null,
      carbsG: macros.carbsG as number | null,
      fatG: macros.fatG as number | null,
      fiberG: macros.fiberG as number | null,
      portions: [...new Set(portions)].sort((a, z) => a - z),
      notes: (notes as string | null) ?? '',
      archived: b.archived === true,
    },
  };
}

export function validateMealTemplate(
  body: unknown
): ValidationResult<Omit<MealTemplate, 'id'>> {
  const errors: string[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const name = str(b.name, 80);
  if (name === null || name === 'invalid') errors.push('name is required (≤80 chars)');

  const time = str(b.time, 5);
  if (time === 'invalid') errors.push('time is invalid');
  if (time !== null && time !== 'invalid' && !TIME_RE.test(time)) {
    errors.push('time must be HH:MM (24h)');
  }

  const orderIndex = num(b.orderIndex, 0, 1000);
  if (orderIndex === 'invalid') errors.push('orderIndex is invalid');

  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (rawItems.length > MAX_TEMPLATE_ITEMS) {
    errors.push(`at most ${MAX_TEMPLATE_ITEMS} items`);
  }
  const items: MealTemplateItem[] = [];
  rawItems.forEach((rawItem, i) => {
    const item = (rawItem ?? {}) as Record<string, unknown>;
    const foodId = str(item.foodId, 64);
    const qty = num(item.qty, 0.01, 10000);
    if (foodId === null || foodId === 'invalid') {
      errors.push(`item ${i + 1}: foodId is required`);
      return;
    }
    if (qty === null || qty === 'invalid') {
      errors.push(`item ${i + 1}: qty must be greater than 0`);
      return;
    }
    const foodName = str(item.foodName, 80);
    items.push({
      foodId,
      foodName: (foodName === 'invalid' ? null : foodName) ?? '',
      qty,
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: name as string,
      time: (time as string | null) ?? null,
      items,
      orderIndex: (orderIndex as number | null) ?? 0,
      archived: b.archived === true,
    },
  };
}
