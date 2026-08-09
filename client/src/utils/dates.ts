/** Plain "YYYY-MM-DD" calendar-date helpers (UTC-midnight arithmetic, DST-safe). */

export function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayDiff(a: string, b: string): number {
  return Math.round((parseDateUTC(b).getTime() - parseDateUTC(a).getTime()) / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Aug 3" */
export function formatShort(dateStr: string): string {
  const d = parseDateUTC(dateStr);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Mon, Aug 3" */
export function formatMedium(dateStr: string): string {
  const d = parseDateUTC(dateStr);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Aug 3, 2026" */
export function formatLong(dateStr: string): string {
  const d = parseDateUTC(dateStr);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export interface RangePreset {
  key: string;
  label: string;
  days: number | null; // null → custom
}

export const RANGE_PRESETS: RangePreset[] = [
  { key: '7d', label: '7d', days: 7 },
  { key: '14d', label: '14d', days: 14 },
  { key: '28d', label: '28d', days: 28 },
  { key: '3m', label: '3m', days: 90 },
  { key: '6m', label: '6m', days: 180 },
  { key: '1y', label: '1y', days: 365 },
  { key: 'custom', label: 'Custom', days: null },
];

export const DEFAULT_PRESET = '28d';

export function rangeForPreset(days: number, to: string = todayStr()): { from: string; to: string } {
  return { from: addDays(to, -(days - 1)), to };
}

/** Every calendar day from `from` to `to` inclusive. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}
