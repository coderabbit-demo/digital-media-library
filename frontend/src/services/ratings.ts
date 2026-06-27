import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaType, RatingDTO } from '@dml/shared';
import { apiFetch } from './api';

const RATINGS_QUERY_KEY = ['ratings'] as const;

export function ratingKey(item: { mediaType: MediaType; providerId: string }): string {
  return `${item.mediaType}:${item.providerId}`;
}

/** The current user's ratings as a `${mediaType}:${providerId}` → stars map. */
export function useRatings(): Map<string, number> {
  const { data } = useQuery<{ ratings: RatingDTO[] }>({
    queryKey: RATINGS_QUERY_KEY,
    queryFn: () => apiFetch<{ ratings: RatingDTO[] }>('/ratings'),
    staleTime: 30_000,
  });
  return new Map((data?.ratings ?? []).map((r) => [ratingKey(r), r.stars]));
}

export interface SetRatingInput {
  mediaType: MediaType;
  providerId: string;
  stars: number;
  title: string;
  creator?: string | null;
  coverUrl?: string | null;
}

/** Set the current user's star rating for an item. */
export function useSetRating() {
  const queryClient = useQueryClient();
  return useMutation<RatingDTO, Error, SetRatingInput>({
    mutationFn: (input) => apiFetch<RatingDTO>('/ratings', { method: 'PUT', body: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: RATINGS_QUERY_KEY }),
  });
}
