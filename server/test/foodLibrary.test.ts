import { describe, expect, it } from 'vitest';
import { foodPortion, resolveTemplate, withPortions } from '../src/services/foodLibrary';
import { validateFood, validateMealTemplate } from '../src/utils/foodValidation';
import { Food, MealTemplate } from '../src/types';

function food(name: string, fields: Partial<Food>): Food {
  return {
    id: name,
    name,
    unit: 'g',
    basisQty: 100,
    calories: 100,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
    portions: [],
    notes: '',
    archived: false,
    ...fields,
  };
}

// The library as seeded from the maintenance plan.
const MILK = food('Skimmed milk', {
  unit: 'ml',
  basisQty: 100,
  calories: 31,
  proteinG: 3.2,
  carbsG: 5,
  portions: [200, 300],
});
const EGGS = food('Eggs', {
  unit: 'unit',
  basisQty: 1,
  calories: 70,
  proteinG: 5,
  carbsG: 0.5,
  portions: [3, 4],
});
const TSP = food('TSP (dry)', {
  basisQty: 50,
  calories: 200,
  proteinG: 25,
  carbsG: 18,
  fiberG: 9,
  portions: [50],
});
const CHICKEN = food('Chicken (raw)', {
  basisQty: 100,
  calories: 120,
  proteinG: 20,
  carbsG: 0,
  fiberG: 0,
  portions: [150],
});
const PASTA = food('Pasta (dry)', {
  basisQty: 80,
  calories: 300,
  proteinG: 11,
  carbsG: 59,
  fiberG: 1.6,
  portions: [80],
});
const CARROTS = food('Carrots (raw)', {
  basisQty: 125,
  calories: 50,
  proteinG: 1,
  carbsG: 12,
  fiberG: 4,
  portions: [125],
});
const APPLE = food('Apple', {
  basisQty: 180,
  calories: 90,
  proteinG: 0.5,
  carbsG: 24,
  fiberG: 4,
  portions: [180],
});
const POTATO = food('Potato (raw)', {
  basisQty: 200,
  calories: 154,
  proteinG: 4,
  carbsG: 35,
  fiberG: 4,
  portions: [200],
});
const WHEY = food('Whey protein', {
  basisQty: 30,
  calories: 140,
  proteinG: 20,
  carbsG: 3,
  portions: [30],
});
const CHIA = food('Chia seeds', {
  basisQty: 10,
  calories: 50,
  proteinG: 2,
  carbsG: 2,
  fiberG: 5,
  portions: [10],
});
const BANANA = food('Banana', {
  unit: 'unit',
  basisQty: 1,
  calories: 105,
  proteinG: 1,
  carbsG: 27,
  fiberG: 3,
  portions: [1],
});
const OIL = food('Oil', {
  unit: 'unit',
  basisQty: 1,
  calories: 40,
  proteinG: 0,
  carbsG: 0,
  fatG: 4.5,
  fiberG: 0,
  portions: [1],
});

const LIBRARY = [
  MILK, EGGS, TSP, CHICKEN, PASTA, CARROTS, APPLE, POTATO, WHEY, CHIA, BANANA, OIL,
];

function template(name: string, items: [Food, number][]): MealTemplate {
  return {
    id: name,
    name,
    time: null,
    items: items.map(([f, qty]) => ({ foodId: f.id, foodName: f.name, qty })),
    orderIndex: 0,
    archived: false,
  };
}

