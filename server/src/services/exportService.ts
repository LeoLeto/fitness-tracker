import { DailyEntry, Profile } from '../types';
import { average } from '../analytics/averages';
import { weightTrend } from '../analytics/trend';
import { toCsv } from '../utils/csv';
import { formatSets } from '../workouts/notation';
import { Workout } from '../workouts/types';

/**
 * Export builders. Exports always contain the raw daily data exactly as
 * entered — never smoothed values — and never include Mongo internals or
 * database credentials.
 */

const CSV_HEADER = [
  'date',
  'weight_kg',
  'calories',
  'protein_g',
  'carbs_g',
  'fat_g',
  'bowel_movement',
  'weighed_time',
  'before_food',
  'after_bowel_movement',
  'trained',
  'training_type',
  'training_duration_min',
  'notes',
];

function yesNo(v: boolean | null): string {
  if (v === null) return '';
  return v ? 'yes' : 'no';
}

function num(v: number | null, decimals?: number): string {
  if (v === null) return '';
  return decimals !== undefined ? v.toFixed(decimals) : String(v);
}

export function buildCsv(entries: DailyEntry[]): string {
  const rows = entries.map((e) => [
    e.date,
    num(e.weightKg, 1),
    num(e.calories),
    num(e.proteinG),
    num(e.carbsG),
    num(e.fatG),
    yesNo(e.bowelMovement),
    e.weighedTime ?? '',
    yesNo(e.beforeFood),
    yesNo(e.afterBowelMovement),
    yesNo(e.trained),
    e.trainingType ?? '',
    num(e.trainingDurationMin),
    e.notes ?? '',
  ]);
  return toCsv([CSV_HEADER, ...rows]);
}

interface ExportSummary {
  from: string | null;
  to: string | null;
  avgCalories: number | null;
  calorieDays: number;
  avgWeight: number | null;
  weightMeasurements: number;
  trendKgPerWeek: number | null;
  trainingDays: number;
}

export function buildExportSummary(entries: DailyEntry[]): ExportSummary {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const weights = sorted.filter((e) => e.weightKg != null);
  const calories = sorted.filter((e) => e.calories != null).map((e) => e.calories as number);
  const trend = weightTrend(
    weights.map((e) => ({ date: e.date, weightKg: e.weightKg as number }))
  );
  return {
    from: sorted.length > 0 ? sorted[0].date : null,
    to: sorted.length > 0 ? sorted[sorted.length - 1].date : null,
    avgCalories: average(calories),
    calorieDays: calories.length,
    avgWeight: average(weights.map((e) => e.weightKg as number)),
    weightMeasurements: weights.length,
    trendKgPerWeek: trend ? trend.kgPerWeek : null,
    trainingDays: sorted.filter((e) => e.trained === true).length,
  };
}

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');
const signed = (v: number, decimals: number) => `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}`;

/** Escapes characters that would break a Markdown table cell. */
function mdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * ChatGPT-friendly export: a short stats summary followed by a clean
 * Markdown table of the raw daily data.
 */
export function buildMarkdown(entries: DailyEntry[]): string {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const s = buildExportSummary(sorted);

  const lines: string[] = [];
  if (s.from && s.to) lines.push(`Period: ${s.from} to ${s.to}`);
  lines.push(
    s.avgCalories != null
      ? `Average calories: ${fmtInt(s.avgCalories)} kcal/day`
      : 'Average calories: no calorie data'
  );
  lines.push(
    s.avgWeight != null
      ? `Average weight: ${s.avgWeight.toFixed(2)} kg`
      : 'Average weight: no weight data'
  );
  lines.push(
    s.trendKgPerWeek != null
      ? `Weight trend: ${signed(s.trendKgPerWeek, 2)} kg/week`
      : 'Weight trend: not enough weight data'
  );
  lines.push(`Weight measurements: ${s.weightMeasurements}`);
  lines.push(`Calorie-recorded days: ${s.calorieDays}`);
  lines.push(`Training days: ${s.trainingDays}`);

  const header =
    '| Date | Weight (kg) | Calories | Protein | Carbs | Fat | BM | Training | Notes |';
  const separator = '|---|---:|---:|---:|---:|---:|---|---|---|';
  const rows = sorted.map((e) =>
    [
      e.date,
      e.weightKg != null ? e.weightKg.toFixed(1) : '',
      e.calories != null ? String(e.calories) : '',
      e.proteinG != null ? String(e.proteinG) : '',
      e.carbsG != null ? String(e.carbsG) : '',
      e.fatG != null ? String(e.fatG) : '',
      e.bowelMovement === null ? '' : e.bowelMovement ? 'Yes' : 'No',
      e.trained === null ? '' : e.trained ? 'Yes' : 'No',
      e.notes ? mdCell(e.notes) : '',
    ].join(' | ')
  );

  return `${lines.join('\n')}\n\n${header}\n${separator}\n${rows
    .map((r) => `| ${r} |`)
    .join('\n')}\n`;
}

// ── Workout exports ────────────────────────────────────────────────────────────

const WORKOUT_CSV_HEADER = [
  'date',
  'type',
  'routine',
  'cardio_type',
  'duration_min',
  'exercise',
  'exercise_order',
  'order_moved',
  'variation',
  'set_number',
  'weight_kg',
  'reps',
  'rir',
  'reps_uncertain',
  'bad_form',
  'pain',
  'drop_set',
  'set_note',
  'workout_notes',
  'date_inferred',
];

