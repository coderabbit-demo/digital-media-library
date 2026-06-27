import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LibraryItemDTO, LibraryPageDTO, MediaType, Shelf, TrendingItemDTO } from '@dml/shared';
import { apiFetch } from './api';
import { HOME_QUERY_KEY } from './home';

export const LIBRARY_QUERY_KEY = ['library'] as const;

/** Generic shelf labels for the all-media shelf navigation (Goodreads wording). */
export const SHELF_TAB_LABELS: Record<Shelf, string> = {
  want: 'Want to Read',
  current: 'Currently Reading',
  done: 'Read',
  dnf: 'Did Not Finish',
};

/** Media-aware shelf label for a specific item (e.g. "Want to Listen" for music). */
export function shelfLabel(shelf: Shelf, mediaType: MediaType): string {
  const reads = mediaType === 'book';
  switch (shelf) {
    case 'want':
      return reads ? 'Want to Read' : 'Want to Listen';
    case 'current':
      return reads ? 'Currently Reading' : 'Currently Listening';
    case 'done':
      return reads ? 'Read' : 'Listened';
    case 'dnf':
      return 'Did Not Finish';
  }
}

/** Stable membership key for an item (matches the server's uniqueness). */
export function libraryKey(item: { mediaType: MediaType; providerId: string }): string {
  return `${item.mediaType}:${item.providerId}`;
}

/** The current user's library, optionally filtered by shelf and/or media type. */
export function useLibrary(opts: { shelf?: Shelf; mediaType?: MediaType } = {}) {
  const params = new URLSearchParams();
  if (opts.shelf) params.set('shelf', opts.shelf);
  if (opts.mediaType) params.set('mediaType', opts.mediaType);
  const qs = params.toString();
  return useQuery<LibraryPageDTO>({
    queryKey: [...LIBRARY_QUERY_KEY, opts.shelf ?? 'all', opts.mediaType ?? 'all'],
    queryFn: () => apiFetch<LibraryPageDTO>(`/library${qs ? `?${qs}` : ''}`),
    staleTime: 30_000,
  });
}

/** Set of membership keys from the full library, for "in your library" badges. */
export function useLibraryKeys(): Set<string> {
  const { data } = useLibrary();
  return new Set((data?.items ?? []).map((i) => libraryKey(i)));
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEY });
}

/** Add a media item to the library (defaults to Want to Read; idempotent server-side). */
export function useAddToLibrary() {
  const queryClient = useQueryClient();
  return useMutation<LibraryItemDTO, Error, { item: TrendingItemDTO; shelf?: Shelf }>({
    mutationFn: ({ item, shelf }) =>
      apiFetch<LibraryItemDTO>('/library', {
        method: 'POST',
        body: {
          mediaType: item.mediaType,
          title: item.title,
          creator: item.creator,
          coverUrl: item.coverUrl,
          providerId: item.providerId,
          ...(shelf ? { shelf } : {}),
        },
      }),
    onSuccess: () => invalidate(queryClient),
  });
}

/** Move a library item to a different shelf. */
export function useMoveShelf() {
  const queryClient = useQueryClient();
  return useMutation<LibraryItemDTO, Error, { id: string; shelf: Shelf }>({
    mutationFn: ({ id, shelf }) =>
      apiFetch<LibraryItemDTO>(`/library/${id}`, { method: 'PATCH', body: { shelf } }),
    onSuccess: () => invalidate(queryClient),
  });
}

/** Remove an item from the library by id. */
export function useRemoveFromLibrary() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiFetch<void>(`/library/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(queryClient),
  });
}
