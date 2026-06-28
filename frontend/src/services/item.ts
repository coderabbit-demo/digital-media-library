import { useQuery } from '@tanstack/react-query';
import type { ItemPageDTO, MediaType } from '@dml/shared';
import { apiFetch, ApiError } from './api';

/** Base query key for an item detail page; suffixed with (mediaType, providerId). */
export const ITEM_QUERY_KEY = ['item'] as const;

export function itemQueryKey(mediaType: string, providerId: string) {
  return [...ITEM_QUERY_KEY, mediaType, providerId] as const;
}

/**
 * Item detail page payload (feature 007): provider detail + community stats.
 * A 404 (unknown item) is surfaced as the query error so the page can render a
 * not-found state; other errors retry once via the default client config.
 */
export function useItem(mediaType: MediaType, providerId: string) {
  return useQuery<ItemPageDTO, ApiError>({
    queryKey: itemQueryKey(mediaType, providerId),
    queryFn: () =>
      apiFetch<ItemPageDTO>(`/items/${mediaType}/${encodeURIComponent(providerId)}`),
    staleTime: 30_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });
}
