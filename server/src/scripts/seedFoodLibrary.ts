/**
 * Seeds the food library and meal templates from the maintenance plan.
 *
 * Nutrition is stored per `basisQty` units and scaled on demand, so the plan's
 * portions come out exactly as written (200 ml milk → 62 kcal, 4 eggs → 280
 * kcal, …). Where the plan doesn't state a macro it stays `null` rather than
 * being invented — the library is editable, so fill those in if you want them.
 *
 * Idempotent: foods upsert by name, templates by name.
 *
 * Usage: npm run seed:foods -w server
 */
import { config } from '../config';
import { connectDb, disconnectDb } from '../db';
import { FoodModel, MealTemplateModel, serializeFood } from '../models/Food';
import { resolveTemplate } from '../services/foodLibrary';
import { Food, FoodUnit } from '../types';

interface SeedFood {
  name: string;
  unit: FoodUnit;
  basisQty: number;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  portions: number[];
  notes?: string;
}

const FOODS: SeedFood[] = [
  {
    name: 'Skimmed milk',
    unit: 'ml',
    basisQty: 100,
    calories: 31,
    proteinG: 3.2,
    carbsG: 5,
    fatG: null,
    fiberG: null,
    portions: [200, 300],
  },
  {
    name: 'Eggs',
    unit: 'unit',
    basisQty: 1,
    calories: 70,
    proteinG: 5,
    carbsG: 0.5,
    fatG: null,
    fiberG: null,
    portions: [3, 4],
  },
  {
    name: 'TSP (dry)',
    unit: 'g',
    basisQty: 50,
    calories: 200,
    proteinG: 25,
    carbsG: 18,
    fatG: null,
    fiberG: 9,
    portions: [50],
    notes: 'Textured soy protein, dry weight',
  },
  {
    name: 'Chicken (raw)',
    unit: 'g',
    basisQty: 100,
    calories: 120,
    proteinG: 20,
    carbsG: 0,
    fatG: null,
    fiberG: 0,
    portions: [150],
  },
  {
    name: 'Pasta (dry)',
    unit: 'g',
    basisQty: 80,
    calories: 300,
    proteinG: 11,
    carbsG: 59,
    fatG: null,
    fiberG: 1.6,
    portions: [80],
  },
  {
    name: 'Whey protein',
    unit: 'g',
    basisQty: 30,
    calories: 140,
    proteinG: 20,
    carbsG: 3,
    fatG: null,
    fiberG: null,
    portions: [30],
  },
  {
    name: 'Potato (raw)',
    unit: 'g',
    basisQty: 200,
    calories: 154,
    proteinG: 4,
    carbsG: 35,
    fatG: null,
    fiberG: 4,
    portions: [200],
  },
  {
    name: 'Carrots (raw)',
    unit: 'g',
    basisQty: 125,
    calories: 50,
    proteinG: 1,
    carbsG: 12,
    fatG: null,
    fiberG: 4,
    portions: [125],
  },
  {
    name: 'Apple',
    unit: 'g',
    basisQty: 180,
    calories: 90,
    proteinG: 0.5,
    carbsG: 24,
    fatG: null,
    fiberG: 4,
    portions: [180],
  },
  {
    name: 'Banana',
    unit: 'unit',
    basisQty: 1,
    calories: 105,
    proteinG: 1,
    carbsG: 27,
    fatG: null,
    fiberG: 3,
    portions: [1],
    notes: 'Medium, ~120 g edible',
  },
  {
    name: 'Chia seeds',
    unit: 'g',
    basisQty: 10,
    calories: 50,
    proteinG: 2,
    carbsG: 2,
    fatG: null,
    fiberG: 5,
    portions: [10],
  },
  {
    name: 'Oil',
    unit: 'unit',
    basisQty: 1,
    calories: 40,
    proteinG: 0,
    carbsG: 0,
    fatG: 4.5,
    fiberG: 0,
    portions: [1],
    notes: '1 tsp',
  },
];

interface SeedTemplate {
  name: string;
  time: string;
  items: { food: string; qty: number }[];
  /** The plan's own stated total, used as a sanity check while seeding. */
  expectedKcal: number;
}

const TEMPLATES: SeedTemplate[] = [
  {
    name: 'TSP + Apple + Potato',
    time: '04:15',
    items: [
      { food: 'TSP (dry)', qty: 50 },
      { food: 'Skimmed milk', qty: 200 },
      { food: 'Apple', qty: 180 },
      { food: 'Potato (raw)', qty: 200 },
    ],
    expectedKcal: 506,
  },
  {
    name: 'Egg Breakfast',
    time: '08:00',
    items: [
      { food: 'Eggs', qty: 4 },
      { food: 'Skimmed milk', qty: 300 },
      { food: 'Oil', qty: 1 },
    ],
    expectedKcal: 413,
  },
  {
    name: 'Pre-Workout: Chicken + Pasta',
    time: '12:00',
    items: [
      { food: 'Chicken (raw)', qty: 150 },
      { food: 'Pasta (dry)', qty: 80 },
      { food: 'Carrots (raw)', qty: 125 },
    ],
    expectedKcal: 530,
  },
  {
    name: 'Post-Workout Recovery',
    time: '15:00',
    items: [
      { food: 'Whey protein', qty: 30 },
      { food: 'Skimmed milk', qty: 300 },
      { food: 'Chia seeds', qty: 10 },
    ],
    expectedKcal: 283,
  },
  {
    name: 'Chicken + Carrots + Banana',
    time: '17:30',
    items: [
      { food: 'Chicken (raw)', qty: 150 },
      { food: 'Carrots (raw)', qty: 125 },
      { food: 'Banana', qty: 1 },
    ],
    expectedKcal: 335,
  },
];

async function main() {
  await connectDb(config.mongoUri);

  const byName = new Map<string, Food>();
  for (const seed of FOODS) {
    const doc = await FoodModel.findOneAndUpdate(
      { name: seed.name },
      {
        $set: {
          unit: seed.unit,
          basisQty: seed.basisQty,
          calories: seed.calories,
          proteinG: seed.proteinG,
          carbsG: seed.carbsG,
          fatG: seed.fatG,
          fiberG: seed.fiberG,
          portions: seed.portions,
          notes: seed.notes ?? '',
          archived: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    byName.set(seed.name, serializeFood(doc as Record<string, unknown>));
  }
  console.log(`${FOODS.length} foods upserted`);

  const foods = [...byName.values()];
  let dayTotal = 0;

  for (const [i, seed] of TEMPLATES.entries()) {
    const items = seed.items.map(({ food, qty }) => {
      const match = byName.get(food);
      if (!match) throw new Error(`Seed error: unknown food "${food}"`);
      return { foodId: match.id, foodName: match.name, qty };
    });

    const doc = await MealTemplateModel.findOneAndUpdate(
      { name: seed.name },
      { $set: { time: seed.time, items, orderIndex: i, archived: false } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const resolved = resolveTemplate(
      {
        id: String((doc as { _id: unknown })._id),
        name: seed.name,
        time: seed.time,
        items,
        orderIndex: i,
        archived: false,
      },
      foods
    );
    dayTotal += resolved.calories;

    const drift = resolved.calories - seed.expectedKcal;
    console.log(
      `  ${seed.time} ${seed.name}: ${resolved.calories} kcal / ${resolved.proteinG} g protein` +
        (drift === 0 ? ' ✓ matches plan' : ` (plan says ${seed.expectedKcal})`)
    );
  }

  console.log(`${TEMPLATES.length} meal templates upserted — full day ≈ ${dayTotal} kcal`);
  await disconnectDb();
}

void main();
