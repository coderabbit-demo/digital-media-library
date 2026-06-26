import { useEffect, useRef } from 'react';
import { flattenFeed, useDeleteActivity, useFeed } from '../services/feed';
import { ActivityCard } from './ActivityCard';

/**
 * Renders the activity feed: a list of ActivityCards with a load-more control
 * (plus IntersectionObserver-driven infinite scroll), an inviting empty state,
 * and loading/error states.
 */
export function FeedList() {
  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useFeed();
  const deleteActivity = useDeleteActivity();

  const activities = flattenFeed(data);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return <p className="feed-status" role="status">Loading the feed…</p>;
  }

  if (isError) {
    return (
      <div className="feed-status feed-status--error" role="alert">
        <p>We couldn’t load the feed{error instanceof Error ? `: ${error.message}` : '.'}</p>
        <button type="button" className="btn" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="feed-empty">
        <h2>Your feed is quiet… for now</h2>
        <p>Be the first to share what you’re currently reading or listening to.</p>
      </div>
    );
  }

  return (
    <div className="feed-list">
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onDelete={(id) => deleteActivity.mutate(id)}
          deleting={deleteActivity.isPending && deleteActivity.variables === activity.id}
        />
      ))}

      <div ref={sentinelRef} aria-hidden="true" />

      {hasNextPage ? (
        <button
          type="button"
          className="btn feed-load-more"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load older updates'}
        </button>
      ) : (
        <p className="feed-end">You’re all caught up.</p>
      )}
    </div>
  );
}
