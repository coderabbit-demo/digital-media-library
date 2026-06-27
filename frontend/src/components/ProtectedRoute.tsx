import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '../services/auth';

/**
 * App-wide auth gate (FR-001). While the session is resolving, render a neutral
 * placeholder; once resolved, redirect unauthenticated users to /signin and only
 * then render the protected content. The backend independently enforces auth on
 * every endpoint (401) — this guard prevents authenticated UI from flashing.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <p className="feed-status" role="status">
        Loading…
      </p>
    );
  }

  if (!me) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}
