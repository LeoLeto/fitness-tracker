/**
 * Cardio formatting. Durations are stored as fractional minutes (32.25 =
 * 32:15) because that's what sums cleanly into weekly totals; these helpers
 * turn them back into what the treadmill display showed.
 */

/** 32.25 → "32:15"; 75.5 → "1:15:30". */
export function fmtDuration(min: number): string {
  const totalSec = Math.round(min * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Pace in minutes per km, or null when either side is missing or zero. */
export function paceMinPerKm(durationMin: number | null, distanceKm: number | null): number | null {
  if (durationMin == null || distanceKm == null || durationMin <= 0 || distanceKm <= 0) return null;
  return durationMin / distanceKm;
}

/** "treadmill · 32:15 · 5.00 km · 6:27/km" — whatever of it is known. */
export function cardioSummary(w: {
  cardioType: string | null;
  durationMin: number | null;
  distanceKm: number | null;
}): string {
  const parts = [w.cardioType ?? 'cardio'];
  if (w.durationMin != null) parts.push(fmtDuration(w.durationMin));
  if (w.distanceKm != null) parts.push(`${w.distanceKm.toFixed(2)} km`);
  const pace = paceMinPerKm(w.durationMin, w.distanceKm);
  if (pace != null) parts.push(`${fmtDuration(pace)}/km`);
  return parts.join(' · ');
}
