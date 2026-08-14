import { Link } from 'react-router-dom';
import pageStyles from '../styles/page.module.scss';
import styles from './MorePage.module.scss';

// Home and Stats moved here from the tab bar: they are read now and then, not
// on every session, and the three daily logs deserve the width.
const LINKS = [
  { to: '/', label: 'Home', desc: 'Today at a glance — weight, calories, trend', icon: '◫' },
  { to: '/analysis', label: 'Stats', desc: 'Charts, trend and maintenance estimate', icon: '∿' },
  { to: '/history', label: 'History', desc: 'All daily entries — tap to edit', icon: '☰' },
  { to: '/foods', label: 'Food library', desc: 'Foods, portions and meal templates', icon: '🍽' },
  { to: '/weekly', label: 'Weekly Review', desc: 'Week-by-week summaries', icon: '▤' },
  { to: '/export', label: 'Export', desc: 'CSV, JSON, ChatGPT copy', icon: '⇪' },
  { to: '/settings', label: 'Settings', desc: 'Profile, targets, theme', icon: '⚙' },
];

export function MorePage() {
  return (
    <div className={pageStyles.page}>
      <div className={styles.list}>
        {LINKS.map((link) => (
          <Link key={link.to} to={link.to} className={`card ${styles.item}`}>
            <span className={styles.icon} aria-hidden="true">
              {link.icon}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{link.label}</span>
              <span className={styles.desc}>{link.desc}</span>
            </span>
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
