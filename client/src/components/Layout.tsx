import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ScrollTopFab } from './ScrollTopFab';
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

// Only the three things logged daily get a tab of their own; the dashboard and
// the charts are read occasionally and live under "More".
const MOBILE_TABS = [
  { to: '/weigh', label: 'Weigh', icon: '⚖' },
  { to: '/food', label: 'Food', icon: '🍽' },
  { to: '/train', label: 'Train', icon: '🏋' },
  { to: '/more', label: 'More', icon: '⋯' },
];

// The "More" tab hosts these — keep it highlighted while inside any of them.
// '/' is matched exactly: every path starts with it.
const MORE_PATHS = ['/history', '/weekly', '/export', '/settings', '/foods', '/analysis'];

export function Layout() {
  const location = useLocation();
  const inMoreSection =
    location.pathname === '/' || MORE_PATHS.some((p) => location.pathname.startsWith(p));

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

      <ScrollTopFab />

      <nav className={styles.bottomNav} aria-label="Main">
        {MOBILE_TABS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => {
              const active = isActive || (item.to === '/more' && inMoreSection);
              return active ? `${styles.tab} ${styles.tabActive}` : styles.tab;
            }}
          >
            {/* The page title used to be repeated as a heading at the top of
                every page; the tab carries that job on its own now, so it has
                to be unmistakable — filled pill, accent text, top rule. */}
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
