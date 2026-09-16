import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { TrackingPause } from '../types';
import { dayDiff, formatMedium, todayStr } from '../utils/dates';
import styles from './TrackingPauseCard.module.scss';

/** Inclusive length of a pause; a still-running one is measured up to today. */
function pauseDays(pause: TrackingPause): number {
  return dayDiff(pause.startDate, pause.endDate ?? todayStr()) + 1;
}

function dayCount(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

/**
 * Start and end a tracking pause — a holiday, a trip, any stretch where the
 * food log isn't going to be kept. One tap covers the whole period, which is
 * the point: the alternative is ticking "couldn't log everything" every
 * morning for a fortnight, or letting two weeks of unlogged eating quietly
 * drag the calorie average down.
 *
 * Pause history is kept rather than discarded on resume, because a gap in the
 * calorie log six months from now is unreadable without it.
 */
export function TrackingPauseCard({ onChange }: { onChange?: () => void }) {
  const pauses = useApi(() => api.listPauses(), []);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = pauses.data?.active ?? null;
  const history = (pauses.data?.pauses ?? []).filter((p) => p.endDate !== null);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
      pauses.reload();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      await api.startPause(note.trim());
      setNote('');
    });

  const resume = () => run(() => api.resumeTracking());

  const remove = (pause: TrackingPause) => {
    const span =
      pause.endDate === null
        ? `since ${formatMedium(pause.startDate)}`
        : `${formatMedium(pause.startDate)} – ${formatMedium(pause.endDate)}`;
    if (
      !window.confirm(
        `Delete the pause ${span}? Those ${dayCount(pauseDays(pause))} go straight back into the ` +
          'calorie averages, using whatever was logged on them.'
      )
    ) {
      return;
    }
    void run(() => api.deletePause(pause.id));
  };

  return (
    <section className={`card ${styles.card}`}>
      <h2>Calorie tracking</h2>

      {pauses.loading && !pauses.data && <p className={styles.note}>Loading…</p>}

      {active ? (
        <>
          <div className={styles.statusPaused}>
            <span aria-hidden="true">⏸</span> Paused since {formatMedium(active.startDate)}
            <span className={styles.statusMeta}> · {dayCount(pauseDays(active))} so far</span>
          </div>
          {active.note && <p className={styles.note}>{active.note}</p>}
          <p className={styles.note}>
            These days count for nothing in the calorie and macro averages and draw no bar on the
            chart, so you can leave the food log alone entirely. Weigh-ins and workouts are
            unaffected — log them as usual if you want to.
          </p>
          <p className={styles.note}>
            The maintenance estimate won't run over a period containing these days: your weight
            moved across them and there's no intake recorded to explain it.
          </p>
          <div className={styles.actions}>
            <button type="button" className="btn btn--accent" disabled={busy} onClick={resume}>
              Resume tracking
            </button>
            <button
              type="button"
              className={styles.linkButton}
              disabled={busy}
              onClick={() => remove(active)}
            >
              Started this by mistake?
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.statusOn}>Tracking normally</div>
          <p className={styles.note}>
            Going away? Pause tracking and the days until you resume are left out of every calorie
            and macro average — no logging, and no ticking “couldn't log everything” each morning.
          </p>
          <label className={styles.field}>
            <span>What for? (optional)</span>
            <input
              type="text"
              value={note}
              maxLength={200}
              placeholder="e.g. Italy trip"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button type="button" className="btn btn--accent" disabled={busy} onClick={start}>
              Pause tracking from today
            </button>
          </div>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {history.length > 0 && (
        <details className={styles.history}>
          <summary>Past pauses ({history.length})</summary>
          <ul className={styles.historyList}>
            {history.map((pause) => (
              <li key={pause.id}>
                <span className={styles.historyDates}>
                  {formatMedium(pause.startDate)} – {formatMedium(pause.endDate as string)}
                </span>
                <span className={styles.historyMeta}>
                  {dayCount(pauseDays(pause))}
                  {pause.note ? ` · ${pause.note}` : ''}
                </span>
                <button
                  type="button"
                  className={styles.delete}
                  aria-label={`Delete the pause starting ${formatMedium(pause.startDate)}`}
                  disabled={busy}
                  onClick={() => remove(pause)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
