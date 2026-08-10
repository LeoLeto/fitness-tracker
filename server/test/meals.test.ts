import { describe, expect, it } from 'vitest';
import { applyMealTotals, mealTotals } from '../src/services/mealTotals';
import { buildMealsCsv } from '../src/services/exportService';
import { DailyEntry, Meal } from '../src/types';
import { validateEntry, validateEntryPatch } from '../src/utils/validation';

function meal(calories: number, extra: Partial<Meal> = {}): Meal {
  return {
    label: '',
    time: null,
    calories,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
    notes: null,
    ...extra,
  };
}

function entry(date: string, fields: Partial<DailyEntry> = {}): DailyEntry {
  return {
    date,
    weightKg: null,
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
    bowelMovement: null,
    weighedTime: null,
    beforeFood: null,
    afterBowelMovement: null,
    trained: null,
    trainingType: null,
    trainingDurationMin: null,
    notes: null,
    meals: [],
    ...fields,
  };
}

describe('mealTotals', () => {
  it('accumulates calories across meals', () => {
    const totals = mealTotals([meal(520), meal(760), meal(735)]);
    expect(totals.calories).toBe(2015);
    expect(totals.mealCount).toBe(3);
  });

  it('sums macros only over the meals that recorded them, and reports the count', () => {
    const totals = mealTotals([
      meal(500, { proteinG: 40, carbsG: 50 }),
      meal(700, { proteinG: 30 }), // carbs not recorded
      meal(800, {}), // nothing recorded
    ]);
    expect(totals.proteinG).toBe(70);
    expect(totals.recorded.protein).toBe(2);
    expect(totals.carbsG).toBe(50);
    expect(totals.recorded.carbs).toBe(1);
    // No meal recorded fat → stays missing rather than becoming 0.
    expect(totals.fatG).toBeNull();
    expect(totals.recorded.fat).toBe(0);
  });

  it('returns null macros and zero calories for no meals', () => {
    const totals = mealTotals([]);
    expect(totals.calories).toBe(0);
    expect(totals.proteinG).toBeNull();
    expect(totals.mealCount).toBe(0);
  });
});

describe('applyMealTotals', () => {
  it('derives the day totals from meals, overriding stale values', () => {
    const result = applyMealTotals(
      entry('2026-08-10', {
        calories: 9999, // stale manual total
        meals: [meal(500, { proteinG: 40 }), meal(700, { proteinG: 35 })],
      })
    );
    expect(result.calories).toBe(1200);
    expect(result.proteinG).toBe(75);
  });

  it('leaves manually entered totals alone when there are no meals', () => {
    const result = applyMealTotals(entry('2026-08-10', { calories: 2015, proteinG: 145 }));
    expect(result.calories).toBe(2015);
    expect(result.proteinG).toBe(145);
  });
});

describe('validateEntry with meals', () => {
  it('accepts meals and derives the day total', () => {
    const result = validateEntry({
      date: '2026-08-10',
      meals: [
        { label: 'Breakfast', time: '08:30', calories: 620, proteinG: 45 },
        { label: 'Lunch', calories: 810, proteinG: 50 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.meals).toHaveLength(2);
    expect(result.value.calories).toBe(1430);
    expect(result.value.proteinG).toBe(95);
    expect(result.value.meals[0].label).toBe('Breakfast');
    expect(result.value.meals[1].time).toBeNull();
  });

  it('rejects a meal without calories', () => {
    const result = validateEntry({
      date: '2026-08-10',
      meals: [{ label: 'Snack', proteinG: 20 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('calories are required'))).toBe(true);
  });

  it('rejects an invalid meal time', () => {
    const result = validateEntry({
      date: '2026-08-10',
      meals: [{ calories: 400, time: '25:99' }],
    });
    expect(result.ok).toBe(false);
  });
});

describe('validateEntryPatch', () => {
  it('only includes the keys that were provided', () => {
    const result = validateEntryPatch({ weightKg: 63.7, weighedTime: '07:42' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value).sort()).toEqual(['weighedTime', 'weightKg']);
    expect(result.value.weightKg).toBe(63.7);
  });

  it('distinguishes "clear this field" (null) from "leave it alone" (absent)', () => {
    const cleared = validateEntryPatch({ weightKg: null });
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect('weightKg' in cleared.value).toBe(true);
    expect(cleared.value.weightKg).toBeNull();

    const untouched = validateEntryPatch({ notes: 'salty food' });
    expect(untouched.ok).toBe(true);
    if (!untouched.ok) return;
    expect('weightKg' in untouched.value).toBe(false);
  });

  it('validates meals in a patch', () => {
    const good = validateEntryPatch({ meals: [{ calories: 500 }] });
    expect(good.ok).toBe(true);
    const bad = validateEntryPatch({ meals: [{ calories: -5 }] });
    expect(bad.ok).toBe(false);
  });

  it('rejects invalid values', () => {
    expect(validateEntryPatch({ weightKg: 'heavy' }).ok).toBe(false);
    expect(validateEntryPatch({ weighedTime: '7:42' }).ok).toBe(false);
  });
});

describe('meals CSV export', () => {
  it('writes one row per meal with ISO dates', () => {
    const csv = buildMealsCsv([
      entry('2026-08-10', {
        meals: [
          meal(620, { label: 'Breakfast', time: '08:30', proteinG: 45 }),
          meal(810, { label: 'Lunch, big', notes: 'restaurant' }),
        ],
      }),
      entry('2026-08-11', { calories: 2100 }), // logged as a day total → no rows
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(
      'date,meal_number,label,time,calories,protein_g,carbs_g,fat_g,fiber_g,notes'
    );
    expect(lines[1]).toBe('2026-08-10,1,Breakfast,08:30,620,45,,,,');
    // Commas inside a label are quoted, not column-splitting.
    expect(lines[2]).toBe('2026-08-10,2,"Lunch, big",,810,,,,,restaurant');
    expect(lines).toHaveLength(3);
  });
});
