import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useLogout, useMe } from '../services/auth';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

/** Categories grouped under the "Discover" dropdown. */
const DISCOVER_ITEMS = [
  { to: '/books', label: 'Books' },
  { to: '/music', label: 'Music' },
  { to: '/audiobooks', label: 'Audiobooks' },
  { to: '/podcasts', label: 'Podcasts' },
];

/** "Discover" top-level item: a dropdown of the four media categories. */
function DiscoverMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const active = DISCOVER_ITEMS.some((i) => location.pathname === i.to);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="app-nav__dropdown" ref={ref}>
      <button
        type="button"
        className={active ? 'app-nav__link app-nav__link--active' : 'app-nav__link'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Discover
        <span className="app-nav__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        // A disclosure of plain links (not an ARIA menu), so standard link/tab
        // keyboard behavior applies; Escape and outside-click close it.
        <div className="app-nav__menu">
          {DISCOVER_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'app-nav__menu-item app-nav__menu-item--active' : 'app-nav__menu-item'
              }
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Authenticated application shell: a top app bar with the brand, primary
 * navigation (Home · Discover ▾ · My Library · Search), the signed-in user, and
 * sign-out. Renders the active route's content in the main region.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="app-header__brand">
            Digital Media Library
          </Link>

          <nav className="app-nav" aria-label="Primary">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link'
              }
            >
              Home
            </NavLink>

            <DiscoverMenu />

            <NavLink
              to="/library"
              className={({ isActive }) =>
                isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link'
              }
            >
              My Library
            </NavLink>

            <NavLink
              to="/search"
              aria-label="Search"
              title="Search"
              className={({ isActive }) =>
                isActive ? 'app-nav__link app-nav__link--icon app-nav__link--active' : 'app-nav__link app-nav__link--icon'
              }
            >
              <Icon name="search" />
            </NavLink>
          </nav>

          <div className="app-header__user">
            {me ? <Avatar displayName={me.displayName} avatarUrl={me.avatarUrl} /> : null}
            <button
              type="button"
              className="md3-icon-button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
