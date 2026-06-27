import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useLogout, useMe } from '../services/auth';
import { Avatar } from './Avatar';

const NAV = [
  { to: '/search', label: 'Search' },
  { to: '/books', label: 'Books' },
  { to: '/music', label: 'Music' },
  { to: '/audiobooks', label: 'Audiobooks' },
  { to: '/podcasts', label: 'Podcasts' },
  { to: '/wishlist', label: 'Wishlist' },
];

/**
 * Authenticated application shell: a top app bar with the brand, primary
 * category navigation (FR-002), the signed-in user, and sign-out. Renders the
 * active route's content in the main region.
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
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'app-nav__link app-nav__link--active' : 'app-nav__link'
                }
              >
                {item.label}
              </NavLink>
            ))}
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
              <span className="material-symbols-outlined" aria-hidden="true">
                logout
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}
