import { describe, expect, it } from 'vitest';
import { buildChatGptPrompt, buildCsv, buildMarkdown } from '../src/services/exportService';
import { DailyEntry, Profile } from '../src/types';

function entry(date: string, fields: Partial<DailyEntry>): DailyEntry {
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

const entries = [
  entry('2026-08-03', {
    weightKg: 63.7,
    calories: 2140,
    proteinG: 145,
    carbsG: 250,
    fatG: 65,
    bowelMovement: true,
    trained: true,
    notes: 'Normal day',
  }),
  entry('2026-08-04', { weightKg: 63.9, calories: 2210 }),
  entry('2026-08-05', {}), // empty day: everything blank, never zero
];

describe('CSV export', () => {
  it('has the documented columns, ISO dates and consistent decimals', () => {
    const csv = buildCsv(entries);
    const lines = csv.trim().split('\r\n');
    const header =
      'date,weight_kg,calories,protein_g,carbs_g,fat_g,fiber_g,bowel_movement,weighed_time,' +
      'before_food,after_bowel_movement,trained,training_type,training_duration_min,notes,meal_count';
    expect(lines[0]).toBe(header);

    // Field-indexed rather than comma-counted, so a new column can't quietly
    // shift a value into the wrong slot.
    const columns = header.split(',');
    const row = (line: string) =>
      Object.fromEntries(line.split(',').map((v, i) => [columns[i], v])) as Record<string, string>;
    for (const line of lines) expect(line.split(',')).toHaveLength(columns.length);

    expect(row(lines[1])).toMatchObject({
      date: '2026-08-03',
      weight_kg: '63.7',
      calories: '2140',
      protein_g: '145',
      carbs_g: '250',
      fat_g: '65',
      fiber_g: '', // not recorded stays empty — never a zero
      bowel_movement: 'yes',
      weighed_time: '',
      trained: 'yes',
      notes: 'Normal day',
      meal_count: '',
    });

    expect(row(lines[2])).toMatchObject({
      date: '2026-08-04',
      weight_kg: '63.9',
      calories: '2210',
      protein_g: '',
    });

    const empty = row(lines[3]);
    expect(Object.values(empty).filter((v) => v !== '')).toEqual(['2026-08-05']);

    expect(csv).not.toContain('_id');
  });

  it('escapes commas and quotes in notes', () => {
    const csv = buildCsv([entry('2026-08-06', { notes: 'salty, "restaurant" meal' })]);
    expect(csv).toContain('"salty, ""restaurant"" meal"');
  });
});

describe('Markdown export', () => {
  it('contains a summary block and the spec table layout', () => {
    const md = buildMarkdown(entries);
    expect(md).toContain('Period: 2026-08-03 to 2026-08-05');
    expect(md).toContain('Weight measurements: 2');
    expect(md).toContain('Calorie-recorded days: 2');
    expect(md).toContain('| Date | Weight (kg) | Calories | Protein | Carbs | Fat | BM | Training | Notes |');
    expect(md).toContain('|---|---:|---:|---:|---:|---:|---|---|---|');
    expect(md).toContain('| 2026-08-03 | 63.7 | 2140 | 145 | 250 | 65 | Yes | Yes | Normal day |');
  });
});

describe('ChatGPT prompt export', () => {
  it('includes profile values from the database and the data table', () => {
    const profile: Profile = {
      sex: 'male',
      age: 30,
      heightCm: 169,
      goal: 'Lean bulk',
      targetWeightChangeKgPerWeek: 0.2,
      trainingDaysPerWeek: 4.5,
      cardio: false,
      maintenanceCalories: null,
      calorieTarget: null,
      notes: '',
    };
    const text = buildChatGptPrompt(entries, profile);
    expect(text).toContain('- Age: 30');
    expect(text).toContain('- Height: 169 cm');
    expect(text).toContain('+0.2 kg/week');
    expect(text).toContain('Here is my data:');
    expect(text).toContain('| 2026-08-03 |');
  });
});
