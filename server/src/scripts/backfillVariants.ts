/**
 * Backfills exercise variants onto the catalog and onto existing history.
 *
 * Variants are a grouping key (see ../workouts/variants), so history logged
 * before they existed has `variant: null` and would sit in its own bucket —
 * the low row's chest-supported sessions would look like a machine with no
 * past. This walks the plan below, registers each exercise's variants and
 * assigns every past session the variant it was actually performed on, read
 * off the free-text `variation` it was recorded with at the time.
 *
 * Dry run by default: prints every change it would make and writes nothing.
 *
 *   npm run backfill:variants -w server            # show the plan
 *   npm run backfill:variants -w server -- --apply # write it
 *
 * Idempotent — an exercise that already carries a variant is left alone, so
 * running it twice is safe and running it after adding a plan entry only
 * touches the newly planned exercise.
 */
import { config } from '../config';
import { connectDb, disconnectDb } from '../db';
import { ExerciseModel } from '../models/Exercise';
import { WorkoutModel } from '../models/Workout';
import { WorkoutExercise } from '../workouts/types';
import { normalizeVariant } from '../workouts/variants';

interface VariantPlan {
  /** Catalog exercise name, matched case-insensitively. */
  exercise: string;
  /** The variants to register, in order; the first is the exercise's default. */
  variants: string[];
  /**
   * How past sessions map onto them, by the `variation` text they were logged
   * with. First match wins, matched as a case-insensitive prefix so a variation
   * that says more than the variant name ("Chest supported for the second and
   * third sets") still lands on the right machine.
   */
  match: { variationStartsWith: string; variant: string }[];
  /** Variant for a session whose variation matches nothing — the usual form. */
  fallback: string;
}

const PLAN: VariantPlan[] = [
  {
    exercise: 'Low row machine',
    variants: ['Cable', 'Chest supported'],
    match: [{ variationStartsWith: 'chest supported', variant: 'Chest supported' }],
    fallback: 'Cable',
  },
  {
    // The barbell bench is the same push slot as the machine but nowhere near
    // the same load scale, so it gets its own variant rather than a variation
    // footnote. Every session logged so far was on the machine — the history
    // predates the bench — so that is the fallback.
    exercise: 'Chest press',
    variants: ['Machine', 'Bench press'],
    match: [{ variationStartsWith: 'bench', variant: 'Bench press' }],
    fallback: 'Machine',
  },
];

/** The variant a past session was performed on, per the plan's rules. */
function variantFor(plan: VariantPlan, variation: string | null): string {
  const text = normalizeVariant(variation);
  for (const rule of plan.match) {
    if (text.startsWith(normalizeVariant(rule.variationStartsWith))) return rule.variant;
  }
  return plan.fallback;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await connectDb(config.mongoUri);
  console.log(apply ? 'Applying variant backfill.\n' : 'Dry run — nothing will be written.\n');

  let catalogChanges = 0;
  let sessionChanges = 0;

  for (const plan of PLAN) {
    console.log(`${plan.exercise} → [${plan.variants.join(', ')}]`);

    // ── Catalog ────────────────────────────────────────────────────────────
    const exercises = await ExerciseModel.find({
      name: new RegExp(`^${plan.exercise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (exercises.length === 0) {
      console.log('  ! no catalog exercise with that name — skipping\n');
      continue;
    }
    for (const ex of exercises) {
      const current = ex.variants ?? [];
      if (current.join('|') === plan.variants.join('|')) {
        console.log(`  catalog (${ex.routine}): variants already set`);
        continue;
      }
      console.log(`  catalog (${ex.routine}): [${current.join(', ')}] → [${plan.variants.join(', ')}]`);
      catalogChanges++;
      if (apply) {
        ex.variants = plan.variants;
        await ex.save();
      }
    }

    // ── History ────────────────────────────────────────────────────────────
    const workouts = await WorkoutModel.find({
      type: 'strength',
      'exercises.exerciseName': exercises[0].name,
    }).sort({ date: 1 });

    for (const w of workouts) {
      let touched = false;
      for (const ex of w.exercises as WorkoutExercise[]) {
        if (ex.exerciseName.trim().toLowerCase() !== plan.exercise.trim().toLowerCase()) continue;
        if (ex.variant) continue; // already assigned; never re-decide
        const variant = variantFor(plan, ex.variation);
        // A variation that only repeated the variant's name is now redundant;
        // one that said more than that is kept as the footnote it was.
        const dropVariation = normalizeVariant(ex.variation) === normalizeVariant(variant);
        console.log(
          `  ${w.date}: variation ${JSON.stringify(ex.variation)} → variant "${variant}"` +
            (dropVariation ? ' (variation cleared as redundant)' : '')
        );
        sessionChanges++;
        touched = true;
        if (apply) {
          ex.variant = variant;
          if (dropVariation) ex.variation = null;
        }
      }
      if (touched && apply) {
        w.markModified('exercises');
        await w.save();
      }
    }
    console.log('');
  }

  console.log(
    `${catalogChanges} catalog change(s), ${sessionChanges} session exercise(s)` +
      (apply ? ' written.' : ' would change. Re-run with --apply to write.')
  );
  await disconnectDb();
}

void main();
