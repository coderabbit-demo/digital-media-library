import { useState } from 'react';
import type { DiscoverCategory, TrendingItemDTO } from '@dml/shared';
import { DiscoverList } from '../components/DiscoverList';
import { ComposeDialog } from '../components/ComposeDialog';
import type { ComposeInitial } from '../components/PostUpdateForm';

const TITLES: Record<DiscoverCategory, string> = {
  books: 'Books · Discover',
  music: 'Music · Discover',
  audiobooks: 'Audiobooks · Discover',
  podcasts: 'Podcasts · Discover',
};

/**
 * Per-category Discover page: trending items (cached, provider-backed) with a
 * per-item "start an activity" action that opens the compose overlay pre-filled.
 */
export function Discover({ category }: { category: DiscoverCategory }) {
  const [compose, setCompose] = useState<ComposeInitial | null>(null);

  const startActivity = (item: TrendingItemDTO) =>
    setCompose({ mediaType: item.mediaType, title: item.title, itemAuthor: item.creator ?? undefined });

  return (
    <div className="discover-page">
      <h1 className="discover-page__title">{TITLES[category]}</h1>
      <DiscoverList category={category} onStartActivity={startActivity} />
      <ComposeDialog
        open={compose !== null}
        initial={compose ?? undefined}
        onClose={() => setCompose(null)}
      />
    </div>
  );
}
