import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import { formatMedium } from '../utils/dates';
import { fmtGrams, fmtKcal, fmtKg } from '../utils/format';
import pageStyles from '../styles/page.module.scss';
import styles from './HistoryPage.module.scss';

export function HistoryPage() {
  const entries = useApi(() => api.listEntries(), []);
  const navigate = useNavigate();
  const { toast, show } = useToast();

  const remove = async (date: string) => {
    if (!window.confirm(`Delete the entry for ${formatMedium(date)}? This cannot be undone.`)) {
      return;
    }
    await api.deleteEntry(date);
    show('Entry deleted');
    entries.reload();
  };

  const sorted = [...(entries.data ?? [])].sort((a, b) => (a.date > b.date ? -1 : 1));

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.pageHeader}>
        <h1>History</h1>
        <p className="muted">Tap a day to edit its weigh-in, or the calories to edit its food.</p>
      </div>

      {entries.error && <div className={pageStyles.error}>{entries.error}</div>}
      {entries.loading && <div className={pageStyles.loading}>Loading…</div>}
      {!entries.loading && sorted.length === 0 && (
        <div className="card">No entries yet — log your first day from the Log tab.</div>
      )}

      <ul className={styles.list}>
        {sorted.map((entry) => (
          <li key={entry.date} className={`card ${styles.row}`}>
            <button
              type="button"
              className={styles.rowMain}
              onClick={() => navigate(`/weigh?date=${entry.date}`)}
            >
              <span className={styles.date}>{formatMedium(entry.date)}</span>
              <span className={styles.values}>
                <span className={styles.value}>{fmtKg(entry.weightKg)}</span>
                <span className={styles.valueMinor}>
                  {entry.proteinG != null ? `P ${fmtGrams(entry.proteinG)}` : ''}
                </span>
                <span className={styles.valueMinor}>
                  {entry.trained === true ? '🏋 trained' : ''}
                </span>
              </span>
              {entry.notes && <span className={styles.notes}>{entry.notes}</span>}
            </button>
            <button
              type="button"
              className={styles.foodCell}
              aria-label={`Edit food for ${formatMedium(entry.date)}`}
              onClick={() => navigate(`/food?date=${entry.date}`)}
            >
              <span className={styles.value}>{fmtKcal(entry.calories)}</span>
              {entry.meals.length > 0 && (
                <span className={styles.mealCount}>
                  {entry.meals.length} meal{entry.meals.length === 1 ? '' : 's'}
                </span>
              )}
            </button>
            <button
              type="button"
              className={styles.delete}
              aria-label={`Delete entry for ${formatMedium(entry.date)}`}
              onClick={() => void remove(entry.date)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {toast}
    </div>
  );
}
