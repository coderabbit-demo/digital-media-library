import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReplyDTO, ReplyThreadDTO } from '@dml/shared';
import { apiFetch } from './api';
import { FEED_QUERY_KEY } from './feed';
import { HOME_QUERY_KEY } from './home';

const repliesKey = (activityId: string) => ['replies', activityId] as const;

/** The conversation thread for an activity (flat list; the UI builds the tree). */
export function useReplies(activityId: string, enabled: boolean) {
  return useQuery<ReplyThreadDTO>({
    queryKey: repliesKey(activityId),
    queryFn: () => apiFetch<ReplyThreadDTO>(`/activities/${activityId}/replies`),
    enabled,
    staleTime: 10_000,
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, activityId: string) {
  void queryClient.invalidateQueries({ queryKey: repliesKey(activityId) });
  // Feed/home carry reply counts.
  void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEY });
}

/** Post a reply (optionally nested under a parent reply). */
export function useCreateReply(activityId: string) {
  const queryClient = useQueryClient();
  return useMutation<ReplyDTO, Error, { body: string; parentId?: string | null }>({
    mutationFn: (input) =>
      apiFetch<ReplyDTO>(`/activities/${activityId}/replies`, { method: 'POST', body: input }),
    onSuccess: () => invalidate(queryClient, activityId),
  });
}

/** Delete one of the current user's replies. */
export function useDeleteReply(activityId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiFetch<void>(`/replies/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(queryClient, activityId),
  });
}
