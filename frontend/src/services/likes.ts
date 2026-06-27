import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { FEED_QUERY_KEY } from './feed';
import { HOME_QUERY_KEY } from './home';

/** Like or unlike an activity; refreshes the feed (which carries like counts). */
export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { activityId: string; liked: boolean }>({
    mutationFn: ({ activityId, liked }) =>
      apiFetch<void>(`/activities/${activityId}/like`, { method: liked ? 'DELETE' : 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEY });
    },
  });
}
