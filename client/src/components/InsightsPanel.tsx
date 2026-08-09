import { BAND_LABEL } from './charts/TimelineCharts';
import { TimelinePayload } from '../types';
import { formatShort } from '../utils/dates';
import { fmtTrend } from '../utils/format';
import { routineLabel } from '../utils/workouts';
import styles from './InsightsPanel.module.scss';

const EVENT_ICON: Record<string, string> = {
  'training-gap-ended': '🔁',
  'fluid-retention-spike': '💧',
  'recurring-pain': '🚨',
  'weight-spike': '⚠',
};

/**
 * Plain-language findings from the rules engine: energy-balance periods with
 * the strength change measured inside each one, plus detected events
 * (gaps/resumptions, water-weight spikes, recurring pain).
 */
export function InsightsPanel({ data }: { data: TimelinePayload }) {
  const bands = [...data.bands].reverse(); // most recent first
  const events = [...data.events].reverse();

  if (bands.length === 0 && events.length === 0) {
    return (
      <p className="muted">
        No insights yet — they appear as weight measurements and workouts accumulate.
      </p>
    );
  }

  return (
    <div className={styles.panel}>
      {events.length > 0 && (
        <ul className={styles.events}>
          {events.map((event) => (
            <li key={`${event.date}-${event.kind}`} className={styles.event}>
              <span className={styles.eventIcon} aria-hidden="true">
                {EVENT_ICON[event.kind] ?? '•'}
              </span>
              <div>
                <div className={styles.eventTitle}>
                  {event.title}
                  <span className={styles.eventDate}> · {formatShort(event.date)}</span>
                </div>
                <p className={styles.eventDetail}>{event.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {bands.length > 0 && (
        <div className={styles.bands}>
          <h3>Energy-balance periods (inferred from weight trend)</h3>
          {bands.map((band) => {
            const strength = Object.entries(band.strengthChangePct);
            return (
              <div key={`${band.from}-${band.kind}`} className={styles.band}>
                <div className={styles.bandHeader}>
                  <span className={`${styles.bandKind} ${styles[bandClass(band.kind)]}`}>
                    {BAND_LABEL[band.kind]}
                  </span>
                  <span className={styles.bandRange}>
                    {formatShort(band.from)} – {formatShort(band.to)}
                  </span>
                  <span className={styles.bandTrend}>{fmtTrend(band.trendKgPerWeek)}</span>
                </div>
                {strength.length > 0 && (
                  <div className={styles.strengthRow}>
                    <span className={styles.strengthLabel}>Strength during this period:</span>
                    {strength.map(([routine, pct]) => (
                      <span
                        key={routine}
                        className={`${styles.strengthChip} ${
                          pct <= -3 ? styles.down : pct >= 3 ? styles.up : ''
                        }`}
                      >
                        {routineLabel(routine)} {pct >= 0 ? '+' : ''}
                        {pct.toFixed(1)}%
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <p className={styles.footnote}>
            Deficit + falling strength is expected during a cut; a fast weight jump right after
            resuming a muscle group is mostly fluid, not fat.
          </p>
        </div>
      )}
    </div>
  );
}

function bandClass(kind: string): string {
  if (kind.includes('deficit')) return 'kindDeficit';
  if (kind.includes('surplus')) return 'kindSurplus';
  return 'kindMaintenance';
}
