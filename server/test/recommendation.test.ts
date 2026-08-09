import { describe, expect, it } from 'vitest';
import {
  buildRecommendation,
  classifyTrend,
  insufficiencyReasons,
} from '../src/analytics/recommendation';

describe('classifyTrend (target 0.2, tolerance 0.1)', () => {
  it('classifies below / on-target / above with the spec thresholds', () => {
    expect(classifyTrend(0.05, 0.2)).toBe('below');
    expect(classifyTrend(0.1, 0.2)).toBe('on-target'); // boundary is inclusive
    expect(classifyTrend(0.2, 0.2)).toBe('on-target');
    expect(classifyTrend(0.3, 0.2)).toBe('on-target');
    expect(classifyTrend(0.31, 0.2)).toBe('above');
    expect(classifyTrend(-0.1, 0.2)).toBe('below');
  });
});

describe('data sufficiency', () => {
  it('accepts 14+ days, 8+ weigh-ins, 10+ calorie days', () => {
    expect(
      insufficiencyReasons({ spanDays: 14, weightMeasurements: 8, calorieDays: 10 })
    ).toEqual([]);
  });

  it('reports every unmet requirement', () => {
    const reasons = insufficiencyReasons({ spanDays: 6, weightMeasurements: 3, calorieDays: 4 });
    expect(reasons).toHaveLength(3);
  });
});

describe('buildRecommendation', () => {
  const enough = { spanDays: 21, weightMeasurements: 12, calorieDays: 18 };

  it('refuses to conclude from insufficient data', () => {
    const rec = buildRecommendation(
      { spanDays: 6, weightMeasurements: 3, calorieDays: 4 },
      0.5, // even with an extreme trend...
      0.2
    );
    expect(rec.sufficient).toBe(false);
    expect(rec.status).toBeNull();
    expect(rec.message).toContain('Not enough data');
  });

  it('recommends increasing intake when trending below target', () => {
    const rec = buildRecommendation(enough, 0.05, 0.2);
    expect(rec.status).toBe('below');
    expect(rec.message).toContain('increasing intake by ~100–150 kcal/day');
  });

  it('recommends keeping intake when on target', () => {
    const rec = buildRecommendation(enough, 0.2, 0.2);
    expect(rec.status).toBe('on-target');
    expect(rec.message).toContain('Keep intake unchanged');
  });

  it('recommends reducing intake when trending above target', () => {
    const rec = buildRecommendation(enough, 0.45, 0.2);
    expect(rec.status).toBe('above');
    expect(rec.message).toContain('reducing intake by ~100–150 kcal/day');
  });
});
