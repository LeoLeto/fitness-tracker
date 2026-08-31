/**
 * Exercise variants.
 *
 * A movement can be trained in named forms that share a name and a slot in the
 * routine but not a load scale — the low row on the cable stack pulls 45 kg,
 * the chest-supported machine 30 kg for the same effort. Treating them as one
 * exercise makes "last time", the PR and the progress chart swing between the
 * two whenever the machine changes, so everything that answers "what did I do
 * last time" keys on the (exercise, variant) pair instead of the name alone.
 *
 * Distinct from `variation`, which stays a free-text footnote on one session
 * ("w/step", "chest supported for the second and third sets"): a variant is
 * chosen from the catalog's list and is a grouping key.
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
 * right without a tap. Falls back to the catalog's first (its default form),
 * and to null for an exercise that has only one.
 */
export function defaultVariant(
  variants: string[] | undefined,
  lastUsed: string | null | undefined
): string | null {
  const list = variants ?? [];
  if (list.length === 0) return null;
  const match = list.find((v) => sameVariant(v, lastUsed));
  return match ?? list[0];
}
