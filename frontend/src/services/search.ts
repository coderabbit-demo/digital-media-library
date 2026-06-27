import { useQuery } from '@tanstack/react-query';
import type { DiscoverCategory, SearchPageDTO } from '@dml/shared';
import { apiFetch } from './api';

/**
 * Media search for a category + query, served by the cached, provider-backed
 * search endpoint. Disabled until a non-empty query is provided.
 */
export function useSearch(category: DiscoverCategory, query: string) {
  const trimmed = query.trim();
  return useQuery<SearchPageDTO>({
    queryKey: ['search', category, trimmed],
    queryFn: () =>
      apiFetch<SearchPageDTO>(`/search?category=${category}&q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length > 0,
    staleTime: 60_000,
  });
}
