import { describe, expect, it } from 'vitest';
import { parseDecimal, sanitizeNumeric } from '../src/utils/numeric';

describe('sanitizeNumeric — decimal fields', () => {
  it('keeps a comma, which is what phone keypads offer in comma-decimal locales', () => {
    // The bug this guards: `<input type="number">` discards "," outright, so
    // decimals were impossible to type on an es-CL keypad.
    expect(sanitizeNumeric('63,4', true)).toBe('63,4');
  });

  it('keeps a period just the same', () => {
    expect(sanitizeNumeric('63.4', true)).toBe('63.4');
  });

  it('allows a trailing separator so "63," can still be typed through', () => {
    expect(sanitizeNumeric('63,', true)).toBe('63,');
  });

  it('keeps only the first separator', () => {
    expect(sanitizeNumeric('63,4.2', true)).toBe('63,42');
    expect(sanitizeNumeric('1.2.3', true)).toBe('1.23');
  });

  it('strips letters and symbols, including pasted text', () => {
    expect(sanitizeNumeric('63.4 kg', true)).toBe('63.4');
    expect(sanitizeNumeric('abc', true)).toBe('');
    expect(sanitizeNumeric('-63.4', true)).toBe('63.4'); // no negative weights
  });
});

describe('sanitizeNumeric — integer fields', () => {
  it('removes separators entirely so "2,015" reads as 2015', () => {
    expect(sanitizeNumeric('2,015', false)).toBe('2015');
    expect(sanitizeNumeric('2.015', false)).toBe('2015');
  });

  it('keeps plain digits', () => {
    expect(sanitizeNumeric('2015', false)).toBe('2015');
  });
});

describe('parseDecimal', () => {
  it('accepts either separator', () => {
    expect(parseDecimal('63,4')).toBe(63.4);
    expect(parseDecimal('63.4')).toBe(63.4);
  });

  it('returns null for an empty field (not recorded), never 0', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
  });

  it('returns undefined for unusable input so callers can show an error', () => {
    expect(parseDecimal('abc')).toBeUndefined();
    expect(parseDecimal('6,3,4')).toBeUndefined();
  });

  it('parses integers and a bare zero', () => {
    expect(parseDecimal('2015')).toBe(2015);
    expect(parseDecimal('0')).toBe(0);
  });
});
