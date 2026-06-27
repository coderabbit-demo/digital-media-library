import type { MediaType } from '@dml/shared';

const LABELS: Record<MediaType, string> = {
  book: 'Books',
  music: 'Music',
  audiobook: 'Audiobooks',
};

/**
 * Placeholder for a category's Discover view. The trending Discover experience is
 * delivered in feature 003; this keeps primary navigation resolvable now.
 */
export function CategoryPlaceholder({ category }: { category: MediaType }) {
  return (
    <div className="feed-empty">
      <h2>{LABELS[category]} · Discover</h2>
      <p>Trending {LABELS[category].toLowerCase()} are coming soon.</p>
    </div>
  );
}
