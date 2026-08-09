import { describe, expect, it } from 'vitest';
import { formatSets, parseSessionLine } from '../src/workouts/notation';

describe('parseSessionLine — basic notation', () => {
  it('parses same-weight sets: "80 x10 x7 x6"', () => {
    const r = parseSessionLine('80 x10 x7 x6');
    expect(r.sets).toHaveLength(3);
    expect(r.sets.map((s) => s.reps)).toEqual([10, 7, 6]);
    expect(r.sets.every((s) => s.weightKg === 80)).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('parses weight changes: "80 x9 x5; 70 x6"', () => {
    const r = parseSessionLine('80 x9 x5; 70 x6');
    expect(r.sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [80, 9],
      [80, 5],
      [70, 6],
    ]);
  });

  it('parses per-set RIR: "90 x7 (2 RIR) x7 (1 RIR) x8 (0 RIR)"', () => {
    const r = parseSessionLine('90 x7 (2 RIR) x7 (1 RIR) x8 (0 RIR)');
    expect(r.sets.map((s) => s.rir)).toEqual([2, 1, 0]);
  });

  it('tolerates RIR typos: "( 3 RIR)", "(? RIR)", "(RIR)", "(3+ RIR)"', () => {
    const r = parseSessionLine('90 x7 ( 3 RIR) x7 (? RIR) x8 (RIR) x9 (3+ RIR)');
    expect(r.sets.map((s) => s.rir)).toEqual([3, null, null, 3]);
  });

  it('parses bodyweight sets: "x8 x5 x5"', () => {
    const r = parseSessionLine('x8 x5 x5', { isBodyweight: true });
    expect(r.sets).toHaveLength(3);
    expect(r.sets.every((s) => s.weightKg === null)).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('parses an explicit BW group: "5 x10 x5; BW x10"', () => {
    const r = parseSessionLine('5 x10 x5; BW x10');
    expect(r.sets.map((s) => s.weightKg)).toEqual([5, 5, null]);
  });
});

describe('parseSessionLine — the flag subtleties', () => {
  it('uncertain reps "x9?"', () => {
    const r = parseSessionLine('90 x9? x6; 80 x6');
    expect(r.sets[0].repsUncertain).toBe(true);
    expect(r.sets[0].reps).toBe(9);
    expect(r.sets[1].repsUncertain).toBe(false);
  });

  it('bad-form asterisk, including markdown-escaped: "30 x7\\*"', () => {
    expect(parseSessionLine('30 x7*').sets[0].badForm).toBe(true);
    expect(parseSessionLine('30 x7\\*').sets[0].badForm).toBe(true);
    expect(parseSessionLine('30 x8 (3 RIR) x8 (1 RIR) x11\\* (0 RIR)').sets[2].badForm).toBe(true);
  });

  it('pain flag, attached or spaced: "45 x2🚨", "x8 🚨"', () => {
    const attached = parseSessionLine('45 x2🚨; 35 x8 (3 RIR) x9 (2 RIR)');
    expect(attached.sets[0].pain).toBe(true);
    expect(attached.sets[0].reps).toBe(2);
    expect(attached.sets[1].pain).toBe(false);

    const spaced = parseSessionLine('10 x12 (2 RIR) x8 🚨 x7 (0 RIR)');
    expect(spaced.sets[1].pain).toBe(true);
  });

  it('keeps 💀 as a note', () => {
    const r = parseSessionLine('35 x2💀; 25 x9 x8 x7');
    expect(r.sets[0].note).toContain('💀');
  });

  it('order swaps: "SO ⬇️ 60 x8", "OS ⬆️ 30 x5"', () => {
    expect(parseSessionLine('SO ⬇️ 60 x8 (1 RIR) x7 (1 RIR)').orderMoved).toBe('down');
    expect(parseSessionLine('OS ⬆️ 30 x5; 25 x8 x7').orderMoved).toBe('up');
    expect(parseSessionLine('60 x8').orderMoved).toBeNull();
  });
});

describe('parseSessionLine — variations, drop sets, oddities', () => {
  it('leading variation text: "(w/step) 65 x9 (2 RIR)"', () => {
    const r = parseSessionLine('(w/step) 65 x9 (2 RIR) x8 (0 RIR); 60 x8 (2 RIR)');
    expect(r.variation).toBe('w/step');
    expect(r.sets).toHaveLength(3);
  });

  it('leading words: "Chest supported 20 x15 (3+ RIR); 30 x12 (2 RIR) x12 (0 RIR)"', () => {
    const r = parseSessionLine('Chest supported 20 x15 (3+ RIR); 30 x12 (2 RIR) x12 (0 RIR)');
    expect(r.variation).toBe('Chest supported');
    expect(r.sets.map((s) => s.weightKg)).toEqual([20, 30, 30]);
  });

  it('drop sets: "DS35x3/30x3; 30 x5; 25 x6"', () => {
    const r = parseSessionLine('DS35x3/30x3; 30 x5; 25 x6');
    expect(r.sets.filter((s) => s.isDropSet)).toHaveLength(2);
    expect(r.sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [35, 3],
      [30, 3],
      [30, 5],
      [25, 6],
    ]);
  });

  it('mid-line notes attach to the preceding set', () => {
    const r = parseSessionLine('10 x8 (w/wristbands) x6 x5 (Regular)');
    expect(r.sets[0].note).toBe('w/wristbands');
    expect(r.sets[2].note).toBe('Regular');
  });

  it('stray suffix letter: "x10 x6 x6R"', () => {
    const r = parseSessionLine('x10 x6 x6R', { isBodyweight: true });
    expect(r.sets[2].note).toBe('R');
  });

  it('skips unknown rep counts with a warning: "20 x8 x?"', () => {
    const r = parseSessionLine('20 x8 x?');
    expect(r.sets).toHaveLength(1);
    expect(r.warnings.some((w) => w.includes('unknown rep count'))).toBe(true);
  });

  it('tolerates an incomplete trailing token: "45 x9 (2 RIR) x"', () => {
    const r = parseSessionLine('45 x9 (2 RIR) x');
    expect(r.sets).toHaveLength(1);
    expect(r.sets[0].rir).toBe(2);
  });

  it('handles misplaced spacing: "10 x6; 5x 9?"', () => {
    const r = parseSessionLine('10 x6; 5x 9?');
    expect(r.sets.map((s) => [s.weightKg, s.reps, s.repsUncertain])).toEqual([
      [10, 6, false],
      [5, 9, true],
    ]);
  });
});

describe('formatSets — round-trips the notation for exports', () => {
  it('groups by weight and keeps flags/RIR', () => {
    const r = parseSessionLine('90 x7 (2 RIR) x7 (1 RIR); 80 x8*');
    expect(formatSets(r.sets)).toBe('90 x7 (2 RIR) x7 (1 RIR); 80 x8*');
  });

  it('renders bodyweight as BW', () => {
    const r = parseSessionLine('x8 x5', { isBodyweight: true });
    expect(formatSets(r.sets)).toBe('BW x8 x5');
  });
});
