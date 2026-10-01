import { describe, expect, it } from 'vitest';
import {
  buildChatGptPrompt,
  buildCsv,
  buildMarkdown,
  buildWorkoutsCsv,
  buildWorkoutsMarkdown,
} from '../src/services/exportService';
import { DailyEntry, Profile } from '../src/types';
import { Workout } from '../src/workouts/types';

function entry(date: string, fields: Partial<DailyEntry>): DailyEntry {
  return {
    date,
    weightKg: null,
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
    caloriesIncomplete: null,
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
      'date,weight_kg,calories,protein_g,carbs_g,fat_g,fiber_g,calories_incomplete,' +
      'tracking_paused,bowel_movement,weighed_time,before_food,after_bowel_movement,trained,' +
      'training_type,training_duration_min,notes,meal_count';
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
    expect(md).toContain(
      '| Date | Weight (kg) | Calories | Food log | Protein | Carbs | Fat | BM | Training | Notes |'
    );
    expect(md).toContain('|---|---:|---:|---|---:|---:|---:|---|---|---|');
    expect(md).toContain('| 2026-08-03 | 63.7 | 2140 |  | 145 | 250 | 65 | Yes | Yes | Normal day |');
  });
});

describe('days with an incomplete food log', () => {
  const partial = [
    entry('2026-08-03', { weightKg: 63.7, calories: 2100 }),
    entry('2026-08-04', { weightKg: 63.8, calories: 400, caloriesIncomplete: true }),
    entry('2026-08-05', { weightKg: 63.9, calories: 2300 }),
  ];

  it('carries the flag as its own CSV column', () => {
    const lines = buildCsv(partial).trim().split('\r\n');
    const columns = lines[0].split(',');
    const at = (line: string, name: string) => line.split(',')[columns.indexOf(name)];
    expect(at(lines[2], 'calories_incomplete')).toBe('yes');
    // The calories themselves are still exported — the day is excluded from
    // averages, not erased.
    expect(at(lines[2], 'calories')).toBe('400');
    expect(at(lines[1], 'calories_incomplete')).toBe('');
  });

  it('keeps the partial day out of the Markdown average and says so', () => {
    const md = buildMarkdown(partial);
    expect(md).toContain('Average calories: 2,200 kcal/day'); // not (2100+400+2300)/3
    expect(md).toContain('Calorie-recorded days: 2');
    expect(md).toContain('Days with a partial food log (excluded from the calorie average): 1');
    expect(md).toContain('| 2026-08-04 | 63.8 | 400 | partial |');
  });

  it('tells the ChatGPT prompt not to average those days back in', () => {
    const profile: Profile = {
      sex: 'male',
      age: 30,
      heightCm: 175,
      goal: 'Lean bulk',
      targetWeightChangeKgPerWeek: 0.25,
      trainingDaysPerWeek: 4,
      cardio: false,
      maintenanceCalories: null,
      calorieTarget: null,
      notes: '',
    };
    expect(buildChatGptPrompt(partial, profile)).toContain('Leave them out of every calorie');
    // Nothing to say when no day is flagged.
    expect(buildChatGptPrompt(entries, profile)).not.toContain('marked "partial"');
  });
});

describe('days that total 0 kcal', () => {
  const zeroDays = [
    entry('2026-08-03', { weightKg: 63.7, calories: 2100 }),
    entry('2026-08-04', { weightKg: 63.8, calories: 0 }),
    entry('2026-08-05', { weightKg: 63.9, calories: 2300 }),
  ];

  it('keeps the 0 kcal day out of the Markdown average and labels the row', () => {
    const md = buildMarkdown(zeroDays);
    expect(md).toContain('Average calories: 2,200 kcal/day'); // not (2100+0+2300)/3
    expect(md).toContain('Calorie-recorded days: 2');
    expect(md).toContain('Days with nothing logged (excluded from the calorie average): 1');
    expect(md).toContain('| 2026-08-04 | 63.8 | 0 | not logged |');
  });

  it('tells the ChatGPT prompt the 0 is an empty log, not a fast', () => {
    const profile: Profile = {
      sex: 'male',
      age: 30,
      heightCm: 175,
      goal: 'Lean bulk',
      targetWeightChangeKgPerWeek: 0.25,
      trainingDaysPerWeek: 4,
      cardio: false,
      maintenanceCalories: null,
      calorieTarget: null,
      notes: '',
    };
    expect(buildChatGptPrompt(zeroDays, profile)).toContain('not a fast');
    expect(buildChatGptPrompt(entries, profile)).not.toContain('marked "not logged"');
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

describe('workout CSV export', () => {
  const workouts: Workout[] = [
    {
      id: 'w1',
      date: '2026-08-23',
      type: 'strength',
      routine: 'pull',
      cardioType: null,
      durationMin: null,
      distanceKm: null,
      notes: 'good session',
      dateInferred: false,
      exercises: [
        {
          exerciseId: 'b',
          exerciseName: 'Low row machine',
          order: 0,
          orderMoved: null,
          variation: 'chest supported for the last two sets',
          variant: 'Chest supported',
          swappedFrom: null,
          sets: [
            {
              weightKg: 30,
              reps: 12,
              rir: 2,
              repsUncertain: false,
              badForm: false,
              pain: false,
              isDropSet: false,
              note: null,
            },
          ],
        },
      ],
    },
    {
      id: 'w2',
      date: '2026-08-24',
      type: 'cardio',
      routine: null,
      cardioType: 'treadmill',
      durationMin: 32.25,
      distanceKm: 5,
      notes: 'easy pace',
      dateInferred: false,
      exercises: [],
    },
  ];

  // Field-indexed rather than comma-counted, so a new column can't quietly
  // shift a value into the wrong slot — the set-less padding row did exactly
  // that when its run of empties was one short.
  it('keeps every row aligned to the header, set-less sessions included', () => {
    const lines = buildWorkoutsCsv(workouts).trim().split('\r\n');
    const columns = lines[0].split(',');
    expect(columns).toContain('variant');
    for (const line of lines) expect(line.split(',')).toHaveLength(columns.length);

    const row = (line: string) =>
      Object.fromEntries(line.split(',').map((v, i) => [columns[i], v])) as Record<string, string>;

    expect(row(lines[1])).toMatchObject({
      exercise: 'Low row machine',
      variant: 'Chest supported',
      weight_kg: '30',
      reps: '12',
      rir: '2',
      workout_notes: 'good session',
    });
    // The notes of a session with no sets land in their own column, not in the
    // last set column before them.
    expect(row(lines[2])).toMatchObject({
      cardio_type: 'treadmill',
      duration_min: '32.25',
      distance_km: '5',
      exercise: '',
      set_note: '',
      workout_notes: 'easy pace',
    });
  });

  it('names the variant alongside the exercise in the Markdown log', () => {
    const md = buildWorkoutsMarkdown(workouts);
    expect(md).toContain('- Low row machine [Chest supported]');
  });

  it('writes runs as treadmill time, distance and pace', () => {
    const md = buildWorkoutsMarkdown(workouts);
    expect(md).toContain('**2026-08-24 — Cardio**: treadmill · 32:15 · 5.00 km · 6:27/km');
  });
});
