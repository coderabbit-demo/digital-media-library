import { useState } from 'react';
import { MEDIA_TYPES, type MediaType, type WishlistItemDTO } from '@dml/shared';
import { useWishlist, useRemoveFromWishlist } from '../services/wishlist';
import { ComposeDialog } from '../components/ComposeDialog';
import type { ComposeInitial } from '../components/PostUpdateForm';

const TYPE_LABELS: Record<MediaType, string> = {
  book: 'Books',
  music: 'Music',
  audiobook: 'Audiobooks',
  podcast: 'Podcasts',
};

const verb = (m: MediaType) => (m === 'book' ? 'reading' : 'listening to');

/**
 * The current user's private wishlist: a single all-media list with a media-type
 * filter. Each item can be removed or seed a "currently reading/listening" activity.
 */
export function Wishlist() {
  const [filter, setFilter] = useState<MediaType | 'all'>('all');
  const [compose, setCompose] = useState<ComposeInitial | null>(null);

  const { data, isLoading, isError, refetch } = useWishlist(filter === 'all' ? undefined : filter);
  const remove = useRemoveFromWishlist();

  const startActivity = (item: WishlistItemDTO) =>
    setCompose({ mediaType: item.mediaType, title: item.title, itemAuthor: item.itemAuthor ?? undefined });

  const items = data?.items ?? [];

  return (
    <div className="discover-page">
      <h1 className="discover-page__title">Wishlist</h1>

      <div className="wishlist-filters" role="tablist" aria-label="Filter by media type">
        <button
          type="button"
          className={`chip${filter === 'all' ? ' chip--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {MEDIA_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`chip${filter === t ? ' chip--active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="feed-status" role="status">
          Loading your wishlist…
        </p>
      ) : isError ? (
        <div className="feed-status feed-status--error" role="alert">
          <p>We couldn’t load your wishlist.</p>
          <button type="button" className="btn" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="feed-empty">
          <h2>{filter === 'all' ? 'Your wishlist is empty' : 'No items match this filter'}</h2>
          <p>
            {filter === 'all'
              ? 'Add items from Discover or Search to save them for later.'
              : 'Try a different media type, or clear the filter.'}
          </p>
        </div>
      ) : (
        <div className="discover-grid">
          {items.map((item) => (
            <article key={item.id} className="discover-card">
              {item.coverUrl ? (
                <img className="discover-card__cover" src={item.coverUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="discover-card__cover discover-card__cover--placeholder" aria-hidden="true">
                  {item.title.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="discover-card__body">
                <p className="discover-card__title">{item.title}</p>
                {item.itemAuthor ? <p className="discover-card__creator">{item.itemAuthor}</p> : null}
                <div className="discover-card__actions">
                  <button
                    type="button"
                    className="btn btn-primary discover-card__cta"
                    onClick={() =>
                      startActivity(item)
                    }
                  >
                    I’m {verb(item.mediaType)} this
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost discover-card__wishlist"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ComposeDialog open={compose !== null} initial={compose ?? undefined} onClose={() => setCompose(null)} />
    </div>
  );
}
