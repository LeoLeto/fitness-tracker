import { describe, expect, it } from 'vitest';
import { cardioSummary, fmtDuration, paceMinPerKm } from '../src/workouts/cardio';

describe('cardio formatting', () => {
  it('formats fractional minutes as a clock', () => {
    expect(fmtDuration(32.25)).toBe('32:15');
    expect(fmtDuration(5)).toBe('5:00');
    expect(fmtDuration(75.5)).toBe('1:15:30');
    // 6.45 min/km is 6:27, not 6:45 — the whole point of storing minutes.
    expect(fmtDuration(6.45)).toBe('6:27');
  });

  it('only computes a pace when both time and distance are known', () => {
    expect(paceMinPerKm(30, 5)).toBe(6);
    expect(paceMinPerKm(30, null)).toBeNull();
    expect(paceMinPerKm(null, 5)).toBeNull();
    expect(paceMinPerKm(30, 0)).toBeNull();
  });

  it('summarises whatever was logged', () => {
    expect(cardioSummary({ cardioType: 'treadmill', durationMin: 30, distanceKm: 5 })).toBe(
      'treadmill · 30:00 · 5.00 km · 6:00/km'
    );
    expect(cardioSummary({ cardioType: 'bike', durationMin: 45, distanceKm: null })).toBe(
      'bike · 45:00'
    );
    expect(cardioSummary({ cardioType: null, durationMin: null, distanceKm: null })).toBe('cardio');
  });
});
