import { ReactNode } from 'react';
import { addDays, formatMedium, todayStr } from '../utils/dates';
import styles from './DayNav.module.scss';

interface DayNavProps {
  date: string;
  onChange: (date: string) => void;
  /** Small note under the date, e.g. "editing saved entry". */
  hint?: ReactNode;
  /** Link to the same day on a sibling page. */
  sibling?: ReactNode;
}

/** Date picker with prev/next day arrows — shared by Weigh, Food and Train. */
export function DayNav({ date, onChange, hint, sibling }: DayNavProps) {
  const isToday = date === todayStr();
  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Previous day"
          onClick={() => onChange(addDays(date, -1))}
        >
          ‹
        </button>
        <div className={styles.center}>
          <input
            type="date"
            value={date}
            max={todayStr()}
            aria-label="Date"
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className={styles.input}
          />
          <span className={styles.human}>
            {isToday ? 'Today' : formatMedium(date)}
            {hint}
          </span>
        </div>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Next day"
          disabled={isToday}
          onClick={() => onChange(addDays(date, 1))}
        >
          ›
        </button>
      </div>
      {sibling && <div className={styles.sibling}>{sibling}</div>}
    </div>
  );
}