describe('foodPortion — scaling from the stored basis', () => {
  it('scales milk to the plan portions exactly', () => {
    expect(foodPortion(MILK, 200)).toMatchObject({
      calories: 62,
      proteinG: 6.4,
      carbsG: 10,
      label: '200 ml',
    });
    expect(foodPortion(MILK, 300)).toMatchObject({
      calories: 93,
      proteinG: 9.6,
      carbsG: 15,
    });
  });

  it('scales per-unit foods (eggs in batches of 3 and 4)', () => {
    expect(foodPortion(EGGS, 3)).toMatchObject({ calories: 210, proteinG: 15, label: '3' });
    expect(foodPortion(EGGS, 4)).toMatchObject({ calories: 280, proteinG: 20 });
  });

  it('scales a 150 g chicken portion to 180 kcal / 30 g protein', () => {
    expect(foodPortion(CHICKEN, 150)).toMatchObject({ calories: 180, proteinG: 30 });
  });

  it('keeps unrecorded macros null instead of turning them into 0', () => {
    const portion = foodPortion(MILK, 200);
    expect(portion.fatG).toBeNull();
    expect(portion.fiberG).toBeNull();
  });

  it('handles arbitrary quantities, not just the preset portions', () => {
    expect(foodPortion(MILK, 250).calories).toBe(78); // 31 × 2.5 = 77.5 → 78
    expect(foodPortion(EGGS, 1).calories).toBe(70);
  });

  it('attaches a ready-to-log portion per one-tap button', () => {
    const withOptions = withPortions(MILK);
    expect(withOptions.portionOptions.map((p) => p.qty)).toEqual([200, 300]);
    expect(withOptions.portionOptions[1].calories).toBe(93);
  });
});

describe('resolveTemplate — the maintenance plan meals', () => {
  // Each expectation is the total written in the plan itself.
  it('04:15 TSP + Apple + Potato → ~506 kcal / ~36 g protein / ~17 g fiber', () => {
    const resolved = resolveTemplate(
      template('TSP + Apple + Potato', [
        [TSP, 50],
        [MILK, 200],
        [APPLE, 180],
        [POTATO, 200],
      ]),
      LIBRARY
    );
    expect(resolved.calories).toBe(506);
    expect(resolved.proteinG).toBeCloseTo(35.9, 5);
    expect(resolved.carbsG).toBe(87);
    expect(resolved.fiberG).toBe(17);
  });

  it('08:00 Egg Breakfast → ~413 kcal / ~30 g protein', () => {
    const resolved = resolveTemplate(
      template('Egg Breakfast', [
        [EGGS, 4],
        [MILK, 300],
        [OIL, 1],
      ]),
      LIBRARY
    );
    expect(resolved.calories).toBe(413);
    expect(resolved.proteinG).toBe(29.6);
    expect(resolved.carbsG).toBe(17);
  });

  it('12:00 Pre-Workout: Chicken + Pasta → 530 kcal / 42 g protein / 71 g carbs', () => {
    const resolved = resolveTemplate(
      template('Pre-Workout', [
        [CHICKEN, 150],
        [PASTA, 80],
        [CARROTS, 125],
      ]),
      LIBRARY
    );
    expect(resolved.calories).toBe(530);
    expect(resolved.proteinG).toBe(42);
    expect(resolved.carbsG).toBe(71);
    expect(resolved.fiberG).toBe(5.6);
  });

  it('15:00 Post-Workout Recovery → ~283 kcal / ~32 g protein', () => {
    const resolved = resolveTemplate(
      template('Post-Workout Recovery', [
        [WHEY, 30],
        [MILK, 300],
        [CHIA, 10],
      ]),
      LIBRARY
    );
    expect(resolved.calories).toBe(283);
    expect(resolved.proteinG).toBe(31.6);
    expect(resolved.fiberG).toBe(5);
  });

  it('17:30 Chicken + Carrots + Banana → 335 kcal / 32 g protein', () => {
    const resolved = resolveTemplate(
      template('Chicken + Carrots + Banana', [
        [CHICKEN, 150],
        [CARROTS, 125],
        [BANANA, 1],
      ]),
      LIBRARY
    );
    expect(resolved.calories).toBe(335);
    expect(resolved.proteinG).toBe(32);
    expect(resolved.carbsG).toBe(39);
  });

  it('the five meals together land near the plan\'s ~2,000 kcal target', () => {
    const total = 506 + 413 + 530 + 283 + 335;
    expect(total).toBe(2067);
  });

  it('reports items whose food is gone rather than silently losing calories', () => {
    const resolved = resolveTemplate(
      template('Broken', [
        [CHICKEN, 150],
        [food('Deleted thing', { id: 'missing-id', calories: 999 }), 100],
      ]),
      [CHICKEN]
    );
    expect(resolved.calories).toBe(180);
    expect(resolved.missingItems).toEqual(['Deleted thing']);
  });
});

