import { NavLink, Outlet, useLocation } from 'react-router-dom';
import styles from './Layout.module.scss';

const DESKTOP_NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/weigh', label: 'Weigh-in' },
  { to: '/food', label: 'Food' },
  { to: '/train', label: 'Train' },
  { to: '/history', label: 'History' },
  { to: '/weekly', label: 'Weekly Review' },
  { to: '/analysis', label: 'Analysis' },
  { to: '/export', label: 'Export' },
  { to: '/settings', label: 'Settings' },
];

const MOBILE_TABS = [
  { to: '/', label: 'Home', icon: '◫' },
  { to: '/weigh', label: 'Weigh', icon: '⚖' },
  { to: '/food', label: 'Food', icon: '🍽' },
  { to: '/train', label: 'Train', icon: '🏋' },
  { to: '/analysis', label: 'Stats', icon: '∿' },
  { to: '/more', label: 'More', icon: '⋯' },
];

// The "More" tab hosts these — keep it highlighted while inside any of them.
const MORE_PATHS = ['/history', '/weekly', '/export', '/settings', '/foods'];

export function Layout() {
  const location = useLocation();
  const inMoreSection = MORE_PATHS.some((p) => location.pathname.startsWith(p));

  return (
    <div className={styles.shell}>
      {/* Desktop only — on mobile the bottom tabs are the whole navigation. */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
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
