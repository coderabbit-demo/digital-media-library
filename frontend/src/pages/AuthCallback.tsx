import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ME_QUERY_KEY, useMe } from '../services/auth';

/**
 * Landing route after the backend OIDC callback redirects to the SPA. It
 * (re)resolves the session via /me and routes to the home feed on success or
 * back to sign-in (carrying any error indicator) otherwise.
 */
export function AuthCallback() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const errorIndicator = params.get('error');
  const { data: me, isLoading, isFetched } = useMe();

  useEffect(() => {
    // Force a fresh /me read; the cookie was set during the backend redirect.
    void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
  }, [queryClient]);

  if (errorIndicator) {
    return <Navigate to={`/signin?error=${encodeURIComponent(errorIndicator)}`} replace />;
  }

  if (isLoading || !isFetched) {
    return <p className="feed-status" role="status">Finishing sign-in…</p>;
  }

  return <Navigate to={me ? '/' : '/signin?error=session'} replace />;
}
