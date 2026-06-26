import { Navigate } from 'react-router-dom';
import { FeedList } from '../components/FeedList';
import { PostUpdateForm } from '../components/PostUpdateForm';
import { useLogout, useMe } from '../services/auth';

/**
 * Protected home page. Shows the compose form and the feed for authenticated
 * users; unauthenticated visitors are redirected to /signin (FR-005).
 */
export function HomeFeed() {
  const { data: me, isLoading } = useMe();
  const logout = useLogout();

  if (isLoading) {
    return <p className="feed-status" role="status">Loading…</p>;
  }

  if (!me) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="app-header__brand">Digital Media Library</h1>
          <div className="app-header__user">
            <span className="app-header__name">{me.displayName}</span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              {logout.isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <PostUpdateForm />
        <FeedList />
      </main>
    </div>
  );
}
