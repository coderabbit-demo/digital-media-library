import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileDTO } from '@dml/shared';
import { ApiError, API_BASE_URL, apiFetch } from './api';

export const ME_QUERY_KEY = ['me'] as const;

/**
 * Full URL that begins the Google OIDC sign-in flow. The browser is navigated
 * here (a full-page redirect) so Google's consent screen can take over.
 */
export function loginUrl(): string {
  return `${API_BASE_URL}/auth/google/login`;
}

/** Trigger a full-page redirect to begin Google sign-in. */
export function redirectToLogin(): void {
  window.location.assign(loginUrl());
}

/**
 * Resolves the current user's profile. A 401 is treated as a normal
 * "unauthenticated" state (data === null) rather than an error, so callers can
 * branch on auth status without try/catch.
 */
export function useMe() {
  return useQuery<ProfileDTO | null>({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      try {
        return await apiFetch<ProfileDTO>('/me');
      } catch (err) {
        if (err instanceof ApiError && err.isUnauthenticated) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 30_000,
    retry: false,
  });
}

/** Ends the session server-side, then clears cached auth/feed state. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      queryClient.setQueryData(ME_QUERY_KEY, null);
      await queryClient.invalidateQueries();
    },
  });
}
