import { useQuery } from '@tanstack/react-query';
import type { DiscoverCategory, DiscoverPageDTO } from '@dml/shared';
import { apiFetch } from './api';

/** Trending items for a category, from the cached, provider-backed Discover endpoint. */
export function useDiscover(category: DiscoverCategory) {
  return useQuery<DiscoverPageDTO>({
    queryKey: ['discover', category],
    queryFn: () => apiFetch<DiscoverPageDTO>(`/discover/${category}`),
    staleTime: 60_000,
  });
}
