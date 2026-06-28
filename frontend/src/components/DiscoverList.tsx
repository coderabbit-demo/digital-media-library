import { useState } from 'react';
import type { DiscoverCategory, TrendingItemDTO } from '@dml/shared';
import { useDiscover } from '../services/discover';
import { DiscoverItemCard } from './DiscoverItemCard';
import { StaleBanner } from './StaleBanner';

interface DiscoverListProps {
  category: DiscoverCategory;
  onStartActivity: (item: TrendingItemDTO) => void;
}

/** Max items shown per genre section. */
const PER_SECTION = 12;

/** Group items into labeled genre sections (preserving first-seen genre order). */
function groupByGenre(items: TrendingItemDTO[]): { genre: string; items: TrendingItemDTO[] }[] {
  const map = new Map<string, TrendingItemDTO[]>();
  for (const item of items) {
    if (!item.genre) continue;
    const bucket = map.get(item.genre) ?? [];
    if (bucket.length < PER_SECTION) bucket.push(item);
    map.set(item.genre, bucket);
  }
  return [...map.entries()].map(([genre, groupItems]) => ({ genre, items: groupItems }));
}

/**
 * Renders trending items for a category. Items carrying a genre (books, music,
 * podcasts) are shown as labeled genre sections; ungrouped items (audiobooks)
 * render as one grid. Includes loading/empty/stale/error states.
 */
export function DiscoverList({ category, onStartActivity }: DiscoverListProps) {
  const { data, isLoading, isError, refetch } = useDiscover(category);
  const [genre, setGenre] = useState<string>('all');

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

  const sections = groupByGenre(data.items);
  // Genres are derived from the live data (they shift as trending changes), so the
  // chips are always built from what's actually present. A stale selection (after
  // the data or category changes) falls back to "all".
  const genres = sections.map((s) => s.genre);
  const activeGenre = genres.includes(genre) ? genre : 'all';
  const visibleSections = activeGenre === 'all' ? sections : sections.filter((s) => s.genre === activeGenre);
  // Items without a genre still belong in the "All" view; they'd otherwise be
  // dropped whenever the payload mixes tagged and untagged items.
  const ungrouped = data.items.filter((item) => !item.genre);

  return (
    <div>
      {data.stale ? <StaleBanner /> : null}

      {genres.length > 1 ? (
        <div className="wishlist-filters discover-genre-filter" role="group" aria-label="Filter by genre">
          <button
            type="button"
            className={`chip${activeGenre === 'all' ? ' chip--active' : ''}`}
            aria-pressed={activeGenre === 'all'}
            onClick={() => setGenre('all')}
          >
            All
          </button>
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              className={`chip${activeGenre === g ? ' chip--active' : ''}`}
              aria-pressed={activeGenre === g}
              onClick={() => setGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>
      ) : null}

      {sections.length > 0 ? (
        <>
          {visibleSections.map((section) => (
            <section key={section.genre} className="discover-section">
              <h2 className="discover-section__title">{section.genre}</h2>
              <div className="discover-grid">
                {section.items.map((item) => (
                  <DiscoverItemCard key={item.providerId} item={item} onStartActivity={onStartActivity} />
                ))}
              </div>
            </section>
          ))}
          {activeGenre === 'all' && ungrouped.length > 0 ? (
            <div className="discover-grid">
              {ungrouped.map((item) => (
                <DiscoverItemCard key={item.providerId} item={item} onStartActivity={onStartActivity} />
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="discover-grid">
          {data.items.map((item) => (
            <DiscoverItemCard key={item.providerId} item={item} onStartActivity={onStartActivity} />
          ))}
        </div>
      )}
    </div>
  );
}
