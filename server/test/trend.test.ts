import { describe, expect, it } from 'vitest';
import { weightTrend } from '../src/analytics/trend';

describe('weightTrend (linear regression)', () => {
  it('computes the slope from evenly spaced measurements', () => {
    // +0.2 kg every 7 days → +0.2 kg/week exactly.
    const trend = weightTrend([
      { date: '2026-01-01', weightKg: 63.0 },
      { date: '2026-01-08', weightKg: 63.2 },
      { date: '2026-01-15', weightKg: 63.4 },
    ]);
    expect(trend).not.toBeNull();
    expect(trend!.kgPerWeek).toBeCloseTo(0.2, 10);
    expect(trend!.kgPerDay).toBeCloseTo(0.2 / 7, 10);
    expect(trend!.count).toBe(3);
    expect(trend!.spanDays).toBe(14);
  });

  it('uses actual dates: the same weights over a longer span give a smaller slope', () => {
    const oneWeek = weightTrend([
      { date: '2026-01-01', weightKg: 63.0 },
      { date: '2026-01-08', weightKg: 63.1 },
    ]);
    const twoWeeks = weightTrend([
      { date: '2026-01-01', weightKg: 63.0 },
      { date: '2026-01-15', weightKg: 63.1 },
    ]);
    expect(oneWeek!.kgPerWeek).toBeCloseTo(0.1, 10);
    expect(twoWeeks!.kgPerWeek).toBeCloseTo(0.05, 10);
  });

  it('handles unevenly spaced measurements (gaps between weigh-ins)', () => {
    // Points exactly on the line y = 63 + 0.05x (x in days) with uneven gaps.
    const trend = weightTrend([
      { date: '2026-01-01', weightKg: 63.0 },
      { date: '2026-01-03', weightKg: 63.1 },
      { date: '2026-01-10', weightKg: 63.45 },
      { date: '2026-01-21', weightKg: 64.0 },
    ]);
    expect(trend!.kgPerDay).toBeCloseTo(0.05, 10);
    expect(trend!.kgPerWeek).toBeCloseTo(0.35, 10);
  });

  it('does not overreact to one unusual weigh-in', () => {
    // Essentially flat weight with one high outlier mid-series: the fitted
    // trend stays near zero instead of chasing the spike.
    const trend = weightTrend([
      { date: '2026-01-01', weightKg: 63.5 },
      { date: '2026-01-02', weightKg: 63.4 },
      { date: '2026-01-03', weightKg: 63.5 },
      { date: '2026-01-04', weightKg: 63.6 },
      { date: '2026-01-05', weightKg: 64.4 }, // outlier weigh-in
      { date: '2026-01-06', weightKg: 63.4 },
      { date: '2026-01-07', weightKg: 63.5 },
      { date: '2026-01-08', weightKg: 63.5 },
      { date: '2026-01-09', weightKg: 63.5 },
    ]);
    expect(Math.abs(trend!.kgPerWeek)).toBeLessThan(0.05);
  });

  it('returns null with fewer than 2 measurements or a zero-day span', () => {
    expect(weightTrend([])).toBeNull();
    expect(weightTrend([{ date: '2026-01-01', weightKg: 63.0 }])).toBeNull();
    expect(
      weightTrend([
        { date: '2026-01-01', weightKg: 63.0 },
        { date: '2026-01-01', weightKg: 63.5 },
      ])
    ).toBeNull();
  });
});
