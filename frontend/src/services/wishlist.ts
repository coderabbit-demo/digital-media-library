import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaType, TrendingItemDTO, WishlistItemDTO, WishlistPageDTO } from '@dml/shared';
import { apiFetch } from './api';
import { HOME_QUERY_KEY } from './home';

export const WISHLIST_QUERY_KEY = ['wishlist'] as const;

/** Stable membership key for an item (matches the server's uniqueness). */
export function wishlistKey(item: { mediaType: MediaType; providerId: string }): string {
  return `${item.mediaType}:${item.providerId}`;
}

/** The current user's wishlist, optionally filtered by media type. */
export function useWishlist(mediaType?: MediaType) {
  return useQuery<WishlistPageDTO>({
    queryKey: [...WISHLIST_QUERY_KEY, mediaType ?? 'all'],
    queryFn: () => apiFetch<WishlistPageDTO>(`/wishlist${mediaType ? `?mediaType=${mediaType}` : ''}`),
    staleTime: 30_000,
  });
}

/** Set of membership keys from the full (unfiltered) wishlist, for "saved" badges. */
export function useWishlistKeys(): Set<string> {
  const { data } = useWishlist();
  return new Set((data?.items ?? []).map((i) => wishlistKey(i)));
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEY });
}

/** Add a media item to the wishlist (idempotent server-side). */
export function useAddToWishlist() {
  const queryClient = useQueryClient();
  return useMutation<WishlistItemDTO, Error, TrendingItemDTO>({
    mutationFn: (item) =>
      apiFetch<WishlistItemDTO>('/wishlist', {
        method: 'POST',
        body: {
          mediaType: item.mediaType,
          title: item.title,
          creator: item.creator,
          coverUrl: item.coverUrl,
          providerId: item.providerId,
        },
      }),
    onSuccess: () => invalidate(queryClient),
  });
}

/** Remove an item from the wishlist by id. */
export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiFetch<void>(`/wishlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(queryClient),
  });
}
