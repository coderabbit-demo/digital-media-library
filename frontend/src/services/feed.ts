import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type { ActivityDTO, CreateActivityInput, FeedPageDTO, ProfileDTO } from '@dml/shared';
import { FEED_DEFAULT_LIMIT } from '@dml/shared';
import { apiFetch } from './api';
import { ME_QUERY_KEY } from './auth';

export const FEED_QUERY_KEY = ['feed'] as const;

/**
 * Infinite, cursor-paginated global feed (most recent first). Uses the opaque
 * keyset cursor returned as `nextCursor`; a null cursor means no older items.
 */
export function useFeed() {
  return useInfiniteQuery({
    queryKey: FEED_QUERY_KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('cursor', pageParam as string);
      params.set('limit', String(FEED_DEFAULT_LIMIT));
      return apiFetch<FeedPageDTO>(`/feed?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 10_000,
  });
}

type FeedData = InfiniteData<FeedPageDTO>;

/** Flatten infinite-query pages into a single ordered list of activities. */
export function flattenFeed(data: FeedData | undefined): ActivityDTO[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

/**
 * Creates an activity with an optimistic insert at the top of the feed, then
 * reconciles against the server response and invalidates so canonical ordering
 * and `canDelete`/server timestamps win.
 */
export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation<ActivityDTO, Error, CreateActivityInput, { previous?: FeedData }>({
    mutationFn: (input) => apiFetch<ActivityDTO>('/activities', { method: 'POST', body: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY });
      const previous = queryClient.getQueryData<FeedData>(FEED_QUERY_KEY);
      const me = queryClient.getQueryData<ProfileDTO | null>(ME_QUERY_KEY);

      const optimistic: ActivityDTO = {
        id: `optimistic-${Date.now()}`,
        author: {
          id: me?.id ?? 'me',
          displayName: me?.displayName ?? 'You',
          avatarUrl: me?.avatarUrl ?? null,
        },
        mediaType: input.mediaType,
        title: input.title,
        itemAuthor: input.itemAuthor ?? null,
        note: input.note ?? null,
        replyCount: 0,
        coverUrl: input.coverUrl ?? null,
        providerId: input.providerId ?? null,
        description: input.description ?? null,
        providerUrl: input.providerUrl ?? null,
        createdAt: new Date().toISOString(),
        canDelete: true,
      };

      queryClient.setQueryData<FeedData>(FEED_QUERY_KEY, (old) => {
        if (!old || old.pages.length === 0) {
          return {
            pages: [{ items: [optimistic], nextCursor: null }],
            pageParams: [undefined],
          } satisfies FeedData;
        }
        const [first, ...rest] = old.pages;
        if (!first) {
          return {
            pages: [{ items: [optimistic], nextCursor: null }],
            pageParams: [undefined],
          } satisfies FeedData;
        }
        return {
          ...old,
          pages: [{ ...first, items: [optimistic, ...first.items] }, ...rest],
        };
      });

      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(FEED_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
    },
  });
}

/** Deletes one of the current user's activities, then refreshes the feed. */
export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, { previous?: FeedData }>({
    mutationFn: (id) => apiFetch<void>(`/activities/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: FEED_QUERY_KEY });
      const previous = queryClient.getQueryData<FeedData>(FEED_QUERY_KEY);
      queryClient.setQueryData<FeedData>(FEED_QUERY_KEY, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== id),
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(FEED_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
    },
  });
}
