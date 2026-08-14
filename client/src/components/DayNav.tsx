import { ReactNode } from 'react';
import { addDays, formatMedium, todayStr } from '../utils/dates';
import styles from './DayNav.module.scss';

interface DayNavProps {
  date: string;
  onChange: (date: string) => void;
  /** Short status shown inline after the date, e.g. "saved". */
  hint?: ReactNode;
}

/**
 * Date picker with prev/next day arrows — shared by Weigh, Food and Train.
 *
 * One line, and nothing else: this sits above the thing you actually came to
 * do, so every extra row it takes is a row of the form pushed off screen.
 */
export function DayNav({ date, onChange, hint }: DayNavProps) {
  const isToday = date === todayStr();
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={styles.arrow}
        aria-label="Previous day"
        onClick={() => onChange(addDays(date, -1))}
      >
        ‹
      </button>

      <label className={styles.center}>
        {/* The native picker sits under the label: tapping the words opens the
            calendar, and the readable date is what's on screen the rest of the
            time — no second line spent restating the ISO value. */}
        <span className={styles.human}>
          {isToday ? 'Today' : formatMedium(date)}
          {hint}
        </span>
        <input
          type="date"
          value={date}
          max={todayStr()}
          aria-label="Date"
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className={styles.input}
        />
      </label>

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
  );
}
