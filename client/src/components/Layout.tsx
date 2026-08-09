import { NavLink, Outlet, useLocation } from 'react-router-dom';
import styles from './Layout.module.scss';

const DESKTOP_NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/log', label: 'Log' },
  { to: '/train', label: 'Train' },
  { to: '/history', label: 'History' },
  { to: '/weekly', label: 'Weekly Review' },
  { to: '/analysis', label: 'Analysis' },
  { to: '/export', label: 'Export' },
  { to: '/settings', label: 'Settings' },
];

const MOBILE_TABS = [
  { to: '/', label: 'Home', icon: '◫' },
  { to: '/log', label: 'Log', icon: '✎' },
  { to: '/train', label: 'Train', icon: '🏋' },
  { to: '/analysis', label: 'Analysis', icon: '∿' },
  { to: '/more', label: 'More', icon: '⋯' },
];

// The "More" tab hosts these — keep it highlighted while inside any of them.
const MORE_PATHS = ['/more', '/history', '/weekly', '/export', '/settings'];

export function Layout() {
  const location = useLocation();
  const inMoreSection = MORE_PATHS.some(
    (p) => p !== '/more' && location.pathname.startsWith(p)
  );
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>⚖</span> Fitness Tracker
          </span>
          <nav className={styles.desktopNav} aria-label="Main">
            {DESKTOP_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.bottomNav} aria-label="Main">
        {MOBILE_TABS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => {
              const active = isActive || (item.to === '/more' && inMoreSection);
              return active ? `${styles.tab} ${styles.tabActive}` : styles.tab;
            }}
          >
            <span className={styles.tabIcon} aria-hidden="true">
              {item.icon}
            </span>
            <span className={styles.tabLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
