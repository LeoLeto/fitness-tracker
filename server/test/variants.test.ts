import { describe, expect, it } from 'vitest';
import { defaultVariant, normalizeVariant, perfKey, sameVariant } from '../src/workouts/variants';

describe('perfKey', () => {
  it('separates the variants of one movement', () => {
    expect(perfKey('Low row machine', 'Cable')).not.toBe(
      perfKey('Low row machine', 'Chest supported')
    );
  });

  it('ignores case and surrounding space, so one machine is never two histories', () => {
    expect(perfKey('Low row machine', 'Cable')).toBe(perfKey('  low row MACHINE ', ' cable '));
  });

  // Exercises with only one form must key exactly as they did before variants
  // existed, or every one of them would look brand new.
  it('treats null, undefined and "" as the same absent variant', () => {
    expect(perfKey('Pull-ups', null)).toBe(perfKey('Pull-ups', undefined));
    expect(perfKey('Pull-ups', null)).toBe(perfKey('Pull-ups', '  '));
  });
});

describe('normalizeVariant / sameVariant', () => {
  it('compares loosely', () => {
    expect(normalizeVariant(' Chest Supported ')).toBe('chest supported');
    expect(sameVariant('Cable', 'cable')).toBe(true);
    expect(sameVariant('Cable', 'Chest supported')).toBe(false);
    expect(sameVariant(null, '')).toBe(true);
  });
});

describe('defaultVariant', () => {
  it('opens on the machine used last time — a run on one is the norm', () => {
    expect(defaultVariant(['Cable', 'Chest supported'], 'chest supported')).toBe(
      'Chest supported'
    );
  });

  it('falls back to the default form when last time says nothing usable', () => {
    expect(defaultVariant(['Cable', 'Chest supported'], null)).toBe('Cable');
    // A variant dropped from the catalog must not linger as the selection.
    expect(defaultVariant(['Cable', 'Chest supported'], 'Barbell')).toBe('Cable');
  });

  it('stays null for an exercise with only one form', () => {
    expect(defaultVariant([], 'Cable')).toBeNull();
    expect(defaultVariant(undefined, null)).toBeNull();
  });
});
