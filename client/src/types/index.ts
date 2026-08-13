/**
 * API types — kept in sync with server/src/types.ts.
 * Optional fields that were not recorded are `null`; missing data is never 0.
 */

/** One logged food entry. Calories are required; macros stay optional. */
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

// ── Food library ───────────────────────────────────────────────────────────────

export type FoodUnit = 'unit' | 'g' | 'ml';

/** A reusable food: nutrition per `basisQty` units, plus one-tap portions. */
export interface Food {
  id: string;
  name: string;
  unit: FoodUnit;
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

/** A food already scaled to one quantity, ready to log as a meal. */
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
  foodName: string;
  qty: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  time: string | null;
  items: MealTemplateItem[];
  orderIndex: number;
  archived: boolean;
}

/** One line of a template's recipe — the quantity to weigh out, with its unit. */
export interface TemplatePart {
  foodName: string;
  /** Quantity with its unit: "150 g", "200 ml", "4". */
  qty: string;
  /** kcal for this quantity; `null` when the food is no longer in the library. */
  calories: number | null;
  /** The food's own note ("dry weight", "1 tsp") — preparation context. */
  notes: string;
}

/** A template with nutrition summed from the current library. */
export interface ResolvedMealTemplate extends MealTemplate {
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  /** The recipe, in item order. */
  parts: TemplatePart[];
  missingItems: string[];
}

export interface DailyEntry {
  date: string; // "YYYY-MM-DD"
  weightKg: number | null;
  /** Derived from `meals` when the day has meals; a manual total otherwise. */
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  bowelMovement: boolean | null;
  weighedTime: string | null;
  beforeFood: boolean | null;
  afterBowelMovement: boolean | null;
  trained: boolean | null;
  trainingType: string | null;
  trainingDurationMin: number | null;
  notes: string | null;
  meals: Meal[];
}

export interface Profile {
  sex: 'male' | 'female' | 'other';
  age: number;
  heightCm: number;
  goal: string;
  targetWeightChangeKgPerWeek: number;
  trainingDaysPerWeek: number;
  cardio: boolean;
  maintenanceCalories: number | null;
  calorieTarget: number | null;
  notes: string;
}

export interface WindowStat {
  avg: number | null;
  count: number;
}

export interface TrendResult {
  kgPerDay: number;
  kgPerWeek: number;
  count: number;
  spanDays: number;
  firstDate: string;
  lastDate: string;
}

export type TrendStatus = 'below' | 'on-target' | 'above';

export interface MaintenanceEstimate {
  sufficient: boolean;
  reasons: string[];
  periodFrom: string;
  periodTo: string;
  periodDays: number;
  calorieDays: number;
  weightMeasurements: number;
  avgCalories: number | null;
  trendKgPerWeek: number | null;
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
  weight: { avg7: WindowStat; avg14: WindowStat; avg28: WindowStat };
  calories: { avg7: WindowStat; avg14: WindowStat; avg28: WindowStat };
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
  weekStart: string;
  weekEnd: string;
  avgWeight: number | null;
  weighIns: number;
  avgCalories: number | null;
  calorieDays: number;
  avgProtein: number | null;
  proteinDays: number;
  trendKgPerWeek: number | null;
  changeVsPrevWeekKg: number | null;
  trainingDays: number;
  sessionsByRoutine: Record<string, number>;
  cardioMin: number;
  notes: { date: string; text: string }[];
}

// ── Workouts ───────────────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;
  routine: string;
  setupNotes: string;
  isBodyweight: boolean;
  orderIndex: number;
  archived: boolean;
}

export interface WorkoutSet {
  weightKg: number | null; // null = bodyweight
  reps: number;
  rir: number | null;
  repsUncertain: boolean; // "?"
  badForm: boolean; // "*"
  pain: boolean; // "🚨"
  isDropSet: boolean;
  note: string | null;
}

export interface WorkoutExercise {
  exerciseId: string | null;
  exerciseName: string;
  order: number;
  orderMoved: 'up' | 'down' | null; // ⬆️ / ⬇️ vs the routine's default order
  variation: string | null;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  date: string;
  type: 'strength' | 'cardio';
  routine: string | null;
  cardioType: string | null;
  durationMin: number | null;
  notes: string | null;
  dateInferred: boolean;
  exercises: WorkoutExercise[];
}

export interface ParsedSession {
  sets: WorkoutSet[];
  orderMoved: 'up' | 'down' | null;
  variation: string | null;
  warnings: string[];
}

export interface ExerciseSessionPoint {
  date: string;
  workoutId: string;
  e1rm: number | null;
  bestReps: number;
  topWeightKg: number | null;
  volumeKg: number;
  totalSets: number;
  hadPain: boolean;
  hadBadForm: boolean;
  variation: string | null;
}

/** All-time best single set of one exercise — the logger's target to beat. */
export interface PersonalBest {
  exerciseName: string;
  date: string;
  /** e1RM of the record set (kg); null for exercises never loaded with weight. */
  e1rm: number | null;
  /** reps + RIR of that set — the ranking metric for bodyweight work. */
  effectiveReps: number;
  weightKg: number | null;
  reps: number;
  rir: number | null;
  badForm: boolean;
  pain: boolean;
}

export interface WeeklyTrainingBar {
  weekStart: string;
  sessions: Record<string, number>;
  totalSets: number;
  cardioMin: number;
  cardioSessions: number;
}

export type BandKind =
  | 'steep-deficit'
  | 'deficit'
  | 'maintenance'
  | 'surplus'
  | 'steep-surplus';

export interface WeightBand {
  from: string;
  to: string;
  kind: BandKind;
  trendKgPerWeek: number;
  strengthChangePct: Record<string, number>;
}

export interface InsightEvent {
  date: string;
  kind: 'training-gap-ended' | 'fluid-retention-spike' | 'recurring-pain' | 'weight-spike';
  title: string;
  detail: string;
  routine?: string;
  exercise?: string;
}

export interface TimelinePayload {
  period: { from: string; to: string };
  weight: { date: string; weightKg: number }[];
  calories: { date: string; calories: number }[];
  strengthIndex: { weekStart: string; byRoutine: Record<string, number> }[];
  training: WeeklyTrainingBar[];
  bands: WeightBand[];
  events: InsightEvent[];
}
