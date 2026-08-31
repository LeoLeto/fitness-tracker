/**
 * Exercise variants (mirrors server/src/workouts/variants.ts).
 *
 * A movement can be trained in named forms that share a name and a slot in the
 * routine but not a load scale — the low row pulls 45 kg on the cable stack and
 * 30 kg chest-supported for the same effort. Everything that answers "what did
 * I do last time" keys on the (exercise, variant) pair, so switching machines
 * never shows the other one's numbers as the target.
 *
 * Distinct from `variation`, which stays a free-text footnote on one session.
 */

/** Comparison form: case- and whitespace-insensitive; null and '' are one thing. */
export function normalizeVariant(variant: string | null | undefined): string {
  return (variant ?? '').trim().toLowerCase();
}

/** Lookup key for per-variant history — last performance, personal bests. */
export function perfKey(exerciseName: string, variant: string | null | undefined): string {
  return `${exerciseName.trim().toLowerCase()}|${normalizeVariant(variant)}`;
}

export function sameVariant(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeVariant(a) === normalizeVariant(b);
}

/**
 * Which variant a fresh log starts on: the one used last time, since a run of
 * sessions on the same machine is the norm and that makes the ghost numbers
 * right with no taps at all. Falls back to the catalog's first (its default
 * form), and to null for an exercise that has only one.
 */
export function defaultVariant(
  variants: string[] | undefined,
  lastUsed: string | null | undefined
): string | null {
  const list = variants ?? [];
  if (list.length === 0) return null;
  return list.find((v) => sameVariant(v, lastUsed)) ?? list[0];
}