/** One CSV row per set (cardio sessions export as a single set-less row). */
export function buildWorkoutsCsv(workouts: Workout[]): string {
  const rows: string[][] = [];
  for (const w of workouts) {
    const base = [
      w.date,
      w.type,
      w.routine ?? '',
      w.cardioType ?? '',
      w.durationMin != null ? String(w.durationMin) : '',
    ];
    if (w.type === 'cardio' || w.exercises.length === 0) {
      rows.push([
        ...base,
        '', '', '', '', '', '', '', '', '', '', '', '',
        w.notes ?? '',
        w.dateInferred ? 'yes' : '',
      ]);
      continue;
    }
    for (const ex of w.exercises) {
      ex.sets.forEach((s, i) => {
        rows.push([
          ...base,
          ex.exerciseName,
          String(ex.order + 1),
          ex.orderMoved ?? '',
          ex.variation ?? '',
          String(i + 1),
          s.weightKg != null ? String(s.weightKg) : '',
          String(s.reps),
          s.rir != null ? String(s.rir) : '',
          s.repsUncertain ? 'yes' : '',
          s.badForm ? 'yes' : '',
          s.pain ? 'yes' : '',
          s.isDropSet ? 'yes' : '',
          s.note ?? '',
          w.notes ?? '',
          w.dateInferred ? 'yes' : '',
        ]);
      });
    }
  }
  return toCsv([WORKOUT_CSV_HEADER, ...rows]);
}

const NOTATION_LEGEND =
  'Set notation: `weight xReps (RIR)` — `*` last rep with bad form, `?` rep count uncertain, ' +
  '`🚨` set cut short by pain, `BW` bodyweight. `[⬆️/⬇️]` = exercise order swapped that day.';

function orderBadge(moved: 'up' | 'down' | null): string {
  if (moved === 'up') return ' [⬆️]';
  if (moved === 'down') return ' [⬇️]';
  return '';
}

/** Compact Markdown workout log in the user's own notation. */
export function buildWorkoutsMarkdown(workouts: Workout[]): string {
  if (workouts.length === 0) return '';
  const sorted = [...workouts].sort((a, b) => (a.date < b.date ? -1 : 1));

  const byRoutine = new Map<string, number>();
  let cardioCount = 0;
  const lines: string[] = [];

  for (const w of sorted) {
    if (w.type === 'cardio') {
      cardioCount++;
      const duration = w.durationMin != null ? `${w.durationMin} min` : 'duration n/a';
      lines.push(`**${w.date} — Cardio**: ${w.cardioType ?? 'cardio'}, ${duration}`);
      continue;
    }
    const routine = w.routine ?? 'other';
    byRoutine.set(routine, (byRoutine.get(routine) ?? 0) + 1);
    lines.push(`**${w.date} — ${routine}**${w.dateInferred ? ' (date approx.)' : ''}`);
    const ordered = [...w.exercises].sort((a, b) => a.order - b.order);
    for (const ex of ordered) {
      if (ex.sets.length === 0) continue;
      const variation = ex.variation ? ` (${ex.variation})` : '';
      lines.push(`- ${ex.exerciseName}${variation}${orderBadge(ex.orderMoved)}: ${formatSets(ex.sets)}`);
    }
    if (w.notes) lines.push(`- note: ${w.notes}`);
  }

  const routineSummary = [...byRoutine.entries()]
    .map(([r, n]) => `${r} ${n}`)
    .join(', ');
  const header =
    `Strength sessions: ${sorted.length - cardioCount}` +
    (routineSummary ? ` (${routineSummary})` : '') +
    `\nCardio sessions: ${cardioCount}\n${NOTATION_LEGEND}\n`;

  return `${header}\n${lines.join('\n')}\n`;
}

/** Full "Copy Data + Analysis Prompt" payload: analysis prompt + profile + data table. */
export function buildChatGptPrompt(
  entries: DailyEntry[],
  profile: Profile,
  withWorkouts = false
): string {
  const target = signed(profile.targetWeightChangeKgPerWeek, 1);
  const prompt = `I'm tracking my calories and body weight to determine my real-world maintenance calories and target a weight change of approximately ${target} kg/week.

My profile:
- Sex: ${profile.sex}
- Age: ${profile.age}
- Height: ${profile.heightCm} cm
- Training: Gym ${profile.trainingDaysPerWeek}x/week
- Cardio: ${profile.cardio ? 'Yes' : 'None'}
- Target change: ${target} kg/week

Analyze the following data.

Please:
1. Calculate average calorie intake.
2. Calculate average weight.
3. Calculate 7-day and 14-day weight averages.
4. Estimate the weight trend in kg/week using regression.
5. Estimate my actual maintenance calories from calorie intake and weight trend.
6. Tell me whether my current intake is likely maintenance, deficit, or surplus.
7. Recommend a calorie target for approximately ${target} kg/week.
8. Point out any data-quality issues or unusual fluctuations.
9. Don't overreact to individual weigh-ins.
10. Give me a concise recommendation for what calories I should eat for the next 1–2 weeks.
${
  withWorkouts
    ? `11. Cross-reference my workout log with the weight/calorie data: strength changes during deficit periods, water-weight spikes right after resuming a muscle group (especially legs), and the effect of cardio sessions.
`
    : ''
}
Here is my data:

`;
  return prompt + buildMarkdown(entries);
}
