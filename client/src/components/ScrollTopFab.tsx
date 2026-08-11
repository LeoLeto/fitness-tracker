import { useEffect, useState } from 'react';
import styles from './ScrollTopFab.module.scss';

/** Far enough down that the button can't cover content you're still reading. */
const SHOW_AFTER_PX = 400;

/**
 * Floating "back to top" button for the long pages (a day of meals, a workout
 * with many exercises). Sits above the toast line so an undo action is never
 * hidden behind it.
 */
export function ScrollTopFab() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  const toTop = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <button type="button" className={styles.fab} aria-label="Scroll to top" onClick={toTop}>
      <span aria-hidden="true">↑</span>
    </button>
  );
}