describe('resolveTemplate — the recipe breakdown', () => {
  it('states each quantity with its unit, in item order', () => {
    const resolved = resolveTemplate(
      template('TSP + Apple + Potato', [
        [TSP, 50],
        [MILK, 200],
        [APPLE, 180],
        [POTATO, 200],
      ]),
      LIBRARY
    );
    expect(resolved.parts.map((p) => `${p.qty} ${p.foodName}`)).toEqual([
      '50 g TSP (dry)',
      '200 ml Skimmed milk',
      '180 g Apple',
      '200 g Potato (raw)',
    ]);
    expect(resolved.parts.map((p) => p.calories)).toEqual([200, 62, 90, 154]);
  });

  it('writes counted foods as a bare number and carries the food\'s note', () => {
    const oil = food('Oil', { ...OIL, notes: '1 tsp' });
    const resolved = resolveTemplate(
      template('Egg Breakfast', [
        [EGGS, 4],
        [oil, 1],
      ]),
      [EGGS, oil]
    );
    expect(resolved.parts[0]).toMatchObject({ qty: '4', foodName: 'Eggs', calories: 280 });
    // Without the note, "1 Oil" doesn't say how much oil to use.
    expect(resolved.parts[1]).toMatchObject({ qty: '1', notes: '1 tsp' });
  });

  it('keeps a missing food in the recipe with unknown calories', () => {
    const resolved = resolveTemplate(
      template('Broken', [
        [CHICKEN, 150],
        [food('Deleted thing', { id: 'missing-id', calories: 999 }), 100],
      ]),
      [CHICKEN]
    );
    expect(resolved.parts).toHaveLength(2);
    expect(resolved.parts[1]).toMatchObject({
      foodName: 'Deleted thing',
      qty: '100',
      calories: null,
    });
  });
});

describe('validateFood', () => {
  it('accepts a food and normalises its portions', () => {
    const result = validateFood({
      name: '  Skimmed milk  ',
      unit: 'ml',
      basisQty: 100,
      calories: 31,
      proteinG: 3.2,
      portions: [300, 200, 200],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Skimmed milk');
    expect(result.value.portions).toEqual([200, 300]); // deduped and sorted
    expect(result.value.fatG).toBeNull();
  });

  it('rejects a missing name, bad unit, zero basis or missing calories', () => {
    expect(validateFood({ unit: 'ml', basisQty: 100, calories: 31 }).ok).toBe(false);
    expect(validateFood({ name: 'x', unit: 'cups', basisQty: 1, calories: 1 }).ok).toBe(false);
    expect(validateFood({ name: 'x', unit: 'g', basisQty: 0, calories: 1 }).ok).toBe(false);
    expect(validateFood({ name: 'x', unit: 'g', basisQty: 100 }).ok).toBe(false);
  });
});

describe('validateMealTemplate', () => {
  it('accepts a template with items', () => {
    const result = validateMealTemplate({
      name: 'Egg Breakfast',
      time: '08:00',
      items: [{ foodId: 'abc', foodName: 'Eggs', qty: 4 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.time).toBe('08:00');
  });

  it('rejects a bad time and items without a food or quantity', () => {
    expect(validateMealTemplate({ name: 'x', time: '8:00' }).ok).toBe(false);
    expect(validateMealTemplate({ name: 'x', items: [{ qty: 4 }] }).ok).toBe(false);
    expect(validateMealTemplate({ name: 'x', items: [{ foodId: 'a', qty: 0 }] }).ok).toBe(false);
  });
});
