import { ReactNode } from 'react';
import styles from './StatCard.module.scss';

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Data-amount note, e.g. "4 measurements". */
  sub?: ReactNode;
  badge?: ReactNode;
}

export function StatCard({ label, value, sub, badge }: StatCardProps) {
  return (
    <div className={`card ${styles.stat}`}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {(sub || badge) && (
        <div className={styles.footer}>
          {sub && <span className={styles.sub}>{sub}</span>}
          {badge}
        </div>
      )}
    </div>
  );
}
