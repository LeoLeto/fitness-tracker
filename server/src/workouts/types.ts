/**
 * Workout domain types.
 *
 * The model mirrors the user's long-standing paper notation:
 *   "Tu: 100 x8; 90 x7 (2 RIR) x6? x5*🚨"
 * — sets grouped by weight, optional RIR, and per-set flags:
 *   `?`  rep count uncertain
 *   `*`  last rep had bad form
 *   `🚨` set cut short because of pain
 * Exercise order swaps (⬆️/⬇️ in the notes) are captured structurally:
 * a workout stores the order actually performed, and `orderMoved` records
 * how it deviated from the routine's default order that day.
 */

export type Routine = string; // 'push' | 'pull' | 'legs' | 'abs' | custom

export interface Exercise {
  id: string;
  name: string;
  routine: Routine;
  /** Persistent machine setup, e.g. "3 holes", "depth 2, feet 0". */
  setupNotes: string;
  isBodyweight: boolean;
  /** Default position within the routine (what "swapped" is measured against). */
  orderIndex: number;
  archived: boolean;
}

export interface WorkoutSet {
  /** null for bodyweight sets. */
  weightKg: number | null;
  reps: number;
  /** Reps in reserve; null when not recorded (pre-May style). */
  rir: number | null;
  /** `?` — rep count uncertain. */
  repsUncertain: boolean;
  /** `*` — last rep with bad form. */
  badForm: boolean;
  /** `🚨` — set cut short because of pain. */
  pain: boolean;
  /** Part of a drop set (e.g. "DS35x3/30x3"). */
  isDropSet: boolean;
  /** Anything else worth keeping ("💀", "w/wristbands", "R", …). */
  note: string | null;
}

export interface WorkoutExercise {
  exerciseId: string | null;
  /** Denormalised so history survives renames/deletes. */
  exerciseName: string;
  /** Order actually performed that day (0-based). */
  order: number;
  /** Deviation from the routine's default order (⬆️ earlier / ⬇️ later). */
  orderMoved: 'up' | 'down' | null;
  /** Session-specific variation, e.g. "w/step", "barbell", "chest supported". */
  variation: string | null;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  date: string; // "YYYY-MM-DD"
  type: 'strength' | 'cardio';
  /** Routine key for strength sessions. */
  routine: Routine | null;
  /** Modality for cardio sessions, e.g. "treadmill", "bike". */
  cardioType: string | null;
  durationMin: number | null;
  notes: string | null;
  /** True for history imported from notes where only month+weekday were known. */
  dateInferred: boolean;
  exercises: WorkoutExercise[];
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export interface ExerciseSessionPoint {
  date: string;
  workoutId: string;
  /** Best-set estimated 1RM (kg); null for bodyweight exercises. */
  e1rm: number | null;
  /** Best-set effective reps (reps + RIR) — the strength metric for bodyweight work. */
  bestReps: number;
  topWeightKg: number | null;
  /** Σ weight × reps over all sets (bodyweight sets contribute 0). */
  volumeKg: number;
  totalSets: number;
  hadPain: boolean;
  hadBadForm: boolean;
  variation: string | null;
}

export interface WeeklyTrainingBar {
  weekStart: string;
  /** Strength sessions per routine that week. */
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

/** A period where the weight trend was consistently in one energy-balance regime. */
export interface WeightBand {
  from: string;
  to: string;
  kind: BandKind;
  trendKgPerWeek: number;
  /** Average e1RM change per routine across the band (%), when computable. */
  strengthChangePct: Record<string, number>;
}

export interface InsightEvent {
  date: string;
  kind:
    | 'training-gap-ended'
    | 'fluid-retention-spike'
    | 'recurring-pain'
    | 'weight-spike';
  title: string;
  detail: string;
  routine?: string;
  exercise?: string;
}

export interface TimelinePayload {
  period: { from: string; to: string };
  weight: { date: string; weightKg: number }[];
  calories: { date: string; calories: number }[];
  /** Weekly strength index per routine (100 = first observed week in range). */
  strengthIndex: { weekStart: string; byRoutine: Record<string, number> }[];
  training: WeeklyTrainingBar[];
  bands: WeightBand[];
  events: InsightEvent[];
}
