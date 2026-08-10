import { describe, expect, it } from 'vitest';
import { EntryStore, upsertEntry } from '../src/services/entriesService';
import { DailyEntry } from '../src/types';

/**
 * In-memory store reproducing findOneAndUpdate({date}, {$set}, {upsert:true})
 * semantics with a unique key on `date`, mirroring the MongoDB unique index.
 */
class FakeEntryStore implements EntryStore {
  docs = new Map<string, Record<string, unknown>>();

  async findOneAndUpdate(
    filter: { date: string },
    update: { $set: DailyEntry },
    options: { upsert: boolean; new: boolean }
  ): Promise<Record<string, unknown> | null> {
    const existing = this.docs.get(filter.date);
    if (existing) {
      const updated = { ...existing, ...update.$set };
      this.docs.set(filter.date, updated);
      return options.new ? updated : existing;
    }
    if (!options.upsert) return null;
    const created = { ...update.$set };
    this.docs.set(filter.date, created);
    return created;
  }
}

function entry(date: string, fields: Partial<DailyEntry>): DailyEntry {
  return {
    date,
    weightKg: null,
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    fiberG: null,
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

describe('upsertEntry (one entry per date)', () => {
  it('saving the same date twice updates the record instead of duplicating it', async () => {
    const store = new FakeEntryStore();

    await upsertEntry(store, entry('2026-08-09', { weightKg: 63.4 }));
    const second = (await upsertEntry(
      store,
      entry('2026-08-09', { weightKg: 63.7, calories: 2015 })
    )) as Record<string, unknown>;

    expect(store.docs.size).toBe(1); // no duplicate
    expect(second.weightKg).toBe(63.7);
    expect(second.calories).toBe(2015);
  });

  it('creates separate records for different dates', async () => {
    const store = new FakeEntryStore();
    await upsertEntry(store, entry('2026-08-08', { weightKg: 63.4 }));
    await upsertEntry(store, entry('2026-08-09', { weightKg: 63.5 }));
    expect(store.docs.size).toBe(2);
  });
});
