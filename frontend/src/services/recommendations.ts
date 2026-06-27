import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RecommendationDTO, TrendingItemDTO } from '@dml/shared';
import { apiFetch } from './api';
import { HOME_QUERY_KEY } from './home';

/** Recommend a media item (idempotent server-side). Refreshes the home panel. */
export function useRecommend() {
  const queryClient = useQueryClient();
  return useMutation<RecommendationDTO, Error, TrendingItemDTO>({
    mutationFn: (item) =>
      apiFetch<RecommendationDTO>('/recommendations', {
        method: 'POST',
        body: {
          mediaType: item.mediaType,
          title: item.title,
          creator: item.creator,
          coverUrl: item.coverUrl,
          providerId: item.providerId,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEY });
    },
  });
}

/** Remove a recommendation the current user made. Refreshes the home panel. */
export function useRemoveRecommendation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiFetch<void>(`/recommendations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEY });
    },
  });
}
