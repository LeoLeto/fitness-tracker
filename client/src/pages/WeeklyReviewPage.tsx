import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { formatShort } from '../utils/dates';
import { countNote, fmtGrams, fmtKcal, fmtKg, fmtTrend } from '../utils/format';
import { routineLabel } from '../utils/workouts';
import pageStyles from '../styles/page.module.scss';
import styles from './WeeklyReviewPage.module.scss';

export function WeeklyReviewPage() {
  const weekly = useApi(() => api.getWeekly(), []);

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <h1>Weekly Review</h1>
        <p className="muted">Monday–Sunday weeks, most recent first.</p>
      </div>

      {weekly.error && <div className={pageStyles.error}>{weekly.error}</div>}
      {weekly.loading && <div className={pageStyles.loading}>Loading…</div>}
      {!weekly.loading && (weekly.data?.length ?? 0) === 0 && (
        <div className="card">No data yet — log a few days first.</div>
      )}

      {(weekly.data ?? []).map((week) => (
        <section key={week.weekStart} className={`card ${styles.week}`}>
          <header className={styles.header}>
            <h2>Week of {formatShort(week.weekStart)}</h2>
            {week.changeVsPrevWeekKg != null && (
              <span className={styles.change}>
                {week.changeVsPrevWeekKg >= 0 ? '+' : ''}
                {week.changeVsPrevWeekKg.toFixed(2)} kg vs previous week
              </span>
            )}
          </header>

          <dl className={styles.stats}>
            <div>
              <dt>Average weight</dt>
              <dd>
                {fmtKg(week.avgWeight, 2)}
                <span className={styles.count}> · {countNote(week.weighIns, 'weigh-in')}</span>
              </dd>
            </div>
            <div>
              <dt>Average calories</dt>
              <dd>
                {fmtKcal(week.avgCalories)}
                <span className={styles.count}> · {countNote(week.calorieDays, 'day')}</span>
              </dd>
            </div>
            <div>
              <dt>Protein</dt>
              <dd>
                {week.avgProtein != null ? `${fmtGrams(week.avgProtein)}/day` : '—'}
                {week.proteinDays > 0 && (
                  <span className={styles.count}> · {countNote(week.proteinDays, 'day')}</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Weight trend</dt>
              <dd>
                {week.trendKgPerWeek != null ? (
                  fmtTrend(week.trendKgPerWeek)
                ) : (
                  <span className={styles.count}>needs 3+ weigh-ins</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Training days</dt>
              <dd>{week.trainingDays}</dd>
            </div>
            <div>
              <dt>Sessions</dt>
              <dd>
                {Object.entries(week.sessionsByRoutine).length > 0
                  ? Object.entries(week.sessionsByRoutine)
                      .map(([r, n]) => `${routineLabel(r)} ${n}`)
                      .join(', ')
                  : '—'}
              </dd>
            </div>
            {week.cardioMin > 0 && (
              <div>
                <dt>Cardio</dt>
                <dd>{week.cardioMin} min</dd>
              </div>
            )}
          </dl>

          {week.notes.length > 0 && (
            <ul className={styles.notes}>
              {week.notes.map((note) => (
                <li key={note.date}>
                  <span className={styles.noteDate}>{formatShort(note.date)}</span> {note.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
