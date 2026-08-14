/**
 * Shared domain types for the API.
 *
 * Data principle: optional fields that were not recorded are `null`.
 * Missing data stays missing — it is never coerced to 0, and every analytics
 * result reports how many data points it was computed from.
 */

/**
 * One logged food entry. `calories` is required (a meal without calories has
 * nothing to contribute); macros stay optional and missing means missing.
 */
export interface Meal {
  label: string;
  time: string | null; // "HH:MM"
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  notes: string | null;
}

export interface EntryData {
  weightKg: number | null;
  /**
   * Day total. Derived from `meals` whenever the day has meals; otherwise a
   * manually entered total (legacy days and quick single-number entry).
   */
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  bowelMovement: boolean | null;
  weighedTime: string | null; // "HH:MM", optional context for the weigh-in
  beforeFood: boolean | null;
  afterBowelMovement: boolean | null;
  trained: boolean | null;
  trainingType: string | null;
  trainingDurationMin: number | null;
  notes: string | null;
  /** Individual food entries; empty when the day was logged as a single total. */
  meals: Meal[];
}

export interface DailyEntry extends EntryData {
  date: string; // ISO date "YYYY-MM-DD" — exactly one entry per date
}

export interface Profile {
  sex: 'male' | 'female' | 'other';
  age: number;
  heightCm: number;
  goal: string;
  targetWeightChangeKgPerWeek: number;
  trainingDaysPerWeek: number;
  cardio: boolean;
  /** Current estimated maintenance calories (user-editable estimate, not a measurement). */
  maintenanceCalories: number | null;
  /** Manually accepted/overridden daily calorie target. */
  calorieTarget: number | null;
  notes: string;
}

// ── Food library ───────────────────────────────────────────────────────────────

/** How a food's quantity is expressed. */
export type FoodUnit = 'unit' | 'g' | 'ml';

/**
 * Produce is grouped apart from staples because it is logged differently: you
 * cut a wedge of pumpkin, put it on the scale, and the weight is whatever it
 * is — there is no sensible one-tap portion to offer.
 */
export type FoodCategory = 'fruit' | 'vegetable' | 'other';

export const FOOD_CATEGORIES: FoodCategory[] = ['fruit', 'vegetable', 'other'];

/**
 * A reusable food with its nutrition per `basisQty` units, plus the portion
 * sizes worth a one-tap button (e.g. skimmed milk in 200 ml and 300 ml).
 * Macros left as `null` are simply not recorded for that food.
 */
export interface Food {
  id: string;
  name: string;
  unit: FoodUnit;
  category: FoodCategory;
  basisQty: number;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  portions: number[];
  notes: string;
  archived: boolean;
}

/** A food scaled to one quantity, ready to become a meal. */
export interface FoodPortion {
  qty: number;
  label: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
}

export interface FoodWithPortions extends Food {
  portionOptions: FoodPortion[];
}

export interface MealTemplateItem {
  foodId: string;
  /** Denormalised so a template still reads sensibly if a food is removed. */
  foodName: string;
  qty: number;
}

/** A named set of foods — one tap logs the whole meal. */
export interface MealTemplate {
  id: string;
  name: string;
  time: string | null;
  items: MealTemplateItem[];
  orderIndex: number;
  archived: boolean;
}

/**
 * One line of a template's recipe — what to actually weigh out. Kept separate
 * from `MealTemplateItem` because the quantity is only meaningful with the
 * food's unit, which lives on the food rather than on the item.
 */
export interface TemplatePart {
  foodName: string;
  /** Quantity with its unit: "150 g", "200 ml", "4". */
  qty: string;
  /** kcal for this quantity; `null` when the food is no longer in the library. */
  calories: number | null;
  /** The food's own note ("dry weight", "1 tsp") — preparation context. */
  notes: string;
}

export interface ResolvedMealTemplate extends MealTemplate {
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  /** The recipe, in item order — usable as a shopping/prep list. */
  parts: TemplatePart[];
  /** Names of items whose food is no longer in the library. */
  missingItems: string[];
}

/** An average plus the number of data points it was computed from. */
export interface WindowStat {
  avg: number | null;
  count: number;
}

export interface TrendResult {
  kgPerDay: number;
  kgPerWeek: number;
  count: number; // number of weight measurements used
  spanDays: number; // days between first and last measurement used
  firstDate: string;
  lastDate: string;
}

export type TrendStatus = 'below' | 'on-target' | 'above';

export interface MaintenanceEstimate {
  sufficient: boolean;
  /** Unmet data requirements when `sufficient` is false. */
  reasons: string[];
  periodFrom: string;
  periodTo: string;
  periodDays: number;
  calorieDays: number;
  weightMeasurements: number;
  avgCalories: number | null;
  trendKgPerWeek: number | null;
  /** Rounded to the nearest 10 kcal — this is an estimate, not a measurement. */
  estimatedMaintenanceKcal: number | null;
  dailySurplusKcal: number | null;
  targetSurplusKcal: number | null;
  suggestedIntakeKcal: number | null;
}

export interface Recommendation {
  sufficient: boolean;
  status: TrendStatus | null;
  message: string;
}

export interface AnalyticsSummary {
  period: { from: string; to: string; days: number };
  latestWeight: { date: string; weightKg: number } | null;
  /** Rolling windows ending at `period.to`. */
  weight: { avg7: WindowStat; avg14: WindowStat; avg28: WindowStat };
  calories: { avg7: WindowStat; avg14: WindowStat; avg28: WindowStat };
  /** Macro averages over the selected period. */
  macros: { protein: WindowStat; carbs: WindowStat; fat: WindowStat; fiber: WindowStat };
  trend: TrendResult | null;
  target: {
    kgPerWeek: number;
    toleranceKgPerWeek: number;
    status: TrendStatus | null;
  };
  maintenance: MaintenanceEstimate;
  recommendation: Recommendation;
}

export interface WeeklySummary {
  weekStart: string; // Monday, "YYYY-MM-DD"
  weekEnd: string; // Sunday
  avgWeight: number | null;
  weighIns: number;
  avgCalories: number | null;
  calorieDays: number;
  avgProtein: number | null;
  proteinDays: number;
  /** Regression trend within the week; null when fewer than 3 weigh-ins. */
  trendKgPerWeek: number | null;
  changeVsPrevWeekKg: number | null;
  /** Days with training: logged workout OR daily entry marked trained. */
  trainingDays: number;
  /** Strength sessions per routine that week (from the workout log). */
  sessionsByRoutine: Record<string, number>;
  cardioMin: number;
  notes: { date: string; text: string }[];
}
