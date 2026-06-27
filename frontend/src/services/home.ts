import { useQuery } from '@tanstack/react-query';
import type { HomeData } from '@dml/shared';
import { apiFetch } from './api';

export const HOME_QUERY_KEY = ['home'] as const;

/**
 * Loads the aggregated, local-only home payload (own items + counts +
 * recommendations) from `GET /api/home`. The community feed is loaded separately
 * by `useFeed`; both are local DB-backed calls (no external providers).
 */
export function useHome() {
  return useQuery<HomeData>({
    queryKey: HOME_QUERY_KEY,
    queryFn: () => apiFetch<HomeData>('/home'),
    staleTime: 10_000,
  });
}
