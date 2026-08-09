import { TrendStatus } from '../types';

/** Weight always shown with one decimal ("63.7 kg"). */
export function fmtKg(v: number | null | undefined, decimals = 1): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals)} kg`;
}

/** Calories rounded to whole kcal with a thousands separator. */
export function fmtKcal(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Math.round(v).toLocaleString('en-US')} kcal`;
}

export function fmtGrams(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Math.round(v)} g`;
}

/** "+0.17 kg/week" — always signed. */
export function fmtTrend(kgPerWeek: number | null | undefined, decimals = 2): string {
  if (kgPerWeek == null) return '—';
  const sign = kgPerWeek >= 0 ? '+' : '';
  return `${sign}${kgPerWeek.toFixed(decimals)} kg/week`;
}

export function fmtGramsPerWeek(kgPerWeek: number | null | undefined): string {
  if (kgPerWeek == null) return '—';
  const g = Math.round(kgPerWeek * 1000);
  return `${g >= 0 ? '+' : ''}${g} g/week`;
}

export const STATUS_LABEL: Record<TrendStatus, string> = {
  below: 'Below target',
  'on-target': 'On target',
  above: 'Above target',
};

/** "(4 measurements)" / "(10 recorded days)" style data-count note. */
export function countNote(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
