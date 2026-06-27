import type { DiscoverCategory, TrendingItemDTO } from '@dml/shared';
import { useDiscover } from '../services/discover';
import { DiscoverItemCard } from './DiscoverItemCard';
import { StaleBanner } from './StaleBanner';

interface DiscoverListProps {
  category: DiscoverCategory;
  onStartActivity: (item: TrendingItemDTO) => void;
}

/** Renders trending items for a category with loading/empty/stale/error states. */
export function DiscoverList({ category, onStartActivity }: DiscoverListProps) {
  const { data, isLoading, isError, refetch } = useDiscover(category);

  if (isLoading) {
    return (
      <p className="feed-status" role="status">
        Loading trending {category}…
      </p>
    );
  }

  if (isError) {
    return (
      <div className="feed-status feed-status--error" role="alert">
        <p>We couldn’t load {category} right now.</p>
        <button type="button" className="btn" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="feed-empty">
        <h2>Nothing to show yet</h2>
        <p>Trending {category} are temporarily unavailable. Please check back soon.</p>
      </div>
    );
  }

  return (
    <div>
      {data.stale ? <StaleBanner /> : null}
      <div className="discover-grid">
        {data.items.map((item) => (
          <DiscoverItemCard key={item.providerId} item={item} onStartActivity={onStartActivity} />
        ))}
      </div>
    </div>
  );
}
