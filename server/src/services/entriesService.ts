import { DailyEntry } from '../types';

/**
 * The subset of the mongoose Model API the entries service depends on.
 * Kept as an interface so the upsert semantics can be unit-tested against an
 * in-memory fake without a running MongoDB.
 */
export interface EntryStore {
  findOneAndUpdate(
    filter: { date: string },
    update: { $set: DailyEntry },
    options: { upsert: boolean; new: boolean; setDefaultsOnInsert: boolean }
  ): Promise<unknown> | { lean(): Promise<unknown> };
}

/**
 * Saves a daily entry, enforcing exactly one entry per calendar date:
 * saving a date that already exists replaces that day's data instead of
 * creating a duplicate (backed by the unique index on `date`).
 */
export async function upsertEntry(store: EntryStore, entry: DailyEntry): Promise<unknown> {
  const result = store.findOneAndUpdate(
    { date: entry.date },
    { $set: entry },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  // Mongoose returns a chainable Query; the in-memory fake returns a Promise.
  if (typeof (result as { lean?: unknown }).lean === 'function') {
    return (result as { lean(): Promise<unknown> }).lean();
  }
  return result;
}
